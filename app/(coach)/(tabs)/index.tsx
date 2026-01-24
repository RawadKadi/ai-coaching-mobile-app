import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/BrandContext';
import { useUnread } from '@/contexts/UnreadContext';
import { supabase } from '@/lib/supabase';
import { Users, TrendingUp, MessageCircle, CheckCircle, Target, Sparkles } from 'lucide-react-native';
import NewClientModal from '@/components/NewClientModal';
import SchedulerModal from '@/components/SchedulerModal';
import { ProposedSession } from '@/lib/ai-scheduling-service';
import { BrandedText } from '@/components/BrandedText';
import { BrandedCard } from '@/components/BrandedCard';

export default function CoachDashboard() {
  const router = useRouter();
  const { profile, coach } = useAuth();
  const theme = useTheme();
  const { unreadCount } = useUnread();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalClients: 0,
    activeClients: 0,
    pendingCheckIns: 0,
    unreadMessages: 0,
  });
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [showScheduler, setShowScheduler] = useState(false);
  const [newClient, setNewClient] = useState<{id: string, name: string, timezone: string} | null>(null);

  useEffect(() => {
    if (coach) {
      console.log('[Coach Dashboard] Setting up real-time subscription for coach:', coach.id);
      loadDashboardData();

      // Set up real-time listener for new client assignments
      const subscription = supabase
        .channel('new_client_notifications')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'coach_client_links',
            filter: `coach_id=eq.${coach.id}`,
          },
          async (payload) => {
            console.log('[Real-time] ✅ New client assigned!', payload);
            console.log('[Real-time] Client ID:', payload.new.client_id);
            
            // Fetch client details
            const { data: clientData, error: clientError } = await supabase
              .from('clients')
              .select(`
                id,
                user_id,
                profiles!inner (
                  full_name,
                  timezone
                )
              `)
              .eq('id', payload.new.client_id)
              .single();

            if (clientError) {
              console.error('[Real-time] Error fetching client data:', clientError);
              return;
            }

            console.log('[Real-time] Client data fetched:', clientData);

            if (clientData) {
              const profiles = Array.isArray(clientData.profiles) ? clientData.profiles[0] : clientData.profiles;
              console.log('[Real-time] Showing modal for:', profiles?.full_name);
              
              setNewClient({
                id: clientData.id,
                name: profiles?.full_name || 'New Client',
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              });
              setShowNewClientModal(true);
              // Refresh stats
              console.log('[Real-time] Refreshing dashboard stats...');
              loadDashboardData();
            }
          }
        )
        .subscribe((status) => {
          console.log('[Real-time] Subscription status:', status);
          if (status === 'SUBSCRIBED') {
            console.log('[Real-time] ✅ Successfully subscribed to new client notifications');
          } else if (status === 'CLOSED') {
            console.error('[Real-time] ❌ Subscription closed');
          } else if (status === 'CHANNEL_ERROR') {
            console.error('[Real-time] ❌ Channel error');
          }
        });

      return () => {
        console.log('[Coach Dashboard] Cleaning up real-time subscription');
        subscription.unsubscribe();
      };
    } else {
      // If coach is null, stop loading
      setLoading(false);
    }
  }, [coach]);

  const loadDashboardData = async () => {
    if (!coach) return;

    try {
      const { data, error } = await supabase.rpc('get_coach_stats');

      if (error) throw error;

      setStats({
        totalClients: data?.totalClients || 0,
        activeClients: data?.activeClients || 0,
        pendingCheckIns: 0,
        unreadMessages: 0,
      });
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSetupSessions = () => {
    setShowNewClientModal(false);
    setShowScheduler(true);
  };

  const handleConfirmSessions = async (proposedSessions: ProposedSession[]) => {
    if (!coach || !newClient) return;

    try {
      // Expand recurring sessions
      const sessionsToInsert: any[] = [];
      const WEEKS_TO_SCHEDULE = 4;

      proposedSessions.forEach(session => {
        if (session.recurrence === 'weekly') {
          // Generate 4 weeks of sessions
          const startDate = new Date(session.scheduled_at);
          for (let i = 0; i < WEEKS_TO_SCHEDULE; i++) {
            const nextDate = new Date(startDate);
            nextDate.setDate(startDate.getDate() + (i * 7));
            
            sessionsToInsert.push({
              coach_id: coach.id,
              client_id: newClient.id,
              scheduled_at: nextDate.toISOString(),
              duration_minutes: session.duration_minutes,
              session_type: session.session_type,
              notes: session.notes,
              status: 'scheduled',
              is_locked: true,
              ai_generated: true,
              meet_link: `https://meet.jit.si/${coach.id}-${newClient.id}-${Date.now()}-${i}`,
            });
          }
        } else {
          // Single session
          sessionsToInsert.push({
            coach_id: coach.id,
            client_id: newClient.id,
            scheduled_at: session.scheduled_at,
            duration_minutes: session.duration_minutes,
            session_type: session.session_type,
            notes: session.notes,
            status: 'scheduled',
            is_locked: true,
            ai_generated: true,
            meet_link: `https://meet.jit.si/${coach.id}-${newClient.id}-${Date.now()}`,
          });
        }
      });

      const { data: insertedSessions, error } = await supabase
        .from('sessions')
        .insert(sessionsToInsert)
        .select();

      if (error) throw error;

      // Send notification to client
      const { data: clientUser } = await supabase
        .from('clients')
        .select('user_id')
        .eq('id', newClient.id)
        .single();

      if (clientUser && insertedSessions) {
        for (const session of insertedSessions) {
          const messageContent = JSON.stringify({
            type: 'session_invite',
            sessionId: session.id,
            link: session.meet_link,
            timestamp: session.scheduled_at,
            description: `${session.session_type} session`,
            status: 'scheduled',
          });

          await supabase.from('messages').insert({
            sender_id: profile?.id,
            recipient_id: clientUser.user_id,
            content: messageContent,
            ai_generated: false,
          });
        }
      }

      // Close modal and clear state
      setShowScheduler(false);
      setNewClient(null);
    } catch (error) {
      console.error('Error setting up sessions:', error);
      throw error;
    }
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View 
        style={[
          styles.header, 
          { 
            backgroundColor: theme.colors.surface,
            borderBottomColor: theme.colors.border,
            paddingHorizontal: 24 * theme.spacing.scale,
            paddingTop: 60 * theme.spacing.scale,
            paddingBottom: 24 * theme.spacing.scale,
          }
        ]}
      >
        <BrandedText variant="xxl" weight="heading" style={styles.greeting}>
          Welcome back, {profile?.full_name}!
        </BrandedText>
        <BrandedText variant="sm" color="secondary">
          Coach Dashboard
        </BrandedText>
      </View>

      <View style={[styles.statsGrid, { padding: 16 * theme.spacing.scale, gap: 12 * theme.spacing.scale }]}>
        <BrandedCard style={styles.statCard} variant="elevated">
          <View style={[styles.statIconContainer, { backgroundColor: theme.colors.surfaceAlt }]}>
            <Users size={24} color={theme.colors.primary} />
          </View>
          <BrandedText variant="xl" weight="heading" style={styles.statValue}>
            {stats.totalClients}
          </BrandedText>
          <BrandedText variant="xs" color="secondary" style={styles.statLabel}>
            Total Clients
          </BrandedText>
        </BrandedCard>

        <BrandedCard style={styles.statCard} variant="elevated">
          <View style={[styles.statIconContainer, { backgroundColor: theme.colors.surfaceAlt }]}>
            <TrendingUp size={24} color={theme.colors.secondary} />
          </View>
          <BrandedText variant="xl" weight="heading" style={styles.statValue}>
            {stats.activeClients}
          </BrandedText>
          <BrandedText variant="xs" color="secondary" style={styles.statLabel}>
            Active Clients
          </BrandedText>
        </BrandedCard>

        <BrandedCard style={styles.statCard} variant="elevated">
          <View style={[styles.statIconContainer, { backgroundColor: theme.colors.surfaceAlt }]}>
            <CheckCircle size={24} color={theme.colors.accent} />
          </View>
          <BrandedText variant="xl" weight="heading" style={styles.statValue}>
            {stats.pendingCheckIns}
          </BrandedText>
          <BrandedText variant="xs" color="secondary" style={styles.statLabel}>
            Pending Check-ins
          </BrandedText>
        </BrandedCard>

        <BrandedCard style={styles.statCard} variant="elevated">
          <View style={[styles.statIconContainer, { backgroundColor: theme.colors.surfaceAlt }]}>
            <MessageCircle size={24} color={theme.colors.error} />
          </View>
          <BrandedText variant="xl" weight="heading" style={styles.statValue}>
            {unreadCount}
          </BrandedText>
          <BrandedText variant="xs" color="secondary" style={styles.statLabel}>
            Unread Messages
          </BrandedText>
        </BrandedCard>
      </View>

      {/* Quick Actions */}
      <View style={[styles.section, { padding: 16 * theme.spacing.scale }]}>
        <BrandedText variant="lg" weight="heading" style={styles.sectionTitle}>
          Quick Actions
        </BrandedText>
        <TouchableOpacity 
          style={[styles.actionCard, { borderColor: theme.colors.border }]}
          onPress={() => router.push('/challenges')}
        >
          <BrandedCard variant="flat" style={styles.actionCardInner}>
            <View style={[styles.actionIconContainer, { backgroundColor: theme.colors.surfaceAlt }]}>
              <Target size={28} color={theme.colors.primary} />
            </View>
            <View style={styles.actionContent}>
              <BrandedText variant="base" weight="heading">
                Challenges
              </BrandedText>
              <BrandedText variant="sm" color="secondary" style={styles.actionDescription}>
                Manage client challenges and AI suggestions
              </BrandedText>
            </View>
            <View style={[styles.aiIndicator, { backgroundColor: theme.colors.surfaceAlt }]}>
              <Sparkles size={16} color={theme.colors.primary} />
            </View>
          </BrandedCard>
        </TouchableOpacity>
      </View>

      <View style={[styles.section, { padding: 16 * theme.spacing.scale }]}>
        <BrandedText variant="lg" weight="heading" style={styles.sectionTitle}>
          Recent Activity
        </BrandedText>
        <BrandedCard variant="elevated" style={styles.emptyState}>
          <BrandedText variant="sm" color="secondary">
            No recent activity
          </BrandedText>
        </BrandedCard>
      </View>

      {/* New Client Modal */}
      {newClient && (
        <NewClientModal
          visible={showNewClientModal}
          clientName={newClient.name}
          onSetupSessions={handleSetupSessions}
          onDismiss={() => {
            setShowNewClientModal(false);
            setNewClient(null);
          }}
        />
      )}

      {/* Scheduler Modal */}
      {newClient && (
        <SchedulerModal
          visible={showScheduler}
          onClose={() => setShowScheduler(false)}
          onConfirm={handleConfirmSessions}
          clientContext={newClient}
          existingSessions={[]}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    borderBottomWidth: 1,
  },
  greeting: {
    marginBottom: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    padding: 16,
    alignItems: 'center',
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statValue: {
    marginBottom: 4,
  },
  statLabel: {
    textAlign: 'center',
  },
  section: {
  },
  sectionTitle: {
    marginBottom: 16,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  actionCard: {
    borderRadius: 16,
  },
  actionCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  actionIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionContent: {
    flex: 1,
  },
  actionDescription: {
    marginTop: 2,
  },
  aiIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
