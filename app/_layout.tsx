import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';

function RootLayoutNav() {
  const { session, loading, profile } = useAuth();
  const segments = useSegments() as string[];
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!session && !inAuthGroup) {
      // Redirect to the sign-in page.
      router.replace('/(auth)/login');
    } else if (session && profile) {
      // Redirect to dashboard if in auth group or root
      if (inAuthGroup || segments.length === 0 || (segments.length === 1 && segments[0] === 'index')) {
        if (profile.role === 'client') {
          if (!profile.onboarding_completed) {
            router.replace('/(client)/onboarding');
          } else {
            router.replace('/(client)/(tabs)');
          }
        } else if (profile.role === 'coach') {
          router.replace('/(coach)/(tabs)');
        } else if (profile.role === 'admin') {
          router.replace('/(admin)/(tabs)');
        }
      }
    }
  }, [session, loading, segments, profile]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(client)" />
        <Stack.Screen name="(coach)" />
        <Stack.Screen name="(admin)" />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style="auto" />
    </>
  );
}

export default function RootLayout() {
  useFrameworkReady();

  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}
