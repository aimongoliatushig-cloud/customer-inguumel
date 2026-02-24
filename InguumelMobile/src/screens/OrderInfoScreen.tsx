import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StackActions } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CartStackParamList } from '~/navigation/types';
import type { AppError } from '~/types';
import { cartStore } from '~/store/cartStore';
import { locationStore } from '~/store/locationStore';
import { authStore } from '~/store/authStore';
import {
  checkoutV1,
  setOrderAddress,
  confirmOrder,
  getMe,
  getCart,
  getMxmOrders,
  invalidateLuckyEligibilityCache,
} from '~/api/endpoints';
import { getPaymentMethodLabel } from '~/utils/orderI18n';
import { getAlertMessage, normalizeError, isRetriableError } from '~/utils/errors';

type Props = NativeStackScreenProps<CartStackParamList, 'OrderInfo'>;

type PaymentMethod = 'cod' | 'qpay';

interface FormErrors {
  phone_primary?: string;
  delivery_address?: string;
  payment_method?: string;
}

/** Safe fallback so we never read .length on undefined. */
const EMPTY_LINES: { id: number; product_id: number; qty: number }[] = [];

/** Generate a unique idempotency key per submit to avoid duplicate confirms. */
function useIdempotencyKey(): () => string {
  const ref = useRef(0);
  return useCallback(() => {
    ref.current += 1;
    return `order-confirm-${Date.now()}-${ref.current}`;
  }, []);
}

