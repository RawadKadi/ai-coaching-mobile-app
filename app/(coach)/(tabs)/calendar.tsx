import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Platform, RefreshControl, ScrollView, StatusBar } from 'react-native';
import { MotiView, AnimatePresence } from 'moti';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Calendar as CalendarIcon, Clock, Video, ChevronRight, User, Plus, Zap, AlertCircle, Search } from 'lucide-react-native';
import { useFocusEffect, useRouter, useNavigation } from 'expo-router';
import SchedulerModal from '@/components/SchedulerModal';
import ManualSchedulerModal from '@/components/ManualSchedulerModal';
import { ProposedSession } from '@/lib/ai-scheduling-service';
import { BrandedAvatar } from '@/components/BrandedAvatar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function CalendarScreen() {
  const { profile, coach } = useAuth();
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
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
    const day = d.getDay();
    const diff = (day === 0 ? 6 : day - 1);
    d.setDate(d.getDate() - diff + i);
    return d;
  });

  if (loading && !refreshing) return <View className="flex-1 bg-slate-950 items-center justify-center"><ActivityIndicator color="#3B82F6" /></View>;

  return (
    <View style={{ flex: 1 }} className="bg-slate-950">
      <StatusBar barStyle="light-content" translucent />
      <View style={{ flex: 1, paddingTop: insets.top }}>
          {/* Header */}
          <View className="px-6 pt-10 pb-4">
              <Text className="text-white text-4xl font-black tracking-tight mb-2">
                  {selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </Text>
              <Text className="text-slate-400 font-medium">
                  You have {getSessionsForDate(selectedDate).length} sessions scheduled for today.
              </Text>
          </View>

          {/* Calendar Box */}
          <View className="bg-slate-900/30 rounded-[48px] p-6 mx-6 my-4 border border-white/5">
              <View className="flex-row justify-between mb-6 px-2">
                  {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((day, i) => (
                      <View key={i} className="flex-1 items-center">
                          <Text className="text-slate-500 text-[9px] font-black">{day}</Text>
                      </View>
                  ))}
              </View>
              
              <View className="flex-row flex-wrap justify-between">
                  {days.map((item, i) => {
                      const isS = item.toDateString() === selectedDate.toDateString();
                      const has = getSessionsForDate(item).length > 0;
                      return (
                          <TouchableOpacity 
                              key={item.toISOString()}
                              onPress={() => setSelectedDate(item)}
                              style={{ width: '14.28%' }}
                              className="items-center justify-center mb-3"
                          >
                              <View className={`w-10 h-10 rounded-full items-center justify-center ${isS ? 'bg-blue-600 shadow-xl shadow-blue-500/50' : ''}`}>
                                  <Text className={`text-base font-black ${isS ? 'text-white' : item.getMonth() !== new Date().getMonth() ? 'text-slate-800' : 'text-slate-400'}`}>
                                      {item.getDate()}
                                  </Text>
                                  {has && (
                                      <View className={`absolute -bottom-1 w-1 h-1 rounded-full ${isS ? 'bg-white' : 'bg-blue-600'}`} />
                                  )}
                              </View>
                          </TouchableOpacity>
                      );
                  })}
              </View>
          </View>

          <ScrollView 
              className="flex-1 px-6"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 160 }}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadSessions(); }} tintColor="#3B82F6" />}
          >
              <View className="mb-6 mt-4">
                  <Text className="text-white text-2xl font-black tracking-tight">Today's Focus</Text>
              </View>

              <View className="space-y-4">
                  {getSessionsForDate(selectedDate).length === 0 ? (
                      <View className="p-16 items-center justify-center bg-slate-900/20 rounded-[48px] border border-white/5 border-dashed">
                          <View className="w-20 h-20 bg-slate-900 rounded-[32px] items-center justify-center border border-white/5 mb-6">
                              <CalendarIcon size={32} color="#1E293B" />
                          </View>
                          <Text className="text-slate-700 font-black text-xs uppercase tracking-widest text-center">Day Clear</Text>
                          <Text className="text-slate-800 font-medium text-[10px] mt-2 text-center px-6 leading-5">You have no live coaching sessions scheduled for this date.</Text>
                      </View>
                  ) : (
                      getSessionsForDate(selectedDate).map((session, idx) => (
                          <MotiView key={session.id} from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ delay: idx * 50 }} className="mb-4">
                                <TouchableOpacity 
                                    className="bg-slate-900/40 border border-white/5 rounded-[36px] p-6 flex-row items-center"
                                    onPress={() => router.push({ pathname: '/(coach)/chat/[id]', params: { id: session.client_id } })}
                                >
                                    {/* Left: Time */}
                                    <View className="items-center mr-4 w-16">
                                        <Text className="text-blue-500 font-black text-lg">
                                            {new Date(session.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                                        </Text>
                                        <Text className="text-blue-400/60 font-black text-[10px] uppercase">
                                            {new Date(session.scheduled_at).getHours() >= 12 ? 'PM' : 'AM'}
                                        </Text>
                                    </View>

                                    {/* Vertical Line */}
                                    <View className="w-[2px] h-12 bg-blue-600/30 rounded-full mr-6" />

                                    {/* Middle: Info */}
                                    <View className="flex-1">
                                        <Text className="text-white font-black text-lg tracking-tight leading-tight mb-1">
                                            {session.session_type === 'video' ? 'Performance Video Call' : 'Strategic Coaching'}
                                        </Text>
                                        <Text className="text-slate-500 font-bold text-xs">
                                            {session.client?.profiles?.full_name} • 60 min
                                        </Text>
                                    </View>

                                    {/* Right: Avatar & Icon */}
                                    <View className="flex-row items-center gap-2">
                                        <BrandedAvatar 
                                            name={session.client?.profiles?.full_name} 
                                            imageUrl={session.client?.profiles?.avatar_url} 
                                            size={32} 
                                        />
                                        <View className="w-8 h-8 rounded-full bg-cyan-400/20 items-center justify-center">
                                            <Video size={14} color="#22D3EE" />
                                        </View>
                                    </View>
                                </TouchableOpacity>
                          </MotiView>
                      ))
                  )}
              </View>
          </ScrollView>

          <TouchableOpacity 
              onPress={() => setShowManualScheduler(true)}
              style={{ bottom: insets.bottom + 90 }}
              className="absolute right-6 w-16 h-16 bg-blue-600 rounded-full items-center justify-center shadow-2xl shadow-blue-500/50 border-2 border-white/10 z-50"
          >
              <Plus size={32} color="white" />
          </TouchableOpacity>


          {coach && (
              <ManualSchedulerModal 
                  visible={showManualScheduler} 
                  onClose={() => { setShowManualScheduler(false); setSelectedClient(null); }} 
                  onConfirm={async () => loadSessions()} 
                  existingSessions={sessions} coachId={coach.id} initialClient={initialClientData}
                  navigation={navigation}
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
    </View>
  );
}
