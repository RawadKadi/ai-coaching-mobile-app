import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Linking, Modal, SafeAreaView, Animated, PanResponder, Dimensions
} from 'react-native';
import { Image } from 'expo-image';
import Slider from '@react-native-community/slider';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '@/contexts/BrandContext';
import { FileText, Play, Download, RefreshCw, Check, CheckCheck, ChevronLeft, Pause, X, Trophy, Zap, Target } from 'lucide-react-native';
import { ChatReplyContext } from './ChatReplyContext';

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
const RADIUS = 22;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function DownloadProgressRing({ pct }: { pct: number }) {
  const strokeDashoffset = CIRCUMFERENCE - (pct / 100) * CIRCUMFERENCE;
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={58} height={58}>
        {/* Track */}
        <Circle
          cx="29" cy="29" r={RADIUS}
          stroke="rgba(255,255,255,0.25)"
          strokeWidth={4}
          fill="none"
        />
        {/* Progress arc */}
        <Circle
          cx="29" cy="29" r={RADIUS}
          stroke="#FFFFFF"
          strokeWidth={4}
          fill="none"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation="-90"
          origin="29,29"
        />
      </Svg>
      <Text style={{ position: 'absolute', color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>
        {pct < 100 ? `${pct}%` : '✓'}
      </Text>
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

// ── Custom Video Player ──────────────────────────────────────────────────────
function CustomVideoPlayer({ 
  uri, isUploading, progress, onCancel 
}: { 
  uri: string, isUploading?: boolean, progress?: number, onCancel?: () => void 
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Track inline video status just for the duration badge & thumbnail
  const inlineVideoRef = useRef<Video>(null);
  const [inlineStatus, setInlineStatus] = useState<AVPlaybackStatus | null>(null);

  const durationMillis = inlineStatus?.isLoaded ? inlineStatus.durationMillis || 0 : 0;

  return (
    <>
      {/* Inline Preview */}
      <View style={StyleSheet.absoluteFill}>
        {/* We keep a paused video instance just to generate the thumbnail and duration.
            A future optimization could use expo-video-thumbnails instead. */}
        <Video
          ref={inlineVideoRef}
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          resizeMode={ResizeMode.COVER}
          useNativeControls={false}
          isLooping={false}
          shouldPlay={false}
          onPlaybackStatusUpdate={setInlineStatus}
        />
        
        <TouchableOpacity 
          activeOpacity={0.9} 
          onPress={() => !isUploading && setIsExpanded(true)} 
          style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center' }]}
        >
          {!isUploading && (
            <View style={{
              width: 50, height: 50, borderRadius: 25, 
              backgroundColor: 'rgba(0,0,0,0.5)', 
              justifyContent: 'center', alignItems: 'center'
            }}>
              <Play size={24} color="#FFFFFF" style={{ marginLeft: 3 }} />
            </View>
          )}
        </TouchableOpacity>

        {/* Duration badge - Bottom Left */}
        {durationMillis > 0 && !isUploading && (
          <View style={{
            position: 'absolute',
            bottom: 6,
            left: 6,
            backgroundColor: 'rgba(0,0,0,0.5)',
            paddingHorizontal: 6,
            paddingVertical: 3,
            borderRadius: 12,
          }}>
            <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '500' }}>
              {formatDuration(durationMillis)}
            </Text>
          </View>
        )}

        {/* Uploading Overlay */}
        {isUploading && (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' }]}>
            <DownloadProgressRing pct={progress || 0} />
            {onCancel && (
              <TouchableOpacity 
                onPress={onCancel}
                style={{ position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, padding: 4 }}
              >
                <X size={16} color="#FFFFFF" />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* Fullscreen Expanded View */}
      <Modal visible={isExpanded} transparent={true} animationType="fade" onRequestClose={() => setIsExpanded(false)}>
        <FullscreenVideoModal uri={uri} onClose={() => setIsExpanded(false)} />
      </Modal>
    </>
  );
}

function FullscreenVideoModal({ uri, onClose }: { uri: string, onClose: () => void }) {
  const videoRef = useRef<Video>(null);
  const [status, setStatus] = useState<AVPlaybackStatus | null>(null);
  const [speed, setSpeed] = useState<number>(1.0);
  
  // Gesture handling for swipe-down to dismiss
  const panY = useRef(new Animated.Value(0)).current;
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, state) => Math.abs(state.dy) > 10,
      onPanResponderMove: (_, state) => {
        // Only allow dragging downwards
        if (state.dy > 0) {
          panY.setValue(state.dy);
        }
      },
      onPanResponderRelease: (_, state) => {
        if (state.dy > 150 || state.vy > 1.5) {
          // Swipe down threshold met, dismiss
          Animated.timing(panY, {
            toValue: SCREEN_HEIGHT,
            duration: 200,
            useNativeDriver: true,
          }).start(onClose);
        } else {
          // Snap back
          Animated.spring(panY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 0,
          }).start();
        }
      }
    })
  ).current;

  // Derived playback status
  const isLoaded = status?.isLoaded;
  const isPlaying = isLoaded ? status.isPlaying : false;
  const durationMillis = isLoaded ? status.durationMillis || 0 : 0;
  const positionMillis = isLoaded ? status.positionMillis || 0 : 0;

  const togglePlayPause = async () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      await videoRef.current.pauseAsync();
    } else {
      if (isLoaded && status.didJustFinish) {
        await videoRef.current.replayAsync();
      } else {
        await videoRef.current.playAsync();
      }
    }
  };

  const toggleSpeed = async () => {
    if (!videoRef.current) return;
    const nextSpeed = speed === 1.0 ? 1.5 : (speed === 1.5 ? 2.0 : 1.0);
    setSpeed(nextSpeed);
    await videoRef.current.setRateAsync(nextSpeed, true);
  };

  const handleSlidingComplete = async (value: number) => {
    if (!videoRef.current) return;
    await videoRef.current.setPositionAsync(value);
  };

  return (
    <Animated.View style={[
      StyleSheet.absoluteFill, 
      { backgroundColor: '#000000', transform: [{ translateY: panY }] }
    ]} {...panResponder.panHandlers}>
      <SafeAreaView style={{ flex: 1 }}>
        
        {/* Top Controls Bar */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 10, zIndex: 10 }}>
          <TouchableOpacity onPress={onClose} style={{ padding: 8, marginLeft: -8 }}>
            <ChevronLeft size={28} color="#FFFFFF" />
          </TouchableOpacity>
          
          <Text style={{ color: '#FFFFFF', fontSize: 12, width: 40, textAlign: 'center' }}>
            {formatDuration(positionMillis)}
          </Text>
          
          <Slider
            style={{ flex: 1, marginHorizontal: 10, height: 40 }}
            minimumValue={0}
            maximumValue={durationMillis}
            value={positionMillis}
            onSlidingComplete={handleSlidingComplete}
            minimumTrackTintColor="#FFFFFF"
            maximumTrackTintColor="rgba(255,255,255,0.3)"
            thumbTintColor="#FFFFFF"
          />
          
          <Text style={{ color: '#FFFFFF', fontSize: 12, width: 40, textAlign: 'center' }}>
            {formatDuration(durationMillis)}
          </Text>
          
          <TouchableOpacity onPress={toggleSpeed} style={{ padding: 8, marginLeft: 8 }}>
            <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>{speed}x</Text>
          </TouchableOpacity>
        </View>

        {/* Video Area */}
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Video
            ref={videoRef}
            source={{ uri }}
            style={{ width: '100%', height: '100%' }}
            resizeMode={ResizeMode.CONTAIN}
            useNativeControls={false}
            isLooping={false}
            shouldPlay={true}
            onPlaybackStatusUpdate={setStatus}
          />
        </View>

        {/* Bottom Bar: Play/Pause */}
        <View style={{ paddingBottom: 30, paddingTop: 20, alignItems: 'center', justifyContent: 'center' }}>
          <TouchableOpacity onPress={togglePlayPause} style={{ padding: 16 }}>
            {isPlaying ? (
              <Pause size={36} color="#FFFFFF" />
            ) : (
              <Play size={36} color="#FFFFFF" style={{ marginLeft: 4 }} />
            )}
          </TouchableOpacity>
        </View>
        
      </SafeAreaView>
    </Animated.View>
  );
}

