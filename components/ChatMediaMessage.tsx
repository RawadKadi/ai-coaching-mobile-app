import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Linking, Modal, SafeAreaView, Animated, PanResponder, Dimensions
} from 'react-native';
import { Image } from 'expo-image';
import Slider from '@react-native-community/slider';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import Svg, { Circle } from 'react-native-svg';
import * as FileSystem from 'expo-file-system/legacy';
import { useTheme } from '@/contexts/BrandContext';
import { FileText, Play, Download, RefreshCw, Check, CheckCheck, ChevronLeft, Pause, X, Trophy, Zap, Target, Loader2 } from 'lucide-react-native';
import { ChatReplyContext } from './ChatReplyContext';
import { mediaDownloadManager } from '@/lib/MediaDownloadManager';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

type MediaContent = {
  type: 'image' | 'video' | 'document' | 'gif' | 'challenge_completed' | 'task_completion';
  url?: string;
  previewUrl?: string;
  fileName?: string;
  mimeType?: string;
  // Challenge fields
  title?: string;
  taskName?: string;
  taskDescription?: string;
  completedAt?: string;
  focusType?: string;
  intensity?: string;
  // Protocol Task fields
  isCompletion?: boolean;
  clientName?: string;
  description?: string;
  timestamp?: string;
};

// ── Media Caching Hook ──────────────────────────────────────────────────────
const useMediaCache = (url?: string, type?: string) => {
    const [localUri, setLocalUri] = useState<string | null>(null);
    const [isCaching, setIsCaching] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState(0);

    useEffect(() => {
        if (!url) return;
        if (!url.startsWith('http')) {
            setLocalUri(url);
            return;
        }

        // 1. Initial check (sync if possible)
        mediaDownloadManager.getOrDownload(url).then(uri => {
            if (uri) {
                setLocalUri(uri);
                setIsCaching(false);
                setDownloadProgress(100);
            }
        });

        // 2. Subscribe to background updates
        const unsubscribe = mediaDownloadManager.subscribe(url, (state) => {
            if (state.status === 'finished' && state.localUri) {
                setLocalUri(state.localUri);
                setIsCaching(false);
                setDownloadProgress(100);
            } else if (state.status === 'downloading') {
                setIsCaching(true);
                setDownloadProgress(state.progress);
            } else if (state.status === 'error') {
                setIsCaching(false);
                setLocalUri(url); // Fallback to remote
            }
        });

        return unsubscribe;
    }, [url]);

    return { localUri, isCaching, downloadProgress };
};

interface Props {
  content: string; // JSON string
  isOwn: boolean;
  createdAt?: string;
  isRead?: boolean;
  isUploading?: boolean;
  progress?: number;
  onCancel?: () => void;
  replyTo?: any;
  onPressReply?: (id: string) => void;
  isHighlighted?: boolean;
}

// ── Circular download progress ring ──────────────────────────────────────────
const RADIUS = 28; // Large and clear
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function DownloadProgressRing({ pct }: { pct: number }) {
  const strokeDashoffset = CIRCUMFERENCE - (pct / 100) * CIRCUMFERENCE;
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={70} height={70}>
        {/* Track */}
        <Circle
          cx="35" cy="35" r={RADIUS}
          stroke="rgba(255,255,255,0.2)"
          strokeWidth={5}
          fill="rgba(0,0,0,0.3)"
        />
        {/* Progress arc */}
        <Circle
          cx="35" cy="35" r={RADIUS}
          stroke="#FFFFFF"
          strokeWidth={5}
          fill="none"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation="-90"
          origin="35,35"
        />
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '900' }}>
          {pct < 100 ? `${pct}%` : '✓'}
        </Text>
      </View>
    </View>
  );
}

