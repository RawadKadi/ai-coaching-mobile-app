import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, ActivityIndicator, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { MotiView } from 'moti';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/BrandContext';
import { LogOut, User, Settings, Camera, Shield, Bell, CreditCard, ChevronRight } from 'lucide-react-native';
import { BrandedAvatar } from '@/components/BrandedAvatar';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';

export default function ProfileScreen() {
  const router = useRouter();
  const { profile, signOut, refreshProfile } = useAuth();
  const theme = useTheme();
  const [uploading, setUploading] = useState(false);

  const handleSignOut = async () => {
    try {
      await signOut();
      router.replace('/(auth)/login');
    } catch (error) { console.error(error); }
  };

  const uploadAvatar = async (uri: string) => {
    try {
      setUploading(true);
      const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `avatar-${profile?.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;
      const response = await fetch(uri);
      const arrayBuffer = await response.arrayBuffer();

      const { error: uploadError } = await supabase.storage.from('chat-media').upload(filePath, arrayBuffer, {
        contentType: `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`,
        upsert: true,
      });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('chat-media').getPublicUrl(filePath);
      const { error: updateError } = await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', profile?.id);
      if (updateError) throw updateError;

      await refreshProfile();
      Alert.alert('Success', 'Neural identity updated.');
    } catch (error) { Alert.alert('Error', 'Failed to update avatar.'); } finally { setUploading(false); }
  };

  const handleEditPhoto = async () => {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') return Alert.alert('Permission Required', 'Access needed.');
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (!result.canceled && result.assets[0].uri) uploadAvatar(result.assets[0].uri);
  };

  return (
    <View className="flex-1 bg-slate-950">
      <SafeAreaView className="flex-1">
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
            {/* Header Identity */}
            <MotiView 
                from={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="items-center mt-12 mb-10 px-6"
            >
                <View className="relative">
                    <View className="absolute inset-0 bg-blue-600/20 rounded-full blur-2xl" />
                    <View className="p-1 rounded-full border-2 border-blue-600/30">
                        <BrandedAvatar 
                        name={profile?.full_name || 'User'} 
                        size={140}
                        imageUrl={profile?.avatar_url}
                        />
                    </View>
                    <TouchableOpacity 
                        onPress={handleEditPhoto}
                        disabled={uploading}
                        className="absolute bottom-2 right-2 w-10 h-10 bg-blue-600 rounded-full items-center justify-center border-4 border-slate-950 shadow-lg shadow-blue-500/40"
                    >
                        {uploading ? <ActivityIndicator size="small" color="white" /> : <Camera size={18} color="white" />}
                    </TouchableOpacity>
                </View>

                <Text className="text-white text-2xl font-black mt-6 leading-tight">{profile?.full_name}</Text>
                <View className="mt-2 bg-blue-600/10 px-4 py-1.5 rounded-full border border-blue-600/20">
                    <Text className="text-blue-500 text-[10px] font-black uppercase tracking-widest">Protocol Member</Text>
                </View>
            </MotiView>

            {/* Menu Sections */}
            <View className="px-6 space-y-3 pb-12">
                <SectionLabel label="Account Sync" />
                <ProfileMenuItem icon={<User size={20} color="#94A3B8" />} label="Identity Details" />
                <ProfileMenuItem icon={<Shield size={20} color="#94A3B8" />} label="Security & Core" />
                
                <SectionLabel label="Interface" />
                <ProfileMenuItem icon={<Bell size={20} color="#94A3B8" />} label="Neuromorphic Alerts" />
                <ProfileMenuItem icon={<Settings size={20} color="#94A3B8" />} label="Engine Preferences" />

                <SectionLabel label="Billing" />
                <ProfileMenuItem icon={<CreditCard size={20} color="#94A3B8" />} label="Payment Methods" />

                {/* Terminate Session */}
                <TouchableOpacity 
                    onPress={handleSignOut}
                    className="mt-10 flex-row items-center p-6 bg-red-500/5 rounded-[32px] border border-red-500/20"
                >
                    <View className="w-10 h-10 rounded-xl bg-red-500/10 items-center justify-center mr-4">
                        <LogOut size={20} color="#EF4444" />
                    </View>
                    <View className="flex-1">
                        <Text className="text-red-500 font-black text-base">Terminate Session</Text>
                        <Text className="text-red-900/40 text-[10px] font-bold uppercase mt-0.5">Clearing local cache</Text>
                    </View>
                    <ChevronRight size={20} color="#EF4444" opacity={0.3} />
                </TouchableOpacity>

                <View className="mt-12 items-center">
                    <Text className="text-slate-800 text-[10px] font-black uppercase tracking-[4px]">V3.0.Neural-Sync</Text>
                </View>
            </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const SectionLabel = ({ label }: { label: string }) => (
    <Text className="text-slate-600 text-[10px] font-black uppercase tracking-widest px-1 mt-6 mb-2">{label}</Text>
);

const ProfileMenuItem = ({ icon, label, onPress }: any) => (
    <TouchableOpacity 
        onPress={onPress}
        className="flex-row items-center p-5 bg-slate-900/30 rounded-[28px] border border-slate-900 mb-2"
    >
        <View className="w-10 h-10 rounded-xl bg-slate-950 items-center justify-center mr-4 border border-slate-800">
            {icon}
        </View>
        <Text className="flex-1 text-slate-300 font-bold text-base">{label}</Text>
        <ChevronRight size={18} color="#475569" />
    </TouchableOpacity>
);
