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
}

export function ChatReplyContext({ message, onPress, isInsideBubble = true }: Props) {
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

  return (
    <TouchableOpacity 
      activeOpacity={0.8} 
      onPress={onPress}
      style={[
        styles.container, 
        { 
          backgroundColor: isInsideBubble ? 'rgba(0,0,0,0.05)' : theme.colors.surfaceAlt,
          borderLeftColor: theme.colors.primary,
          marginBottom: isInsideBubble ? 8 : 0,
          borderRadius: 8,
          borderLeftWidth: 4,
        }
      ]}
    >
      <View style={styles.content}>
        <Text style={[styles.sender, { color: theme.colors.primary }]} numberOfLines={1}>
          {message.isOwn ? 'You' : (message.sender_name || 'Sender')}
        </Text>
        <Text style={[styles.snippet, { color: theme.colors.textSecondary }]} numberOfLines={2}>
          {snippet}
        </Text>
      </View>
      {mediaUrl && (
        <View style={styles.thumbBox}>
          <Image source={{ uri: mediaUrl }} style={styles.thumb} />
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 8,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  sender: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  snippet: {
    fontSize: 12,
  },
  thumbBox: {
    width: 36,
    height: 36,
    borderRadius: 4,
    overflow: 'hidden',
    marginLeft: 8,
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
});
