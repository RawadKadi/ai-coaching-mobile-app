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
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, Sparkles } from 'lucide-react-native';

/**
 * AI Challenge Generation Screen V3
 * Generates mother challenges with week of sub-challenges
 */

interface Client {
  id: string;
  full_name: string;
}

export default function AISuggestChallengeScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

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
        .from('coach_client_links')
        .select(`
          client:clients(
            id,
            profiles:user_id(full_name)
          )
        `)
        .eq('coach_id', coachData.id)
        .eq('status', 'active');

      if (error) throw error;

      const clientList = data
        ?.map((link: any) => {
          const client = link.client;
          const profiles = Array.isArray(client.profiles)
            ? client.profiles[0]
            : client.profiles;
          return {
            id: client.id,
            full_name: profiles?.full_name || 'Unknown',
          };
        })
        .filter(Boolean) || [];

      setClients(clientList);
    } catch (error) {
      console.error('Error loading clients:', error);
    }
  };

  const handleGenerate = async () => {
    if (!selectedClient) {
      Alert.alert('Error', 'Please select a client first');
      return;
    }

    try {
      setLoading(true);

      const { data: coachData } = await supabase
        .from('coaches')
        .select('id')
        .eq('user_id', user!.id)
        .single();

      if (!coachData) throw new Error('Coach not found');

      // Generate week-long challenge
      const today = new Date();
      const startDate = today.toISOString().split('T')[0];
      const endDate = new Date(today.getTime() + 6 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];

      // Build realistic sub-challenges for 7 days
      const subChallenges = [];
      
      // Day 1-7: Mix of training, nutrition, recovery
      const challenges = [
        // Day 1
        { name: "Upper body push workout", description: "3 sets: push-ups (10-15), dumbbell press (10), overhead press (8-10)", focus: "training", intensity: "medium" },
        { name: "Protein breakfast - 30g minimum", description: "Eggs, Greek yogurt, or protein shake within 1 hour of waking", focus: "nutrition", intensity: "low" },
        { name: "Evening mobility routine", description: "15 minutes of stretching focusing on shoulders and chest", focus: "recovery", intensity: "low" },
        // Day 2
        { name: "Lower body squat session", description: "3 sets: squats (10-12), lunges (10 each leg), calf raises (15)", focus: "training", intensity: "high" },
        { name: "Hydration - 3 liters water", description: "Track water intake throughout the day, use marked bottle", focus: "nutrition", intensity: "low" },
        // Day 3
        { name: "Active recovery walk", description: "30-minute walk at moderate pace, focus on breathing", focus: "training", intensity: "low" },
        { name: "Meal prep Sunday", description: "Prepare 3 healthy meals for the next 3 days", focus: "nutrition", intensity: "medium" },
        { name: "8-hour sleep goal", description: "In bed by 10 PM, aim for 8 hours quality sleep", focus: "recovery", intensity: "low" },
        // Day 4
        { name: "Pull workout day", description: "3 sets: rows (10-12), pull-ups/assisted (8-10), bicep curls (12)", focus: "training", intensity: "medium" },
        { name: "5 servings fruits & veggies", description: "Include colorful variety throughout all meals", focus: "nutrition", intensity: "medium" },
        // Day 5
        { name: "Lower body deadlift session", description: "3 sets: deadlifts (8-10), Romanian deadlifts (10), leg curls (12)", focus: "training", intensity: "high" },
        { name: "Pre-workout snack timing", description: "Eat 30-60 min before workout: banana + protein or oats", focus: "nutrition", intensity: "low" },
        // Day 6
        { name: "Core strength circuit", description: "3 rounds: planks (45s), leg raises (15), Russian twists (20)", focus: "training", intensity: "medium" },
        { name: "Post-workout recovery shake", description: "Within 30 min: protein shake with carbs (banana/oats)", focus: "nutrition", intensity: "low" },
        { name: "Foam rolling session", description: "15 minutes focusing on quads, hamstrings, back", focus: "recovery", intensity: "low" },
        // Day 7
        { name: "Full body circuit", description: "3 rounds: squats, push-ups, rows, lunges (12 reps each)", focus: "training", intensity: "medium" },
        { name: "Weekly meal review", description: "Reflect on nutrition wins and plan improvements for next week", focus: "consistency", intensity: "low" },
      ];

      // Distribute across 7 days
      for (let i = 0; i < 7; i++) {
        const date = new Date(today.getTime() + i * 24 * 60 * 60 * 1000);
        const dateStr = date.toISOString().split('T')[0];
        
        // Get 2-3 challenges for this day
        const dayStart = i * 2;
        const dayChallenges = challenges.slice(dayStart, dayStart + 3);
        
        dayChallenges.forEach(ch => {
          subChallenges.push({
            assigned_date: dateStr,
            name: ch.name,
            description: ch.description,
            focus_type: ch.focus,
            intensity: ch.intensity
          });
        });
      }

      // Create mother challenge with all subs
      const { data: motherId, error } = await supabase.rpc('create_mother_challenge', {
        p_coach_id: coachData.id,
        p_client_id: selectedClient.id,
        p_name: "7-Day Strength & Wellness Challenge",
        p_description: "A balanced week of training, nutrition, and recovery goals to build consistency",
        p_start_date: startDate,
        p_end_date: endDate,
        p_sub_challenges: subChallenges,
        p_created_by: 'coach',
      });

      if (error) throw error;

      Alert.alert(
        'Success!',
        `Created weekly challenge with ${subChallenges.length} daily tasks for ${selectedClient.full_name}`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error: any) {
      console.error('Error creating challenge:', error);
      Alert.alert('Error', error.message || 'Failed to create challenge');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#111" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Generate Challenge</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scrollView}>
        {/* Client Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Client</Text>
          {clients.map((client) => (
            <TouchableOpacity
              key={client.id}
              style={[
                styles.clientCard,
                selectedClient?.id === client.id && styles.clientCardSelected,
              ]}
              onPress={() => setSelectedClient(client)}
            >
              <View
                style={[
                  styles.radio,
                  selectedClient?.id === client.id && styles.radioSelected,
                ]}
              />
              <Text style={styles.clientName}>{client.full_name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Info */}
        <View style={styles.infoBox}>
          <Sparkles size={20} color="#6366f1" />
          <Text style={styles.infoText}>
            This will create a 7-day challenge with 2-3 specific tasks per day mixing training,
            nutrition, and recovery goals.
          </Text>
        </View>
      </ScrollView>

      {/* Generate Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.generateButton, (!selectedClient || loading) && styles.buttonDisabled]}
          onPress={handleGenerate}
          disabled={!selectedClient || loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Sparkles size={20} color="#fff" />
              <Text style={styles.generateButtonText}>Generate Weekly Challenge</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 60,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
    marginBottom: 12,
  },
  clientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    marginBottom: 12,
  },
  clientCardSelected: {
    borderColor: '#6366f1',
    backgroundColor: '#ede9fe',
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#d1d5db',
    marginRight: 12,
  },
  radioSelected: {
    borderColor: '#6366f1',
    backgroundColor: '#6366f1',
  },
  clientName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111',
  },
  infoBox: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#ede9fe',
    padding: 16,
    margin: 16,
    borderRadius: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#6366f1',
    lineHeight: 18,
  },
  footer: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  generateButton: {
    flexDirection: 'row',
    backgroundColor: '#6366f1',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  generateButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
