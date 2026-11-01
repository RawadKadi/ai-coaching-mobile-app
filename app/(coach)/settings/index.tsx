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

  const cardBg = isDark ? '#111827' : colors.surface;
  const cardBorder = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.08)';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background || '#0B0F19' }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={{ flex: 1, paddingTop: insets.top }}>
        {/* Header */}
        <View
          style={{ borderBottomColor: cardBorder, borderBottomWidth: 1 }}
          className="flex-row items-center justify-between px-6 py-4"
        >
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              safeBack('/(coach)/(tabs)/profile');
            }}
            style={{ backgroundColor: cardBg, borderColor: cardBorder, borderWidth: 1 }}
            className="w-10 h-10 rounded-full items-center justify-center shadow-sm"
            activeOpacity={0.7}
          >
            <ChevronLeft size={20} color={colors.text || '#FFFFFF'} />
          </TouchableOpacity>

          <View className="items-center">
            <Text
              style={{ color: colors.text || '#FFFFFF' }}
              className="font-black text-lg tracking-tight"
            >
              Settings
            </Text>
            <Text
              style={{ color: colors.textSecondary || '#94A3B8' }}
              className="text-[10px] font-bold uppercase tracking-widest mt-0.5"
            >
              Preferences
            </Text>
          </View>

          <View className="w-10" />
        </View>

        <ScrollView
          className="flex-1 px-4 pt-6"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
        >
          {/* SECTION: ACCOUNT & SECURITY */}
          <SectionLabel label="Account" color={colors.textSecondary || '#64748B'} isFirst />
          <SettingsItem
            icon={<ShieldCheck size={22} color={colors.primary} />}
            iconBg={`${colors.primary}18`}
            label="Account & Security"
            desc="Email, password, connected accounts"
            onPress={() => router.push('/(coach)/settings/security')}
            colors={colors}
            cardBg={cardBg}
            cardBorder={cardBorder}
            reduceMotion={reduceMotion}
          />

          {/* SECTION: AVAILABILITY & SCHEDULING */}
          <SectionLabel label="Availability & Scheduling" color={colors.textSecondary || '#64748B'} />
          <SettingsItem
            icon={<Clock size={22} color="#7FA7FF" />}
            iconBg="#7FA7FF20"
            label="Select working hours"
            desc="Set your weekly work hours"
            onPress={() => router.push('/(coach)/settings/availability')}
            colors={colors}
            cardBg={cardBg}
            cardBorder={cardBorder}
            reduceMotion={reduceMotion}
          />

          <SettingsItem
            icon={
              connectingMeet ? (
                <ActivityIndicator size="small" color="#34D399" />
              ) : (
                <Video size={22} color={isMeetConnected ? '#34D399' : '#94A3B8'} />
              )
            }
            iconBg={isMeetConnected ? '#34D39920' : '#94A3B820'}
            label="Google Meet"
            desc={
              isMeetConnected
                ? 'Auto-generates meeting links'
                : 'Connect to enable video sessions'
            }
            badge={isMeetConnected ? 'Connected' : 'Disconnected'}
            badgeColor={isMeetConnected ? '#34D399' : '#64748B'}
            onPress={handleMeetPress}
            colors={colors}
            cardBg={cardBg}
            cardBorder={cardBorder}
            reduceMotion={reduceMotion}
          />

          {/* SECTION: BRANDING */}
          {(coach?.brand_id || coach?.can_manage_brand) && (
            <>
              <SectionLabel label="Branding" color={colors.textSecondary || '#64748B'} />
              <SettingsItem
                icon={<Palette size={22} color="#F59E0B" />}
                iconBg="#F59E0B20"
                label="Brand Customization"
                desc={canManageBrand ? 'Customize colors & logo' : 'View brand settings'}
                onPress={() => router.push('/(coach)/settings/branding')}
                colors={colors}
                cardBg={cardBg}
                cardBorder={cardBorder}
                reduceMotion={reduceMotion}
              />
            </>
          )}

          {/* SECTION: AI ASSISTANT */}
          <SectionLabel label="AI Assistant" color={colors.textSecondary || '#64748B'} />
          <SettingsItem
            icon={<BrainCircuit size={22} color="#8B5CF6" />}
            iconBg="#8B5CF620"
            label="AI Settings"
            desc="Customize your AI coach"
            onPress={() => router.push('/(coach)/(tabs)/ai-brain')}
            colors={colors}
            cardBg={cardBg}
            cardBorder={cardBorder}
            reduceMotion={reduceMotion}
          />
        </ScrollView>
      </View>
    </View>
  );
}

const SectionLabel = ({
  label,
  color,
  isFirst,
}: {
  label: string;
  color?: string;
  isFirst?: boolean;
}) => (
  <Text
    className={`text-[11px] font-black uppercase tracking-[2px] px-2 mb-3 ${
      isFirst ? '' : 'mt-6'
    }`}
    style={{ color: color || '#64748B' }}
  >
    {label}
  </Text>
);

const SettingsItem = ({
  icon,
  iconBg,
  label,
  desc,
  badge,
  badgeColor,
  onPress,
  colors,
  cardBg,
  cardBorder,
  reduceMotion,
}: any) => (
  <MotiView
    from={reduceMotion ? undefined : { opacity: 0, translateY: 10 }}
    animate={{ opacity: 1, translateY: 0 }}
    className="mb-3"
  >
    <TouchableOpacity
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress();
      }}
      style={{ backgroundColor: cardBg, borderColor: cardBorder, borderWidth: 1 }}
      className="flex-row items-center p-4 rounded-3xl"
      activeOpacity={0.7}
    >
      <View
        style={{ backgroundColor: iconBg, borderColor: cardBorder, borderWidth: 1 }}
        className="w-12 h-12 rounded-2xl items-center justify-center mr-3.5"
      >
        {icon}
      </View>
      <View className="flex-1 mr-2">
        <Text style={{ color: colors.text || '#FFFFFF' }} className="font-bold text-base">
          {label}
        </Text>
        {desc && (
          <Text
            style={{ color: colors.textSecondary || '#94A3B8' }}
            className="text-xs font-medium mt-0.5"
          >
            {desc}
          </Text>
        )}
      </View>
      {badge && (
        <View
          style={{
            backgroundColor: (badgeColor || '#64748B') + '20',
            borderColor: (badgeColor || '#64748B') + '40',
            borderWidth: 1,
          }}
          className="px-2.5 py-1 rounded-full mr-2"
        >
          <Text
            style={{
              color: badgeColor || '#64748B',
              fontSize: 10,
              fontWeight: '800',
              textTransform: 'uppercase',
            }}
          >
            {badge}
          </Text>
        </View>
      )}
      <ChevronRight size={18} color={colors.textSecondary || '#64748B'} />
    </TouchableOpacity>
  </MotiView>
);
