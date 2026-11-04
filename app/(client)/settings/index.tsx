import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { useReducedMotion } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import {
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  User,
  Activity,
  Bell,
} from 'lucide-react-native';
import { useBrandColors, useTheme } from '@/contexts/BrandContext';
import { isDarkColor } from '@/lib/theme-utils';
import { safeBack } from '@/lib/navigation-utils';

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
            {sub}
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

const SectionLabel = ({ label, color }: { label: string; color?: string }) => (
  <Text
    className="text-[10px] font-black uppercase tracking-[3px] px-1 mt-6 mb-2"
    style={{ color: color || '#64748B' }}
  >
    {label}
  </Text>
);

export default function ClientSettingsHub() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const colors = useBrandColors();
  const isDark = isDarkColor(colors.background || '#0B0F19');
  const reduceMotion = useReducedMotion();

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
              safeBack('/(client)/(tabs)/profile');
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

          {/* FIRST PRIORITY ROW: ACCOUNT & SECURITY */}
          <SettingsMenuItem
            icon={<ShieldCheck size={20} color={colors.primary} />}
            label="Account & Security"
            sub="Email, password, connected accounts"
            onPress={() => router.push('/(client)/settings/security')}
            colors={colors}
            reduceMotion={reduceMotion}
            delay={40}
          />

          {/* PERSONAL INFO */}
          <SettingsMenuItem
            icon={<User size={20} color={colors.primary} />}
            label="Personal Info"
            sub="Your profile details"
            onPress={() => router.push('/(client)/personal-information')}
            colors={colors}
            reduceMotion={reduceMotion}
            delay={80}
          />

          {/* SECTION: PREFERENCES */}
          <SectionLabel label="Preferences" color={colors.textSecondary} />

          {/* HEALTH SYNC */}
          <SettingsMenuItem
            icon={<Activity size={20} color={colors.primary} />}
            label="Health Sync"
            sub="Step counting and health data"
            onPress={() => router.push('/(client)/(tabs)/profile')}
            colors={colors}
            reduceMotion={reduceMotion}
            delay={120}
          />

          {/* NOTIFICATIONS */}
          <SettingsMenuItem
            icon={<Bell size={20} color={colors.primary} />}
            label="Notifications"
            sub="Daily reminders and messages"
            badge="On"
            badgeColor="#10B981"
            onPress={() => {}}
            colors={colors}
            reduceMotion={reduceMotion}
            delay={160}
          />
        </ScrollView>
      </View>
    </View>
  );
}
