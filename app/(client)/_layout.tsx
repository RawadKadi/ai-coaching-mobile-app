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

  if (loading || !session || profile?.role !== 'client') {
    return (
      <View style={{ flex: 1, backgroundColor: '#020617', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="challenges" />
      </Stack>
      
      <SessionMonitor router={router} />
    </>
  );
}
