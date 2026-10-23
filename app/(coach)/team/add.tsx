import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { 
  UserPlus, 
  Mail, 
  Search as SearchIcon, 
  Check, 
  Send, 
  AlertTriangle,
  ArrowLeft,
  ChevronRight
} from 'lucide-react-native';
import { MotiView, AnimatePresence } from 'moti';
import { useAuth } from '@/contexts/AuthContext';
import { useBrandColors } from '@/contexts/BrandContext';
import { isDarkColor } from '@/lib/theme-utils';
import { supabase } from '@/lib/supabase';
import { sendSubCoachInvite } from '@/lib/brevo-service';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type SearchState = 'idle' | 'searching' | 'found' | 'not_found';

export default function AddSubCoachScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { coach } = useAuth();
  const colors = useBrandColors();
  const isDarkMode = isDarkColor(colors.background || '#010417');
  
  const [email, setEmail] = useState('');
  const [searchState, setSearchState] = useState<SearchState>('idle');
  const [loading, setLoading] = useState(false);
  const [foundCoach, setFoundCoach] = useState<any>(null);

  const handleSearch = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter an email address');
      return;
    }

    setSearchState('searching');
    setFoundCoach(null);

    try {
      const { data: searchResult, error: searchError } = await supabase
        .rpc('find_coach_by_email', { p_email: email.trim().toLowerCase() });

      if (searchError) throw searchError;

      if (searchResult && searchResult.found) {
        setFoundCoach({
          id: searchResult.coach_id,
          full_name: searchResult.full_name,
          email: email.trim().toLowerCase()
        });
        setSearchState('found');
      } else {
        setSearchState('not_found');
      }
    } catch (error: any) {
      console.error('[AddSubCoach] Search error:', error);
      Alert.alert('Error', 'Failed to search for coach');
      setSearchState('idle');
    }
  };

  const sendInviteEmail = async (inviteData: any, isRegistered: boolean) => {
    setLoading(true);
    try {
      const emailResult = await sendSubCoachInvite({
        inviteEmail: inviteData.invite_email,
        inviteToken: inviteData.invite_token,
        parentCoachName: inviteData.parent_coach_name,
        expiresAt: inviteData.expires_at,
        isRegistered: isRegistered
      });

      if (!emailResult.success) {
        Alert.alert(
          'Invite Link Ready',
          'The invite link is valid, but the email failed to send. You can still share the link manually from the team management page.',
          [{ text: 'OK', onPress: () => router.back() }]
        );
      } else {
        Alert.alert(
          'Success! ✅',
          `An invitation has been sent to ${email.trim().toLowerCase()}. They will join your team as soon as they accept the invite.`,
          [{ text: 'Great!', onPress: () => router.back() }]
        );
      }
    } catch (error: any) {
      console.error('[AddSubCoach] Email error:', error);
      Alert.alert('Error', 'Failed to send invitation email');
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (isRegistered: boolean) => {
    setLoading(true);

    try {
      const { data, error } = await supabase.rpc('generate_subcoach_invite', {
        p_parent_coach_id: coach?.id,
        p_invite_email: email.trim().toLowerCase(),
      });

      if (error) throw error;

      if (!data || !data.success) {
        throw new Error(data?.message || 'Failed to generate invite');
      }

      if (data.active_exists) {
        setLoading(false);
        Alert.alert(
          'Active Invite Exists',
          'An active invite already exists for this email. Do you want to resend it?',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Resend Invite', 
              onPress: () => sendInviteEmail(data, isRegistered) 
            }
          ]
        );
        return;
      }

      await sendInviteEmail(data, isRegistered);
      
    } catch (error: any) {
      console.error('[AddSubCoach] Invite error:', error);
      Alert.alert('Error', error.message || 'Failed to process invitation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      {/* Header */}
      <View 
        style={{ 
          paddingTop: insets.top + 16,
          backgroundColor: colors.background,
          borderBottomColor: colors.border,
        }} 
        className="px-6 pb-6 flex-row items-center gap-4 border-b"
      >
        <TouchableOpacity 
          onPress={() => router.back()} 
          style={{ backgroundColor: colors.surface, borderColor: colors.border }}
          className="p-2.5 rounded-full border"
          activeOpacity={0.7}
        >
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>
        <View>
          <Text style={{ color: colors.textSecondary }} className="text-[10px] font-black uppercase tracking-[3px]">
            Team
          </Text>
          <Text style={{ color: colors.text }} className="text-xl font-black tracking-tight">
            Add Coach
          </Text>
        </View>
      </View>

      <ScrollView className="flex-1" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          style={{ 
            backgroundColor: colors.surface,
            borderColor: colors.border,
          }}
          className="mx-6 mt-8 p-8 rounded-[40px] border items-center overflow-hidden shadow-sm"
        >
          <View className="absolute top-0 right-0 p-4 opacity-10">
            <UserPlus size={120} color={colors.primary} />
          </View>
          <View 
            style={{ backgroundColor: colors.primary }}
            className="w-16 h-16 rounded-[24px] items-center justify-center mb-5 shadow-lg"
          >
            <Send size={28} color={colors.textOnPrimary} fill={colors.textOnPrimary} />
          </View>
          <Text style={{ color: colors.text }} className="text-2xl font-black text-center tracking-tight">
            Invite Coach
          </Text>
          <Text style={{ color: colors.textSecondary }} className="text-center mt-2.5 leading-5 px-4 text-sm font-medium">
            Invite a coach to join your coaching team.
          </Text>
        </MotiView>

        <View className="px-6 mt-8">
          <Text style={{ color: colors.textSecondary }} className="text-[10px] font-black uppercase tracking-widest mb-3 ml-1">
            Coach Email
          </Text>
          <View 
            style={{ backgroundColor: colors.surface, borderColor: colors.border }}
            className="flex-row items-center h-16 rounded-[22px] border-2 px-5 mb-5"
          >
            <Mail size={20} color={colors.textSecondary} />
            <TextInput
              style={{ fontSize: 16, color: colors.text }}
              className="ml-3 flex-1 font-bold"
              placeholder="coach@example.com"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (searchState !== 'idle') setSearchState('idle');
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholderTextColor={colors.textTertiary}
              editable={!loading && searchState !== 'searching'}
            />
          </View>

          {searchState === 'idle' && (
            <TouchableOpacity
              onPress={handleSearch}
              style={{ backgroundColor: colors.primary }}
              className="h-16 rounded-[22px] flex-row items-center justify-center gap-3 shadow-lg"
              activeOpacity={0.85}
            >
              <SearchIcon size={20} color={colors.textOnPrimary} strokeWidth={2.5} />
              <Text style={{ color: colors.textOnPrimary }} className="font-black text-base tracking-tight">
                Find Coach
              </Text>
            </TouchableOpacity>
          )}

          {searchState === 'searching' && (
            <View className="py-6 items-center flex-row justify-center gap-3">
              <ActivityIndicator color={colors.primary} />
              <Text style={{ color: colors.textSecondary }} className="font-bold uppercase tracking-widest text-[10px]">
                Searching for coach...
              </Text>
            </View>
          )}

          <AnimatePresence>
            {searchState === 'found' && foundCoach && (
              <MotiView
                from={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{ 
                  backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.12)' : '#F0FDF4',
                  borderColor: isDarkMode ? 'rgba(16, 185, 129, 0.3)' : '#BBF7D0',
                }}
                className="mt-4 p-7 rounded-[36px] border shadow-sm"
              >
                <View className="flex-row items-center gap-3 mb-5">
                  <View 
                    style={{ backgroundColor: colors.success || '#10B981' }}
                    className="w-10 h-10 rounded-2xl items-center justify-center shadow-md"
                  >
                    <Check size={20} color="white" strokeWidth={3} />
                  </View>
                  <Text style={{ color: colors.text }} className="font-black text-xl tracking-tight">
                    Coach Found
                  </Text>
                </View>
                
                <View className="mb-6">
                  <Text style={{ color: colors.text }} className="font-black text-2xl tracking-tight mb-1">
                    {foundCoach.full_name}
                  </Text>
                  <Text style={{ color: colors.textSecondary }} className="font-medium mb-3">
                    {foundCoach.email}
                  </Text>
                  <View className="flex-row items-center gap-2">
                    <View style={{ backgroundColor: colors.success || '#10B981' }} className="w-2 h-2 rounded-full" />
                    <Text style={{ color: colors.success || '#10B981' }} className="text-[10px] font-black uppercase tracking-widest">
                      Active Coach
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={() => handleInvite(true)}
                  disabled={loading}
                  style={{ backgroundColor: colors.success || '#10B981' }}
                  className="h-16 rounded-[22px] flex-row items-center justify-center gap-3 shadow-lg"
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <>
                      <Send size={18} color="white" strokeWidth={2.5} />
                      <Text className="text-white font-black text-base tracking-tight">
                        Send Team Invite
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </MotiView>
            )}

            {searchState === 'not_found' && (
              <MotiView
                from={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{ 
                  backgroundColor: isDarkMode ? 'rgba(245, 158, 11, 0.12)' : '#FFFBEB',
                  borderColor: isDarkMode ? 'rgba(245, 158, 11, 0.3)' : '#FDE68A',
                }}
                className="mt-4 p-7 rounded-[36px] border shadow-sm"
              >
                <View className="flex-row items-center gap-3 mb-5">
                  <View className="w-10 h-10 rounded-2xl bg-amber-500 items-center justify-center shadow-md">
                    <AlertTriangle size={20} color="white" strokeWidth={3} />
                  </View>
                  <Text style={{ color: colors.text }} className="font-black text-xl tracking-tight">
                    New Coach
                  </Text>
                </View>
                
                <Text style={{ color: colors.textSecondary }} className="font-medium leading-5 mb-6">
                  This coach doesn't have an account yet. Send them an invite to create an account and join your team.
                </Text>

                <TouchableOpacity
                  onPress={() => handleInvite(false)}
                  disabled={loading}
                  style={{ backgroundColor: colors.primary }}
                  className="h-16 rounded-[22px] flex-row items-center justify-center gap-3 shadow-lg"
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator color={colors.textOnPrimary} />
                  ) : (
                    <>
                      <Send size={18} color={colors.textOnPrimary} strokeWidth={2.5} />
                      <Text style={{ color: colors.textOnPrimary }} className="font-black text-base tracking-tight">
                        Send Invite
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </MotiView>
            )}
          </AnimatePresence>

          {/* Info Box */}
          <MotiView 
            transition={{ delay: 300 }}
            from={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ 
              backgroundColor: colors.surface,
              borderColor: colors.border,
            }}
            className="mt-10 p-7 rounded-[36px] border mb-12 shadow-sm"
          >
            <Text style={{ color: colors.text }} className="font-black text-lg tracking-tight mb-6">
              How it works
            </Text>
            
            <OnboardingStep 
              num="01" 
              title="Send invite" 
              desc="We email the coach a link to join your team." 
              colors={colors}
            />
            <OnboardingStep 
              num="02" 
              title="Coach accepts" 
              desc="The coach opens the link and accepts your invite." 
              colors={colors}
            />
            <OnboardingStep 
              num="03" 
              title="Joined to team" 
              desc="They join your team and you can assign clients to them." 
              colors={colors}
              isLast
            />
          </MotiView>
        </View>
      </ScrollView>
    </View>
  );
}

const OnboardingStep = ({ num, title, desc, isLast, colors }: any) => (
  <View className={`flex-row gap-5 ${isLast ? '' : 'mb-6'}`}>
    <View className="items-center">
      <View 
        style={{ backgroundColor: colors.surface, borderColor: colors.border }}
        className="w-10 h-10 rounded-xl items-center justify-center border"
      >
        <Text style={{ color: colors.primary }} className="font-black text-xs">{num}</Text>
      </View>
      {!isLast && <View style={{ backgroundColor: colors.border }} className="w-px flex-1 my-2" />}
    </View>
    <View className="flex-1 mt-0.5">
      <Text style={{ color: colors.text }} className="font-black text-base tracking-tight mb-1">{title}</Text>
      <Text style={{ color: colors.textSecondary }} className="text-xs font-medium leading-4">{desc}</Text>
    </View>
  </View>
);
