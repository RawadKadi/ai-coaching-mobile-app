import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  SafeAreaView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { UserCheck, Mail, Calendar, Users, TrendingUp, Award, ChevronRight } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useBrandColors } from '@/contexts/BrandContext';
import { supabase } from '@/lib/supabase';
import { BrandedHeader } from '@/components/BrandedHeader';
import { AssignClientsModal } from '@/components/AssignClientsModal';

interface SubCoachDetails {
  coach_id: string;
  full_name: string;
  email: string;
  joined_at: string;
  client_count: number;
  clients: Array<{
    id: string;
    full_name: string;
    email: string;
    added_at: string;
  }>;
}

export default function SubCoachDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { coach } = useAuth();
  const { primary, secondary } = useBrandColors();
  
  const [subCoach, setSubCoach] = useState<SubCoachDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAssignModal, setShowAssignModal] = useState(false);

  useEffect(() => {
    if (id) {
      loadSubCoachDetails();
    }
  }, [id]);

  const loadSubCoachDetails = async () => {
    try {
      setLoading(true);
      
      console.log('[SubCoachDetails] Loading details for ID:', id);
      
      // Use RPC to bypass RLS
      const { data: coachDetailsRaw, error: coachError } = await supabase.rpc('get_subcoach_details', {
        p_coach_id: id
      });

      console.log('[SubCoachDetails] RPC result:', { coachDetailsRaw, coachError });

      if (coachError) {
        console.error('[SubCoachDetails] RPC error:', coachError);
        throw coachError;
      }
      
      if (!coachDetailsRaw) {
        throw new Error('Sub-coach not found. They may not have accepted the invitation yet.');
      }

      // Get assigned clients using RPC (bypasses RLS)
      console.log('[SubCoachDetails] Fetching clients for coach:', id);
      const { data: clientsRaw, error: clientsError } = await supabase.rpc('get_subcoach_clients', {
        p_coach_id: id
      });

      console.log('[SubCoachDetails] Clients RPC response:', clientsRaw);
      console.log('[SubCoachDetails] Clients error:', clientsError);

      if (clientsError) throw clientsError;

      // Parse the JSON array from RPC
      const formattedClients = (clientsRaw || []).map((client: any) => ({
        id: client.client_id,
        full_name: client.full_name,
        email: client.email,
        added_at: client.assigned_at,
      }));

      setSubCoach({
        coach_id: coachDetailsRaw.coach_id,
        full_name: coachDetailsRaw.full_name || 'Unknown Coach',
        email: coachDetailsRaw.email || 'No email',
        joined_at: coachDetailsRaw.joined_at || coachDetailsRaw.created_at,
        client_count: formattedClients.length,
        clients: formattedClients,
      });
    } catch (error: any) {
      console.error('[SubCoachDetails] Error loading details:', error);
      Alert.alert(
        'Error', 
        error.message || 'Failed to load sub-coach details. They may not have signed up yet.'
      );
      router.back();
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <BrandedHeader title="Sub-Coach Details" showBackButton onBackPress={() => router.back()} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={primary} />
          <Text style={styles.loadingText}>Loading details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!subCoach) {
    return (
      <SafeAreaView style={styles.container}>
        <BrandedHeader title="Sub-Coach Details" showBackButton onBackPress={() => router.back()} />
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Sub-coach not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <BrandedHeader 
        title="Sub-Coach Details" 
        showBackButton 
        onBackPress={() => router.back()} 
      />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Profile Card */}
        <View style={[styles.profileCard, { borderTopColor: primary }]}>
          <View style={[styles.avatar, { backgroundColor: `${primary}20` }]}>
            <UserCheck size={40} color={primary} />
          </View>
          
          <Text style={styles.name}>{subCoach.full_name}</Text>
          
          <View style={styles.infoRow}>
            <Mail size={16} color="#6B7280" />
            <Text style={styles.email}>{subCoach.email}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Calendar size={16} color="#6B7280" />
            <Text style={styles.joinedText}>
              Joined {new Date(subCoach.joined_at).toLocaleDateString()}
            </Text>
          </View>
        </View>

        {/* Stats Card */}
        <View style={styles.statsCard}>
          <View style={styles.statBox}>
            <Users size={24} color={primary} />
            <Text style={styles.statValue}>{subCoach.client_count}</Text>
            <Text style={styles.statLabel}>Assigned Clients</Text>
          </View>
          
          <View style={styles.statBox}>
            <TrendingUp size={24} color={secondary} />
            <Text style={[styles.statValue, { color: secondary }]}>Active</Text>
            <Text style={styles.statLabel}>Status</Text>
          </View>
        </View>

        {/* Clients List */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Assigned Clients ({subCoach.client_count})</Text>
            <TouchableOpacity
              style={[styles.assignButton, { backgroundColor: primary }]}
              onPress={() => setShowAssignModal(true)}
            >
              <Users size={16} color="#FFFFFF" />
              <Text style={styles.assignButtonText}>Assign Clients</Text>
            </TouchableOpacity>
          </View>
          
          {subCoach.clients.length === 0 ? (
            <View style={styles.emptyClientsCard}>
              <Users size={32} color="#D1D5DB" />
              <Text style={styles.emptyClientsText}>No clients assigned yet</Text>
            </View>
          ) : (
            subCoach.clients.map((client) => (
              <TouchableOpacity
                key={client.id}
                style={styles.clientCard}
                onPress={() => {
                  router.push(`/(coach)/clients/${client.id}`);
                }}
              >
                <View style={styles.clientInfo}>
                  <View style={styles.clientAvatar}>
                    <Text style={styles.clientInitial}>
                      {client.full_name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.clientDetails}>
                    <Text style={styles.clientName}>{client.full_name}</Text>
                    <Text style={styles.clientEmail}>{client.email}</Text>
                    <Text style={styles.clientDate}>
                      Added {new Date(client.added_at).toLocaleDateString()}
                    </Text>
                  </View>
                </View>
                <ChevronRight size={20} color="#9CA3AF" />
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      {/* Assignment Modal */}
      {coach?.id && (
        <AssignClientsModal
          visible={showAssignModal}
          subCoachId={subCoach.coach_id}
          subCoachName={subCoach.full_name}
          mainCoachId={coach.id}
          onClose={() => setShowAssignModal(false)}
          onSuccess={() => loadSubCoachDetails()}
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
  content: {
    padding: 16,
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
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    borderTopWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  email: {
    fontSize: 14,
    color: '#6B7280',
  },
  joinedText: {
    fontSize: 14,
    color: '#6B7280',
  },
  statsCard: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
  section: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  assignButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  assignButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  clientCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  clientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  clientAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  clientInitial: {
    fontSize: 18,
    fontWeight: '700',
    color: '#3B82F6',
  },
  clientDetails: {
    flex: 1,
  },
  clientName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  clientEmail: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 2,
  },
  clientDate: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  emptyClientsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  emptyClientsText: {
    marginTop: 12,
    fontSize: 14,
    color: '#9CA3AF',
  },
});
