import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Share,
  TextInput,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { MotiView, AnimatePresence } from 'moti';
import { 
  Link as LinkIcon, 
  QrCode, 
  Copy, 
  MessageCircle, 
  Mail, 
  Calendar, 
  ArrowLeft,
  Check,
  Zap,
  Smartphone,
  Users
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useBrand, useBrandColors, useTheme } from '@/contexts/BrandContext';
import { generateInviteCode } from '@/lib/brand-service';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function InviteClientScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { coach } = useAuth();
  const { brand } = useBrand();
  const { primary, secondary } = useBrandColors();
  const theme = useTheme();
  
  const [loading, setLoading] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [maxUses, setMaxUses] = useState('1');
  const [expiresInDays, setExpiresInDays] = useState('7');
  const [unlimited, setUnlimited] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    if (!coach?.id) {
      Alert.alert('Error', 'Coach information not found');
      return;
    }

    setLoading(true);

    try {
      const uses = unlimited ? 999 : parseInt(maxUses) || 1;
      const days = parseInt(expiresInDays) || 7;
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + days);

      const result = await generateInviteCode(
        coach.id,
        uses,
        expirationDate.toISOString()
      );

      if (result.success && result.code) {
        setInviteCode(result.code);
      } else {
        Alert.alert('Error', result.error || 'Failed to generate invite code');
      }
    } catch (error: any) {
      console.error('[InviteClient] Generate error:', error);
      Alert.alert('Error', error.message || 'Failed to generate invite');
    } finally {
      setLoading(false);
    }
  };

  const getInviteLink = () => {
    const PRODUCTION_DOMAIN = 'https://ai-coach-app-landing-page.vercel.app';
    return `${PRODUCTION_DOMAIN}/join/${inviteCode}`;
  };

  const handleCopyLink = async () => {
    await Clipboard.setStringAsync(getInviteLink());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareInvite = async (type: 'whatsapp' | 'email' | 'sms' | 'generic') => {
    const link = getInviteLink();
    const brandName = brand?.name || 'my coaching program';
    
    let message = `Join ${brandName}! 💪\n\nClick here to get started:\n${link}`;
    
    if (type === 'email') {
      message = `You're invited to join ${brandName}!\n\nClick the link below to get started:\n${link}\n\nLooking forward to working with you!`;
    }

    try {
      await Share.share({
        message,
        title: type === 'email' ? `Join ${brandName}` : 'Coaching Invite',
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  return (
    <View className="flex-1 bg-slate-950">
      {/* Header */}
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
            <Text className="text-white text-xl font-black tracking-tight">Invite New Athlete</Text>
        </View>
      </View>

      <ScrollView 
        className="flex-1" 
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Section */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          className="mx-6 mt-8 p-10 rounded-[48px] bg-blue-600/10 border border-blue-500/20 items-center overflow-hidden"
        >
            <View className="absolute top-0 right-0 p-4 opacity-10">
                <Users size={120} color="#3B82F6" />
            </View>
            <View className="w-20 h-20 bg-blue-600 rounded-[30px] items-center justify-center shadow-2xl shadow-blue-500/50 mb-6 border-2 border-white/20">
                <Zap size={36} color="white" fill="white" />
            </View>
            <Text className="text-white text-2xl font-black text-center tracking-tighter">Expand Your Roster</Text>
            <Text className="text-slate-400 text-center mt-3 leading-5 px-4 text-sm font-medium">
                Generate a secure, personalized invite link to onboard new clients directly into your performance ecosystem.
            </Text>
        </MotiView>

        {/* Invite Settings Card */}
        <MotiView
           from={{ opacity: 0, scale: 0.95 }}
           animate={{ opacity: 1, scale: 1 }}
           transition={{ delay: 100 }}
           className="mx-6 mt-8 p-8 rounded-[40px] bg-slate-900/40 border border-white/5 shadow-2xl"
        >
          <View className="flex-row items-center gap-2 mb-8">
            <View className="w-8 h-8 rounded-xl bg-slate-950 items-center justify-center border border-white/5">
                <Smartphone size={16} color="#3B82F6" />
            </View>
            <Text className="text-white text-lg font-black tracking-tight">Access Control</Text>
          </View>
          
          {/* Max Uses Selector */}
          <View className="mb-8">
            <View className="flex-row justify-between items-center mb-4">
                <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Maximum Redemptions</Text>
                {unlimited && <Text className="text-blue-500 text-[10px] font-black uppercase tracking-widest">∞ Unlimited</Text>}
            </View>
            
            <View className="flex-row gap-3">
              <View className={`flex-1 flex-row items-center h-16 rounded-2xl border-2 px-4 transition-all ${unlimited ? 'border-slate-800 bg-slate-950/50' : 'border-blue-600/50 bg-slate-950'}`}>
                <TextInput
                  value={maxUses}
                  onChangeText={setMaxUses}
                  keyboardType="number-pad"
                  editable={!unlimited}
                  placeholder="1"
                  placeholderTextColor="#475569"
                  className={`flex-1 font-black text-xl ${unlimited ? 'text-slate-700' : 'text-white'}`}
                />
                {!unlimited && <Users size={20} color="#3B82F6" />}
              </View>
              
              <TouchableOpacity
                onPress={() => setUnlimited(!unlimited)}
                className={`w-32 h-16 rounded-2xl items-center justify-center border-2 ${unlimited ? 'bg-blue-600 border-blue-500 shadow-lg shadow-blue-500/30' : 'bg-slate-950 border-slate-800'}`}
              >
                <Text className={`font-black text-xs uppercase tracking-widest ${unlimited ? 'text-white' : 'text-slate-500'}`}>
                  Unlimited
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Expiration Settings */}
          <View className="mb-10">
            <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-4">Link Longevity (Days)</Text>
            <View className="flex-row items-center h-16 rounded-2xl border-2 border-slate-800 bg-slate-950 px-4">
              <TextInput
                value={expiresInDays}
                onChangeText={setExpiresInDays}
                keyboardType="number-pad"
                placeholder="7"
                placeholderTextColor="#475569"
                className="flex-1 font-black text-xl text-white"
              />
              <Calendar size={20} color="#94A3B8" />
            </View>
          </View>

          {/* Strategic Action Button */}
          <TouchableOpacity
            onPress={handleGenerate}
            disabled={loading}
            className={`h-18 py-5 rounded-[24px] flex-row items-center justify-center gap-3 ${loading ? 'bg-slate-800' : 'bg-blue-600 shadow-2xl shadow-blue-500/50'}`}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <QrCode size={22} color="white" strokeWidth={2.5} />
                <Text className="text-white font-black text-lg tracking-tight">Deploy Invite Link</Text>
              </>
            )}
          </TouchableOpacity>
        </MotiView>

        {/* Generated Invite Presence */}
        <AnimatePresence>
          {inviteCode && (
            <MotiView
              from={{ opacity: 0, translateY: 20, scale: 0.9 }}
              animate={{ opacity: 1, translateY: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="mx-6 mt-8 rounded-[48px] overflow-hidden"
            >
              <View className="p-1 bg-white/5 border border-white/10 rounded-[48px]">
                <View className="bg-slate-900 rounded-[44px] p-8 border border-white/5">
                  <View className="flex-row items-center justify-between mb-8">
                     <View className="flex-row items-center gap-3">
                        <View className="w-10 h-10 rounded-2xl bg-emerald-500/10 items-center justify-center border border-emerald-500/20">
                            <LinkIcon size={20} color="#10B981" />
                        </View>
                        <View>
                            <Text className="text-white font-black text-base tracking-tight">Live Invite Link</Text>
                            <Text className="text-emerald-500 text-[10px] font-black uppercase tracking-widest">Active & Ready</Text>
                        </View>
                     </View>
                     <View className="bg-slate-950 px-3 py-1.5 rounded-full border border-white/5">
                        <Text className="text-slate-500 font-mono text-xs">{inviteCode}</Text>
                     </View>
                  </View>

                  {/* Copy Link Terminal Style */}
                  <TouchableOpacity 
                    onPress={handleCopyLink}
                    className="bg-slate-950 p-6 rounded-3xl border border-white/5 mb-8 flex-row items-center justify-between"
                  >
                    <Text className="text-slate-400 font-mono text-xs flex-1 mr-4" numberOfLines={1}>
                        {getInviteLink()}
                    </Text>
                    <MotiView animate={{ scale: copied ? 1.2 : 1 }}>
                        {copied ? <Check size={20} color="#10B981" /> : <Copy size={20} color="#3B82F6" />}
                    </MotiView>
                  </TouchableOpacity>

                  {/* High Intensity Share Grid */}
                  <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-4 ml-1">Distribution Channels</Text>
                  <View className="flex-row gap-3">
                    <ShareButton 
                       icon={<MessageCircle size={24} color="white" fill="#25D366" />} 
                       bg="bg-emerald-600/10"
                       borderColor="border-emerald-500/20"
                       onPress={() => shareInvite('whatsapp')} 
                    />
                    <ShareButton 
                       icon={<Mail size={24} color="#F87171" />} 
                       bg="bg-red-500/10"
                       borderColor="border-red-500/20"
                       onPress={() => shareInvite('email')} 
                    />
                    <ShareButton 
                       icon={<MessageCircle size={24} color="#3B82F6" />} 
                       bg="bg-blue-600/10"
                       borderColor="border-blue-500/20"
                       onPress={() => shareInvite('sms')} 
                    />
                  </View>

                  <View className="h-px bg-white/5 my-8" />

                  <View className="flex-row items-center gap-4 px-2">
                    <Calendar size={18} color="#475569" />
                    <Text className="text-slate-500 font-black text-[10px] uppercase tracking-widest flex-1">
                      {unlimited ? 'Infinite capacity' : `Limit: ${maxUses} Uses`} • Valid for {expiresInDays} Days
                    </Text>
                  </View>
                </View>
              </View>
            </MotiView>
          )}
        </AnimatePresence>

        {/* Onboarding Logic Section */}
        <View className="px-6 mt-12 mb-12">
          <View className="flex-row items-end justify-between mb-8">
            <Text className="text-white text-2xl font-black tracking-tighter">Onboarding Process</Text>
            <View className="w-12 h-0.5 bg-blue-600 rounded-full mb-3" />
          </View>
          
          <StepItem 
            number="01" 
            title="Configure Secure Token" 
            desc="Set usage limits and expiration parameters for client link." 
          />
          <StepItem 
            number="02" 
            title="Strategic Deployment" 
            desc="Share the personalized link via high-conversion channels." 
          />
          <StepItem 
            number="03" 
            title="Neural Sync" 
            desc="Athlete creates identity and automatically syncs to your roster." 
          />
          <StepItem 
            number="04" 
            title="Ready for Performance" 
            desc="Commence tracking, strategy generation, and performance coaching." 
            isLast
          />
        </View>
      </ScrollView>
    </View>
  );
}

const ShareButton = ({ icon, onPress, bg, borderColor }: any) => (
    <TouchableOpacity 
      onPress={onPress}
      className={`flex-1 h-16 rounded-[22px] items-center justify-center border ${bg} ${borderColor}`}
    >
      {icon}
    </TouchableOpacity>
);

const StepItem = ({ number, title, desc, isLast }: any) => (
    <View className="flex-row gap-6 mb-8 flex-1">
        <View className="items-center">
            <View className="w-12 h-12 bg-slate-900 rounded-2xl items-center justify-center border border-white/5">
                <Text className="text-blue-500 font-black text-base">{number}</Text>
            </View>
            {!isLast && <View className="w-0.5 flex-1 bg-slate-900 my-2" />}
        </View>
        <View className="flex-1 mt-1">
            <Text className="text-white font-black text-lg tracking-tight mb-1">{title}</Text>
            <Text className="text-slate-500 text-sm font-medium leading-5">{desc}</Text>
        </View>
    </View>
);
