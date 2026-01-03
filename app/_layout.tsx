import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { UnreadProvider } from '@/contexts/UnreadContext';
import { NotificationProvider, useNotification } from '@/contexts/NotificationContext';
import NotificationToast from '@/components/NotificationToast';
import { loadNotificationSound, unloadNotificationSound } from '@/lib/notification-sound';

function RootLayoutNav() {
  const { session, loading, profile } = useAuth();
  const segments = useSegments() as string[];
  const router = useRouter();
  const { activeToast, dismissToast } = useNotification();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inOnboarding = segments.includes('onboarding');

    if (!session && !inAuthGroup) {
      // Redirect to the sign-in page.
      router.replace('/(auth)/login');
    } else if (session && profile) {
      // Redirect to dashboard if in auth group or root
      if (inAuthGroup || segments.length === 0 || (segments.length === 1 && segments[0] === 'index')) {
        if (profile.role === 'client') {
          // STRICT CHECK: Force onboarding if not completed
          if (profile.onboarding_completed !== true) {
            console.log('[Routing] Client onboarding not completed, redirecting to onboarding');
            router.replace('/(client)/onboarding');
          } else {
            console.log('[Routing] Client onboarding completed, going to dashboard');
            router.replace('/(client)/(tabs)');
          }
        } else if (profile.role === 'coach') {
          router.replace('/(coach)/(tabs)');
        } else if (profile.role === 'admin') {
          router.replace('/(admin)/(tabs)');
        }
      } else if (profile.role === 'client' && profile.onboarding_completed !== true && !inOnboarding) {
        // Additional safeguard: if client is anywhere except onboarding and hasn't completed it, redirect
        console.log('[Routing] Client accessed non-onboarding route without completing onboarding');
        router.replace('/(client)/onboarding');
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
      
      {/* Global notification toast */}
      {activeToast && (
        <NotificationToast
          senderName={activeToast.senderName}
          message={activeToast.message}
          onPress={() => router.push(activeToast.navigateTo as any)}
          onDismiss={dismissToast}
        />
      )}
    </>
  );
}

export default function RootLayout() {
  useFrameworkReady();

  // Load notification sound on app start
  useEffect(() => {
    loadNotificationSound();
    
    return () => {
      unloadNotificationSound();
    };
  }, []);

  return (
    <AuthProvider>
      <UnreadProvider>
        <NotificationProvider>
          <RootLayoutNav />
        </NotificationProvider>
      </UnreadProvider>
    </AuthProvider>
  );
}
