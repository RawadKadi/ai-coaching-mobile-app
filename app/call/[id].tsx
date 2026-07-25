import React, { useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Video, ArrowLeft } from 'lucide-react-native';
import { joinSession } from '@/utils/session';

export default function CallScreen() {
  const { meet_url, external_meeting_url } = useLocalSearchParams<{
    meet_url?: string;
    external_meeting_url?: string;
  }>();
  const router = useRouter();
  const targetUrl = meet_url || external_meeting_url;

  useEffect(() => {
    if (targetUrl) {
      joinSession(targetUrl);
    }
  }, [targetUrl]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Google Meet</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.cardContainer}>
        <View style={styles.iconCircle}>
          <Video size={40} color="#60A5FA" />
        </View>

        <Text style={styles.title}>Join Google Meet</Text>
        <Text style={styles.description}>
          Video calls are conducted externally via Google Meet.
        </Text>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => joinSession(targetUrl)}
        >
          <Video size={18} color="#FFFFFF" />
          <Text style={styles.primaryButtonText}>Open Google Meet</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.back()}
        >
          <Text style={styles.secondaryButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0E14',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  cardContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 16,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(96, 165, 250, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.25)',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  description: {
    color: '#94A3B8',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#059669',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 24,
    width: '100%',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
  },
});
