import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MotiView } from 'moti';
import { useAuth } from '@/contexts/AuthContext';
import { useBrand, useTheme, useBrandColors } from '@/contexts/BrandContext';
import {
  LogOut,
  User,
  Settings,
  Camera,
  Users,
  UserPlus,
  ChevronRight,
  BrainCircuit,
  Palette,
  Shield,
  Bell,
  Heart,
  CreditCard,
} from 'lucide-react-native';
import { BrandedAvatar } from '@/components/BrandedAvatar';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTabBarScroll } from '@/contexts/TabBarScrollContext';

export default function CoachProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, signOut, coach, refreshProfile, user } = useAuth();
  const { handleScroll } = useTabBarScroll();
  const { brand, canManageBrand } = useBrand();
  const colors = useBrandColors();
  const [uploading, setUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const handleSignOut = async () => {
    console.log('[Coach Logout] Initiate');
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
              console.log('[Coach Logout] Execution started');
              await signOut();
              console.log('[Coach Logout] signOut successful');
              // The root layout will automatically handle redirection to login
              // because the session is now null. We add a fallback just in case.
              router.replace('/(auth)/login');
            } catch (error) {
              console.error('Logout error:', error);
              Alert.alert('Error', 'Failed to log out. Please try again.');
            }
          },
        },
      ],
      { cancelable: true },
    );
  };

  const uploadAvatar = async (uri: string) => {
    try {
      setUploading(true);
      const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
      const filePath = `avatars/avatar-${profile?.id}-${Date.now()}.${fileExt}`;
      const res = await fetch(uri);
      const ab = await res.arrayBuffer();
      const { error: upErr } = await supabase.storage
        .from('chat-media')
        .upload(filePath, ab, {
          contentType: `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`,
          upsert: true,
        });
      if (upErr) throw upErr;
      const {
        data: { publicUrl },
      } = supabase.storage.from('chat-media').getPublicUrl(filePath);
      await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', profile?.id);
      await refreshProfile();
    } catch (e) {
      Alert.alert('Error', 'Profile update failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleEditPhoto = async () => {
    Alert.alert(
      'Profile Photo',
      'Update your profile image',
      [
        {
          text: 'Take Photo',
          onPress: async () => {
            const { status } =
              await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') return;
            const r = await ImagePicker.launchCameraAsync({
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.7,
            });
            if (!r.canceled && r.assets[0]) uploadAvatar(r.assets[0].uri);
          },
        },
        {
          text: 'Choose from Gallery',
          onPress: async () => {
            const { status } =
              await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') return;
            const r = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.7,
            });
            if (!r.canceled && r.assets[0]) uploadAvatar(r.assets[0].uri);
          },
        },
        profile?.avatar_url
          ? {
              text: 'Remove Photo',
              style: 'destructive',
              onPress: async () => {
                setUploading(true);
                await supabase
                  .from('profiles')
                  .update({ avatar_url: null })
                  .eq('id', profile?.id);
                await refreshProfile();
                setUploading(false);
              },
            }
          : null,
        { text: 'Cancel', style: 'cancel' },
      ].filter(Boolean) as any,
    );
  };

  const theme = useTheme();
  const isDarkMode = theme.isDarkMode;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <View style={{ flex: 1, paddingTop: insets.top }}>
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 140 }}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await refreshProfile();
                setRefreshing(false);
              }}
              tintColor={colors.primary}
            />
          }
        >
          {/* Profile Overview */}
          <MotiView
            from={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="items-center pt-10 pb-10 px-6"
          >
            <View className="relative">
              <View
                className="p-2 rounded-full border shadow-2xl"
                style={{ borderColor: colors.border }}
              >
                <BrandedAvatar
                  name={profile?.full_name || 'Coach'}
                  size={140}
                  imageUrl={profile?.avatar_url}
                  useBrandColor={true}
                />
              </View>
              <TouchableOpacity
                onPress={handleEditPhoto}
                disabled={uploading}
                className="absolute bottom-2 right-2 w-12 h-12 rounded-full items-center justify-center shadow-xl border-4"
                style={{
                  backgroundColor: colors.primary,
                  borderColor: colors.background,
                }}
              >
                {uploading ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Camera size={18} color="white" />
                )}
              </TouchableOpacity>
            </View>

            <Text
              className="text-3xl font-black mt-8 tracking-tight"
              style={{ color: colors.text }}
            >
              {profile?.full_name}
            </Text>
            {user?.email && (
              <Text
                className="text-sm font-medium mt-1"
                style={{ color: colors.textSecondary }}
              >
                {user.email}
              </Text>
            )}
            <View
              className="mt-3 px-4 py-1.5 rounded-full border"
              style={{
                backgroundColor: colors.surface,
                borderColor: colors.border,
              }}
            >
              <Text
                className="text-[10px] font-black uppercase tracking-[3px]"
                style={{ color: colors.primary }}
              >
                Professional Coach
              </Text>
            </View>

            {brand && (
              <View
                className="mt-8 border rounded-[32px] px-8 py-4 flex-row gap-10 items-center justify-center"
                style={{
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                }}
              >
                <View className="items-center">
                  <Text
                    className="font-black text-lg"
                    style={{ color: colors.text }}
                  >
                    {brand.name || 'Personal'}
                  </Text>
                  <Text
                    className="text-[9px] font-black uppercase tracking-widest"
                    style={{ color: colors.textSecondary }}
                  >
                    Team Brand
                  </Text>
                </View>
                <View
                  className="w-px h-6"
                  style={{ backgroundColor: colors.border }}
                />
                <View className="items-center">
                  <View className="flex-row items-center gap-2">
                    <View className="w-2 h-2 bg-emerald-500 rounded-full" />
                    <Text
                      className="font-black text-lg"
                      style={{ color: colors.text }}
                    >
                      Active
                    </Text>
                  </View>
                  <Text
                    className="text-[9px] font-black uppercase tracking-widest"
                    style={{ color: colors.textSecondary }}
                  >
                    Status
                  </Text>
                </View>
              </View>
            )}
          </MotiView>

          {/* Menu Sections */}
          <View className="px-6 space-y-4">
            <SectionLabel label="Account" color={colors.primary} />
            <ProfileMenuItem
              icon={<User size={20} color={colors.primary} />}
              label="Personal Information"
              onPress={() => router.push('/(coach)/personal-information')}
              colors={colors}
            />

            <SectionLabel label="Application" color={colors.primary} />
            <ProfileMenuItem
              icon={<Settings size={20} color={colors.textSecondary} />}
              label="App Settings"
              onPress={() => router.push('/(coach)/settings')}
              colors={colors}
            />
            <ProfileMenuItem
              icon={<BrainCircuit size={20} color="#8B5CF6" />}
              label="AI Features"
              sub="Smart scheduling & insights"
              onPress={() => router.push('/(coach)/(tabs)/ai-brain')}
              highlighted
              colors={colors}
            />

            {canManageBrand && (
              <>
                <SectionLabel label="Management" color={colors.primary} />
                <ProfileMenuItem
                  icon={<Palette size={20} color="#F59E0B" />}
                  label="Brand Settings"
                  sub="Customize app colors & logo"
                  onPress={() => router.push('/(coach)/settings/branding')}
                  highlighted
                  colors={colors}
                />
              </>
            )}

            <SectionLabel label="Clients & Team" color={colors.primary} />
            <ProfileMenuItem
              icon={<UserPlus size={20} color={colors.textSecondary} />}
              label="Invite New Client"
              onPress={() => router.push('/(coach)/invite-client')}
              colors={colors}
            />
            {coach?.is_parent_coach && (
              <ProfileMenuItem
                icon={<Users size={20} color={colors.textSecondary} />}
                label="Team Members"
                onPress={() => router.push('/(coach)/team')}
                badge="Admin Control"
                colors={colors}
              />
            )}

            {/* Log Out */}
            <TouchableOpacity
              onPress={handleSignOut}
              activeOpacity={0.6}
              className="mt-10 flex-row items-center p-6 bg-red-500/5 rounded-[36px] border border-red-500/10"
            >
              <View className="w-12 h-12 rounded-2xl bg-red-500/10 items-center justify-center mr-4">
                <LogOut size={20} color="#EF4444" />
              </View>
              <View className="flex-1">
                <Text className="text-red-500 font-black text-lg">Log Out</Text>
                <Text className="text-red-900/40 text-[10px] font-bold uppercase tracking-widest mt-0.5">
                  End current session
                </Text>
              </View>
              <ChevronRight size={20} color="#EF4444" opacity={0.3} />
            </TouchableOpacity>

            <View className="mt-16 items-center pb-10">
              <Text
                className="text-[10px] font-black uppercase tracking-[5px]"
                style={{ color: colors.textSecondary }}
              >
                Version 3.0 • Premium Coaching
              </Text>
            </View>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const SectionLabel = ({ label, color }: { label: string; color?: string }) => (
  <Text
    className="text-[10px] font-black uppercase tracking-[3px] px-1 mt-10 mb-2"
    style={{ color: color || '#64748B' }}
  >
    {label}
  </Text>
);

const ProfileMenuItem = ({
  icon,
  label,
  sub,
  onPress,
  badge,
  highlighted,
  colors,
}: any) => (
  <TouchableOpacity
    onPress={onPress}
    className="flex-row items-center p-5 rounded-[32px] border mb-3"
    style={{ backgroundColor: colors.surface, borderColor: colors.border }}
  >
    <View
      className="w-12 h-12 rounded-[18px] items-center justify-center mr-4 border"
      style={{ backgroundColor: colors.background, borderColor: colors.border }}
    >
      {icon}
    </View>
    <View className="flex-1">
      <Text className="font-bold text-base" style={{ color: colors.text }}>
        {label}
      </Text>
      {sub && (
        <Text
          className="text-[10px] font-medium mt-0.5"
          style={{ color: colors.textSecondary }}
        >
          {sub}
        </Text>
      )}
    </View>
    {badge && (
      <View className="bg-blue-600/10 border border-blue-600/20 px-3 py-1 rounded-full mr-3">
        <Text className="text-blue-500 font-black text-[9px] uppercase">
          {badge}
        </Text>
      </View>
    )}
    <ChevronRight size={18} color={colors.textSecondary} />
  </TouchableOpacity>
);
