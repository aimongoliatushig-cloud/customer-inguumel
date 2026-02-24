import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AVATAR_STORAGE_KEY = 'profile_avatar_uri';

export interface AvatarHeaderProps {
  name: string;
  maskedPhone: string;
  /** Optional image URL from backend (future) */
  imageUrl?: string | null;
  loading?: boolean;
}

function getInitials(name: string): string {
  if (!name || typeof name !== 'string') return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export function AvatarHeader({
  name,
  maskedPhone,
  imageUrl,
  loading = false,
}: AvatarHeaderProps) {
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(AVATAR_STORAGE_KEY).then((uri) => {
      if (uri) setLocalUri(uri);
    });
  }, []);

  const saveAvatarUri = useCallback((uri: string | null) => {
    if (uri) {
      AsyncStorage.setItem(AVATAR_STORAGE_KEY, uri);
      setLocalUri(uri);
    } else {
      AsyncStorage.removeItem(AVATAR_STORAGE_KEY);
      setLocalUri(null);
    }
  }, []);

  const handlePickImage = useCallback(async () => {
    setPicking(true);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Зөвшөөрөл шаардлагатай',
          'Зургаа сонгохын тулд цомгийн эрхийг идэвхжүүлнэ үү.'
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        saveAvatarUri(result.assets[0].uri);
      }
    } catch {
      Alert.alert('Алдаа', 'Зургаа сонгоход алдаа гарлаа.');
    } finally {
      setPicking(false);
    }
  }, [saveAvatarUri]);

  const displayUri = localUri ?? imageUrl ?? null;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.avatarWrap}
        onPress={handlePickImage}
        disabled={picking}
        activeOpacity={0.8}
      >
        {displayUri ? (
          <Image source={{ uri: displayUri }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarInitials}>{getInitials(name)}</Text>
          </View>
        )}
        {picking ? (
          <View style={styles.avatarOverlay}>
            <ActivityIndicator color="#fff" size="small" />
          </View>
        ) : (
          <View style={styles.changeBadge}>
            <Ionicons name="camera" size={14} color="#fff" />
          </View>
        )}
      </TouchableOpacity>
      {loading ? (
        <ActivityIndicator size="small" color="#64748b" style={styles.loader} />
      ) : (
        <>
          <Text style={styles.name}>{name || 'Хэрэглэгч'}</Text>
          <Text style={styles.phone}>{maskedPhone}</Text>
        </>
      )}
    </View>
  );
}

const AVATAR_SIZE = 88;

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  avatarWrap: {
    position: 'relative',
    marginBottom: 12,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
  },
  avatarPlaceholder: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    fontSize: 32,
    fontWeight: '600',
    color: '#64748b',
  },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  changeBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  loader: {
    marginVertical: 8,
  },
  name: {
    fontSize: 20,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 4,
  },
  phone: {
    fontSize: 15,
    color: '#64748b',
  },
});
