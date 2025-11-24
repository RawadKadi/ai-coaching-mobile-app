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

export default function CoachDashboard() {
  const { profile, coach } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalClients: 0,
    activeClients: 0,
    pendingCheckIns: 0,
    unreadMessages: 0,
  });

  useEffect(() => {
    if (coach) {
      loadDashboardData();
    }
  }, [coach]);

  const loadDashboardData = async () => {
    if (!coach) return;

    try {
      const { data: clientLinks } = await supabase
        .from('coach_client_links')
        .select('*, clients(*)')
        .eq('coach_id', coach.id);

      const activeClients = clientLinks?.filter(
        (link) => link.status === 'active'
      );

      setStats({
        totalClients: clientLinks?.length || 0,
        activeClients: activeClients?.length || 0,
        pendingCheckIns: 0,
        unreadMessages: 0,
      });
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
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
