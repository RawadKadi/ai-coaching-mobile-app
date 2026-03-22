import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Platform, SafeAreaView, RefreshControl, ScrollView } from 'react-native';
import { MotiView } from 'moti';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Calendar as CalendarIcon, Clock, Video, ChevronRight, User, Plus, Zap, AlertCircle } from 'lucide-react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import SchedulerModal from '@/components/SchedulerModal';
import ManualSchedulerModal from '@/components/ManualSchedulerModal';
import { ProposedSession } from '@/lib/ai-scheduling-service';
import { BrandedAvatar } from '@/components/BrandedAvatar';

export default function CalendarScreen() {
  const { profile, coach } = useAuth();
  const router = useRouter();
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showManualScheduler, setShowManualScheduler] = useState(false);
  const [showAIScheduler, setShowAIScheduler] = useState(false);
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [initialClientData, setInitialClientData] = useState<any>(null);

  useEffect(() => {
    const fetchClientData = async () => {
      if (selectedClient && showManualScheduler && !showAIScheduler) {
        const { data } = await supabase.from('clients').select('id, user_id, profiles(full_name, avatar_url)').eq('id', selectedClient.id).single();
        if (data) setInitialClientData(data);
      } else if (!showManualScheduler) setInitialClientData(null);
    };
    fetchClientData();
  }, [selectedClient, showManualScheduler, showAIScheduler]);

  useFocusEffect(useCallback(() => { if (profile) loadSessions(); }, [profile]));

  const loadSessions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('sessions').select('*, client:clients(profiles(full_name, avatar_url))').eq('coach_id', coach?.id).order('scheduled_at', { ascending: true });
      if (error) throw error;
      setSessions(data || []);
    } catch (e) { console.error(e); } finally { setLoading(false); setRefreshing(false); }
  };

  const getSessionsForDate = (date: Date) => {
    return sessions.filter(s => {
      const sd = new Date(s.scheduled_at);
      return sd.getDate() === date.getDate() && sd.getMonth() === date.getMonth() && sd.getFullYear() === date.getFullYear();
    });
  };

  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d;
  });

  if (loading && !refreshing) return <View className="flex-1 bg-slate-950 items-center justify-center"><ActivityIndicator color="#3B82F6" /></View>;

  return (
    <View style={{ flex: 1 }} className="bg-slate-950">
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flex: 1 }}>
          {/* Header */}
          <View className="px-6 pt-10 pb-6">
              <Text className="text-blue-500 text-[10px] font-black uppercase tracking-[4px] mb-1">Operational Phase</Text>
              <Text className="text-white text-3xl font-black">Calendar</Text>
          </View>

          {/* Date Matrix */}
          <View className="mb-4">
              <FlatList
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  data={days}
                  keyExtractor={item => item.toISOString()}
                  contentContainerStyle={{ paddingHorizontal: 24, paddingRight: 40, gap: 12 }}
                  renderItem={({ item }) => {
                      const isS = item.toDateString() === selectedDate.toDateString();
                      const has = getSessionsForDate(item).length > 0;
                      return (
                          <TouchableOpacity 
                              onPress={() => setSelectedDate(item)}
                              className={`w-14 h-20 rounded-2xl items-center justify-center border ${isS ? 'bg-blue-600 border-blue-400 shadow-lg shadow-blue-500/40' : 'bg-slate-900/50 border-slate-900'}`}
                          >
                              <Text className={`text-[10px] font-black uppercase tracking-tighter ${isS ? 'text-white/60' : 'text-slate-600'}`}>{item.toLocaleDateString('en-US', { weekday: 'short' })}</Text>
                              <Text className={`text-xl font-black mt-1 ${isS ? 'text-white' : 'text-slate-400'}`}>{item.getDate()}</Text>
                              {has && <View className={`w-1 h-1 rounded-full mt-2 ${isS ? 'bg-white' : 'bg-blue-600'}`} />}
                          </TouchableOpacity>
                      );
                  }}
              />
          </View>

          <ScrollView 
              className="flex-1 px-6"
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadSessions(); }} tintColor="#3B82F6" />}
          >
              <View className="flex-row items-center gap-3 mb-6 mt-6">
                  <View className="w-1 h-4 bg-blue-600 rounded-full" />
                  <Text className="text-white text-lg font-black">{selectedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</Text>
              </View>

              <View className="space-y-4 pb-32">
                  {getSessionsForDate(selectedDate).length === 0 ? (
                      <View className="p-12 items-center justify-center bg-slate-900/20 rounded-[40px] border border-slate-900 border-dashed">
                          <CalendarIcon size={32} color="#1E293B" />
                          <Text className="text-slate-700 font-black text-xs uppercase tracking-widest mt-6">Clear Window</Text>
                          <Text className="text-slate-800 font-medium text-[10px] mt-2">Zero operational conflicts detected.</Text>
                      </View>
                  ) : (
                      getSessionsForDate(selectedDate).map((session, idx) => (
                          <MotiView key={session.id} from={{ opacity: 0, translateX: -10 }} animate={{ opacity: 1, translateX: 0 }} transition={{ delay: idx * 50 }}>
                              <TouchableOpacity 
                                  className="bg-slate-900/50 border border-slate-900 rounded-[32px] p-5 flex-row items-center gap-5"
                                  onPress={() => router.push({ pathname: '/(coach)/(tabs)/chat/[id]', params: { id: session.client_id } })}
                              >
                                  <View className="bg-slate-950 p-3 rounded-2xl border border-slate-800 items-center min-w-[70px]">
                                      <Clock size={14} color="#3B82F6" className="mb-1" />
                                      <Text className="text-white font-black text-sm">{new Date(session.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</Text>
                                  </View>
                                  <View className="flex-1">
                                      <View className="flex-row items-center gap-3">
                                          <BrandedAvatar name={session.client?.profiles?.full_name} imageUrl={session.client?.profiles?.avatar_url} size={32} />
                                          <Text className="text-white font-black text-base">{session.client?.profiles?.full_name}</Text>
                                      </View>
                                      <Text className="text-slate-500 font-bold text-[10px] uppercase tracking-widest mt-2">{session.duration_minutes} MIN • {session.session_type}</Text>
                                  </View>
                                  <View className="w-10 h-10 bg-slate-950 rounded-full items-center justify-center border border-slate-800">
                                      <Video size={18} color="#475569" />
                                  </View>
                              </TouchableOpacity>
                          </MotiView>
                      ))
                  )}
              </View>
          </ScrollView>

          <TouchableOpacity 
              onPress={() => setShowManualScheduler(true)}
              className="absolute bottom-10 right-6 w-16 h-16 bg-blue-600 rounded-[28px] items-center justify-center shadow-2xl shadow-blue-500/40 border-2 border-white/10"
          >
              <Plus size={28} color="white" />
          </TouchableOpacity>

          {/* Modals Logic */}
          {coach && (
              <ManualSchedulerModal 
                  visible={showManualScheduler} 
                  onClose={() => { setShowManualScheduler(false); setSelectedClient(null); }} 
                  onConfirm={async () => loadSessions()} 
                  existingSessions={sessions} coachId={coach.id} initialClient={initialClientData}
                  onSwitchToAI={(c) => { setSelectedClient({ id: c.id, name: c.profiles.full_name, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }); setShowManualScheduler(false); setShowAIScheduler(true); }}
              />
          )}
          {selectedClient && (
              <SchedulerModal 
                  visible={showAIScheduler} 
                  onClose={() => { setShowAIScheduler(false); setSelectedClient(null); }} 
                  onConfirm={async () => loadSessions()} 
                  clientContext={selectedClient} targetClientId={selectedClient.id} existingSessions={sessions}
              />
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}
