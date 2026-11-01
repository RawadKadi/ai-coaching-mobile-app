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
  CheckCircle2,
  X,
  AlertCircle,
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

  const cardBg = isDark ? '#111827' : colors.surface;
  const cardBorder = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.08)';
  const inputBg = isDark ? '#1E293B' : 'rgba(15, 23, 42, 0.04)';
  const inputBorder = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(15, 23, 42, 0.12)';

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
              safeBack(fallbackBackRoute);
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
              Account & Security
            </Text>
            <Text
              style={{ color: colors.textSecondary || '#94A3B8' }}
              className="text-[10px] font-bold uppercase tracking-widest mt-0.5"
            >
              Credentials & Login
            </Text>
          </View>

          <View className="w-10" />
        </View>

        <ScrollView
          className="flex-1 px-4 pt-6"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
        >
          {/* SECTION A: EMAIL & CREDENTIALS */}
          <View className="mb-8">
            <Text
              style={{ color: colors.textSecondary || '#64748B' }}
              className="text-[11px] font-black uppercase tracking-[2px] px-2 mb-3"
            >
              Email & Password
            </Text>

            {/* Email Card */}
            <MotiView
              from={reduceMotion ? undefined : { opacity: 0, translateY: 10 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ delay: 50 }}
              style={{ backgroundColor: cardBg, borderColor: cardBorder, borderWidth: 1 }}
              className="p-4 rounded-3xl mb-4"
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center flex-1 mr-3">
                  <View
                    style={{
                      backgroundColor: `${colors.primary}18`,
                      borderColor: `${colors.primary}30`,
                      borderWidth: 1,
                    }}
                    className="w-12 h-12 rounded-2xl items-center justify-center mr-3.5"
                  >
                    <Mail size={22} color={colors.primary} />
                  </View>
                  <View className="flex-1">
                    <Text
                      style={{ color: colors.textSecondary || '#94A3B8' }}
                      className="text-xs font-semibold uppercase tracking-wider"
                    >
                      Email Address
                    </Text>
                    <Text
                      style={{ color: colors.text || '#FFFFFF' }}
                      className="text-base font-bold mt-0.5"
                      numberOfLines={1}
                    >
                      {user?.email || 'Not available'}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    setNewEmail(user?.email || '');
                    setShowEmailModal(true);
                  }}
                  style={{ backgroundColor: `${colors.primary}15`, borderColor: `${colors.primary}30` }}
                  className="px-3.5 py-2 rounded-xl border"
                  activeOpacity={0.7}
                >
                  <Text style={{ color: colors.primary }} className="text-xs font-bold">
                    Change
                  </Text>
                </TouchableOpacity>
              </View>
            </MotiView>

            {/* Password Card */}
            <MotiView
              from={reduceMotion ? undefined : { opacity: 0, translateY: 10 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ delay: 100 }}
              style={{ backgroundColor: cardBg, borderColor: cardBorder, borderWidth: 1 }}
              className="p-4 rounded-3xl"
            >
              {isOAuthUser ? (
                // 3rd-Party OAuth User
                <View className="flex-row items-start">
                  <View
                    style={{
                      backgroundColor: 'rgba(59, 130, 246, 0.12)',
                      borderColor: 'rgba(59, 130, 246, 0.25)',
                      borderWidth: 1,
                    }}
                    className="w-12 h-12 rounded-2xl items-center justify-center mr-3.5"
                  >
                    <ShieldCheck size={22} color="#3B82F6" />
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-center gap-2">
                      <Text
                        style={{ color: colors.text || '#FFFFFF' }}
                        className="text-base font-bold"
                      >
                        Password
                      </Text>
                      <View className="bg-blue-500/15 border border-blue-500/30 px-2.5 py-0.5 rounded-full">
                        <Text className="text-blue-400 text-[10px] font-black uppercase">
                          Single Sign-On
                        </Text>
                      </View>
                    </View>
                    <Text
                      style={{ color: colors.textSecondary || '#94A3B8' }}
                      className="text-xs font-medium mt-1 leading-5"
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
                      style={{
                        backgroundColor: `${colors.primary}18`,
                        borderColor: `${colors.primary}30`,
                        borderWidth: 1,
                      }}
                      className="w-12 h-12 rounded-2xl items-center justify-center mr-3.5"
                    >
                      <Lock size={22} color={colors.primary} />
                    </View>
                    <View className="flex-1">
                      <Text
                        style={{ color: colors.textSecondary || '#94A3B8' }}
                        className="text-xs font-semibold uppercase tracking-wider"
                      >
                        Password
                      </Text>
                      <Text
                        style={{ color: colors.text || '#FFFFFF' }}
                        className="text-base font-bold mt-0.5 tracking-widest"
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
                    style={{ backgroundColor: `${colors.primary}15`, borderColor: `${colors.primary}30` }}
                    className="px-3.5 py-2 rounded-xl border"
                    activeOpacity={0.7}
                  >
                    <Text style={{ color: colors.primary }} className="text-xs font-bold">
                      Change
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </MotiView>
          </View>

          {/* SECTION B: CONNECTED ACCOUNTS */}
          <View className="mb-8">
            <Text
              style={{ color: colors.textSecondary || '#64748B' }}
              className="text-[11px] font-black uppercase tracking-[2px] px-2 mb-3"
            >
              Connected Accounts
            </Text>

            <MotiView
              from={reduceMotion ? undefined : { opacity: 0, translateY: 10 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ delay: 150 }}
              style={{ backgroundColor: cardBg, borderColor: cardBorder, borderWidth: 1 }}
              className="p-4 rounded-3xl"
            >
              {/* Google Row */}
              <View className="flex-row items-center justify-between py-2 border-b" style={{ borderBottomColor: cardBorder }}>
                <View className="flex-row items-center flex-1 mr-3">
                  <View
                    style={{
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
                      borderColor: cardBorder,
                      borderWidth: 1,
                    }}
                    className="w-12 h-12 rounded-2xl items-center justify-center mr-3.5"
                  >
                    <GoogleIcon size={24} />
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-center gap-2">
                      <Text
                        style={{ color: colors.text || '#FFFFFF' }}
                        className="text-base font-bold"
                      >
                        Google
                      </Text>
                      {isGoogleLinked && (
                        <View className="flex-row items-center bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full gap-1">
                          <View className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          <Text className="text-emerald-400 text-[10px] font-bold uppercase">
                            Connected
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text
                      style={{ color: colors.textSecondary || '#94A3B8' }}
                      className="text-xs font-medium mt-0.5"
                    >
                      {isGoogleLinked ? 'Sign in with your Google account' : 'Not linked to this account'}
                    </Text>
                  </View>
                </View>

                {isGoogleLinked ? (
                  <TouchableOpacity
                    disabled={unlinkingProvider === 'google'}
                    onPress={() => handleUnlink('google')}
                    className="px-3.5 py-2 rounded-xl bg-red-500/10 border border-red-500/20"
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
                    style={{ backgroundColor: `${colors.primary}15`, borderColor: `${colors.primary}30` }}
                    className="px-3.5 py-2 rounded-xl border"
                    activeOpacity={0.7}
                  >
                    <Text style={{ color: colors.primary }} className="text-xs font-bold">
                      Connect
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Apple Row */}
              <View className="flex-row items-center justify-between py-2 mt-2">
                <View className="flex-row items-center flex-1 mr-3">
                  <View
                    style={{
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
                      borderColor: cardBorder,
                      borderWidth: 1,
                    }}
                    className="w-12 h-12 rounded-2xl items-center justify-center mr-3.5"
                  >
                    <AppleIcon size={22} color={colors.text || '#FFFFFF'} />
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-center gap-2">
                      <Text
                        style={{ color: colors.text || '#FFFFFF' }}
                        className="text-base font-bold"
                      >
                        Apple
                      </Text>
                      {isAppleLinked && (
                        <View className="flex-row items-center bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full gap-1">
                          <View className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          <Text className="text-emerald-400 text-[10px] font-bold uppercase">
                            Connected
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text
                      style={{ color: colors.textSecondary || '#94A3B8' }}
                      className="text-xs font-medium mt-0.5"
                    >
                      {isAppleLinked ? 'Sign in with your Apple ID' : 'Not linked to this account'}
                    </Text>
                  </View>
                </View>

                {isAppleLinked ? (
                  <TouchableOpacity
                    disabled={unlinkingProvider === 'apple'}
                    onPress={() => handleUnlink('apple')}
                    className="px-3.5 py-2 rounded-xl bg-red-500/10 border border-red-500/20"
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
                    style={{ backgroundColor: `${colors.primary}15`, borderColor: `${colors.primary}30` }}
                    className="px-3.5 py-2 rounded-xl border"
                    activeOpacity={0.7}
                  >
                    <Text style={{ color: colors.primary }} className="text-xs font-bold">
                      Connect
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </MotiView>
          </View>
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
          <View
            style={{ backgroundColor: cardBg, borderColor: cardBorder, borderWidth: 1 }}
            className="rounded-3xl p-6 shadow-2xl"
          >
            <View className="flex-row items-center justify-between mb-4">
              <Text style={{ color: colors.text || '#FFFFFF' }} className="text-lg font-black">
                Change Email
              </Text>
              <TouchableOpacity
                onPress={() => setShowEmailModal(false)}
                className="w-8 h-8 rounded-full bg-slate-800/60 items-center justify-center"
              >
                <X size={18} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <Text style={{ color: colors.textSecondary || '#94A3B8' }} className="text-xs mb-4">
              Enter your new email address. We will send a confirmation link to confirm it.
            </Text>

            <View
              style={{ backgroundColor: inputBg, borderColor: inputBorder, borderWidth: 1 }}
              className="flex-row items-center px-4 py-3 rounded-2xl mb-6"
            >
              <Mail size={18} color={colors.textSecondary || '#94A3B8'} />
              <TextInput
                value={newEmail}
                onChangeText={setNewEmail}
                placeholder="New email address"
                placeholderTextColor={colors.textSecondary || '#64748B'}
                keyboardType="email-address"
                autoCapitalize="none"
                style={{ color: colors.text || '#FFFFFF', flex: 1, marginLeft: 12, fontSize: 15 }}
              />
            </View>

            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setShowEmailModal(false)}
                className="flex-1 py-3.5 rounded-2xl items-center bg-slate-800"
                activeOpacity={0.7}
              >
                <Text style={{ color: colors.textSecondary || '#94A3B8' }} className="font-bold text-sm">
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                disabled={updatingEmail}
                onPress={handleUpdateEmail}
                style={{ backgroundColor: colors.primary }}
                className="flex-1 py-3.5 rounded-2xl items-center justify-center"
                activeOpacity={0.7}
              >
                {updatingEmail ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text className="text-white font-bold text-sm">Update Email</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
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
          <View
            style={{ backgroundColor: cardBg, borderColor: cardBorder, borderWidth: 1 }}
            className="rounded-3xl p-6 shadow-2xl"
          >
            <View className="flex-row items-center justify-between mb-4">
              <Text style={{ color: colors.text || '#FFFFFF' }} className="text-lg font-black">
                Change Password
              </Text>
              <TouchableOpacity
                onPress={() => setShowPasswordModal(false)}
                className="w-8 h-8 rounded-full bg-slate-800/60 items-center justify-center"
              >
                <X size={18} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            {/* Current Password */}
            <Text style={{ color: colors.textSecondary || '#94A3B8' }} className="text-xs font-bold mb-1.5 px-1">
              Current Password
            </Text>
            <View
              style={{ backgroundColor: inputBg, borderColor: inputBorder, borderWidth: 1 }}
              className="flex-row items-center px-4 py-3 rounded-2xl mb-4"
            >
              <Lock size={18} color={colors.textSecondary || '#94A3B8'} />
              <TextInput
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="Enter current password"
                placeholderTextColor={colors.textSecondary || '#64748B'}
                secureTextEntry={!showCurrentPassword}
                autoCapitalize="none"
                style={{ color: colors.text || '#FFFFFF', flex: 1, marginLeft: 12, fontSize: 14 }}
              />
              <TouchableOpacity onPress={() => setShowCurrentPassword((prev) => !prev)}>
                {showCurrentPassword ? (
                  <EyeOff size={18} color={colors.textSecondary || '#94A3B8'} />
                ) : (
                  <Eye size={18} color={colors.textSecondary || '#94A3B8'} />
                )}
              </TouchableOpacity>
            </View>

            {/* New Password */}
            <Text style={{ color: colors.textSecondary || '#94A3B8' }} className="text-xs font-bold mb-1.5 px-1">
              New Password (minimum 6 characters)
            </Text>
            <View
              style={{ backgroundColor: inputBg, borderColor: inputBorder, borderWidth: 1 }}
              className="flex-row items-center px-4 py-3 rounded-2xl mb-4"
            >
              <Lock size={18} color={colors.textSecondary || '#94A3B8'} />
              <TextInput
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Enter new password"
                placeholderTextColor={colors.textSecondary || '#64748B'}
                secureTextEntry={!showNewPassword}
                autoCapitalize="none"
                style={{ color: colors.text || '#FFFFFF', flex: 1, marginLeft: 12, fontSize: 14 }}
              />
              <TouchableOpacity onPress={() => setShowNewPassword((prev) => !prev)}>
                {showNewPassword ? (
                  <EyeOff size={18} color={colors.textSecondary || '#94A3B8'} />
                ) : (
                  <Eye size={18} color={colors.textSecondary || '#94A3B8'} />
                )}
              </TouchableOpacity>
            </View>

            {/* Confirm Password */}
            <Text style={{ color: colors.textSecondary || '#94A3B8' }} className="text-xs font-bold mb-1.5 px-1">
              Confirm New Password
            </Text>
            <View
              style={{ backgroundColor: inputBg, borderColor: inputBorder, borderWidth: 1 }}
              className="flex-row items-center px-4 py-3 rounded-2xl mb-6"
            >
              <Lock size={18} color={colors.textSecondary || '#94A3B8'} />
              <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Re-enter new password"
                placeholderTextColor={colors.textSecondary || '#64748B'}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                style={{ color: colors.text || '#FFFFFF', flex: 1, marginLeft: 12, fontSize: 14 }}
              />
              <TouchableOpacity onPress={() => setShowConfirmPassword((prev) => !prev)}>
                {showConfirmPassword ? (
                  <EyeOff size={18} color={colors.textSecondary || '#94A3B8'} />
                ) : (
                  <Eye size={18} color={colors.textSecondary || '#94A3B8'} />
                )}
              </TouchableOpacity>
            </View>

            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setShowPasswordModal(false)}
                className="flex-1 py-3.5 rounded-2xl items-center bg-slate-800"
                activeOpacity={0.7}
              >
                <Text style={{ color: colors.textSecondary || '#94A3B8' }} className="font-bold text-sm">
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                disabled={updatingPassword}
                onPress={handleUpdatePassword}
                style={{ backgroundColor: colors.primary }}
                className="flex-1 py-3.5 rounded-2xl items-center justify-center"
                activeOpacity={0.7}
              >
                {updatingPassword ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text className="text-white font-bold text-sm">Save Password</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
