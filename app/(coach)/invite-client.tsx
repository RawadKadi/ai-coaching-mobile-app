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
import { StatusBar } from 'expo-status-bar';
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
import { useBrand, useBrandColors } from '@/contexts/BrandContext';
import { isDarkColor } from '@/lib/theme-utils';
import { generateInviteCode } from '@/lib/brand-service';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { safeBack } from '@/lib/navigation-utils';

export default function InviteClientScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { coach } = useAuth();
  const { brand } = useBrand();
  const colors = useBrandColors();
  const isDarkMode = isDarkColor(colors.background || '#010417');
  
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
          onPress={() => safeBack('/(coach)/(tabs)')} 
          style={{ backgroundColor: colors.surface, borderColor: colors.border }}
          className="p-2.5 rounded-full border"
          activeOpacity={0.7}
        >
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>
        <View>
          <Text style={{ color: colors.textSecondary }} className="text-[10px] font-black uppercase tracking-[3px]">
            Invites
          </Text>
          <Text style={{ color: colors.text }} className="text-xl font-black tracking-tight">
            Invite Athlete
          </Text>
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
          style={{ 
            backgroundColor: colors.surface, 
            borderColor: colors.border,
          }}
          className="mx-6 mt-8 p-8 rounded-[40px] border items-center overflow-hidden shadow-sm"
        >
          <View className="absolute top-0 right-0 p-4 opacity-10">
            <Users size={120} color={colors.primary} />
          </View>
          <View 
            style={{ backgroundColor: colors.primary }}
            className="w-16 h-16 rounded-[24px] items-center justify-center mb-5 shadow-lg"
          >
            <Zap size={30} color={colors.textOnPrimary} fill={colors.textOnPrimary} />
          </View>
          <Text style={{ color: colors.text }} className="text-2xl font-black text-center tracking-tight">
            Invite New Athlete
          </Text>
          <Text style={{ color: colors.textSecondary }} className="text-center mt-2.5 leading-5 px-4 text-sm font-medium">
            Create a private link for your athlete to join your coaching program.
          </Text>
        </MotiView>

        {/* Invite Settings Card */}
        <MotiView
          from={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 100 }}
          style={{ 
            backgroundColor: colors.surface, 
            borderColor: colors.border,
          }}
          className="mx-6 mt-6 p-7 rounded-[36px] border shadow-sm"
        >
          <View className="flex-row items-center gap-3 mb-6">
            <View 
              style={{ backgroundColor: colors.background, borderColor: colors.border }}
              className="w-9 h-9 rounded-xl items-center justify-center border"
            >
              <Smartphone size={16} color={colors.primary} />
            </View>
            <Text style={{ color: colors.text }} className="text-lg font-black tracking-tight">
              Link Settings
            </Text>
          </View>
          
          {/* Max Uses Selector */}
          <View className="mb-6">
            <View className="flex-row justify-between items-center mb-3">
              <Text style={{ color: colors.textSecondary }} className="text-[10px] font-black uppercase tracking-widest">
                Max Uses
              </Text>
              {unlimited && (
                <Text style={{ color: colors.primary }} className="text-[10px] font-black uppercase tracking-widest">
                  ∞ Unlimited
                </Text>
              )}
            </View>
            
            <View className="flex-row gap-3">
              <View 
                style={{ 
                  backgroundColor: unlimited 
                    ? (isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)')
                    : colors.background,
                  borderColor: unlimited ? colors.border : colors.primary,
                }}
                className="flex-1 flex-row items-center h-14 rounded-2xl border-2 px-4"
              >
                <TextInput
                  value={maxUses}
                  onChangeText={setMaxUses}
                  keyboardType="number-pad"
                  editable={!unlimited}
                  placeholder="1"
                  placeholderTextColor={colors.textTertiary}
                  style={{ color: unlimited ? colors.textTertiary : colors.text }}
                  className="flex-1 font-black text-xl"
                />
                {!unlimited && <Users size={20} color={colors.primary} />}
              </View>
              
              <TouchableOpacity
                onPress={() => setUnlimited(!unlimited)}
                style={{ 
                  backgroundColor: unlimited ? colors.primary : colors.background,
                  borderColor: unlimited ? colors.primary : colors.border,
                }}
                className="w-32 h-14 rounded-2xl items-center justify-center border-2"
                activeOpacity={0.8}
              >
                <Text 
                  style={{ color: unlimited ? colors.textOnPrimary : colors.textSecondary }}
                  className="font-black text-xs uppercase tracking-widest"
                >
                  Unlimited
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Expiration Settings */}
          <View className="mb-8">
            <Text style={{ color: colors.textSecondary }} className="text-[10px] font-black uppercase tracking-widest mb-3">
              Expires In (Days)
            </Text>
            <View 
              style={{ backgroundColor: colors.background, borderColor: colors.border }}
              className="flex-row items-center h-14 rounded-2xl border-2 px-4"
            >
              <TextInput
                value={expiresInDays}
                onChangeText={setExpiresInDays}
                keyboardType="number-pad"
                placeholder="7"
                placeholderTextColor={colors.textTertiary}
                style={{ color: colors.text }}
                className="flex-1 font-black text-xl"
              />
              <Calendar size={20} color={colors.textSecondary} />
            </View>
          </View>

          {/* Action Button */}
          <TouchableOpacity
            onPress={handleGenerate}
            disabled={loading}
            style={{ 
              backgroundColor: loading ? (colors.surfaceAlt || colors.border) : colors.primary 
            }}
            className="h-16 rounded-[22px] flex-row items-center justify-center gap-3 shadow-lg"
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={colors.textOnPrimary} />
            ) : (
              <>
                <QrCode size={22} color={colors.textOnPrimary} strokeWidth={2.5} />
                <Text style={{ color: colors.textOnPrimary }} className="font-black text-base tracking-tight">
                  Create Invite Link
                </Text>
              </>
            )}
          </TouchableOpacity>
        </MotiView>

        {/* Generated Invite Presence */}
        <AnimatePresence>
          {inviteCode && (
            <MotiView
              from={{ opacity: 0, translateY: 20, scale: 0.95 }}
              animate={{ opacity: 1, translateY: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="mx-6 mt-6"
            >
              <View 
                style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                className="rounded-[36px] p-7 border shadow-sm"
              >
                <View className="flex-row items-center justify-between mb-6">
                  <View className="flex-row items-center gap-3">
                    <View 
                      style={{ 
                        backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.15)' : '#DCFCE7',
                        borderColor: isDarkMode ? 'rgba(16, 185, 129, 0.3)' : '#86EFAC',
                      }}
                      className="w-10 h-10 rounded-2xl items-center justify-center border"
                    >
                      <LinkIcon size={20} color={colors.success || '#10B981'} />
                    </View>
                    <View>
                      <Text style={{ color: colors.text }} className="font-black text-base tracking-tight">
                        Your Invite Link
                      </Text>
                      <Text style={{ color: colors.success || '#10B981' }} className="text-[10px] font-black uppercase tracking-widest">
                        Ready to share
                      </Text>
                    </View>
                  </View>
                  <View 
                    style={{ backgroundColor: colors.background, borderColor: colors.border }}
                    className="px-3 py-1.5 rounded-full border"
                  >
                    <Text style={{ color: colors.textSecondary }} className="font-mono text-xs font-bold">
                      {inviteCode}
                    </Text>
                  </View>
                </View>

                {/* Copy Link Row */}
                <TouchableOpacity 
                  onPress={handleCopyLink}
                  style={{ backgroundColor: colors.background, borderColor: colors.border }}
                  className="p-4 rounded-2xl border mb-6 flex-row items-center justify-between"
                  activeOpacity={0.7}
                >
                  <Text style={{ color: colors.textSecondary }} className="font-mono text-xs flex-1 mr-4" numberOfLines={1}>
                    {getInviteLink()}
                  </Text>
                  <MotiView animate={{ scale: copied ? 1.2 : 1 }}>
                    {copied ? (
                      <Check size={20} color={colors.success || '#10B981'} />
                    ) : (
                      <Copy size={20} color={colors.primary} />
                    )}
                  </MotiView>
                </TouchableOpacity>

                {/* Share Buttons */}
                <Text style={{ color: colors.textSecondary }} className="text-[10px] font-black uppercase tracking-widest mb-3 ml-1">
                  Share via
                </Text>
                <View className="flex-row gap-3">
                  <ShareButton 
                    icon={<MessageCircle size={22} color="#25D366" />} 
                    bg={colors.background}
                    borderColor={colors.border}
                    onPress={() => shareInvite('whatsapp')} 
                  />
                  <ShareButton 
                    icon={<Mail size={22} color="#EF4444" />} 
                    bg={colors.background}
                    borderColor={colors.border}
                    onPress={() => shareInvite('email')} 
                  />
                  <ShareButton 
                    icon={<MessageCircle size={22} color={colors.primary} />} 
                    bg={colors.background}
                    borderColor={colors.border}
                    onPress={() => shareInvite('sms')} 
                  />
                </View>

                <View style={{ backgroundColor: colors.border }} className="h-px my-6" />

                <View className="flex-row items-center gap-3 px-1">
                  <Calendar size={16} color={colors.textTertiary} />
                  <Text style={{ color: colors.textSecondary }} className="font-bold text-[11px] uppercase tracking-wider flex-1">
                    {unlimited ? 'Unlimited uses' : `Limit: ${maxUses} uses`} • Valid for {expiresInDays} days
                  </Text>
                </View>
              </View>
            </MotiView>
          )}
        </AnimatePresence>

        {/* How It Works Section */}
        <View className="px-6 mt-10 mb-8">
          <View className="flex-row items-center justify-between mb-6">
            <Text style={{ color: colors.text }} className="text-xl font-black tracking-tight">
              How it works
            </Text>
            <View style={{ backgroundColor: colors.primary }} className="w-10 h-0.5 rounded-full" />
          </View>
          
          <StepItem 
            number="01" 
            title="Set link limits" 
            desc="Choose how many athletes can use the link and when it expires." 
            colors={colors}
          />
          <StepItem 
            number="02" 
            title="Share with athlete" 
            desc="Send the link through WhatsApp, email, or text." 
            colors={colors}
          />
          <StepItem 
            number="03" 
            title="Athlete signs up" 
            desc="They open the link, create their account, and link to you." 
            colors={colors}
          />
          <StepItem 
            number="04" 
            title="Start coaching" 
            desc="Assign workouts, chat, and track progress together." 
            isLast
            colors={colors}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const ShareButton = ({ icon, onPress, bg, borderColor }: any) => (
  <TouchableOpacity 
    onPress={onPress}
    style={{ backgroundColor: bg, borderColor: borderColor }}
    className="flex-1 h-14 rounded-2xl items-center justify-center border"
    activeOpacity={0.7}
  >
    {icon}
  </TouchableOpacity>
);

const StepItem = ({ number, title, desc, isLast, colors }: any) => (
  <View className="flex-row gap-5 mb-6 flex-1">
    <View className="items-center">
      <View 
        style={{ backgroundColor: colors.surface, borderColor: colors.border }}
        className="w-11 h-11 rounded-2xl items-center justify-center border"
      >
        <Text style={{ color: colors.primary }} className="font-black text-sm">{number}</Text>
      </View>
      {!isLast && <View style={{ backgroundColor: colors.border }} className="w-0.5 flex-1 my-2" />}
    </View>
    <View className="flex-1 mt-0.5">
      <Text style={{ color: colors.text }} className="font-black text-base tracking-tight mb-1">{title}</Text>
      <Text style={{ color: colors.textSecondary }} className="text-xs font-medium leading-5">{desc}</Text>
    </View>
  </View>
);
