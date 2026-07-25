import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { View, Text, Modal, Pressable, ScrollView, ActivityIndicator, Alert, TextInput, Dimensions, Platform, StatusBar, TouchableOpacity, Animated } from 'react-native';
import { MotiView } from 'moti';
import { X, Calendar, Clock, AlertCircle, Check, User, ChevronDown, Repeat, Sparkles, ArrowLeft, ArrowRight, Zap, Target, Search, Filter, ChevronRight, Info, Lock, Users, Plus } from 'lucide-react-native';
import { useTheme } from '@/contexts/BrandContext';
import { ProposedSession } from '@/lib/ai-scheduling-service';
import { Session } from '@/types/database';
import { generateGoogleMeetUrl } from '@/utils/session';
import { availabilityService } from '@/lib/availability-service';
import { supabase } from '@/lib/supabase';
import { BrandedAvatar } from '@/components/BrandedAvatar';
import { BrandedCalendar } from '@/components/BrandedCalendar';
import { DatePickerOverlay } from '@/components/DatePickerOverlay';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

const formatDateToISO = (date: any): string => {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const formatDisplayDate = (date: any, formatType: 'long' | 'short' | 'summary'): string => {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  const monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const weekdaysShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const weekdaysLong = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  if (formatType === 'short') {
    return `${monthsShort[d.getMonth()]} ${d.getDate()}`;
  }
  if (formatType === 'summary') {
    return `${weekdaysShort[d.getDay()]}, ${monthsShort[d.getMonth()]} ${d.getDate()}`;
  }
  return `${weekdaysLong[d.getDay()]}, ${monthsShort[d.getMonth()]} ${d.getDate()}`;
};

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

// Custom memoized card components for performance and smooth Animated transitions
interface ClientCardProps {
    client: Client;
    isSelected: boolean;
    onPress: () => void;
    theme: any;
}

const ClientCard = React.memo(({ client, isSelected, onPress, theme }: ClientCardProps) => {
    const fadeAnim = useRef(new Animated.Value(isSelected ? 1 : 0)).current;

    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: isSelected ? 1 : 0,
            duration: 220,
            useNativeDriver: true,
        }).start();
    }, [isSelected]);

    return (
        <Pressable 
            onPress={onPress}
            style={({ pressed }) => ({
                opacity: pressed ? 0.7 : 1
            })}
        >
            <View
                style={[
                    {
                        padding: 24,
                        borderRadius: 36,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                    },
                    isSelected 
                        ? { backgroundColor: 'rgba(15, 23, 42, 0.5)', borderColor: theme.colors.primary, borderWidth: 2 } 
                        : { backgroundColor: 'rgba(15, 23, 42, 0.5)', borderColor: 'rgba(255, 255, 255, 0.05)', borderWidth: 2 }
                ]}
                className="shadow-2xl"
            >
                <View className="flex-row items-center gap-5">
                    <View className="relative">
                        <BrandedAvatar size={64} name={client.profiles.full_name} imageUrl={client.profiles.avatar_url} useBrandColor={true} />
                        <Animated.View 
                            style={{
                                position: 'absolute',
                                bottom: -4,
                                right: -4,
                                opacity: fadeAnim,
                                transform: [{ scale: fadeAnim }],
                                width: 24,
                                height: 24,
                                backgroundColor: '#2563EB',
                                borderRadius: 12,
                                borderWidth: 4,
                                borderColor: '#020617', // slate-950
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            <Check size={10} color="white" strokeWidth={4} />
                        </Animated.View>
                    </View>
                    <View>
                        <Text className="text-white text-xl font-black tracking-tight">{client.profiles.full_name}</Text>
                        <View className="flex-row items-center gap-2 mt-1">
                            <View className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <Text className="text-slate-500 text-[9px] font-black uppercase tracking-widest">{client.profiles.subtype || 'Athlete'}</Text>
                        </View>
                    </View>
                </View>
                <ChevronRight size={20} color={isSelected ? theme.colors.primary : '#334155'} />
            </View>
        </Pressable>
    );
});

interface TimeSlotCardProps {
    slot: TimeSlot;
    isSelected: boolean;
    onPress: () => void;
}

