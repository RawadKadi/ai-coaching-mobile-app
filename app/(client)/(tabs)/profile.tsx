import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
  StatusBar,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme, useBrandColors } from '@/contexts/BrandContext';
import { isDarkColor } from '@/lib/theme-utils';
import { useTabBarScroll } from '@/contexts/TabBarScrollContext';
import {
  LogOut,
  User,
  Settings,
  Camera,
  Shield,
  Bell,
  CreditCard,
  ChevronRight,
  Activity,
  TrendingUp,
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { BrandedAvatar } from '@/components/BrandedAvatar';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { useStreak } from '@/hooks/useStreak';
import StreakBadge from '@/components/StreakBadge';
import {
  isHealthSyncEnabled,
  requestHealthPermissions,
  disableHealthSync,
  syncAllHealthData,
} from '@/lib/health-service';

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
  colors,
}: {
  icon: React.ReactNode;
  label: string;
  sub?: string;
  onPress?: () => void;
  badge?: string;
  colors: any;
}) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.7}
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
      <View
        className="px-3 py-1 rounded-full mr-3 border"
        style={{
          backgroundColor: `${colors.primary}1a`,
          borderColor: `${colors.primary}33`,
        }}
      >
        <Text
          style={{
            color: colors.primary,
            fontSize: 9,
            fontWeight: '900',
            textTransform: 'uppercase',
          }}
        >
          {badge}
        </Text>
      </View>
    )}
    <ChevronRight size={18} color={colors.textSecondary} />
  </TouchableOpacity>
);

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    profile,
    client,
    signOut,
    refreshProfile,
    loading: authLoading,
    user,
  } = useAuth();
  const { handleScroll } = useTabBarScroll();
  const theme = useTheme();
  const colors = useBrandColors();
  const isDark = isDarkColor(colors.background || '#020617');
  const textColor = colors.text || (isDark ? '#FFFFFF' : '#0F172A');
  const textSecondaryColor =
    colors.textSecondary || (isDark ? '#94A3B8' : '#64748B');
  const { streak, isCold } = useStreak();

  const [uploading, setUploading] = useState(false);
  const [stepsSyncEnabled, setStepsSyncEnabled] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadSyncStatus();
  }, []);

  const loadProfileData = async () => {
    setRefreshing(true);
    await refreshProfile();
    setRefreshing(false);
  };

  const loadSyncStatus = async () => {
    try {
      const isEnabled = await isHealthSyncEnabled();
      setStepsSyncEnabled(isEnabled);
    } catch (e) {
      console.error(e);
    }
  };

  const toggleStepsSync = async () => {
    if (stepsSyncEnabled) {
      Alert.alert(
        'Disconnect Health Data',
        'Stop syncing health and activity data with your coach?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Disconnect',
            style: 'destructive',
            onPress: async () => {
              await disableHealthSync();
              setStepsSyncEnabled(false);
              await Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success,
              );
            },
          },
        ],
      );
    } else {
      const granted = await requestHealthPermissions();
      if (granted) {
        setStepsSyncEnabled(true);
        if (client?.id) {
          await syncAllHealthData(client.id);
        }
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        );
        Alert.alert('Connected', 'Health data is now syncing automatically.');
      }
    }
  };

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
              router.replace('/(auth)/login');
            } catch (error) {
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
      const fileName = `avatar-${profile?.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;
      const response = await fetch(uri);
      const arrayBuffer = await response.arrayBuffer();

      const { error: uploadError } = await supabase.storage
        .from('chat-media')
        .upload(filePath, arrayBuffer, {
          contentType: `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`,
          upsert: true,
        });
      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from('chat-media').getPublicUrl(filePath);
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', profile?.id);
      if (updateError) throw updateError;

      await refreshProfile();
      Alert.alert('Success', 'Profile photo updated.');
    } catch (error) {
      Alert.alert('Error', 'Failed to update photo.');
    } finally {
      setUploading(false);
    }
  };

  const handleEditPhoto = async () => {
    Alert.alert(
      'Profile Photo',
      'Update your profile photo',
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

  if (authLoading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
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
              onRefresh={loadProfileData}
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
                  name={profile?.full_name || 'Athlete'}
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

            <View className="flex-row items-center justify-center gap-2.5 mt-8">
              <Text
                className="text-3xl font-black tracking-tight"
                style={{ color: colors.text }}
              >
                {profile?.full_name || 'Member'}
              </Text>
              <StreakBadge
                streak={streak}
                isCold={isCold}
                isDark={isDark}
                onPress={() => {
                  router.push('/(client)/(tabs)/activity');
                }}
              />
            </View>
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
                Active Member
              </Text>
            </View>
          </MotiView>

          {/* Menu Sections */}
          <View className="px-6 space-y-4">
            <SectionLabel label="Account" color={colors.primary} />
            <ProfileMenuItem
              icon={<User size={20} color={colors.primary} />}
              label="Personal Information"
              onPress={() => router.push('/(client)/personal-information')}
              colors={colors}
            />

            <SectionLabel label="Preferences" color={colors.primary} />

            <ProfileMenuItem
              icon={<Settings size={20} color={colors.textSecondary} />}
              label="App Settings"
              onPress={() => {}}
              colors={colors}
            />
            <ProfileMenuItem
              icon={<TrendingUp size={20} color={colors.primary} />}
              label="Analytics"
              sub="View trends and activity data"
              onPress={() => router.push('/(client)/analytics')}
              colors={colors}
            />
            <ProfileMenuItem
              icon={<Activity size={20} color={colors.primary} />}
              label="Health Sync"
              sub={stepsSyncEnabled ? 'Connected' : 'Tap to connect'}
              badge={stepsSyncEnabled ? 'Connected' : undefined}
              onPress={toggleStepsSync}
              colors={colors}
            />

            <SectionLabel label="Options" color={colors.primary} />
            <ProfileMenuItem
              icon={<Shield size={20} color="#F87171" />}
              label="Reset Today's Check-in"
              onPress={async () => {
                const { error } = await supabase.rpc('reset_today_checkin');
                if (error) {
                  Alert.alert('Error', error.message);
                } else {
                  Alert.alert(
                    'Success',
                    "Today's check-in has been cleared. You can now check in again.",
                  );
                }
              }}
              colors={colors}
            />

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
                Version 3.0 • Athlete App
              </Text>
            </View>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}
