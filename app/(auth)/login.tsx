import React, { useState } from 'react';
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
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { Eye, EyeOff, Mail, Lock, LogIn, Sparkles, ShieldCheck, ChevronRight } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MotiView, AnimatePresence } from 'moti';

const PENDING_INVITE_KEY = '@pending_invite_token';

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please enter your email and password.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await signIn(email, password);
      const pendingInvite = await AsyncStorage.getItem(PENDING_INVITE_KEY);
      if (pendingInvite) {
        router.replace({ pathname: '/(coach)/join-team', params: { invite: pendingInvite } });
      }
    } catch (err: any) {
      setError(err.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1 }} className="bg-slate-950">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <SafeAreaView style={{ flex: 1 }}>
          <ScrollView 
            contentContainerStyle={{ flexGrow: 1 }} 
            showsVerticalScrollIndicator={false}
          >
            <View className="flex-1 px-8 pt-20 pb-12">
              {/* Brand Header */}
              <MotiView 
                from={{ opacity: 0, scale: 0.9 }} 
                animate={{ opacity: 1, scale: 1 }}
                className="items-center mb-16"
              >
                <View className="w-20 h-20 bg-blue-600 rounded-[30px] items-center justify-center shadow-2xl shadow-blue-500/40 border-2 border-white/10 mb-6">
                  <ShieldCheck size={40} color="white" />
                </View>
                <Text className="text-white text-4xl font-black text-center tracking-tight">
                  NEURAL<Text className="text-blue-500">SYNC</Text>
                </Text>
                <Text className="text-slate-500 text-[10px] font-black uppercase tracking-[6px] mt-2">
                  Version 3.0
                </Text>
              </MotiView>

              {/* Error Alert */}
              <AnimatePresence>
                {error && (
                  <MotiView 
                    from={{ opacity: 0, translateY: -10 }} 
                    animate={{ opacity: 1, translateY: 0 }} 
                    exit={{ opacity: 0, translateY: -10 }}
                    className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 mb-10 flex-row items-center gap-3"
                  >
                    <View className="w-2 h-2 rounded-full bg-red-500" />
                    <Text className="text-red-400 text-xs font-bold flex-1">{error}</Text>
                  </MotiView>
                )}
              </AnimatePresence>

              {/* Form Matrix */}
              <View>
                <View className="mb-6">
                  <View className="bg-slate-900/50 border border-slate-900 rounded-[32px] px-6 py-2 flex-row items-center gap-4">
                    <Mail size={20} color="#64748B" />
                    <TextInput
                      className="flex-1 text-white text-2xl  h-14"
                      placeholder="Email"
                      placeholderTextColor="#64748B"
                      value={email}
                      onChangeText={setEmail}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      selectionColor="#3B82F6"
                    />
                  </View>
                </View>

                <View className="mb-8">
                  <View className="bg-slate-900/50 border border-slate-900 rounded-[32px] px-6 py-2 flex-row items-center gap-4">
                    <Lock size={20} color="#64748B" />
                    <TextInput
                      className="flex-1 text-white text-2xl h-14"
                      placeholder="Password"
                      placeholderTextColor="#64748B"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      selectionColor="#3B82F6"
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                      {showPassword ? <EyeOff size={20} color="#64748B" /> : <Eye size={20} color="#64748B" />}
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity 
                   className="bg-blue-600 h-20 rounded-[36px] items-center justify-center flex-row gap-3 shadow-2xl shadow-blue-500/20 border-b-4 border-blue-700"
                   onPress={handleLogin}
                   disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <>
                      <Text className="text-white font-black text-xl">LOGIN</Text>
                      <LogIn size={20} color="white" />
                    </>
                  )}
                </TouchableOpacity>

                <View className="pt-10 items-center">
                  <TouchableOpacity onPress={() => router.push({ pathname: '/(auth)/signup' })}>
                    <Text className="text-slate-500 font-bold text-xs uppercase tracking-widest">
                      New user? <Text className="text-blue-500">Create Account</Text>
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Footer */}
              <View className="mt-auto items-center pt-20">
                <View className="flex-row items-center gap-2 mb-2">
                  <Sparkles size={12} color="#1E293B" />
                  <Text className="text-slate-800 text-[10px] font-black uppercase tracking-[4px]">
                    Encrypted Connection
                  </Text>
                </View>
                <Text className="text-slate-900 text-[8px] font-bold uppercase">
                  Secure login protected by NeuralSync
                </Text>
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}
