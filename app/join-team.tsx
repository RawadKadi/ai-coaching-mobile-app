import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PENDING_INVITE_KEY = '@pending_invite_token';

export default function JoinTeamScreen() {
  const router = useRouter();
  const { invite } = useLocalSearchParams<{ invite: string }>();
  const { user, coach } = useAuth();
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    console.log('[JoinTeam] Screen mounted');
    console.log('[JoinTeam] Invite token:', invite);
    console.log('[JoinTeam] User:', user?.id);
    console.log('[JoinTeam] Coach:', coach?.id);

    if (!processing) {
      handleInvite();
    }
  }, [user, invite]);

  const handleInvite = async () => {
    if (processing) {
      console.log('[JoinTeam] Already processing, skipping');
      return;
    }

    if (!invite) {
      console.log('[JoinTeam] No invite token, redirecting to login');
      router.replace('/(auth)/login');
      return;
    }

    setProcessing(true);

    // If not logged in, store invite and redirect to login
    if (!user) {
      console.log('[JoinTeam] Not logged in, storing invite and redirecting to login');
      await AsyncStorage.setItem(PENDING_INVITE_KEY, invite);
      router.replace({
        pathname: '/(auth)/login',
        params: { pendingInvite: 'true' }
      });
      return;
    }

    // User is logged in - process invite
    await processInvite(invite);
  };

  const processInvite = async (inviteToken: string) => {
    console.log('[JoinTeam] Processing invite for logged-in user:', inviteToken);
    
    try {
      // Validate the invite
      console.log('[JoinTeam] Validating invite...');
      const { data: validationData, error: validationError } = await supabase.rpc('validate_subcoach_invite', {
        p_invite_token: inviteToken
      });

      console.log('[JoinTeam] Validation result:', validationData);
      console.log('[JoinTeam] Validation error:', validationError);

      if (validationError || !validationData || !validationData.valid) {
        console.error('[JoinTeam] Validation failed');
        Alert.alert('Invalid Invite', validationData?.message || 'This invitation link is not valid.');
        router.replace('/');
        return;
      }

      // Accept the invite
      console.log('[JoinTeam] Accepting invite...');
      const { data: acceptData, error: acceptError } = await supabase.rpc('accept_subcoach_invite', {
        p_invite_token: inviteToken
      });

      console.log('[JoinTeam] Accept result:', acceptData);
      console.log('[JoinTeam] Accept error:', acceptError);

      if (acceptError) {
        console.error('[JoinTeam] Accept error:', acceptError);
        Alert.alert('Error', 'Failed to accept invitation. Please try again.');
        router.replace('/');
        return;
      }

      if (!acceptData || !acceptData.success) {
        console.error('[JoinTeam] Accept failed:', acceptData?.message);
        Alert.alert('Error', acceptData?.message || 'Failed to join team');
        router.replace('/');
        return;
      }

      console.log('[JoinTeam] Invite accepted successfully!');
      console.log('[JoinTeam] Parent coach:', acceptData.parent_coach_name);
      
      // Clear stored invite
      await AsyncStorage.removeItem(PENDING_INVITE_KEY);
      
      // Force reload auth to get updated coach data
      console.log('[JoinTeam] Waiting for data sync...');
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Navigate to dashboard - TeamInvitationMonitor will show the slider
      console.log('[JoinTeam] Navigating to dashboard - TeamInvitationMonitor will handle welcome');
      router.replace('/');

    } catch (error: any) {
      console.error('[JoinTeam] Unexpected error:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
      router.replace('/');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#3B82F6" />
      <Text style={styles.text}>Processing invitation...</Text>
      <Text style={styles.debugText}>Invite: {invite?.slice(0, 8)}...</Text>
      <Text style={styles.debugText}>User: {user ? 'Logged in' : 'Not logged in'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 20,
  },
  text: {
    marginTop: 16,
    fontSize: 16,
    color: '#111827',
    fontWeight: '600',
  },
  debugText: {
    marginTop: 8,
    fontSize: 12,
    color: '#9CA3AF',
  },
});

// Export function to check and process pending invites (called after login)
export async function checkPendingInvite() {
  const pendingInvite = await AsyncStorage.getItem(PENDING_INVITE_KEY);
  return pendingInvite;
}
