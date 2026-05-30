import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import SessionMonitor from '@/components/SessionMonitor';
import TeamInvitationMonitor from '@/components/TeamInvitationMonitor';
import { UnassignedClientsBanner } from '@/components/UnassignedClientsBanner';
import { NewAssignmentCelebration } from '@/components/NewAssignmentCelebration';

export default function CoachLayout() {
  const router = useRouter();
  const segments = useSegments() as string[];
  const { session, profile, coach, loading } = useAuth();
  const inOnboarding = segments.includes('onboarding');
  
  const [celebration, setCelebration] = useState<{ visible: boolean; isFirst: boolean; name: string }>({
    visible: false,
    isFirst: false,
    name: ''
  });

  useEffect(() => {
    if (!loading) {
      if (!session) {
        router.replace('/(auth)/login');
      } else if (profile?.role === 'client') {
        router.replace('/(client)/(tabs)');
      } else if (profile?.role === 'coach' && profile.onboarding_completed !== true && !inOnboarding) {
        router.replace('/(coach)/onboarding');
      }
    }
  }, [session, profile, loading, inOnboarding]);

  useEffect(() => {
    if (coach?.id) {
      const sub = supabase.channel(`coach_assignments_${coach.id}`)
        .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'coach_client_links', 
          filter: `coach_id=eq.${coach.id}` 
        }, async (payload) => {
          try {
            // Fetch client name and total count to determine if it's the first
            const [clientRes, countRes] = await Promise.all([
              supabase.from('profiles').select('full_name').eq('id', payload.new.client_id).single(),
              supabase.from('coach_client_links').select('*', { count: 'exact', head: true }).eq('coach_id', coach.id)
            ]);

            setCelebration({
              visible: true,
              isFirst: (countRes.count || 0) <= 1,
              name: clientRes.data?.full_name || 'New Athlete'
            });
          } catch (error) {
            console.error('[CoachLayout] Error triggering celebration:', error);
          }
        })
        .subscribe();

      return () => {
        sub.unsubscribe();
      };
    }
  }, [coach?.id]);

  // Add a simple guard to ensure we have context even while redirecting
  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="team-welcome" options={{ presentation: 'modal' }} />
        <Stack.Screen name="challenges" />
        <Stack.Screen name="clients/[id]" />
        <Stack.Screen name="clients/create-selection" options={{ presentation: 'modal' }} />
        <Stack.Screen name="clients/create-protocol" />
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
      
      <NewAssignmentCelebration 
        visible={celebration.visible}
        isFirstClient={celebration.isFirst}
        clientName={celebration.name}
        onClose={() => setCelebration(prev => ({ ...prev, visible: false }))}
      />
    </View>
  );
}
