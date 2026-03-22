import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { validateInviteCode } from '@/lib/brand-service';
import { supabase } from '@/lib/supabase';
import { MotiView, AnimatePresence } from 'moti';
import { User, Mail, Lock, UserPlus, AlertCircle, ChevronLeft, Sparkles, Shield } from 'lucide-react-native';

export default function SignUpScreen() {
  const router = useRouter();
  const { signUp } = useAuth();
  const { invite: inviteParam } = useLocalSearchParams<{ invite?: string }>();
  
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<'client' | 'coach'>('client');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [inviteCode, setInviteCode] = useState(inviteParam || '');
  const [validatingInvite, setValidatingInvite] = useState(false);

  useEffect(() => {
    if (inviteParam) {
      if (inviteParam.length > 20) {
        setRole('coach');
        validateSubCoachInvite(inviteParam);
      } else {
        setRole('client');
        validateInvite(inviteParam);
      }
    }
  }, [inviteParam]);

  const validateSubCoachInvite = async (token: string) => {
    setValidatingInvite(true);
    try {
      const { data, error } = await supabase.rpc('validate_subcoach_invite', { p_invite_token: token });
      if (error) throw error;
    } catch (err) {
      console.error('Invite validation failed:', err);
    } finally {
      setValidatingInvite(false);
    }
  };

  const validateInvite = async (code: string) => {
    if (!code) return;
    setValidatingInvite(true);
    try {
      await validateInviteCode(code);
    } catch (error) {
      console.error('Invite validation failed:', error);
    } finally {
      setValidatingInvite(false);
    }
  };

  const handleSignUp = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!fullName || !cleanEmail || !password || !confirmPassword) {
      setError('Please fill in all fields.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const success = await signUp(cleanEmail, password, fullName, role, inviteCode || undefined);
      if (success) {
        router.replace('/');
      }
    } catch (err: any) {
      setError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1 }} className="bg-slate-950">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
            <View className="flex-1 px-8 pt-12 pb-12">
              <TouchableOpacity onPress={() => router.back()} className="mb-8 w-12 h-12 bg-slate-900 rounded-2xl items-center justify-center border border-slate-800">
                <ChevronLeft size={20} color="#94A3B8" />
              </TouchableOpacity>

              <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} className="mb-10">
                <Text className="text-white text-4xl font-black tracking-tight uppercase">Create <Text className="text-blue-500">Account</Text></Text>
                <Text className="text-slate-500 text-[10px] font-black uppercase tracking-[4px] mt-2">Join to get started</Text>
              </MotiView>

              <AnimatePresence>
                {error && (
                  <MotiView from={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 mb-8 flex-row items-center gap-3">
                    <AlertCircle size={18} color="#EF4444" />
                    <Text className="text-red-400 text-xs font-bold flex-1">{error}</Text>
                  </MotiView>
                )}
              </AnimatePresence>

              <View>
                {/* User Type Selection */}
                {!inviteParam && (
                  <View className="flex-row bg-slate-900/50 p-1.5 rounded-[24px] border border-slate-900 mb-10">
                    <TouchableOpacity onPress={() => setRole('client')} className={`flex-1 py-3 items-center rounded-[18px] ${role === 'client' ? 'bg-blue-600 shadow-lg' : ''}`}>
                      <Text className={`font-black text-[10px] uppercase tracking-widest ${role === 'client' ? 'text-white' : 'text-slate-500'}`}>Client</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setRole('coach')} className={`flex-1 py-3 items-center rounded-[18px] ${role === 'coach' ? 'bg-blue-600 shadow-lg' : ''}`}>
                      <Text className={`font-black text-[10px] uppercase tracking-widest ${role === 'coach' ? 'text-white' : 'text-slate-500'}`}>Coach</Text>
                    </TouchableOpacity>
                  </View>
                )}

                <InputField icon={<User size={20} color="#64748B" />} placeholder="Full Name" value={fullName} onChange={setFullName} />
                <InputField icon={<Mail size={20} color="#64748B" />} placeholder="Email Address" value={email} onChange={setEmail} keyboardType="email-address" />
                <InputField icon={<Lock size={20} color="#64748B" />} placeholder="Password" value={password} onChange={setPassword} secure />
                <InputField icon={<Lock size={20} color="#64748B" />} placeholder="Confirm Password" value={confirmPassword} onChange={setConfirmPassword} secure />

                {role === 'client' && !inviteCode && (
                  <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <InputField icon={<Shield size={20} color="#64748B" />} placeholder="Invite Code (Optional)" value={inviteCode} onChange={(t: string) => { setInviteCode(t); if (t.length >= 8) validateInvite(t); }} />
                  </MotiView>
                )}

                <TouchableOpacity 
                   className="mt-8 bg-blue-600 h-20 rounded-[36px] items-center justify-center flex-row gap-3 shadow-2xl shadow-blue-500/20 border-b-4 border-blue-700"
                   onPress={handleSignUp}
                   disabled={loading || validatingInvite}
                >
                  {loading ? <ActivityIndicator color="white" /> : (
                    <>
                      <Text className="text-white font-black text-xl text-center">CREATE ACCOUNT</Text>
                      <UserPlus size={20} color="white" />
                    </>
                  )}
                </TouchableOpacity>
              </View>

              <View className="mt-12 items-center">
                <Text className="text-slate-800 text-[8px] font-black uppercase tracking-[6px] text-center px-4 leading-4">
                  Secure Connection guaranteed • End-to-End Encryption
                </Text>
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}

const InputField = ({ icon, placeholder, value, onChange, secure, keyboardType }: any) => (
  <View className="mb-6">
    <View className="bg-slate-900/50 border border-slate-900 rounded-[28px] px-6 py-4 flex-row items-center gap-4">
      {icon}
      <TextInput
        className="flex-1 text-white font-bold text-lg"
        placeholder={placeholder}
        placeholderTextColor="#64748B"
        value={value}
        onChangeText={onChange}
        secureTextEntry={secure}
        keyboardType={keyboardType}
        selectionColor="#3B82F6"
        autoCapitalize="none"
      />
    </View>
  </View>
);
