import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Users, TrendingUp, MessageCircle, CheckCircle } from 'lucide-react-native';
import NewClientModal from '@/components/NewClientModal';
import SchedulerModal from '@/components/SchedulerModal';
import { ProposedSession } from '@/lib/ai-scheduling-service';

export default function CoachDashboard() {
  const { profile, coach } = useAuth();
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
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Welcome back, {profile?.full_name}!</Text>
        <Text style={styles.subtitle}>Coach Dashboard</Text>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <View style={styles.statIconContainer}>
            <Users size={24} color="#3B82F6" />
          </View>
          <Text style={styles.statValue}>{stats.totalClients}</Text>
          <Text style={styles.statLabel}>Total Clients</Text>
        </View>

        <View style={styles.statCard}>
          <View style={styles.statIconContainer}>
            <TrendingUp size={24} color="#10B981" />
          </View>
          <Text style={styles.statValue}>{stats.activeClients}</Text>
          <Text style={styles.statLabel}>Active Clients</Text>
        </View>

        <View style={styles.statCard}>
          <View style={styles.statIconContainer}>
            <CheckCircle size={24} color="#F59E0B" />
          </View>
          <Text style={styles.statValue}>{stats.pendingCheckIns}</Text>
          <Text style={styles.statLabel}>Pending Check-ins</Text>
        </View>

        <View style={styles.statCard}>
          <View style={styles.statIconContainer}>
            <MessageCircle size={24} color="#EF4444" />
          </View>
          <Text style={styles.statValue}>{stats.unreadMessages}</Text>
          <Text style={styles.statLabel}>Unread Messages</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No recent activity</Text>
        </View>
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
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  greeting: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  emptyState: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
});