const TimeSlotCard = React.memo(({ slot, isSelected, onPress }: TimeSlotCardProps) => {
    const theme = useTheme();
    const fadeAnim = useRef(new Animated.Value(isSelected ? 1 : 0)).current;

    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: isSelected ? 1 : 0,
            duration: 220,
            useNativeDriver: true,
        }).start();
    }, [isSelected]);

    return (
        <Pressable 
            onPress={onPress}
            style={({ pressed }) => ({
                opacity: !slot.available ? 0.2 : pressed ? 0.7 : 1
            })}
        >
            <View 
                style={[
                    {
                        padding: 24,
                        borderRadius: 32,
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                    },
                    isSelected 
                        ? { backgroundColor: '#2563EB', borderColor: theme.colors.primary, borderWidth: 2 } 
                        : { backgroundColor: '#0F172A', borderColor: 'rgba(255, 255, 255, 0.05)', borderWidth: 1 }
                ]}
                className="shadow-2xl"
            >
                <View className="flex-row items-center gap-4">
                    <View className={`w-12 h-12 rounded-2xl items-center justify-center ${isSelected ? 'bg-white' : 'bg-slate-950/50'}`}>
                        <Clock size={20} color={isSelected ? '#2563EB' : theme.colors.primary} />
                    </View>
                    <View>
                        <Text className={`text-xl font-black ${isSelected ? 'text-white' : 'text-slate-200'}`}>
                            {slot.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                        </Text>
                        <Text className={`text-[10px] font-bold ${isSelected ? 'text-white' : 'text-slate-500'}`}>60 min session</Text>
                    </View>
                </View>
                <View className="w-7 h-7 items-center justify-center relative">
                    <Animated.View 
                        style={{
                            position: 'absolute',
                            opacity: fadeAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [1, 0]
                            }),
                            transform: [{
                                scale: fadeAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [1, 0.5]
                                })
                            }]
                        }}
                    >
                        <ChevronRight size={18} color="#475569" />
                    </Animated.View>
                    <Animated.View 
                        style={{
                            position: 'absolute',
                            opacity: fadeAnim,
                            transform: [{
                                scale: fadeAnim
                            }]
                        }}
                    >
                        <View className="w-7 h-7 bg-white rounded-full items-center justify-center">
                            <Check size={16} color={theme.colors.primary} strokeWidth={4} />
                        </View>
                    </Animated.View>
                </View>
            </View>
        </Pressable>
    );
});

