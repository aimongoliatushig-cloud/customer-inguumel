import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
  ScrollView,
} from 'react-native';
import { authStore, TOKEN_MISSING_CODE, AUTH_RESPONSE_MISSING_FIELDS_CODE } from '~/store/authStore';
import { useApp } from '~/state/AppContext';
import type { AppError } from '~/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '~/navigation/types';

const LOGO_SOURCE = require('../../assets/logo.png');

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

const LOGO_WIDTH = 108;

export function LoginScreen({ navigation, route }: Props) {
  const { setAuthToken } = useApp();
  const [phone, setPhone] = useState(route.params?.phone ?? '');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!phone.trim() || !pin) {
      Alert.alert('Алдаа', 'Утасны дугаар болон ПИН кодыг оруулна уу.');
      return;
    }
    setLoading(true);
    try {
      const sessionId = await authStore.getState().login(phone.trim(), pin);
      setAuthToken(sessionId);
    } catch (err) {
      const e = err as AppError & { code?: string };
      const message =
        e.code === 'AUTH_ME_UNAUTHORIZED'
          ? 'Нэвтрэлт тогтоогүй. Дахин оролдоно уу.'
          : e.code === AUTH_RESPONSE_MISSING_FIELDS_CODE
            ? 'Серверээс шаардлагатай мэдээлэл ирээгүй байна. Дахин оролдоно уу.'
            : e.code === TOKEN_MISSING_CODE
              ? 'Серверээс нэвтрэх мэдээлэл ирээгүй байна. Дахин оролдоно уу.'
              : (e.message ?? 'Дахин оролдоно уу.');
      Alert.alert('Нэвтрэх амжилтгүй', message);
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
        <View style={styles.logoWrap}>
          <Image
            source={LOGO_SOURCE}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
        <View style={styles.heroCard}>
          <Text style={styles.title}>Нэвтрэх</Text>
          <Text style={styles.subtitle}>
            Өөрийн байршилд ойр агуулахаас бараа захиалах хэрэглэгчийн орчин.
          </Text>
          <Text style={styles.helper}>
            Бүртгэлтэй утасны дугаар болон 6 оронтой ПИН кодоо ашиглан орно.
          </Text>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.fieldLabel}>Утасны дугаар</Text>
          <TextInput
            style={styles.input}
            placeholder="99112233"
            placeholderTextColor="#94a3b8"
            value={phone}
            onChangeText={setPhone}
            autoCapitalize="none"
            keyboardType="phone-pad"
            editable={!loading}
          />
          <Text style={styles.fieldLabel}>ПИН код</Text>
          <TextInput
            style={styles.input}
            placeholder="123456"
            placeholderTextColor="#94a3b8"
            value={pin}
            onChangeText={setPin}
            secureTextEntry
            keyboardType="number-pad"
            editable={!loading}
          />
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Нэвтэрч байна…' : 'Үргэлжлүүлэх'}
            </Text>
          </TouchableOpacity>
          <View style={styles.registerRow}>
            <Text style={styles.registerPrompt}>Бүртгэлгүй юу?</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('Register')}
              disabled={loading}
              hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
            >
              <Text style={styles.registerLink}>Бүртгүүлэх</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
    justifyContent: 'center',
    minHeight: '100%',
  },
  logoWrap: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logo: {
    width: LOGO_WIDTH,
    height: LOGO_WIDTH,
  },
  heroCard: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 24,
    padding: 22,
    marginBottom: 18,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 10,
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    color: '#1e3a8a',
    marginBottom: 8,
  },
  helper: {
    fontSize: 14,
    lineHeight: 20,
    color: '#475569',
  },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 22,
    elevation: 4,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
    fontSize: 17,
    backgroundColor: '#f8fafc',
  },
  button: {
    backgroundColor: '#0f766e',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  registerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    gap: 6,
  },
  registerPrompt: {
    fontSize: 15,
    color: '#64748b',
  },
  registerLink: {
    fontSize: 15,
    color: '#2563eb',
    fontWeight: '600',
  },
});
