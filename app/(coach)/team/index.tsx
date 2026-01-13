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
  coach_id: string | null;
  full_name: string;
  email: string;
  client_count: number;
  added_at: string;
  status: 'active' | 'pending';
  invite_token: string | null;
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

      // Set up real-time subscription for team changes
      const subscription = supabase
        .channel('team-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'coach_hierarchy',
            filter: `parent_coach_id=eq.${coach.id}`
          },
          () => {
            console.log('[TeamManagement] Real-time update detected, reloading...');
            loadSubCoaches();
          }
        )
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [coach?.id]);

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

  const getInviteUrl = (token: string) => {
    // Development link for Expo Go
    // For Production, it would be coachingapp://join-team?invite=${token}
    return `exp://192.168.0.104:8081/--/join-team?invite=${token}`;
  };

  const renderSubCoach = ({ item }: { item: SubCoach }) => (
    <TouchableOpacity
      style={[
        styles.coachCard,
        item.status === 'pending' && styles.pendingCard
      ]}
      onPress={() => {
        console.log('[TeamManagement] Card clicked:', { status: item.status, coach_id: item.coach_id });
        if (item.status === 'active' && item.coach_id) {
          router.push(`/(coach)/team/${item.coach_id}`); // TODO: Create detail page
        } else if (item.status === 'pending' && item.invite_token) {
          Alert.alert(
            'Pending Invite',
            `Email: ${item.email}\n\nInvite Link (Expo Go Debug):\n${getInviteUrl(item.invite_token)}`,
            [
              { text: 'OK' },
              { 
                text: 'Copy Debug Link', 
                onPress: () => {
                  // If we had Clipboard, we'd copy it here
                  Alert.alert('Link', getInviteUrl(item.invite_token!));
                } 
              }
            ]
          );
        }
      }}
    >
      <View style={styles.coachHeader}>
        <View style={[
          styles.avatar, 
          { backgroundColor: item.status === 'active' ? `${primary}20` : '#F3F4F6' }
        ]}>
          <UserCheck size={24} color={item.status === 'active' ? primary : '#9CA3AF'} />
        </View>
        <View style={styles.coachInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.coachName}>{item.full_name}</Text>
            {item.status === 'pending' && (
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingBadgeText}>Pending</Text>
              </View>
            )}
          </View>
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
          <TrendingUp size={16} color={item.status === 'active' ? secondary : '#9CA3AF'} />
          <Text style={[
            styles.statValue, 
            { color: item.status === 'active' ? secondary : '#9CA3AF' }
          ]}>
            {item.status === 'active' ? 'Active' : 'Invited'}
          </Text>
        </View>
      </View>

      <View style={styles.footerRow}>
        <Text style={styles.addedDate}>
          {item.status === 'active' ? 'Joined' : 'Invited'} {new Date(item.added_at).toLocaleDateString()}
        </Text>
        {item.status === 'pending' && item.invite_token && (
          <TouchableOpacity 
            onPress={() => {
              Alert.alert('Invite Token', item.invite_token!);
            }}
          >
            <Text style={[styles.copyCodeText, { color: primary }]}>View Token</Text>
          </TouchableOpacity>
        )}
      </View>
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
          keyExtractor={(item) => item.invite_token || item.coach_id || Math.random().toString()}
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
  },
  pendingCard: {
    backgroundColor: '#F3F4F6',
    borderStyle: 'dashed',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  pendingBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pendingBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#D97706',
    textTransform: 'uppercase',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  copyCodeText: {
    fontSize: 12,
    fontWeight: '600',
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
