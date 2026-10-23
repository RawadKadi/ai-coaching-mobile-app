import { useBrandColors, useTheme } from '@/contexts/BrandContext';
import { isDarkColor } from '@/lib/theme-utils';
import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { ChevronLeft, User, Mail, Phone, Globe, Calendar, Activity, Ruler, Target, Trophy, Info, AlertTriangle } from 'lucide-react-native';
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

const TagList = ({ 
  icon, 
  label, 
  tags, 
  colors,
  isLast 
}: { 
  icon: React.ReactNode, 
  label: string, 
  tags: string[] | undefined, 
  colors: any,
  isLast?: boolean 
}) => (
  <View 
    style={{ borderBottomColor: colors.border, borderBottomWidth: !isLast ? 1 : 0 }}
    className="py-4"
  >
    <View className="flex-row items-center mb-3">
      <View 
        style={{ backgroundColor: `${colors.primary}15`, borderColor: colors.border, borderWidth: 1 }}
        className="w-9 h-9 rounded-full items-center justify-center mr-4"
      >
        {icon}
      </View>
      <Text style={{ color: colors.textSecondary }} className="text-xs font-bold uppercase tracking-wider">
        {label}
      </Text>
    </View>
    <View className="flex-row flex-wrap gap-2 ml-12">
      {(!tags || tags.length === 0) ? (
        <Text style={{ color: colors.textSecondary }} className="text-sm font-medium">
          None specified
        </Text>
      ) : (
        tags.map((tag, idx) => (
          <View 
            key={idx} 
            style={{ backgroundColor: `${colors.primary}12`, borderColor: `${colors.primary}25`, borderWidth: 1 }}
            className="px-3 py-1.5 rounded-full"
          >
            <Text style={{ color: colors.primary }} className="text-xs font-bold capitalize">
              {tag}
            </Text>
          </View>
        ))
      )}
    </View>
  </View>
);

export default function PersonalInformationScreen() {
  const theme = useTheme();
  const colors = theme.colors;
  const isDark = isDarkColor(colors.background || '#020617');
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, client, user } = useAuth();

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
            onPress={() => safeBack('/(client)/(tabs)/profile')}
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
              This information helps your coach tailor your plan.
            </Text>
          </View>

          {/* Account Info */}
          <View 
            style={{ backgroundColor: colors.surface, borderColor: colors.border }}
            className="rounded-[32px] p-5 border mb-6"
          >
            <Text style={{ color: colors.text }} className="font-black text-lg mb-2 ml-1">
              Account
            </Text>
            <InfoRow colors={colors} icon={<User size={16} color={colors.primary} />} label="Full Name" value={profile?.full_name} />
            <InfoRow colors={colors} icon={<Mail size={16} color={colors.primary} />} label="Email" value={user?.email} />
            <InfoRow colors={colors} icon={<Phone size={16} color={colors.primary} />} label="Phone" value={profile?.phone} />
            <InfoRow colors={colors} icon={<Globe size={16} color={colors.primary} />} label="Timezone" value={profile?.timezone} isLast />
          </View>

          {/* Physical Profile */}
          <View 
            style={{ backgroundColor: colors.surface, borderColor: colors.border }}
            className="rounded-[32px] p-5 border mb-6"
          >
            <Text style={{ color: colors.text }} className="font-black text-lg mb-2 ml-1">
              Physical Profile
            </Text>
            <InfoRow colors={colors} icon={<Calendar size={16} color={colors.primary} />} label="Date of Birth" value={client?.date_of_birth} />
            <InfoRow colors={colors} icon={<Activity size={16} color={colors.primary} />} label="Gender" value={client?.gender} />
            <InfoRow 
              colors={colors} 
              icon={<Ruler size={16} color={colors.primary} />} 
              label="Height" 
              value={client?.height_cm ? `${client.height_cm} cm` : 'Not provided'} 
              isLast 
            />
          </View>

          {/* Fitness Journey */}
          <View 
            style={{ backgroundColor: colors.surface, borderColor: colors.border }}
            className="rounded-[32px] p-5 border mb-6"
          >
            <Text style={{ color: colors.text }} className="font-black text-lg mb-2 ml-1">
              Fitness Journey
            </Text>
            <InfoRow colors={colors} icon={<Target size={16} color={colors.primary} />} label="Primary Goal" value={client?.goal} />
            <InfoRow 
              colors={colors} 
              icon={<Trophy size={16} color={colors.primary} />} 
              label="Experience Level" 
              value={client?.experience_level} 
              isLast 
            />
          </View>

          {/* Health & Nutrition */}
          <View 
            style={{ backgroundColor: colors.surface, borderColor: colors.border }}
            className="rounded-[32px] p-5 border mb-6"
          >
            <Text style={{ color: colors.text }} className="font-black text-lg mb-2 ml-1">
              Health Context
            </Text>
            <TagList 
              colors={colors}
              icon={<Info size={16} color={colors.primary} />} 
              label="Dietary Restrictions" 
              tags={client?.dietary_restrictions} 
            />
            <TagList 
              colors={colors}
              icon={<AlertTriangle size={16} color={colors.primary} />} 
              label="Medical Conditions" 
              tags={client?.medical_conditions} 
              isLast={true}
            />
          </View>
          
          <View className="items-center mb-10 mt-4">
            <Text style={{ color: colors.textSecondary }} className="text-xs font-medium text-center px-4">
              To update these details, please contact your coach directly.
            </Text>
          </View>

        </ScrollView>
      </View>
    </View>
  );
}