// ── Shared formatting ────────────────────────────────────────────────────────
const formatDuration = (millis: number) => {
  const totalSeconds = Math.floor(millis / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

// ── Fullscreen Video Player Component ────────────────────────────────────────
function FullscreenVideoModal({ uri, onClose }: { uri: string, onClose: () => void }) {
  const videoRef = useRef<Video>(null);
  const [status, setStatus] = useState<AVPlaybackStatus | null>(null);
  const [speed, setSpeed] = useState<number>(1.0);
  
  const panY = useRef(new Animated.Value(0)).current;
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, state) => Math.abs(state.dy) > 10,
      onPanResponderMove: (_, state) => {
        if (state.dy > 0) panY.setValue(state.dy);
      },
      onPanResponderRelease: (_, state) => {
        if (state.dy > 150 || state.vy > 1.5) {
          Animated.timing(panY, { toValue: Dimensions.get('window').height, duration: 200, useNativeDriver: true }).start(onClose);
        } else {
          Animated.spring(panY, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
        }
      }
    })
  ).current;

  const togglePlayPause = async () => {
    if (!videoRef.current || !status?.isLoaded) return;
    status.isPlaying ? await videoRef.current.pauseAsync() : await videoRef.current.playAsync();
  };

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#000000', transform: [{ translateY: panY }] }]} {...panResponder.panHandlers}>
      <SafeAreaView style={{ flex: 1 }}>
        <TouchableOpacity onPress={onClose} style={{ position: 'absolute', top: 50, right: 20, zIndex: 10 }}>
          <X size={32} color="#FFFFFF" />
        </TouchableOpacity>
        <Video
          ref={videoRef}
          source={{ uri }}
          style={{ width: '100%', height: '100%' }}
          resizeMode={ResizeMode.CONTAIN}
          useNativeControls
          shouldPlay
          onPlaybackStatusUpdate={setStatus}
        />
      </SafeAreaView>
    </Animated.View>
  );
}

// ── Fullscreen Image Modal ──────────────────────────────────────────────────
function FullscreenImageModal({ uri, type, onClose }: { uri: string, type: 'image' | 'gif', onClose: () => void }) {
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000000' }]}>
      <SafeAreaView style={{ flex: 1 }}>
        <TouchableOpacity onPress={onClose} style={{ position: 'absolute', top: 50, right: 20, zIndex: 10 }}>
          <X size={32} color="#FFFFFF" />
        </TouchableOpacity>
        <Image
          source={{ uri }}
          style={{ width: '100%', height: '100%' }}
          contentFit="contain"
          cachePolicy="disk"
        />
      </SafeAreaView>
    </View>
  );
}

// ── Custom Video Player (Inline) ─────────────────────────────────────────────
function CustomVideoPlayer({ 
  uri: remoteUri, isUploading, progress, onCancel 
}: { 
  uri: string, isUploading?: boolean, progress?: number, onCancel?: () => void 
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { localUri, isCaching, downloadProgress } = useMediaCache(remoteUri, 'video');
  const [inlineStatus, setInlineStatus] = useState<AVPlaybackStatus | null>(null);
  const inlineVideoRef = useRef<Video>(null);
  const playAnim = useRef(new Animated.Value(1)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isCaching && downloadProgress === 0) {
      Animated.loop(
        Animated.timing(spinAnim, { toValue: 1, duration: 1000, useNativeDriver: true })
      ).start();
    } else {
      spinAnim.setValue(0);
    }
  }, [isCaching, downloadProgress]);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  const activeUri = localUri || remoteUri;
  const durationMillis = inlineStatus?.isLoaded ? inlineStatus.durationMillis || 0 : 0;

  useEffect(() => {
    if (inlineStatus?.isLoaded && !inlineStatus.isPlaying) {
        Animated.spring(playAnim, { toValue: 1, useNativeDriver: true }).start();
    } else {
        Animated.spring(playAnim, { toValue: 0, useNativeDriver: true }).start();
    }
  }, [inlineStatus]);

  return (
    <View style={{ width: '100%', height: 180, borderRadius: 16, overflow: 'hidden', backgroundColor: '#0F172A' }}>
      <View style={StyleSheet.absoluteFill}>
        {activeUri && (
          <Video
            ref={inlineVideoRef}
            source={{ uri: activeUri }}
            style={StyleSheet.absoluteFill}
            resizeMode={ResizeMode.COVER}
            useNativeControls={false}
            shouldPlay={false}
            isMuted={true}
            onPlaybackStatusUpdate={setInlineStatus}
          />
        )}
        
        <TouchableOpacity 
          activeOpacity={0.9} 
          onPress={() => !isUploading && !isCaching && setIsExpanded(true)} 
          style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', backgroundColor: (isCaching || isUploading) ? 'rgba(0,0,0,0.4)' : 'transparent' }]}
        >
          {isCaching && !isUploading && (
            <View style={{ alignItems: 'center' }}>
              {downloadProgress > 0 ? (
                <View style={{ alignItems: 'center' }}>
                  <DownloadProgressRing pct={downloadProgress} />
                  <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '800', marginTop: 8 }}>RECEIVING {downloadProgress}%</Text>
                </View>
              ) : (
                <Animated.View style={{ transform: [{ rotate: spin }] }}>
                  <RefreshCw size={24} color="#FFFFFF" />
                </Animated.View>
              )}
            </View>
          )}

          {!isUploading && !isCaching && (
             <Animated.View style={{ 
               width: 54, height: 54, borderRadius: 27, 
               backgroundColor: 'rgba(0,0,0,0.5)', 
               justifyContent: 'center', alignItems: 'center',
               transform: [{ scale: playAnim }],
               opacity: playAnim
             }}>
               <Play size={24} color="#FFFFFF" style={{ marginLeft: 3 }} fill="#FFFFFF" />
             </Animated.View>
          )}
        </TouchableOpacity>

        {durationMillis > 0 && !isUploading && !isCaching && (
          <View style={{ position: 'absolute', bottom: 8, left: 8, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 8 }}>
            <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '700' }}>{formatDuration(durationMillis)}</Text>
          </View>
        )}

        {isUploading && (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', zIndex: 10 }]}>
            <DownloadProgressRing pct={progress || 0} />
            <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '800', marginTop: 8 }}>SENDING {progress || 0}%</Text>
          </View>
        )}
      </View>

      <Modal visible={isExpanded} transparent animationType="fade" statusBarTranslucent>
        <FullscreenVideoModal uri={activeUri} onClose={() => setIsExpanded(false)} />
      </Modal>
    </View>
  );
}

