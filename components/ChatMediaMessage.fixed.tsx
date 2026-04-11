import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Linking, Modal, SafeAreaView, Animated, PanResponder, Dimensions
} from 'react-native';
import { Image } from 'expo-image';
import Slider from '@react-native-community/slider';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import Svg, { Circle } from 'react-native-svg';
import * as FileSystem from 'expo-file-system';
import { useTheme } from '@/contexts/BrandContext';
import { FileText, Play, Download, RefreshCw, Check, CheckCheck, ChevronLeft, Pause, X, Trophy, Zap, Target } from 'lucide-react-native';
import { ChatReplyContext } from './ChatReplyContext';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// ── Media Caching Hook ──────────────────────────────────────────────────────
const useMediaCache = (url?: string, type?: string) => {
    const [localUri, setLocalUri] = useState<string | null>(null);

    useEffect(() => {
        if (!url || !url.startsWith('http')) {
            setLocalUri(url || null);
            return;
        }

        const cacheMedia = async () => {
            try {
                // Create a unique filename based on the Supabase URL
                const filename = url.split('/').pop()?.split('?')[0] || `cache_${Date.now()}`;
                const fileUri = `${FileSystem.cacheDirectory}${filename}`;

                const fileInfo = await FileSystem.getInfoAsync(fileUri);
                if (fileInfo.exists) {
                    setLocalUri(fileUri);
                } else {
                    setLocalUri(url);
                    FileSystem.downloadAsync(url, fileUri).catch((e: any) => console.warn('[MediaCache] Download failed:', e));
                }
            } catch (e) {
                console.warn('[MediaCache] Error:', e);
                setLocalUri(url);
            }
        };

        cacheMedia();
    }, [url]);

    return localUri;
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

// ── Custom Video Player ──────────────────────────────────────────────────────
function CustomVideoPlayer({ 
  uri: remoteUri, isUploading, progress, onCancel 
}: { 
  uri: string, isUploading?: boolean, progress?: number, onCancel?: () => void 
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const uri = useMediaCache(remoteUri, 'video') || remoteUri;
  
  const [durationMillis, setDurationMillis] = useState(0);
  const [inlineStatus, setInlineStatus] = useState<AVPlaybackStatus | null>(null);
  const inlineVideoRef = useRef<Video>(null);

  useEffect(() => {
    if (inlineStatus?.isLoaded && inlineStatus.durationMillis) {
      setDurationMillis(inlineStatus.durationMillis);
    }
  }, [inlineStatus]);

  return (
    <View style={{ width: '100%', height: 180, borderRadius: 16, overflow: 'hidden', backgroundColor: '#1E293B' }}>
      <View style={StyleSheet.absoluteFill}>
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

        {isUploading && (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', zIndex: 10 }]}>
            <DownloadProgressRing pct={progress || 0} />
            {onCancel && (
              <TouchableOpacity onPress={onCancel} style={{ marginTop: 16, backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}>
                <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '700' }}>CANCEL</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      <Modal visible={isExpanded} transparent={true} animationType="fade" onRequestClose={() => setIsExpanded(false)}>
        <FullscreenVideoModal uri={uri} onClose={() => setIsExpanded(false)} />
      </Modal>
    </View>
  );
}
