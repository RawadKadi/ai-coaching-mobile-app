import { useTheme, Theme } from '@/contexts/BrandContext';
import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, SafeAreaView, Linking, StatusBar } from 'react-native';
import { X, Send, FileText, FileAudio, Play, Pause, FileSpreadsheet, File } from 'lucide-react-native';
import { Image } from 'expo-image';
import { Video, ResizeMode, Audio } from 'expo-av';
import { WebView } from 'react-native-webview';
import { isDarkColor } from '@/lib/theme-utils';

interface DocumentPreviewModalProps {
  visible: boolean;
  uri: string | null;
  type: string | null;
  fileName: string | null;
  onClose: () => void;
  onSend?: (caption: string) => void;
  isSending?: boolean;
}

export default function DocumentPreviewModal({ visible, uri, type, fileName, onClose, onSend, isSending }: DocumentPreviewModalProps) {
  const theme = useTheme();
  const colors = theme.colors;
  const isDark = isDarkColor(colors.background || '#010417');
  const styles = useMemo(() => getStyles(theme, isDark), [theme, isDark]);
  const [caption, setCaption] = useState('');
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);

  const safeFileName = fileName || '';
  const safeType = type || '';
  
  const getExtension = (path: string) => path?.toLowerCase().split('?')[0].split('.').pop() || '';
  
  const isAudio = safeType === 'audio' || ['mp3', 'wav', 'm4a'].includes(getExtension(safeFileName)) || (uri && ['mp3', 'wav', 'm4a'].includes(getExtension(uri)));
  const isImage = safeType === 'image';
  const isVideo = safeType === 'video';
  const isPdf = safeType === 'application/pdf' || getExtension(safeFileName) === 'pdf' || (uri && getExtension(uri) === 'pdf');
  const isExcel = safeType === 'application/vnd.ms-excel' || ['xlsx', 'xls', 'csv'].includes(getExtension(safeFileName)) || (uri && ['xlsx', 'xls', 'csv'].includes(getExtension(uri)));

  useEffect(() => {
    if (!visible) {
      if (sound) {
        sound.unloadAsync();
        setSound(null);
      }
      setIsPlaying(false);
      setCaption('');
      setPosition(0);
      setDuration(0);
    } else {
      if (isAudio && uri) {
        loadAudio(uri);
      }
    }
  }, [visible]);

  const loadAudio = async (audioUri: string) => {
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
      });
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: audioUri },
        { shouldPlay: false },
        (status) => {
          if (status.isLoaded) {
            setPosition(status.positionMillis);
            setDuration(status.durationMillis || 0);
            setIsPlaying(status.isPlaying);
            if (status.didJustFinish) {
              setIsPlaying(false);
              setPosition(0);
              newSound.setPositionAsync(0);
            }
          }
        }
      );
      setSound(newSound);
    } catch (e) {
      console.log('Error loading audio:', e);
    }
  };

  const togglePlayPause = async () => {
    if (!sound) return;
    if (isPlaying) {
      await sound.pauseAsync();
    } else {
      await sound.playAsync();
    }
  };

  const formatTime = (millis: number) => {
    const totalSeconds = Math.floor(millis / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const renderContent = () => {
    if (!uri) return null;

    if (isImage) {
      return <Image source={{ uri }} style={styles.contentImage} contentFit="contain" />;
    }
    
    if (isVideo) {
      return (
        <Video
          source={{ uri }}
          style={styles.contentVideo}
          useNativeControls
          resizeMode={ResizeMode.CONTAIN}
          shouldPlay
        />
      );
    }

    if (isAudio) {
      return (
        <View style={styles.audioContainer}>
          <FileAudio size={80} color={colors.textSecondary} style={{ marginBottom: 32 }} />
          <TouchableOpacity style={styles.playButton} onPress={togglePlayPause}>
            {isPlaying ? (
              <Pause size={32} color={colors.textOnPrimary || '#FFFFFF'} fill={colors.textOnPrimary || '#FFFFFF'} />
            ) : (
              <Play size={32} color={colors.textOnPrimary || '#FFFFFF'} fill={colors.textOnPrimary || '#FFFFFF'} style={{ marginLeft: 4 }} />
            )}
          </TouchableOpacity>
          <View style={styles.audioProgressContainer}>
            <Text style={styles.audioTime}>{formatTime(position)}</Text>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: duration > 0 ? `${(position / duration) * 100}%` : '0%' }]} />
            </View>
            <Text style={styles.audioTime}>{formatTime(duration)}</Text>
          </View>
        </View>
      );
    }

    if ((isPdf || isExcel) && Platform.OS === 'ios') {
      return (
        <WebView 
          source={{ uri }} 
          style={styles.contentWebview} 
          allowFileAccess={true}
          originWhitelist={['*']}
          allowFileAccessFromFileURLs={true}
          allowUniversalAccessFromFileURLs={true}
        />
      );
    }

    return (
      <View style={styles.genericContainer}>
        {isExcel ? <FileSpreadsheet size={80} color={colors.accent || '#34D399'} /> : <FileText size={80} color={colors.primary} />}
        <Text style={styles.genericText}>Preview not available for this file type</Text>
        <Text style={styles.genericSubText}>{fileName}</Text>
        <TouchableOpacity 
          style={styles.openFileButton} 
          onPress={() => Linking.openURL(uri)}
        >
          <Text style={styles.openFileButtonText}>Open File</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{fileName || 'Attachment'}</Text>
          <View style={{ width: 44 }} />
        </View>

        <View style={styles.contentArea}>
          {renderContent()}
        </View>

        {onSend ? (
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={styles.footer}>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Add a caption..."
                  placeholderTextColor={colors.textTertiary || (isDark ? '#94A3B8' : '#9CA3AF')}
                  value={caption}
                  onChangeText={setCaption}
                  multiline
                  editable={!isSending}
                />
                <TouchableOpacity 
                  style={[styles.sendButton, (!uri || isSending) && { opacity: 0.5 }]} 
                  onPress={() => onSend(caption)}
                  disabled={!uri || isSending}
                >
                  {isSending ? (
                    <ActivityIndicator size="small" color={colors.textOnPrimary || '#FFFFFF'} />
                  ) : (
                    <Send size={20} color={colors.textOnPrimary || '#FFFFFF'} fill={colors.textOnPrimary || '#FFFFFF'} />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        ) : (
          <View style={{ height: 32 }} />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const getStyles = (theme: Theme, isDark: boolean) => {
  const colors = theme.colors;
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.background,
    },
    closeButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.06)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '600',
      flex: 1,
      textAlign: 'center',
      marginHorizontal: 16,
      fontFamily: theme.typography?.fontFamily,
    },
    contentArea: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'stretch',
      backgroundColor: colors.background,
    },
    contentImage: {
      width: '100%',
      height: '100%',
    },
    contentVideo: {
      width: '100%',
      height: '100%',
    },
    contentWebview: {
      width: '100%',
      flex: 1,
      backgroundColor: colors.background,
    },
    audioContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      paddingHorizontal: 32,
    },
    playButton: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 40,
    },
    audioProgressContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      width: '100%',
    },
    audioTime: {
      color: colors.textSecondary,
      fontSize: 12,
      fontVariant: ['tabular-nums'],
      width: 40,
      textAlign: 'center',
      fontFamily: theme.typography?.fontFamily,
    },
    progressBarBg: {
      flex: 1,
      height: 6,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)',
      borderRadius: 3,
      marginHorizontal: 12,
      overflow: 'hidden',
    },
    progressBarFill: {
      height: '100%',
      backgroundColor: colors.primary,
      borderRadius: 3,
    },
    genericContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
    },
    genericText: {
      color: colors.text,
      fontSize: 16,
      marginTop: 24,
      textAlign: 'center',
      fontFamily: theme.typography?.fontFamily,
    },
    genericSubText: {
      color: colors.textSecondary,
      fontSize: 14,
      marginTop: 8,
      textAlign: 'center',
      fontFamily: theme.typography?.fontFamily,
    },
    openFileButton: {
      marginTop: 24,
      backgroundColor: colors.primary,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: theme.button?.borderRadius || 12,
    },
    openFileButtonText: {
      color: colors.textOnPrimary || '#FFFFFF',
      fontWeight: 'bold',
      fontSize: 16,
      fontFamily: theme.typography?.fontFamily,
    },
    footer: {
      padding: 16,
      backgroundColor: colors.background,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      backgroundColor: colors.inputBackground || colors.surface,
      borderRadius: 24,
      paddingHorizontal: 8,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    input: {
      flex: 1,
      color: colors.text,
      fontFamily: theme.typography?.fontFamily,
      fontSize: 15,
      minHeight: 36,
      maxHeight: 120,
      paddingHorizontal: 12,
      paddingTop: 8,
      paddingBottom: 8,
    },
    sendButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: 8,
    },
  });
};
