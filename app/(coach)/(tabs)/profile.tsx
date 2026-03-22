import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator, SafeAreaView, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { MotiView } from 'moti';
import { useAuth } from '@/contexts/AuthContext';
import { useBrand, useTheme } from '@/contexts/BrandContext';
import { LogOut, Settings, Camera, Users, UserPlus, ChevronRight, BrainCircuit, Palette, Shield, Bell, Heart, CreditCard } from 'lucide-react-native';
import { BrandedAvatar } from '@/components/BrandedAvatar';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function CoachProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, signOut, coach, refreshProfile } = useAuth();
  const { brand, canManageBrand } = useBrand();
  const [uploading, setUploading] = useState(false);

  const handleSignOut = async () => {
    Alert.alert('Log Out', 'Are you sure you want to log out of your account?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: async () => { await signOut(); router.replace('/(auth)/login'); } }
    ]);
  };

  const uploadAvatar = async (uri: string) => {
    try {
      setUploading(true);
      const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
      const filePath = `avatars/avatar-${profile?.id}-${Date.now()}.${fileExt}`;
      const res = await fetch(uri);
      const ab = await res.arrayBuffer();
      const { error: upErr } = await supabase.storage.from('chat-media').upload(filePath, ab, { contentType: `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`, upsert: true });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from('chat-media').getPublicUrl(filePath);
      await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', profile?.id);
      await refreshProfile();
    } catch (e) { Alert.alert('Error', 'Profile update failed. Please try again.'); } finally { setUploading(false); }
  };

  const handleEditPhoto = async () => {
    Alert.alert('Profile Photo', 'Update your profile image', [
      { text: 'Take Photo', onPress: async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') return;
        const r = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.7 });
        if (!r.canceled && r.assets[0]) uploadAvatar(r.assets[0].uri);
      }},
      { text: 'Choose from Gallery', onPress: async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') return;
        const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.7 });
        if (!r.canceled && r.assets[0]) uploadAvatar(r.assets[0].uri);
      }},
      profile?.avatar_url ? { text: 'Remove Photo', style: 'destructive', onPress: async () => {
        setUploading(true);
        await supabase.from('profiles').update({ avatar_url: null }).eq('id', profile?.id);
        await refreshProfile();
        setUploading(false);
      }} : null,
      { text: 'Cancel', style: 'cancel' },
    ].filter(Boolean) as any);
  };

  return (
    <View style={{ flex: 1 }} className="bg-slate-950">
      <StatusBar barStyle="light-content" />
      <View style={{ flex: 1, paddingTop: insets.top }}>
          <ScrollView 
              style={{ flex: 1 }}
              showsVerticalScrollIndicator={false} 
              contentContainerStyle={{ paddingBottom: 140 }}
          >
            {/* Profile Overview */}
            <MotiView from={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="items-center pt-10 pb-10 px-6">
              <View className="relative">
                <View className="p-2 rounded-full border border-white/5 shadow-2xl">
                  <BrandedAvatar name={profile?.full_name || 'Coach'} size={140} imageUrl={profile?.avatar_url} useBrandColor={true} />
                </View>
                <TouchableOpacity
                  onPress={handleEditPhoto}
                  disabled={uploading}
                  className="absolute bottom-2 right-2 w-12 h-12 bg-blue-600 rounded-full items-center justify-center shadow-xl shadow-blue-500/40 border-4 border-slate-950"
                >
                  {uploading ? <ActivityIndicator size="small" color="white" /> : <Camera size={18} color="white" />}
                </TouchableOpacity>
              </View>

              <Text className="text-white text-3xl font-black mt-8 tracking-tight">{profile?.full_name}</Text>
              <View className="mt-2 bg-slate-900 px-4 py-1.5 rounded-full border border-white/5">
                <Text className="text-blue-500 text-[10px] font-black uppercase tracking-[3px]">Professional Coach</Text>
              </View>

              {brand && (
                <View className="mt-8 bg-slate-900/40 border border-white/5 rounded-[32px] px-8 py-4 flex-row gap-10 items-center justify-center">
                  <View className="items-center">
                    <Text className="text-white font-black text-lg">{brand.name || 'Personal'}</Text>
                    <Text className="text-slate-600 text-[9px] font-black uppercase tracking-widest">Team Brand</Text>
                  </View>
                  <View className="w-px h-6 bg-slate-800" />
                  <View className="items-center">
                    <View className="flex-row items-center gap-2">
                        <View className="w-2 h-2 bg-emerald-500 rounded-full" />
                        <Text className="text-white font-black text-lg">Active</Text>
                    </View>
                    <Text className="text-slate-600 text-[9px] font-black uppercase tracking-widest">Status</Text>
                  </View>
                </View>
              )}
            </MotiView>

            {/* Menu Sections */}
            <View className="px-6 space-y-4">
              <SectionLabel label="Application" />
              <ProfileMenuItem icon={<Settings size={20} color="#94A3B8" />} label="App Settings" onPress={() => router.push('/(coach)/settings')} />
              <ProfileMenuItem icon={<BrainCircuit size={20} color="#8B5CF6" />} label="AI Features" sub="Smart scheduling & insights" onPress={() => router.push('/(coach)/(tabs)/ai-brain')} highlighted />

              {canManageBrand && (
                <>
                  <SectionLabel label="Management" />
                  <ProfileMenuItem icon={<Palette size={20} color="#94A3B8" />} label="Brand Identity" onPress={() => router.push('/(coach)/settings/branding')} />
                  <ProfileMenuItem icon={<CreditCard size={20} color="#94A3B8" />} label="Subscription Plan" />
                </>
              )}

              <SectionLabel label="Clients & Team" />
              <ProfileMenuItem icon={<UserPlus size={20} color="#94A3B8" />} label="Invite New Client" onPress={() => router.push('/(coach)/invite-client')} />
              {coach?.is_parent_coach && (
                <ProfileMenuItem icon={<Users size={20} color="#94A3B8" />} label="Team Members" onPress={() => router.push('/(coach)/team')} badge="Admin Control" />
              )}

              <SectionLabel label="Security & Privacy" />
              <ProfileMenuItem icon={<Shield size={20} color="#94A3B8" />} label="Preferences" />
              <ProfileMenuItem icon={<Bell size={20} color="#94A3B8" />} label="Notifications" />

              {/* Log Out */}
              <TouchableOpacity
                onPress={handleSignOut}
                className="mt-10 flex-row items-center p-6 bg-red-500/5 rounded-[36px] border border-red-500/10"
              >
                <View className="w-12 h-12 rounded-2xl bg-red-500/10 items-center justify-center mr-4">
                  <LogOut size={20} color="#EF4444" />
                </View>
                <View className="flex-1">
                  <Text className="text-red-500 font-black text-lg">Log Out</Text>
                  <Text className="text-red-900/40 text-[10px] font-bold uppercase tracking-widest mt-0.5">End current session</Text>
                </View>
                <ChevronRight size={20} color="#EF4444" opacity={0.3} />
              </TouchableOpacity>

              <View className="mt-16 items-center pb-10">
                <Text className="text-slate-800 text-[10px] font-black uppercase tracking-[5px]">Version 3.0 • Premium Coaching</Text>
              </View>
            </View>
          </ScrollView>
      </View>
    </View>
  );
}

