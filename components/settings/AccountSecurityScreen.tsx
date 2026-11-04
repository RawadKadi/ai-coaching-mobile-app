import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { useReducedMotion } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import {
  ChevronLeft,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  X,
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useBrandColors, useTheme } from '@/contexts/BrandContext';
import { isDarkColor } from '@/lib/theme-utils';
import { safeBack } from '@/lib/navigation-utils';
import { supabase } from '@/lib/supabase';
import GoogleIcon from '@/components/GoogleIcon';
import AppleIcon from '@/components/AppleIcon';

interface AccountSecurityScreenProps {
  fallbackBackRoute: string;
}

export default function AccountSecurityScreen({ fallbackBackRoute }: AccountSecurityScreenProps) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const colors = useBrandColors();
  const isDark = isDarkColor(colors.background || '#0B0F19');
  const reduceMotion = useReducedMotion();

  const { user, profile, refreshProfile } = useAuth();

  // State
  const [identities, setIdentities] = useState<any[]>(user?.identities || []);
  const [loadingIdentities, setLoadingIdentities] = useState(false);

  // Email modal
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [updatingEmail, setUpdatingEmail] = useState(false);

  // Password modal
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);

  // Unlinking state
  const [unlinkingProvider, setUnlinkingProvider] = useState<string | null>(null);

  // Fetch latest identities
  const fetchIdentities = useCallback(async () => {
    try {
      setLoadingIdentities(true);
      const { data, error } = await supabase.auth.getUserIdentities();
      if (!error && data?.identities) {
        setIdentities(data.identities);
      } else if (user?.identities) {
        setIdentities(user.identities);
      }
    } catch {
      if (user?.identities) {
        setIdentities(user.identities);
      }
    } finally {
      setLoadingIdentities(false);
    }
  }, [user]);

  useEffect(() => {
    fetchIdentities();
  }, [fetchIdentities]);

  // Provider checks
  const primaryProvider = user?.app_metadata?.provider || 'email';
  const hasEmailIdentity = identities.some((i) => i.provider === 'email');
  const isOAuthUser = primaryProvider !== 'email' || (!hasEmailIdentity && identities.length > 0);

  const oauthProviderLabel =
    primaryProvider === 'google'
      ? 'Google'
      : primaryProvider === 'apple'
      ? 'Apple'
      : primaryProvider.charAt(0).toUpperCase() + primaryProvider.slice(1);

  const isGoogleLinked = identities.some((i) => i.provider === 'google');
  const isAppleLinked = identities.some((i) => i.provider === 'apple');

  // Total available login methods
  const totalMethods = identities.length > 0 ? identities.length : 1;

  // Handle Email Update
  const handleUpdateEmail = async () => {
    const trimmed = newEmail.trim().toLowerCase();
    if (!trimmed) {
      Alert.alert('Required', 'Please enter a valid email address.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      Alert.alert('Invalid Email', 'Please check the email format and try again.');
      return;
    }

    if (trimmed === user?.email?.toLowerCase()) {
      Alert.alert('Same Email', 'This is already your current email.');
      return;
    }

    try {
      setUpdatingEmail(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

      const { error } = await supabase.auth.updateUser({ email: trimmed });
      if (error) throw error;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert(
        'Check your inbox',
        'We sent a confirmation link to your new email. Please tap it to complete the change.',
      );
      setShowEmailModal(false);
      setNewEmail('');
      await refreshProfile();
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Alert.alert('Error', err.message || 'Could not update email. Please try again.');
    } finally {
      setUpdatingEmail(false);
    }
  };

  // Handle Password Update
  const handleUpdatePassword = async () => {
    if (!currentPassword) {
      Alert.alert('Required', 'Please enter your current password.');
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      Alert.alert('Invalid Password', 'New password must be at least 6 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Mismatch', 'New passwords do not match. Please re-enter.');
      return;
    }

    try {
      setUpdatingPassword(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

      // Verify current password first
      if (user?.email) {
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: currentPassword,
        });

        if (signInErr) {
          Alert.alert('Incorrect Password', 'Your current password was not correct. Please try again.');
          setUpdatingPassword(false);
          return;
        }
      }

      // Update password
      const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword });
      if (updateErr) throw updateErr;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert('Password Updated', 'Your new password has been saved.');
      setShowPasswordModal(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Alert.alert('Error', err.message || 'Could not update password. Please try again.');
    } finally {
      setUpdatingPassword(false);
    }
  };

  // Handle Unlink Provider
  const handleUnlink = async (provider: string) => {
    if (totalMethods <= 1) {
      Alert.alert(
        'Cannot Disconnect',
        'You cannot disconnect your only login method. Add another login method first.',
      );
      return;
    }

    const identity = identities.find((i) => i.provider === provider);
    if (!identity) {
      Alert.alert('Error', 'Provider identity not found.');
      return;
    }

    const providerTitle = provider.charAt(0).toUpperCase() + provider.slice(1);

    Alert.alert(
      `Disconnect ${providerTitle}`,
      `Are you sure you want to remove ${providerTitle} from your account?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            try {
              setUnlinkingProvider(provider);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

              const { error } = await supabase.auth.unlinkIdentity(identity);
              if (error) throw error;

              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              Alert.alert('Disconnected', `${providerTitle} has been disconnected.`);
              await fetchIdentities();
              await refreshProfile();
            } catch (err: any) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
              Alert.alert('Error', err.message || `Could not disconnect ${providerTitle}.`);
            } finally {
              setUnlinkingProvider(null);
            }
          },
        },
      ],
    );
  };

  // Handle Connect Provider
  const handleConnect = async (provider: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const providerTitle = provider.charAt(0).toUpperCase() + provider.slice(1);

    try {
      const { error } = await supabase.auth.linkIdentity({
        provider: provider as any,
      });

      if (error) {
        Alert.alert(
          'Connect ' + providerTitle,
          error.message || `Could not start connection with ${providerTitle}.`,
        );
      }
    } catch (err: any) {
      Alert.alert(
        'Connect ' + providerTitle,
        err.message || `Connecting with ${providerTitle} is currently unavailable.`,
      );
    }
  };

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
              safeBack(fallbackBackRoute);
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
              Account & Security
            </Text>
            <Text
              style={{ color: colors.textSecondary }}
              className="text-[10px] font-bold uppercase tracking-widest mt-0.5"
            >
              Credentials & Login
            </Text>
          </View>

          <View className="w-10" />
        </View>

        <ScrollView
          className="flex-1 px-3 pt-4"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
        >
          {/* SECTION A: EMAIL & CREDENTIALS */}
          <Text
            style={{ color: colors.textSecondary }}
            className="text-[10px] font-black uppercase tracking-[3px] px-1 mt-6 mb-2"
          >
            Email & Password
          </Text>

          {/* Email Card */}
          <MotiView
            from={reduceMotion ? undefined : { opacity: 0, translateY: 8 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ delay: 40 }}
          >
            <View
              style={{ backgroundColor: colors.surface, borderColor: colors.border }}
              className="flex-row items-center p-5 rounded-[32px] border mb-3"
            >
              <View
                className="w-12 h-12 rounded-[18px] items-center justify-center mr-4 border"
                style={{ backgroundColor: colors.background, borderColor: colors.border }}
              >
                <Mail size={20} color={colors.primary} />
              </View>

              <View className="flex-1 mr-3">
                <Text
                  style={{ color: colors.textSecondary }}
                  className="text-[10px] font-medium uppercase tracking-wider"
                >
                  Email Address
                </Text>
                <Text
                  style={{ color: colors.text }}
                  className="font-bold text-base mt-0.5"
                  numberOfLines={1}
                >
                  {user?.email || 'Not available'}
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  setNewEmail(user?.email || '');
                  setShowEmailModal(true);
                }}
                style={{
                  backgroundColor: `${colors.primary}1a`,
                  borderColor: `${colors.primary}33`,
                }}
                className="px-4 py-2 rounded-full border"
                activeOpacity={0.7}
              >
                <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>
                  Change
                </Text>
              </TouchableOpacity>
            </View>
          </MotiView>

          {/* Password Card */}
          <MotiView
            from={reduceMotion ? undefined : { opacity: 0, translateY: 8 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ delay: 80 }}
          >
            <View
              style={{ backgroundColor: colors.surface, borderColor: colors.border }}
              className="p-5 rounded-[32px] border mb-3"
            >
              {isOAuthUser ? (
                // 3rd-Party OAuth User
                <View className="flex-row items-start">
                  <View
                    className="w-12 h-12 rounded-[18px] items-center justify-center mr-4 border"
                    style={{ backgroundColor: colors.background, borderColor: colors.border }}
                  >
                    <ShieldCheck size={20} color={colors.primary} />
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-center gap-2">
                      <Text
                        style={{ color: colors.text }}
                        className="font-bold text-base"
                      >
                        Password
                      </Text>
                      <View
                        className="px-2.5 py-0.5 rounded-full border"
                        style={{
                          backgroundColor: `${colors.primary}1a`,
                          borderColor: `${colors.primary}33`,
                        }}
                      >
                        <Text
                          style={{
                            color: colors.primary,
                            fontSize: 9,
                            fontWeight: '900',
                            textTransform: 'uppercase',
                          }}
                        >
                          Single Sign-On
                        </Text>
                      </View>
                    </View>
                    <Text
                      style={{ color: colors.textSecondary }}
                      className="text-[10px] font-medium mt-1 leading-4"
                    >
                      Managed by {oauthProviderLabel} — Password updates are handled via your{' '}
                      {oauthProviderLabel} account.
                    </Text>
                  </View>
                </View>
              ) : (
                // Email / Password User
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center flex-1 mr-3">
                    <View
                      className="w-12 h-12 rounded-[18px] items-center justify-center mr-4 border"
                      style={{ backgroundColor: colors.background, borderColor: colors.border }}
                    >
                      <Lock size={20} color={colors.primary} />
                    </View>
                    <View className="flex-1">
                      <Text
                        style={{ color: colors.textSecondary }}
                        className="text-[10px] font-medium uppercase tracking-wider"
                      >
                        Password
                      </Text>
                      <Text
                        style={{ color: colors.text }}
                        className="font-bold text-base mt-0.5 tracking-widest"
                      >
                        ••••••••••••
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                      setShowPasswordModal(true);
                    }}
                    style={{
                      backgroundColor: `${colors.primary}1a`,
                      borderColor: `${colors.primary}33`,
                    }}
                    className="px-4 py-2 rounded-full border"
                    activeOpacity={0.7}
                  >
                    <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>
                      Change
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </MotiView>

          {/* SECTION B: CONNECTED ACCOUNTS */}
          <Text
            style={{ color: colors.textSecondary }}
            className="text-[10px] font-black uppercase tracking-[3px] px-1 mt-6 mb-2"
          >
            Connected Accounts
          </Text>

          <MotiView
            from={reduceMotion ? undefined : { opacity: 0, translateY: 8 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ delay: 120 }}
          >
            <View
              style={{ backgroundColor: colors.surface, borderColor: colors.border }}
              className="p-5 rounded-[32px] border mb-3"
            >
              {/* Google Row */}
              <View
                className="flex-row items-center justify-between pb-4 border-b"
                style={{ borderBottomColor: colors.border }}
              >
                <View className="flex-row items-center flex-1 mr-3">
                  <View
                    className="w-12 h-12 rounded-[18px] items-center justify-center mr-4 border"
                    style={{ backgroundColor: colors.background, borderColor: colors.border }}
                  >
                    <GoogleIcon size={22} />
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-center gap-2">
                      <Text
                        style={{ color: colors.text }}
                        className="font-bold text-base"
                      >
                        Google
                      </Text>
                      {isGoogleLinked && (
                        <View className="flex-row items-center bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full gap-1">
                          <View className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          <Text className="text-emerald-400 text-[9px] font-black uppercase">
                            Connected
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text
                      style={{ color: colors.textSecondary }}
                      className="text-[10px] font-medium mt-0.5"
                    >
                      {isGoogleLinked ? 'Sign in with Google' : 'Not linked to this account'}
                    </Text>
                  </View>
                </View>

                {isGoogleLinked ? (
                  <TouchableOpacity
                    disabled={unlinkingProvider === 'google'}
                    onPress={() => handleUnlink('google')}
                    className="px-4 py-2 rounded-full border border-red-500/25 bg-red-500/10"
                    activeOpacity={0.7}
                  >
                    {unlinkingProvider === 'google' ? (
                      <ActivityIndicator size="small" color="#EF4444" />
                    ) : (
                      <Text className="text-red-400 text-xs font-bold">Disconnect</Text>
                    )}
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    onPress={() => handleConnect('google')}
                    style={{
                      backgroundColor: `${colors.primary}1a`,
                      borderColor: `${colors.primary}33`,
                    }}
                    className="px-4 py-2 rounded-full border"
                    activeOpacity={0.7}
                  >
                    <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>
                      Connect
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Apple Row */}
              <View className="flex-row items-center justify-between pt-4">
                <View className="flex-row items-center flex-1 mr-3">
                  <View
                    className="w-12 h-12 rounded-[18px] items-center justify-center mr-4 border"
                    style={{ backgroundColor: colors.background, borderColor: colors.border }}
                  >
                    <AppleIcon size={20} color={colors.text} />
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-center gap-2">
                      <Text
                        style={{ color: colors.text }}
                        className="font-bold text-base"
                      >
                        Apple
                      </Text>
                      {isAppleLinked && (
                        <View className="flex-row items-center bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full gap-1">
                          <View className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          <Text className="text-emerald-400 text-[9px] font-black uppercase">
                            Connected
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text
                      style={{ color: colors.textSecondary }}
                      className="text-[10px] font-medium mt-0.5"
                    >
                      {isAppleLinked ? 'Sign in with Apple ID' : 'Not linked to this account'}
                    </Text>
                  </View>
                </View>

                {isAppleLinked ? (
                  <TouchableOpacity
                    disabled={unlinkingProvider === 'apple'}
                    onPress={() => handleUnlink('apple')}
                    className="px-4 py-2 rounded-full border border-red-500/25 bg-red-500/10"
                    activeOpacity={0.7}
                  >
                    {unlinkingProvider === 'apple' ? (
                      <ActivityIndicator size="small" color="#EF4444" />
                    ) : (
                      <Text className="text-red-400 text-xs font-bold">Disconnect</Text>
                    )}
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    onPress={() => handleConnect('apple')}
                    style={{
                      backgroundColor: `${colors.primary}1a`,
                      borderColor: `${colors.primary}33`,
                    }}
                    className="px-4 py-2 rounded-full border"
                    activeOpacity={0.7}
                  >
                    <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>
                      Connect
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </MotiView>
        </ScrollView>
      </View>

      {/* MODAL: CHANGE EMAIL */}
      <Modal
        visible={showEmailModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEmailModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 }}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              setShowEmailModal(false);
            }}
          />
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }}
            className="rounded-[32px] p-6 shadow-2xl"
          >
            <View className="flex-row items-center justify-between mb-4">
              <Text style={{ color: colors.text }} className="text-xl font-black">
                Change Email
              </Text>
              <TouchableOpacity
                onPress={() => setShowEmailModal(false)}
                style={{ backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1 }}
                className="w-9 h-9 rounded-full items-center justify-center"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={{ color: colors.textSecondary }} className="text-xs mb-4">
              Enter your new email address. We will send a confirmation link to confirm it.
            </Text>

            <View
              style={{ backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1 }}
              className="flex-row items-center px-4 h-14 rounded-2xl mb-6"
            >
              <Mail size={18} color={colors.textSecondary} />
              <TextInput
                value={newEmail}
                onChangeText={setNewEmail}
                placeholder="New email address"
                placeholderTextColor={colors.textSecondary}
                keyboardType="email-address"
                autoCapitalize="none"
                style={{ color: colors.text, flex: 1, marginLeft: 12, fontSize: 15 }}
              />
            </View>

            <TouchableOpacity
              disabled={updatingEmail}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                handleUpdateEmail();
              }}
              style={{
                backgroundColor: colors.primary,
                shadowColor: colors.primary,
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.35,
                shadowRadius: 12,
                elevation: 6,
              }}
              className="w-full h-14 rounded-2xl items-center justify-center"
              activeOpacity={0.8}
            >
              {updatingEmail ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text className="text-white font-extrabold text-base tracking-wide">Update Email</Text>
              )}
            </TouchableOpacity>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* MODAL: CHANGE PASSWORD */}
      <Modal
        visible={showPasswordModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPasswordModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 }}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              setShowPasswordModal(false);
            }}
          />
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }}
            className="rounded-[32px] p-6 shadow-2xl"
          >
            <View className="flex-row items-center justify-between mb-5">
              <Text style={{ color: colors.text }} className="text-xl font-black">
                Change Password
              </Text>
              <TouchableOpacity
                onPress={() => setShowPasswordModal(false)}
                style={{ backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1 }}
                className="w-9 h-9 rounded-full items-center justify-center"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Current Password */}
            <Text style={{ color: colors.textSecondary }} className="text-xs font-bold mb-2 px-1">
              Current Password
            </Text>
            <View
              style={{ backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1 }}
              className="flex-row items-center px-4 h-14 rounded-2xl mb-1"
            >
              <Lock size={18} color={colors.textSecondary} />
              <TextInput
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="Enter current password"
                placeholderTextColor={colors.textSecondary}
                secureTextEntry={!showCurrentPassword}
                autoCapitalize="none"
                style={{ color: colors.text, flex: 1, marginLeft: 12, fontSize: 15 }}
              />
              <TouchableOpacity
                onPress={() => setShowCurrentPassword((prev) => !prev)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                {showCurrentPassword ? (
                  <EyeOff size={18} color={colors.textSecondary} />
                ) : (
                  <Eye size={18} color={colors.textSecondary} />
                )}
              </TouchableOpacity>
            </View>

            {/* Divider and Spacing */}
            <View
              style={{ height: 1, backgroundColor: colors.border }}
              className="my-5"
            />

            {/* New Password */}
            <Text style={{ color: colors.textSecondary }} className="text-xs font-bold mb-2 px-1">
              New Password (minimum 6 characters)
            </Text>
            <View
              style={{ backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1 }}
              className="flex-row items-center px-4 h-14 rounded-2xl mb-4"
            >
              <Lock size={18} color={colors.textSecondary} />
              <TextInput
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Enter new password"
                placeholderTextColor={colors.textSecondary}
                secureTextEntry={!showNewPassword}
                autoCapitalize="none"
                style={{ color: colors.text, flex: 1, marginLeft: 12, fontSize: 15 }}
              />
              <TouchableOpacity
                onPress={() => setShowNewPassword((prev) => !prev)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                {showNewPassword ? (
                  <EyeOff size={18} color={colors.textSecondary} />
                ) : (
                  <Eye size={18} color={colors.textSecondary} />
                )}
              </TouchableOpacity>
            </View>

            {/* Confirm Password */}
            <Text style={{ color: colors.textSecondary }} className="text-xs font-bold mb-2 px-1">
              Confirm New Password
            </Text>
            <View
              style={{ backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1 }}
              className="flex-row items-center px-4 h-14 rounded-2xl mb-6"
            >
              <Lock size={18} color={colors.textSecondary} />
              <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Re-enter new password"
                placeholderTextColor={colors.textSecondary}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                style={{ color: colors.text, flex: 1, marginLeft: 12, fontSize: 15 }}
              />
              <TouchableOpacity
                onPress={() => setShowConfirmPassword((prev) => !prev)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                {showConfirmPassword ? (
                  <EyeOff size={18} color={colors.textSecondary} />
                ) : (
                  <Eye size={18} color={colors.textSecondary} />
                )}
              </TouchableOpacity>
            </View>

            {/* Save Password Button (Full Width, No Cancel Button) */}
            <TouchableOpacity
              disabled={updatingPassword}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                handleUpdatePassword();
              }}
              style={{
                backgroundColor: colors.primary,
                shadowColor: colors.primary,
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.35,
                shadowRadius: 12,
                elevation: 6,
              }}
              className="w-full h-14 rounded-2xl items-center justify-center"
              activeOpacity={0.8}
            >
              {updatingPassword ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text className="text-white font-extrabold text-base tracking-wide">
                  Save Password
                </Text>
              )}
            </TouchableOpacity>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
