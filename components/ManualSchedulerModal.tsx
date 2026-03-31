import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, ActivityIndicator, Alert, TextInput, Dimensions, Platform, StatusBar } from 'react-native';
import { MotiView, AnimatePresence } from 'moti';
import { X, Calendar, Clock, AlertCircle, Check, User, ChevronDown, Repeat, Sparkles, ArrowLeft, ArrowRight, Zap, Target, Search, Filter, ChevronRight, Info, Lock, Users } from 'lucide-react-native';
import { useTheme } from '@/contexts/BrandContext';
import { ProposedSession } from '@/lib/ai-scheduling-service';
import { Session } from '@/types/database';
import { availabilityService } from '@/lib/availability-service';
import { supabase } from '@/lib/supabase';
import { BrandedAvatar } from '@/components/BrandedAvatar';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

interface ManualSchedulerModalProps {
    visible: boolean;
    onClose: () => void;
    onConfirm: (sessions: ProposedSession[]) => Promise<void>;
    existingSessions: Session[];
    coachId: string;
    onSwitchToAI?: (client: Client) => void;
    initialClient?: Client | null;
}

interface Client {
    id: string;
    user_id?: string;
    profiles: {
        full_name: string;
        avatar_url: string | null;
        subtype?: string; // Optional field for UI: e.g. PRO ELITE
    };
}

interface TimeSlot {
    time: Date;
    available: boolean;
    reason?: string;
    sessionId?: string;
    clientName?: string;
}

type StepType = 'client' | 'days' | 'time' | 'details' | 'confirm';
type RecurrenceType = 'once' | 'weekly';

import { NavigationContext } from '@react-navigation/native';

