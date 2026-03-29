import 'react-native-reanimated';
import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { useAppFonts } from '@/hooks/useAppFonts';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { BrandProvider } from '@/contexts/BrandContext';
import { UnreadProvider } from '@/contexts/UnreadContext';
import { NotificationProvider, useNotification } from '@/contexts/NotificationContext';
import NotificationToast from '@/components/NotificationToast';
import { loadNotificationSound, unloadNotificationSound } from '@/lib/notification-sound';
import SessionMonitor from '@/components/SessionMonitor';
import TeamInvitationMonitor from '@/components/TeamInvitationMonitor';
import { UnassignedClientsBanner } from '@/components/UnassignedClientsBanner';

import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import '../global.css';

function RootLayoutNav() {
  const { session, loading, profile } = useAuth();
  const segments = useSegments() as string[];
  const router = useRouter();
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    if (!loading && profile) {
      setHasMounted(true);
    }
  }, [loading, profile]);

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inOnboarding = segments.includes('onboarding');

    if (!session && !inAuthGroup) {
      try {
        router.replace('/(auth)/login');
      } catch (e) {
        console.log('[Routing] Navigation not ready yet');
      }
    } else if (session && profile) {
      if (inAuthGroup || segments.length === 0 || (segments.length === 1 && segments[0] === 'index')) {
        if (profile.role === 'client') {
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
        console.log('[Routing] Client accessed non-onboarding route without completing onboarding');
        router.replace('/(client)/onboarding');
      }
    }
  }, [session, loading, segments, profile]);

  if (loading && !hasMounted) {
    return (
      <View style={{ flex: 1, backgroundColor: '#020617', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="join-team" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(client)" />
        <Stack.Screen name="(coach)" />
        <Stack.Screen name="(admin)" />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style="auto" />
      {/* Global overlays — rendered after Stack so navigation context is available */}
      <NotificationToastWrapper router={router} />
      <SessionMonitor />
      <TeamInvitationMonitor />
      <UnassignedClientsBanner />
    </>
  );
}

function NotificationToastWrapper({ router }: { router: ReturnType<typeof useRouter> }) {
  const { activeToast, dismissToast } = useNotification();
  if (!activeToast) return null;
  return (
    <NotificationToast
      senderName={activeToast.senderName}
      message={activeToast.message}
      onPress={() => router.push(activeToast.navigateTo as any)}
      onDismiss={dismissToast}
    />
  );
}

export default function RootLayout() {
  useFrameworkReady();
  const fontsLoaded = useAppFonts();

  useEffect(() => {
    loadNotificationSound();
    return () => {
      unloadNotificationSound();
    };
  }, []);

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <BrandProvider>
            <UnreadProvider>
              <NotificationProvider>
                <RootLayoutNav />
              </NotificationProvider>
            </UnreadProvider>
          </BrandProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}


