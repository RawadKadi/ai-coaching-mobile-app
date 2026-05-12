import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, SafeAreaView } from 'react-native';
import { X, Send, FileText, FileAudio, Play, Pause, FileSpreadsheet, File } from 'lucide-react-native';
import { Image } from 'expo-image';
import { Video, ResizeMode, Audio } from 'expo-av';
import { WebView } from 'react-native-webview';

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
          <FileAudio size={80} color="#94A3B8" style={{ marginBottom: 32 }} />
          <TouchableOpacity style={styles.playButton} onPress={togglePlayPause}>
            {isPlaying ? <Pause size={32} color="#FFFFFF" fill="#FFFFFF" /> : <Play size={32} color="#FFFFFF" fill="#FFFFFF" style={{ marginLeft: 4 }} />}
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

    if (isPdf && Platform.OS === 'ios') {
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
        {isExcel ? <FileSpreadsheet size={80} color="#34D399" /> : <FileText size={80} color="#3B82F6" />}
        <Text style={styles.genericText}>Preview not available for this file type</Text>
        <Text style={styles.genericSubText}>{fileName}</Text>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={24} color="#FFFFFF" />
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
                  placeholderTextColor="#94A3B8"
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
                  {isSending ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Send size={20} color="#FFFFFF" fill="#FFFFFF" />}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  contentArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'stretch',
    backgroundColor: '#0F172A',
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
    backgroundColor: '#FFFFFF',
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
    backgroundColor: '#3B82F6',
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
    color: '#94A3B8',
    fontSize: 12,
    fontVariant: ['tabular-nums'],
    width: 40,
    textAlign: 'center',
  },
  progressBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 3,
    marginHorizontal: 12,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#3B82F6',
    borderRadius: 3,
  },
  genericContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  genericText: {
    color: '#94A3B8',
    fontSize: 16,
    marginTop: 24,
    textAlign: 'center',
  },
  genericSubText: {
    color: '#64748B',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  footer: {
    padding: 16,
    backgroundColor: '#020617',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#0F172A',
    borderRadius: 24,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  input: {
    flex: 1,
    color: '#FFFFFF',
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
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
});
