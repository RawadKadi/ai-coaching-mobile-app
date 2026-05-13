import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Linking, Modal, SafeAreaView, Animated, PanResponder, Dimensions, Pressable
} from 'react-native';
import { Image } from 'expo-image';
import Slider from '@react-native-community/slider';
import { Video, ResizeMode, AVPlaybackStatus, VideoFullscreenUpdate } from 'expo-av';
import { Platform } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import * as FileSystem from 'expo-file-system/legacy';
import { useTheme } from '@/contexts/BrandContext';
import { FileText, FileAudio, Play, Download, RefreshCw, Check, CheckCheck, ChevronLeft, Pause, X, Trophy, Zap, Target, Loader2, Clock, Video as LucideVideo } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useRouter } from 'expo-router';
import { ChatReplyContext } from './ChatReplyContext';
import { mediaDownloadManager } from '@/lib/MediaDownloadManager';
import MealMessageCard from './MealMessageCard';
import DocumentPreviewModal from './DocumentPreviewModal';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

type MediaContent = {
  type: 'image' | 'video' | 'document' | 'gif' | 'challenge_completed' | 'task_completion' | 'meal' | 'meal_log' | 'session_invite' | 'call_invite';
  url?: string;
  previewUrl?: string;
  thumbnailUrl?: string;
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
  imageUrl?: string; // For task completions with photo verification
};

// ── Media Caching Hook ──────────────────────────────────────────────────────
const useMediaCache = (url?: string, type?: string) => {
    const [localUri, setLocalUri] = useState<string | null>(null);
    const [isCaching, setIsCaching] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState(0);

    useEffect(() => {
        if (!url) return;

        // GIFs: expo-image handles animation natively. Bypass download pipeline.
        if (type === 'gif') { setLocalUri(url); return; }

        // Videos: stream directly from CDN — large files, no local caching needed.
        // Caching videos was causing corrupt local files and black-screen playback.
        if (type === 'video') { setLocalUri(url); return; }

        // Non-http: local file (own upload in progress)
        if (!url.startsWith('http')) { setLocalUri(url); return; }

        // Images: download and cache permanently for instant re-load
        mediaDownloadManager.getOrDownload(url).then(uri => {
            if (uri) {
                setLocalUri(uri);
                setIsCaching(false);
                setDownloadProgress(100);
            }
        });

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
                setLocalUri(url); // Fallback to remote on error
            }
        });

        return unsubscribe;
    }, [url, type]);

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
  onLongPress?: () => void; // Forwarded from parent chat for reaction menu
  isPressed?: boolean;
  onCancelSession?: (sessionId: string) => void;
  onRescheduleSession?: (sessionId: string) => void;
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
  
  const panY = useRef(new Animated.Value(0)).current;
  const panResponder = useRef(
    PanResponder.create({
      // Only intercept CONFIRMED downward swipes — never steal taps from native controls
      onMoveShouldSetPanResponder: (_, gs) =>
        gs.dy > 15 && Math.abs(gs.dy) > Math.abs(gs.dx * 2),
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

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#000000', transform: [{ translateY: panY }] }]} {...panResponder.panHandlers}>
      <SafeAreaView style={{ flex: 1 }}>
        <TouchableOpacity onPress={onClose} style={{ position: 'absolute', top: 50, right: 20, zIndex: 20 }}>
          <X size={32} color="#FFFFFF" />
        </TouchableOpacity>
        {/* No spinner overlay — native AVPlayer shows its own buffering indicator.
            A React overlay with absoluteFill blocks touch events to native controls. */}
        <Video
          ref={videoRef}
          source={{ uri }}
          style={{ width: '100%', height: '100%' }}
          resizeMode={ResizeMode.CONTAIN}
          useNativeControls
          shouldPlay
          onPlaybackStatusUpdate={setStatus}
          onError={(e) => console.warn('[FullscreenVideo] Error:', e)}
        />
      </SafeAreaView>
    </Animated.View>
  );
}

// ── Fullscreen Image Modal ──────────────────────────────────────────────────
function FullscreenImageModal({ uri, type, onClose }: { uri: string, type: 'image' | 'gif' | 'task_completion', onClose: () => void }) {
  const panY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) => gs.dy > 10 && Math.abs(gs.dy) > Math.abs(gs.dx * 2),
      onPanResponderMove: (_, state) => {
        if (state.dy > 0) panY.setValue(state.dy);
      },
      onPanResponderRelease: (_, state) => {
        if (state.dy > 100 || state.vy > 1) {
          Animated.timing(panY, { toValue: SCREEN_HEIGHT, duration: 200, useNativeDriver: true }).start(onClose);
        } else {
          Animated.spring(panY, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
        }
      }
    })
  ).current;

  const handlePress = () => {
    Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(onClose);
  };

  return (
    <Animated.View 
      style={[StyleSheet.absoluteFill, { backgroundColor: '#000000', opacity, transform: [{ translateY: panY }] }]} 
      {...panResponder.panHandlers}
    >
      <SafeAreaView style={{ flex: 1 }}>
        <TouchableOpacity 
          onPress={onClose} 
          style={{ position: 'absolute', top: 50, right: 20, zIndex: 100, width: 44, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 22 }}
        >
          <X size={28} color="#FFFFFF" />
        </TouchableOpacity>
        
        <TouchableOpacity 
          activeOpacity={1} 
          onPress={handlePress}
          style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
        >
          <Image
            source={{ uri }}
            style={{ width: '100%', height: '100%' }}
            contentFit="contain"
            cachePolicy={uri.startsWith('file:') ? 'none' : 'memory-disk'}
          />
        </TouchableOpacity>
      </SafeAreaView>
    </Animated.View>
  );
}

