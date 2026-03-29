import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { 
  UserCheck, 
  Mail, 
  Calendar, 
  Users, 
  TrendingUp, 
  Award, 
  ChevronRight,
  ArrowLeft,
  Shield,
  Trash2,
  Zap
} from 'lucide-react-native';
import { MotiView, AnimatePresence } from 'moti';
import { useAuth } from '@/contexts/AuthContext';
import { useBrandColors, useTheme } from '@/contexts/BrandContext';
import { supabase } from '@/lib/supabase';
import { BrandedHeader } from '@/components/BrandedHeader';
import { AssignClientsModal } from '@/components/AssignClientsModal';
import { TerminationSuccessModal } from '@/components/TerminationSuccessModal';
import { BrandedAvatar } from '@/components/BrandedAvatar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface SubCoachDetails {
  coach_id: string;
  full_name: string;
  email: string;
  avatar_url?: string | null;
  joined_at: string;
  client_count: number;
  clients: Array<{
    id: string;
    full_name: string;
    email: string;
    avatar_url?: string | null;
    added_at: string;
  }>;
}

export default function SubCoachDetailsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams();
  const { coach } = useAuth();
  const { primary, secondary } = useBrandColors();
  const theme = useTheme();
  
  const [subCoach, setSubCoach] = useState<SubCoachDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [unassignedClients, setUnassignedClients] = useState<any[]>([]);

  useEffect(() => {
    if (id) {
      loadSubCoachDetails();
    }
  }, [id]);

  const loadSubCoachDetails = async () => {
    try {
      setLoading(true);
      const { data: coachDetailsRaw, error: coachError } = await supabase.rpc('get_subcoach_details', {
        p_coach_id: id
      });

      if (coachError) throw coachError;
      
      if (!coachDetailsRaw) {
        throw new Error('Sub-coach not found. They may not have accepted the invitation yet.');
      }

      const { data: clientsRaw, error: clientsError } = await supabase.rpc('get_subcoach_clients', {
        p_coach_id: id
      });

      if (clientsError) throw clientsError;

      const formattedClients = (clientsRaw || []).map((client: any) => ({
        id: client.client_id,
        full_name: client.full_name,
        email: client.email,
        avatar_url: client.avatar_url,
        added_at: client.assigned_at,
      }));

      setSubCoach({
        coach_id: coachDetailsRaw.coach_id,
        full_name: coachDetailsRaw.full_name || 'Unknown Coach',
        email: coachDetailsRaw.email || 'No email',
        avatar_url: coachDetailsRaw.avatar_url,
        joined_at: coachDetailsRaw.joined_at || coachDetailsRaw.created_at,
        client_count: formattedClients.length,
        clients: formattedClients,
      });
    } catch (error: any) {
      console.error('[SubCoachDetails] Error loading details:', error);
      Alert.alert('Error', error.message || 'Failed to load sub-coach details.');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleTerminate = () => {
    Alert.alert(
      'Terminate Sub-Coach?',
      'This action will remove the sub-coach from your team. They will lose access to your brand and all assigned clients will be unassigned. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Terminate',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              const clientsToReassign = subCoach?.clients.map(c => ({
                id: c.id,
                full_name: c.full_name,
                email: c.email
              })) || [];
              
              const { error } = await supabase.rpc('terminate_sub_coach', {
                p_sub_coach_id: id,
                p_reason: 'Terminated by main coach'
              });

              if (error) throw error;

              setUnassignedClients(clientsToReassign);
              setLoading(false);
              setShowSuccessModal(true);
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to terminate sub-coach');
              setLoading(false);
            }
          }
        }
      ]
    );
  };
  
  const handleAssignClientsNavigation = () => {
    setShowSuccessModal(false);
    router.replace('/(coach)/team/reassign');
  };

  if (loading && !subCoach) {
    return (
      <View className="flex-1 bg-slate-950 items-center justify-center">
        <ActivityIndicator color="#3B82F6" />
        <Text className="text-slate-500 mt-4 font-bold tracking-widest text-[10px] uppercase">Decrypting Identity...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-950">
      <View 
        style={{ paddingTop: insets.top + 16 }} 
        className="px-6 pb-6 flex-row items-center justify-between border-b border-white/5 bg-slate-950"
      >
        <View className="flex-row items-center gap-4">
            <TouchableOpacity 
              onPress={() => router.back()} 
              className="p-2 bg-slate-900 rounded-full border border-white/5"
            >
              <ArrowLeft size={20} color="#94A3B8" />
            </TouchableOpacity>
            <View>
                <Text className="text-slate-500 text-[10px] font-black uppercase tracking-[3px]">Growth Center</Text>
                <Text className="text-white text-xl font-black tracking-tight" numberOfLines={1}>Sub-Coach Details</Text>
            </View>
        </View>
        
        <TouchableOpacity 
          onPress={handleTerminate}
          className="w-10 h-10 bg-red-500/10 rounded-xl items-center justify-center border border-red-500/20"
        >
          <Trash2 size={18} color="#F87171" />
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          className="mx-6 mt-8 p-10 rounded-[48px] bg-slate-900/40 border border-white/5 items-center overflow-hidden"
        >
            <View className="absolute top-0 right-0 p-4 opacity-10">
                <Shield size={120} color="#3B82F6" />
            </View>
            
            <View className="w-24 h-24 rounded-[36px] bg-slate-950 items-center justify-center border-4 border-blue-600 shadow-2xl shadow-blue-500/50 mb-6">
                <BrandedAvatar 
                    name={subCoach?.full_name || ''}
                    size={84}
                    imageUrl={subCoach?.avatar_url}
                    useBrandColor={true}
                />
            </View>

            <Text className="text-white text-3xl font-black text-center tracking-tighter mb-2">{subCoach?.full_name}</Text>
            <Text className="text-slate-400 font-medium mb-6">{subCoach?.email}</Text>
            
            <View className="flex-row items-center gap-4">
                <View className="bg-blue-600/10 px-4 py-2 rounded-full border border-blue-600/20 flex-row items-center gap-2">
                    <Calendar size={14} color="#3B82F6" />
                    <Text className="text-blue-500 text-[10px] font-black uppercase tracking-widest">
                        Joined {new Date(subCoach?.joined_at || '').toLocaleDateString()}
                    </Text>
                </View>
                <View className="bg-emerald-500/10 px-4 py-2 rounded-full border border-emerald-500/20 flex-row items-center gap-2">
                    <UserCheck size={14} color="#10B981" />
                    <Text className="text-emerald-500 text-[10px] font-black uppercase tracking-widest">Active</Text>
                </View>
            </View>
        </MotiView>

        {/* Stats Section */}
        <View className="flex-row px-6 mt-8 gap-4">
            <MotiView 
                from={{ opacity: 0, scale: 0.9 }} 
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 200 }}
                className="flex-1 bg-slate-900/40 p-6 rounded-[32px] border border-white/5 items-center"
            >
                <View className="w-10 h-10 rounded-2xl bg-blue-600/10 items-center justify-center border border-blue-600/20 mb-3">
                    <Users size={18} color="#3B82F6" />
                </View>
                <Text className="text-white text-2xl font-black tracking-tighter">{subCoach?.client_count}</Text>
                <Text className="text-slate-500 text-[8px] font-black uppercase tracking-widest mt-1">Assigned Clients</Text>
            </MotiView>
            <MotiView 
                from={{ opacity: 0, scale: 0.9 }} 
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 300 }}
                className="flex-1 bg-slate-900/40 p-6 rounded-[32px] border border-white/5 items-center"
            >
                <View className="w-10 h-10 rounded-2xl bg-emerald-500/10 items-center justify-center border border-emerald-500/20 mb-3">
                    <TrendingUp size={18} color="#10B981" />
                </View>
                <Text className="text-white text-2xl font-black tracking-tighter">98%</Text>
                <Text className="text-slate-500 text-[8px] font-black uppercase tracking-widest mt-1">Productivity</Text>
            </MotiView>
        </View>

        {/* Clients Section */}
        <View className="px-6 mt-10">
            <View className="flex-row items-center justify-between mb-8">
                <Text className="text-white text-xl font-black tracking-tighter">Assigned Roster</Text>
                <TouchableOpacity 
                    onPress={() => setShowAssignModal(true)}
                    className="flex-row items-center gap-2 bg-blue-600 px-4 py-2.5 rounded-2xl shadow-lg shadow-blue-500/30 border border-white/10"
                >
                    <Plus size={16} color="white" strokeWidth={3} />
                    <Text className="text-white font-black text-xs uppercase tracking-widest">Assign</Text>
                </TouchableOpacity>
            </View>

            {subCoach?.clients.length === 0 ? (
                <View className="py-16 items-center justify-center bg-slate-900/20 rounded-[40px] border border-white/5 border-dashed">
                    <Users size={48} color="#1E293B" />
                    <Text className="text-slate-400 font-bold mt-4">No active assignments</Text>
                </View>
            ) : (
                subCoach?.clients.map((client, index) => (
                    <MotiView
                        key={client.id}
                        from={{ opacity: 0, translateX: -20 }}
                        animate={{ opacity: 1, translateX: 0 }}
                        transition={{ delay: 400 + (index * 50) }}
                        className="mb-4"
                    >
                        <TouchableOpacity
                            onPress={() => router.push(`/(coach)/clients/${client.id}`)}
                            className="p-5 rounded-[32px] bg-slate-900/40 border border-white/5 flex-row items-center gap-4"
                        >
                            <BrandedAvatar 
                                name={client.full_name}
                                size={48}
                                imageUrl={client.avatar_url}
                                useBrandColor={true}
                            />
                            <View className="flex-1">
                                <Text className="text-white font-black text-base tracking-tight mb-0.5">{client.full_name}</Text>
                                <Text className="text-slate-500 text-xs font-medium mb-2">{client.email}</Text>
                                <View className="flex-row items-center gap-2">
                                    <View className="w-1 h-1 rounded-full bg-slate-800" />
                                    <Text className="text-slate-500 text-[8px] font-black uppercase tracking-widest">
                                        Assigned {new Date(client.added_at).toLocaleDateString()}
                                    </Text>
                                </View>
                            </View>
                            <ChevronRight size={18} color="#334155" />
                        </TouchableOpacity>
                    </MotiView>
                ))
            )}
        </View>

        <View className="h-20" />
      </ScrollView>

      {/* Modals */}
      {coach?.id && subCoach && (
        <AssignClientsModal
          visible={showAssignModal}
          subCoachId={subCoach.coach_id}
          subCoachName={subCoach.full_name}
          mainCoachId={coach.id}
          onClose={() => setShowAssignModal(false)}
          onSuccess={() => loadSubCoachDetails()}
        />
      )}

      <TerminationSuccessModal
        visible={showSuccessModal}
        unassignedClients={unassignedClients}
        onAssignClients={handleAssignClientsNavigation}
      />
    </View>
  );
}
