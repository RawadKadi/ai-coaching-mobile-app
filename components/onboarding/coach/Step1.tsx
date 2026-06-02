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
  return (
    <View className="gap-8">
      <SectionLabel step="Step 1" title="Build Your Brand" desc="Set up your public identity" />
      
      <View className="gap-6">
        <View>
          <Text className="text-slate-400 text-sm font-black uppercase tracking-widest mb-3 px-1">Brand Logo</Text>
          
          {formData.logo_url ? (
            <View className="relative w-36 h-36 rounded-3xl overflow-hidden border-2 border-slate-800 bg-slate-900/40 justify-center items-center">
              <Image 
                source={{ uri: formData.logo_url }} 
                style={{ width: '100%', height: '100%' }}
                contentFit="cover"
              />
              <TouchableOpacity 
                onPress={removeLogo}
                className="absolute bottom-2 right-2 w-9 h-9 bg-red-600/90 rounded-xl items-center justify-center border border-red-500"
              >
                <Trash2 size={16} color="white" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity 
              onPress={pickImage}
              disabled={uploading}
              className="w-36 h-36 rounded-3xl border-2 border-dashed border-slate-800 bg-slate-900/20 items-center justify-center active:bg-slate-900/40"
            >
              {uploading ? (
                <ActivityIndicator color="#3B82F6" />
              ) : (
                <>
                  <Plus size={32} color="#475569" />
                  <Text className="text-slate-500 font-bold text-xs mt-2">Add Image</Text>
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
