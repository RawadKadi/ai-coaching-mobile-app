import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export default function AuthLayout() {
  const { session, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && session && profile) {
      if (profile.role === 'coach') {
        router.replace('/(coach)/(tabs)');
      } else if (profile.role === 'client') {
        router.replace('/(client)/(tabs)');
      }
    }
  }, [session, profile, loading]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
    </Stack>
  );
}
