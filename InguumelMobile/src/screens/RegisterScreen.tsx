import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '~/navigation/types';
import { register as apiRegister } from '~/api/auth';
import { authStore, TOKEN_MISSING_CODE, AUTH_RESPONSE_MISSING_FIELDS_CODE } from '~/store/authStore';
import { useApp } from '~/state/AppContext';
import type { AppError } from '~/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

const PIN_LENGTH = 6;

function getErrorMessage(e: AppError & { code?: string }): string {
  const code = e.code ?? '';
  if (code === AUTH_RESPONSE_MISSING_FIELDS_CODE) return 'Серверээс шаардлагатай мэдээлэл ирээгүй байна. Дахин оролдоно уу.';
  if (code === TOKEN_MISSING_CODE) return 'Серверээс нэвтрэх мэдээлэл ирээгүй байна. Дахин оролдоно уу.';
  if (code === 'INVALID_PIN') return 'ПИН код буруу байна.';
  if (code === 'INVALID_CREDENTIALS') return 'Утасны дугаар эсвэл ПИН код буруу байна.';
  if (code === 'VALIDATION_ERROR') return e.message ?? 'Мэдээллээ шалгана уу.';
  if (code === 'NETWORK_ERROR' || code === 'TIMEOUT') return 'Интернэт холболтоо шалгана уу.';
  if (code === 'SERVER_ERROR' || (e.status && e.status >= 500)) {
    return e.request_id
      ? `Системийн алдаа. Дахин оролдоно уу. (request_id: ${e.request_id})`
      : 'Системийн алдаа. Дахин оролдоно уу.';
  }
  return e.message ?? 'Алдаа гарлаа. Дахин оролдоно уу.';
}

export function RegisterScreen({ navigation }: Props) {
  const { setAuthToken } = useApp();
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ phone?: string; pin?: string; pin_confirm?: string }>({});

  const handleRegister = async () => {
    setFieldErrors({});

    const phoneTrim = phone.trim();
    if (!phoneTrim) {
      setFieldErrors((prev) => ({ ...prev, phone: 'Утасны дугаар оруулна уу.' }));
      return;
    }
    if (!pin) {
      setFieldErrors((prev) => ({ ...prev, pin: 'ПИН код оруулна уу.' }));
      return;
    }
    if (pin.length !== PIN_LENGTH) {
      setFieldErrors((prev) => ({ ...prev, pin: `ПИН код яг ${PIN_LENGTH} оронтой байна.` }));
      return;
    }
    if (pin !== pinConfirm) {
      setFieldErrors((prev) => ({ ...prev, pin_confirm: 'ПИН код тохирохгүй байна.' }));
      return;
    }

    setLoading(true);
    try {
      await apiRegister({ phone: phoneTrim, pin, pin_confirm: pinConfirm });
      const sessionId = await authStore.getState().login(phoneTrim, pin);
      setAuthToken(sessionId);
    } catch (err) {
      const e = err as AppError;
      if (e.fieldErrors) {
        const next: { phone?: string; pin?: string; pin_confirm?: string } = {};
        const phoneErr = e.fieldErrors.phone?.[0];
        const pinErr = e.fieldErrors.pin?.[0];
        const pinConfirmErr = e.fieldErrors.pin_confirm?.[0];
        if (phoneErr) next.phone = phoneErr;
        if (pinErr) next.pin = pinErr;
        if (pinConfirmErr) next.pin_confirm = pinConfirmErr;
        setFieldErrors(next);
      }
      const message = e.code === 'VALIDATION_ERROR' && e.fieldErrors
        ? Object.values(e.fieldErrors).flat().join(' ') || getErrorMessage(e)
        : getErrorMessage(e);
      Alert.alert('Алдаа', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Бүртгүүлэх</Text>
        <View style={styles.inputWrap}>
          <TextInput
            style={[styles.input, fieldErrors.phone ? styles.inputError : null]}
            placeholder="Утасны дугаар"
            placeholderTextColor="#94a3b8"
            value={phone}
            onChangeText={(t) => {
              setPhone(t);
              if (fieldErrors.phone) setFieldErrors((prev) => ({ ...prev, phone: undefined }));
            }}
            autoCapitalize="none"
            keyboardType="phone-pad"
            editable={!loading}
          />
          {fieldErrors.phone ? <Text style={styles.errorText}>{fieldErrors.phone}</Text> : null}
        </View>
        <View style={styles.inputWrap}>
          <TextInput
            style={[styles.input, fieldErrors.pin ? styles.inputError : null]}
            placeholder="ПИН код (6 оронтой)"
            placeholderTextColor="#94a3b8"
            value={pin}
            onChangeText={(t) => {
              setPin(t);
              if (fieldErrors.pin) setFieldErrors((prev) => ({ ...prev, pin: undefined }));
            }}
            secureTextEntry
            keyboardType="number-pad"
            editable={!loading}
          />
          {fieldErrors.pin ? <Text style={styles.errorText}>{fieldErrors.pin}</Text> : null}
        </View>
        <View style={styles.inputWrap}>
          <TextInput
            style={[styles.input, fieldErrors.pin_confirm ? styles.inputError : null]}
            placeholder="ПИН код давтах"
            placeholderTextColor="#94a3b8"
            value={pinConfirm}
            onChangeText={(t) => {
              setPinConfirm(t);
              if (fieldErrors.pin_confirm) setFieldErrors((prev) => ({ ...prev, pin_confirm: undefined }));
            }}
            secureTextEntry
            keyboardType="number-pad"
            editable={!loading}
          />
          {fieldErrors.pin_confirm ? <Text style={styles.errorText}>{fieldErrors.pin_confirm}</Text> : null}
        </View>
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleRegister}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.buttonText}>Бүртгүүлэх</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.backLink}
          onPress={() => navigation.navigate('Login')}
          disabled={loading}
          hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
        >
          <Text style={styles.backLinkText}>Нэвтрэх рүү буцах</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
    justifyContent: 'center',
    minHeight: '100%',
  },
  title: {
    fontSize: 26,
    fontWeight: '600',
    marginBottom: 28,
    textAlign: 'center',
    color: '#0f172a',
  },
  inputWrap: {
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 17,
    backgroundColor: '#fff',
  },
  inputError: {
    borderColor: '#ef4444',
  },
  errorText: {
    fontSize: 13,
    color: '#ef4444',
    marginTop: 4,
    marginLeft: 4,
  },
  button: {
    backgroundColor: '#2563eb',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    minHeight: 52,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  backLink: {
    alignItems: 'center',
    marginTop: 24,
  },
  backLinkText: {
    fontSize: 15,
    color: '#2563eb',
    fontWeight: '500',
  },
});
