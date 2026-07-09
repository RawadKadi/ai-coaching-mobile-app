import React, { useState, useRef } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, Image, ScrollView, Animated, ActivityIndicator } from 'react-native';
import { ArrowUp, Mic, Plus, X, Square, Cpu, Activity, Zap } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';

interface BrandedAIInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  maxLength?: number;
}

export function BrandedAIInput({ value, onChangeText, onSubmit, placeholder = "Ask anything...", maxLength = 350 }: BrandedAIInputProps) {
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
          setExpanded(true);
        }
    } catch (e) {
        console.log("Image picker error", e);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <View style={[styles.container, styles.containerExpanded]}>
      {attachments.length > 0 && (
        <ScrollView horizontal style={styles.attachmentsRow} showsHorizontalScrollIndicator={false}>
          {attachments.map((uri, idx) => (
            <View key={idx} style={styles.attachmentThumb}>
              <Image source={{ uri }} style={styles.thumbImage} />
              <TouchableOpacity style={styles.removeBtn} onPress={() => removeAttachment(idx)}>
                <X size={12} color="white" />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}

      <TextInput
        style={[styles.input, { minHeight: 64, maxHeight: 160 }]}
        placeholder={placeholder}
        placeholderTextColor="#475569"
        multiline={true}
        maxLength={maxLength}
        value={value}
        onChangeText={onChangeText}
      />

      <View style={styles.actionBar}>
        <View style={styles.leftActions}>
          <TouchableOpacity style={styles.iconBtn} onPress={pickImage}>
            <Plus size={20} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        <View style={styles.rightActions}>
          <Text style={[styles.charCount, value.length >= maxLength ? styles.charLimit : null]}>
            {value.length} / {maxLength}
          </Text>
          <TouchableOpacity 
            activeOpacity={0.9}
            onPress={isSubmitting ? undefined : handlePress}
            disabled={isSubmitting}
          >
            <Animated.View style={[
              styles.sendBtn, 
              hasContent && styles.sendBtnActive,
              isSubmitting && { backgroundColor: '#475569' },
              { transform: [{ scale: scaleAnim }] }
            ]}>
              {isSubmitting ? (
                <ActivityIndicator size="small" color="white" />
              ) : isRecording ? (
                <Square size={16} color="white" fill="white" />
              ) : hasContent ? (
                <ArrowUp size={18} color="white" />
              ) : (
                <Mic size={18} color="white" />
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
    backgroundColor: '#0F172A',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#1E293B',
    overflow: 'hidden',
  },
  containerExpanded: {
    paddingBottom: 16,
  },
  attachmentsRow: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  attachmentThumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
    marginRight: 8,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#1E293B',
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
    color: 'white',
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
  hidden: {
    opacity: 0,
    height: 0,
    overflow: 'hidden',
    marginTop: 0,
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
  pillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  pillText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  iconBtn: {
    padding: 6,
  },
  charCount: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: 'bold',
  },
  charLimit: {
    color: '#EF4444',
  },
  sendBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnActive: {
    backgroundColor: '#2563EB',
  }
});
