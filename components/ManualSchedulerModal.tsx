import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, ActivityIndicator, Alert, TextInput, SafeAreaView } from 'react-native';
import { MotiView, AnimatePresence } from 'moti';
import { X, Calendar, Clock, AlertCircle, Check, User, ChevronDown, Repeat, Sparkles, ArrowLeft, ArrowRight, Zap, Target } from 'lucide-react-native';
import { useTheme } from '@/contexts/BrandContext';
import { ProposedSession } from '@/lib/ai-scheduling-service';
import { Session } from '@/types/database';
import { availabilityService } from '@/lib/availability-service';
import { supabase } from '@/lib/supabase';
import { BrandedAvatar } from '@/components/BrandedAvatar';

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
    user_id: string;
    profiles: {
        full_name: string;
        avatar_url: string | null;
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

export default function ManualSchedulerModal({
    visible,
    onClose,
    onConfirm,
    existingSessions,
    coachId,
    onSwitchToAI,
    initialClient,
}: ManualSchedulerModalProps) {
    const theme = useTheme();
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState<StepType>('client');
    
    // Form State
    const [clients, setClients] = useState<Client[]>([]);
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
            const { data, error } = await supabase.from('coach_client_links').select('client_id, clients!inner(id, user_id, profiles!inner(full_name, avatar_url))').eq('coach_id', coachId);
            if (error) throw error;
            const processed = data?.map(link => {
                const client: any = Array.isArray(link.clients) ? link.clients[0] : link.clients;
                const profiles = Array.isArray(client.profiles) ? client.profiles[0] : client.profiles;
                return { id: client.id, user_id: client.user_id, profiles };
            }) || [];
            setClients(processed as any);
        } catch (e) { console.error(e); }
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

    const next14Days = Array.from({ length: 14 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return d; });

    function toggleDate(d: Date, exists: boolean) {
        if (exists) setSelectedDates(selectedDates.filter(sd => sd.toDateString() !== d.toDateString()));
        else setSelectedDates([...selectedDates, d]);
    }
    function toggleWeekday(idx: number, exists: boolean) {
        if (exists) setSelectedWeekdays(selectedWeekdays.filter(w => w !== idx));
        else setSelectedWeekdays([...selectedWeekdays, idx]);
    }

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
            <View className="flex-1 bg-slate-950">
                <SafeAreaView className="flex-1">
                    {/* Header */}
                    <View className="px-6 py-8 flex-row items-center justify-between border-b border-slate-900">
                        <TouchableOpacity onPress={onClose} className="p-2 bg-slate-900 rounded-full border border-slate-800">
                            <X size={20} color="#94A3B8" />
                        </TouchableOpacity>
                        <Text className="text-white text-xl font-bold">Manual Scheduler</Text>
                        <View className="w-10" />
                    </View>

                    {/* Progress */}
                    <View className="px-6 py-4 flex-row justify-between items-center bg-slate-900/30">
                        <View className="flex-row gap-2">
                             {steps.map((s, i) => (
                                 <View key={s} className={`h-1.5 rounded-full ${i <= currentStepIdx ? 'bg-blue-600' : 'bg-slate-800'} ${i === currentStepIdx ? 'w-8' : 'w-4'}`} />
                             ))}
                        </View>
                        <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Step {currentStepIdx + 1}/5</Text>
                    </View>

                    <ScrollView className="flex-1 px-6 mt-6" showsVerticalScrollIndicator={false}>
                        <AnimatePresence mode="wait">
                            <MotiView
                                key={step}
                                from={{ opacity: 0, translateX: 20 }}
                                animate={{ opacity: 1, translateX: 0 }}
                                exit={{ opacity: 0, translateX: -20 }}
                                transition={{ type: 'timing', duration: 300 }}
                            >
                                {step === 'client' && (
                                    <View>
                                        <Text className="text-white text-2xl font-bold mb-2">Target Client</Text>
                                        <Text className="text-slate-500 mb-8 font-medium">Who are we scheduling for today?</Text>
                                        {clients.map(c => (
                                            <TouchableOpacity 
                                                key={c.id} 
                                                onPress={() => setSelectedClient(c)}
                                                className={`p-5 rounded-[32px] border mb-4 flex-row items-center justify-between ${selectedClient?.id === c.id ? 'bg-blue-600 border-blue-400 shadow-lg shadow-blue-500/20' : 'bg-slate-900 border-slate-800'}`}
                                            >
                                                <View className="flex-row items-center gap-4">
                                                   <BrandedAvatar size={48} name={c.profiles.full_name} imageUrl={c.profiles.avatar_url} />
                                                   <Text className={`text-lg font-bold ${selectedClient?.id === c.id ? 'text-white' : 'text-slate-300'}`}>{c.profiles.full_name}</Text>
                                                </View>
                                                {selectedClient?.id === c.id && <Check size={20} color="white" />}
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                )}

                                {step === 'days' && (
                                    <View>
                                        <Text className="text-white text-2xl font-bold mb-2">Protocol Window</Text>
                                        <Text className="text-slate-500 mb-8 font-medium">Select the session frequency and dates.</Text>
                                        
                                        <View className="flex-row bg-slate-900 p-1.5 rounded-2xl border border-slate-800 mb-8">
                                            <TouchableOpacity onPress={() => setRecurrence('once')} className={`flex-1 py-3 items-center rounded-xl flex-row justify-center gap-2 ${recurrence === 'once' ? 'bg-blue-600' : ''}`}>
                                                <Calendar size={16} color={recurrence === 'once' ? 'white' : '#475569'} />
                                                <Text className={`font-bold text-xs ${recurrence === 'once' ? 'text-white' : 'text-slate-500'}`}>One-time</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity onPress={() => setRecurrence('weekly')} className={`flex-1 py-3 items-center rounded-xl flex-row justify-center gap-2 ${recurrence === 'weekly' ? 'bg-blue-600' : ''}`}>
                                                <Repeat size={16} color={recurrence === 'weekly' ? 'white' : '#475569'} />
                                                <Text className={`font-bold text-xs ${recurrence === 'weekly' ? 'text-white' : 'text-slate-500'}`}>Weekly</Text>
                                            </TouchableOpacity>
                                        </View>

                                        {recurrence === 'once' ? (
                                            <View className="flex-row flex-wrap justify-between">
                                                {next14Days.map((d, i) => {
                                                    const isSelected = selectedDates.some(sd => sd.toDateString() === d.toDateString());
                                                    return (
                                                        <TouchableOpacity 
                                                            key={i} onPress={() => toggleDate(d, isSelected)}
                                                            className={`w-[31%] aspect-square rounded-3xl items-center justify-center border mb-4 ${isSelected ? 'bg-blue-600 border-blue-400' : 'bg-slate-900 border-slate-800'}`}
                                                        >
                                                            <Text className={`text-[10px] font-black uppercase ${isSelected ? 'text-white opacity-60' : 'text-slate-600'}`}>{d.toLocaleDateString('en-US', { weekday: 'short' })}</Text>
                                                            <Text className={`text-2xl font-black my-1 ${isSelected ? 'text-white' : 'text-slate-300'}`}>{d.getDate()}</Text>
                                                        </TouchableOpacity>
                                                    );
                                                })}
                                            </View>
                                        ) : (
                                            <View className="gap-3">
                                                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => {
                                                    const dayIdx = (i + 1) % 7;
                                                    const isSelected = selectedWeekdays.includes(dayIdx);
                                                    return (
                                                        <TouchableOpacity 
                                                            key={day} onPress={() => toggleWeekday(dayIdx, isSelected)}
                                                            className={`p-6 rounded-[24px] border flex-row justify-between items-center ${isSelected ? 'bg-blue-600 border-blue-400' : 'bg-slate-900 border-slate-800'}`}
                                                        >
                                                            <Text className={`text-lg font-bold ${isSelected ? 'text-white' : 'text-slate-300'}`}>{day}day</Text>
                                                            {isSelected && <Check size={20} color="white" />}
                                                        </TouchableOpacity>
                                                    );
                                                })}
                                            </View>
                                        )}
                                    </View>
                                )}

                                {step === 'time' && (
                                    <View>
                                        <Text className="text-white text-2xl font-bold mb-2">Slot Selection</Text>
                                        <Text className="text-slate-500 mb-8 font-medium">Select a slot congruent with your hub.</Text>
                                        {loading ? <ActivityIndicator size="large" color="#3B82F6" className="mt-20" /> : (
                                            <View className="gap-3">
                                                {availableSlots.map((slot, i) => (
                                                    <TouchableOpacity 
                                                        key={i} onPress={() => slot.available && setSelectedTime(slot.time)}
                                                        disabled={!slot.available}
                                                        className={`p-6 rounded-[32px] border flex-row justify-between items-center ${selectedTime?.getTime() === slot.time.getTime() ? 'bg-blue-600 border-blue-400' : 'bg-slate-900 border-slate-800'} ${!slot.available ? 'opacity-30' : ''}`}
                                                    >
                                                        <Text className={`text-xl font-bold ${selectedTime?.getTime() === slot.time.getTime() ? 'text-white' : 'text-slate-300'}`}>
                                                            {slot.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </Text>
                                                        {!slot.available && <Text className="text-red-400 text-[10px] font-bold uppercase">{slot.reason}</Text>}
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                        )}
                                    </View>
                                )}

                                {step === 'details' && (
                                    <View>
                                        <Text className="text-white text-2xl font-bold mb-2">Mission Meta</Text>
                                        <Text className="text-slate-500 mb-10 font-medium">Label the direct objective of this session.</Text>
                                        
                                        <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-3">Protocol Type</Text>
                                        <View className="flex-row flex-wrap gap-2 mb-8">
                                            {['training', 'nutrition', 'consultation'].map(type => (
                                                <TouchableOpacity 
                                                    key={type} onPress={() => setSessionType(type as any)}
                                                    className={`px-6 py-3 rounded-2xl border ${sessionType === type ? 'bg-blue-600 border-blue-400 shadow-md' : 'bg-slate-900 border-slate-800'}`}
                                                >
                                                    <Text className={`font-black text-[10px] uppercase tracking-widest ${sessionType === type ? 'text-white' : 'text-slate-500'}`}>{type}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>

                                        <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-3">Strategy Notes</Text>
                                        <TextInput 
                                            className="bg-slate-900 p-6 rounded-[24px] border border-slate-800 text-white font-medium min-h-[120px]"
                                            placeholder="Specify targets or prep required..." placeholderTextColor="#475569"
                                            multiline value={notes} onChangeText={setNotes} textAlignVertical="top"
                                        />
                                    </View>
                                )}

                                {step === 'confirm' && (
                                    <View>
                                        <Text className="text-white text-2xl font-bold mb-2">Initialize Sequence</Text>
                                        <Text className="text-slate-500 mb-8 font-medium">Review and launch the hub protocol.</Text>
                                        
                                        <MotiView className="bg-slate-900 p-8 rounded-[48px] border border-slate-800 overflow-hidden">
                                            <View className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -mr-16 -mt-16" />
                                            <View className="flex-row items-center gap-4 mb-8">
                                               <BrandedAvatar size={56} name={selectedClient?.profiles.full_name || ''} imageUrl={selectedClient?.profiles.avatar_url} />
                                               <View>
                                                  <Text className="text-white text-xl font-bold">{selectedClient?.profiles.full_name}</Text>
                                                  <Text className="text-blue-500 text-[10px] font-black uppercase tracking-widest">Active Recipient</Text>
                                               </View>
                                            </View>

                                            <View className="gap-6">
                                                <View className="flex-row items-center gap-4">
                                                   <View className="w-10 h-10 bg-slate-950 rounded-xl items-center justify-center border border-slate-800">
                                                      <Target size={18} color="#3B82F6" />
                                                   </View>
                                                   <Text className="text-slate-400 font-bold uppercase text-xs">{sessionType} Protocol</Text>
                                                </View>
                                                <View className="flex-row items-center gap-4">
                                                   <View className="w-10 h-10 bg-slate-950 rounded-xl items-center justify-center border border-slate-800">
                                                      <Clock size={18} color="#A78BFA" />
                                                   </View>
                                                   <Text className="text-slate-400 font-bold uppercase text-xs">{selectedTime?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} Start</Text>
                                                </View>
                                            </View>
                                        </MotiView>
                                    </View>
                                )}
                            </MotiView>
                        </AnimatePresence>
                    </ScrollView>

                    {/* Footer Actions */}
                    <View className="p-6 bg-slate-950 border-t border-slate-900 flex-row gap-4">
                        {currentStepIdx > 0 && (
                            <TouchableOpacity onPress={() => setStep(steps[currentStepIdx - 1])} className="w-16 h-16 bg-slate-900 rounded-[28px] border border-slate-800 items-center justify-center">
                                <ArrowLeft size={24} color="#94A3B8" />
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity 
                            onPress={() => step === 'confirm' ? handleConfirm() : setStep(steps[currentStepIdx + 1])}
                            className={`flex-1 h-16 rounded-[28px] items-center justify-center flex-row gap-3 ${step === 'confirm' ? 'bg-blue-600 shadow-xl shadow-blue-500/20' : 'bg-slate-900 border border-slate-800'}`}
                        >
                            <Text className={`font-bold text-lg ${step === 'confirm' ? 'text-white' : 'text-slate-300'}`}>{step === 'confirm' ? 'Launch Protocol' : 'Continue'}</Text>
                            {step !== 'confirm' && <ArrowRight size={20} color="#475569" />}
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            </View>
        </Modal>
    );
}
