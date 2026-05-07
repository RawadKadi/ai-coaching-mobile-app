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
  Zap,
  Plus,
  MoreVertical,
  CheckCircle2,
  Circle,
  Check,
  X
} from 'lucide-react-native';
import { MotiView, AnimatePresence } from 'moti';
import { useAuth } from '@/contexts/AuthContext';
import { useBrandColors, useTheme } from '@/contexts/BrandContext';
import { supabase } from '@/lib/supabase';
import { BrandedHeader } from '@/components/BrandedHeader';
import { AssignClientsModal } from '@/components/AssignClientsModal';
import { ReassignToCoachModal } from '@/components/ReassignToCoachModal';
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
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [unassignedClients, setUnassignedClients] = useState<any[]>([]);

  // Selection Mode State
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedClientIds, setSelectedClientIds] = useState<Set<string>>(new Set());
  
  // Dropdown Menu State
  const [showCoachMenu, setShowCoachMenu] = useState(false);
  const [activeClientMenuId, setActiveClientMenuId] = useState<string | null>(null);

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

  const toggleSelectionMode = () => {
    if (selectionMode) {
      setSelectedClientIds(new Set());
    }
    setSelectionMode(!selectionMode);
  };

  const toggleClient = (clientId: string) => {
    const newSelection = new Set(selectedClientIds);
    if (newSelection.has(clientId)) {
      newSelection.delete(clientId);
    } else {
      newSelection.add(clientId);
    }
    setSelectedClientIds(newSelection);
  };

  const handleTerminate = () => {
    setShowCoachMenu(false);
    Alert.alert(
      'Terminate Coach?',
      'Are you sure you want to terminate? This action would permanently remove this coach from your team until invited again.',
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
        
        <View className="flex-row items-center gap-2">
          <TouchableOpacity 
            onPress={toggleSelectionMode}
            className={`w-10 h-10 rounded-xl items-center justify-center border ${selectionMode ? 'bg-blue-500/20 border-blue-500/40' : 'bg-slate-900 border-white/5'}`}
          >
            <CheckCircle2 size={18} color={selectionMode ? '#3B82F6' : '#94A3B8'} />
          </TouchableOpacity>

          <View>
            <TouchableOpacity 
              onPress={() => setShowCoachMenu(!showCoachMenu)}
              className="w-10 h-10 bg-slate-900 rounded-xl items-center justify-center border border-white/5"
            >
              <MoreVertical size={18} color="#94A3B8" />
            </TouchableOpacity>

            <AnimatePresence>
              {showCoachMenu && (
                <MotiView
                  from={{ opacity: 0, scale: 0.9, translateY: -10 }}
                  animate={{ opacity: 1, scale: 1, translateY: 0 }}
                  exit={{ opacity: 0, scale: 0.9, translateY: -10 }}
                  style={{ position: 'absolute', top: 48, right: 0, zIndex: 100 }}
                  className="w-48 bg-slate-900 rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
                >
                  <TouchableOpacity 
                    onPress={handleTerminate}
                    className="flex-row items-center gap-3 p-4 border-b border-white/5"
                  >
                    <Trash2 size={16} color="#F87171" />
                    <Text className="text-red-400 font-bold text-xs uppercase tracking-widest">Terminate Coach</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={() => setShowCoachMenu(false)}
                    className="flex-row items-center gap-3 p-4"
                  >
                    <X size={16} color="#94A3B8" />
                    <Text className="text-slate-400 font-bold text-xs uppercase tracking-widest">Cancel</Text>
                  </TouchableOpacity>
                </MotiView>
              )}
            </AnimatePresence>
          </View>
        </View>
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
            
            <View className="w-24 h-24 rounded-full bg-slate-950 items-center justify-center border-4 border-blue-600 shadow-2xl shadow-blue-500/50 mb-6">
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
                subCoach?.clients.map((client, index) => {
                    const isSelected = selectedClientIds.has(client.id);
                    const isMenuOpen = activeClientMenuId === client.id;

                    return (
                        <MotiView
                            key={client.id}
                            from={{ opacity: 0, translateX: -20 }}
                            animate={{ opacity: 1, translateX: 0 }}
                            transition={{ delay: 400 + (index * 50) }}
                            className="mb-4"
                        >
                            <TouchableOpacity
                                onLongPress={() => {
                                    if (!selectionMode) {
                                        setSelectionMode(true);
                                    }
                                    toggleClient(client.id);
                                }}
                                onPress={() => {
                                    if (selectionMode) {
                                        toggleClient(client.id);
                                    } else {
                                        router.push(`/(coach)/clients/${client.id}`);
                                    }
                                }}
                                style={{ borderWidth: isSelected ? 2 : 1 }}
                                className={`p-5 rounded-[32px] flex-row items-center gap-4 ${isSelected ? 'border-blue-500 bg-blue-500/10' : 'border-white/5 bg-slate-900/40'}`}
                            >
                                {selectionMode && (
                                    <MotiView 
                                        from={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        className={`w-6 h-6 rounded-lg border-2 items-center justify-center ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-slate-700 bg-slate-950'}`}
                                    >
                                        {isSelected && <Check size={14} color="white" strokeWidth={3} />}
                                    </MotiView>
                                )}

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
                                
                                <View>
                                    <TouchableOpacity 
                                        onPress={() => setActiveClientMenuId(isMenuOpen ? null : client.id)}
                                        className="w-10 h-10 items-center justify-center"
                                    >
                                        <MoreVertical size={18} color="#334155" />
                                    </TouchableOpacity>

                                    <AnimatePresence>
                                        {isMenuOpen && (
                                            <MotiView
                                                from={{ opacity: 0, scale: 0.9, translateX: 20 }}
                                                animate={{ opacity: 1, scale: 1, translateX: 0 }}
                                                exit={{ opacity: 0, scale: 0.9, translateX: 20 }}
                                                style={{ position: 'absolute', top: -10, right: 44, zIndex: 100 }}
                                                className="w-40 bg-slate-900 rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
                                            >
                                                <TouchableOpacity 
                                                    onPress={() => {
                                                        setActiveClientMenuId(null);
                                                        setSelectedClientIds(new Set([client.id]));
                                                        setShowReassignModal(true);
                                                    }}
                                                    className="flex-row items-center gap-3 p-4 border-b border-white/5"
                                                >
                                                    <Zap size={14} color="#3B82F6" />
                                                    <Text className="text-white font-bold text-[10px] uppercase tracking-widest">Reassign</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity 
                                                    onPress={() => {
                                                        setActiveClientMenuId(null);
                                                        router.push(`/(coach)/clients/${client.id}`);
                                                    }}
                                                    className="flex-row items-center gap-3 p-4"
                                                >
                                                    <ChevronRight size={14} color="#94A3B8" />
                                                    <Text className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">Details</Text>
                                                </TouchableOpacity>
                                            </MotiView>
                                        )}
                                    </AnimatePresence>
                                </View>
                            </TouchableOpacity>
                        </MotiView>
                    );
                })
            )}
        </View>

        <View className="h-20" />
      </ScrollView>

      <AnimatePresence>
        {selectionMode && selectedClientIds.size > 0 && (
          <MotiView
            from={{ opacity: 0, scale: 0.5, translateY: 50 }}
            animate={{ opacity: 1, scale: 1, translateY: 0 }}
            exit={{ opacity: 0, scale: 0.5, translateY: 50 }}
            style={{ position: 'absolute', bottom: insets.bottom + 24, right: 24, zIndex: 100 }}
          >
            <TouchableOpacity
              onPress={() => setShowReassignModal(true)}
              className="h-16 px-8 bg-blue-600 rounded-full flex-row items-center gap-3 shadow-2xl shadow-blue-500/50 border border-white/20"
            >
              <Zap size={20} color="white" strokeWidth={2.5} />
              <Text className="text-white font-black text-lg tracking-tight">Reassign {selectedClientIds.size}</Text>
            </TouchableOpacity>
          </MotiView>
        )}
      </AnimatePresence>

      {/* Modals */}
      {coach?.id && subCoach && (
        <AssignClientsModal
          visible={showAssignModal}
          subCoachId={subCoach.coach_id}
          subCoachName={subCoach.full_name}
          mainCoachId={coach.id}
          onClose={() => setShowAssignModal(false)}
          onSuccess={() => {
            loadSubCoachDetails();
            setSelectionMode(false);
            setSelectedClientIds(new Set());
          }}
        />
      )}

      {coach?.id && (
        <ReassignToCoachModal
          visible={showReassignModal}
          clients={subCoach?.clients.filter(c => selectedClientIds.has(c.id)) || []}
          mainCoachId={coach.id}
          onClose={() => {
            setShowReassignModal(false);
            if (selectionMode) {
                setSelectionMode(false);
                setSelectedClientIds(new Set());
            }
          }}
          onSuccess={() => {
            setShowReassignModal(false);
            setSelectionMode(false);
            setSelectedClientIds(new Set());
            loadSubCoachDetails();
          }}
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