export function OrderInfoScreen({ navigation }: Props) {
  const warehouseId = locationStore((s) => s.warehouse_id);
  const submitInFlightRef = useRef(false);
  const nextIdempotencyKey = useIdempotencyKey();

  const [phonePrimary, setPhonePrimary] = useState('');
  const [phoneSecondary, setPhoneSecondary] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cod');
  const [loading, setLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [errors, setErrors] = useState<FormErrors>({});
  const [createErrorToast, setCreateErrorToast] = useState<string | null>(null);
  const [errorRequestId, setErrorRequestId] = useState<string | null>(null);
  const [errorIsRetriable, setErrorIsRetriable] = useState(false);
  const [successToast, setSuccessToast] = useState(false);

  // Load profile on mount: optional cache first, then /me (source of truth)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cached = await authStore.getState().getLastOrderProfile();
      if (cancelled) return;
      if (cached) {
        setPhonePrimary(cached.phone_primary ?? '');
        setPhoneSecondary(cached.phone_secondary ?? '');
        setDeliveryAddress(cached.delivery_address ?? '');
      }
      setProfileLoading(true);
      try {
        const res = await getMe();
        if (cancelled) return;
        if (res.success && res.data) {
          const me = res.data;
          setPhonePrimary(me.phone_primary ?? '');
          setPhoneSecondary(me.phone_secondary ?? '');
          setDeliveryAddress(me.delivery_address ?? '');
        }
      } catch (e) {
        if (cancelled) return;
        const err = e as { code?: string; status?: number };
        if (err.status === 401 || err.code === 'UNAUTHORIZED') {
          return;
        }
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {};
    const primary = (phonePrimary ?? '').trim();
    const address = (deliveryAddress ?? '').trim();

    const phoneClean = primary.replace(/\D/g, '');
    if (!phoneClean) {
      newErrors.phone_primary = 'Утасны дугаар оруулна уу';
    } else if (phoneClean.length < 8) {
      newErrors.phone_primary = 'Утасны дугаар буруу байна';
    }

    if (!address) {
      newErrors.delivery_address = 'Хүргэлтийн хаяг оруулна уу';
    } else if (address.length < 10) {
      newErrors.delivery_address = 'Хаягаа дэлгэрэнгүй оруулна уу';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [phonePrimary, deliveryAddress]);

  const performSuccessFlow = useCallback(
    (orderId: number, warehouseIdForCart?: number | null, paymentMethodForMeta?: PaymentMethod) => {
      const wh = warehouseIdForCart ?? warehouseId;
      cartStore.getState().resetCart();
      (async () => {
        if (wh != null) {
          try {
            const freshCart = await getCart(wh);
            cartStore.getState().setCart(freshCart);
          } catch {
            // keep local reset
          }
        }
      })();
      authStore.getState().setLastOrderProfile({
        phone_primary: (phonePrimary ?? '').trim(),
        phone_secondary: (phoneSecondary ?? '').trim(),
        delivery_address: (deliveryAddress ?? '').trim(),
      });
      if (wh != null && paymentMethodForMeta != null) {
        authStore.getState().setLastOrderMeta({
          last_order_payment_method: paymentMethodForMeta,
          last_order_id: orderId,
          last_order_created_at: new Date().toISOString(),
          last_order_warehouse_id: wh,
        });
      }
      setSuccessToast(true);
      setLoading(false);
      const tabNav = navigation.getParent()?.getParent();
      const navigateToDetail = () => {
        navigation.dispatch(StackActions.popToTop());
        (tabNav as { navigate: (name: string, params?: object) => void } | undefined)?.navigate('Orders', {
          screen: 'OrderDetail',
          params: { orderId, fromCreate: true },
        });
      };
      setTimeout(navigateToDetail, 500);
    },
    [warehouseId, phonePrimary, phoneSecondary, deliveryAddress, navigation]
  );

  const handleSubmit = useCallback(async () => {
    if (loading || submitInFlightRef.current) return;
    if (!validateForm()) return;

    const resolvedWarehouseId = warehouseId ?? (await locationStore.getState().getWarehouseIdAsync());
    if (resolvedWarehouseId == null) {
      Alert.alert('Анхааруулга', 'Агуулах сонгогдоогүй байна');
      return;
    }

    const cartId = cartStore.getState().cart_id;
    const lines = cartStore.getState().lines ?? EMPTY_LINES;

    if (!cartId || lines.length === 0) {
      Alert.alert('Сагс хоосон', 'Захиалахын тулд бараа нэмнэ үү.');
      navigation.goBack();
      return;
    }

    setCreateErrorToast(null);
    setErrorRequestId(null);
    setErrorIsRetriable(false);
    setSuccessToast(false);
    setLoading(true);
    submitInFlightRef.current = true;

    const idempotencyKey = nextIdempotencyKey();
    const phone = (phonePrimary ?? '').trim();
    const phoneSec = (phoneSecondary ?? '').trim() || undefined;
    const address = (deliveryAddress ?? '').trim();

    try {
      // 1) Checkout → order_id
      const { order_id: orderId } = await checkoutV1(idempotencyKey, resolvedWarehouseId);
      if (orderId == null || Number.isNaN(Number(orderId)) || orderId <= 0) {
        throw new Error('Checkout did not return a valid order_id');
      }
      // 2) Attach address
      await setOrderAddress(orderId, { phone_primary: phone, phone_secondary: phoneSec, delivery_address: address }, resolvedWarehouseId);
      // 3) Confirm
      const { orderId: confirmedOrderId } = await confirmOrder(orderId, { payment_method: paymentMethod }, resolvedWarehouseId);

      submitInFlightRef.current = false;
      // Refresh My Orders list so the new order appears
      if (resolvedWarehouseId != null) {
        getMxmOrders(resolvedWarehouseId, { limit: 20 }).catch(() => {});
        invalidateLuckyEligibilityCache(resolvedWarehouseId);
      }
      performSuccessFlow(confirmedOrderId, resolvedWarehouseId, paymentMethod);
      return;
    } catch (_submitErr) {
      submitInFlightRef.current = false;

      const hasCode = _submitErr && typeof _submitErr === 'object' && 'code' in (_submitErr as object);
      const appError: AppError & { request_id?: string } = hasCode
        ? {
            code: (_submitErr as AppError).code,
            message: (_submitErr as AppError).message,
            request_id: (_submitErr as AppError).request_id,
            status: (_submitErr as AppError).status,
            fieldErrors: (_submitErr as AppError).fieldErrors,
          }
        : normalizeError(_submitErr);

      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        const endpoint =
          appError.message?.includes('address') ? 'POST /api/v1/orders/{id}/address'
          : appError.message?.includes('confirm') ? 'POST /api/v1/orders/{id}/confirm'
          : 'POST /api/v1/cart/checkout';
        // eslint-disable-next-line no-console
        console.log('[Order confirm] error', {
          endpoint,
          status: appError.status,
          request_id: appError.request_id,
          code: appError.code,
          message: appError.message,
        });
      }

      if (appError.status === 401 || appError.code === 'UNAUTHORIZED') {
        setLoading(false);
        return;
      }
      if (appError.code === 'PHONE_REQUIRED') {
        setErrors((prev) => ({ ...prev, phone_primary: appError.message ?? 'Утасны дугаар оруулна уу' }));
        setLoading(false);
        return;
      }
      if (appError.code === 'ADDRESS_REQUIRED') {
        setErrors((prev) => ({ ...prev, delivery_address: appError.message ?? 'Хүргэлтийн хаяг оруулна уу' }));
        setLoading(false);
        return;
      }
      if (appError.code === 'WAREHOUSE_REQUIRED') {
        Alert.alert('Анхааруулга', 'Агуулах сонгогдоогүй байна');
        setLoading(false);
        return;
      }
      if (appError.code === 'VALIDATION_ERROR') {
        if (appError.fieldErrors) {
          const backendErrors: FormErrors = {};
          if (appError.fieldErrors.phone_primary?.length) {
            backendErrors.phone_primary = appError.fieldErrors.phone_primary[0];
          }
          if (appError.fieldErrors.delivery_address?.length) {
            backendErrors.delivery_address = appError.fieldErrors.delivery_address[0];
          }
          if (appError.fieldErrors.payment_method?.length) {
            backendErrors.payment_method = appError.fieldErrors.payment_method[0];
          }
          setErrors(backendErrors);
        }
        setErrorRequestId(appError.request_id ?? null);
        setCreateErrorToast(appError.message ?? 'Баталгаажуулахад алдаа гарлаа.');
        setLoading(false);
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
          // eslint-disable-next-line no-console
          console.log('[Order confirm] VALIDATION_ERROR request_id=', appError.request_id, 'message=', appError.message);
        }
        return;
      }

      const msg = getAlertMessage(appError);
      const retriable = isRetriableError(appError);
      setErrorRequestId(appError.request_id ?? null);
      setErrorIsRetriable(retriable);
      setCreateErrorToast(msg);
      setLoading(false);
      if (!retriable) {
        Alert.alert('Алдаа', msg);
      }
    }
  }, [validateForm, warehouseId, phonePrimary, phoneSecondary, deliveryAddress, paymentMethod, navigation, performSuccessFlow, nextIdempotencyKey]);

  const primary = (phonePrimary ?? '').trim();
  const address = (deliveryAddress ?? '').trim();
  const isFormValid = primary.length >= 8 && address.length >= 10;
  const isSubmitting = loading || profileLoading;
  const hasWarehouse = warehouseId != null;

  useEffect(() => {
    if (!createErrorToast) return;
    const t = setTimeout(() => setCreateErrorToast(null), 4000);
    return () => clearTimeout(t);
  }, [createErrorToast]);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {successToast && (
        <View style={styles.successToast}>
          <Ionicons name="checkmark-circle" size={20} color="#fff" />
          <Text style={styles.toastText} numberOfLines={2}>Захиалга амжилттай үүслээ</Text>
        </View>
      )}
      {createErrorToast != null && (
        <View style={styles.toast}>
          <Ionicons name="alert-circle" size={20} color="#fff" />
          <View style={styles.toastContent}>
            <Text style={styles.toastText} numberOfLines={2}>{createErrorToast}</Text>
            {errorRequestId != null && (
              <Text style={styles.toastRequestId}>Error ID: {errorRequestId}</Text>
            )}
          </View>
          {errorIsRetriable && (
            <TouchableOpacity
              onPress={() => {
                setCreateErrorToast(null);
                setErrorRequestId(null);
                setErrorIsRetriable(false);
              }}
              style={styles.toastRetry}
              activeOpacity={0.8}
            >
              <Text style={styles.toastRetryText}>Дахин оролдох</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => {
              setCreateErrorToast(null);
              setErrorRequestId(null);
              setErrorIsRetriable(false);
            }}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={styles.toastClose}
          >
            <Ionicons name="close" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      )}
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Phone Primary */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Утасны дугаар *</Text>
            <TextInput
              style={[styles.input, errors.phone_primary && styles.inputError]}
              placeholder="Утасны дугаар"
              placeholderTextColor="#94a3b8"
              value={phonePrimary}
              onChangeText={(text) => {
                setPhonePrimary(text);
                if (errors.phone_primary) {
                  setErrors((prev) => ({ ...prev, phone_primary: undefined }));
                }
              }}
              keyboardType="phone-pad"
              editable={!loading}
              maxLength={12}
            />
            {errors.phone_primary && (
              <Text style={styles.errorText}>{errors.phone_primary}</Text>
            )}
          </View>

          {/* Phone Secondary */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Нэмэлт утас (заавал биш)</Text>
            <TextInput
              style={styles.input}
              placeholder="Нэмэлт утасны дугаар"
              placeholderTextColor="#94a3b8"
              value={phoneSecondary}
              onChangeText={setPhoneSecondary}
              keyboardType="phone-pad"
              editable={!loading}
              maxLength={12}
            />
          </View>

          {/* Delivery Address */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Хүргэлтийн хаяг *</Text>
            <TextInput
              style={[
                styles.input,
                styles.textArea,
                errors.delivery_address && styles.inputError,
              ]}
              placeholder="Хаягаа дэлгэрэнгүй оруулна уу"
              placeholderTextColor="#94a3b8"
              value={deliveryAddress}
              onChangeText={(text) => {
                setDeliveryAddress(text);
                if (errors.delivery_address) {
                  setErrors((prev) => ({ ...prev, delivery_address: undefined }));
                }
              }}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              editable={!loading}
            />
            {errors.delivery_address && (
              <Text style={styles.errorText}>{errors.delivery_address}</Text>
            )}
          </View>

          {/* Payment Method */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Төлбөрийн хэлбэр</Text>
            
            {/* COD Option */}
            <TouchableOpacity
              style={[
                styles.paymentOption,
                paymentMethod === 'cod' && styles.paymentOptionSelected,
              ]}
              onPress={() => setPaymentMethod('cod')}
              disabled={loading}
              activeOpacity={0.7}
            >
              <View style={styles.paymentOptionContent}>
                <View style={[
                  styles.radioOuter,
                  paymentMethod === 'cod' && styles.radioOuterSelected,
                ]}>
                  {paymentMethod === 'cod' && <View style={styles.radioInner} />}
                </View>
                <Ionicons
                  name="cash-outline"
                  size={22}
                  color={paymentMethod === 'cod' ? '#2563eb' : '#64748b'}
                  style={styles.paymentIcon}
                />
                <View style={styles.paymentTextContainer}>
                  <Text style={[
                    styles.paymentTitle,
                    paymentMethod === 'cod' && styles.paymentTitleSelected,
                  ]}>
                    {getPaymentMethodLabel('cod')}
                  </Text>
                  <Text style={styles.paymentSubtitle}>
                    Хүргэлтийн үед төлөх
                  </Text>
                </View>
              </View>
            </TouchableOpacity>

            {/* QPay Option - Disabled */}
            <TouchableOpacity
              style={[styles.paymentOption, styles.paymentOptionDisabled]}
              disabled
              activeOpacity={1}
            >
              <View style={styles.paymentOptionContent}>
                <View style={[styles.radioOuter, styles.radioOuterDisabled]}>
                  {/* No inner circle - disabled */}
                </View>
                <Ionicons
                  name="qr-code-outline"
                  size={22}
                  color="#94a3b8"
                  style={styles.paymentIcon}
                />
                <View style={styles.paymentTextContainer}>
                  <Text style={[styles.paymentTitle, styles.paymentTitleDisabled]}>
                    {getPaymentMethodLabel('qpay')}
                  </Text>
                  <Text style={styles.paymentSubtitleDisabled}>
                    Тун удахгүй...
                  </Text>
                </View>
              </View>
              <View style={styles.comingSoonBadge}>
                <Text style={styles.comingSoonText}>Coming soon</Text>
              </View>
            </TouchableOpacity>
            {errors.payment_method != null && (
              <Text style={styles.errorText}>{errors.payment_method}</Text>
            )}
          </View>
        </ScrollView>

        {/* Submit Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.submitButton,
              (!isFormValid || isSubmitting || !hasWarehouse) && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={!isFormValid || isSubmitting || !hasWarehouse}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : profileLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.submitButtonText}>Захиалга баталгаажуулах</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#fff',
  },
  successToast: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16a34a',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 10,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dc2626',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 10,
  },
  toastContent: {
    flex: 1,
  },
  toastText: {
    fontSize: 14,
    color: '#fff',
  },
  toastRequestId: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 4,
  },
  toastRetry: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 8,
  },
  toastRetryText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  toastClose: {
    padding: 4,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 24,
  },
  fieldGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#0f172a',
  },
  inputError: {
    borderColor: '#ef4444',
  },
  textArea: {
    minHeight: 100,
    paddingTop: 14,
  },
  errorText: {
    fontSize: 13,
    color: '#ef4444',
    marginTop: 6,
    marginLeft: 4,
  },
  paymentOption: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  paymentOptionSelected: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  paymentOptionDisabled: {
    backgroundColor: '#f8fafc',
    opacity: 0.7,
  },
  paymentOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  radioOuterSelected: {
    borderColor: '#2563eb',
  },
  radioOuterDisabled: {
    borderColor: '#e2e8f0',
    backgroundColor: '#f1f5f9',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2563eb',
  },
  paymentIcon: {
    marginRight: 12,
  },
  paymentTextContainer: {
    flex: 1,
  },
  paymentTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#0f172a',
  },
  paymentTitleSelected: {
    color: '#2563eb',
    fontWeight: '600',
  },
  paymentTitleDisabled: {
    color: '#94a3b8',
  },
  paymentSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  paymentSubtitleDisabled: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 2,
  },
  comingSoonBadge: {
    position: 'absolute',
    top: 14,
    right: 16,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  comingSoonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
    textTransform: 'uppercase',
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    backgroundColor: '#fff',
  },
  submitButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 54,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
});