// ── Custom Video Player (Inline) ─────────────────────────────────────────────
function CustomVideoPlayer({ 
  uri: remoteUri, thumbnailUrl, isUploading, progress, onCancel 
}: { 
  uri: string, thumbnailUrl?: string, isUploading?: boolean, progress?: number, onCancel?: () => void 
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  // Freeze the URI at the moment the user taps — prevents black screen caused by
  // localUri updating mid-playback (background download finishing while modal is open).
  const [frozenUri, setFrozenUri] = useState<string>('');

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

  // Use localUri for instant local playback once cached.
  // Fall back to remoteUri for immediate streaming while download runs.
  const activeUri = localUri || remoteUri;
  const isReceiving = isCaching && !localUri && downloadProgress > 0 && !isUploading;
  const durationMillis = inlineStatus?.isLoaded ? inlineStatus.durationMillis || 0 : 0;

  useEffect(() => {
    // Only hide the play button when the video is ACTIVELY PLAYING.
    // When null/loading/paused/error — always show the play button.
    if (inlineStatus?.isLoaded && inlineStatus.isPlaying) {
        Animated.spring(playAnim, { toValue: 0, useNativeDriver: true }).start();
    } else {
        Animated.spring(playAnim, { toValue: 1, useNativeDriver: true }).start();
    }
  }, [inlineStatus]);

  const openFullscreen = async () => {
    if (isUploading) return;

    // On native: use presentFullscreenPlayerAsync() — this hands the
    // ALREADY-BUFFERED inline video directly to the native fullscreen player.
    // No new HTTP request, no re-buffering, instant playback.
    if (Platform.OS !== 'web' && inlineVideoRef.current) {
      try {
        // Unmute and start playback before entering fullscreen
        await inlineVideoRef.current.setIsMutedAsync(false);
        await inlineVideoRef.current.playAsync();
        await inlineVideoRef.current.presentFullscreenPlayer();
        return;
      } catch (e) {
        console.warn('[VideoPlayer] presentFullscreenPlayerAsync failed, falling back to modal:', e);
      }
    }

    // Web fallback: modal with new Video component
    const uriToPlay = localUri || remoteUri;
    if (!uriToPlay) return;
    setFrozenUri(uriToPlay);
    setIsExpanded(true);
  };

  const closeFullscreen = () => {
    setIsExpanded(false);
    setFrozenUri('');
  };

  return (
    <View style={{ width: '100%', height: 180, borderRadius: 16, overflow: 'hidden', backgroundColor: '#0F172A' }}>
      <View style={StyleSheet.absoluteFill}>
        {/* Inline video — always mounted so it pre-buffers and can hand off to presentFullscreenPlayerAsync instantly */}
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
            onFullscreenUpdate={async ({ fullscreenUpdate }) => {
              if (fullscreenUpdate === VideoFullscreenUpdate.PLAYER_DID_DISMISS) {
                // Reset inline player to silent/paused state after native fullscreen closes
                try {
                  await inlineVideoRef.current?.setIsMutedAsync(true);
                  await inlineVideoRef.current?.pauseAsync();
                  await inlineVideoRef.current?.setPositionAsync(0);
                } catch {}
              }
            }}
          />
        )}

        {/* Thumbnail overlay while uploading or if video not playing yet */}
        {(isUploading || !inlineStatus?.isLoaded || !inlineStatus.isPlaying) && (
          thumbnailUrl ? (
            <Image
              source={{ uri: thumbnailUrl }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
            />
          ) : !isUploading && activeUri ? (
            // Fallback for missing thumbnail: Use the video itself to show first frame
            <Video
              source={{ uri: activeUri }}
              style={StyleSheet.absoluteFill}
              resizeMode={ResizeMode.COVER}
              shouldPlay={false}
              isMuted={true}
            />
          ) : (
            // Uploading placeholder
            <View style={[StyleSheet.absoluteFill, { backgroundColor: '#1E293B' }]} />
          )
        )}
        
        <TouchableOpacity 
          activeOpacity={0.9} 
          onPress={openFullscreen} 
          style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', backgroundColor: (isReceiving || isUploading) ? 'rgba(0,0,0,0.4)' : 'transparent' }]}
        >
          {isReceiving && !isUploading && (
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

          {!isUploading && !isReceiving && (
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

        {durationMillis > 0 && !isUploading && !isReceiving && (
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
        {/* Only render if frozenUri is set — prevents empty Video mount */}
        {frozenUri ? (
          <FullscreenVideoModal uri={frozenUri} onClose={closeFullscreen} />
        ) : null}
      </Modal>
    </View>
  );
}

// ── Custom Image Player (Inline) ─────────────────────────────────────────────
function CustomImagePlayer({
  uri, previewUrl, type, isOwn, isUploading, progress, onCancel, onLongPress
}: {
  uri: string, previewUrl?: string, type: 'image' | 'gif', isOwn: boolean,
  isUploading?: boolean, progress?: number, onCancel?: () => void, onLongPress?: () => void
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { localUri } = useMediaCache(uri, type);
  const cachedUri = localUri || uri;

  return (
    <>
      <TouchableOpacity 
        activeOpacity={0.9} 
        onPress={() => !isUploading && setIsExpanded(true)} 
        onLongPress={onLongPress}
        delayLongPress={400}
        style={StyleSheet.absoluteFill}
      >
        <Image
          source={{ uri: cachedUri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          // GIFs: disable disk cache to prevent stale/wrong GIF from showing.
          // Images: if it's a local file:// uri, caching to disk again breaks expo-image on iOS.
          cachePolicy={type === 'gif' || cachedUri.startsWith('file:') ? 'none' : 'memory-disk'}
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
function ChallengeCompletedCard({ media, onPressImage }: { media: MediaContent, onPressImage?: () => void }) {
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
      {media.imageUrl && (
        <TouchableOpacity 
          activeOpacity={0.9} 
          onPress={onPressImage}
          style={styles.cardImageContainer}
        >
          <Image 
            source={{ uri: media.imageUrl }} 
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
        </TouchableOpacity>
      )}
      <View style={{ padding: 16 }}>
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
        <View style={styles.challengeFooter}><Text style={styles.challengeFooterText}>Completed at {media.completedAt || new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}</Text></View>
      </View>
    </View>
  );
}

function TaskCompletedCard({ media, onPressImage }: { media: MediaContent, onPressImage?: () => void }) {
  const theme = useTheme();
  return (
    <View style={[styles.challengeCard, { backgroundColor: '#0F172A', borderColor: 'rgba(59, 130, 246, 0.2)' }]}>
      {media.imageUrl && (
        <TouchableOpacity 
          activeOpacity={0.9} 
          onPress={onPressImage}
          style={styles.cardImageContainer}
        >
          <Image 
            source={{ uri: media.imageUrl }} 
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
        </TouchableOpacity>
      )}
      <View style={{ padding: 16 }}>
        <View style={styles.challengeHeader}>
          <View style={[styles.challengeIconBox, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}><Check size={18} color="#3B82F6" /></View>
          <Text style={[styles.challengeTitle, { color: '#3B82F6', fontFamily: theme.typography.fontFamily }]}>Task Completed</Text>
        </View>
        <View style={styles.challengeBody}>
          <Text style={[styles.challengeTaskName, { fontFamily: theme.typography.fontFamily }]} numberOfLines={2}>{media.taskName || 'Protocol Task'}</Text>
        </View>
        <View style={styles.challengeFooter}><Text style={styles.challengeFooterText}>Completed at {media.timestamp ? new Date(media.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }) : new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}</Text></View>
      </View>
    </View>
  );
}

function SessionInviteCard({ media, isOwn, onCancel, onReschedule }: { media: any, isOwn: boolean, onCancel?: (id: string) => void, onReschedule?: (id: string) => void }) {
  const theme = useTheme();
  const router = useRouter();
  
  const isCancelled = media.status === 'cancelled';
  const isRescheduled = media.status === 'rescheduled';
  
  const handleJoin = () => {
    if (media.link) {
      Linking.openURL(media.link);
    }
  };

  if (isCancelled || isRescheduled) {
    const title = isCancelled ? 'Session Cancelled' : 'Session Rescheduled';
    const accentColor = isCancelled ? '#EF4444' : '#3B82F6';
    const icon = isCancelled ? <X size={18} color={accentColor} /> : <RefreshCw size={18} color={accentColor} />;
    
    return (
      <View style={[styles.challengeCard, { backgroundColor: '#0F172A', borderColor: `${accentColor}33`, minWidth: 260 }]}>
        <View style={{ padding: 16 }}>
          <View style={styles.challengeHeader}>
            <View style={[styles.challengeIconBox, { backgroundColor: `${accentColor}26` }]}>{icon}</View>
            <Text style={[styles.challengeTitle, { color: accentColor, fontFamily: theme.typography.fontFamily }]}>{title}</Text>
          </View>
          <View style={styles.challengeBody}>
            <Text style={[styles.challengeTaskName, { fontFamily: theme.typography.fontFamily, color: '#94A3B8' }]}>
              {isCancelled 
                ? (isOwn ? 'You cancelled this session' : 'Coach cancelled this session')
                : (isOwn ? 'You rescheduled this session' : 'Coach rescheduled this session')
              }
            </Text>
            {isCancelled && media.cancellation_reason && (
              <View style={{ marginTop: 8, backgroundColor: 'rgba(239, 68, 68, 0.05)', padding: 10, borderRadius: 8 }}>
                <Text style={{ color: '#F8FAFC', fontSize: 12, fontStyle: 'italic' }}>"{media.cancellation_reason}"</Text>
              </View>
            )}
            {isRescheduled && (
              <TouchableOpacity 
                onPress={() => router.push('/(client)/(tabs)/calendar')}
                style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 6 }}
              >
                <Text style={{ color: '#3B82F6', fontSize: 13, fontWeight: '700' }}>View New Schedule</Text>
                <ChevronLeft size={14} color="#3B82F6" style={{ transform: [{ rotate: '180deg' }] }} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.challengeCard, { backgroundColor: '#0F172A', borderColor: 'rgba(16, 185, 129, 0.2)', minWidth: 260 }]}>
      <View style={{ padding: 16 }}>
        <View style={styles.challengeHeader}>
          <View style={[styles.challengeIconBox, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}><LucideVideo size={18} color="#10B981" /></View>
          <Text style={[styles.challengeTitle, { color: '#10B981', fontFamily: theme.typography.fontFamily }]}>Session Invitation</Text>
        </View>
        <View style={styles.challengeBody}>
          <Text style={[styles.challengeTaskName, { fontFamily: theme.typography.fontFamily }]} numberOfLines={2}>{media.description || 'Live Coaching Session'}</Text>
          <View style={styles.challengeDetailsRow}>
             <View style={styles.challengeDetailItem}>
                <Clock size={12} color="#94A3B8" />
                <Text style={styles.challengeDetailText}>
                  {media.timestamp ? new Date(media.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }) : 'Now'}
                </Text>
             </View>
          </View>
        </View>
        
        <TouchableOpacity 
          onPress={handleJoin}
          style={{ 
            backgroundColor: '#10B981', 
            borderRadius: 12, 
            paddingVertical: 10, 
            alignItems: 'center', 
            marginTop: 12 
          }}
        >
          <Text style={{ color: '#0F172A', fontWeight: '900', fontSize: 14 }}>Join Session</Text>
        </TouchableOpacity>

        {isOwn && (
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <TouchableOpacity 
              onPress={() => onReschedule?.(media.sessionId)}
              style={{ 
                flex: 1,
                backgroundColor: 'rgba(255, 255, 255, 0.05)', 
                borderRadius: 12, 
                paddingVertical: 10, 
                alignItems: 'center',
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.1)'
              }}
            >
              <Text style={{ color: '#F8FAFC', fontWeight: '700', fontSize: 13 }}>Reschedule</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => onCancel?.(media.sessionId)}
              style={{ 
                flex: 1,
                backgroundColor: 'rgba(239, 68, 68, 0.1)', 
                borderRadius: 12, 
                paddingVertical: 10, 
                alignItems: 'center',
                borderWidth: 1,
                borderColor: 'rgba(239, 68, 68, 0.2)'
              }}
            >
              <Text style={{ color: '#EF4444', fontWeight: '700', fontSize: 13 }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

// ── Main ChatMediaMessage Component ──────────────────────────────────────────
const ChatMediaMessage: React.FC<Props> = ({ 
  content, isOwn, createdAt, isRead, isUploading, progress = 0, onCancel, replyTo, onPressReply, isHighlighted, onLongPress,
  onCancelSession, onRescheduleSession
}) => {
  const theme = useTheme();
  const highlightAnim = useRef(new Animated.Value(0)).current;
  const [isTaskExpanded, setIsTaskExpanded] = useState(false);
  const [isChallengeExpanded, setIsChallengeExpanded] = useState(false);
  const [isLocalPressed, setIsLocalPressed] = useState(false);
  const [documentModalVisible, setDocumentModalVisible] = useState(false);
  const [documentModalUrl, setDocumentModalUrl] = useState<string | null>(null);
  const [documentModalName, setDocumentModalName] = useState<string | null>(null);

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
  let isEdited = false;
  try { 
    media = JSON.parse(content); 
    isEdited = !!media?.is_edited;
  } catch { return null; }
  if (!media) return null;

  let messageBody = null;

  if ((media.type === 'image' || media.type === 'gif') && media.url) {
    messageBody = (
      <View style={[styles.bubble, isOwn ? styles.myBubble : styles.theirBubble, { width: 220, height: replyTo ? 240 : 200, padding: 0, overflow: 'hidden', backgroundColor: theme.colors.surfaceAlt }]}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: highlightOverlayColor, zIndex: 10 }]} pointerEvents="none" />
        {replyTo && <View style={{ padding: 4, backgroundColor: theme.colors.surface }}><ChatReplyContext message={replyTo} onPress={() => replyTo.id && onPressReply?.(replyTo.id)} isMe={isOwn} /></View>}
        <CustomImagePlayer uri={media.url} previewUrl={media.previewUrl} type={media.type as 'image' | 'gif'} isOwn={isOwn} isUploading={isUploading} progress={progress} onCancel={onCancel} onLongPress={onLongPress} />
        {createdAt && (
          <View style={styles.timeBadgeContainer}>
            {isEdited && <Text style={[styles.timeBadgeText, { opacity: 0.6, fontStyle: 'italic', marginRight: 4 }]}>Edited</Text>}
            <Text style={styles.timeBadgeText}>{new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
            {isOwn && (isRead ? <CheckCheck size={12} color="#FFFFFF" style={{ marginLeft: 4 }} /> : <Check size={12} color="#FFFFFF" style={{ marginLeft: 4 }} />)}
          </View>
        )}
      </View>
    );
  } else if (media.type === 'video' && media.url) {
    messageBody = (
      <TouchableOpacity
        activeOpacity={1}
        onLongPress={onLongPress}
        delayLongPress={400}
        style={[styles.bubble, isOwn ? styles.myBubble : styles.theirBubble, { width: 250, height: replyTo ? 290 : 250, padding: 0, overflow: 'hidden', backgroundColor: '#000000' }]}
      >
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: highlightOverlayColor, zIndex: 10 }]} pointerEvents="none" />
        {replyTo && <View style={{ padding: 4, backgroundColor: theme.colors.surface }}><ChatReplyContext message={replyTo} onPress={() => replyTo.id && onPressReply?.(replyTo.id)} isMe={isOwn} /></View>}
        <CustomVideoPlayer 
          uri={media.url} 
          thumbnailUrl={media.thumbnailUrl}
          isUploading={isUploading} 
          progress={progress} 
          onCancel={onCancel} 
        />
        {createdAt && (
          <View style={[styles.timeBadgeContainer, { bottom: 8, right: 8 }]}>
            {isEdited && <Text style={[styles.timeBadgeText, { opacity: 0.6, fontStyle: 'italic', marginRight: 4 }]}>Edited</Text>}
            <Text style={styles.timeBadgeText}>{new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
            {isOwn && (isRead ? <CheckCheck size={12} color="#FFFFFF" style={{ marginLeft: 4 }} /> : <Check size={12} color="#FFFFFF" style={{ marginLeft: 4 }} />)}
          </View>
        )}
      </TouchableOpacity>
    );
  } else if (media.type === 'document') {
    const isAudio = media.url?.toLowerCase().split('?')[0].endsWith('.mp3') || media.url?.toLowerCase().split('?')[0].endsWith('.wav') || media.url?.toLowerCase().split('?')[0].endsWith('.m4a') || 
                    media.fileName?.toLowerCase().endsWith('.mp3') || media.fileName?.toLowerCase().endsWith('.wav') || media.fileName?.toLowerCase().endsWith('.m4a');
    
    messageBody = (
      <>
        <TouchableOpacity 
          activeOpacity={0.85}
          style={[
            styles.bubble, 
            isOwn ? styles.myBubble : styles.theirBubble, 
            { 
              backgroundColor: isOwn ? theme.colors.primary : '#1E293B', 
              borderColor: isOwn ? 'transparent' : 'rgba(255,255,255,0.08)', 
              borderWidth: isOwn ? 0 : 1,
              minWidth: 260, 
              maxWidth: '85%',
              padding: 12,
              borderRadius: 20,
              // Shadow for depth
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.2,
              shadowRadius: 8,
              elevation: 4,
            }
          ]} 
          onPress={() => {
            if (!isUploading && media?.url) {
              setDocumentModalUrl(media.url);
              setDocumentModalName(media.fileName || 'Document');
              setDocumentModalVisible(true);
            }
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ 
              width: 52, 
              height: 52, 
              borderRadius: 14, 
              backgroundColor: isOwn ? 'rgba(255,255,255,0.15)' : 'rgba(59, 130, 246, 0.15)', 
              justifyContent: 'center', 
              alignItems: 'center' 
            }}>
              {isAudio ? <FileAudio size={26} color={isOwn ? '#FFFFFF' : '#60A5FA'} /> : <FileText size={26} color={isOwn ? '#FFFFFF' : '#60A5FA'} />}
            </View>
            
            <View style={{ flex: 1, marginLeft: 14, justifyContent: 'center' }}>
              <Text 
                style={{ 
                  color: '#FFFFFF', 
                  fontSize: 15, 
                  fontWeight: '700',
                  letterSpacing: -0.3
                }} 
                numberOfLines={1} 
                ellipsizeMode="tail"
              >
                {media.fileName || (isUploading ? 'Uploading…' : 'Document')}
              </Text>
              <Text 
                style={{ 
                  color: isOwn ? 'rgba(255,255,255,0.6)' : '#94A3B8', 
                  fontSize: 12, 
                  marginTop: 3,
                  fontWeight: '500'
                }}
              >
                {isUploading ? `Uploading… ${progress}%` : isAudio ? 'Voice Message' : 'Document'}
              </Text>
            </View>
          </View>
          
          <View style={{ 
            flexDirection: 'row', 
            alignItems: 'center', 
            justifyContent: 'flex-end', 
            marginTop: 8,
            paddingRight: 2 
          }}>
            {isEdited && (
              <Text style={{ 
                fontSize: 10, 
                color: isOwn ? 'rgba(255,255,255,0.5)' : 'rgba(148, 163, 184, 0.5)', 
                fontStyle: 'italic', 
                marginRight: 6 
              }}>Edited</Text>
            )}
            <Text style={{ 
              fontSize: 10, 
              color: isOwn ? 'rgba(255,255,255,0.7)' : '#64748B', 
              fontWeight: '700' 
            }}>
              {new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            {isOwn && (
              isRead 
                ? <CheckCheck size={13} color="#10B981" style={{ marginLeft: 4 }} /> 
                : <Check size={13} color="rgba(255,255,255,0.6)" style={{ marginLeft: 4 }} />
            )}
          </View>
        </TouchableOpacity>

        <DocumentPreviewModal 
          visible={documentModalVisible} 
          uri={documentModalUrl}
          type={isAudio ? 'audio' : 'document'}
          fileName={documentModalName} 
          onClose={() => setDocumentModalVisible(false)} 
        />
      </>
    );
  } else if (media.type === 'task_completion') {
    messageBody = (
      <>
        <TouchableOpacity 
          activeOpacity={0.9} 
          delayLongPress={400} 
          onLongPress={onLongPress} 
          style={[styles.bubble, isOwn ? styles.myBubble : styles.theirBubble, { backgroundColor: 'transparent', borderWidth: 0, padding: 0, maxWidth: '100%', overflow: 'visible' }]}
        >
          <TaskCompletedCard media={media} onPressImage={() => media.imageUrl && setIsTaskExpanded(true)} />
        </TouchableOpacity>

        {media.imageUrl && (
          <Modal visible={isTaskExpanded} transparent animationType="fade" statusBarTranslucent>
            <FullscreenImageModal 
              uri={media.imageUrl} 
              type="task_completion" 
              onClose={() => setIsTaskExpanded(false)} 
            />
          </Modal>
        )}
      </>
    );
  } else if (media.type === 'session_invite' || media.type === 'call_invite') {
    messageBody = (
      <View style={[styles.bubble, isOwn ? styles.myBubble : styles.theirBubble, { backgroundColor: 'transparent', borderWidth: 0, padding: 0, maxWidth: '100%', overflow: 'visible' }]}>
        <SessionInviteCard 
          media={media} 
          isOwn={isOwn} 
          onCancel={onCancelSession}
          onReschedule={onRescheduleSession}
        />
        {createdAt && (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4, paddingRight: 4 }}>
            <Text style={{ fontSize: 10, color: '#64748B', fontWeight: '700' }}>
              {new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            {isOwn && (isRead ? <CheckCheck size={12} color="#34D399" style={{ marginLeft: 4 }} /> : <Check size={12} color="#94A3B8" style={{ marginLeft: 4 }} />)}
          </View>
        )}
      </View>
    );
  } else if (media.type === 'challenge_completed') {
    messageBody = (
      <>
        <TouchableOpacity 
          activeOpacity={0.9} 
          delayLongPress={400} 
          onLongPress={onLongPress} 
          style={[styles.bubble, isOwn ? styles.myBubble : styles.theirBubble, { backgroundColor: 'transparent', borderWidth: 0, padding: 0, maxWidth: '100%', overflow: 'visible' }]}
        >
          <ChallengeCompletedCard media={media} onPressImage={() => media.imageUrl && setIsChallengeExpanded(true)} />
        </TouchableOpacity>

        {media.imageUrl && (
          <Modal visible={isChallengeExpanded} transparent animationType="fade" statusBarTranslucent>
            <FullscreenImageModal 
              uri={media.imageUrl} 
              type="task_completion" 
              onClose={() => setIsChallengeExpanded(false)} 
            />
          </Modal>
        )}
      </>
    );
  } else if (media.type === 'meal' || media.type === 'meal_log') {
    messageBody = <MealMessageCard content={content} isOwn={isOwn} onLongPress={onLongPress} />;
  } else {
    messageBody = (
      <View style={[styles.bubble, isOwn ? styles.myBubble : styles.theirBubble, { backgroundColor: theme.colors.surface, padding: 12, borderWidth: 1, borderColor: theme.colors.border }]}>
        <Text style={{ color: theme.colors.textSecondary, fontSize: 13, fontStyle: 'italic' }}>
          [Media: {media.type || 'Unknown'}]
        </Text>
        {media.url && <Text style={{ color: theme.colors.primary, fontSize: 11, marginTop: 4 }} numberOfLines={1}>{media.url}</Text>}
      </View>
    );
  }

  return (
    <Pressable
      delayLongPress={100}
      unstable_pressDelay={0}
      onPressIn={() => setIsLocalPressed(true)}
      onPressOut={() => setIsLocalPressed(false)}
      onLongPress={onLongPress}
    >
      <MotiView 
        animate={{ scale: isLocalPressed ? 0.9 : 1 }}
        transition={{ type: 'timing', duration: 100 }}
      >
        {messageBody}
      </MotiView>
    </Pressable>
  );
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
  challengeCard: { width: 260, borderRadius: 24, borderWidth: 1, overflow: 'hidden', backgroundColor: '#0F172A', shadowColor: '#10B981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 4 },
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
  cardImageContainer: { width: '100%', height: 180, overflow: 'hidden', backgroundColor: '#1E293B' },
});

export default ChatMediaMessage;
