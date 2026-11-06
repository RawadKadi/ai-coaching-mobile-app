import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useBrand } from '@/contexts/BrandContext';

export default function AuthLayout() {
  const { session, profile, loading } = useAuth();
  const { loading: brandLoading, isCacheHydrated } = useBrand();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !brandLoading && isCacheHydrated && session && profile) {
      if (profile.role === 'coach') {
        router.replace('/(coach)/(tabs)');
      } else if (profile.role === 'client') {
        router.replace('/(client)/(tabs)');
      }
    }
  }, [session, profile, loading, brandLoading, isCacheHydrated]);

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="signup-coach" />
      <Stack.Screen name="signup-email" />
      <Stack.Screen name="signup-client" />
    </Stack>
  );
}
