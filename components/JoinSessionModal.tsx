import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Pressable,
  Platform,
} from 'react-native';
import { useTheme } from '@/contexts/BrandContext';
import { X, Video } from 'lucide-react-native';
import { joinSession } from '@/utils/session';

interface JoinSessionModalProps {
  visible: boolean;
  onClose: () => void;
  session: {
    id: string;
    meeting_url?: string | null;
    external_meeting_url?: string | null;
  };
  isCoach?: boolean;
  participantName?: string;
}

export default function JoinSessionModal({
  visible,
  onClose,
  session,
  participantName,
}: JoinSessionModalProps) {
  const theme = useTheme();
  const styles = getStyles(theme.colors);

  const meetingUrl = session.external_meeting_url || session.meeting_url;

  const handleJoin = () => {
    onClose();
    joinSession(meetingUrl);
  };

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
            <Text style={styles.title}>Video Session</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <X size={20} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>
            {participantName
              ? `Join video session with ${participantName} via Google Meet.`
              : 'Join video session via Google Meet.'}
          </Text>

          <TouchableOpacity
            style={styles.joinButton}
            onPress={handleJoin}
            activeOpacity={0.85}
          >
            <Video size={20} color="#FFFFFF" />
            <Text style={styles.joinButtonText}>Join Google Meet</Text>
          </TouchableOpacity>
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
      marginBottom: 24,
      lineHeight: 20,
    },
    joinButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      backgroundColor: '#059669',
      paddingVertical: 14,
      borderRadius: 24,
      width: '100%',
    },
    joinButtonText: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '700',
    },
  });
