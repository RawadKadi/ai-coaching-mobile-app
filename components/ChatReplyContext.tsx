import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { useTheme } from '@/contexts/BrandContext';

interface Props {
  message: {
    content: string;
    sender_name?: string;
    isOwn?: boolean;
  } | null;
  onPress?: () => void;
  isInsideBubble?: boolean;
  isMe?: boolean;
}

export function ChatReplyContext({ message, onPress, isInsideBubble = true, isMe = false }: Props) {
  const theme = useTheme();
  
  if (!message) return null;

  let snippet = '';
  let mediaUrl = '';
  let mediaType = '';

  try {
    const content = typeof message.content === 'string' ? JSON.parse(message.content) : message.content;
    if (content.type === 'image') {
      snippet = '🖼 Photo';
      mediaUrl = content.url;
      mediaType = 'image';
    } else if (content.type === 'video') {
      snippet = '🎥 Video';
      mediaUrl = content.thumbnailUrl || content.url;
      mediaType = 'video';
    } else if (content.type === 'gif') {
      snippet = '🎞 GIF';
      mediaUrl = content.url;
      mediaType = 'gif';
    } else if (content.type === 'document') {
      snippet = '📄 ' + (content.fileName || 'Document');
    } else {
      snippet = message.content;
    }
  } catch (e) {
    snippet = message.content;
  }

  const isMedia = !!mediaUrl || snippet.startsWith('📄');

  return (
    <TouchableOpacity 
      activeOpacity={0.8} 
      onPress={onPress}
      style={[
        styles.container, 
        { 
          backgroundColor: isInsideBubble 
            ? (isMe ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.05)') 
            : theme.colors.surfaceAlt,
          borderLeftColor: isInsideBubble && isMe ? '#FFFFFF' : theme.colors.primary,
          marginBottom: isInsideBubble ? 8 : 0,
          borderRadius: 8,
          borderLeftWidth: 4,
          // Constrain width as per user request
          width: isMedia ? 220 : undefined,
          minWidth: isMedia ? 220 : 130, // Minimum width for text to prevent squishing
          maxWidth: 280, // Absolute max to avoid screen overflow
        }
      ]}
    >
      <View style={styles.content}>
        <Text style={[styles.sender, { color: isInsideBubble && isMe ? '#FFFFFF' : theme.colors.primary }]} numberOfLines={1}>
          {message.isOwn ? 'You' : (message.sender_name || 'Sender')}
        </Text>
        <Text style={[styles.snippet, { color: isInsideBubble && isMe ? 'rgba(255,255,255,0.8)' : theme.colors.textSecondary }]} numberOfLines={2}>
          {snippet}
        </Text>
      </View>
      {mediaUrl && (
        <View style={styles.thumbBox}>
          <Image 
            source={{ uri: mediaUrl }} 
            style={styles.thumb} 
            contentFit="cover"
            cachePolicy="disk"
            transition={150}
          />
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 10,
    overflow: 'hidden',
    minHeight: 54,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingRight: 4,
  },
  sender: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 2,
  },
  snippet: {
    fontSize: 13,
    lineHeight: 18,
  },
  thumbBox: {
    width: 44,
    height: 44,
    borderRadius: 6,
    overflow: 'hidden',
    marginLeft: 8,
    alignSelf: 'center',
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
});
