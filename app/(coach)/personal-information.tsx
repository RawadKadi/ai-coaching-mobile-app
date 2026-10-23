import { useBrandColors, useTheme } from '@/contexts/BrandContext';
import { isDarkColor } from '@/lib/theme-utils';
import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StatusBar, Linking, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { ChevronLeft, User, Phone, Globe, Briefcase, Award, ExternalLink, Mail, Shield } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { safeBack } from '@/lib/navigation-utils';

const InfoRow = ({ 
  icon, 
  label, 
  value, 
  colors, 
  isLast 
}: { 
  icon: React.ReactNode, 
  label: string, 
  value: string | undefined | null,
  colors: any,
  isLast?: boolean
}) => (
  <View 
    style={{ borderBottomColor: colors.border, borderBottomWidth: isLast ? 0 : 1 }}
    className="flex-row items-center py-4"
  >
    <View 
      style={{ backgroundColor: `${colors.primary}15`, borderColor: colors.border, borderWidth: 1 }}
      className="w-9 h-9 rounded-full items-center justify-center mr-4"
    >
      {icon}
    </View>
    <View className="flex-1">
      <Text style={{ color: colors.textSecondary }} className="text-xs font-bold uppercase tracking-wider">
        {label}
      </Text>
      <Text style={{ color: colors.text }} className="text-base font-semibold mt-1">
        {value || 'Not provided'}
      </Text>
    </View>
  </View>
);

export default function CoachPersonalInformationScreen() {
  const theme = useTheme();
  const colors = theme.colors;
  const isDark = isDarkColor(colors.background || '#020617');
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, coach, user } = useAuth();

  const handleOpenMeeting = async () => {
    if (!coach?.meeting_link) return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const supported = await Linking.canOpenURL(coach.meeting_link);
      if (supported) {
        await Linking.openURL(coach.meeting_link);
      } else {
        Alert.alert('Cannot Open Link', 'The meeting link is invalid.');
      }
    } catch (err) {
      Alert.alert('Error', 'Could not open meeting link.');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent />
      <View style={{ flex: 1, paddingTop: insets.top }}>
        
        {/* Header */}
        <View 
          style={{ borderBottomColor: colors.border }}
          className="flex-row items-center justify-between px-6 py-4 border-b"
        >
          <TouchableOpacity 
            onPress={() => safeBack('/(coach)/(tabs)/profile')}
            style={{ backgroundColor: colors.surface, borderColor: colors.border }}
            className="w-10 h-10 rounded-full items-center justify-center border"
          >
            <ChevronLeft size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={{ color: colors.text }} className="font-black text-lg">
            Personal Info
          </Text>
          <View className="w-10" />
        </View>

        <ScrollView 
          className="flex-1 px-6 pt-6"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
        >
          <View className="mb-8">
            <Text style={{ color: colors.text }} className="text-2xl font-black mb-2 tracking-tight">
              Your Details
            </Text>
            <Text style={{ color: colors.textSecondary }} className="text-sm font-medium">
              This information represents your professional identity and public profile.
            </Text>
          </View>

          {/* Account Info */}
          <View 
            style={{ backgroundColor: colors.surface, borderColor: colors.border }}
            className="rounded-[32px] p-5 border mb-6"
          >
            <Text style={{ color: colors.text }} className="font-black text-lg mb-2 ml-1">
              Identity
            </Text>
            <InfoRow colors={colors} icon={<User size={16} color={colors.primary} />} label="Full Name" value={profile?.full_name} />
            <InfoRow colors={colors} icon={<Mail size={16} color={colors.primary} />} label="Email" value={user?.email} />
            <InfoRow colors={colors} icon={<Phone size={16} color={colors.primary} />} label="Phone" value={profile?.phone} />
            <InfoRow colors={colors} icon={<Globe size={16} color={colors.primary} />} label="Timezone" value={profile?.timezone} isLast />
          </View>

          {/* Professional Bio */}
          {coach?.bio && (
            <View 
              style={{ backgroundColor: colors.surface, borderColor: colors.border }}
              className="rounded-[32px] p-5 border mb-6"
            >
              <Text style={{ color: colors.text }} className="font-black text-lg mb-3 ml-1">
                About Me
              </Text>
              <Text style={{ color: colors.textSecondary }} className="text-sm leading-6 font-medium px-1">
                {coach.bio}
              </Text>
            </View>
          )}

          {/* Professional Profile */}
          <View 
            style={{ backgroundColor: colors.surface, borderColor: colors.border }}
            className="rounded-[32px] p-5 border mb-6"
          >
            <Text style={{ color: colors.text }} className="font-black text-lg mb-2 ml-1">
              Credentials
            </Text>
            <InfoRow colors={colors} icon={<Briefcase size={16} color={colors.primary} />} label="Business Name" value={coach?.business_name || 'Not provided'} />
            <InfoRow colors={colors} icon={<Award size={16} color={colors.primary} />} label="Specialty" value={coach?.specialty || 'Professional Coaching'} />
            <InfoRow colors={colors} icon={<Shield size={16} color={colors.primary} />} label="Subscription Plan" value={coach?.subscription_tier} isLast={!coach?.meeting_link} />
            
            {coach?.meeting_link && (
              <TouchableOpacity 
                onPress={handleOpenMeeting}
                activeOpacity={0.8}
                className="flex-row items-center py-4 mt-2"
              >
                <View 
                  style={{ backgroundColor: `${colors.primary}15`, borderColor: colors.border, borderWidth: 1 }}
                  className="w-9 h-9 rounded-full items-center justify-center mr-4"
                >
                  <ExternalLink size={16} color={colors.primary} />
                </View>
                <View className="flex-1">
                  <Text style={{ color: colors.textSecondary }} className="text-xs font-bold uppercase tracking-wider">
                    Meeting Room Link
                  </Text>
                  <Text style={{ color: colors.primary }} className="text-sm font-semibold mt-1 underline" numberOfLines={1}>
                    {coach.meeting_link}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          </View>

          <View className="items-center mb-10 mt-4">
            <Text style={{ color: colors.textSecondary }} className="text-xs font-medium text-center px-4">
              Contact our support team to update your credentials or credentials info.
            </Text>
          </View>

        </ScrollView>
      </View>
    </View>
  );
}
