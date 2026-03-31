import { View, ActivityIndicator } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import SessionMonitor from '@/components/SessionMonitor';
import TeamInvitationMonitor from '@/components/TeamInvitationMonitor';
import { UnassignedClientsBanner } from '@/components/UnassignedClientsBanner';

export default function CoachLayout() {
  const router = useRouter();
  const { session, profile, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (!session) {
        router.replace('/(auth)/login');
      } else if (profile?.role === 'client') {
        router.replace('/(client)/(tabs)');
      }
    }
  }, [session, profile, loading]);

  // Add a simple guard to ensure we have context even while redirecting
  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="team-welcome" options={{ presentation: 'modal' }} />
        <Stack.Screen name="challenges" />
        <Stack.Screen name="clients/[id]" />
      </Stack>
      
      {/* Absolute Loading Overlay to prevent UI flash, without unmounting the Stack */}
      {(loading || !session || profile?.role !== 'coach') && (
        <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: '#020617', justifyContent: 'center', alignItems: 'center', zIndex: 100 }}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      )}

      <SessionMonitor router={router} />
      <TeamInvitationMonitor router={router} />
      <UnassignedClientsBanner router={router} />
    </View>
  );
}

import { StyleSheet } from 'react-native';
