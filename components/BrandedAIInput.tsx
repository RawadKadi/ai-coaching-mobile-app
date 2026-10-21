import React, { useState, useRef } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, Image, ScrollView, Animated, ActivityIndicator } from 'react-native';
import { ArrowUp, Mic, Plus, X, Square } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useBrandColors, useTheme } from '@/contexts/BrandContext';
import { scaleBorderRadius } from '@/lib/theme-utils';

interface BrandedAIInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  maxLength?: number;
}

export function BrandedAIInput({ value, onChangeText, onSubmit, placeholder = "Ask anything...", maxLength = 350 }: BrandedAIInputProps) {
  const colors = useBrandColors();
  const theme = useTheme();
  const isDark = theme.isDarkMode;

  const [isRecording, setIsRecording] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attachments, setAttachments] = useState<string[]>([]);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const hasContent = value.length > 0 || attachments.length > 0;

  const handlePress = () => {
    if (isRecording) {
      setIsRecording(false);
      return;
    }
    if (!hasContent) {
      setIsRecording(true);
      return;
    }
    
    setIsSubmitting(true);
    Animated.spring(scaleAnim, {
      toValue: 0.85,
      friction: 5,
      tension: 100,
      useNativeDriver: true,
    }).start();

    setTimeout(() => {
      onSubmit();
      // Restore state in case component stays mounted
      setIsSubmitting(false);
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 5,
        useNativeDriver: true,
      }).start();
    }, 400);
  };

  const pickImage = async () => {
    try {
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: 3,
        quality: 0.8,
      });
      if (!result.canceled) {
        const uris = result.assets.map(a => a.uri);
        setAttachments(prev => [...prev, ...uris]);
      }
    } catch (e) {
      console.log("Image picker error", e);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const borderRadius = scaleBorderRadius(20, theme.spacing.borderRadiusScale);

  return (
    <View style={[
      styles.container, 
      { 
        backgroundColor: colors.surface, 
        borderColor: colors.border,
        borderRadius: borderRadius,
      }
    ]}>
      {attachments.length > 0 && (
        <ScrollView horizontal style={[styles.attachmentsRow, { borderBottomColor: colors.border }]} showsHorizontalScrollIndicator={false}>
          {attachments.map((uri, idx) => (
            <View key={idx} style={[styles.attachmentThumb, { backgroundColor: colors.surfaceAlt || colors.background }]}>
              <Image source={{ uri }} style={styles.thumbImage} />
              <TouchableOpacity style={styles.removeBtn} onPress={() => removeAttachment(idx)}>
                <X size={12} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}

      <TextInput
        style={[
          styles.input, 
          { 
            color: colors.text,
            minHeight: 80, 
            maxHeight: 180,
            fontFamily: theme.typography.fontFamily,
          }
        ]}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        multiline={true}
        maxLength={maxLength}
        value={value}
        onChangeText={onChangeText}
      />

      <View style={styles.actionBar}>
        <View style={styles.leftActions}>
          <TouchableOpacity 
            style={[styles.iconBtn, { backgroundColor: colors.surfaceAlt || colors.background }]} 
            onPress={pickImage}
          >
            <Plus size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.rightActions}>
          <Text style={[styles.charCount, { color: value.length >= maxLength ? colors.error : colors.textSecondary }]}>
            {value.length} / {maxLength}
          </Text>
          <TouchableOpacity 
            activeOpacity={0.85}
            onPress={isSubmitting ? undefined : handlePress}
            disabled={isSubmitting}
          >
            <Animated.View style={[
              styles.sendBtn, 
              { 
                backgroundColor: isSubmitting 
                  ? colors.surfaceAlt 
                  : isRecording 
                    ? colors.error 
                    : hasContent 
                      ? colors.primary 
                      : (isDark ? colors.surfaceAlt : colors.border)
              },
              { transform: [{ scale: scaleAnim }] }
            ]}>
              {isSubmitting ? (
                <ActivityIndicator size="small" color={colors.textSecondary} />
              ) : isRecording ? (
                <Square size={14} color="#FFFFFF" fill="#FFFFFF" />
              ) : hasContent ? (
                <ArrowUp size={18} color={colors.textOnPrimary || '#FFFFFF'} />
              ) : (
                <Mic size={18} color={colors.textSecondary} />
              )}
            </Animated.View>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    overflow: 'hidden',
    paddingBottom: 14,
  },
  attachmentsRow: {
    padding: 12,
    borderBottomWidth: 1,
  },
  attachmentThumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
    marginRight: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  removeBtn: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 10,
    padding: 2,
  },
  input: {
    fontSize: 16,
    padding: 16,
    paddingTop: 16,
    textAlignVertical: 'top',
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    marginTop: 4,
  },
  leftActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  charCount: {
    fontSize: 12,
    fontWeight: '600',
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
