import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  Share,
  Modal,
  StyleSheet,
  Platform,
  Animated,
  Dimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { MotiView, AnimatePresence } from 'moti';
import { useReducedMotion } from 'react-native-reanimated';
import QRCode from 'react-native-qrcode-svg';
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
  Users,
  X,
  Share2,
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
  const reduceMotion = useReducedMotion();
  const qrSvgRef = useRef<any>(null);

  const { coach } = useAuth();
  const { brand } = useBrand();
  const colors = useBrandColors();
  const isDarkMode = isDarkColor(colors.background || '#010417');

  const [loading, setLoading] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [copiedQr, setCopiedQr] = useState(false);
  const [showSlider, setShowSlider] = useState(false);

  const { height: SCREEN_HEIGHT } = Dimensions.get('window');
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;

  const onPressInButton = () => {
    Animated.spring(buttonScale, {
      toValue: 0.94,
      useNativeDriver: true,
      speed: 50,
      bounciness: 0,
    }).start();
  };

  const onPressOutButton = () => {
    Animated.spring(buttonScale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 40,
      bounciness: 4,
    }).start();
  };

  const openSlider = () => {
    setShowSlider(true);
    fadeAnim.setValue(0);
    slideAnim.setValue(reduceMotion ? 0 : SCREEN_HEIGHT);

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: reduceMotion ? 0 : 250,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        damping: 30,
        stiffness: 280,
        mass: 0.8,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeSlider = () => {
    if (reduceMotion) {
      setShowSlider(false);
      return;
    }
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 240,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowSlider(false);
    });
  };

  const handleGenerate = async () => {
    if (!coach?.id) {
      Alert.alert('Error', 'Coach information not found');
      return;
    }

    setLoading(true);

    try {
      const uses = 1;
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + 5);

      const result = await generateInviteCode(
        coach.id,
        uses,
        expirationDate.toISOString(),
      );

      if (result.success && result.code) {
        setInviteCode(result.code);
        openSlider();
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
    const link = getInviteLink();
    await Clipboard.setStringAsync(link);
    if (Platform.OS !== 'web') {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyQr = async () => {
    try {
      if (
        qrSvgRef.current &&
        typeof qrSvgRef.current.toDataURL === 'function'
      ) {
        qrSvgRef.current.toDataURL(async (data: string) => {
          try {
            if (data) {
              await Clipboard.setImageAsync(data);
              if (Platform.OS !== 'web') {
                try {
                  Haptics.notificationAsync(
                    Haptics.NotificationFeedbackType.Success,
                  );
                } catch {}
              }
              setCopiedQr(true);
              setTimeout(() => setCopiedQr(false), 2000);
            }
          } catch (err) {
            console.error('[InviteClient] SetImageAsync failed:', err);
            await handleCopyLink();
          }
        });
      } else {
        await handleCopyLink();
      }
    } catch (error) {
      console.error('[InviteClient] Copy QR error:', error);
      await handleCopyLink();
    }
  };

  const handleNativeShare = async () => {
    const link = getInviteLink();
    if (!link) return;

    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {}
    }

    try {
      if (
        Platform.OS === 'web' &&
        typeof navigator !== 'undefined' &&
        navigator.share
      ) {
        await navigator.share({
          title: 'Invite Athlete',
          text: 'Join my coaching program!',
          url: link,
        });
        return;
      }

      if (Platform.OS === 'ios') {
        await Share.share({
          url: link,
          message: 'Join my coaching program!',
          title: 'Invite Athlete',
        });
      } else {
        await Share.share({
          message: `Join my coaching program!\n\n${link}`,
          title: 'Invite Athlete',
        });
      }
    } catch (error: any) {
      if (error?.message !== 'User did not share') {
        console.error('Share error:', error);
      }
    }
  };

  const shareInvite = async (
    type: 'whatsapp' | 'email' | 'sms' | 'generic',
  ) => {
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
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
          }}
          className="p-2.5 rounded-full border"
          activeOpacity={0.7}
        >
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>
        <View>
          <Text
            style={{ color: colors.textSecondary }}
            className="text-[10px] font-black uppercase tracking-[3px]"
          >
            Invites
          </Text>
          <Text
            style={{ color: colors.text }}
            className="text-xl font-black tracking-tight"
          >
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
            <Zap
              size={30}
              color={colors.textOnPrimary}
              fill={colors.textOnPrimary}
            />
          </View>
          <Text
            style={{ color: colors.text }}
            className="text-2xl font-black text-center tracking-tight"
          >
            Invite New Client
          </Text>
          <Text
            style={{ color: colors.textSecondary }}
            className="text-center mt-2.5 leading-5 px-4 text-sm font-medium"
          >
            Create a private link for your athlete to join your coaching
            program.
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
              style={{
                backgroundColor: colors.background,
                borderColor: colors.border,
              }}
              className="w-9 h-9 rounded-xl items-center justify-center border"
            >
              <Smartphone size={16} color={colors.primary} />
            </View>
            <Text
              style={{ color: colors.text }}
              className="text-lg font-black tracking-tight"
            >
              Link Settings
            </Text>
          </View>

          {/* Link Info */}
          <View
            style={{
              backgroundColor: colors.background,
              borderColor: colors.border,
            }}
            className="p-4 rounded-2xl border mb-6 flex-row items-center gap-3"
          >
            <Calendar size={18} color={colors.primary} />
            <Text
              style={{ color: colors.textSecondary }}
              className="text-sm font-medium flex-1"
            >
              Each link works once and expires in 5 days.
            </Text>
          </View>

          {/* Action Button - shrinks on click, no color change */}
          <Pressable
            onPress={handleGenerate}
            onPressIn={onPressInButton}
            onPressOut={onPressOutButton}
            disabled={loading}
            style={{ width: '100%' }}
          >
            <Animated.View
              style={{
                backgroundColor: colors.primary,
                transform: [{ scale: buttonScale }],
              }}
              className="h-16 rounded-[22px] flex-row items-center justify-center gap-3 shadow-lg"
            >
              {loading ? (
                <ActivityIndicator color={colors.textOnPrimary} />
              ) : (
                <>
                  <QrCode
                    size={22}
                    color={colors.textOnPrimary}
                    strokeWidth={2.5}
                  />
                  <Text
                    style={{ color: colors.textOnPrimary }}
                    className="font-black text-base tracking-tight"
                  >
                    Create Invite Link
                  </Text>
                </>
              )}
            </Animated.View>
          </Pressable>
        </MotiView>

        {/* How It Works Section */}
        <View className="px-6 mt-10 mb-8">
          <View className="flex-row items-center justify-between mb-6">
            <Text
              style={{ color: colors.text }}
              className="text-xl font-black tracking-tight"
            >
              How it works
            </Text>
            <View
              style={{ backgroundColor: colors.primary }}
              className="w-10 h-0.5 rounded-full"
            />
          </View>

          <StepItem
            number="01"
            title="Create link"
            desc="Generate a single-use invite valid for 5 days."
            colors={colors}
          />
          <StepItem
            number="02"
            title="Share with athlete"
            desc="Send the link through AirDrop, WhatsApp, email, or text."
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

      {/* Bottom Slider Modal */}
      <Modal
        visible={showSlider}
        animationType="none"
        transparent
        onRequestClose={closeSlider}
        statusBarTranslucent
      >
        <View style={StyleSheet.absoluteFill} className="justify-end">
          {/* Dark Backdrop: ONLY fades in/out, clicking outside closes the slider */}
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: 'rgba(0, 0, 0, 0.65)',
                opacity: fadeAnim,
              },
            ]}
          >
            <Pressable style={StyleSheet.absoluteFill} onPress={closeSlider} />
          </Animated.View>

          {/* Slider Sheet: ONLY slides from down to up */}
          <Animated.View
            style={[
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderTopWidth: 1,
                maxHeight: '88%',
                transform: [{ translateY: slideAnim }],
              },
            ]}
            className="rounded-t-[36px] px-6 pt-3 shadow-2xl"
          >
            {/* Drag Handle */}
            <View
              style={{
                backgroundColor: isDarkMode
                  ? 'rgba(255,255,255,0.2)'
                  : 'rgba(0,0,0,0.15)',
              }}
              className="w-12 h-1.5 rounded-full self-center mb-4"
            />

            {/* Slider Header */}
            <View className="flex-row items-center justify-between mb-4">
              <View>
                <Text
                  style={{ color: colors.text }}
                  className="text-xl font-black tracking-tight"
                >
                  Invite Athlete
                </Text>
                <Text
                  style={{ color: colors.textSecondary }}
                  className="text-xs font-medium mt-0.5"
                >
                  Scan QR code or share link
                </Text>
              </View>

              <TouchableOpacity
                onPress={closeSlider}
                style={{
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                }}
                className="w-9 h-9 rounded-full items-center justify-center border"
                activeOpacity={0.7}
              >
                <X size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              bounces={false}
              contentContainerStyle={{
                paddingBottom: Math.max(insets.bottom, 24) + 8,
              }}
            >
              {/* QR Code Container */}
              <View className="items-center my-3">
                <View className="bg-white p-5 rounded-[28px] items-center justify-center shadow-lg border border-slate-200">
                  <QRCode
                    value={getInviteLink()}
                    size={180}
                    color="#0B0F19"
                    backgroundColor="#FFFFFF"
                    getRef={(ref) => {
                      qrSvgRef.current = ref;
                    }}
                  />
                </View>

                {/* Copy QR Button */}
                <TouchableOpacity
                  onPress={handleCopyQr}
                  style={{
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                  }}
                  className="mt-4 px-4 py-2.5 rounded-2xl border flex-row items-center gap-2"
                  activeOpacity={0.7}
                >
                  {copiedQr ? (
                    <Check
                      size={16}
                      color={colors.success || '#10B981'}
                      strokeWidth={2.5}
                    />
                  ) : (
                    <Copy size={16} color={colors.primary} strokeWidth={2.2} />
                  )}
                  <Text
                    style={{
                      color: copiedQr
                        ? colors.success || '#10B981'
                        : colors.text,
                    }}
                    className="font-bold text-xs"
                  >
                    {copiedQr ? 'QR Copied!' : 'Copy QR'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Link Input Row with Copy Button */}
              <View className="mt-3 mb-4">
                <Text
                  style={{ color: colors.textSecondary }}
                  className="text-[10px] font-black uppercase tracking-widest mb-2 ml-1"
                >
                  Invite Link
                </Text>
                <TouchableOpacity
                  onPress={handleCopyLink}
                  activeOpacity={0.8}
                  style={{
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                  }}
                  className="flex-row items-center h-14 rounded-2xl border-2 px-3 gap-2.5"
                >
                  <LinkIcon size={18} color={colors.primary} />
                  <Text
                    style={{ color: colors.text }}
                    className="font-mono text-xs flex-1"
                    numberOfLines={1}
                  >
                    {getInviteLink()}
                  </Text>
                  <View
                    style={{
                      backgroundColor: copied
                        ? colors.success || '#10B981'
                        : colors.primary,
                    }}
                    className="px-3.5 py-1.5 rounded-xl flex-row items-center gap-1.5"
                  >
                    {copied ? (
                      <Check size={14} color="#FFFFFF" strokeWidth={2.5} />
                    ) : (
                      <Copy
                        size={14}
                        color={colors.textOnPrimary}
                        strokeWidth={2.2}
                      />
                    )}
                    <Text
                      style={{ color: colors.textOnPrimary }}
                      className="font-bold text-xs"
                    >
                      {copied ? 'Copied' : 'Copy'}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>

              {/* Native iPhone Share Button */}
              <TouchableOpacity
                onPress={handleNativeShare}
                style={{ backgroundColor: colors.primary }}
                className="h-14 rounded-2xl flex-row items-center justify-center gap-2.5 shadow-lg mb-2"
                activeOpacity={0.85}
              >
                <Share2
                  size={20}
                  color={colors.textOnPrimary}
                  strokeWidth={2.5}
                />
                <Text
                  style={{ color: colors.textOnPrimary }}
                  className="font-black text-base"
                >
                  Share
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const StepItem = ({ number, title, desc, isLast, colors }: any) => (
  <View className="flex-row gap-5 mb-6 flex-1">
    <View className="items-center">
      <View
        style={{ backgroundColor: colors.surface, borderColor: colors.border }}
        className="w-11 h-11 rounded-2xl items-center justify-center border"
      >
        <Text style={{ color: colors.primary }} className="font-black text-sm">
          {number}
        </Text>
      </View>
      {!isLast && (
        <View
          style={{ backgroundColor: colors.border }}
          className="w-0.5 flex-1 my-2"
        />
      )}
    </View>
    <View className="flex-1 mt-0.5">
      <Text
        style={{ color: colors.text }}
        className="font-black text-base tracking-tight mb-1"
      >
        {title}
      </Text>
      <Text
        style={{ color: colors.textSecondary }}
        className="text-xs font-medium leading-5"
      >
        {desc}
      </Text>
    </View>
  </View>
);