// ── Custom Image Player (Inline) ─────────────────────────────────────────────
function CustomImagePlayer({
  uri, previewUrl, type, isOwn, isUploading, progress, onCancel
}: {
  uri: string, previewUrl?: string, type: 'image' | 'gif', isOwn: boolean,
  isUploading?: boolean, progress?: number, onCancel?: () => void
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const { localUri, isCaching, downloadProgress } = useMediaCache(uri, 'image');
  const cachedUri = localUri || uri;

  return (
    <>
      <TouchableOpacity activeOpacity={0.9} onPress={() => !isUploading && setIsExpanded(true)} style={StyleSheet.absoluteFill}>
        <Image
          source={{ uri: cachedUri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="disk"
          onLoadEnd={() => setImgLoaded(true)}
          onError={() => setImgError(true)}
        />

        {isUploading && (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }]}>
            <DownloadProgressRing pct={progress || 0} />
            {onCancel && (
              <TouchableOpacity onPress={onCancel} style={{ position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, padding: 4 }}>
                <X size={16} color="#FFFFFF" />
              </TouchableOpacity>
            )}
          </View>
        )}
      </TouchableOpacity>

      <Modal visible={isExpanded} transparent={true} animationType="fade" onRequestClose={() => setIsExpanded(false)}>
        <FullscreenImageModal uri={cachedUri} type={type} onClose={() => setIsExpanded(false)} />
      </Modal>
    </>
  );
}