// ── Custom Image Player ──────────────────────────────────────────────────────
function FullscreenImageModal({ uri, type, onClose }: { uri: string, type: 'image' | 'gif', onClose: () => void }) {
  // Gesture handling for swipe-down to dismiss
  const panY = useRef(new Animated.Value(0)).current;
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, state) => Math.abs(state.dy) > 10,
      onPanResponderMove: (_, state) => {
        // Only allow dragging downwards
        if (state.dy > 0) {
          panY.setValue(state.dy);
        }
      },
      onPanResponderRelease: (_, state) => {
        if (state.dy > 150 || state.vy > 1.5) {
          // Swipe down threshold met, dismiss
          Animated.timing(panY, {
            toValue: SCREEN_HEIGHT,
            duration: 200,
            useNativeDriver: true,
          }).start(onClose);
        } else {
          // Snap back
          Animated.spring(panY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 0,
          }).start();
        }
      }
    })
  ).current;

  return (
    <Animated.View style={[
      StyleSheet.absoluteFill, 
      { backgroundColor: '#000000', transform: [{ translateY: panY }] }
    ]} {...panResponder.panHandlers}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Top Controls Bar */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 10, zIndex: 10 }}>
          <TouchableOpacity onPress={onClose} style={{ padding: 8, marginLeft: -8 }}>
            <ChevronLeft size={28} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Image Area */}
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Image
            source={{ uri }}
            style={{ width: '100%', height: '100%' }}
            contentFit="contain"
            cachePolicy="memory-disk"
            autoplay={type === 'gif'}
          />
        </View>
      </SafeAreaView>
    </Animated.View>
  );
}

