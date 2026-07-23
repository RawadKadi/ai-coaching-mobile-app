import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Pressable,
  Platform,
  Linking,
} from 'react-native';
import { useTheme } from '@/contexts/BrandContext';
import { X, Video, ExternalLink } from 'lucide-react-native';
import { useRouter } from 'expo-router';

// Toggle for developer mode to test both routes easily
// Set to 'true' for dev testing selection modal, 'false' for production direct routing
export const DEV_MODE_ROUTING = true;

interface JoinSessionModalProps {
  visible: boolean;
  onClose: () => void;
  session: {
    id: string;
    meeting_provider?: 'STREAM' | 'GOOGLE_MEET';
    external_meeting_url?: string | null;
    client_id?: string;
  };
  isCoach: boolean;
  participantName: string;
}

export default function JoinSessionModal({
  visible,
  onClose,
  session,
  isCoach,
  participantName,
}: JoinSessionModalProps) {
  const theme = useTheme();
  const router = useRouter();
  const styles = getStyles(theme.colors);

  const hasExternalUrl = Boolean(
    session.external_meeting_url && !session.external_meeting_url.includes('jit.si')
  );
  const isGoogleMeetAvailable = hasExternalUrl;
  const provider = session.meeting_provider || 'STREAM';

  const handleOpenStream = () => {
    onClose();
    // Route to in-app stream call screen
    router.push({
      pathname: '/call/[id]' as any,
      params: {
        id: session.id,
        roomName: `coaching-session-${session.id}`,
        participantName,
        isCoach: isCoach ? 'true' : 'false',
      },
    });
  };

  const handleOpenGoogleMeet = async () => {
    onClose();
    const url = session.external_meeting_url;
    if (!url) return;
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        await Linking.openURL(url);
      }
    } catch (err) {
      console.error('Failed to open Google Meet URL:', err);
    }
  };

  // If in Production Mode, skip showing the modal and route immediately
  React.useEffect(() => {
    if (visible && !DEV_MODE_ROUTING) {
      if (provider === 'GOOGLE_MEET') {
        if (isGoogleMeetAvailable) {
          handleOpenGoogleMeet();
        } else {
          // If no link, fallback directly to Stream Native Video
          handleOpenStream();
        }
      } else {
        handleOpenStream();
      }
    }
  }, [visible]);

  // If Production Mode is active, don't render the UI since it auto-redirects
  if (!DEV_MODE_ROUTING) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} pointerEvents="box-none">
          <View style={styles.header}>
            <Text style={styles.title}>Join Session</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <X size={20} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>Choose how you want to join your video session.</Text>

          <View style={styles.optionsContainer}>
            {/* Option 1: Native Stream Call */}
            <TouchableOpacity
              style={styles.optionButton}
              onPress={handleOpenStream}
              activeOpacity={0.8}
            >
              <View style={[styles.iconContainer, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                <Video size={20} color="#10B981" />
              </View>
              <View style={styles.optionTextContainer}>
                <Text style={styles.optionTitle}>In-App Video Call</Text>
                <Text style={styles.optionDesc}>Start instantly inside this app</Text>
              </View>
            </TouchableOpacity>

            {/* Option 2: Google Meet (External) */}
            <TouchableOpacity
              style={[
                styles.optionButton,
                !isGoogleMeetAvailable && styles.disabledOption,
              ]}
              disabled={!isGoogleMeetAvailable}
              onPress={handleOpenGoogleMeet}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.iconContainer,
                  { backgroundColor: isGoogleMeetAvailable ? 'rgba(59, 130, 246, 0.1)' : 'rgba(100, 116, 139, 0.1)' },
                ]}
              >
                <ExternalLink size={20} color={isGoogleMeetAvailable ? '#3B82F6' : '#64748B'} />
              </View>
              <View style={styles.optionTextContainer}>
                <View style={styles.optionTitleRow}>
                  <Text style={[styles.optionTitle, !isGoogleMeetAvailable && styles.disabledText]}>
                    Google Meet
                  </Text>
                </View>
                <Text style={styles.optionDesc}>
                  {isGoogleMeetAvailable ? 'Open custom meeting link' : 'No Google Meet link provided.'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Developer Mode Tag */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>DEV MODE: Select Provider</Text>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: '#0B0E14',
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: Platform.OS === 'ios' ? 40 : 24,
      borderTopWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    title: {
      color: '#FFFFFF',
      fontSize: 18,
      fontWeight: '700',
    },
    closeBtn: {
      padding: 4,
    },
    subtitle: {
      color: '#94A3B8',
      fontSize: 14,
      marginBottom: 20,
    },
    optionsContainer: {
      gap: 12,
      marginBottom: 20,
    },
    optionButton: {
      flexDirection: 'row',
      backgroundColor: 'rgba(255, 255, 255, 0.03)',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.06)',
      borderRadius: 16,
      padding: 16,
      alignItems: 'center',
      gap: 14,
    },
    disabledOption: {
      opacity: 0.5,
    },
    iconContainer: {
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    optionTextContainer: {
      flex: 1,
      justifyContent: 'center',
    },
    optionTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 2,
    },
    optionTitle: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '600',
    },
    disabledText: {
      color: '#64748B',
    },
    optionDesc: {
      color: '#64748B',
      fontSize: 12,
    },
    badge: {
      backgroundColor: 'rgba(239, 68, 68, 0.1)',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      borderWidth: 0.5,
      borderColor: 'rgba(239, 68, 68, 0.2)',
    },
    badgeText: {
      color: '#F87171',
      fontSize: 10,
      fontWeight: '600',
    },
    footer: {
      alignItems: 'center',
      justifyContent: 'center',
      borderTopWidth: 1,
      borderTopColor: 'rgba(255, 255, 255, 0.04)',
      paddingTop: 12,
      marginTop: 8,
    },
    footerText: {
      color: '#64748B',
      fontSize: 11,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
  });
