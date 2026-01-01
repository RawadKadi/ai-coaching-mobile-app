import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Client, Habit } from '@/types/database';
import { ArrowLeft, Plus, Edit2, Trash2, ToggleLeft, ToggleRight, Calendar as CalendarIcon } from 'lucide-react-native';
import SchedulerModal from '@/components/SchedulerModal';
import PendingResolutionsModal from '@/components/PendingResolutionsModal';
import ConflictResolutionModal from '@/components/ConflictResolutionModal';
import { ProposedSession } from '@/lib/ai-scheduling-service';

export default function ClientDetailsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { coach } = useAuth();
  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState<Client | null>(null);
  const [challenges, setChallenges] = useState<Habit[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [schedulerVisible, setSchedulerVisible] = useState(false);
  const [editingChallenge, setEditingChallenge] = useState<Habit | null>(null);
  const [allCoachSessions, setAllCoachSessions] = useState<any[]>([]);
  const [pendingResolutions, setPendingResolutions] = useState<any[]>([]);
  const [pendingModalVisible, setPendingModalVisible] = useState(false);
  
  // Conflict Resolution State
  const [conflictModalVisible, setConflictModalVisible] = useState(false);
  const [currentConflict, setCurrentConflict] = useState<any>(null);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [targetValue, setTargetValue] = useState('');
  const [unit, setUnit] = useState('');
  const [verificationType, setVerificationType] = useState('none');

  useEffect(() => {
    if (coach && id) {
      loadClientData();
      
      // Real-time subscription for sessions to update pending resolutions live
      const subscription = supabase
        .channel('client-details-sessions')
        .on(
            'postgres_changes',
            {
                event: '*', // Listen for all events (INSERT, UPDATE, DELETE)
                schema: 'public',
                table: 'sessions',
                filter: `coach_id=eq.${coach.id}` // Listen for ALL coach sessions to catch conflicts
            },
            () => {
                // When any session changes, reload data to update conflicts and counts
                console.log('[ClientDetails] Session update detected, reloading...');
                loadClientData();
            }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(subscription);
      };
    }
  }, [coach, id]);

  const loadClientData = async () => {
    try {
      setLoading(true);
      
      // Fetch client data using secure RPC
      const { data: clientData, error: clientError } = await supabase
        .rpc('get_client_details', { target_client_id: id });

      if (clientError) throw clientError;
      setClient(clientData);

      // Fetch challenges using secure RPC
      const { data: habitsData, error: habitsError } = await supabase
        .rpc('get_client_habits', { target_client_id: id });

      if (habitsError) throw habitsError;
      setChallenges(habitsData || []);

      // Fetch ALL future sessions for the coach (for conflict detection)
      // CRITICAL: Join with clients to get client names!
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('sessions')
        .select(`
          *,
          client:clients!sessions_client_id_fkey(
            id,
            profiles(full_name)
          )
        `)
        .eq('coach_id', coach?.id)
        .gte('scheduled_at', new Date().toISOString());
        
      if (!sessionsError && sessionsData) {
          console.log('[ClientDetails] Fetched sessions:', sessionsData.length);
          console.log('[ClientDetails] Sample session:', sessionsData[0]);
          
          // Transform to include client name at top level
          const sessionsWithNames = sessionsData.map(s => ({
            ...s,
            client_name: s.client?.profiles?.full_name || 'Unknown Client'
          }));
          
          setAllCoachSessions(sessionsWithNames);
          
          // Filter for pending resolutions for THIS client
          const pending = sessionsData.filter(s => 
            s.client_id === id && 
            (
                s.status === 'pending_resolution' ||
                s.status === 'proposed' ||
                (s.invite_sent === true && s.status === 'scheduled' && !s.cancellation_reason) || // Detect 'Accepted'
                (s.cancellation_reason && s.cancellation_reason.startsWith('pending_reschedule')) ||
                (s.cancellation_reason === 'reschedule_rejected')
            )
          );
          console.log('[ClientDetails] Pending resolutions:', pending.length);
          pending.forEach(p => {
              console.log(`  - Session ${p.id}: status=${p.status}, invite_sent=${p.invite_sent}, reason=${p.cancellation_reason}`);
          });
          setPendingResolutions(pending);
      } else if (sessionsError) {
          console.error('[ClientDetails] Sessions error:', sessionsError);
      }

    } catch (error) {
      console.error('Error loading client:', error);
      Alert.alert('Error', 'Failed to load client data');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSessions = async (proposedSessions: ProposedSession[]) => {
    if (!coach || !client) return;

    try {
      const sessionsToInsert: any[] = [];
      const sessionsToUpdate: { id: string; data: any }[] = [];
      const WEEKS_TO_SCHEDULE = 4;

      for (const session of proposedSessions) {
        if (session.recurrence === 'weekly') {
          const startDate = new Date(session.scheduled_at);
          
          for (let i = 0; i < WEEKS_TO_SCHEDULE; i++) {
            const nextDate = new Date(startDate);
            nextDate.setDate(startDate.getDate() + (i * 7));
            
            // Check if THIS CLIENT already has a session on this exact day
            const existingOnSameDay = allCoachSessions.find(s => {
              if (s.client_id !== client.id) return false;
              if (s.status === 'cancelled') return false;
              
              const existingDate = new Date(s.scheduled_at);
              return (
                existingDate.getFullYear() === nextDate.getFullYear() &&
                existingDate.getMonth() === nextDate.getMonth() &&
                existingDate.getDate() === nextDate.getDate()
              );
            });

            // Check for conflicts with OTHER clients
            const instanceStart = nextDate.getTime();
            const instanceEnd = instanceStart + session.duration_minutes * 60000;
            const instanceConflict = allCoachSessions.some(s => {
                if (s.status === 'cancelled') return false;
                if (s.client_id === client.id) return false; // Ignore same client
                const start = new Date(s.scheduled_at).getTime();
                const end = start + s.duration_minutes * 60000;
                return (start < instanceEnd && end > instanceStart);
            });

            const sessionData = {
              coach_id: coach.id,
              client_id: client.id,
              scheduled_at: nextDate.toISOString(),
              duration_minutes: session.duration_minutes,
              session_type: session.session_type,
              notes: session.notes,
              status: instanceConflict ? 'pending_resolution' : 'scheduled',
              is_locked: true,
              ai_generated: true,
            };

            if (existingOnSameDay) {
              sessionsToUpdate.push({ 
                id: existingOnSameDay.id, 
                data: { ...sessionData, meet_link: existingOnSameDay.meet_link } 
              });
            } else {
              sessionsToInsert.push({
                ...sessionData,
                meet_link: `https://meet.jit.si/${coach.id}-${client.id}-${Date.now()}-${i}`,
              });
            }
          }
        } else {
          // Single session
          const proposedDate = new Date(session.scheduled_at);
          const existingOnSameDay = allCoachSessions.find(s => {
            if (s.client_id !== client.id) return false;
            if (s.status === 'cancelled') return false;
            
            const existingDate = new Date(s.scheduled_at);
            return (
              existingDate.getFullYear() === proposedDate.getFullYear() &&
              existingDate.getMonth() === proposedDate.getMonth() &&
              existingDate.getDate() === proposedDate.getDate()
            );
          });

          const proposedStart = new Date(session.scheduled_at).getTime();
          const proposedEnd = proposedStart + session.duration_minutes * 60000;
          const hasConflict = allCoachSessions.some(s => {
              if (s.status === 'cancelled') return false;
              if (s.client_id === client.id) return false;
              const start = new Date(s.scheduled_at).getTime();
              const end = start + s.duration_minutes * 60000;
              return (start < proposedEnd && end > proposedStart);
          });

          const sessionData = {
            coach_id: coach.id,
            client_id: client.id,
            scheduled_at: session.scheduled_at,
            duration_minutes: session.duration_minutes,
            session_type: session.session_type,
            notes: session.notes,
            status: hasConflict ? 'pending_resolution' : 'scheduled',
            is_locked: true,
            ai_generated: true,
          };

          if (existingOnSameDay) {
            sessionsToUpdate.push({ 
              id: existingOnSameDay.id, 
              data: { ...sessionData, meet_link: existingOnSameDay.meet_link } 
            });
          } else {
            sessionsToInsert.push({
              ...sessionData,
              meet_link: `https://meet.jit.si/${coach.id}-${client.id}-${Date.now()}`,
            });
          }
        }
      }

      // Perform updates
      for (const { id, data } of sessionsToUpdate) {
        const { error } = await supabase.from('sessions').update(data).eq('id', id);
        if (error) throw error;
      }

      // Perform inserts
      if (sessionsToInsert.length > 0) {
        const { error } = await supabase.from('sessions').insert(sessionsToInsert);
        if (error) throw error;
      }

      const total = sessionsToUpdate.length + sessionsToInsert.length;
      Alert.alert('Success', `${total} session(s) saved!`);
      await loadClientData();
    } catch (error) {
      console.error('Error saving sessions:', error);
      Alert.alert('Error', 'Failed to save sessions');
    }
  };

  const openAddModal = () => {
    setEditingChallenge(null);
    setName('');
    setDescription('');
    setTargetValue('');
    setUnit('');
    setVerificationType('none');
    setModalVisible(true);
  };

  const openEditModal = (challenge: Habit) => {
    setEditingChallenge(challenge);
    setName(challenge.name);
    setDescription(challenge.description || '');
    setTargetValue(challenge.target_value?.toString() || '');
    setUnit(challenge.unit || '');
    setVerificationType(challenge.verification_type || 'none');
    setModalVisible(true);
  };

  const handleSaveChallenge = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Challenge name is required');
      return;
    }

    try {
      const challengeData = {
        client_id: id as string,
        name: name.trim(),
        description: description.trim() || null,
        target_value: targetValue ? parseFloat(targetValue) : null,
        unit: unit.trim() || null,
        verification_type: verificationType,
        frequency: 'daily',
        is_active: true,
      };

      if (editingChallenge) {
        // Update
        const { error } = await supabase
          .from('habits')
          .update(challengeData)
          .eq('id', editingChallenge.id);

        if (error) throw error;
      } else {
        // Insert
        const { error } = await supabase
          .from('habits')
          .insert(challengeData);

        if (error) throw error;
      }

      setModalVisible(false);
      loadClientData();
    } catch (error) {
      console.error('Error saving challenge:', error);
      Alert.alert('Error', 'Failed to save challenge');
    }
  };

  const toggleChallengeActive = async (challenge: Habit) => {
    try {
      const { error } = await supabase
        .from('habits')
        .update({ is_active: !challenge.is_active })
        .eq('id', challenge.id);

      if (error) throw error;
      loadClientData();
    } catch (error) {
      console.error('Error toggling challenge:', error);
    }
  };

  const deleteChallenge = async (challengeId: string) => {
    Alert.alert(
      'Delete Challenge',
      'Are you sure? This will also delete all logs.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('habits')
                .delete()
                .eq('id', challengeId);

              if (error) throw error;
              loadClientData();
            } catch (error) {
              console.error('Error deleting challenge:', error);
              Alert.alert('Error', 'Failed to delete challenge');
            }
          },
        },
      ]
    );
  };

  const handleDeletePendingResolution = async (session: any) => {
      try {
          const { error } = await supabase.from('sessions').delete().eq('id', session.id);
          if (error) throw error;
          
          loadClientData();
      } catch (error) {
          console.error('Error deleting resolution:', error);
          Alert.alert('Error', 'Failed to delete resolution');
      }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  if (!client) {
    return (
      <View style={styles.container}>
        <Text>Client not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>{(client as any).profiles?.full_name || 'Client'}</Text>
        <TouchableOpacity style={styles.headerButton} onPress={() => setSchedulerVisible(true)}>
          <CalendarIcon size={24} color="#3B82F6" />
        </TouchableOpacity>
      </View>

      {pendingResolutions.length > 0 && (
        <TouchableOpacity 
          style={styles.pendingBanner}
          onPress={() => {
            setPendingModalVisible(true);
          }}
        >
            <Text style={styles.pendingBannerText}>
                ⚠️ {pendingResolutions.length} Proposed Resolution{pendingResolutions.length > 1 ? 's' : ''} Pending
            </Text>
            <Text style={styles.pendingBannerSubtext}>Tap to review</Text>
        </TouchableOpacity>
      )}

      <ScrollView style={styles.content}>
        {/* Client Info Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Client Information</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Goal:</Text>
            <Text style={styles.infoValue}>{client.goal || 'Not set'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Experience:</Text>
            <Text style={styles.infoValue}>{client.experience_level || 'Not set'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Height:</Text>
            <Text style={styles.infoValue}>{client.height_cm ? `${client.height_cm} cm` : 'Not set'}</Text>
          </View>
        </View>

        {/* Challenges Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Challenges</Text>
            <TouchableOpacity style={styles.addButton} onPress={openAddModal}>
              <Plus size={20} color="#FFFFFF" />
              <Text style={styles.addButtonText}>Add</Text>
            </TouchableOpacity>
          </View>

          {challenges.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No challenges yet. Add one to get started!</Text>
            </View>
          ) : (
            challenges.map((challenge) => (
              <View key={challenge.id} style={[styles.challengeCard, !challenge.is_active && styles.challengeInactive]}>
                <View style={styles.challengeHeader}>
                  <Text style={styles.challengeName}>{challenge.name}</Text>
                  <View style={styles.challengeActions}>
                    <TouchableOpacity onPress={() => toggleChallengeActive(challenge)} style={styles.iconButton}>
                      {challenge.is_active ? (
                        <ToggleRight size={24} color="#10B981" />
                      ) : (
                        <ToggleLeft size={24} color="#9CA3AF" />
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => openEditModal(challenge)} style={styles.iconButton}>
                      <Edit2 size={20} color="#3B82F6" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => deleteChallenge(challenge.id)} style={styles.iconButton}>
                      <Trash2 size={20} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
                {challenge.description && (
                  <Text style={styles.challengeDescription}>{challenge.description}</Text>
                )}
                <View style={styles.challengeMeta}>
                  {challenge.target_value && (
                    <Text style={styles.metaText}>Target: {challenge.target_value} {challenge.unit}</Text>
                  )}
                  <Text style={styles.metaText}>Type: {challenge.verification_type || 'none'}</Text>
                  <Text style={styles.metaText}>Status: {challenge.is_active ? 'Active' : 'Inactive'}</Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Challenge Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editingChallenge ? 'Edit Challenge' : 'New Challenge'}</Text>

            <TextInput
              style={styles.input}
              placeholder="Challenge Name *"
              value={name}
              onChangeText={setName}
              placeholderTextColor="#9CA3AF"
            />

            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Description"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
              placeholderTextColor="#9CA3AF"
            />

            <View style={styles.row}>
              <TextInput
                style={[styles.input, styles.halfInput]}
                placeholder="Target (e.g., 2000)"
                value={targetValue}
                onChangeText={setTargetValue}
                keyboardType="numeric"
                placeholderTextColor="#9CA3AF"
              />
              <TextInput
                style={[styles.input, styles.halfInput]}
                placeholder="Unit (e.g., ml)"
                value={unit}
                onChangeText={setUnit}
                placeholderTextColor="#9CA3AF"
              />
            </View>

            <Text style={styles.inputLabel}>Verification Type</Text>
            <View style={styles.verificationButtons}>
              {['none', 'camera', 'manual'].map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[styles.verificationButton, verificationType === type && styles.verificationButtonActive]}
                  onPress={() => setVerificationType(type)}
                >
                  <Text style={[styles.verificationText, verificationType === type && styles.verificationTextActive]}>
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleSaveChallenge}>
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Scheduler Modal */}
      {client && (
        <SchedulerModal
          visible={schedulerVisible}
          onClose={() => setSchedulerVisible(false)}
          onConfirm={handleSaveSessions}
          clientContext={{
            name: (client as any).profiles?.full_name || 'Client',
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          }}
          existingSessions={allCoachSessions} // Pass ALL coach sessions for conflict check
          targetClientId={id as string}
        />
      )}

      <PendingResolutionsModal
        visible={pendingModalVisible}
        onClose={() => {
            setPendingModalVisible(false);
            loadClientData(); // Refresh data to show correct count
        }}
        sessions={pendingResolutions}
        onResolve={(session) => {
            setPendingModalVisible(false);
            
            // Find the conflicting session
            const proposedStart = new Date(session.scheduled_at).getTime();
            const proposedEnd = proposedStart + session.duration_minutes * 60000;

            const existing = allCoachSessions.find(s => {
                if (s.id === session.id) return false;
                if (s.status === 'cancelled') return false;
                
                const start = new Date(s.scheduled_at).getTime();
                const end = start + s.duration_minutes * 60000;

                return (start < proposedEnd && end > proposedStart);
            });

            if (existing) {
                // Populate conflict info
                setCurrentConflict({
                    existingSession: {
                        ...existing,
                        client_name: existing.client?.profiles?.full_name || 'Unknown' // Assuming joined data
                    },
                    proposedSession: {
                        ...session,
                        client_name: (client as any).profiles?.full_name || 'Client'
                    },
                    recommendations: [] // Todo: fetch recommendations if needed
                });
                setConflictModalVisible(true);
            } else {
                 Alert.alert('No Conflict Found', 'The conflicting session may have been moved or cancelled. You can now confirm this session.', [
                     { text: 'Cancel', style: 'cancel' },
                     { text: 'Confirm Session', onPress: async () => {
                         // Simple status update to scheduled
                         const { error } = await supabase.from('sessions').update({ status: 'scheduled' }).eq('id', session.id);
                         if (!error) {
                             Alert.alert('Success', 'Session confirmed!');
                             loadClientData();
                         }
                     }}
                 ]);
            }
        }}
        onDelete={handleDeletePendingResolution}
      />

       {/* Conflict Resolution Modal */}
       {currentConflict && (
        <ConflictResolutionModal 
            visible={conflictModalVisible}
            conflictInfo={currentConflict}
            onCancel={() => {
                setConflictModalVisible(false);
                setCurrentConflict(null);
            }}
            onResolve={async (resolution) => {
                console.log('[ConflictResolution] onResolve called with:', resolution);
               try {
                   if (resolution.action === 'propose_new_time_for_incoming') {
                        console.log('[ConflictResolution] ========== OPTION 1 START ==========');
                        console.log('[ConflictResolution] Current session BEFORE update:', currentConflict.proposedSession);
                        console.log('[ConflictResolution] Session ID:', currentConflict.proposedSession.id);
                        
                        const updateData = { 
                            invite_sent: true,
                            status: 'proposed' 
                        };
                        console.log('[ConflictResolution] Update payload:', JSON.stringify(updateData));
                        
                        const { data, error: updateError } = await supabase
                            .from('sessions')
                            .update(updateData)
                            .eq('id', currentConflict.proposedSession.id)
                            .select('*'); // Select all fields to see what's returned
                        
                        if (updateError) {
                            console.error('[ConflictResolution] ❌ DATABASE UPDATE FAILED');
                            console.error('[ConflictResolution] Error details:', JSON.stringify(updateError));
                            Alert.alert('Database Error', JSON.stringify(updateError));
                            return;
                        }
                        
                        console.log('[ConflictResolution] ✅ DATABASE UPDATE SUCCESS');
                        console.log('[ConflictResolution] Returned data:', JSON.stringify(data, null, 2));
                        
                        if (data && data[0]) {
                            console.log('[ConflictResolution] Updated session invite_sent:', data[0].invite_sent);
                            console.log('[ConflictResolution] Updated session status:', data[0].status);
                        }
                        
                        console.log('[ConflictResolution] ========== OPTION 1 END ==========');
                        
                   } else if (resolution.action === 'propose_reschedule_for_existing') {
                        console.log('[ConflictResolution] ========== OPTION 2 START ==========');
                        console.log('[ConflictResolution] Existing session:', currentConflict.existingSession);
                        
                        const updateData = {
                            status: 'scheduled',
                            invite_sent: true,
                            cancellation_reason: 'pending_reschedule_for_' + currentConflict.proposedSession.client_id
                        };
                        console.log('[ConflictResolution] Update payload:', JSON.stringify(updateData));
                        
                        const { data, error: updateError } = await supabase
                            .from('sessions')
                            .update(updateData)
                            .eq('id', currentConflict.existingSession.id)
                            .select('*');

                        if (updateError) {
                            console.error('[ConflictResolution] ❌ DATABASE UPDATE FAILED');
                            console.error('[ConflictResolution] Error details:', JSON.stringify(updateError));
                            Alert.alert('Database Error', JSON.stringify(updateError));
                            return;
                        }
                        
                        console.log('[ConflictResolution] ✅ DATABASE UPDATE SUCCESS');
                        console.log('[ConflictResolution] Returned data:', JSON.stringify(data, null, 2));
                        console.log('[ConflictResolution] ========== OPTION 2 END ==========');
                   }
                   
                   // CRITICAL: Load data FIRST, then close modal
                   console.log('[ConflictResolution] Refreshing data...');
                   await loadClientData(); // Wait for data to refresh
                   Alert.alert('Sent', 'Resolution request sent to client.');
                   
                   // Now close modal AFTER data is loaded
                   setConflictModalVisible(false);
                   setCurrentConflict(null);
               } catch (e) {
                   console.error('[ConflictResolution] Unexpected error:', e);
                   Alert.alert('Error', 'An unexpected error occurred.');
               }
            }}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    padding: 24,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    marginRight: 16,
  },
  headerButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: '#6B7280',
    width: 100,
  },
  infoValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
    flex: 1,
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
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3B82F6',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 4,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  challengeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  challengeInactive: {
    opacity: 0.6,
    backgroundColor: '#F9FAFB',
  },
  challengeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  challengeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  challengeActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    padding: 4,
  },
  challengeDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  challengeMeta: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  metaText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 20,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 12,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    marginTop: 4,
  },
  verificationButtons: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  verificationButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  verificationButtonActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  verificationText: {
    fontSize: 14,
    color: '#6B7280',
    textTransform: 'capitalize',
  },
  verificationTextActive: {
    color: '#3B82F6',
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },

  pendingBanner: {
    backgroundColor: '#FEF3C7',
    padding: 12,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F59E0B',
    alignItems: 'center',
  },
  pendingBannerText: {
    color: '#B45309',
    fontWeight: '700',
    fontSize: 14,
  },
  pendingBannerSubtext: {
    color: '#B45309',
    fontSize: 12,
    marginTop: 2,
  },
});
