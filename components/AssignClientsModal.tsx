import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { X, Check, UserCheck, AlertTriangle } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useBrandColors } from '@/contexts/BrandContext';

interface Client {
  client_id: string;
  client_name: string;
  client_email: string;
  current_coach_id: string | null;
  current_coach_name: string;
  is_assigned: boolean;
}

interface AssignClientsModalProps {
  visible: boolean;
  subCoachId: string;
  subCoachName: string;
  mainCoachId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function AssignClientsModal({
  visible,
  subCoachId,
  subCoachName,
  mainCoachId,
  onClose,
  onSuccess,
}: AssignClientsModalProps) {
  const { primary, secondary } = useBrandColors();
  
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    if (visible) {
      loadClients();
    } else {
      setSelectedClients(new Set());
    }
  }, [visible]);

  const loadClients = async () => {
    try {
      setLoading(true);
      console.log('[AssignClientsModal] Loading clients for main coach:', mainCoachId);
      console.log('[AssignClientsModal] Sub-coach to filter out:', subCoachId);
      
      const { data, error } = await supabase.rpc('get_clients_for_assignment', {
        p_main_coach_id: mainCoachId
      });

      console.log('[AssignClientsModal] RPC response - data:', data);
      console.log('[AssignClientsModal] RPC response - error:', error);

      if (error) throw error;
      
      // Filter out clients already assigned to this sub-coach
      const availableClients = (data || []).filter(
        (c: Client) => c.current_coach_id !== subCoachId
      );
      
      console.log('[AssignClientsModal] Available clients after filter:', availableClients.length);
      console.log('[AssignClientsModal] Total clients from RPC:', (data || []).length);
      console.log('[AssignClientsModal] Filtered out:', (data || []).length - availableClients.length);
      
      setClients(availableClients);
    } catch (error: any) {
      console.error('[AssignClientsModal] Error loading clients:', error);
      Alert.alert('Error', 'Failed to load clients');
    } finally {
      setLoading(false);
    }
  };

  const toggleClient = (clientId: string) => {
    const newSelection = new Set(selectedClients);
    if (newSelection.has(clientId)) {
      newSelection.delete(clientId);
    } else {
      newSelection.add(clientId);
    }
    setSelectedClients(newSelection);
  };

  const handleAssign = async () => {
    if (selectedClients.size === 0) {
      Alert.alert('No Selection', 'Please select at least one client');
      return;
    }

    const selectedClientsList = clients.filter(c => selectedClients.has(c.client_id));
    const reassignedClients = selectedClientsList.filter(c => c.is_assigned);

    // Show confirmation if there are reassignments
    if (reassignedClients.length > 0) {
      const message = reassignedClients.length === 1
        ? `${reassignedClients[0].client_name} is currently assigned to ${reassignedClients[0].current_coach_name}.\n\nReassign to ${subCoachName}?`
        : `${reassignedClients.length} clients will be reassigned:\n\n` +
          reassignedClients.map(c => `• ${c.client_name} (from ${c.current_coach_name})`).join('\n') +
          `\n\nContinue?`;

      Alert.alert(
        '⚠️ Reassignment Confirmation',
        message,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Reassign',
            style: 'destructive',
            onPress: () => performAssignment(),
          },
        ]
      );
    } else {
      performAssignment();
    }
  };

  const performAssignment = async () => {
    try {
      setAssigning(true);
      
      const clientIds = Array.from(selectedClients);
      const { data, error } = await supabase.rpc('assign_clients_to_subcoach', {
        p_main_coach_id: mainCoachId,
        p_subcoach_id: subCoachId,
        p_client_ids: clientIds,
      });

      if (error) throw error;

      const result = data as { success: boolean; reassigned_count: number; new_assigned_count: number; total_count: number };

      if (result.success) {
        const message = result.reassigned_count > 0
          ? `✅ Assigned ${result.total_count} client(s)\n• ${result.new_assigned_count} new\n• ${result.reassigned_count} reassigned`
          : `✅ Assigned ${result.total_count} client(s)`;

        Alert.alert('Success', message);
        onSuccess();
        onClose();
      } else {
        throw new Error('Assignment failed');
      }
    } catch (error: any) {
      console.error('[AssignClientsModal] Assignment error:', error);
      Alert.alert('Error', error.message || 'Failed to assign clients');
    } finally {
      setAssigning(false);
    }
  };

  const renderClient = ({ item }: { item: Client }) => {
    const isSelected = selectedClients.has(item.client_id);
    
    return (
      <TouchableOpacity
        style={[
          styles.clientCard,
          isSelected && { borderColor: primary, backgroundColor: `${primary}10` },
        ]}
        onPress={() => toggleClient(item.client_id)}
      >
        <View style={styles.clientInfo}>
          <View style={[
            styles.checkbox,
            { borderColor: isSelected ? primary : '#D1D5DB' },
            isSelected && { backgroundColor: primary },
          ]}>
            {isSelected && <Check size={16} color="#FFFFFF" />}
          </View>
          
          <View style={styles.clientDetails}>
            <Text style={styles.clientName}>{item.client_name}</Text>
            <Text style={styles.clientEmail}>{item.client_email}</Text>
            
            {item.is_assigned && (
              <View style={styles.assignmentBadge}>
                <UserCheck size={12} color="#F59E0B" />
                <Text style={styles.assignmentText}>
                  Currently: {item.current_coach_name}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: primary }]}>
          <View>
            <Text style={styles.title}>Assign Clients</Text>
            <Text style={styles.subtitle}>to {subCoachName}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={24} color="#6B7280" />
          </TouchableOpacity>
        </View>

        {/* Content */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={primary} />
            <Text style={styles.loadingText}>Loading clients...</Text>
          </View>
        ) : clients.length === 0 ? (
          <View style={styles.emptyContainer}>
            <UserCheck size={48} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>All Clients Assigned</Text>
            <Text style={styles.emptyText}>
              All available clients are already assigned to {subCoachName}.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.info}>
              <AlertTriangle size={16} color="#F59E0B" />
              <Text style={styles.infoText}>
                Assigning a client will remove them from their current coach
              </Text>
            </View>

            <FlatList
              data={clients}
              renderItem={renderClient}
              keyExtractor={(item) => item.client_id}
              contentContainerStyle={styles.list}
            />
          </>
        )}

        {/* Footer */}
        {!loading && clients.length > 0 && (
          <View style={styles.footer}>
            <Text style={styles.selectionCount}>
              {selectedClients.size} selected
            </Text>
            <TouchableOpacity
              style={[
                styles.assignButton,
                { backgroundColor: primary },
                (selectedClients.size === 0 || assigning) && styles.assignButtonDisabled,
              ]}
              onPress={handleAssign}
              disabled={selectedClients.size === 0 || assigning}
            >
              {assigning ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.assignButtonText}>
                  Assign {selectedClients.size > 0 ? `(${selectedClients.size})` : ''}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 2,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  closeButton: {
    padding: 8,
  },
  info: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    padding: 12,
    margin: 16,
    borderRadius: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#92400E',
  },
  list: {
    padding: 16,
    paddingTop: 0,
  },
  clientCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  clientInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clientDetails: {
    flex: 1,
  },
  clientName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  clientEmail: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 6,
  },
  assignmentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  assignmentText: {
    fontSize: 12,
    color: '#F59E0B',
    fontWeight: '500',
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
    padding: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  selectionCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  assignButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
  },
  assignButtonDisabled: {
    opacity: 0.5,
  },
  assignButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
