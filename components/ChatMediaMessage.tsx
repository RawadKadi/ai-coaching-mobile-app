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
import { FileText, Play, Download, RefreshCw, Check, CheckCheck, ChevronLeft, Pause, X } from 'lucide-react-native';
import { ChatReplyContext } from './ChatReplyContext';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

type MediaContent = {
  type: 'image' | 'video' | 'document' | 'gif';
  url: string;
  previewUrl?: string;
  fileName?: string;
  mimeType?: string;
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

export default function ChatMediaMessage({ 
  content, isOwn, createdAt, isRead, isUploading, progress = 0, onCancel, replyTo, onPressReply 
}: Props) {
  const theme = useTheme();

  let media: MediaContent | null = null;
  try {
    media = JSON.parse(content);
  } catch {
    return null;
  }

  if (!media || !['image', 'video', 'document', 'gif'].includes(media.type)) {
    return null;
  }

  const bubbleStyle = [
    styles.bubble,
    isOwn
      ? [styles.myBubble, { backgroundColor: theme.colors.primary }]
      : [styles.theirBubble, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }],
  ];

  if (media.type === 'image' || media.type === 'gif') {
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
        {replyTo && (
          <View style={{ padding: 4, backgroundColor: theme.colors.surface }}>
            <ChatReplyContext 
              message={replyTo} 
              onPress={() => replyTo.id && onPressReply?.(replyTo.id)} 
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

  if (media.type === 'video') {
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
        {replyTo && (
          <View style={{ padding: 4, backgroundColor: theme.colors.surface }}>
            <ChatReplyContext 
              message={replyTo} 
              onPress={() => replyTo.id && onPressReply?.(replyTo.id)}
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
          />
        )}
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
});
