import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Pressable,
  Image,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  Video,
  X,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Mail,
  Check,
} from 'lucide-react-native';
import { useBrandColors, useTheme } from '@/contexts/BrandContext';
import { googleMeetService } from '@/lib/google-meet-service';
import GoogleIcon from '@/components/GoogleIcon';

const SELECT_ALL_IMG = require('@/assets/images/google/select-all.png');

interface GoogleMeetGateModalProps {
  visible: boolean;
  coachId?: string;
  expectedEmail?: string;
  onClose: () => void;
  onConnected: () => void;
}

type ViewMode =
  | 'connect'
  | 'loading'
  | 'success'
  | 'email_mismatch'
  | 'scope_missing'
  | 'error';

export default function GoogleMeetGateModal({
  visible,
  coachId,
  expectedEmail,
  onClose,
  onConnected,
}: GoogleMeetGateModalProps) {
  const colors = useBrandColors();
  const { isDarkMode } = useTheme();
  const cardBg = colors.surface || '#121212';
  const cardBorder = colors.border || 'rgba(255, 255, 255, 0.08)';
  const textColor = colors.text || '#FFFFFF';
  const textSecondary = colors.textSecondary || '#94A3B8';
  const textOnPrimary = colors.textOnPrimary || '#FFFFFF';

  const [viewMode, setViewMode] = useState<ViewMode>('connect');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [mismatchData, setMismatchData] = useState<{
    expectedEmail: string;
    connectedEmail: string;
  } | null>(null);

  useEffect(() => {
    if (visible) {
      setViewMode('connect');
      setErrorMessage(null);
      setMismatchData(null);
    }
  }, [visible]);

  const handleConnect = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    if (!coachId) {
      setErrorMessage('Coach profile not found.');
      setViewMode('error');
      return;
    }

    setViewMode('loading');
    try {
      const res = await googleMeetService.connect(coachId, expectedEmail);
      if (res.success) {
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        ).catch(() => {});
        setViewMode('success');
      } else if (res.errorType === 'scope_missing') {
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Warning,
        ).catch(() => {});
        setViewMode('scope_missing');
      } else if (res.errorType === 'email_mismatch') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
          () => {},
        );
        setMismatchData({
          expectedEmail: res.expectedEmail || expectedEmail || '',
          connectedEmail: res.connectedEmail || '',
        });
        setViewMode('email_mismatch');
      } else if (res.errorType === 'cancelled') {
        setViewMode('connect');
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
          () => {},
        );
        setErrorMessage(res.error || 'Could not connect Google Meet');
        setViewMode('error');
      }
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
        () => {},
      );
      setErrorMessage(e.message || 'Could not connect Google Meet');
      setViewMode('error');
    }
  };

  const handleSuccessDone = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onConnected();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[
            styles.card,
            {
              backgroundColor: cardBg,
              borderColor: cardBorder,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          {viewMode !== 'loading' && (
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <X size={20} color={textSecondary} />
            </TouchableOpacity>
          )}

          {/* VIEW: CONNECT (DEFAULT) */}
          {viewMode === 'connect' && (
            <>
              <View
                style={[
                  styles.iconCircle,
                  { backgroundColor: colors.primary + '20' },
                ]}
              >
                <Video size={36} color={colors.primary} />
              </View>

              <Text style={[styles.title, { color: textColor }]}>
                Connect Google Meet
              </Text>

              {/* Visual Guide Label */}
              <Text style={[styles.guideLabel, { color: textSecondary }]}>
                On Google, make sure to check{' '}
                <Text style={{ color: textColor, fontWeight: '700' }}>
                  "Select all"
                </Text>
                :
              </Text>

              {/* Visual Preview Image */}
              <View style={styles.imageWrapper}>
                <Image
                  source={SELECT_ALL_IMG}
                  style={styles.previewImage}
                  resizeMode="contain"
                />
              </View>

              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
                onPress={handleConnect}
                activeOpacity={0.8}
              >
                <View style={styles.btnRow}>
                  <GoogleIcon size={24} />
                  <Text
                    style={[styles.primaryBtnText, { color: textOnPrimary }]}
                  >
                    Connect Google Meet
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                <Text style={[styles.cancelBtnText, { color: textSecondary }]}>
                  Maybe Later
                </Text>
              </TouchableOpacity>
            </>
          )}

          {/* VIEW: LOADING */}
          {viewMode === 'loading' && (
            <View style={styles.stateContainer}>
              <View
                style={[
                  styles.iconCircle,
                  { backgroundColor: colors.primary + '15' },
                ]}
              >
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
              <Text style={[styles.title, { color: textColor }]}>
                Connecting Google...
              </Text>
              <Text style={[styles.subtitle, { color: textSecondary }]}>
                Please finish signing in via your browser.
              </Text>
            </View>
          )}

          {/* VIEW: SUCCESS */}
          {viewMode === 'success' && (
            <>
              <View
                style={[styles.iconCircle, { backgroundColor: '#10B98120' }]}
              >
                <CheckCircle2 size={40} color="#10B981" />
              </View>

              <Text style={[styles.title, { color: textColor }]}>
                Successfully Connected
              </Text>
              <Text style={[styles.subtitle, { color: textSecondary }]}>
                Your Google Meet account is now connected! You can now schedule
                sessions with automatic meeting links.
              </Text>

              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: '#10B981' }]}
                onPress={handleSuccessDone}
                activeOpacity={0.8}
              >
                <Text style={[styles.primaryBtnText, { color: '#FFFFFF' }]}>
                  Continue
                </Text>
              </TouchableOpacity>
            </>
          )}

          {/* VIEW: SCOPE MISSING (PERMISSION CHECKBOXES UNCHECKED) */}
          {viewMode === 'scope_missing' && (
            <>
              <View
                style={[styles.iconCircle, { backgroundColor: '#F59E0B20' }]}
              >
                <AlertTriangle size={36} color="#F59E0B" />
              </View>

              <Text style={[styles.title, { color: textColor }]}>
                Permissions Needed
              </Text>
              <Text style={[styles.subtitle, { color: textSecondary }]}>
                Google connected, but meeting permissions were turned off. The
                app needs these to create your session links.
              </Text>

              {/* Visual Guide Label */}
              <Text style={[styles.guideLabel, { color: '#F59E0B' }]}>
                Please check{' '}
                <Text style={{ fontWeight: '800' }}>"Select all"</Text> on
                Google's screen:
              </Text>

              {/* Visual Preview Image */}
              <View style={styles.imageWrapper}>
                <Image
                  source={SELECT_ALL_IMG}
                  style={styles.previewImage}
                  resizeMode="contain"
                />
              </View>

              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
                onPress={handleConnect}
                activeOpacity={0.8}
              >
                <View style={styles.btnRow}>
                  <GoogleIcon size={24} />
                  <Text
                    style={[styles.primaryBtnText, { color: textOnPrimary }]}
                  >
                    Try Again
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                <Text style={[styles.cancelBtnText, { color: textSecondary }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </>
          )}

          {/* VIEW: EMAIL MISMATCH */}
          {viewMode === 'email_mismatch' && (
            <>
              <View
                style={[styles.iconCircle, { backgroundColor: '#EF444420' }]}
              >
                <AlertTriangle size={36} color="#EF4444" />
              </View>

              <Text style={[styles.title, { color: textColor }]}>
                Email Mismatch
              </Text>

              <View
                style={[
                  styles.mismatchCard,
                  {
                    backgroundColor: 'rgba(239, 68, 68, 0.08)',
                    borderColor: 'rgba(239, 68, 68, 0.25)',
                  },
                ]}
              >
                <Text style={[styles.mismatchBody, { color: textColor }]}>
                  Your personal email is{' '}
                  <Text style={{ fontWeight: '800', color: colors.primary }}>
                    {mismatchData?.expectedEmail}
                  </Text>{' '}
                  and connected your google meet with a different email (
                  <Text style={{ fontWeight: '800', color: '#EF4444' }}>
                    {mismatchData?.connectedEmail}
                  </Text>
                  ).
                </Text>
                <Text style={styles.mismatchNotice}>
                  Make sure to connect your google email that matches this sign
                  in email or else it won't work.
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
                onPress={handleConnect}
                activeOpacity={0.8}
              >
                <View style={styles.btnRow}>
                  <GoogleIcon size={24} />
                  <Text
                    style={[styles.primaryBtnText, { color: textOnPrimary }]}
                  >
                    Try Again
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                <Text style={[styles.cancelBtnText, { color: textSecondary }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </>
          )}

          {/* VIEW: GENERAL ERROR */}
          {viewMode === 'error' && (
            <>
              <View
                style={[styles.iconCircle, { backgroundColor: '#EF444420' }]}
              >
                <AlertCircle size={36} color="#EF4444" />
              </View>

              <Text style={[styles.title, { color: textColor }]}>
                Connection Failed
              </Text>
              <Text style={[styles.subtitle, { color: textSecondary }]}>
                {errorMessage ||
                  'Something went wrong while connecting your account.'}
              </Text>

              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
                onPress={() => setViewMode('connect')}
                activeOpacity={0.8}
              >
                <Text style={[styles.primaryBtnText, { color: textOnPrimary }]}>
                  Try Again
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                <Text style={[styles.cancelBtnText, { color: textSecondary }]}>
                  Close
                </Text>
              </TouchableOpacity>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    position: 'relative',
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 6,
    zIndex: 10,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 14,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 14,
  },
  hintBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
    marginBottom: 12,
  },
  hintText: {
    fontSize: 11,
    fontWeight: '700',
  },
  guideLabel: {
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
    marginBottom: 8,
  },
  imageWrapper: {
    width: '92%',
    maxWidth: 290,
    aspectRatio: 3896 / 2011,
    alignSelf: 'center',
    marginBottom: 0,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  stateContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  mismatchCard: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 20,
  },
  mismatchBody: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  mismatchNotice: {
    fontSize: 12,
    color: '#EF4444',
    lineHeight: 16,
    fontWeight: '600',
  },
  primaryBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  cancelBtn: {
    paddingVertical: 6,
  },
  cancelBtnText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '600',
  },
});
