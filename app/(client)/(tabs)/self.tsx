import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ScrollView, ActivityIndicator, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/BrandContext';
import { LogOut, User, Settings, Camera, Shield, Bell, CreditCard, ChevronRight } from 'lucide-react-native';
import { BrandedAvatar } from '@/components/BrandedAvatar';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';

// Hoist helper components to top
const SectionLabel = ({ label }: { label: string }) => (
    <Text className="text-slate-600 text-[10px] font-black uppercase tracking-widest px-1 mt-8 mb-3">{label}</Text>
);

const ProfileMenuItem = ({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress?: () => void }) => (
    <TouchableOpacity 
        onPress={onPress}
        activeOpacity={0.7}
        className="flex-row items-center p-5 bg-slate-900/40 rounded-[28px] border border-white/5 mb-3 shadow-sm"
    >
        <View className="w-10 h-10 rounded-xl bg-slate-950 items-center justify-center mr-4 border border-white/5 shadow-inner">
            {icon}
        </View>
        <Text className="flex-1 text-slate-200 font-bold text-base tracking-tight">{label}</Text>
        <ChevronRight size={16} color="#475569" opacity={0.6} />
    </TouchableOpacity>
);

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, signOut, refreshProfile, loading: authLoading } = useAuth();
  const theme = useTheme();
  const [uploading, setUploading] = useState(false);

  const handleSignOut = async () => {
    Alert.alert(
      'Log Out', 
      'Are you sure you want to log out of your account?', 
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Log Out', 
          style: 'destructive', 
          onPress: async () => {
            try {
              await signOut();
              // The root layout will automatically handle redirection to login 
              // because the session is now null. We add a fallback just in case.
              router.replace('/(auth)/login');
            } catch (error) {
              console.error('Logout error:', error);
              Alert.alert('Error', 'Failed to log out. Please try again.');
            }
          }
        }
      ]
    );
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
      Alert.alert('Success', 'Profile updated.');
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

  if (authLoading) {
    return (
      <View className="flex-1 bg-slate-950 items-center justify-center">
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-950">
      <StatusBar barStyle="light-content" translucent />
      <View style={{ flex: 1, paddingTop: insets.top }}>
        <ScrollView 
          className="flex-1 px-6" 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 140 }}
        >
            {/* Header Identity */}
            <View className="items-center mt-12 mb-10">
                <View className="relative">
                    <View className="absolute inset-0 bg-blue-600/30 rounded-full blur-3xl opacity-50" />
                    <View className="p-1 rounded-full border-2 border-blue-600/30">
                        <BrandedAvatar 
                          name={profile?.full_name || 'User'} 
                          size={130}
                          imageUrl={profile?.avatar_url}
                        />
                    </View>
                    <TouchableOpacity 
                        onPress={handleEditPhoto}
                        disabled={uploading}
                        className="absolute bottom-1 right-1 w-10 h-10 bg-blue-600 rounded-full items-center justify-center border-4 border-slate-950 shadow-xl shadow-blue-500/40"
                    >
                        {uploading ? <ActivityIndicator size="small" color="white" /> : <Camera size={18} color="white" />}
                    </TouchableOpacity>
                </View>

                <Text className="text-white text-3xl font-black mt-8 leading-tight tracking-tighter">
                  {profile?.full_name || 'Member'}
                </Text>
                <View className="mt-2 bg-blue-600/10 px-4 py-1.5 rounded-full border border-blue-600/20">
                    <Text className="text-blue-500 text-[10px] font-black uppercase tracking-[3px]">Protocol Sync Active</Text>
                </View>
            </View>

            {/* Menu Sections */}
            <View className="pb-12">
                <SectionLabel label="Account" />
                <ProfileMenuItem icon={<User size={18} color="#3B82F6" />} label="Personal Information" />
                <ProfileMenuItem icon={<Shield size={18} color="#3B82F6" />} label="Security" />
                
                <SectionLabel label="Preferences" />
                <ProfileMenuItem icon={<Bell size={18} color="#34D399" />} label="Notifications" />
                <ProfileMenuItem icon={<Settings size={18} color="#64748B" />} label="App Settings" />

                <SectionLabel label="Billing" />
                <ProfileMenuItem icon={<CreditCard size={18} color="#F59E0B" />} label="Payments" />

                {/* Logout */}
                <TouchableOpacity 
                    onPress={handleSignOut}
                    className="mt-10 flex-row items-center p-6 bg-red-500/10 rounded-[32px] border border-red-500/20"
                >
                    <View className="w-10 h-10 rounded-xl bg-red-500/10 items-center justify-center mr-4">
                        <LogOut size={20} color="#EF4444" />
                    </View>
                    <View className="flex-1">
                        <Text className="text-red-500 font-black text-base tracking-tight">Logout</Text>
                        <Text className="text-red-900/60 text-[9px] font-black uppercase tracking-widest mt-0.5">Disconnect Session</Text>
                    </View>
                    <ChevronRight size={18} color="#EF4444" opacity={0.4} />
                </TouchableOpacity>

                <View className="mt-12 items-center">
                    <Text className="text-slate-800 text-[9px] font-black uppercase tracking-[6px] opacity-50">V3.0.Neural-Sync</Text>
                </View>
            </View>
        </ScrollView>
      </View>
    </View>
  );
}
