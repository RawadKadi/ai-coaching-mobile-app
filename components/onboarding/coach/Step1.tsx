import { useBrandColors } from '@/contexts/BrandContext';
import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { Plus, Trash2 } from 'lucide-react-native';
import SectionLabel from '../SectionLabel';
import InputGroup from '../InputGroup';

interface Step1Props {
  formData: {
    business_name: string;
    logo_url: string;
  };
  updateForm: (key: string, value: any) => void;
  pickImage: () => Promise<void>;
  removeLogo: () => void;
  uploading: boolean;
}

export default function Step1({ formData, updateForm, pickImage, removeLogo, uploading }: Step1Props) {
  const colors = useBrandColors();
  return (
    <View style={{ gap: 28 }}>
      <SectionLabel step="Step 1" title="Build Your Brand" desc="Set up your public identity" />
      
      <View style={{ gap: 24 }}>
        <View>
          <Text style={{ color: '#94A3B8', fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 12, paddingHorizontal: 4 }}>
            Brand Logo
          </Text>
          
          {formData.logo_url ? (
            <View style={{ position: 'relative', width: 144, height: 144, borderRadius: 24, overflow: 'hidden', borderWidth: 2, borderColor: '#1E293B', backgroundColor: '#0F172A', justifyContent: 'center', alignItems: 'center' }}>
              <Image 
                source={{ uri: formData.logo_url }} 
                style={{ width: '100%', height: '100%' }}
                contentFit="cover"
              />
              <TouchableOpacity 
                onPress={removeLogo}
                style={{ position: 'absolute', bottom: 8, right: 8, width: 36, height: 36, backgroundColor: 'rgba(239, 68, 68, 0.9)', borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#EF4444' }}
              >
                <Trash2 size={16} color="white" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity 
              onPress={pickImage}
              disabled={uploading}
              style={{ width: 144, height: 144, borderRadius: 24, borderWidth: 2, borderStyle: 'dashed', borderColor: '#334155', backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center' }}
            >
              {uploading ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <>
                  <Plus size={32} color="#64748B" />
                  <Text style={{ color: '#94A3B8', fontWeight: '700', fontSize: 13, marginTop: 8 }}>Add Image</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        <InputGroup 
          label="Brand Name *" 
          value={formData.business_name} 
          onChange={(v: string) => updateForm('business_name', v)} 
          placeholder="e.g. Apex Performance" 
        />
      </View>
    </View>
  );
}
