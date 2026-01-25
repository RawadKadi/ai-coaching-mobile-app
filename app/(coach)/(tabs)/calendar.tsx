import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Platform, UIManager, LayoutAnimation } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/BrandContext';
import { supabase } from '@/lib/supabase';
import { Calendar as CalendarIcon, Clock, Video, ChevronRight, User, Plus } from 'lucide-react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import SchedulerModal from '@/components/SchedulerModal';
import { ProposedSession } from '@/lib/ai-scheduling-service';
import { Session as SessionType } from '@/types/database';

if (Platform.OS === 'android') {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

type Session = {
  id: string;
  client_id: string;
  coach_id: string;
  scheduled_at: string;
  duration_minutes: number;
  meet_link?: string;
  status: 'proposed' | 'scheduled' | 'completed' | 'cancelled';
  session_type: 'training' | 'nutrition' | 'check_in' | 'consultation' | 'other';
  notes?: string;
  is_locked: boolean;
  ai_generated: boolean;
  created_at: string;
  client?: {
    profiles: {
      full_name: string;
      avatar_url: string | null;
    };
  };
};

export default function CalendarScreen() {
  const { profile, coach } = useAuth();
  const theme = useTheme();
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showScheduler, setShowScheduler] = useState(false);
  const [selectedClient, setSelectedClient] = useState<{id: string, name: string, timezone: string} | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (profile) {
        loadSessions();
      }
    }, [profile])
  );

  const loadSessions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('sessions')
        .select(`
          *,
          client:clients (
            profiles (
              full_name,
              avatar_url
            )
          )
        `)
        .eq('coach_id', coach?.id)
        .order('scheduled_at', { ascending: true });

      if (error) throw error;
      setSessions(data || []);
    } catch (error) {
      console.error('Error loading sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmSessions = async (proposedSessions: ProposedSession[]) => {
    if (!coach || !selectedClient) return;

    try {
      // Insert sessions as locked
      const sessionsToInsert = proposedSessions.map(session => ({
        coach_id: coach.id,
        client_id: selectedClient.id,
        scheduled_at: session.scheduled_at,
        duration_minutes: session.duration_minutes,
        session_type: session.session_type,
        notes: session.notes,
        status: 'scheduled',
        is_locked: true,
        ai_generated: true,
        meet_link: `https://meet.jit.si/${coach.id}-${selectedClient.id}-${Date.now()}`,
      }));

      const { data: insertedSessions, error } = await supabase
        .from('sessions')
        .insert(sessionsToInsert)
        .select();

      if (error) throw error;

      // Send notification message to client
      const { data: clientUser } = await supabase
        .from('clients')
        .select('user_id')
        .eq('id', selectedClient.id)
        .single();

      if (clientUser) {
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

      // Reload sessions
      loadSessions();
    } catch (error) {
      console.error('Error confirming sessions:', error);
      throw error;
    }
  };

  const getSessionsForDate = (date: Date) => {
    return sessions.filter(session => {
      const sessionDate = new Date(session.scheduled_at);
      return (
        sessionDate.getDate() === date.getDate() &&
        sessionDate.getMonth() === date.getMonth() &&
        sessionDate.getFullYear() === date.getFullYear()
      );
    });
  };

  const renderSessionCard = ({ item }: { item: Session }) => {
    const sessionDate = new Date(item.scheduled_at);
    const isToday = new Date().toDateString() === sessionDate.toDateString();
    
    return (
      <TouchableOpacity 
        style={[styles.card, { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border }]}
        onPress={() => router.push({
          pathname: '/(coach)/chat/[id]',
          params: { id: item.client_id }
        })}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.timeContainer, { backgroundColor: theme.colors.primary + '15' }]}>
            <Clock size={16} color={theme.colors.primary} />
            <Text style={[styles.timeText, { color: theme.colors.primary }]}>
              {sessionDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
          {isToday && (
            <View style={[styles.todayBadge, { backgroundColor: theme.colors.primary + '15' }]}>
              <Text style={[styles.todayText, { color: theme.colors.primary }]}>TODAY</Text>
            </View>
          )}
        </View>

        <View style={styles.clientInfo}>
          <View style={[styles.avatarPlaceholder, { backgroundColor: theme.colors.surfaceAlt }]}>
            <User size={20} color={theme.colors.textSecondary} />
          </View>
          <View>
            <Text style={[styles.clientName, { color: theme.colors.text }]}>
              {item.client?.profiles?.full_name || 'Unknown Client'}
            </Text>
            <Text style={[styles.durationText, { color: theme.colors.textSecondary }]}>{item.duration_minutes} min session</Text>
          </View>
        </View>

        <View style={[styles.cardFooter, { borderTopColor: theme.colors.border }]}>
          <View style={styles.linkContainer}>
            <Video size={16} color={theme.colors.textSecondary} />
            <Text style={[styles.linkText, { color: theme.colors.textSecondary }]} numberOfLines={1}>
              Video Call
            </Text>
          </View>
          <ChevronRight size={20} color={theme.colors.textTertiary} />
        </View>
      </TouchableOpacity>
    );
  };

  // Generate next 7 days for horizontal calendar
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d;
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Schedule</Text>
      </View>

      <View style={[styles.calendarStrip, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={days}
          keyExtractor={(item) => item.toISOString()}
          contentContainerStyle={styles.calendarContent}
          renderItem={({ item }) => {
            const isSelected = item.toDateString() === selectedDate.toDateString();
            const hasSession = getSessionsForDate(item).length > 0;
            
            return (
              <TouchableOpacity
                style={[
                  styles.dateItem,
                  { backgroundColor: isSelected ? theme.colors.primary : theme.colors.inputBackground },
                  isSelected && styles.dateItemSelected
                ]}
                onPress={() => setSelectedDate(item)}
              >
                <Text style={[styles.dayName, isSelected && { color: theme.colors.textOnPrimary }, !isSelected && { color: theme.colors.textSecondary }]}>
                  {item.toLocaleDateString('en-US', { weekday: 'short' })}
                </Text>
                <Text style={[styles.dayNumber, isSelected && { color: theme.colors.textOnPrimary }, !isSelected && { color: theme.colors.text }]}>
                  {item.getDate()}
                </Text>
                {hasSession && (
                  <View style={[styles.dot, { backgroundColor: isSelected ? theme.colors.textOnPrimary : theme.colors.primary }]} />
                )}
              </TouchableOpacity>
            );
          }}
        />
      </View>

      <View style={styles.content}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </Text>
        
        {loading ? (
          <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={getSessionsForDate(selectedDate)}
            renderItem={renderSessionCard}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <CalendarIcon size={48} color={theme.colors.border} />
                <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>No sessions scheduled</Text>
              </View>
            }
          />
        )}
      </View>

      {/* Floating Action Button */}
      <TouchableOpacity 
        style={[styles.fab, { backgroundColor: theme.colors.primary, shadowColor: theme.colors.primary }]}
        onPress={() => {
          // For now, open modal without client selection
          // TODO: Add client selector before opening modal
          setSelectedClient({ id: 'temp-id', name: 'Client', timezone: 'UTC' });
          setShowScheduler(true);
        }}
      >
        <Plus size={24} color="#FFF" />
      </TouchableOpacity>

      {/* Scheduler Modal */}
      {selectedClient && (
        <SchedulerModal
          visible={showScheduler}
          onClose={() => {
            setShowScheduler(false);
            setSelectedClient(null);
          }}
          onConfirm={handleConfirmSessions}
          clientContext={selectedClient}
          existingSessions={sessions}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
  },
  calendarStrip: {
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  calendarContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  dateItem: {
    width: 60,
    height: 70,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  dateItemSelected: {
    // Applied via inline style
  },
  dayName: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  dayNumber: {
    fontSize: 18,
    color: '#111827',
    fontWeight: '700',
  },
  dateTextSelected: {
    color: '#FFFFFF',
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
  },
  dotSelected: {
    // Applied via inline style
  },
  content: {
    flex: 1,
    padding: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 16,
  },
  listContent: {
    gap: 16,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  timeText: {
    color: '#3B82F6',
    fontSize: 14,
    fontWeight: '600',
  },
  todayBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  todayText: {
    color: '#059669',
    fontSize: 10,
    fontWeight: '700',
  },
  clientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clientName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  durationText: {
    fontSize: 14,
    color: '#6B7280',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
  },
  linkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  linkText: {
    fontSize: 14,
    color: '#6B7280',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 40,
    gap: 12,
  },
  emptyText: {
    color: '#9CA3AF',
    fontSize: 16,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
  },
});