// ── Challenge Card Components ────────────────────────────────────────────────
function ChallengeCompletedCard({ media }: { media: MediaContent }) {
  const theme = useTheme();
  const intensityColor = (intensity?: string) => {
    switch(intensity?.toLowerCase()) {
      case 'high': return '#EF4444';
      case 'medium': return '#F59E0B';
      case 'low': return '#10B981';
      default: return '#64748B';
    }
  };

  return (
    <View style={[styles.challengeCard, { backgroundColor: '#0F172A', borderColor: 'rgba(16, 185, 129, 0.2)' }]}>
      <View style={styles.challengeHeader}>
        <View style={styles.challengeIconBox}><Trophy size={18} color="#10B981" /></View>
        <Text style={[styles.challengeTitle, { fontFamily: theme.typography.fontFamily }]}>Protocol Achieved</Text>
      </View>
      <View style={styles.challengeBody}>
        <Text style={[styles.challengeTaskName, { fontFamily: theme.typography.fontFamily }]} numberOfLines={2}>{media.taskName || 'Daily Mission'}</Text>
        <View style={styles.challengeDetailsRow}>
           <View style={styles.challengeDetailItem}><Target size={12} color="#94A3B8" /><Text style={styles.challengeDetailText}>{media.focusType || 'Training'}</Text></View>
           <View style={[styles.challengeDetailItem, { marginLeft: 12 }]}><Zap size={12} color={intensityColor(media.intensity)} /><Text style={[styles.challengeDetailText, { color: intensityColor(media.intensity) }]}>{media.intensity || 'Normal'}</Text></View>
        </View>
      </View>
      <View style={styles.challengeFooter}><Text style={styles.challengeFooterText}>Completed at {media.completedAt || new Date().toLocaleTimeString()}</Text></View>
    </View>
  );
}

function TaskCompletedCard({ media }: { media: MediaContent }) {
  const theme = useTheme();
  return (
    <View style={[styles.challengeCard, { backgroundColor: '#0F172A', borderColor: 'rgba(59, 130, 246, 0.2)' }]}>
      <View style={styles.challengeHeader}>
        <View style={[styles.challengeIconBox, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}><Check size={18} color="#3B82F6" /></View>
        <Text style={[styles.challengeTitle, { color: '#3B82F6', fontFamily: theme.typography.fontFamily }]}>Task Completed</Text>
      </View>
      <View style={styles.challengeBody}>
        <Text style={[styles.challengeTaskName, { fontFamily: theme.typography.fontFamily }]} numberOfLines={2}>{media.taskName || 'Protocol Task'}</Text>
      </View>
      <View style={styles.challengeFooter}><Text style={styles.challengeFooterText}>Completed at {media.timestamp ? new Date(media.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString()}</Text></View>
    </View>
  );
}

// ── Main ChatMediaMessage Component ──────────────────────────────────────────
export default function ChatMediaMessage({ 
  content, isOwn, createdAt, isRead, isUploading, progress = 0, onCancel, replyTo, onPressReply, isHighlighted 
}: Props) {
  const theme = useTheme();
  const highlightAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isHighlighted) {
      Animated.sequence([
        Animated.timing(highlightAnim, { toValue: 1, duration: 300, useNativeDriver: false }),
        Animated.timing(highlightAnim, { toValue: 0, duration: 300, useNativeDriver: false }),
        Animated.timing(highlightAnim, { toValue: 1, duration: 300, useNativeDriver: false }),
        Animated.timing(highlightAnim, { toValue: 0, duration: 600, useNativeDriver: false }),
      ]).start();
    }
  }, [isHighlighted]);

  const highlightOverlayColor = highlightAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['transparent', isOwn ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.15)']
  });

  let media: MediaContent | null = null;
  try { media = JSON.parse(content); } catch { return null; }
  if (!media) return null;

  if ((media.type === 'image' || media.type === 'gif') && media.url) {
    return (
      <View style={[styles.bubble, isOwn ? styles.myBubble : styles.theirBubble, { width: 220, height: replyTo ? 240 : 200, padding: 0, overflow: 'hidden', backgroundColor: theme.colors.surfaceAlt }]}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: highlightOverlayColor, zIndex: 10 }]} pointerEvents="none" />
        {replyTo && <View style={{ padding: 4, backgroundColor: theme.colors.surface }}><ChatReplyContext message={replyTo} onPress={() => replyTo.id && onPressReply?.(replyTo.id)} isMe={isOwn} /></View>}
        <CustomImagePlayer uri={media.url} previewUrl={media.previewUrl} type={media.type as 'image' | 'gif'} isOwn={isOwn} isUploading={isUploading} progress={progress} onCancel={onCancel} />
        {createdAt && <View style={styles.timeBadgeContainer}><Text style={styles.timeBadgeText}>{new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>{isOwn && (isRead ? <CheckCheck size={12} color="#FFFFFF" style={{ marginLeft: 4 }} /> : <Check size={12} color="#FFFFFF" style={{ marginLeft: 4 }} />)}</View>}
      </View>
    );
  }

  if (media.type === 'video' && media.url) {
    return (
      <View style={[styles.bubble, isOwn ? styles.myBubble : styles.theirBubble, { width: 250, height: replyTo ? 290 : 250, padding: 0, overflow: 'hidden', backgroundColor: '#000000' }]}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: highlightOverlayColor, zIndex: 10 }]} pointerEvents="none" />
        {replyTo && <View style={{ padding: 4, backgroundColor: theme.colors.surface }}><ChatReplyContext message={replyTo} onPress={() => replyTo.id && onPressReply?.(replyTo.id)} isMe={isOwn} /></View>}
        <CustomVideoPlayer uri={media.url} isUploading={isUploading} progress={progress} onCancel={onCancel} />
        {createdAt && <View style={[styles.timeBadgeContainer, { bottom: 8, right: 8 }]}><Text style={styles.timeBadgeText}>{new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>{isOwn && (isRead ? <CheckCheck size={12} color="#FFFFFF" style={{ marginLeft: 4 }} /> : <Check size={12} color="#FFFFFF" style={{ marginLeft: 4 }} />)}</View>}
      </View>
    );
  }

  if (media.type === 'document') {
    return (
      <TouchableOpacity style={[styles.bubble, isOwn ? styles.myBubble : styles.theirBubble, { backgroundColor: isOwn ? theme.colors.primary : theme.colors.surface, borderColor: theme.colors.border }]} onPress={() => !isUploading && media?.url && Linking.openURL(media.url)}>
        <View style={styles.docContainer}>
          <FileText size={28} color={isOwn ? '#FFFFFF' : theme.colors.primary} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={[styles.docName, { color: isOwn ? '#FFFFFF' : theme.colors.text }]} numberOfLines={2}>{media.fileName || (isUploading ? 'Uploading…' : 'Document')}</Text>
            <Text style={[styles.docHint, { color: isOwn ? 'rgba(255,255,255,0.7)' : theme.colors.textSecondary }]}>{isUploading ? `Uploading… ${progress}%` : 'Tap to open'}</Text>
          </View>
          {!isUploading && <Download size={20} color={isOwn ? '#FFFFFF' : theme.colors.textSecondary} />}
        </View>
      </TouchableOpacity>
    );
  }
  
  if (media.type === 'task_completion') return <View style={[styles.bubble, isOwn ? styles.myBubble : styles.theirBubble, { backgroundColor: 'transparent', borderWidth: 0, padding: 0 }]}><TaskCompletedCard media={media} /></View>;
  if (media.type === 'challenge_completed') return <View style={[styles.bubble, isOwn ? styles.myBubble : styles.theirBubble, { backgroundColor: 'transparent', borderWidth: 0, padding: 0 }]}><ChallengeCompletedCard media={media} /></View>;

  return null;
}

