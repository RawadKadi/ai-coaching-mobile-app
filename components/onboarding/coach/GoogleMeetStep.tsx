import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Image,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Video, CheckCircle2, ArrowRight } from 'lucide-react-native';
import { useBrandColors } from '@/contexts/BrandContext';
import { googleMeetService } from '@/lib/google-meet-service';
import { useAuth } from '@/contexts/AuthContext';
import SectionLabel from '../SectionLabel';
import GoogleIcon from '@/components/GoogleIcon';

interface GoogleMeetStepProps {
  onStatusChange?: (connected: boolean) => void;
}

export default function GoogleMeetStep({ onStatusChange }: GoogleMeetStepProps) {
  const colors = useBrandColors();
  const { coach, refreshProfile, user, profile } = useAuth();
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    checkStatus();
  }, [coach]);

  const checkStatus = async () => {
    if (coach) {
      const isConn = await googleMeetService.isConnected(coach);
      setConnected(isConn);
      onStatusChange?.(isConn);
    }
    setChecking(false);
  };

  const handleConnect = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    if (!coach?.id) {
      Alert.alert('Error', 'Coach profile not loaded yet.');
      return;
    }

    setLoading(true);
    try {
      const res = await googleMeetService.connect(coach.id, user?.email);
      if (res.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        await refreshProfile();
        setConnected(true);
        onStatusChange?.(true);
      } else if (res.errorType === 'scope_missing') {
        Alert.alert(
          'Permissions Needed',
          'Meeting permissions were not allowed. Please tap Connect again and make sure to check "Select all" on Google\'s screen.'
        );
      } else if (res.error && res.errorType !== 'cancelled') {
        Alert.alert('Google Meet', res.error);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not connect Google Meet');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!coach?.id) return;
    await googleMeetService.disconnect(coach.id);
    await refreshProfile();
    setConnected(false);
    onStatusChange?.(false);
  };

  const cardBg = colors.surface || '#121212';
  const cardBorder = colors.border || 'rgba(255, 255, 255, 0.08)';
  const textColor = colors.text || '#FFFFFF';
  const textSecondary = colors.textSecondary || '#94A3B8';
  const textOnPrimary = colors.textOnPrimary || '#FFFFFF';

  return (
    <View style={styles.container}>
      <SectionLabel
        step="Step 4"
        title="Video Sessions"
        desc="Connect Google Meet to create automatic meeting links for your client sessions."
      />

      <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
        <View style={[styles.iconWrap, { backgroundColor: colors.primary + '20' }]}>
          <Video size={40} color={colors.primary} />
        </View>

        <Text style={[styles.title, { color: textColor }]}>Google Meet</Text>
        <Text style={[styles.subtitle, { color: textSecondary }]}>
          Connect your Google account so clients get automatic meeting links whenever a session is scheduled.
        </Text>

        {checking ? (
          <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 20 }} />
        ) : connected ? (
          <View style={styles.connectedBox}>
            <View style={styles.connectedRow}>
              <CheckCircle2 size={22} color="#34D399" />
              <Text style={styles.connectedText}>Connected</Text>
            </View>
            <TouchableOpacity onPress={handleDisconnect} style={styles.disconnectBtn}>
              <Text style={styles.disconnectText}>Disconnect</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.connectBtn, { backgroundColor: colors.primary }]}
            onPress={handleConnect}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator size="small" color={textOnPrimary} />
            ) : (
              <View style={styles.btnRow}>
                <GoogleIcon size={24} />
                <Text style={[styles.connectBtnText, { color: textOnPrimary }]}>Connect Google Meet</Text>
              </View>
            )}
          </TouchableOpacity>
        )}

        <Text style={[styles.hint, { color: textSecondary }]}>
          You can also manage or reconnect this anytime in App Settings.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 20,
  },
  card: {
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    marginTop: 8,
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  connectBtn: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  googleIcon: {
    width: 20,
    height: 20,
  },
  connectBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  connectedBox: {
    width: '100%',
    backgroundColor: '#022C22',
    borderWidth: 1,
    borderColor: '#059669',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  connectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  connectedText: {
    color: '#34D399',
    fontSize: 15,
    fontWeight: '800',
  },
  disconnectBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  disconnectText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  hint: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
  },
});
