import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Platform, UIManager, LayoutAnimation } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Calendar as CalendarIcon, Clock, Video, ChevronRight, User } from 'lucide-react-native';
import { useFocusEffect, useRouter } from 'expo-router';

if (Platform.OS === 'android') {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

type Session = {
  id: string;
  client_id: string;
  scheduled_at: string;
  duration_minutes: number;
  meet_link: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  client: {
    profiles: {
      full_name: string;
      avatar_url: string | null;
    };
  };
};

export default function CalendarScreen() {
  const { profile } = useAuth();
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());

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
        .eq('coach_id', profile?.id)
        .neq('status', 'cancelled')
        .order('scheduled_at', { ascending: true });

      if (error) throw error;
      setSessions(data || []);
    } catch (error) {
      console.error('Error loading sessions:', error);
    } finally {
      setLoading(false);
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
        style={styles.card}
        onPress={() => router.push({
          pathname: '/(coach)/chat/[id]',
          params: { id: item.client_id }
        })}
      >
        <View style={styles.cardHeader}>
          <View style={styles.timeContainer}>
            <Clock size={16} color="#3B82F6" />
            <Text style={styles.timeText}>
              {sessionDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
          {isToday && (
            <View style={styles.todayBadge}>
              <Text style={styles.todayText}>TODAY</Text>
            </View>
          )}
        </View>

        <View style={styles.clientInfo}>
          <View style={styles.avatarPlaceholder}>
            <User size={20} color="#9CA3AF" />
          </View>
          <View>
            <Text style={styles.clientName}>
              {item.client?.profiles?.full_name || 'Unknown Client'}
            </Text>
            <Text style={styles.durationText}>{item.duration_minutes} min session</Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.linkContainer}>
            <Video size={16} color="#6B7280" />
            <Text style={styles.linkText} numberOfLines={1}>
              Video Call
            </Text>
          </View>
          <ChevronRight size={20} color="#9CA3AF" />
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
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Schedule</Text>
      </View>

      <View style={styles.calendarStrip}>
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
                style={[styles.dateItem, isSelected && styles.dateItemSelected]}
                onPress={() => setSelectedDate(item)}
              >
                <Text style={[styles.dayName, isSelected && styles.dateTextSelected]}>
                  {item.toLocaleDateString('en-US', { weekday: 'short' })}
                </Text>
                <Text style={[styles.dayNumber, isSelected && styles.dateTextSelected]}>
                  {item.getDate()}
                </Text>
                {hasSession && (
                  <View style={[styles.dot, isSelected && styles.dotSelected]} />
                )}
              </TouchableOpacity>
            );
          }}
        />
      </View>

      <View style={styles.content}>
        <Text style={styles.sectionTitle}>
          {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </Text>
        
        {loading ? (
          <ActivityIndicator size="large" color="#3B82F6" style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={getSessionsForDate(selectedDate)}
            renderItem={renderSessionCard}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <CalendarIcon size={48} color="#D1D5DB" />
                <Text style={styles.emptyText}>No sessions scheduled</Text>
              </View>
            }
          />
        )}
      </View>
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
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  calendarContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  dateItem: {
    width: 60,
    height: 70,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  dateItemSelected: {
    backgroundColor: '#3B82F6',
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
    backgroundColor: '#3B82F6',
    marginTop: 2,
  },
  dotSelected: {
    backgroundColor: '#FFFFFF',
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
    backgroundColor: '#FFFFFF',
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
    borderTopColor: '#F3F4F6',
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
});