// ── Custom Image Player ──────────────────────────────────────────────────────
function CustomImagePlayer({
  uri, previewUrl, type, isOwn, isUploading, progress, onCancel
}: {
  uri: string, previewUrl?: string, type: 'image' | 'gif', isOwn: boolean,
  isUploading?: boolean, progress?: number, onCancel?: () => void
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [downloadPct, setDownloadPct] = useState(0);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  return (
    <>
      <TouchableOpacity 
        activeOpacity={0.9} 
        onPress={() => !isUploading && setIsExpanded(true)} 
        style={StyleSheet.absoluteFill}
      >
        {/* Blurred placeholder — shows immediately while the main image downloads */}
        {(!imgLoaded && !imgError) || isUploading ? (
          <Image
            source={{ uri: previewUrl || uri }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            blurRadius={isOwn ? 0 : 14}
            cachePolicy="memory-disk"
          />
        ) : null}

        {/* Main image — streams in, tracked by onProgress */}
        {!imgError && !isUploading && (
          <Image
            source={{ uri }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            cachePolicy="memory-disk"
            autoplay={type === 'gif'}
            onProgress={(e) => {
              if (e.loaded && e.total) {
                setDownloadPct(Math.round((e.loaded / e.total) * 100));
              }
            }}
            onLoadEnd={() => {
              setDownloadPct(100);
              // Small delay so user can see the "100%" for a moment
              setTimeout(() => setImgLoaded(true), 300);
            }}
            onError={() => { setImgError(true); setImgLoaded(true); }}
          />
        )}

        {/* Error */}
        {imgError && !isUploading && (
          <View style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.1)' }}>
            <Text style={{ color: '#FFFFFF', fontSize: 12 }}>
              {type === 'gif' ? '🎞 Failed to load GIF' : '🖼 Failed to load Image'}
            </Text>
          </View>
        )}

        {/* Download progress overlay — shown while image is loading */}
        {!imgLoaded && !imgError && !isUploading && (
          <View style={[StyleSheet.absoluteFill, {
            backgroundColor: 'rgba(0,0,0,0.35)',
            justifyContent: 'center',
            alignItems: 'center',
          }]}>
            <DownloadProgressRing pct={downloadPct} />
          </View>
        )}

        {/* Uploading Overlay */}
        {isUploading && (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' }]}>
            <DownloadProgressRing pct={progress || 0} />
            {onCancel && (
              <TouchableOpacity 
                onPress={onCancel}
                style={{ position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, padding: 4 }}
              >
                <X size={16} color="#FFFFFF" />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* GIF badge */}
        {type === 'gif' && imgLoaded && !imgError && !isUploading && (
          <View style={styles.gifBadge}>
            <Text style={styles.gifBadgeText}>GIF</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Fullscreen Expanded View */}
      <Modal visible={isExpanded} transparent={true} animationType="fade" onRequestClose={() => setIsExpanded(false)}>
        <FullscreenImageModal uri={uri} type={type} onClose={() => setIsExpanded(false)} />
      </Modal>
    </>
  );
}

function ChallengeCompletedCard({ media, isOwn }: { media: MediaContent, isOwn: boolean }) {
  const theme = useTheme();
  
  const intensityColor = (intensity?: string) => {
    switch(intensity?.toLowerCase()) {
      case 'high': return '#EF4444'; // Red
      case 'medium': return '#F59E0B'; // Amber
      case 'low': return '#10B981'; // Emerald
      default: return '#64748B';
    }
  };

  return (
    <View style={[
      styles.challengeCard,
      { backgroundColor: '#0F172A', borderColor: 'rgba(16, 185, 129, 0.2)' }
    ]}>
      <View style={styles.challengeHeader}>
        <View style={styles.challengeIconBox}>
          <Trophy size={18} color="#10B981" />
        </View>
        <Text style={[styles.challengeTitle, { fontFamily: theme.typography.fontFamily }]}>
          Protocol Achieved
        </Text>
      </View>

      <View style={styles.challengeBody}>
        <Text style={[styles.challengeTaskName, { fontFamily: theme.typography.fontFamily }]} numberOfLines={2}>
          {media.taskName || 'Daily Mission'}
        </Text>
        
        <View style={styles.challengeDetailsRow}>
           <View style={styles.challengeDetailItem}>
             <Target size={12} color="#94A3B8" />
             <Text style={styles.challengeDetailText}>{media.focusType || 'Training'}</Text>
           </View>
           <View style={[styles.challengeDetailItem, { marginLeft: 12 }]}>
             <Zap size={12} color={intensityColor(media.intensity)} />
             <Text style={[styles.challengeDetailText, { color: intensityColor(media.intensity) }]}>
               {media.intensity || 'Normal'}
             </Text>
           </View>
        </View>

        {media.taskDescription ? (
          <Text style={styles.challengeDesc} numberOfLines={2}>{media.taskDescription}</Text>
        ) : null}
      </View>

      <View style={styles.challengeFooter}>
        <Text style={styles.challengeFooterText}>
          Completed at {media.completedAt || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    </View>
  );
}

function TaskCompletedCard({ media }: { media: MediaContent }) {
  const theme = useTheme();
  
  return (
    <View style={[
      styles.challengeCard,
      { backgroundColor: '#0F172A', borderColor: 'rgba(59, 130, 246, 0.2)' } // Slightly different blue border for tasks
    ]}>
      <View style={styles.challengeHeader}>
        <View style={[styles.challengeIconBox, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
          <Check size={18} color="#3B82F6" />
        </View>
        <Text style={[styles.challengeTitle, { color: '#3B82F6', fontFamily: theme.typography.fontFamily }]}>
          Task Completed
        </Text>
      </View>

      <View style={styles.challengeBody}>
        <Text style={[styles.challengeTaskName, { fontFamily: theme.typography.fontFamily }]} numberOfLines={2}>
          {media.taskName || 'Protocol Task'}
        </Text>
        
        {media.description ? (
          <Text style={styles.challengeDesc} numberOfLines={2}>{media.description}</Text>
        ) : null}
      </View>

      <View style={styles.challengeFooter}>
        <Text style={styles.challengeFooterText}>
          Completed at {media.timestamp ? new Date(media.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    </View>
  );
}

export default function ChatMediaMessage({ 
  content, isOwn, createdAt, isRead, isUploading, progress = 0, onCancel, replyTo, onPressReply, isHighlighted 
}: Props) {
  const theme = useTheme();
  const highlightAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (isHighlighted) {
      Animated.sequence([
        Animated.timing(highlightAnim, { toValue: 1, duration: 300, useNativeDriver: false }),
        Animated.timing(highlightAnim, { toValue: 0, duration: 300, useNativeDriver: false }),
        Animated.timing(highlightAnim, { toValue: 1, duration: 300, useNativeDriver: false }),
        Animated.timing(highlightAnim, { toValue: 0, duration: 600, useNativeDriver: false }),
      ]).start();
    } else {
      highlightAnim.setValue(0);
    }
  }, [isHighlighted]);

  const highlightOverlayColor = highlightAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['transparent', isOwn ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.15)']
  });

  let media: MediaContent | null = null;
  try {
    media = JSON.parse(content);
  } catch {
    return null;
  }

  if (!media || !['image', 'video', 'document', 'gif', 'challenge_completed', 'task_completion'].includes(media.type)) {
    return null;
  }

  const bubbleStyle = [
    styles.bubble,
    isOwn
      ? [styles.myBubble, { backgroundColor: theme.colors.primary }]
      : [styles.theirBubble, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }],
  ];

  if ((media.type === 'image' || media.type === 'gif') && media.url) {
    return (
      <View style={[
        styles.bubble,
        isOwn ? styles.myBubble : styles.theirBubble,
        {
          width: 220,
          height: replyTo ? 240 : 200,
          padding: 0,
          overflow: 'hidden',
          borderWidth: 0,
          backgroundColor: theme.colors.surfaceAlt || '#E5E7EB',
          position: 'relative',
        }
      ]}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: highlightOverlayColor, borderRadius: 16, zIndex: 10 }]} pointerEvents="none" />
        {replyTo && (
          <View style={{ padding: 4, backgroundColor: theme.colors.surface }}>
            <ChatReplyContext 
              message={replyTo} 
              onPress={() => replyTo.id && onPressReply?.(replyTo.id)} 
              isMe={isOwn}
            />
          </View>
        )}

        <CustomImagePlayer 
          uri={media.url} 
          previewUrl={media.previewUrl} 
          type={media.type as 'image' | 'gif'} 
          isOwn={isOwn} 
          isUploading={isUploading}
          progress={progress}
          onCancel={onCancel}
        />

        {/* Time Badge Overlay */}
        {createdAt && (
          <View style={styles.timeBadgeContainer} pointerEvents="none">
            <Text style={styles.timeBadgeText}>
              {new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            {isOwn && (
              isRead ? 
                <CheckCheck size={12} color="#FFFFFF" style={{ marginLeft: 4 }} /> : 
                <Check size={12} color="#FFFFFF" style={{ marginLeft: 4 }} />
            )}
          </View>
        )}
      </View>
    );
  }

  if (media.type === 'video' && media.url) {
    return (
      <View style={[
        styles.bubble,
        isOwn ? styles.myBubble : styles.theirBubble,
        {
          width: 250,
          height: replyTo ? 290 : 250,
          padding: 0,
          overflow: 'hidden',
          borderWidth: 0,
          backgroundColor: '#000000',
        }
      ]}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: highlightOverlayColor, borderRadius: 16, zIndex: 10 }]} pointerEvents="none" />
        {replyTo && (
          <View style={{ padding: 4, backgroundColor: theme.colors.surface }}>
            <ChatReplyContext 
              message={replyTo} 
              onPress={() => replyTo.id && onPressReply?.(replyTo.id)}
              isMe={isOwn}
            />
          </View>
        )}
        <CustomVideoPlayer 
          uri={media.url} 
          isUploading={isUploading}
          progress={progress}
          onCancel={onCancel}
        />

        {/* Time Badge Overlay */}
        {createdAt && (
          <View style={[styles.timeBadgeContainer, { bottom: 8, right: 8 }]} pointerEvents="none">
            <Text style={styles.timeBadgeText}>
              {new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            {isOwn && (
              isRead ? 
                <CheckCheck size={12} color="#FFFFFF" style={{ marginLeft: 4 }} /> : 
                <Check size={12} color="#FFFFFF" style={{ marginLeft: 4 }} />
            )}
          </View>
        )}
      </View>
    );
  }

  if (media.type === 'document') {
    const bubbleStyle = [
      styles.bubble,
      isOwn ? styles.myBubble : styles.theirBubble,
      { backgroundColor: isOwn ? theme.colors.primary : theme.colors.surface, borderColor: theme.colors.border }
    ];

    return (
      <TouchableOpacity 
        style={bubbleStyle}
        onPress={() => !isUploading && media?.url && Linking.openURL(media.url)}
        activeOpacity={0.8}
      >
        {replyTo && (
          <ChatReplyContext 
            message={replyTo} 
            onPress={() => replyTo.id && onPressReply?.(replyTo.id)}
            isMe={isOwn}
          />
        )}
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: highlightOverlayColor, borderRadius: 16, zIndex: 10 }]} pointerEvents="none" />
        <View style={styles.docContainer}>
          <FileText size={28} color={isOwn ? '#FFFFFF' : theme.colors.primary} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text
              style={[
                styles.docName,
                { color: isOwn ? '#FFFFFF' : theme.colors.text, fontFamily: theme.typography.fontFamily },
              ]}
              numberOfLines={2}
            >
              {media.fileName || (isUploading ? 'Uploading…' : 'Document')}
            </Text>
            <Text style={[styles.docHint, { color: isOwn ? 'rgba(255,255,255,0.7)' : theme.colors.textSecondary }]}>
              {isUploading ? `Uploading… ${progress}%` : 'Tap to open'}
            </Text>
          </View>
          {!isUploading && (
            <Download size={20} color={isOwn ? '#FFFFFF' : theme.colors.textSecondary} />
          )}
        </View>

        {isUploading && (
          <View style={[StyleSheet.absoluteFill, { 
            backgroundColor: isOwn ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.5)', 
            justifyContent: 'center', 
            alignItems: 'center' 
          }]}>
            <DownloadProgressRing pct={progress} />
            {onCancel && (
              <TouchableOpacity 
                onPress={onCancel}
                style={{ position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: 12, padding: 4 }}
              >
                <X size={14} color={isOwn ? '#FFFFFF' : theme.colors.primary} />
              </TouchableOpacity>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  }
  
  if (media.type === 'task_completion') {
    return (
      <View style={[
        styles.bubble,
        isOwn ? styles.myBubble : styles.theirBubble,
        { backgroundColor: 'transparent', borderWidth: 0, padding: 0 }
      ]}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: highlightOverlayColor, borderRadius: 24, zIndex: 10 }]} pointerEvents="none" />
        <TaskCompletedCard media={media} />
      </View>
    );
  }

  if (media.type === 'challenge_completed') {
    return (
      <View style={[
        styles.bubble,
        isOwn ? styles.myBubble : styles.theirBubble,
        { backgroundColor: 'transparent', borderWidth: 0, padding: 0 }
      ]}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: highlightOverlayColor, borderRadius: 24, zIndex: 10 }]} pointerEvents="none" />
        <ChallengeCompletedCard media={media} isOwn={isOwn} />
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  bubble: {
    maxWidth: '80%',
    borderRadius: 16,
    marginBottom: 4,
    overflow: 'hidden',
  },
  myBubble: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  theirBubble: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
  },
  gifBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  gifBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  videoContainer: {
    padding: 12,
    alignItems: 'center',
    minWidth: 180,
  },
  videoThumb: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  videoLabel: {
    fontSize: 13,
  },
  docContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    minWidth: 200,
    maxWidth: 260,
  },
  docName: {
    fontSize: 14,
    fontWeight: '600',
  },
  docHint: {
    fontSize: 11,
    marginTop: 2,
  },
  timeBadgeContainer: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 12,
  },
  timeBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '500',
  },
  // Challenge Card Styles
  challengeCard: {
    width: 260,
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 16,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  challengeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  challengeIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  challengeTitle: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  challengeBody: {
    marginBottom: 16,
  },
  challengeTaskName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 24,
    marginBottom: 8,
  },
  challengeDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  challengeDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.03)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  challengeDetailText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  challengeDesc: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 10,
    lineHeight: 18,
  },
  challengeFooter: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    paddingTop: 12,
  },
  challengeFooterText: {
    color: '#475569',
    fontSize: 10,
    fontWeight: '600',
  },
});