export default function ManualSchedulerModal({
    visible,
    onClose,
    onConfirm,
    existingSessions,
    coachId,
    onSwitchToAI,
    initialClient,
}: ManualSchedulerModalProps) {
    // Let's ensure we use a stable context for the Modal contents
    
    const theme = useTheme();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const scrollRef = useRef<ScrollView>(null);
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
    const [showDatePicker, setShowDatePicker] = useState(false);

    const steps: StepType[] = ['client', 'days', 'time', 'details', 'confirm'];
    const currentStepIdx = steps.indexOf(step);

    // Animated button scales
    const backBtnScale = useRef(new Animated.Value(1)).current;
    const nextBtnScale = useRef(new Animated.Value(1)).current;
    const aiBtnScale = useRef(new Animated.Value(1)).current;
    const closeBtnScale = useRef(new Animated.Value(1)).current;

    const handlePressIn = (scaleAnim: Animated.Value) => {
        Animated.spring(scaleAnim, {
            toValue: 0.95,
            useNativeDriver: true,
            speed: 50,
            bounciness: 4
        }).start();
    };

    const handlePressOut = (scaleAnim: Animated.Value) => {
        Animated.spring(scaleAnim, {
            toValue: 1.0,
            useNativeDriver: true,
            speed: 50,
            bounciness: 4
        }).start();
    };

    useEffect(() => {
        scrollRef.current?.scrollTo({ y: 0, animated: false });
    }, [step]);

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
        if (step === 'time' && selectedClient) {
            loadAvailableSlots();
        }
        // Only re-run when step becomes 'time' or the dates/client change while already on that step
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [step, selectedClient]);

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
                    return { time, available: false, reason: `Conflict on ${formatDisplayDate(date, 'short')}` };
                }
            }
            const hasSession = existingSessions.some(s => s.status !== 'cancelled' && s.client_id === selectedClient?.id && new Date(s.scheduled_at).toDateString() === slotStart.toDateString());
            if (hasSession) return { time, available: false, reason: `Client busy on ${formatDisplayDate(date, 'short')}` };
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
        meet_link: generateGoogleMeetUrl(),
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

    const headerSub = useMemo(() => {
        let dateStr = '';
        if (recurrence === 'once' && selectedDates[0]) {
            dateStr = formatDisplayDate(selectedDates[0], 'long');
        } else if (recurrence === 'weekly' && selectedWeekdays.length > 0) {
            const weekdaysNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            dateStr = selectedWeekdays.map(d => weekdaysNames[d]).join(', ');
        } else {
            dateStr = formatDisplayDate(new Date(), 'long');
        }
        return `${dateStr} · ${sessionType.toUpperCase()} Session`;
    }, [recurrence, selectedDates, selectedWeekdays, sessionType]);

    const next14Days = Array.from({ length: 14 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return d; });

    function toggleDate(d: Date, exists: boolean) {
        const dStr = formatDateToISO(d);
        if (exists) setSelectedDates(selectedDates.filter(sd => formatDateToISO(sd) !== dStr));
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
        <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
            <View className="flex-1 bg-[#020617]">
                <StatusBar barStyle="light-content" />
                <View className="flex-1">
                    {/* Top Status Bar */}
                    <View 
                       style={{ paddingTop: insets.top + 16 }}
                       className="px-6 pb-6 flex-row items-center justify-between border-b border-white/5 bg-[#020617]"
                    >
                        <View className="flex-row items-center gap-3">
                            <Pressable 
                                onPressIn={() => handlePressIn(closeBtnScale)}
                                onPressOut={() => handlePressOut(closeBtnScale)}
                                onPress={onClose}
                            >
                                {({ pressed }) => (
                                    <Animated.View 
                                        style={[{ transform: [{ scale: closeBtnScale }] }]}
                                        className={`w-10 h-10 rounded-full items-center justify-center border ${pressed ? 'bg-white/10 border-white/20' : 'bg-white/5 border-white/10'}`}
                                    >
                                        <X size={20} color="#94A3B8" />
                                    </Animated.View>
                                )}
                            </Pressable>
                            <View>
                                <Text className="text-slate-500 text-[10px] font-black uppercase tracking-[3px]">Scheduler</Text>
                                <Text className="text-white text-lg font-black tracking-tight">Manual Booking</Text>
                            </View>
                        </View>
                        <View className="flex-row gap-1">
                             {steps.map((s, i) => (
                                 <View key={s} className={`h-1.5 rounded-full ${i <= currentStepIdx ? 'bg-blue-600 w-6' : 'bg-slate-800 w-3'}`} />
                             ))}
                        </View>
                    </View>

                    <ScrollView ref={scrollRef} className="flex-1 px-0" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                        <View className="px-6 pt-8 pb-12">
                                {step === 'client' && (
                                    <View>
                                        {/* Banner Hero Section */}
                                        <MotiView
                                          from={{ opacity: 0, translateY: 20 }}
                                          animate={{ opacity: 1, translateY: 0 }}
                                          className="mb-10 p-10 rounded-[48px] bg-blue-600/10 border border-blue-600/20 items-center overflow-hidden"
                                        >
                                            <View className="absolute top-0 right-0 p-4 opacity-10">
                                                <Users size={120} color={theme.colors.primary} />
                                            </View>
                                            <View className="w-20 h-20 bg-blue-600 rounded-[30px] items-center justify-center shadow-2xl shadow-blue-600/50 mb-6 border-2 border-white/20">
                                                <Calendar size={36} color="white" fill="white" />
                                            </View>
                                            <Text className="text-white text-2xl font-black text-center tracking-tighter">Command Center</Text>
                                            <Text className="text-slate-400 text-center mt-3 leading-5 px-4 text-sm font-medium">
                                                Take direct control of your schedule. Select an athlete below to precisely deploy your next high-performance coaching session.
                                            </Text>
                                        </MotiView>

                                        {renderHeader("Select Client", "Identify the athlete for this session.")}
                                        
                                         <View className="mb-8">
                                             <View className="bg-slate-900 border border-white/5 rounded-[28px] px-6 py-5 flex-row items-center gap-4">
                                                 <Search size={20} color="#475569" />
                                                 <TextInput 
                                                     className="flex-1 text-white font-bold text-lg"
                                                     placeholder="Search clients..."
                                                     placeholderTextColor="#475569"
                                                     value={searchQuery}
                                                     onChangeText={setSearchQuery}
                                                 />
                                             </View>
                                         </View>

                                        {/* Removed AI Scheduler card section as per request */}

                                        <View className="gap-4">
                                            <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2 ml-1">Active Roster</Text>
                                            {loading ? (
                                                <View className="py-20 items-center justify-center">
                                                    <ActivityIndicator color={theme.colors.primary} />
                                                    <Text className="text-slate-600 text-[10px] font-black uppercase tracking-widest mt-4">Syncing Athletes...</Text>
                                                </View>
                                            ) : filteredClients.length === 0 ? (
                                                <View className="py-16 items-center justify-center bg-slate-900/20 rounded-[40px] border border-white/5 border-dashed">
                                                    <Users size={48} color="#1E293B" />
                                                    <Text className="text-slate-600 font-bold mt-4">No athletes found</Text>
                                                </View>
                                            ) : (
                                                filteredClients.map(c => (
                                                    <ClientCard 
                                                        key={c.id}
                                                        client={c}
                                                        isSelected={selectedClient?.id === c.id}
                                                        onPress={() => setSelectedClient(c)}
                                                        theme={theme}
                                                    />
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
                                        
                                        <View style={{ flexDirection: 'row', backgroundColor: '#0F172A', padding: 8, borderRadius: 32, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', marginBottom: 40 }}>
                                            <TouchableOpacity 
                                                onPress={() => { setRecurrence('once'); setSelectedWeekdays([]); }} 
                                                style={[{ flex: 1, paddingVertical: 18, alignItems: 'center', borderRadius: 24 }, recurrence === 'once' ? { backgroundColor: '#2563EB' } : {}]}
                                                activeOpacity={0.7}
                                            >
                                                <Text style={{ fontWeight: '900', color: recurrence === 'once' ? '#FFFFFF' : '#475569' }}>One-time</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity 
                                                onPress={() => { setRecurrence('weekly'); setSelectedDates([]); }} 
                                                style={[{ flex: 1, paddingVertical: 18, alignItems: 'center', borderRadius: 24 }, recurrence === 'weekly' ? { backgroundColor: '#2563EB' } : {}]}
                                                activeOpacity={0.7}
                                            >
                                                <Text style={{ fontWeight: '900', color: recurrence === 'weekly' ? '#FFFFFF' : '#475569' }}>Recurrent</Text>
                                            </TouchableOpacity>
                                        </View>

                                         {recurrence === 'once' && (
                                             <View>
                                                 <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-6 ml-1">Select Specific Date</Text>
                                                 <BrandedCalendar 
                                                     selectedDate={selectedDates[0] || null} 
                                                     onSelect={(date) => setSelectedDates([date])} 
                                                 />
                                             </View>
                                         )}
                                        
                                        {recurrence === 'weekly' && (
                                            <View>
                                                <View className="flex-row items-center justify-between mb-6 ml-1 pr-1">
                                                    <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Weekly Frequency</Text>
                                                    <View className="flex-row items-center gap-1.5 opacity-60 bg-slate-900/50 px-2 py-1 rounded-full border border-white/5">
                                                        <Text className="text-slate-500 text-[9px] font-black uppercase tracking-widest">Swipe</Text>
                                                        <ArrowRight size={10} color="#64748B" />
                                                    </View>
                                                </View>
                                                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-6 mb-12 px-6">
                                                    <View className="flex-row gap-3 pr-12">
                                                        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => {
                                                            const dayIdx = (i + 1) % 7;
                                                            const isSelected = selectedWeekdays.includes(dayIdx);
                                                            return (
                                                                <Pressable 
                                                                    key={i} onPress={() => toggleWeekday(dayIdx, isSelected)}
                                                                    className={`w-20 h-20 rounded-[28px] items-center justify-center ${isSelected ? 'bg-blue-600 border border-blue-500' : 'bg-slate-900 border border-white/5'}`}
                                                                >
                                                                    <Text className={`font-black text-2xl ${isSelected ? 'text-white' : 'text-slate-500'}`}>{day}</Text>
                                                                </Pressable>
                                                            );
                                                        })}
                                                    </View>
                                                </ScrollView>
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
                                        {renderHeader("Available Times", headerSub)}
                                        
                                        {loading ? <ActivityIndicator size="large" color={theme.colors.primary} className="mt-20" /> : (
                                            <View className="gap-8">
                                                {availableSlots.length > 0 ? (
                                                    <>
                                                        {/* Morning Slots */}
                                                        {availableSlots.some(s => s.time.getHours() < 12) && (
                                                            <View>
                                                                <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-4 ml-1">Morning Slots</Text>
                                                                <View className="gap-3">
                                                                    {availableSlots.filter(s => s.time.getHours() < 12).map((slot, i) => (
                                                                        <TimeSlotCard 
                                                                            key={slot.time.toISOString()}
                                                                            slot={slot}
                                                                            isSelected={selectedTime?.getTime() === slot.time.getTime()}
                                                                            onPress={() => {
                                                                                if (slot.available) {
                                                                                    if (selectedTime?.getTime() === slot.time.getTime()) {
                                                                                        setSelectedTime(null);
                                                                                    } else {
                                                                                        setSelectedTime(slot.time);
                                                                                    }
                                                                                }
                                                                            }}
                                                                        />
                                                                    ))}
                                                                </View>
                                                            </View>
                                                        )}

                                                        {/* Afternoon Slots */}
                                                        {availableSlots.some(s => s.time.getHours() >= 12) && (
                                                            <View>
                                                                <View className="flex-row items-center gap-4 mb-4">
                                                                    <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest ml-1">Afternoon Slots</Text>
                                                                    <View className="flex-1 h-[1px] bg-white/5" />
                                                                </View>
                                                                <View className="gap-3">
                                                                    {availableSlots.filter(s => s.time.getHours() >= 12).map((slot, i) => (
                                                                        <TimeSlotCard 
                                                                            key={slot.time.toISOString()}
                                                                            slot={slot}
                                                                            isSelected={selectedTime?.getTime() === slot.time.getTime()}
                                                                            onPress={() => {
                                                                                if (slot.available) {
                                                                                    if (selectedTime?.getTime() === slot.time.getTime()) {
                                                                                        setSelectedTime(null);
                                                                                    } else {
                                                                                        setSelectedTime(slot.time);
                                                                                    }
                                                                                }
                                                                            }}
                                                                        />
                                                                    ))}
                                                                </View>
                                                            </View>
                                                        )}
                                                    </>
                                                ) : (
                                                    <View className="p-10 items-center justify-center bg-slate-900/20 rounded-[40px] border border-white/5 border-dashed mt-4">
                                                        <Clock size={32} color="#475569" className="mb-4" />
                                                        <Text className="text-slate-200 font-black text-center text-lg mb-2">No times open</Text>
                                                        <Text className="text-slate-500 font-medium text-center text-xs mb-6 px-4">
                                                            Choose another day or change your working hours.
                                                        </Text>
                                                        <TouchableOpacity
                                                            onPress={() => {
                                                                onClose();
                                                                router.push('/(coach)/settings/availability');
                                                            }}
                                                            className="px-6 py-3.5 bg-blue-600 rounded-2xl flex-row items-center gap-2 border border-blue-500"
                                                            activeOpacity={0.8}
                                                        >
                                                            <Clock size={16} color="white" />
                                                            <Text className="text-white font-black text-sm">Change Working Hours</Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                )}
                                            </View>
                                        )}
                                    </View>
                                )}

                                {step === 'details' && (
                                    <View>
                                        <View className="flex-row justify-between items-center mb-1">
                                            <Pressable onPress={() => setStep('time')} className="p-2 -ml-2">
                                                <ArrowLeft size={24} color="white" />
                                            </Pressable>
                                            <Text className="text-white/40 text-[10px] font-black uppercase tracking-[2px]">Step 4 of 5</Text>
                                        </View>
                                        {renderHeader("Refine Your Session", "Define the core parameters and context for today's high-performance training session.")}
                                        
                                        <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-3 ml-1">Duration</Text>
                                        <View className="p-8 bg-slate-900/50 border border-white/5 rounded-[40px] flex-row items-center justify-between mb-10">
                                            <View className="flex-row items-center gap-5">
                                                <View className="w-16 h-16 bg-slate-950 rounded-2xl items-center justify-center border border-white/5">
                                                    <Clock size={28} color={theme.colors.primary} />
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
                                                <Pressable 
                                                    key={type} onPress={() => setSessionType(type as any)}
                                                    style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                                                >
                                                    <View
                                                        style={[
                                                            {
                                                                paddingHorizontal: 32,
                                                                paddingVertical: 20,
                                                                borderRadius: 22,
                                                                flexDirection: 'row',
                                                                alignItems: 'center',
                                                            },
                                                            sessionType === type 
                                                                ? { backgroundColor: '#2563EB', borderColor: theme.colors.primary, borderWidth: 1 } 
                                                                : { backgroundColor: '#0F172A', borderColor: 'rgba(255, 255, 255, 0.05)', borderWidth: 1 }
                                                        ]}
                                                        className="gap-3 shadow-lg"
                                                    >
                                                        <Icon size={16} color={sessionType === type ? 'white' : '#475569'} />
                                                        <Text style={{ fontWeight: '900', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, color: sessionType === type ? '#FFFFFF' : '#64748B' }}>{type.replace('_', ' ')}</Text>
                                                    </View>
                                                </Pressable>
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
                                         {renderHeader("Review details", "Check details before saving.")}
                                         
                                         <View className="bg-[#064E3B]/20 border border-[#059669]/30 p-6 rounded-[32px] flex-row items-center gap-5 mb-10">
                                             <View className="w-12 h-12 bg-[#10B981] rounded-2xl items-center justify-center">
                                                 <Check size={24} color="white" strokeWidth={3} />
                                             </View>
                                             <View>
                                                 <Text className="text-[#10B981] font-black text-[11px] uppercase tracking-[3px]">No conflicts</Text>
                                                 <Text className="text-[#10B981]/70 text-[10px] font-bold mt-0.5">Time slot is free.</Text>
                                             </View>
                                         </View>

                                         <View className="bg-slate-900/50 p-6 rounded-[32px] border border-white/5 mb-6">
                                             <View className="flex-row items-center gap-5">
                                                <BrandedAvatar size={64} name={selectedClient?.profiles.full_name || ''} imageUrl={selectedClient?.profiles.avatar_url} useBrandColor={true} />
                                                <View className="flex-1">
                                                   <Text className="text-slate-500 text-[10px] font-black uppercase tracking-[2px] mb-1">Client</Text>
                                                   <Text className="text-white text-2xl font-black tracking-tight" numberOfLines={1}>{selectedClient?.profiles.full_name}</Text>
                                                   <View className="bg-blue-600/20 self-start px-2.5 py-1 rounded-lg mt-2 border border-blue-600/20">
                                                       <Text className="text-blue-500 font-black text-[8px] uppercase tracking-widest">{selectedClient?.profiles.subtype || 'Athlete'}</Text>
                                                   </View>
                                                </View>
                                             </View>
                                         </View>

                                         <View className="gap-4">
                                             {/* Schedule Card */}
                                             <View className="bg-slate-900/30 p-6 rounded-[32px] border border-white/5 flex-row items-start gap-5">
                                                 <View className="w-12 h-12 bg-slate-950 rounded-2xl items-center justify-center border border-white/10 mt-1">
                                                    {recurrence === 'once' ? (
                                                        <Calendar size={20} color={theme.colors.primary} />
                                                    ) : (
                                                        <Repeat size={20} color={theme.colors.primary} />
                                                    )}
                                                 </View>
                                                 <View style={{ flex: 1 }}>
                                                     <View className="flex-row items-center justify-between">
                                                         <Text className="text-slate-500 text-[10px] font-black uppercase tracking-[2px]">Schedule</Text>
                                                         <View className="w-5 h-5 bg-[#10B981]/10 rounded-full items-center justify-center border border-[#10B981]/20">
                                                             <Check size={12} color="#10B981" strokeWidth={3} />
                                                         </View>
                                                     </View>
                                                     
                                                     {recurrence === 'once' ? (
                                                         <View>
                                                             <Text className="text-white font-bold text-lg mt-0.5">One-time</Text>
                                                             <View className="flex-row items-center gap-2 mt-3 bg-slate-950 self-start px-3.5 py-2 rounded-xl border border-white/5">
                                                                 <Calendar size={14} color={theme.colors.primary} />
                                                                 <Text className="text-slate-200 font-bold text-xs">
                                                                     {selectedDates[0] ? formatDisplayDate(selectedDates[0], 'summary') : 'No date selected'}
                                                                 </Text>
                                                             </View>
                                                         </View>
                                                     ) : (
                                                         <View>
                                                             <Text className="text-white font-bold text-lg mt-0.5">Weekly</Text>
                                                             <View className="flex-row gap-1.5 mt-3">
                                                                 {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => {
                                                                     const dayIdx = (i + 1) % 7;
                                                                     const isSelected = selectedWeekdays.includes(dayIdx);
                                                                     return (
                                                                         <View 
                                                                             key={i} 
                                                                             className={`w-8 h-8 rounded-full items-center justify-center border ${
                                                                                 isSelected 
                                                                                     ? 'bg-blue-600 border-blue-500 shadow-md shadow-blue-500/20' 
                                                                                     : 'bg-slate-950 border-white/5'
                                                                             }`}
                                                                         >
                                                                             <Text className={`font-black text-[10px] ${isSelected ? 'text-white' : 'text-slate-600'}`}>
                                                                                 {day}
                                                                             </Text>
                                                                         </View>
                                                                     );
                                                                 })}
                                                             </View>
                                                         </View>
                                                     )}
                                                 </View>
                                             </View>

                                             {/* Time Card */}
                                             <View className="bg-slate-900/30 p-6 rounded-[32px] border border-white/5 flex-row items-start gap-5">
                                                 <View className="w-12 h-12 bg-slate-950 rounded-2xl items-center justify-center border border-white/10 mt-1">
                                                    <Clock size={20} color="#A78BFA" />
                                                 </View>
                                                 <View style={{ flex: 1 }}>
                                                     <View className="flex-row items-center justify-between">
                                                         <Text className="text-slate-500 text-[10px] font-black uppercase tracking-[2px]">Time</Text>
                                                         <View className="w-5 h-5 bg-[#10B981]/10 rounded-full items-center justify-center border border-[#10B981]/20">
                                                             <Check size={12} color="#10B981" strokeWidth={3} />
                                                         </View>
                                                     </View>
                                                     
                                                     <View className="mt-4 flex-row items-center gap-3">
                                                         {/* Start Time Pill */}
                                                         <View className="bg-slate-950 px-4 py-2.5 rounded-[16px] border border-white/5 items-center justify-center">
                                                             <Text className="text-white font-black text-lg">
                                                                 {selectedTime?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                                                             </Text>
                                                         </View>

                                                         {/* Right Arrow */}
                                                         <ArrowRight size={20} color={theme.colors.primary} />

                                                         {/* End Time Pill */}
                                                         <View className="bg-slate-950 px-4 py-2.5 rounded-[16px] border border-white/5 items-center justify-center">
                                                             <Text className="text-white font-black text-lg">
                                                                 {selectedTime ? new Date(selectedTime.getTime() + duration*60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : ''}
                                                             </Text>
                                                         </View>
                                                     </View>
                                                 </View>
                                             </View>
                                         </View>
                                     </View>
                                )}
                        </View>
                    </ScrollView>
                    
                    {/* Fixed Circular AI Scheduler Button - Appears after selection */}
                    {onSwitchToAI && selectedClient && step === 'client' && (
                        <MotiView
                            from={{ opacity: 0, scale: 0.5, translateY: 20 }}
                            animate={{ opacity: 1, scale: 1, translateY: 0 }}
                            transition={{ type: 'spring', damping: 15 }}
                            className="absolute bottom-[160px] right-8 z-50"
                        >
                            <Pressable 
                                onPressIn={() => handlePressIn(aiBtnScale)}
                                onPressOut={() => handlePressOut(aiBtnScale)}
                                onPress={() => onSwitchToAI(selectedClient)}
                            >
                                {({ pressed }) => (
                                    <Animated.View
                                        style={[{ transform: [{ scale: aiBtnScale }] }]}
                                        className={`w-20 h-20 rounded-full items-center justify-center shadow-2xl border-4 border-white/10 ${pressed ? 'bg-blue-700 shadow-blue-500/30' : 'bg-blue-600 shadow-blue-500/50'}`}
                                    >
                                        <Sparkles size={32} color="white" />
                                    </Animated.View>
                                )}
                            </Pressable>
                        </MotiView>
                    )}
                    {/* Bottom Actions */}
                    <View className="p-8 pb-12 border-t border-white/5 flex-row gap-4 items-center bg-[#020617]">
                        <Pressable 
                            onPressIn={() => handlePressIn(backBtnScale)}
                            onPressOut={() => handlePressOut(backBtnScale)}
                            onPress={() => currentStepIdx === 0 ? onClose() : setStep(steps[currentStepIdx - 1])}
                            style={{ flexShrink: 0 }}
                        >
                            {({ pressed }) => (
                                <Animated.View 
                                    style={[
                                        { transform: [{ scale: backBtnScale }] }
                                    ]}
                                    className={`px-8 py-5 items-center justify-center rounded-full ${pressed ? 'bg-slate-800' : 'bg-slate-900'}`}
                                >
                                    <Text className="text-white font-bold text-sm">Back</Text>
                                </Animated.View>
                            )}
                        </Pressable>

                        <Pressable 
                            disabled={!canContinue() || loading}
                            onPressIn={() => handlePressIn(nextBtnScale)}
                            onPressOut={() => handlePressOut(nextBtnScale)}
                            onPress={() => {
                                if (!canContinue()) {
                                    Alert.alert("Action Required", step === 'days' && recurrence === 'weekly' ? "Please select at least one weekday for your recurring session." : "Please complete the required fields to continue.");
                                    return;
                                }
                                if (step === 'confirm') handleConfirm();
                                else {
                                    const nextStep = steps[steps.indexOf(step) + 1];
                                    setStep(nextStep);
                                }
                            }}
                            style={{ flex: 1 }}
                        >
                            {({ pressed }) => {
                                const isEnabled = canContinue() && !loading;
                                const bgStyle = isEnabled 
                                    ? (pressed ? 'bg-blue-700' : 'bg-blue-600') 
                                    : 'bg-slate-800';
                                return (
                                    <Animated.View 
                                        style={[
                                            { transform: [{ scale: nextBtnScale }] }
                                        ]}
                                        className={`px-8 py-5 items-center justify-center rounded-full flex-row gap-2 ${bgStyle}`}
                                    >
                                        {loading ? (
                                            <ActivityIndicator color="white" />
                                        ) : (
                                            <>
                                                <Text className={`font-black text-sm tracking-wide ${isEnabled ? 'text-white' : 'text-slate-500'}`}>
                                                    {step === 'confirm' ? 'Schedule Sessions' : 'Next Step'}
                                                </Text>
                                                {step !== 'confirm' && <ArrowRight size={16} color={isEnabled ? 'white' : '#64748B'} />}
                                            </>
                                        )}
                                    </Animated.View>
                                );
                            }}
                        </Pressable>
            </View>
          </View>
        </View>
          
          <DatePickerOverlay 
              visible={showDatePicker}
              selectedDate={new Date()}
              onSelect={(date) => {
                  const dISO = formatDateToISO(date);
                  if (!selectedDates.some(sd => formatDateToISO(sd) === dISO)) {
                      setSelectedDates([...selectedDates, date]);
                  }
              }}
              onClose={() => setShowDatePicker(false)}
          />
        </Modal>
    );
}
