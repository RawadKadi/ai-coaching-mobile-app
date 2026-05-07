import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  FlatList,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { X, Check, Users, Search, Zap, Shield, ChevronRight, UserPlus } from 'lucide-react-native';
import { MotiView, AnimatePresence } from 'moti';
import { supabase } from '@/lib/supabase';
import { useBrandColors, useTheme } from '@/contexts/BrandContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandedAvatar } from './BrandedAvatar';

interface Client {
  id: string;
  full_name: string;
  email: string;
  avatar_url?: string | null;
}

interface Coach {
  coach_id: string;
  user_id: string;
  full_name: string;
  client_count: number;
  avatar_url?: string | null;
}

interface ReassignToCoachModalProps {
  visible: boolean;
  clients: Client[];
  mainCoachId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function ReassignToCoachModal({
  visible,
  clients,
  mainCoachId,
  onClose,
  onSuccess,
}: ReassignToCoachModalProps) {
  const insets = useSafeAreaInsets();
  const { primary, secondary } = useBrandColors();
  const theme = useTheme();
  
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCoachId, setSelectedCoachId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (visible) {
      loadCoaches();
      setSuccess(false);
      setSelectedCoachId(null);
      setSearchQuery('');
    }
  }, [visible]);

  const loadCoaches = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_active_sub_coaches', {
        p_main_coach_id: mainCoachId
      });

      if (error) throw error;
      setCoaches(data || []);
    } catch (error: any) {
      console.error('[ReassignToCoachModal] Error loading coaches:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReassign = async () => {
    if (!selectedCoachId || clients.length === 0) return;

    try {
      setAssigning(true);
      const clientIds = clients.map(c => c.id);
      
      const { error } = await supabase.rpc('assign_clients_to_subcoach', {
        p_main_coach_id: mainCoachId,
        p_subcoach_id: selectedCoachId,
        p_client_ids: clientIds
      });

      if (error) throw error;

      // Send automated message
      let targetUserId = coaches.find(c => c.coach_id === selectedCoachId)?.user_id;
      
      if (!targetUserId) {
        const { data: coachData } = await supabase
          .from('sub_coaches')
          .select('user_id')
          .eq('id', selectedCoachId)
          .single();
        targetUserId = coachData?.user_id;
      }

      if (targetUserId) {
        const clientNames = clients.map(c => c.full_name).join(', ');
        const messageContent = clients.length === 1 
            ? `I've assigned ${clients[0].full_name} to your roster. Let's get them started!`
            : `I've assigned ${clients.length} new clients to your roster: ${clientNames}. Let's get to work!`;

        await supabase.from('messages').insert({
          sender_id: mainCoachId,
          recipient_id: targetUserId,
          content: messageContent
        });
      }

      setSuccess(true);
      setTimeout(() => {
        onSuccess();
      }, 2000);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to reassign clients');
    } finally {
      setAssigning(false);
    }
  };

  const filteredCoaches = coaches.filter(c => 
    c.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderCoach = ({ item }: { item: Coach }) => {
    const isSelected = selectedCoachId === item.coach_id;
    return (
      <TouchableOpacity
        onPress={() => setSelectedCoachId(item.coach_id)}
        style={{ borderWidth: isSelected ? 2 : 1 }}
        className={`p-5 rounded-[32px] flex-row items-center gap-4 mb-3 ${isSelected ? 'border-blue-500 bg-blue-500/10' : 'border-white/5 bg-slate-900/40'}`}
      >
        <BrandedAvatar 
          name={item.full_name}
          size={48}
          imageUrl={item.avatar_url}
          useBrandColor={true}
        />
        <View className="flex-1">
          <Text className="text-white font-black text-base tracking-tight mb-0.5">{item.full_name}</Text>
          <View className="flex-row items-center gap-2">
            <Users size={12} color="#94A3B8" />
            <Text className="text-slate-500 text-[8px] font-black uppercase tracking-widest">{item.client_count} Assigned Clients</Text>
          </View>
        </View>
        <View className={`w-6 h-6 rounded-full border-2 items-center justify-center ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-slate-700 bg-slate-950'}`}>
          {isSelected && <View className="w-2 h-2 rounded-full bg-white" />}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-slate-950/90 justify-end">
        <MotiView 
            from={{ translateY: 500 }}
            animate={{ translateY: 0 }}
            className="bg-slate-950 rounded-t-[48px] border-t border-white/10"
            style={{ height: '85%', paddingBottom: insets.bottom }}
        >
          {success ? (
            <View className="flex-1 items-center justify-center p-8">
              <MotiView
                from={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-24 h-24 bg-emerald-500 rounded-full items-center justify-center mb-8"
              >
                <Check size={48} color="white" strokeWidth={4} />
              </MotiView>
              <Text className="text-white text-3xl font-black text-center tracking-tighter mb-4">Clients Reassigned!</Text>
              <Text className="text-slate-500 text-center text-base font-medium px-4">
                {clients.length} athlete{clients.length > 1 ? 's have' : ' has'} been successfully moved to {coaches.find(c => c.coach_id === selectedCoachId)?.full_name}'s roster.
              </Text>
            </View>
          ) : (
            <>
              {/* Header */}
              <View className="px-8 py-8 flex-row items-center justify-between border-b border-white/5">
                <View>
                  <Text className="text-slate-500 text-[10px] font-black uppercase tracking-[3px]">Strategic Shift</Text>
                  <Text className="text-white text-2xl font-black tracking-tight">Reassign Roster</Text>
                </View>
                <TouchableOpacity 
                  onPress={onClose} 
                  className="p-3 bg-slate-900 rounded-full border border-white/5"
                >
                  <X size={20} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                {/* Selected Clients Summary */}
                <View className="px-8 mt-8">
                  <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-4">Selected Clients ({clients.length})</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-3">
                    {clients.map(client => (
                      <View key={client.id} className="bg-slate-900 px-4 py-2 rounded-full border border-white/5 flex-row items-center gap-2 mr-2">
                        <BrandedAvatar name={client.full_name} size={20} imageUrl={client.avatar_url} />
                        <Text className="text-white font-bold text-[10px] tracking-tight">{client.full_name}</Text>
                      </View>
                    ))}
                  </ScrollView>
                </View>

                {/* Coach Selection */}
                <View className="px-8 mt-10">
                  <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-4">Select Target Coach</Text>
                  
                  <View className="bg-slate-900 rounded-[24px] border border-white/5 flex-row items-center px-5 mb-6 h-14">
                    <Search size={18} color="#475569" />
                    <TextInput 
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                      placeholder="Search coaches..."
                      placeholderTextColor="#475569"
                      className="flex-1 ml-3 text-white font-medium"
                    />
                  </View>

                  {loading ? (
                    <ActivityIndicator color="#3B82F6" className="my-10" />
                  ) : filteredCoaches.length === 0 ? (
                    <View className="py-20 items-center justify-center">
                        <Users size={40} color="#1E293B" />
                        <Text className="text-slate-500 font-bold mt-4">No active coaches found</Text>
                    </View>
                  ) : (
                    filteredCoaches.map(coach => renderCoach({ item: coach }))
                  )}
                </View>
                <View className="h-32" />
              </ScrollView>

              {/* Footer */}
              <View className="p-8 border-t border-white/5 bg-slate-950">
                <TouchableOpacity
                  disabled={!selectedCoachId || assigning}
                  onPress={handleReassign}
                  style={{ opacity: (!selectedCoachId || assigning) ? 0.5 : 1 }}
                  className="h-16 bg-blue-600 rounded-[24px] flex-row items-center justify-center gap-3 shadow-2xl shadow-blue-500/40 border border-white/10"
                >
                  {assigning ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <>
                      <Zap size={20} color="white" strokeWidth={2.5} />
                      <Text className="text-white font-black text-lg tracking-tight">Confirm Reassignment</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
        </MotiView>
      </View>
    </Modal>
  );
}