const styles = StyleSheet.create({
  bubble: { maxWidth: '80%', borderRadius: 16, marginBottom: 4, overflow: 'hidden' },
  myBubble: { alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  theirBubble: { alignSelf: 'flex-start', borderBottomLeftRadius: 4, borderWidth: 1 },
  docContainer: { flexDirection: 'row', alignItems: 'center', padding: 12, minWidth: 200, maxWidth: 260 },
  docName: { fontSize: 14, fontWeight: '600' },
  docHint: { fontSize: 11, marginTop: 2 },
  timeBadgeContainer: { position: 'absolute', bottom: 6, right: 6, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 12 },
  timeBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '500' },
  challengeCard: { width: 260, borderRadius: 24, borderWidth: 1, overflow: 'hidden', padding: 16, shadowColor: '#10B981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 4 },
  challengeHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  challengeIconBox: { width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(16, 185, 129, 0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  challengeTitle: { color: '#10B981', fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5 },
  challengeBody: { marginBottom: 16 },
  challengeTaskName: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', lineHeight: 24, marginBottom: 8 },
  challengeDetailsRow: { flexDirection: 'row', alignItems: 'center' },
  challengeDetailItem: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.03)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  challengeDetailText: { color: '#94A3B8', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  challengeFooter: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', paddingTop: 12 },
  challengeFooterText: { color: '#475569', fontSize: 10, fontWeight: '600' },
});
