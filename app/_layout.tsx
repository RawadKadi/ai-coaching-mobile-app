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
import { PresenceProvider } from '@/contexts/PresenceContext';

import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import '../global.css';

function RootLayoutNav() {
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
      <NotificationToastWrapper />
    </>
  );
}

function NotificationToastWrapper() {
  const router = useRouter();
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
                <PresenceProvider>
                  <RootLayoutNav />
                </PresenceProvider>
              </NotificationProvider>
            </UnreadProvider>
          </BrandProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}


