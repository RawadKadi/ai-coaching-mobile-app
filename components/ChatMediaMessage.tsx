import React, { useState } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet,
  Linking, ActivityIndicator,
} from 'react-native';
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

export function ChatMediaMessage({ content, isOwn }: Props) {
  const theme = useTheme();
  const [imgLoading, setImgLoading] = useState(true);
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
        { width: 220, height: 200, padding: 0, overflow: 'hidden', borderWidth: 0, backgroundColor: isOwn ? theme.colors.primary : theme.colors.surfaceAlt || '#E5E7EB', position: 'relative' }
      ]}>
        
        {/* Main Image Layer (Standard Flow) */}
        {!imgError ? (
          <Image
            source={{ uri: media.url }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
            onLoadStart={() => setImgLoading(true)}
            onLoadEnd={() => setImgLoading(false)}
            onError={() => { setImgError(true); }}
          />
        ) : (
          /* Error Layer Flow */
          <View style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.1)' }}>
            <Text style={{ color: isOwn ? '#FFFFFF' : theme.colors.textSecondary, fontSize: 12 }}>
              {media.type === 'gif' ? '🎞 Failed to load GIF' : '🖼 Failed to load Image'}
            </Text>
          </View>
        )}
        
        {/* Loading Overlay Layer (Absolute) */}
        {imgLoading && !imgError && (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: isOwn ? 'rgba(0,0,0,0.3)' : 'transparent', justifyContent: 'center', alignItems: 'center' }]}>
            {/* If we have a preview URL, show it immediately under the spinner */}
            {media.previewUrl && (
              <Image 
                source={{ uri: media.previewUrl }} 
                style={[StyleSheet.absoluteFill, { opacity: 0.9 }]} 
                blurRadius={4}
                resizeMode="cover" 
              />
            )}
            <ActivityIndicator color={isOwn ? '#FFFFFF' : theme.colors.primary} size="large" style={{ zIndex: 10 }} />
          </View>
        )}
        
        {/* GIF Badge Layer (Absolute) */}
        {media.type === 'gif' && !imgLoading && !imgError && (
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
  image: {
    width: '100%',
    height: '100%',
    borderRadius: 14,
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
