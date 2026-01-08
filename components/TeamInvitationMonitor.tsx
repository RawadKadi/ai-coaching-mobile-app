import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

/**
 * Monitors for team invitations and redirects sub-coaches to welcome screen
 * - Checks when coach becomes available
 * - Listens for real-time additions to coach_hierarchy
 * - Has periodic polling backup for reliability
 */
export default function TeamInvitationMonitor() {
  const router = useRouter();
  const { coach } = useAuth();
  const [hasChecked, setHasChecked] = useState(false);
  const [invitationFound, setInvitationFound] = useState(false); // NEW: Track if we found an invitation
  const checkTimeoutRef = useRef<any>(null);

  console.log('[TeamInvitationMonitor] Rendered with coach:', coach?.id);

  // Check if coach has unacknowledged team membership
  const checkForPendingInvitation = async () => {
    if (!coach?.id) {
      return;
    }

    if (invitationFound) {
      // Already found and navigated - don't check again!
      return;
    }

    console.log('[TeamInvitationMonitor] 🔍 Checking for pending invitations for coach:', coach.id);

    try {
      const { data, error } = await supabase
        .from('coach_hierarchy')
        .select('id, parent_coach_name, acknowledged_at, created_at')
        .eq('child_coach_id', coach.id)
        .is('acknowledged_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      console.log('[TeamInvitationMonitor] Query result:', { data, error });

      if (error) {
        console.error('[TeamInvitationMonitor] ❌ Error checking invitation:', error);
        return;
      }

      if (data) {
        console.log('[TeamInvitationMonitor] ✅ FOUND UNACKNOWLEDGED INVITATION!', data);
        setHasChecked(true);
        setInvitationFound(true); // STOP all further checks!
        
        // Navigate to welcome screen
        setTimeout(() => {
          console.log('[TeamInvitationMonitor] 🚀 Navigating to welcome screen...');
          router.push({
            pathname: '/(coach)/team-welcome',
            params: {
              hierarchyId: data.id,
              parentCoachName: data.parent_coach_name || 'Your Coach',
            },
          });
        }, 200);
      } else {
        console.log('[TeamInvitationMonitor] No pending invitations found');
        setHasChecked(true);
      }
    } catch (err) {
      console.error('[TeamInvitationMonitor] Unexpected error:', err);
    }
  };

  // Check whenever coach ID becomes available or changes
  useEffect(() => {
    if (!coach?.id) {
      console.log('[TeamInvitationMonitor] Waiting for coach to load...');
      setHasChecked(false);
      return;
    }

    if (hasChecked || invitationFound) {
      return;
    }

    console.log('[TeamInvitationMonitor] 🎯 Coach loaded! Setting up monitoring...');

    if (checkTimeoutRef.current) {
      clearTimeout(checkTimeoutRef.current);
    }

    checkTimeoutRef.current = setTimeout(() => {
      checkForPendingInvitation();
    }, 300);

    return () => {
      if (checkTimeoutRef.current) {
        clearTimeout(checkTimeoutRef.current);
      }
    };
  }, [coach?.id, hasChecked, invitationFound]);

  // Set up real-time listener with periodic polling backup
  useEffect(() => {
    if (!coach?.id) {
      return;
    }

    console.log('[TeamInvitationMonitor] 📡 Subscribing to real-time updates for coach:', coach.id);
    
    let pollInterval: any = null;
    
    const subscription = supabase
      .channel(`team-invitation-${coach.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'coach_hierarchy',
          filter: `child_coach_id=eq.${coach.id}`,
        },
        (payload) => {
          if (invitationFound) return; // Don't handle if already found
          
          console.log('[TeamInvitationMonitor] 🔥 REAL-TIME INVITATION DETECTED!', payload);
          
          const newRecord = payload.new as any;
          setInvitationFound(true); // STOP polling!
          
          // Stop polling immediately
          if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
          }
          
          setTimeout(() => {
            console.log('[TeamInvitationMonitor] 🚀 Navigating to welcome (real-time)...');
            router.push({
              pathname: '/(coach)/team-welcome',
              params: {
                hierarchyId: newRecord.id,
                parentCoachName: newRecord.parent_coach_name || 'Your Coach',
              },
            });
          }, 100);
        }
      )
      .subscribe((status, err) => {
        console.log('[TeamInvitationMonitor] 📡 Subscription status:', status);
        
        if (status === 'SUBSCRIBED') {
          console.log('[TeamInvitationMonitor] ✅ Connected - starting periodic backup checks');
          
          // Start periodic polling as backup (every 5 seconds)
          if (pollInterval) clearInterval(pollInterval);
          pollInterval = setInterval(() => {
            if (invitationFound) {
              // STOP polling if we found an invitation!
              console.log('[TeamInvitationMonitor] ⏹️ Stopping polling - invitation found');
              if (pollInterval) {
                clearInterval(pollInterval);
                pollInterval = null;
              }
              return;
            }
            console.log('[TeamInvitationMonitor] 🔄 Periodic check...');
            checkForPendingInvitation();
          }, 5000); // Increased to 5 seconds (less spammy)
          
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[TeamInvitationMonitor] ❌ Channel error, rechecking...', err);
          if (!invitationFound) {
            setTimeout(() => checkForPendingInvitation(), 1000);
          }
          
        } else if (status === 'CLOSED') {
          console.log('[TeamInvitationMonitor] 🔌 Channel closed');
          if (pollInterval) clearInterval(pollInterval);
        }
      });

    return () => {
      console.log('[TeamInvitationMonitor] Unsubscribing from real-time updates');
      if (pollInterval) clearInterval(pollInterval);
      subscription.unsubscribe();
    };
  }, [coach?.id, invitationFound]); // Re-run if invitationFound changes

  return null;
}
