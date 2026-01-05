import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Users, Plus, TrendingUp, UserCheck, Award } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useBrand, useBrandColors } from '@/contexts/BrandContext';
import { supabase } from '@/lib/supabase';
import { BrandedHeader } from '@/components/BrandedHeader';
import { BrandedButton } from '@/components/BrandedButton';

interface SubCoach {
  coach_id: string;
  full_name: string;
  email: string;
  client_count: number;
  added_at: string;
}

export default function TeamManagementScreen() {
  const router = useRouter();
  const { coach } = useAuth();
  const { brand } = useBrand();
  const { primary, secondary } = useBrandColors();
  
  const [subCoaches, setSubCoaches] = useState<SubCoach[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalClients, setTotalClients] = useState(0);

  useEffect(() => {
    if (coach?.is_parent_coach) {
      loadSubCoaches();
      loadBrandStats();
    }
  }, [coach]);

  const loadSubCoaches = async () => {
    if (!coach?.id) {
      console.log('[TeamManagement] No coach ID, skipping load');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      console.log('[TeamManagement] Loading sub-coaches for coach:', coach.id);
      
      const { data, error } = await supabase.rpc('get_sub_coaches', {
        p_parent_coach_id: coach.id,
      });

      if (error) {
        console.error('[TeamManagement] RPC Error:', error);
        throw error;
      }

      console.log('[TeamManagement] Sub-coaches loaded:', data);
      setSubCoaches(data || []);
    } catch (error: any) {
      console.error('[TeamManagement] Error loading sub-coaches:', error);
      Alert.alert('Error', `Failed to load team members: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const loadBrandStats = async () => {
    try {
      // Get total clients across all coaches in brand
      const { count, error } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .eq('brand_id', brand?.id);

      if (error) throw error;
      setTotalClients(count || 0);
    } catch (error) {
      console.error('[TeamManagement] Error loading brand stats:', error);
    }
  };

  const renderSubCoach = ({ item }: { item: SubCoach }) => (
    <TouchableOpacity
      style={styles.coachCard}
      // onPress={() => router.push(`/(coach)/team/${item.coach_id}`)} // TODO: Create detail page
    >
      <View style={styles.coachHeader}>
        <View style={[styles.avatar, { backgroundColor: `${primary}20` }]}>
          <UserCheck size={24} color={primary} />
        </View>
        <View style={styles.coachInfo}>
          <Text style={styles.coachName}>{item.full_name}</Text>
          <Text style={styles.coachEmail}>{item.email}</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Users size={16} color="#6B7280" />
          <Text style={styles.statValue}>{item.client_count}</Text>
          <Text style={styles.statLabel}>Clients</Text>
        </View>
        
        <View style={styles.stat}>
          <TrendingUp size={16} color={secondary} />
          <Text style={[styles.statValue, { color: secondary }]}>Active</Text>
        </View>
      </View>

      <Text style={styles.addedDate}>
        Added {new Date(item.added_at).toLocaleDateString()}
      </Text>
    </TouchableOpacity>
  );

  // Check if user is parent coach
  if (!coach?.is_parent_coach) {
    return (
      <SafeAreaView style={styles.container}>
        <BrandedHeader title="Team Management" showBackButton onBackPress={() => router.back()} />
        
        <View style={styles.noAccessContainer}>
          <Award size={64} color="#D1D5DB" />
          <Text style={styles.noAccessTitle}>Parent Coach Only</Text>
          <Text style={styles.noAccessText}>
            This feature is only available for parent coaches who manage teams.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <BrandedHeader 
        title="Team Management" 
        showLogo 
        rightComponent={
          <TouchableOpacity onPress={() => router.push('/(coach)/team/add')}>
            <Plus size={24} color={primary} />
          </TouchableOpacity>
        }
      />

      {/* Brand Stats Card */}
      <View style={[styles.statsCard, { borderLeftColor: primary }]}>
        <View style={styles.statsHeader}>
          <Text style={styles.statsTitle}>{brand?.name || 'Your Brand'}</Text>
        </View>
        <View style={styles.statsGrid}>
          <View style={styles.statsItem}>
            <Text style={styles.statsValue}>{subCoaches.length}</Text>
            <Text style={styles.statsLabel}>Sub-Coaches</Text>
          </View>
          <View style={styles.statsItem}>
            <Text style={styles.statsValue}>{totalClients}</Text>
            <Text style={styles.statsLabel}>Total Clients</Text>
          </View>
          <View style={styles.statsItem}>
            <Text style={[styles.statsValue, { color: secondary }]}>
              {subCoaches.reduce((sum, coach) => sum + coach.client_count, 0)}
            </Text>
            <Text style={styles.statsLabel}>Assigned</Text>
          </View>
        </View>
      </View>

      {/* Sub-Coaches List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={primary} />
          <Text style={styles.loadingText}>Loading team members...</Text>
        </View>
      ) : subCoaches.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Users size={64} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>No Sub-Coaches Yet</Text>
          <Text style={styles.emptyText}>
            Add coaches to your team to manage more clients and scale your business.
          </Text>
          <BrandedButton
            title="Add Sub-Coach"
            variant="primary"
            onPress={() => router.push('/(coach)/team/add')}
            icon={<Plus size={20} color="#FFFFFF" />}
            style={styles.addButton}
          />
        </View>
      ) : (
        <FlatList
          data={subCoaches}
          renderItem={renderSubCoach}
          keyExtractor={(item) => item.coach_id}
          contentContainerStyle={styles.listContent}
          refreshing={loading}
          onRefresh={loadSubCoaches}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  statsCard: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statsHeader: {
    marginBottom: 16,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statsItem: {
    alignItems: 'center',
  },
  statsValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
  },
  statsLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  listContent: {
    padding: 16,
    paddingTop: 0,
  },
  coachCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  coachHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  coachInfo: {
    flex: 1,
  },
  coachName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  coachEmail: {
    fontSize: 14,
    color: '#6B7280',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 24,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  statLabel: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  addedDate: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  addButton: {
    marginTop: 8,
  },
  noAccessContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  noAccessTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  noAccessText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
});
