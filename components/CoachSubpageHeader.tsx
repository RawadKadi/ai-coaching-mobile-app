import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/BrandContext';
import { BrandedAvatar } from '@/components/BrandedAvatar';

interface CoachSubpageHeaderProps {
  title: string;
  subtitle?: string;
  avatarUrl?: string | null;
  clientName?: string;
  right?: React.ReactNode;
}

/**
 * Header used on pages that open from the client details page
 * (Challenges, Check-ins, Sessions). Same look as the other sub pages.
 */
export default function CoachSubpageHeader({
  title,
  subtitle,
  avatarUrl,
  clientName,
  right,
}: CoachSubpageHeaderProps) {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const colors = theme.colors;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: insets.top + 16,
        paddingBottom: 16,
        paddingHorizontal: 24,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 }}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Go back"
          activeOpacity={0.7}
          onPress={() => router.back()}
          style={{
            width: 40,
            height: 40,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            backgroundColor: colors.surface,
            borderColor: colors.border,
          }}
        >
          <ArrowLeft size={18} color={colors.text} />
        </TouchableOpacity>

        <BrandedAvatar
          name={clientName || subtitle || 'Client'}
          size={40}
          imageUrl={avatarUrl || undefined}
        />

        <View style={{ flex: 1 }}>
          <Text
            numberOfLines={1}
            style={{ color: colors.text, fontSize: 18, fontWeight: '900', letterSpacing: -0.4 }}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              numberOfLines={1}
              style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '500' }}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      {right}
    </View>
  );
}
