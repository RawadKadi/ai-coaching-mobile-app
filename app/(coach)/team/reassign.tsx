import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Check, Users, UserPlus, AlertCircle, ArrowLeft, ChevronRight, Shield } from 'lucide-react-native';
import { MotiView, AnimatePresence } from 'moti';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useBrandColors, useTheme } from '@/contexts/BrandContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  const insets = useSafeAreaInsets();
  const { coach } = useAuth();
  const { primary, secondary } = useBrandColors();
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
      <View className="flex-1 bg-slate-950 items-center justify-center">
        <ActivityIndicator color="#3B82F6" />
        <Text className="text-slate-500 mt-4 font-bold tracking-widest text-[10px] uppercase">Reconfiguring Neural Network...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-950">
      <View 
        style={{ paddingTop: insets.top + 16 }} 
        className="px-6 pb-6 flex-row items-center gap-4 border-b border-white/5 bg-slate-950"
      >
        <TouchableOpacity 
          onPress={() => router.back()} 
          className="p-2 bg-slate-900 rounded-full border border-white/5"
        >
          <ArrowLeft size={20} color="#94A3B8" />
        </TouchableOpacity>
        <View>
            <Text className="text-slate-500 text-[10px] font-black uppercase tracking-[3px]">Growth Center</Text>
            <Text className="text-white text-xl font-black tracking-tight">Reassign Clients</Text>
        </View>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Step 1: Select Clients */}
        <View className="px-6 mt-8">
            <View className="flex-row items-center justify-between mb-6">
                <Text className="text-white text-xl font-black tracking-tighter">1. Select Target Athletes</Text>
                <View className="bg-blue-600/10 px-3 py-1 rounded-full border border-blue-600/20">
                    <Text className="text-blue-500 text-[10px] font-black uppercase tracking-widest">{clients.length} Unassigned</Text>
                </View>
            </View>
          
          {clients.length === 0 ? (
            <MotiView 
                from={{ opacity: 0 }} 
                animate={{ opacity: 1 }}
                className="py-12 items-center justify-center bg-emerald-500/5 rounded-[32px] border border-emerald-500/20 border-dashed"
            >
              <Check size={32} color="#10B981" />
              <Text className="text-emerald-500 font-bold mt-4 tracking-tight">All identities synchronized.</Text>
            </MotiView>
          ) : (
            clients.map((client, index) => {
              const isSelected = selectedClients.has(client.client_id);
              return (
                <MotiView
                  key={client.client_id}
                  from={{ opacity: 0, translateX: -10 }}
                  animate={{ opacity: 1, translateX: 0 }}
                  transition={{ delay: index * 50 }}
                  className="mb-3"
                >
                  <TouchableOpacity
                    style={{ borderWidth: isSelected ? 2 : 1 }}
                    className={`p-5 rounded-[24px] flex-row items-center gap-4 ${isSelected ? 'border-blue-500 bg-blue-500/10' : 'border-white/5 bg-slate-900/40'}`}
                    onPress={() => toggleClient(client.client_id)}
                  >
                    <View className={`w-6 h-6 rounded-lg border-2 items-center justify-center ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-slate-700 bg-slate-950'}`}>
                      {isSelected && <Check size={14} color="white" strokeWidth={3} />}
                    </View>
                    <View className="flex-1">
                      <Text className="text-white font-black text-base tracking-tight">{client.client_name}</Text>
                      <Text className="text-slate-500 text-xs font-medium">{client.client_email}</Text>
                    </View>
                  </TouchableOpacity>
                </MotiView>
              );
            })
          )}
        </View>

        {/* Step 2: Select Coach */}
        {clients.length > 0 && (
          <View className="px-6 mt-10">
            <Text className="text-white text-xl font-black tracking-tighter mb-6">2. Strategic Deployment</Text>
            
            {coaches.map((c, index) => {
              const isSelected = selectedCoachId === c.coach_id;
              return (
                <MotiView
                  key={c.coach_id}
                  from={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 200 + (index * 50) }}
                  className="mb-3"
                >
                  <TouchableOpacity
                    style={{ borderWidth: isSelected ? 2 : 1 }}
                    className={`p-5 rounded-[24px] flex-row items-center gap-4 ${isSelected ? 'border-emerald-500 bg-emerald-500/10' : 'border-white/5 bg-slate-900/40'}`}
                    onPress={() => setSelectedCoachId(c.coach_id)}
                  >
                    <View className={`w-6 h-6 rounded-full border-2 items-center justify-center ${isSelected ? 'bg-emerald-500 border-emerald-500' : 'border-slate-700 bg-slate-950'}`}>
                      {isSelected && <View className="w-2 h-2 rounded-full bg-white" />}
                    </View>
                    <View className="flex-1">
                      <Text className="text-white font-black text-base tracking-tight">{c.full_name}</Text>
                      <View className="flex-row items-center gap-2 mt-1">
                        <Users size={12} color="#94A3B8" />
                        <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest">{c.client_count} Assigned</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                </MotiView>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Footer Action */}
      {clients.length > 0 && (
        <MotiView 
            from={{ translateY: 100 }}
            animate={{ translateY: 0 }}
            className="absolute bottom-0 left-0 right-0 p-6 bg-slate-950 border-t border-white/5"
        >
          <TouchableOpacity
            style={{ opacity: (selectedClients.size === 0 || !selectedCoachId || assigning) ? 0.5 : 1 }}
            disabled={selectedClients.size === 0 || !selectedCoachId || assigning}
            onPress={handleAssign}
            className="h-16 bg-blue-600 rounded-[22px] flex-row items-center justify-center gap-3 shadow-2xl shadow-blue-500/40 border border-white/10"
          >
            {assigning ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <Shield size={20} color="white" strokeWidth={2.5} />
                <Text className="text-white font-black text-lg tracking-tight">
                    Confirm Deployment {selectedClients.size > 0 ? `(${selectedClients.size})` : ''}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </MotiView>
      )}
    </View>
  );
}
