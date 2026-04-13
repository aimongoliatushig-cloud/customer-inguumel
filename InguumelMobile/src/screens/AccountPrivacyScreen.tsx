import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { deleteAccount } from '~/api/auth';
import { legal } from '~/constants/legal';
import type { ProfileStackParamList } from '~/navigation/types';
import { useApp } from '~/state/AppContext';
import { authStore } from '~/store/authStore';
import type { AppError } from '~/types';

type Props = NativeStackScreenProps<ProfileStackParamList, 'AccountPrivacy'>;

async function openExternalUrl(url: string, label: string) {
  const supported = await Linking.canOpenURL(url);
  if (!supported) {
    Alert.alert('Нээж чадсангүй', `${label} холбоосыг нээх боломжгүй байна.`);
    return;
  }
  await Linking.openURL(url);
}

export function AccountPrivacyScreen({ navigation }: Props) {
  const { setAuthToken } = useApp();
  const [deleting, setDeleting] = useState(false);

  const handleDeleteAccount = () => {
    Alert.alert(
      'Бүртгэл устгах',
      'Энэ үйлдэл таны нэвтрэх эрхийг шууд цуцална. Хадгалах шаардлагатай захиалгын бүртгэлүүд anonymize хэлбэрээр үлдэж магадгүй.',
      [
        { text: 'Болих', style: 'cancel' },
        {
          text: 'Устгах',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteAccount();
              await authStore.getState().clearSessionOnly();
              setAuthToken(null);
              Alert.alert(
                'Бүртгэл устлаа',
                'Таны бүртгэл идэвхгүй болж, хувийн мэдээлэл танигдахгүй хэлбэрт шилжлээ.'
              );
            } catch (err) {
              const appErr = err as AppError;
              Alert.alert(
                'Устгаж чадсангүй',
                appErr.message ?? 'Дахин оролдоно уу.'
              );
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.heroCard}>
        <Text style={styles.title}>Нууцлал ба бүртгэл</Text>
        <Text style={styles.subtitle}>
          Store review болон хэрэглэгчийн итгэлцэлд хэрэгтэй account, privacy, data deletion мэдээлэл.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Хууль ба бодлого</Text>
        <TouchableOpacity
          style={styles.row}
          activeOpacity={0.8}
          onPress={() => openExternalUrl(legal.privacyPolicyUrl, 'Нууцлалын бодлого')}
        >
          <View style={styles.rowTextWrap}>
            <Text style={styles.rowLabel}>Нууцлалын бодлого</Text>
            <Text style={styles.rowHint}>Ямар мэдээлэл цуглардаг, яаж ашиглагддагийг харна.</Text>
          </View>
          <Text style={styles.rowAction}>Нээх</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.row}
          activeOpacity={0.8}
          onPress={() => openExternalUrl(legal.termsUrl, 'Үйлчилгээний нөхцөл')}
        >
          <View style={styles.rowTextWrap}>
            <Text style={styles.rowLabel}>Үйлчилгээний нөхцөл</Text>
            <Text style={styles.rowHint}>Захиалга, хүргэлт, хэрэглээний ерөнхий нөхцөл.</Text>
          </View>
          <Text style={styles.rowAction}>Нээх</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.row, styles.rowLast]}
          activeOpacity={0.8}
          onPress={() => openExternalUrl(legal.accountDeletionUrl, 'Бүртгэл устгах заавар')}
        >
          <View style={styles.rowTextWrap}>
            <Text style={styles.rowLabel}>Веб устгалын заавар</Text>
            <Text style={styles.rowHint}>App-гүй үедээ ч deletion request хийх public page.</Text>
          </View>
          <Text style={styles.rowAction}>Нээх</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Өгөгдөл ба зөвшөөрөл</Text>
        <Text style={styles.bullet}>• Утасны дугаар, PIN, хүргэлтийн хаяг, захиалгын түүх сервер дээр ашиглагдана.</Text>
        <Text style={styles.bullet}>• Профайлын зураг нь зөвхөн төхөөрөмж дээр хадгалагдана.</Text>
        <Text style={styles.note}>{legal.avatarDisclosure}</Text>
        <Text style={styles.note}>{legal.accountDeletionRetentionNote}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Бүртгэл устгах</Text>
        <Text style={styles.deleteText}>
          Хэрэв та апп-аас гарах биш, бүр мөсөн устгахыг хүсвэл доорх товчийг ашиглана.
        </Text>
        <TouchableOpacity
          style={[styles.deleteButton, deleting && styles.buttonDisabled]}
          activeOpacity={0.8}
          onPress={handleDeleteAccount}
          disabled={deleting}
        >
          {deleting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.deleteButtonText}>Бүртгэл устгах</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryButton}
          activeOpacity={0.8}
          onPress={() => navigation.goBack()}
          disabled={deleting}
        >
          <Text style={styles.secondaryButtonText}>Профайл руу буцах</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    padding: 16,
    paddingBottom: 36,
    gap: 16,
  },
  heroCard: {
    backgroundColor: '#ecfeff',
    borderColor: '#99f6e4',
    borderWidth: 1,
    borderRadius: 24,
    padding: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: '#334155',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 18,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowTextWrap: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 4,
  },
  rowHint: {
    fontSize: 13,
    lineHeight: 18,
    color: '#64748b',
  },
  rowAction: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f766e',
  },
  bullet: {
    fontSize: 14,
    lineHeight: 21,
    color: '#334155',
    marginBottom: 8,
  },
  note: {
    fontSize: 13,
    lineHeight: 20,
    color: '#64748b',
    marginTop: 4,
  },
  deleteText: {
    fontSize: 14,
    lineHeight: 21,
    color: '#334155',
    marginBottom: 16,
  },
  deleteButton: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    minHeight: 48,
    borderRadius: 14,
    marginTop: 10,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#1d4ed8',
    fontSize: 15,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
});
