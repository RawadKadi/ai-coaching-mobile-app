import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Profile } from '@/types/database';
import { Users, UserCheck, UserCog, Shield } from 'lucide-react-native';

export default function AdminDashboard() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<Profile[]>([]);
  const [filter, setFilter] = useState<string>('all');

  const [stats, setStats] = useState({
    total: 0,
    clients: 0,
    coaches: 0,
    admins: 0,
  });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setUsers(data || []);
      
      // Calculate stats
      const clients = data?.filter(u => u.role === 'client').length || 0;
      const coaches = data?.filter(u => u.role === 'coach').length || 0;
      const admins = data?.filter(u => u.role === 'admin').length || 0;
      
      setStats({
        total: data?.length || 0,
        clients,
        coaches,
        admins,
      });
    } catch (error) {
      console.error('Error loading users:', error);
      Alert.alert('Error', 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const deleteUser = async (userId: string, userName: string) => {
    Alert.alert(
      'Delete User',
      `Are you sure you want to delete ${userName}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Note: This will cascade delete via database FK constraints
              const { error } = await supabase
                .from('profiles')
                .delete()
                .eq('id', userId);

              if (error) throw error;
              
              Alert.alert('Success', 'User deleted successfully');
              loadUsers();
            } catch (error) {
              console.error('Error deleting user:', error);
              Alert.alert('Error', 'Failed to delete user');
            }
          },
        },
      ]
    );
  };

  const filteredUsers = filter === 'all' 
    ? users 
    : users.filter(u => u.role === filter);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Admin Dashboard</Text>
        <Text style={styles.subtitle}>Welcome, {profile?.full_name}</Text>
      </View>

      {/* Stats */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Users size={24} color="#3B82F6" />
          <Text style={styles.statValue}>{stats.total}</Text>
          <Text style={styles.statLabel}>Total Users</Text>
        </View>
        <View style={styles.statCard}>
          <UserCheck size={24} color="#10B981" />
          <Text style={styles.statValue}>{stats.clients}</Text>
          <Text style={styles.statLabel}>Clients</Text>
        </View>
        <View style={styles.statCard}>
          <UserCog size={24} color="#F59E0B" />
          <Text style={styles.statValue}>{stats.coaches}</Text>
          <Text style={styles.statLabel}>Coaches</Text>
        </View>
        <View style={styles.statCard}>
          <Shield size={24} color="#EF4444" />
          <Text style={styles.statValue}>{stats.admins}</Text>
          <Text style={styles.statLabel}>Admins</Text>
        </View>
      </View>

      {/* Filters */}
      <View style={styles.filters}>
        {['all', 'client', 'coach', 'admin'].map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterButton, filter === f && styles.filterButtonActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* User List */}
      <ScrollView style={styles.content}>
        {filteredUsers.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No users found</Text>
          </View>
        ) : (
          filteredUsers.map((user) => (
            <View key={user.id} style={styles.userCard}>
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{user.full_name}</Text>
                <Text style={styles.userRole}>{user.role}</Text>
                <Text style={styles.userDate}>
                  Joined {new Date(user.created_at).toLocaleDateString()}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => deleteUser(user.id, user.full_name)}
              >
                <Text style={styles.deleteButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>
    </View>
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
  title: {
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
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  filters: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 16,
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  filterButtonActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  filterText: {
    fontSize: 14,
    color: '#6B7280',
  },
  filterTextActive: {
    color: '#3B82F6',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  userCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  userRole: {
    fontSize: 12,
    color: '#3B82F6',
    marginTop: 2,
    textTransform: 'capitalize',
  },
  userDate: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  deleteButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#FEE2E2',
  },
  deleteButtonText: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '600',
  },
});