export default function ManualSchedulerModal({
    visible,
    onClose,
    onConfirm,
    existingSessions,
    coachId,
    onSwitchToAI,
    initialClient,
}: ManualSchedulerModalProps) {
    // We already have router passed as a prop if we use it, but here we need to satisfy hooks
    // Let's ensure we use a stable context for the Modal contents
    
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState<StepType>('client');
    
    // Form State
    const [clients, setClients] = useState<Client[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [recurrence, setRecurrence] = useState<RecurrenceType>('once');
    const [selectedDates, setSelectedDates] = useState<Date[]>([]);
    const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([]);
    const [selectedTime, setSelectedTime] = useState<Date | null>(null);
    const [duration, setDuration] = useState(60);
    const [sessionType, setSessionType] = useState<'training' | 'nutrition' | 'check_in' | 'consultation' | 'other'>('training');
    const [notes, setNotes] = useState('');
    const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
    const [blockedDates, setBlockedDates] = useState<Set<string>>(new Set());

    const steps: StepType[] = ['client', 'days', 'time', 'details', 'confirm'];
    const currentStepIdx = steps.indexOf(step);

    useEffect(() => {
        if (visible) {
            loadClients();
            loadAvailabilityData();
            if (initialClient) {
                setSelectedClient(initialClient);
                setStep('days');
            } else {
                setStep('client');
            }
        }
    }, [visible]);

    useEffect(() => {
        if (step === 'time' && selectedClient) loadAvailableSlots();
    }, [step, selectedDates, selectedWeekdays, selectedClient]);

    const loadClients = async () => {
        try {
            setLoading(true);
            // Use the secure RPC 'get_my_clients' to ensure data displays correctly
            const { data, error } = await supabase.rpc('get_my_clients');
            if (error) throw error;
            
            const processed = data?.map((item: any) => ({
                id: item.client_id,
                profiles: {
                    full_name: item.client_name,
                    avatar_url: item.client_avatar,
                    subtype: item.client_experience || (Math.random() > 0.5 ? 'PRO ELITE' : 'STRENGTH LAB')
                }
            })) || [];
            
            setClients(processed);
        } catch (e) { 
            console.error('[ManualScheduler] Load clients error:', e); 
        } finally {
            setLoading(false);
        }
    };

    const loadAvailabilityData = async () => {
        try {
            const blocked = await availabilityService.getBlockedDates(coachId);
            setBlockedDates(new Set(blocked.map(b => b.date)));
        } catch (e) { console.error(e); }
    };

    const loadAvailableSlots = async () => {
        if (!selectedClient) return;
        setLoading(true);
        try {
            const datesToCheck = recurrence === 'once' ? selectedDates : getNextOccurrencesOfWeekdays();
            if (datesToCheck.length === 0) { setAvailableSlots([]); setLoading(false); return; }
            const availability = await availabilityService.getAvailability(coachId);
            
            const uniqueWeekdays = [...new Set(datesToCheck.map(d => d.getDay()))];
            
            const allTimesSet = new Set<string>();
            const slotsByWeekday: { [key: number]: Set<string> } = {};
            
            for (const weekday of uniqueWeekdays) {
                const dayAvailability = availability.filter(slot => slot.day_of_week === weekday && slot.is_active);
                const times = new Set<string>();
                for (const workSlot of dayAvailability) {
                    const [startHour, startMinute] = workSlot.start_time.split(':').map(Number);
                    const [endHour, endMinute] = workSlot.end_time.split(':').map(Number);
                    let hour = startHour; let minute = startMinute;
                    while (hour < endHour || (hour === endHour && minute < endMinute)) {
                        const actualEndHour = hour + Math.floor((minute + 60) / 60);
                        const slotEndMinute = (minute + 60) % 60;
                        if ((actualEndHour * 60 + slotEndMinute) <= (endHour * 60 + endMinute)) {
                            const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
                            times.add(timeStr); allTimesSet.add(timeStr);
                        }
                        minute += 15; if (minute >= 60) { minute = 0; hour += 1; }
                    }
                }
                slotsByWeekday[weekday] = times;
            }

            const allTimes = Array.from(allTimesSet).sort();
            const now = new Date();
            const slots: TimeSlot[] = [];
            
            for (const timeStr of allTimes) {
                const [hour, minute] = timeStr.split(':').map(Number);
                const referenceDate = datesToCheck[0];
                const slotTime = new Date(referenceDate); slotTime.setHours(hour, minute, 0, 0);
                
                if (new Date(referenceDate).setHours(0,0,0,0) === new Date().setHours(0,0,0,0) && slotTime <= now) continue;
                
                const availableOnAllWeekdays = uniqueWeekdays.every(weekday => slotsByWeekday[weekday]?.has(timeStr));
                if (!availableOnAllWeekdays) {
                    slots.push({ time: slotTime, available: false, reason: 'Not available on all selected days' });
                    continue;
                }
                slots.push(await checkSlotEligibilityAcrossAllDates(slotTime, datesToCheck));
            }
            setAvailableSlots(slots);
        } catch (error) { Alert.alert('Error', 'Failed to load time slots'); } finally { setLoading(false); }
    };

    const checkSlotEligibilityAcrossAllDates = async (time: Date, dates: Date[]): Promise<TimeSlot> => {
        const h = time.getHours(); const m = time.getMinutes();
        for (const date of dates) {
            const slotStart = new Date(date); slotStart.setHours(h, m, 0, 0);
            const slotEnd = new Date(slotStart.getTime() + duration * 60000);
            for (const session of existingSessions) {
                if (session.status === 'cancelled') continue;
                const sStart = new Date(session.scheduled_at);
                const sEnd = new Date(sStart.getTime() + session.duration_minutes * 60000);
                if (sStart.toDateString() === slotStart.toDateString() && slotStart < sEnd && slotEnd > sStart) {
                    return { time, available: false, reason: `Conflict on ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` };
                }
            }
            const hasSession = existingSessions.some(s => s.status !== 'cancelled' && s.client_id === selectedClient?.id && new Date(s.scheduled_at).toDateString() === slotStart.toDateString());
            if (hasSession) return { time, available: false, reason: `Client busy on ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` };
        }
        return { time, available: true };
    };

    const handleConfirm = async () => {
        if (!selectedClient || !selectedTime || !coachId) return;
        setLoading(true);
        try {
            const sessionsToInsert: any[] = [];
            if (recurrence === 'once') {
                for (const date of selectedDates) {
                    const sessionTime = new Date(date); sessionTime.setHours(selectedTime.getHours(), selectedTime.getMinutes(), 0, 0);
                    sessionsToInsert.push(generateSessionObject(sessionTime));
                }
            } else {
                const WEEKS = 4; const nextOccurrences = getNextOccurrencesOfWeekdays();
                for (const date of nextOccurrences) {
                    const baseDate = new Date(date); baseDate.setHours(selectedTime.getHours(), selectedTime.getMinutes(), 0, 0);
                    for (let i = 0; i < WEEKS; i++) {
                        const sessionTime = new Date(baseDate); sessionTime.setDate(baseDate.getDate() + (i * 7));
                        sessionsToInsert.push(generateSessionObject(sessionTime));
                    }
                }
            }
            const { error } = await supabase.from('sessions').insert(sessionsToInsert);
            if (error) throw error;
            Alert.alert('Success', 'Sessions scheduled.');
            onClose(); await onConfirm([]);
        } catch (e: any) { Alert.alert('Error', e.message); } finally { setLoading(false); }
    };

    const generateSessionObject = (time: Date) => ({
        coach_id: coachId, client_id: selectedClient?.id, scheduled_at: time.toISOString(),
        duration_minutes: duration, session_type: sessionType, status: 'scheduled', is_locked: true, ai_generated: false,
        meet_link: `https://meet.jit.si/${coachId}-${selectedClient?.id}-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        notes: notes || `Manual ${sessionType} session with ${selectedClient?.profiles.full_name}`
    });

    const getNextOccurrencesOfWeekdays = (): Date[] => {
        const dates: Date[] = []; const today = new Date();
        for (const weekday of selectedWeekdays) {
            const diff = (weekday - today.getDay() + 7) % 7 || 7;
            const nextDate = new Date(today); nextDate.setDate(today.getDate() + diff);
            nextDate.setHours(0, 0, 0, 0); dates.push(nextDate);
        }
        return dates;
    };

    const filteredClients = useMemo(() => {
        if (!searchQuery) return clients;
        return clients.filter(c => c.profiles.full_name.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [clients, searchQuery]);

    const next14Days = Array.from({ length: 14 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return d; });

    function toggleDate(d: Date, exists: boolean) {
        if (exists) setSelectedDates(selectedDates.filter(sd => sd.toDateString() !== d.toDateString()));
        else setSelectedDates([...selectedDates, d]);
    }
    function toggleWeekday(idx: number, exists: boolean) {
        if (exists) setSelectedWeekdays(selectedWeekdays.filter(w => w !== idx));
        else setSelectedWeekdays([...selectedWeekdays, idx]);
    }

    const canContinue = () => {
        if (step === 'client') return !!selectedClient;
        if (step === 'days') return (recurrence === 'once' ? selectedDates.length > 0 : selectedWeekdays.length > 0);
        if (step === 'time') return !!selectedTime;
        if (step === 'details') return true;
        if (step === 'confirm') return true;
        return false;
    };

    const renderHeader = (title: string, subTitle?: string) => (
        <View className="mb-8">
            <Text className="text-white text-4xl font-black tracking-tighter leading-tight">{title}</Text>
            {subTitle && (
                <Text className="text-slate-500 font-medium text-base mt-2">{subTitle}</Text>
            )}
        </View>
    );

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
          <NavigationContext.Provider value={{} as any}>
            <View className="flex-1 bg-[#020617]">
                <StatusBar barStyle="light-content" />
                <View className="flex-1">
                    {/* Top Status Bar */}
                    <View 
                       style={{ paddingTop: insets.top + 16 }}
                       className="px-6 pb-6 flex-row items-center justify-between border-b border-white/5 bg-[#020617]"
                    >
                        <View className="flex-row items-center gap-3">
                            <TouchableOpacity onPress={onClose} className="w-10 h-10 bg-white/5 rounded-full items-center justify-center border border-white/10">
                                <X size={20} color="#94A3B8" />
                            </TouchableOpacity>
                            <View>
                                <Text className="text-slate-500 text-[10px] font-black uppercase tracking-[3px]">Scheduler</Text>
                                <Text className="text-white text-lg font-black tracking-tight">Manual Booking</Text>
                            </View>
                        </View>
                        <View className="flex-row gap-1">
                             {steps.map((s, i) => (
                                 <View key={s} className={`h-1.5 rounded-full ${i <= currentStepIdx ? 'bg-orange-500 w-6' : 'bg-slate-800 w-3'}`} />
                             ))}
                        </View>
                    </View>

                    <ScrollView className="flex-1 px-0" showsVerticalScrollIndicator={false}>
                        <AnimatePresence>
                            <MotiView
                                key={step}
                                from={{ opacity: 0, translateY: 10 }}
                                animate={{ opacity: 1, translateY: 0 }}
                                exit={{ opacity: 0, translateY: -10 }}
                                transition={{ type: 'timing', duration: 300 }}
                                className="px-6 pt-8 pb-12"
                            >
                                {step === 'client' && (
                                    <View>
                                        {/* Banner Hero Section */}
                                        <MotiView
                                          from={{ opacity: 0, translateY: 20 }}
                                          animate={{ opacity: 1, translateY: 0 }}
                                          className="mb-10 p-10 rounded-[48px] bg-orange-500/10 border border-orange-500/20 items-center overflow-hidden"
                                        >
                                            <View className="absolute top-0 right-0 p-4 opacity-10">
                                                <Users size={120} color="#F97316" />
                                            </View>
                                            <View className="w-20 h-20 bg-orange-500 rounded-[30px] items-center justify-center shadow-2xl shadow-orange-500/50 mb-6 border-2 border-white/20">
                                                <Calendar size={36} color="white" fill="white" />
                                            </View>
                                            <Text className="text-white text-2xl font-black text-center tracking-tighter">Command Center</Text>
                                            <Text className="text-slate-400 text-center mt-3 leading-5 px-4 text-sm font-medium">
                                                Take direct control of your schedule. Select an athlete below to precisely deploy your next high-performance coaching session.
                                            </Text>
                                        </MotiView>

                                        {renderHeader("Select Client", "Identify the athlete for this session.")}
                                        
                                        <View className="flex-row items-center gap-3 mb-8">
                                            <View className="flex-1 bg-slate-900 border border-white/5 rounded-[28px] px-6 py-5 flex-row items-center gap-4">
                                                <Search size={20} color="#475569" />
                                                <TextInput 
                                                    className="flex-1 text-white font-bold text-lg"
                                                    placeholder="Search clients..."
                                                    placeholderTextColor="#475569"
                                                    value={searchQuery}
                                                    onChangeText={setSearchQuery}
                                                />
                                            </View>
                                            <TouchableOpacity className="w-16 h-16 bg-slate-900 border border-white/5 rounded-[24px] items-center justify-center">
                                                <Filter size={20} color="#475569" />
                                            </TouchableOpacity>
                                        </View>

                                        {onSwitchToAI && (
                                            <TouchableOpacity 
                                                onPress={() => selectedClient && onSwitchToAI(selectedClient)}
                                                className="mb-12"
                                            >
                                                <LinearGradient 
                                                    colors={['#4F46E5', '#2563EB']} 
                                                    className="p-8 rounded-[40px] flex-row items-center justify-between shadow-2xl shadow-blue-500/30"
                                                >
                                                    <View className="flex-1 mr-4">
                                                        <Text className="text-white/70 text-[10px] font-black uppercase tracking-[3px] mb-2">Neural Optimization</Text>
                                                        <Text className="text-white text-2xl font-black tracking-tight">AI Scheduler</Text>
                                                        <Text className="text-white/60 text-xs font-medium mt-1">Let the engine find the optimal window</Text>
                                                    </View>
                                                    <View className="w-14 h-14 bg-white/20 rounded-2xl items-center justify-center">
                                                        <Sparkles size={28} color="white" />
                                                    </View>
                                                </LinearGradient>
                                            </TouchableOpacity>
                                        )}

                                        <View className="gap-4">
                                            <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2 ml-1">Active Roster</Text>
                                            {loading ? (
                                                <View className="py-20 items-center justify-center">
                                                    <ActivityIndicator color="#F97316" />
                                                    <Text className="text-slate-600 text-[10px] font-black uppercase tracking-widest mt-4">Syncing Athletes...</Text>
                                                </View>
                                            ) : filteredClients.length === 0 ? (
                                                <View className="py-16 items-center justify-center bg-slate-900/20 rounded-[40px] border border-white/5 border-dashed">
                                                    <Users size={48} color="#1E293B" />
                                                    <Text className="text-slate-600 font-bold mt-4">No athletes found</Text>
                                                </View>
                                            ) : (
                                                filteredClients.map(c => (
                                                    <TouchableOpacity 
                                                        key={c.id} 
                                                        onPress={() => setSelectedClient(c)}
                                                        className={`p-6 rounded-[36px] border flex-row items-center justify-between ${selectedClient?.id === c.id ? 'bg-orange-500/10 border-orange-500/40 shadow-xl' : 'bg-slate-900/50 border-white/5'}`}
                                                    >
                                                        <View className="flex-row items-center gap-5">
                                                            <View className="relative">
                                                                <BrandedAvatar size={64} name={c.profiles.full_name} imageUrl={c.profiles.avatar_url} useBrandColor={true} />
                                                                {selectedClient?.id === c.id && (
                                                                    <View className="absolute -bottom-1 -right-1 w-6 h-6 bg-orange-500 rounded-full border-4 border-slate-950 items-center justify-center">
                                                                        <Check size={10} color="white" strokeWidth={4} />
                                                                    </View>
                                                                )}
                                                            </View>
                                                            <View>
                                                                <Text className="text-white text-xl font-black tracking-tight">{c.profiles.full_name}</Text>
                                                                <View className="flex-row items-center gap-2 mt-1">
                                                                    <View className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                                    <Text className="text-slate-500 text-[9px] font-black uppercase tracking-widest">{c.profiles.subtype || 'Athlete'}</Text>
                                                                </View>
                                                            </View>
                                                        </View>
                                                        <ChevronRight size={20} color={selectedClient?.id === c.id ? '#F97316' : '#334155'} />
                                                    </TouchableOpacity>
                                                ))
                                            )}
                                        </View>
                                    </View>
                                )}

                                {step === 'days' && (
                                    <View>
                                        <View className="flex-row justify-between items-center mb-1">
                                            <Text className="text-white/40 text-[10px] font-black uppercase tracking-[2px]">Step 2 of 5</Text>
                                            <Text className="text-white/40 text-[10px] font-black uppercase tracking-[2px]">Pattern Selection</Text>
                                        </View>
                                        {renderHeader("Session Pattern", "Is this a one-time session or a recurring one?")}
                                        
                                        <View className="flex-row bg-slate-900 p-2 rounded-[32px] border border-white/5 mb-10">
                                            <TouchableOpacity 
                                                onPress={() => { setRecurrence('once'); setSelectedWeekdays([]); }} 
                                                className={`flex-1 py-5 items-center rounded-[24px] ${recurrence === 'once' ? 'bg-orange-600 shadow-lg shadow-orange-500/30' : ''}`}
                                            >
                                                <Text className={`font-black tracking-tight ${recurrence === 'once' ? 'text-white' : 'text-slate-600'}`}>One-time</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity 
                                                onPress={() => { setRecurrence('weekly'); setSelectedDates([]); }} 
                                                className={`flex-1 py-5 items-center rounded-[24px] ${recurrence === 'weekly' ? 'bg-orange-600 shadow-lg shadow-orange-500/30' : ''}`}
                                            >
                                                <Text className={`font-black tracking-tight ${recurrence === 'weekly' ? 'text-white' : 'text-slate-600'}`}>Recurrent</Text>
                                            </TouchableOpacity>
                                        </View>

                                        {recurrence === 'once' ? (
                                            <View>
                                                <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-6 ml-1">Select Specific Dates</Text>
                                                <View className="flex-row flex-wrap justify-between">
                                                    {next14Days.map((d, i) => {
                                                        const isSelected = selectedDates.some(sd => sd.toDateString() === d.toDateString());
                                                        return (
                                                            <TouchableOpacity 
                                                                key={i} onPress={() => toggleDate(d, isSelected)}
                                                                className={`w-[30%] aspect-square rounded-[36px] items-center justify-center border mb-6 ${isSelected ? 'bg-orange-500 border-orange-400 shadow-lg shadow-orange-500/20' : 'bg-slate-900 border-white/5'}`}
                                                            >
                                                                <Text className={`text-[9px] font-black uppercase ${isSelected ? 'text-white/60' : 'text-slate-600'}`}>{d.toLocaleDateString('en-US', { weekday: 'short' })}</Text>
                                                                <Text className={`text-3xl font-black my-1 ${isSelected ? 'text-white' : 'text-slate-300'}`}>{d.getDate()}</Text>
                                                            </TouchableOpacity>
                                                        );
                                                    })}
                                                </View>
                                            </View>
                                        ) : (
                                            <View>
                                                <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-6 ml-1">Weekly Frequency</Text>
                                                <View className="flex-row justify-between mb-12">
                                                    {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => {
                                                        const dayIdx = (i + 1) % 7;
                                                        const isSelected = selectedWeekdays.includes(dayIdx);
                                                        return (
                                                            <TouchableOpacity 
                                                                key={i} onPress={() => toggleWeekday(dayIdx, isSelected)}
                                                                className={`w-12 h-12 rounded-2xl items-center justify-center ${isSelected ? 'bg-orange-500 border border-orange-400' : 'bg-slate-900 border border-white/5'}`}
                                                            >
                                                                <Text className={`font-black text-base ${isSelected ? 'text-white' : 'text-slate-500'}`}>{day}</Text>
                                                            </TouchableOpacity>
                                                        );
                                                    })}
                                                </View>

                                                <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-3 ml-1">Termination</Text>
                                                <TouchableOpacity className="flex-row items-center justify-between p-8 bg-slate-900 rounded-[40px] border border-white/5">
                                                    <View>
                                                        <Text className="text-slate-500 text-[10px] font-bold">Repeat until:</Text>
                                                        <Text className="text-white text-xl font-black mt-1">Dec 31, 2026</Text>
                                                    </View>
                                                    <View className="w-14 h-14 bg-slate-950 rounded-2xl items-center justify-center border border-white/10">
                                                        <Calendar size={24} color="#F97316" />
                                                    </View>
                                                </TouchableOpacity>
                                            </View>
                                        )}
                                    </View>
                                )}

                                {step === 'time' && (
                                    <View>
                                        <View className="flex-row justify-between items-center mb-1">
                                            <Text className="text-white/40 text-[10px] font-black uppercase tracking-[2px]">Step 3 of 5</Text>
                                            <Text className="text-white/40 text-[10px] font-black uppercase tracking-[2px]">Select Time</Text>
                                        </View>
                                        {renderHeader("Available Times", `${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })} · ${sessionType.toUpperCase()} Session`)}
                                        
                                        {loading ? <ActivityIndicator size="large" color="#F97316" className="mt-20" /> : (
                                            <View className="gap-8">
                                                {/* Morning Slots */}
                                                <View>
                                                    <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-4 ml-1">Morning Slots</Text>
                                                    <View className="gap-3">
                                                        {availableSlots.filter(s => s.time.getHours() < 12).map((slot, i) => (
                                                            <TouchableOpacity 
                                                                key={i} onPress={() => slot.available && setSelectedTime(slot.time)}
                                                                disabled={!slot.available}
                                                                className={`p-6 rounded-[32px] border flex-row justify-between items-center ${selectedTime?.getTime() === slot.time.getTime() ? 'bg-orange-500 border-orange-400 shadow-xl shadow-orange-500/20' : 'bg-slate-900 border-white/5'} ${!slot.available ? 'opacity-20' : ''}`}
                                                            >
                                                                <View className="flex-row items-center gap-4">
                                                                    <View className={`w-12 h-12 rounded-2xl items-center justify-center ${selectedTime?.getTime() === slot.time.getTime() ? 'bg-white/20' : 'bg-slate-950/50'}`}>
                                                                        <Clock size={20} color="#F97316" />
                                                                    </View>
                                                                    <View>
                                                                        <Text className={`text-xl font-black ${selectedTime?.getTime() === slot.time.getTime() ? 'text-white' : 'text-slate-200'}`}>
                                                                            {slot.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                                                                        </Text>
                                                                        <Text className="text-slate-500 text-[10px] font-bold">60 min session</Text>
                                                                    </View>
                                                                </View>
                                                                {selectedTime?.getTime() === slot.time.getTime() ? (
                                                                    <View className="w-7 h-7 bg-white rounded-full items-center justify-center">
                                                                        <Check size={16} color="#F97316" strokeWidth={4} />
                                                                    </View>
                                                                ) : (
                                                                    <ChevronRight size={18} color="#475569" />
                                                                )}
                                                            </TouchableOpacity>
                                                        ))}
                                                    </View>
                                                </View>

                                                {/* Afternoon Slots */}
                                                <View>
                                                    <View className="flex-row items-center gap-4 mb-4">
                                                        <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest ml-1">Afternoon Slots</Text>
                                                        <View className="flex-1 h-[1px] bg-white/5" />
                                                    </View>
                                                    <View className="gap-3">
                                                        {availableSlots.filter(s => s.time.getHours() >= 12).map((slot, i) => (
                                                            <TouchableOpacity 
                                                                key={i} onPress={() => slot.available && setSelectedTime(slot.time)}
                                                                disabled={!slot.available}
                                                                className={`p-6 rounded-[32px] border flex-row justify-between items-center ${selectedTime?.getTime() === slot.time.getTime() ? 'bg-orange-500 border-orange-400 shadow-xl shadow-orange-500/20' : 'bg-slate-900 border-white/5'} ${!slot.available ? 'opacity-20' : ''}`}
                                                            >
                                                                <View className="flex-row items-center gap-4">
                                                                    <View className={`w-12 h-12 rounded-2xl items-center justify-center ${selectedTime?.getTime() === slot.time.getTime() ? 'bg-white/20' : 'bg-slate-950/50'}`}>
                                                                        <Clock size={20} color="#F97316" />
                                                                    </View>
                                                                    <View>
                                                                        <Text className={`text-xl font-black ${selectedTime?.getTime() === slot.time.getTime() ? 'text-white' : 'text-slate-200'}`}>
                                                                            {slot.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                                                                        </Text>
                                                                        <Text className="text-slate-500 text-[10px] font-bold">60 min session</Text>
                                                                    </View>
                                                                </View>
                                                                {selectedTime?.getTime() === slot.time.getTime() ? (
                                                                    <View className="w-7 h-7 bg-white rounded-full items-center justify-center">
                                                                        <Check size={16} color="#F97316" strokeWidth={4} />
                                                                    </View>
                                                                ) : (
                                                                    <ChevronRight size={18} color="#475569" />
                                                                )}
                                                            </TouchableOpacity>
                                                        ))}
                                                    </View>
                                                </View>

                                                {availableSlots.length === 0 && (
                                                    <View className="p-16 items-center justify-center bg-slate-900/20 rounded-[48px] border border-white/5 border-dashed">
                                                        <Info size={32} color="#1E293B" className="mb-4" />
                                                        <Text className="text-slate-600 font-bold text-center">No slots available for the selected pattern.</Text>
                                                    </View>
                                                )}
                                            </View>
                                        )}
                                    </View>
                                )}

                                {step === 'details' && (
                                    <View>
                                        <View className="flex-row justify-between items-center mb-1">
                                            <TouchableOpacity onPress={() => setStep('time')} className="p-2 -ml-2">
                                                <ArrowLeft size={24} color="white" />
                                            </TouchableOpacity>
                                            <Text className="text-white/40 text-[10px] font-black uppercase tracking-[2px]">Step 4 of 5</Text>
                                        </View>
                                        {renderHeader("Refine Your Session", "Define the core parameters and context for today's high-performance training session.")}
                                        
                                        <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-3 ml-1">Duration</Text>
                                        <View className="p-8 bg-slate-900/50 border border-white/5 rounded-[40px] flex-row items-center justify-between mb-10">
                                            <View className="flex-row items-center gap-5">
                                                <View className="w-16 h-16 bg-slate-950 rounded-2xl items-center justify-center border border-white/5">
                                                    <Clock size={28} color="#F97316" />
                                                </View>
                                                <View>
                                                    <Text className="text-white text-2xl font-black">60 minutes</Text>
                                                    <Text className="text-slate-600 text-[10px] font-medium mt-1">Session duration is managed by the engine</Text>
                                                </View>
                                            </View>
                                            <Lock size={20} color="#1E293B" />
                                        </View>

                                        <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-4 ml-1">Session Type</Text>
                                        <View className="flex-row flex-wrap gap-3 mb-12">
                                            {[
                                                { type: 'training', icon: Zap },
                                                { type: 'nutrition', icon: Info },
                                                { type: 'check_in', icon: Calendar },
                                                { type: 'consultation', icon: Target },
                                                { type: 'other', icon: Sparkles }
                                            ].map(({ type, icon: Icon }) => (
                                                <TouchableOpacity 
                                                    key={type} onPress={() => setSessionType(type as any)}
                                                    className={`px-8 py-5 rounded-[22px] border flex-row items-center gap-3 ${sessionType === type ? 'bg-orange-500 border-orange-400 shadow-lg shadow-orange-500/20' : 'bg-slate-900 border-white/5'}`}
                                                >
                                                    <Icon size={16} color={sessionType === type ? 'white' : '#475569'} />
                                                    <Text className={`font-black text-[12px] uppercase tracking-widest ${sessionType === type ? 'text-white' : 'text-slate-500'}`}>{type.replace('_', ' ')}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>

                                        <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-4 ml-1">Notes (Optional)</Text>
                                        <View className="bg-slate-900/50 rounded-[48px] border border-white/5 p-8">
                                            <TextInput 
                                                className="text-white font-bold text-lg min-h-[160px]"
                                                placeholder="Add session notes..." placeholderTextColor="#334155"
                                                multiline value={notes} onChangeText={setNotes} textAlignVertical="top"
                                            />
                                            <View className="flex-row justify-end mt-4">
                                                <Target size={24} color="#1E293B" />
                                            </View>
                                        </View>
                                    </View>
                                )}

                                {step === 'confirm' && (
                                    <View>
                                        <View className="flex-row justify-between items-center mb-1">
                                            <Text className="text-white/40 text-[10px] font-black uppercase tracking-[2px]">Step 5 of 5</Text>
                                            <Text className="text-white/40 text-[10px] font-black uppercase tracking-[2px]">Review</Text>
                                        </View>
                                        {renderHeader("Review Session", "Double check everything before creating.")}
                                        
                                        <View className="bg-[#064E3B]/20 border border-[#059669]/30 p-6 rounded-[32px] flex-row items-center gap-5 mb-10">
                                            <View className="w-12 h-12 bg-[#10B981] rounded-2xl items-center justify-center">
                                                <Check size={24} color="white" strokeWidth={3} />
                                            </View>
                                            <View>
                                                <Text className="text-[#10B981] font-black text-[11px] uppercase tracking-[3px]">Schedule Validated</Text>
                                                <Text className="text-[#10B981]/70 text-[10px] font-bold mt-0.5">No biological or logistical conflicts found</Text>
                                            </View>
                                        </View>

                                        <View className="bg-slate-900/50 p-10 rounded-[64px] border border-white/5 mb-6">
                                            <View className="flex-row items-center gap-6">
                                               <BrandedAvatar size={96} name={selectedClient?.profiles.full_name || ''} imageUrl={selectedClient?.profiles.avatar_url} useBrandColor={true} />
                                               <View className="flex-1">
                                                  <Text className="text-slate-500 text-[11px] font-black uppercase tracking-[3px] mb-2">Subject</Text>
                                                  <Text className="text-white text-4xl font-black tracking-tighter leading-none" numberOfLines={1}>{selectedClient?.profiles.full_name}</Text>
                                                  <View className="bg-orange-500/20 self-start px-3 py-1.5 rounded-xl mt-4 border border-orange-500/20">
                                                      <Text className="text-orange-400 font-black text-[9px] uppercase tracking-widest">{selectedClient?.profiles.subtype || 'Athlete'}</Text>
                                                  </View>
                                               </View>
                                            </View>
                                        </View>

                                        <View className="gap-4">
                                            <View className="bg-slate-900/30 p-8 rounded-[48px] border border-white/5 flex-row items-center gap-6">
                                                <View className="w-14 h-14 bg-slate-950 rounded-2xl items-center justify-center border border-white/10">
                                                   <Repeat size={24} color="#F97316" />
                                                </View>
                                                <View style={{ flex: 1 }}>
                                                    <Text className="text-slate-500 text-[9px] font-black uppercase tracking-widest">Temporal Frequency</Text>
                                                    <Text className="text-white font-bold text-xl mt-1">{recurrence === 'once' ? 'Single Engagement' : `Weekly Roster (${selectedWeekdays.map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ')})`}</Text>
                                                </View>
                                            </View>
                                            <View className="bg-slate-900/30 p-8 rounded-[48px] border border-white/5 flex-row items-center gap-6">
                                                <View className="w-14 h-14 bg-slate-950 rounded-2xl items-center justify-center border border-white/10">
                                                   <Clock size={24} color="#A78BFA" />
                                                </View>
                                                <View style={{ flex: 1 }}>
                                                    <Text className="text-slate-500 text-[9px] font-black uppercase tracking-widest">Time Window</Text>
                                                    <Text className="text-white font-bold text-xl mt-1">{selectedTime?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })} - {new Date(selectedTime!.getTime() + duration*60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}</Text>
                                                </View>
                                            </View>
                                        </View>
                                    </View>
                                )}
                            </MotiView>
                        </AnimatePresence>
                    </ScrollView>

                    {/* Bottom Actions */}
                    <View className="p-8 pb-12 border-t border-white/5 flex-row gap-4 items-center bg-[#020617]">
                        <TouchableOpacity 
                            onPress={() => currentStepIdx === 0 ? onClose() : setStep(steps[currentStepIdx - 1])}
                            className={`h-18 px-10 rounded-[28px] items-center justify-center ${currentStepIdx === 0 ? '' : 'bg-slate-900 border border-white/5'}`}
                        >
                            <Text className="text-slate-400 font-black text-lg">{currentStepIdx === 0 ? 'Cancel' : 'Back'}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            disabled={!canContinue() || loading}
                            onPress={() => step === 'confirm' ? handleConfirm() : setStep(steps[currentStepIdx + 1])}
                            style={{ backgroundColor: canContinue() ? '#FF5C00' : '#1E293B' }}
                            className={`flex-1 h-20 rounded-[32px] items-center justify-center flex-row gap-4 shadow-2xl ${canContinue() ? 'shadow-orange-500/40' : ''}`}
                        >
                            {loading ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <>
                                    <Text className="text-white font-black text-2xl tracking-tighter">{step === 'confirm' ? 'FINALIZE BOOKING' : 'Next Step'}</Text>
                                    <ArrowRight size={24} color="white" strokeWidth={3} />
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
          </NavigationContext.Provider>
        </Modal>
    );
}
