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
import { supabase } from '@/lib/supabase';
import { sendSubCoachInvite } from '@/lib/brevo-service';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type SearchState = 'idle' | 'searching' | 'found' | 'not_found';

export default function AddSubCoachScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { coach } = useAuth();
  const { primary, secondary } = useBrandColors();
  
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
    <View className="flex-1 bg-slate-950">
      <View 
        style={{ paddingTop: insets.top + 16 }} 
        className="px-6 pb-6 flex-row items-center gap-4 border-b border-white/5 bg-slate-950"
      >
        <TouchableOpacity 
          onPress={() => router.back()} 
          className="p-2 bg-slate-900 rounded-full border border-white/5"
        >
          <ArrowLeft size={20} color="#94A3B8" />
        </TouchableOpacity>
        <View>
            <Text className="text-slate-500 text-[10px] font-black uppercase tracking-[3px]">Growth Center</Text>
            <Text className="text-white text-xl font-black tracking-tight">Expand Your Team</Text>
        </View>
      </View>

      <ScrollView className="flex-1" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          className="mx-6 mt-8 p-10 rounded-[48px] bg-blue-600/10 border border-blue-500/20 items-center overflow-hidden"
        >
            <View className="absolute top-0 right-0 p-4 opacity-10">
                <UserPlus size={120} color="#3B82F6" />
            </View>
            <View className="w-20 h-20 bg-blue-600 rounded-[30px] items-center justify-center shadow-2xl shadow-blue-500/50 mb-6 border-2 border-white/20">
                <Send size={36} color="white" fill="white" />
            </View>
            <Text className="text-white text-2xl font-black text-center tracking-tighter">Invite Collaborator</Text>
            <Text className="text-slate-400 text-center mt-3 leading-5 px-4 text-sm font-medium">
                Onboard a new coach into your ecosystem to distribute client load and scale your collective performance.
            </Text>
        </MotiView>

        <View className="px-6 mt-10">
          <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-4 ml-1">Engagement Detail</Text>
          <View className="flex-row items-center h-18 rounded-[24px] border-2 border-slate-800 bg-slate-900/50 px-5 mb-6">
            <Mail size={20} color="#94A3B8" />
            <TextInput
              style={{ fontSize: 16 }}
              className=" ml-4 h-20 text-white  font-bold"
              placeholder="coach@performance.ai"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (searchState !== 'idle') setSearchState('idle');
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholderTextColor="#475569"
              editable={!loading && searchState !== 'searching'}
            />
          </View>

          {searchState === 'idle' && (
            <TouchableOpacity
              onPress={handleSearch}
              className="h-16 bg-blue-600 rounded-[22px] flex-row items-center justify-center gap-3 shadow-xl shadow-blue-500/30 border border-white/10"
            >
              <SearchIcon size={20} color="white" strokeWidth={2.5} />
              <Text className="text-white font-black text-lg tracking-tight">Analyze Identifier</Text>
            </TouchableOpacity>
          )}

          {searchState === 'searching' && (
            <View className="py-6 items-center flex-row justify-center gap-3">
              <ActivityIndicator color="#3B82F6" />
              <Text className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Querying Neural Roster...</Text>
            </View>
          )}

          <AnimatePresence>
            {searchState === 'found' && foundCoach && (
              <MotiView
                from={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-4 p-8 rounded-[40px] bg-emerald-500/10 border border-emerald-500/20"
              >
                <View className="flex-row items-center gap-3 mb-6">
                    <View className="w-10 h-10 rounded-2xl bg-emerald-500 items-center justify-center shadow-lg shadow-emerald-500/50">
                        <Check size={20} color="white" strokeWidth={3} />
                    </View>
                    <Text className="text-white font-black text-xl tracking-tight">Identity Verified</Text>
                </View>
                
                <View className="mb-8">
                  <Text className="text-white font-black text-2xl tracking-tighter mb-1">{foundCoach.full_name}</Text>
                  <Text className="text-slate-400 font-medium mb-4">{foundCoach.email}</Text>
                  <View className="flex-row items-center gap-2">
                    <View className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <Text className="text-emerald-500 text-[10px] font-black uppercase tracking-widest">Platform Veteran</Text>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={() => handleInvite(true)}
                  disabled={loading}
                  className="h-16 bg-emerald-600 rounded-[22px] flex-row items-center justify-center gap-3 shadow-xl shadow-emerald-500/30 border border-white/10"
                >
                  {loading ? <ActivityIndicator color="white" /> : (
                      <>
                        <Send size={18} color="white" strokeWidth={2.5} />
                        <Text className="text-white font-black text-lg tracking-tight">Transmit Team Invite</Text>
                      </>
                  )}
                </TouchableOpacity>
              </MotiView>
            )}

            {searchState === 'not_found' && (
              <MotiView
                from={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-4 p-8 rounded-[40px] bg-amber-500/10 border border-amber-500/20"
              >
                <View className="flex-row items-center gap-3 mb-6">
                    <View className="w-10 h-10 rounded-2xl bg-amber-500 items-center justify-center shadow-lg shadow-amber-500/50">
                        <AlertTriangle size={20} color="white" strokeWidth={3} />
                    </View>
                    <Text className="text-white font-black text-xl tracking-tight">External Identity</Text>
                </View>
                
                <Text className="text-slate-400 font-medium leading-5 mb-8">
                  This entity is not yet registered in the core database. Would you like to transmit a registration invitation?
                </Text>

                <TouchableOpacity
                  onPress={() => handleInvite(false)}
                  disabled={loading}
                  className="h-16 bg-amber-600 rounded-[22px] flex-row items-center justify-center gap-3 shadow-xl shadow-amber-500/30 border border-white/10"
                >
                  {loading ? <ActivityIndicator color="white" /> : (
                      <>
                        <Send size={18} color="white" strokeWidth={2.5} />
                        <Text className="text-white font-black text-lg tracking-tight">Deploy Registration</Text>
                      </>
                  )}
                </TouchableOpacity>
              </MotiView>
            )}
          </AnimatePresence>

          {/* Strategic Info Box */}
          <MotiView 
            transition={{ delay: 500 }}
            from={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-12 p-8 rounded-[40px] bg-slate-900/40 border border-white/5 mb-12"
          >
            <Text className="text-white font-black text-lg tracking-tight mb-6">Onboarding Lifecycle</Text>
            
            <OnboardingStep 
                num="01" 
                title="Transmit Link" 
                desc="A secure neural handshake is dispatched via encrypted email." 
            />
            <OnboardingStep 
                num="02" 
                title="Identity Sync" 
                desc="Tapping the link establishes identity and brand alignment." 
            />
            <OnboardingStep 
                num="03" 
                title="Full Integration" 
                desc="The coach is unified with your roster, ready for deployment." 
                isLast
            />
          </MotiView>
        </View>
      </ScrollView>
    </View>
  );
}

const OnboardingStep = ({ num, title, desc, isLast }: any) => (
    <View className={`flex-row gap-5 ${isLast ? '' : 'mb-8'}`}>
        <View className="items-center">
            <View className="w-10 h-10 bg-slate-900 rounded-xl items-center justify-center border border-white/5">
                <Text className="text-blue-500 font-black text-xs">{num}</Text>
            </View>
            {!isLast && <View className="w-px flex-1 bg-slate-800 my-2" />}
        </View>
        <View className="flex-1">
            <Text className="text-white font-black text-base tracking-tight mb-1">{title}</Text>
            <Text className="text-slate-500 text-xs font-medium leading-4">{desc}</Text>
        </View>
    </View>
);
