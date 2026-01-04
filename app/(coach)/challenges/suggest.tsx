import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, Sparkles, Calendar } from 'lucide-react-native';
import { generateWeeklyChallenges } from '@/lib/ai-challenge-service';

/**
 * AI Challenge Generation Screen V3 with Memory
 * Generates contextual challenges and navigates to review screen
 */

interface Client {
  id: string;
  full_name: string;
}

export default function AISuggestChallengeScreen() {
  const router = useRouter();
  const { clientId } = useLocalSearchParams();
  const { user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    if (!user) return;

    try {
      const { data: coachData } = await supabase
        .from('coaches')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!coachData) return;

      const { data, error } = await supabase
        .rpc('get_coach_clients', { p_coach_id: coachData.id });

      if (error) throw error;

      setClients(data || []);

      // Auto-select client if provided via URL
      if (clientId && data) {
        const preSelectedClient = data.find((c: Client) => c.id === clientId);
        if (preSelectedClient) {
          setSelectedClient(preSelectedClient);
        }
      }
    } catch (error) {
      console.error('Error loading clients:', error);
      Alert.alert('Error', 'Failed to load clients');
    }
  };

  const handleGenerate = async () => {
    if (!selectedClient) {
      Alert.alert('Select Client', 'Please select a client first');
      return;
    }

    try {
      setGenerating(true);

      // Start date is next Monday
      const startDate = getNextMonday();

      // Generate challenges with AI memory
      const challenges = await generateWeeklyChallenges(
        selectedClient.id,
        selectedClient.full_name,
        startDate
      );

      if (!challenges || challenges.length === 0) {
        Alert.alert('Error', 'AI generated no challenges. Try again.');
        return;
      }

      // Navigate to review screen with generated challenges
      router.push({
        pathname: '/(coach)/challenges/review',
        params: {
          clientId: selectedClient.id,
          clientName: selectedClient.full_name,
          startDate: startDate.toISOString().split('T')[0],
          challenges: JSON.stringify(challenges)
        }
      });

    } catch (error: any) {
      console.error('Error generating challenges:', error);
      Alert.alert('Error', error.message || 'Failed to generate challenges');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#111" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>AI Generate Challenge</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scrollView}>
        {/* Info Banner */}
        <View style={styles.infoBanner}>
          <Sparkles size={20} color="#6366f1" />
          <View style={styles.infoText}>
            <Text style={styles.infoTitle}>AI-Powered Weekly Challenges</Text>
            <Text style={styles.infoDescription}>
              AI analyzes client history to generate personalized, non-repetitive challenges for the week ahead.
            </Text>
          </View>
        </View>

        {/* Date Info */}
        <View style={styles.dateInfo}>
          <Calendar size={18} color="#666" />
          <Text style={styles.dateText}>
            Week starting: {getNextMonday().toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric'
            })}
          </Text>
        </View>

        {/* Client Selection */}
        <Text style={styles.sectionTitle}>Select Client</Text>
        {clients.map((client) => (
          <TouchableOpacity
            key={client.id}
            style={[
              styles.clientCard,
              selectedClient?.id === client.id && styles.clientCardSelected
            ]}
            onPress={() => setSelectedClient(client)}
          >
            <View style={styles.clientInfo}>
              <View style={[
                styles.radioOuter,
                selectedClient?.id === client.id && styles.radioOuterSelected
              ]}>
                {selectedClient?.id === client.id && <View style={styles.radioInner} />}
              </View>
              <Text style={styles.clientName}>{client.full_name}</Text>
            </View>
          </TouchableOpacity>
        ))}

        {clients.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No clients found</Text>
            <Text style={styles.emptySubtext}>Add clients to generate challenges</Text>
          </View>
        )}
      </ScrollView>

      {/* Generate Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.generateButton, (!selectedClient || generating) && styles.generateButtonDisabled]}
          onPress={handleGenerate}
          disabled={!selectedClient || generating}
        >
          {generating ? (
            <>
              <ActivityIndicator color="#fff" />
              <Text style={styles.generateButtonText}>Generating with AI...</Text>
            </>
          ) : (
            <>
              <Sparkles size={20} color="#fff" />
              <Text style={styles.generateButtonText}>Generate Weekly Challenges</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function getNextMonday(): Date {
  const today = new Date();
  const day = today.getDay();
  const daysUntilMonday = day === 0 ? 1 : (8 - day) % 7 || 7;
  const nextMonday = new Date(today);
  nextMonday.setDate(today.getDate() + daysUntilMonday);
  nextMonday.setHours(0, 0, 0, 0);
  return nextMonday;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingTop: 60, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#111' },
  scrollView: { flex: 1 },
  infoBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: '#f0f9ff', padding: 16, margin: 16, borderRadius: 12, borderWidth: 1, borderColor: '#bfdbfe' },
  infoText: { flex: 1 },
  infoTitle: { fontSize: 15, fontWeight: '600', color: '#1e40af', marginBottom: 4 },
  infoDescription: { fontSize: 13, color: '#3b82f6', lineHeight: 18 },
  dateInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 16, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb' },
  dateText: { fontSize: 14, fontWeight: '500', color: '#666' },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#111', marginHorizontal: 16, marginBottom: 12 },
  clientCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 12, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb' },
  clientCardSelected: { borderColor: '#6366f1', borderWidth: 2, backgroundColor: '#f0f9ff' },
  clientInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#d1d5db', justifyContent: 'center', alignItems: 'center' },
  radioOuterSelected: { borderColor: '#6366f1' },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#6366f1' },
  clientName: { fontSize: 16, fontWeight: '500', color: '#111' },
  emptyState: { alignItems: 'center', padding: 40 },
  emptyText: { fontSize: 16, fontWeight: '500', color: '#999', marginBottom: 4 },
  emptySubtext: { fontSize: 14, color: '#ccc' },
  footer: { padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  generateButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16, borderRadius: 12, backgroundColor: '#6366f1' },
  generateButtonDisabled: { backgroundColor: '#cbd5e1' },
  generateButtonText: { fontSize: 16, fontWeight: '600', color: '#fff' },
});
