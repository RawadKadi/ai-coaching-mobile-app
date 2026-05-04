import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { AppState, AppStateStatus } from 'react-native';

/**
 * Monitors for team invitations and redirects sub-coaches to welcome screen
 * - Checks when coach becomes available
 * - Listens for real-time additions to coach_hierarchy
 * - Has periodic polling backup for reliability
 */
export default function TeamInvitationMonitor({ router }: { router: ReturnType<typeof useRouter> }) {
  const { coach } = useAuth();
  const [hasChecked, setHasChecked] = useState(false);
  const [invitationFound, setInvitationFound] = useState(false);
  const checkTimeoutRef = useRef<any>(null);
  const appState = useRef(AppState.currentState);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Check if coach has unacknowledged team membership
  const checkForPendingInvitation = async () => {
    if (!coach?.id || !isMounted.current) {
      return;
    }

    if (invitationFound) {
      // Already found and navigated - don't check again!
      return;
    }

    // Don't poll if app is in background
    if (AppState.currentState !== 'active') {
      return;
    }

    try {
      // 1. First check by ID (already linked)
      const { data: idData, error: idError } = await supabase
        .from('coach_hierarchy')
        .select('id, parent_coach_name, acknowledged_at, created_at')
        .eq('child_coach_id', coach.id)
        .is('acknowledged_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (idError) {
        // Network errors are common and shouldn't trigger a red box in dev
        if (idError.message === 'TypeError: Network request failed' || idError.message?.includes('Network request failed')) {
          console.warn('[TeamInvitationMonitor] Network request failed (offline?). Will retry.');
        } else {
          console.error('[TeamInvitationMonitor] ❌ Error checking by ID:', idError);
        }
      }

      if (idData && isMounted.current) {
        handleFoundInvitation(idData);
        return;
      }

      // 2. FALLBACK: Check by Email (not yet linked)
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      if (!user?.email || !isMounted.current) return;

      const { data: emailData, error: emailError } = await supabase
        .from('coach_hierarchy')
        .select('id, parent_coach_name, invite_token')
        .eq('invite_email', user.email)
        .is('child_coach_id', null)
        .is('invite_accepted_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (emailError) {
        if (emailError.message === 'TypeError: Network request failed' || emailError.message?.includes('Network request failed')) {
          // Ignore network errors for polling
        } else {
          console.error('[TeamInvitationMonitor] ❌ Error checking by email:', emailError);
        }
      }

      if (emailData && emailData.invite_token && isMounted.current) {
        const { data: acceptData, error: acceptError } = await supabase.rpc('accept_subcoach_invite', {
          p_invite_token: emailData.invite_token,
          p_child_coach_id: coach.id
        });

        if (acceptError) {
          console.error('[TeamInvitationMonitor] ❌ Auto-link RPC failed:', acceptError);
        } else if (isMounted.current) {
          handleFoundInvitation({
            id: emailData.id,
            parent_coach_name: emailData.parent_coach_name || acceptData.parent_coach_name
          });
        }
      } else if (isMounted.current) {
        setHasChecked(true);
      }
    } catch (err: any) {
      if (err?.message?.includes('Network request failed')) {
        console.warn('[TeamInvitationMonitor] Caught network error in check.');
      } else {
        console.error('[TeamInvitationMonitor] Unexpected error:', err);
      }
    }
  };

  const handleFoundInvitation = (data: any) => {
    if (!isMounted.current) return;
    
    setHasChecked(true);
    setInvitationFound(true); // STOP all further checks!
    
    // Navigate to welcome screen safely
    requestAnimationFrame(() => {
      if (!isMounted.current) return;
      try {
        router.push({
          pathname: '/(coach)/team-welcome',
          params: {
            hierarchyId: data.id,
            parentCoachName: data.parent_coach_name || 'Your Coach',
          },
        });
      } catch (e) {
        console.error('[TeamInvitationMonitor] Navigation failed', e);
      }
    });
  };

  // Check whenever coach ID becomes available or changes
  useEffect(() => {
    if (!coach?.id) {
      setHasChecked(false);
      return;
    }

    if (hasChecked || invitationFound) {
      return;
    }

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

    let pollInterval: any = null;
    
    // Handle AppState changes to pause/resume polling
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // App has come to the foreground!
        checkForPendingInvitation();
      }
      appState.current = nextAppState;
    };

    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

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
          if (invitationFound || !isMounted.current) return;
          
          const newRecord = payload.new as any;
          setInvitationFound(true); // STOP polling!
          
          if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
          }
          
          requestAnimationFrame(() => {
            if (!isMounted.current) return;
            try {
              router.push({
                pathname: '/(coach)/team-welcome',
                params: {
                  hierarchyId: newRecord.id,
                  parentCoachName: newRecord.parent_coach_name || 'Your Coach',
                },
              });
            } catch (e) {
              console.error('[TeamInvitationMonitor] Subscription navigation failed', e);
            }
          });
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          // Start periodic polling as backup (every 10 seconds - reduced from 5)
          if (pollInterval) clearInterval(pollInterval);
          pollInterval = setInterval(() => {
            if (invitationFound || !isMounted.current) {
              if (pollInterval) {
                clearInterval(pollInterval);
                pollInterval = null;
              }
              return;
            }
            checkForPendingInvitation();
          }, 10000); 
          
        } else if (status === 'CHANNEL_ERROR') {
          if (!invitationFound && isMounted.current) {
            setTimeout(() => checkForPendingInvitation(), 2000);
          }
        } else if (status === 'CLOSED') {
          if (pollInterval) clearInterval(pollInterval);
        }
      });

    return () => {
      if (pollInterval) clearInterval(pollInterval);
      appStateSubscription.remove();
      subscription.unsubscribe();
    };
  }, [coach?.id, invitationFound]);

  return null;
}
