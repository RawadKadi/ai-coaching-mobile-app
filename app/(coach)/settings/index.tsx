import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { useReducedMotion } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/contexts/AuthContext';
import { useBrand, useBrandColors, useTheme } from '@/contexts/BrandContext';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Palette,
  BrainCircuit,
  Video,
  ShieldCheck,
} from 'lucide-react-native';
import { safeBack } from '@/lib/navigation-utils';
import { googleMeetService } from '@/lib/google-meet-service';
import { isDarkColor } from '@/lib/theme-utils';

interface SettingsMenuItemProps {
  icon: React.ReactNode;
  label: string;
  sub?: string;
  badge?: string;
  badgeColor?: string;
  onPress?: () => void;
  colors: any;
  reduceMotion?: boolean;
  delay?: number;
}

const SettingsMenuItem = ({
  icon,
  label,
  sub,
  badge,
  badgeColor,
  onPress,
  colors,
  reduceMotion,
  delay = 0,
}: SettingsMenuItemProps) => (
  <MotiView
    from={reduceMotion ? undefined : { opacity: 0, translateY: 8 }}
    animate={{ opacity: 1, translateY: 0 }}
    transition={{ delay }}
  >
    <TouchableOpacity
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress?.();
      }}
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
            {descFormatter(sub)}
          </Text>
        )}
      </View>
      {badge && (
        <View
          className="px-3 py-1 rounded-full mr-3 border"
          style={{
            backgroundColor: `${badgeColor || colors.primary}1a`,
            borderColor: `${badgeColor || colors.primary}33`,
          }}
        >
          <Text
            style={{
              color: badgeColor || colors.primary,
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
  </MotiView>
);

const descFormatter = (text: string) => text;

const SectionLabel = ({ label, color }: { label: string; color?: string }) => (
  <Text
    className="text-[10px] font-black uppercase tracking-[3px] px-1 mt-6 mb-2"
    style={{ color: color || '#64748B' }}
  >
    {label}
  </Text>
);

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const colors = useBrandColors();
  const isDark = isDarkColor(colors.background || '#0B0F19');
  const reduceMotion = useReducedMotion();

  const { coach, refreshProfile } = useAuth();
  const { canManageBrand } = useBrand();

  const [isMeetConnected, setIsMeetConnected] = useState(false);
  const [connectingMeet, setConnectingMeet] = useState(false);

  useEffect(() => {
    checkMeetStatus();
  }, [coach]);

  const checkMeetStatus = async () => {
    if (coach) {
      const connected = await googleMeetService.isConnected(coach);
      setIsMeetConnected(connected);
    }
  };

  const handleMeetPress = async () => {
    if (!coach?.id) return;

    if (isMeetConnected) {
      Alert.alert(
        'Google Meet',
        'Google Meet is currently connected to your account.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Disconnect',
            style: 'destructive',
            onPress: async () => {
              await googleMeetService.disconnect(coach.id);
              await refreshProfile();
              setIsMeetConnected(false);
              Alert.alert('Disconnected', 'Google Meet has been disconnected.');
            },
          },
          {
            text: 'Reconnect',
            onPress: async () => {
              setConnectingMeet(true);
              const res = await googleMeetService.connect(coach.id);
              setConnectingMeet(false);
              if (res.success) {
                await refreshProfile();
                setIsMeetConnected(true);
                Alert.alert('Connected', 'Google Meet reconnected successfully.');
              } else if (res.error && res.error !== 'Authentication was cancelled') {
                Alert.alert('Error', res.error);
              }
            },
          },
        ],
      );
    } else {
      setConnectingMeet(true);
      const res = await googleMeetService.connect(coach.id);
      setConnectingMeet(false);
      if (res.success) {
        await refreshProfile();
        setIsMeetConnected(true);
        Alert.alert('Connected', 'Google Meet is now connected to your account.');
      } else if (res.error && res.error !== 'Authentication was cancelled') {
        Alert.alert('Error', res.error);
      }
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={{ flex: 1, paddingTop: insets.top }}>
        {/* Header */}
        <View
          style={{ borderBottomColor: colors.border, borderBottomWidth: 1 }}
          className="flex-row items-center justify-between px-6 py-4"
        >
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              safeBack('/(coach)/(tabs)/profile');
            }}
            style={{ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }}
            className="w-10 h-10 rounded-full items-center justify-center shadow-sm"
            activeOpacity={0.7}
          >
            <ChevronLeft size={20} color={colors.text} />
          </TouchableOpacity>

          <View className="items-center">
            <Text
              style={{ color: colors.text }}
              className="font-black text-lg tracking-tight"
            >
              Settings
            </Text>
            <Text
              style={{ color: colors.textSecondary }}
              className="text-[10px] font-bold uppercase tracking-widest mt-0.5"
            >
              Preferences
            </Text>
          </View>

          <View className="w-10" />
        </View>

        <ScrollView
          className="flex-1 px-3 pt-4"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
        >
          {/* SECTION: ACCOUNT */}
          <SectionLabel label="Account" color={colors.textSecondary} />
          <SettingsMenuItem
            icon={<ShieldCheck size={20} color={colors.primary} />}
            label="Account & Security"
            sub="Email, password, connected accounts"
            onPress={() => router.push('/(coach)/settings/security')}
            colors={colors}
            reduceMotion={reduceMotion}
            delay={40}
          />

          {/* SECTION: AVAILABILITY & SCHEDULING */}
          <SectionLabel label="Availability & Scheduling" color={colors.textSecondary} />
          <SettingsMenuItem
            icon={<Clock size={20} color={colors.primary} />}
            label="Select working hours"
            sub="Set your weekly work hours"
            onPress={() => router.push('/(coach)/settings/availability')}
            colors={colors}
            reduceMotion={reduceMotion}
            delay={80}
          />

          <SettingsMenuItem
            icon={
              connectingMeet ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Video size={20} color={isMeetConnected ? '#10B981' : colors.primary} />
              )
            }
            label="Google Meet"
            sub={
              isMeetConnected
                ? 'Auto-generates meeting links'
                : 'Connect to enable video sessions'
            }
            badge={isMeetConnected ? 'Connected' : 'Disconnected'}
            badgeColor={isMeetConnected ? '#10B981' : colors.textSecondary}
            onPress={handleMeetPress}
            colors={colors}
            reduceMotion={reduceMotion}
            delay={120}
          />

          {/* SECTION: BRANDING */}
          {(coach?.brand_id || coach?.can_manage_brand) && (
            <>
              <SectionLabel label="Branding" color={colors.textSecondary} />
              <SettingsMenuItem
                icon={<Palette size={20} color="#F59E0B" />}
                label="Brand Customization"
                sub={canManageBrand ? 'Customize colors & logo' : 'View brand settings'}
                onPress={() => router.push('/(coach)/settings/branding')}
                colors={colors}
                reduceMotion={reduceMotion}
                delay={160}
              />
            </>
          )}

          {/* SECTION: AI ASSISTANT */}
          <SectionLabel label="AI Assistant" color={colors.textSecondary} />
          <SettingsMenuItem
            icon={<BrainCircuit size={20} color="#8B5CF6" />}
            label="AI Settings"
            sub="Customize your AI coach"
            onPress={() => router.push('/(coach)/(tabs)/ai-brain')}
            colors={colors}
            reduceMotion={reduceMotion}
            delay={200}
          />
        </ScrollView>
      </View>
    </View>
  );
}
