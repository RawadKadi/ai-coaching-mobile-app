import React, { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import FeedbackModal from '@/components/FeedbackModal';
import { Target } from 'lucide-react-native';

export default function ChallengeMonitor({ router }: { router: ReturnType<typeof useRouter> }) {
  const { client } = useAuth();
  const [visible, setVisible] = useState(false);
  const [challengeName, setChallengeName] = useState('');

  useEffect(() => {
    if (!client) return;

    const checkNewChallenges = async () => {
      try {
        const { data, error } = await supabase
          .from('mother_challenges')
          .select('id, name, created_at')
          .eq('client_id', client.id)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error || !data) return;

        const lastSeenId = await AsyncStorage.getItem(`@last_seen_challenge_${client.id}`);
        
        if (lastSeenId !== data.id) {
          const createdTime = new Date(data.created_at).getTime();
          const now = Date.now();
          if (now - createdTime < 3 * 24 * 60 * 60 * 1000) {
            setChallengeName(data.name);
            setVisible(true);
          } else {
            await AsyncStorage.setItem(`@last_seen_challenge_${client.id}`, data.id);
          }
        }
      } catch (error) {
        console.error('Error checking new challenges:', error);
      }
    };

    checkNewChallenges();

    // Poll every 5 seconds to guarantee "real-time" delivery regardless of realtime config
    const pollInterval = setInterval(() => {
      checkNewChallenges();
    }, 5000);

    const channel = supabase
      .channel('challenge-monitor-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'mother_challenges', filter: `client_id=eq.${client.id}` },
        (payload) => {
          const newChallenge = payload.new as any;
          if (newChallenge.status === 'active') {
             setChallengeName(newChallenge.name);
             setVisible(true);
          }
        }
      )
      .subscribe();

    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [client]);

  const handleClose = async () => {
    setVisible(false);
    if (client) {
      const { data } = await supabase
        .from('mother_challenges')
        .select('id')
        .eq('client_id', client.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
        
      if (data) {
        await AsyncStorage.setItem(`@last_seen_challenge_${client.id}`, data.id);
      }
    }
    
    router.push('/(client)/challenges' as any);
  };

  return (
    <FeedbackModal
      visible={visible}
      onClose={handleClose}
      variant="info"
      icon={<Target size={52} color="#3B82F6" />}
      title="New Challenge"
      body={`Your coach assigned a new challenge:\n"${challengeName}"\n\nGo check it out.`}
      ctaLabel="Check it out"
    />
  );
}
