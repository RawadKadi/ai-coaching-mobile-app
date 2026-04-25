import { View, ActivityIndicator } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import SessionMonitor from '@/components/SessionMonitor';

export default function ClientLayout() {
  const router = useRouter();
  const { session, profile, loading } = useAuth();
  const segments = useSegments() as string[];
  const inOnboarding = segments.includes('onboarding');

  useEffect(() => {
    if (!loading) {
      if (!session) {
        router.replace('/(auth)/login');
      } else if (profile?.role === 'coach') {
        router.replace('/(coach)/(tabs)');
      } else if (profile?.role === 'client' && profile.onboarding_completed !== true && !inOnboarding) {
        router.replace('/(client)/onboarding');
      }
    }
  }, [session, profile, loading, segments]);

  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="challenges" />
        <Stack.Screen name="chat" />
        <Stack.Screen name="check-in" />
        <Stack.Screen name="log-meal" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="onboarding" />
      </Stack>
      
      {(loading || !session || profile?.role !== 'client') && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#020617', justifyContent: 'center', alignItems: 'center', zIndex: 100 }}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      )}

      <SessionMonitor router={router} />
    </View>
  );
}
