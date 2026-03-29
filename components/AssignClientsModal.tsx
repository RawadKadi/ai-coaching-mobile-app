import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { X, Check, UserCheck, AlertTriangle, Users, Plus, Shield } from 'lucide-react-native';
import { MotiView, AnimatePresence } from 'moti';
import { supabase } from '@/lib/supabase';
import { useBrandColors, useTheme } from '@/contexts/BrandContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandedAvatar } from './BrandedAvatar';

interface Client {
  client_id: string;
  client_name: string;
  client_email: string;
  current_coach_id: string | null;
  current_coach_name: string;
  is_assigned: boolean;
  avatar_url?: string | null;
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
  const insets = useSafeAreaInsets();
  const { primary, secondary } = useBrandColors();
  const theme = useTheme();
  
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
      const { data, error } = await supabase.rpc('get_clients_for_assignment', {
        p_main_coach_id: mainCoachId
      });

      if (error) throw error;
      
      const availableClients = (data || []).filter(
        (c: Client) => c.current_coach_id !== subCoachId
      );
      
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
        Alert.alert('Success', `✅ Assigned ${result.total_count} client(s)`);
        onSuccess();
        onClose();
      } else {
        throw new Error('Assignment failed');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to assign clients');
    } finally {
      setAssigning(false);
    }
  };

  const renderClient = ({ item, index }: { item: Client, index: number }) => {
    const isSelected = selectedClients.has(item.client_id);
    
    return (
      <MotiView
        from={{ opacity: 0, translateY: 10 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ delay: index * 50 }}
        className="mb-3"
      >
        <TouchableOpacity
          style={{ borderWidth: isSelected ? 2 : 1 }}
          className={`p-5 rounded-[28px] flex-row items-center gap-4 ${isSelected ? 'border-blue-500 bg-blue-500/10' : 'border-white/5 bg-slate-900/40'}`}
          onPress={() => toggleClient(item.client_id)}
        >
          <View className={`w-6 h-6 rounded-lg border-2 items-center justify-center ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-slate-700 bg-slate-950'}`}>
            {isSelected && <Check size={14} color="white" strokeWidth={3} />}
          </View>
          
          <BrandedAvatar 
            name={item.client_name}
            size={44}
            imageUrl={item.avatar_url}
            useBrandColor={true}
          />
          
          <View className="flex-1">
            <Text className="text-white font-black text-base tracking-tight mb-0.5">{item.client_name}</Text>
            <Text className="text-slate-500 text-xs font-medium mb-1">{item.client_email}</Text>
            
            {item.is_assigned && (
              <View className="flex-row items-center gap-1.5 opacity-60">
                <UserCheck size={10} color="#F59E0B" />
                <Text className="text-amber-500 text-[8px] font-black uppercase tracking-widest">
                  Currently with {item.current_coach_name}
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </MotiView>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-slate-950">
        <View className="px-6 py-6 flex-row items-center justify-between border-b border-white/5">
          <View>
            <Text className="text-slate-500 text-[10px] font-black uppercase tracking-[3px]">Growth Center</Text>
            <Text className="text-white text-xl font-black tracking-tight" numberOfLines={1}>Assign to {subCoachName}</Text>
          </View>
          <TouchableOpacity 
            onPress={onClose} 
            className="p-2 bg-slate-900 rounded-full border border-white/5"
          >
            <X size={20} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#3B82F6" />
            <Text className="text-slate-500 mt-4 font-bold tracking-widest text-[10px] uppercase">Mapping Identities...</Text>
          </View>
        ) : clients.length === 0 ? (
          <View className="flex-1 items-center justify-center p-8">
            <Shield size={48} color="#1E293B" />
            <Text className="text-white text-xl font-black text-center mt-6 tracking-tighter">Full Sync Achieved</Text>
            <Text className="text-slate-500 text-center mt-3 leading-5 font-medium px-4">
              All eligible athletes are already integrated into {subCoachName}'s roster.
            </Text>
          </View>
        ) : (
          <View className="flex-1">
             <View className="px-6 py-4 flex-row items-center gap-3 bg-amber-500/10 border-b border-white/5">
                <AlertTriangle size={16} color="#F59E0B" />
                <Text className="text-amber-500 text-[10px] font-black uppercase tracking-widest flex-1">
                    Assigning will re-route existing coach connections.
                </Text>
             </View>

             <FlatList
               data={clients}
               renderItem={renderClient}
               keyExtractor={(item) => item.client_id}
               contentContainerStyle={{ padding: 24, paddingBottom: 120 }}
               showsVerticalScrollIndicator={false}
             />
          </View>
        )}

        {/* Footer */}
        <AnimatePresence>
            {!loading && clients.length > 0 && (
                <MotiView 
                    from={{ translateY: 100 }}
                    animate={{ translateY: 0 }}
                    className="absolute bottom-0 left-0 right-0 p-8 bg-slate-950 border-t border-white/5"
                >
                    <TouchableOpacity
                        disabled={selectedClients.size === 0 || assigning}
                        onPress={performAssignment}
                        style={{ opacity: (selectedClients.size === 0 || assigning) ? 0.5 : 1 }}
                        className="h-16 bg-blue-600 rounded-[22px] flex-row items-center justify-center gap-3 shadow-2xl shadow-blue-500/40 border border-white/10"
                    >
                        {assigning ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <>
                                <Users size={20} color="white" strokeWidth={2.5} />
                                <Text className="text-white font-black text-lg tracking-tight">
                                    Finalize Assignment {selectedClients.size > 0 ? `(${selectedClients.size})` : ''}
                                </Text>
                            </>
                        )}
                    </TouchableOpacity>
                </MotiView>
            )}
        </AnimatePresence>
      </View>
    </Modal>
  );
}
