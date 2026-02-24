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
        <Text style={styles.title}>Нэвтрэх</Text>
        <TextInput
          style={styles.input}
          placeholder="Утасны дугаар"
          placeholderTextColor="#94a3b8"
          value={phone}
          onChangeText={setPhone}
          autoCapitalize="none"
          keyboardType="phone-pad"
          editable={!loading}
        />
        <TextInput
          style={styles.input}
          placeholder="ПИН код"
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
            {loading ? 'Нэвтэрч байна…' : 'Нэвтрэх'}
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
    paddingTop: 32,
    paddingBottom: 40,
    justifyContent: 'center',
    minHeight: '100%',
  },
  logoWrap: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    width: LOGO_WIDTH,
    height: LOGO_WIDTH,
  },
  title: {
    fontSize: 26,
    fontWeight: '600',
    marginBottom: 28,
    textAlign: 'center',
    color: '#0f172a',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
    fontSize: 17,
    backgroundColor: '#fff',
  },
  button: {
    backgroundColor: '#2563eb',
    paddingVertical: 16,
    borderRadius: 12,
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
