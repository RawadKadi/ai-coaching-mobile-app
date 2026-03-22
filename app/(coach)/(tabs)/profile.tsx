import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { MotiView } from 'moti';
import { useAuth } from '@/contexts/AuthContext';
import { useBrand, useTheme } from '@/contexts/BrandContext';
import { LogOut, Settings, Camera, Users, UserPlus, ChevronRight, BrainCircuit, Palette, Shield, Bell } from 'lucide-react-native';
import { BrandedAvatar } from '@/components/BrandedAvatar';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';

export default function CoachProfileScreen() {
  const router = useRouter();
  const { profile, signOut, coach, refreshProfile } = useAuth();
  const { brand, canManageBrand } = useBrand();
  const [uploading, setUploading] = useState(false);

  const handleSignOut = async () => {
    Alert.alert('Terminate Session', 'Clearance data will be purged locally.', [
      { text: 'Abort', style: 'cancel' },
      { text: 'Terminate', style: 'destructive', onPress: async () => { await signOut(); router.replace('/(auth)/login'); } }
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
    } catch (e) { Alert.alert('Error', 'Upload failed.'); } finally { setUploading(false); }
  };

  const handleEditPhoto = async () => {
    Alert.alert('Identity Visual', 'Update commander photo', [
      { text: 'Camera Shot', onPress: async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') return;
        const r = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.7 });
        if (!r.canceled && r.assets[0]) uploadAvatar(r.assets[0].uri);
      }},
      { text: 'From Library', onPress: async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') return;
        const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.7 });
        if (!r.canceled && r.assets[0]) uploadAvatar(r.assets[0].uri);
      }},
      profile?.avatar_url ? { text: 'Purge Visual', style: 'destructive' as any, onPress: async () => {
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
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flex: 1 }}>
          <ScrollView 
              style={{ flex: 1 }}
              showsVerticalScrollIndicator={false} 
              contentContainerStyle={{ paddingBottom: 120 }}
          >
            {/* Identity Hero */}
            <MotiView from={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} className="items-center pt-12 pb-10 px-6">
              <View className="relative">
                <View className="p-1.5 rounded-full border-2 border-blue-600/20 shadow-2xl shadow-blue-500/10">
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

              <Text className="text-white text-2xl font-black mt-6">{profile?.full_name}</Text>
              <View className="mt-2 bg-blue-600/10 px-4 py-1.5 rounded-full border border-blue-600/20">
                <Text className="text-blue-500 text-[10px] font-black uppercase tracking-widest">Coaching Commander</Text>
              </View>

              {/* Quick Stats */}
              {brand && (
                <View className="mt-6 bg-slate-900/50 border border-slate-900 rounded-[24px] px-6 py-3 flex-row gap-8">
                  <View className="items-center">
                    <Text className="text-white font-black text-lg">{brand.name || '—'}</Text>
                    <Text className="text-slate-600 text-[9px] font-black uppercase tracking-widest">Brand</Text>
                  </View>
                  <View className="w-px bg-slate-900" />
                  <View className="items-center">
                    <View className="w-2 h-2 bg-emerald-500 rounded-full mb-1" />
                    <Text className="text-slate-600 text-[9px] font-black uppercase tracking-widest">ONLINE</Text>
                  </View>
                </View>
              )}
            </MotiView>

            {/* Command Menu */}
            <View className="px-6 space-y-3">
              <SectionLabel label="Operations" />
              <ProfileMenuItem icon={<Settings size={20} color="#94A3B8" />} label="System Configuration" onPress={() => router.push('/(coach)/settings')} />
              <ProfileMenuItem icon={<BrainCircuit size={20} color="#8B5CF6" />} label="AI Neural Engine" onPress={() => router.push('/(coach)/settings/ai-brain')} highlighted />

              {canManageBrand && (
                <>
                  <SectionLabel label="Brand Identity" />
                  <ProfileMenuItem icon={<Palette size={20} color="#94A3B8" />} label="Brand Studio" onPress={() => router.push('/(coach)/settings/brand')} />
                </>
              )}

              <SectionLabel label="Unit Management" />
              <ProfileMenuItem icon={<UserPlus size={20} color="#94A3B8" />} label="Enlist New Unit" onPress={() => router.push('/(coach)/invite-client')} />
              {coach?.is_parent_coach && (
                <ProfileMenuItem icon={<Users size={20} color="#94A3B8" />} label="Team Command" onPress={() => router.push('/(coach)/team')} badge="Parent" />
              )}

              <SectionLabel label="Security" />
              <ProfileMenuItem icon={<Shield size={20} color="#94A3B8" />} label="Clearance Level" />
              <ProfileMenuItem icon={<Bell size={20} color="#94A3B8" />} label="Alert Channels" />

              {/* Terminate */}
              <TouchableOpacity
                onPress={handleSignOut}
                className="mt-8 flex-row items-center p-6 bg-red-500/5 rounded-[32px] border border-red-500/20"
              >
                <View className="w-10 h-10 rounded-xl bg-red-500/10 items-center justify-center mr-4">
                  <LogOut size={20} color="#EF4444" />
                </View>
                <View className="flex-1">
                  <Text className="text-red-500 font-black text-base">Terminate Session</Text>
                  <Text className="text-red-900/40 text-[10px] font-bold uppercase mt-0.5">Purge local clearance</Text>
                </View>
                <ChevronRight size={20} color="#EF4444" opacity={0.3} />
              </TouchableOpacity>

              <View className="mt-12 items-center pb-4">
                <Text className="text-slate-800 text-[10px] font-black uppercase tracking-[4px]">V3.0.Neural-Sync • Coach Build</Text>
              </View>
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    </View>
  );
}

const SectionLabel = ({ label }: { label: string }) => (
  <Text className="text-slate-600 text-[10px] font-black uppercase tracking-widest px-1 mt-8 mb-2">{label}</Text>
);

const ProfileMenuItem = ({ icon, label, onPress, badge, highlighted }: any) => (
  <TouchableOpacity
    onPress={onPress}
    className={`flex-row items-center p-5 rounded-[28px] border mb-2 ${highlighted ? 'bg-violet-600/5 border-violet-600/20' : 'bg-slate-900/30 border-slate-900'}`}
  >
    <View className={`w-10 h-10 rounded-xl items-center justify-center mr-4 border ${highlighted ? 'bg-violet-900/20 border-violet-700/30' : 'bg-slate-950 border-slate-800'}`}>
      {icon}
    </View>
    <Text className={`flex-1 font-bold text-base ${highlighted ? 'text-violet-400' : 'text-slate-300'}`}>{label}</Text>
    {badge && (
      <View className="bg-blue-600/10 border border-blue-600/20 px-2 py-0.5 rounded-full mr-3">
        <Text className="text-blue-500 font-black text-[9px] uppercase">{badge}</Text>
      </View>
    )}
    <ChevronRight size={18} color="#334155" />
  </TouchableOpacity>
);
