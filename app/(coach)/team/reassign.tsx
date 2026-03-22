import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Check, Users, UserPlus, AlertCircle } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useBrandColors, useTheme } from '@/contexts/BrandContext';
import { BrandedHeader } from '@/components/BrandedHeader';

interface Client {
  client_id: string;
  client_name: string;
  client_email: string;
  added_at: string;
}

interface SubCoach {
  coach_id: string;
  full_name: string;
  client_count: number;
}

export default function ReassignClientsScreen() {
  const router = useRouter();
  const { coach } = useAuth();
  const { primary } = useBrandColors();
  const theme = useTheme();

  const [clients, setClients] = useState<Client[]>([]);
  const [coaches, setCoaches] = useState<SubCoach[]>([]);
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
  const [selectedCoachId, setSelectedCoachId] = useState<string | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    if (!coach?.id) return;
    try {
      setLoading(true);
      
      const [clientsRes, coachesRes] = await Promise.all([
        supabase.rpc('get_unassigned_clients', { p_main_coach_id: coach.id }),
        supabase.rpc('get_active_sub_coaches', { p_main_coach_id: coach.id })
      ]);

      if (clientsRes.error) throw clientsRes.error;
      if (coachesRes.error) throw coachesRes.error;

      setClients(clientsRes.data || []);
      setCoaches(coachesRes.data || []);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleClient = (id: string) => {
    const newSet = new Set(selectedClients);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedClients(newSet);
  };

  const handleAssign = async () => {
    if (selectedClients.size === 0 || !selectedCoachId) return;

    try {
      setAssigning(true);
      const clientIds = Array.from(selectedClients);
      
      const { error } = await supabase.rpc('assign_clients_to_subcoach', {
        p_main_coach_id: coach?.id,
        p_subcoach_id: selectedCoachId,
        p_client_ids: clientIds
      });

      if (error) throw error;

      Alert.alert('Success', `Assigned ${clientIds.length} clients successfully.`);
      
      // Refresh list or go back if empty
      const remaining = clients.filter(c => !selectedClients.has(c.client_id));
      if (remaining.length === 0) {
        router.back();
      } else {
        setClients(remaining);
        setSelectedClients(new Set());
        setSelectedCoachId(null);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setAssigning(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <BrandedHeader title="Reassign Clients" showBackButton onBackPress={router.back} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <BrandedHeader title="Reassign Clients" showBackButton onBackPress={router.back} />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Unassigned Clients List */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text, fontFamily: theme.typography.fontFamily }]}>
            1. Select Unassigned Clients ({clients.length})
          </Text>
          
          {clients.length === 0 ? (
            <View style={styles.emptyBox}>
              <Check size={24} color={theme.colors.success} />
              <Text style={[styles.emptyText, { color: theme.colors.textSecondary, fontFamily: theme.typography.fontFamily }]}>
                No unassigned clients. Great job!
              </Text>
            </View>
          ) : (
            clients.map(client => {
              const isSelected = selectedClients.has(client.client_id);
              return (
                <TouchableOpacity
                  key={client.client_id}
                  style={[
                    styles.card,
                    { backgroundColor: theme.colors.surface, borderColor: isSelected ? primary : theme.colors.border },
                    isSelected && { backgroundColor: `${primary}10` }
                  ]}
                  onPress={() => toggleClient(client.client_id)}
                >
                  <View style={[styles.checkbox, { borderColor: isSelected ? primary : '#D1D5DB', backgroundColor: isSelected ? primary : 'transparent' }]}>
                    {isSelected && <Check size={14} color="#FFF" />}
                  </View>
                  <View>
                    <Text style={[styles.name, { color: theme.colors.text, fontFamily: theme.typography.fontFamily }]}>{client.client_name}</Text>
                    <Text style={[styles.email, { color: theme.colors.textSecondary, fontFamily: theme.typography.fontFamily }]}>{client.client_email}</Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* Target Coach Selection */}
        {clients.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text, fontFamily: theme.typography.fontFamily }]}>
              2. Select New Coach
            </Text>
            
            {coaches.map(c => {
              const isSelected = selectedCoachId === c.coach_id;
              return (
                <TouchableOpacity
                  key={c.coach_id}
                  style={[
                    styles.card,
                    { backgroundColor: theme.colors.surface, borderColor: isSelected ? primary : theme.colors.border },
                    isSelected && { backgroundColor: `${primary}10` }
                  ]}
                  onPress={() => setSelectedCoachId(c.coach_id)}
                >
                  <View style={[styles.radio, { borderColor: isSelected ? primary : '#D1D5DB' }]}>
                    {isSelected && <View style={[styles.radioInner, { backgroundColor: primary }]} />}
                  </View>
                  <View>
                    <Text style={[styles.name, { color: theme.colors.text, fontFamily: theme.typography.fontFamily }]}>{c.full_name}</Text>
                    <Text style={[styles.email, { color: theme.colors.textSecondary, fontFamily: theme.typography.fontFamily }]}>{c.client_count} clients</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Footer Action */}
      {clients.length > 0 && (
        <View style={[styles.footer, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border }]}>
          <View>
            <Text style={[styles.footerText, { color: theme.colors.textSecondary, fontFamily: theme.typography.fontFamily }]}>
              Assigning {selectedClients.size} clients to {selectedCoachId ? coaches.find(c => c.coach_id === selectedCoachId)?.full_name : '...'}
            </Text>
          </View>
          <TouchableOpacity
            style={[
              styles.assignButton,
              { backgroundColor: primary },
              (selectedClients.size === 0 || !selectedCoachId || assigning) && { opacity: 0.5 }
            ]}
            disabled={selectedClients.size === 0 || !selectedCoachId || assigning}
            onPress={handleAssign}
          >
            {assigning ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={[styles.buttonText, { fontFamily: theme.typography.fontFamily }]}>Confirm Assignment</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 16 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  card: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 2,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 12,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  name: { fontSize: 14, fontWeight: '600' },
  email: { fontSize: 12 },
  emptyBox: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    opacity: 0.7,
  },
  emptyText: { fontSize: 14 },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerText: { fontSize: 12, maxWidth: '60%' },
  assignButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: { color: '#FFF', fontWeight: '600' },
});
