import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Linking,
} from 'react-native';
import { Image } from 'expo-image';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '@/contexts/BrandContext';
import { FileText, Play, Download } from 'lucide-react-native';

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

export function ChatMediaMessage({ content, isOwn }: Props) {
  const theme = useTheme();
  const [downloadPct, setDownloadPct] = useState(0);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

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
          height: 200,
          padding: 0,
          overflow: 'hidden',
          borderWidth: 0,
          backgroundColor: theme.colors.surfaceAlt || '#E5E7EB',
          position: 'relative',
        }
      ]}>

        {/* Blurred placeholder — shows immediately while the main image downloads */}
        {!imgLoaded && !imgError && (
          <Image
            source={{ uri: media.previewUrl || media.url }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            blurRadius={isOwn ? 0 : 14}
            cachePolicy="memory-disk"
          />
        )}

        {/* Main image — streams in, tracked by onProgress */}
        {!imgError && (
          <Image
            source={{ uri: media.url }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            cachePolicy="memory-disk"
            autoplay={media.type === 'gif'}
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
        {imgError && (
          <View style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.1)' }}>
            <Text style={{ color: '#FFFFFF', fontSize: 12 }}>
              {media.type === 'gif' ? '🎞 Failed to load GIF' : '🖼 Failed to load Image'}
            </Text>
          </View>
        )}

        {/* Download progress overlay — shown while image is loading */}
        {!imgLoaded && !imgError && (
          <View style={[StyleSheet.absoluteFill, {
            backgroundColor: 'rgba(0,0,0,0.35)',
            justifyContent: 'center',
            alignItems: 'center',
          }]}>
            <DownloadProgressRing pct={downloadPct} />
          </View>
        )}

        {/* GIF badge */}
        {media.type === 'gif' && imgLoaded && !imgError && (
          <View style={styles.gifBadge}>
            <Text style={styles.gifBadgeText}>GIF</Text>
          </View>
        )}
      </View>
    );
  }

  if (media.type === 'video') {
    return (
      <TouchableOpacity
        style={bubbleStyle}
        onPress={() => media?.url && Linking.openURL(media.url)}
        activeOpacity={0.8}
      >
        <View style={styles.videoContainer}>
          <View style={styles.videoThumb}>
            <Play size={32} color="#FFFFFF" />
          </View>
          <Text style={[
            styles.videoLabel,
            { color: isOwn ? '#FFFFFF' : theme.colors.text, fontFamily: theme.typography.fontFamily },
          ]}>
            Video — tap to open
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  if (media.type === 'document') {
    return (
      <TouchableOpacity
        style={bubbleStyle}
        onPress={() => media?.url && Linking.openURL(media.url)}
        activeOpacity={0.8}
      >
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
              {media.fileName || 'Document'}
            </Text>
            <Text style={[styles.docHint, { color: isOwn ? 'rgba(255,255,255,0.7)' : theme.colors.textSecondary }]}>
              Tap to open
            </Text>
          </View>
          <Download size={20} color={isOwn ? '#FFFFFF' : theme.colors.textSecondary} />
        </View>
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
});