const SectionLabel = ({ label }: { label: string }) => (
  <Text className="text-slate-600 text-[10px] font-black uppercase tracking-[3px] px-1 mt-10 mb-2">{label}</Text>
);

const ProfileMenuItem = ({ icon, label, sub, onPress, badge, highlighted }: any) => (
  <TouchableOpacity
    onPress={onPress}
    className={`flex-row items-center p-5 rounded-[32px] border mb-3 ${highlighted ? 'bg-violet-600/5 border-violet-600/10' : 'bg-slate-900/20 border-white/5'}`}
  >
    <View className={`w-12 h-12 rounded-[18px] items-center justify-center mr-4 border ${highlighted ? 'bg-violet-900/20 border-violet-700/20' : 'bg-slate-900 border-white/5'}`}>
      {icon}
    </View>
    <View className="flex-1">
        <Text className={`font-bold text-base ${highlighted ? 'text-violet-200' : 'text-slate-200'}`}>{label}</Text>
        {sub && <Text className="text-slate-600 text-[10px] font-medium mt-0.5">{sub}</Text>}
    </View>
    {badge && (
      <View className="bg-blue-600/10 border border-blue-600/20 px-3 py-1 rounded-full mr-3">
        <Text className="text-blue-500 font-black text-[9px] uppercase">{badge}</Text>
      </View>
    )}
    <ChevronRight size={18} color="#334155" />
  </TouchableOpacity>
);
