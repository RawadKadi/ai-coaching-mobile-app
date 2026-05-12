import React, { useState } from 'react';
import { View, Text, Modal, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, Alert, Platform, SafeAreaView } from 'react-native';
import { MotiView, AnimatePresence } from 'moti';
import { X, Mic, Send, Calendar, Clock, Check, AlertTriangle, Pencil, Trash2, Save, Repeat, Sparkles, ChevronLeft, Info } from 'lucide-react-native';
import { useTheme } from '@/contexts/BrandContext';
import { parseScheduleRequest, ProposedSession, RateLimitError, extractSchedulingIntent } from '@/lib/ai-scheduling-service';
import { Session } from '@/types/database';
import ConflictResolutionModal from './ConflictResolutionModal';
import { ConflictInfo, Resolution } from '@/types/conflict';
import { findAvailableSlots } from '@/lib/time-slot-finder';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { BrandedAvatar } from '@/components/BrandedAvatar';

interface SchedulerModalProps {
    visible: boolean;
    onClose: () => void;
    onConfirm: (sessions: ProposedSession[]) => Promise<void>;
    clientContext: {
        name: string;
        timezone: string;
        avatar_url?: string;
    };
    existingSessions: Session[];
    targetClientId: string;
}

export default function SchedulerModal({ visible, onClose, onConfirm, clientContext, existingSessions, targetClientId }: SchedulerModalProps) {
    const { coach, profile } = useAuth();
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [proposedSessions, setProposedSessions] = useState<ProposedSession[]>([]);
    const [step, setStep] = useState<'input' | 'form' | 'review'>('input');
    
    // Form state for structured input
    const [formTime, setFormTime] = useState('');
    const [formDates, setFormDates] = useState<string[]>([]);
    const [formRecurrence, setFormRecurrence] = useState<'once' | 'weekly' | null>(null);
    const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

    const toggleDay = (day: string) => {
        setFormDates(prev => 
            prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
        );
    };

    // Conflict resolution state
    const [conflictInfo, setConflictInfo] = useState<ConflictInfo | null>(null);
    const [showConflictModal, setShowConflictModal] = useState(false);
    
    // Flags for what's actually missing from original prompt
    const [originallyMissingDays, setOriginallyMissingDays] = useState(false);
    const [originallyMissingTime, setOriginallyMissingTime] = useState(false);
    
    const resetForm = () => {
        setStep('input');
        setInput('');
        setFormTime('');
        setFormDates([]);
        setFormRecurrence(null);
        setProposedSessions([]);
        setConflictInfo(null);
        setShowConflictModal(false);
        setOriginallyMissingDays(false);
        setOriginallyMissingTime(false);
    };

    const handleAnalyze = async () => {
        if (step === 'form') {
            if (formDates.length === 0 || !formTime) {
                Alert.alert('Details Needed', 'Please provide both days and a time.');
                return;
            }
            const sessionIntents = formDates.map(date => ({ date, time: formTime }));
            await finalizeWithAI(sessionIntents, formRecurrence || 'once');
            return;
        }

        if (!input.trim()) return;
        setLoading(true);
        setProposedSessions([]);

        try {
            const intent = await extractSchedulingIntent(input);
            const newDates = intent.sessions.map(s => s.date).filter((d): d is string => d !== null);
            const firstTime = intent.sessions.find(s => s.time !== null)?.time || '';
            const newRecurrence = intent.recurrence;

            if (firstTime) setFormTime(firstTime);
            if (newDates.length > 0) setFormDates(newDates);
            if (newRecurrence) setFormRecurrence(newRecurrence);

            const isMissingDays = newDates.length === 0;
            const isMissingTime = !firstTime;

            setOriginallyMissingDays(isMissingDays);
            setOriginallyMissingTime(isMissingTime);

            // Skip the form step if we have both days and time. Default to 'once' if recurrence is unknown.
            if (isMissingDays || isMissingTime) {
                setStep('form');
                return;
            }

            await finalizeWithAI(
                intent.sessions.filter((s): s is { date: string, time: string | null } => s.date !== null),
                newRecurrence || 'once'
            );
        } catch (error) {
            console.error('Error in handleAnalyze:', error);
            Alert.alert('Error', 'Failed to analyze request.');
        } finally {
            setLoading(false);
        }
    };

    const finalizeWithAI = async (sessionIntents: { date: string, time: string | null }[], recurrence: 'weekly' | 'once') => {
        setLoading(true);
        try {
            const allSessions: ProposedSession[] = [];
            for (const intent of sessionIntents) {
                const isoDate = resolveDateKeywordToISO(intent.date, intent.time);
                const result = await parseScheduleRequest({
                    coachInput: `Schedule on ${isoDate} at ${intent.time} ${recurrence === 'weekly' ? 'every week' : 'one time'}`,
                    currentDate: new Date().toLocaleString(),
                    clientContext,
                    currentProposedSessions: proposedSessions,
                    existingSessions: existingSessions,
                });

                if (result.sessions && result.sessions.length > 0) {
                    allSessions.push(...result.sessions.map(s => ({...s, recurrence, day_of_week: s.day_of_week || new Date(isoDate).toLocaleDateString('en-US', { weekday: 'long' }) })));
                } else if (result.clarification) {
                    Alert.alert('Details Needed', result.clarification.message);
                    setLoading(false);
                    return;
                }
            }
            if (allSessions.length > 0) {
                setProposedSessions(allSessions as any);
                setStep('review');
            }
        } catch (error) {
            Alert.alert('Error', 'AI service busy. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const resolveDateKeywordToISO = (keyword: string, timeStr?: string | null): string => {
        const now = new Date();
        const dayMap: { [key: string]: number } = {
            'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
            'thursday': 4, 'friday': 5, 'saturday': 6
        };
        const toLocalISO = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

        if (keyword === 'today') return toLocalISO(now);
        if (keyword === 'tomorrow') {
            const d = new Date(now);
            d.setDate(now.getDate() + 1);
            return toLocalISO(d);
        }
        
        if (keyword in dayMap) {
            const targetDay = dayMap[keyword];
            const currentDay = now.getDay();
            let diff = targetDay - currentDay;
            if (diff < 0) diff += 7;
            
            // If it's today, check if the time has already passed
            if (diff === 0 && timeStr) {
                // Parse time string like "10:30 PM" or "10pm" or "14:00"
                let hours = 0;
                let minutes = 0;
                const timeMatch = timeStr.toLowerCase().match(/(\d+)(?::(\d+))?\s*(am|pm)?/);
                
                if (timeMatch) {
                    hours = parseInt(timeMatch[1], 10);
                    minutes = parseInt(timeMatch[2] || '0', 10);
                    const ampm = timeMatch[3];
                    
                    if (ampm === 'pm' && hours < 12) hours += 12;
                    if (ampm === 'am' && hours === 12) hours = 0;
                    
                    const r = new Date(now);
                    r.setHours(hours, minutes, 0, 0);
                    if (r < now) diff = 7;
                }
            }
            
            const d = new Date(now);
            d.setDate(now.getDate() + diff);
            return toLocalISO(d);
        }
        return keyword;
    };

    const checkConflict = (proposed: ProposedSession): ConflictInfo | null => {
        const proposedStart = new Date(proposed.scheduled_at);
        const proposedEnd = new Date(proposedStart.getTime() + proposed.duration_minutes * 60000);

        for (const existing of existingSessions) {
            if (existing.status === 'cancelled') continue;
            const existingStart = new Date(existing.scheduled_at);
            const existingEnd = new Date(existingStart.getTime() + existing.duration_minutes * 60000);
            if (proposedStart < existingEnd && proposedEnd > existingStart) {
                return {
                    type: 'time_conflict',
                    message: `Conflict with ${existing.client?.profiles?.full_name || 'another session'}`,
                    existingSession: {
                        id: existing.id,
                        client_id: existing.client_id,
                        client_name: existing.client?.profiles?.full_name || 'Unknown Client',
                        scheduled_at: existing.scheduled_at,
                        duration_minutes: existing.duration_minutes,
                        session_type: existing.session_type,
                        recurrence: 'once'
                    },
                    proposedSession: {
                        client_id: targetClientId,
                        client_name: clientContext.name,
                        scheduled_at: proposed.scheduled_at,
                        duration_minutes: proposed.duration_minutes,
                        session_type: proposed.session_type,
                        recurrence: proposed.recurrence as any,
                        day_of_week: proposed.day_of_week
                    },
                    recommendations: []
                };
            }
        }
        return null;
    };

    const handleConflictDetected = (session: ProposedSession, conflict: ConflictInfo) => {
        setConflictInfo(conflict);
        setShowConflictModal(true);
    };

    const handleResolution = (resolution: Resolution) => {
        if (!conflictInfo) return;
        // In this AI flow, we just acknowledge the recommendation for now
        setShowConflictModal(false);
        setConflictInfo(null);
    };

    const handleFinalConfirm = async () => {
        if (!coach?.id) return;
        setLoading(true);
        try {
            const sessionsToInsert = proposedSessions.map(session => ({
                coach_id: coach.id,
                client_id: targetClientId,
                scheduled_at: session.scheduled_at,
                duration_minutes: session.duration_minutes || 60,
                session_type: session.session_type || 'training',
                status: 'scheduled',
                is_locked: true,
                ai_generated: true,
                meet_link: `https://meet.jit.si/${coach.id}-${targetClientId}-${Date.now()}-${Math.random().toString(36).substring(7)}`,
                notes: session.notes || `AI Scheduled session for ${clientContext?.name || 'Athlete'}`
            }));

            const { error } = await supabase.from('sessions').insert(sessionsToInsert);
            if (error) throw error;

            await onConfirm(proposedSessions);
            resetForm();
            onClose();
        } catch (error: any) {
            console.error('[SchedulerModal] Final Confirm Error:', error);
            Alert.alert('Error', 'Failed to schedule sessions. ' + (error?.message || ''));
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
            <View style={{ flex: 1, backgroundColor: '#020617' }}>
                <View className="px-6 pt-6 pb-4 flex-row justify-between items-center border-b border-slate-900 bg-slate-950/80">
                    <View className="flex-row items-center gap-3">
                        {step !== 'input' && (
                           <TouchableOpacity onPress={() => {
                               Alert.alert(
                                   'Discard Changes?',
                                   'This will clear your current AI scheduling progress. Are you sure you want to go back?',
                                   [
                                       { text: 'Cancel', style: 'cancel' },
                                       { text: 'Yes, discard', style: 'destructive', onPress: () => { setStep('input'); setProposedSessions([]); } }
                                   ]
                               );
                           }}>
                               <ChevronLeft size={24} color="#94A3B8" />
                           </TouchableOpacity>
                        )}
                        <View>
                            <Text className="text-white text-xl font-bold">AI Scheduler</Text>
                            <Text className="text-slate-500 text-xs">Setup sessions with {clientContext?.name || 'Athlete'}</Text>
                        </View>
                    </View>
                    <TouchableOpacity onPress={() => { resetForm(); onClose(); }} style={{ padding: 8, backgroundColor: '#0F172A', borderRadius: 9999 }}>
                        <X size={20} color="#94A3B8" />
                    </TouchableOpacity>
                </View>

                <AnimatePresence exitBeforeEnter>
                    {loading && step !== 'review' ? (
                        <MotiView 
                            key="loading"
                            from={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 1.05 }}
                            transition={{ type: 'timing', duration: 300 }}
                            className="flex-1 justify-center items-center py-24 px-6"
                        >
                            <MotiView 
                                from={{ opacity: 0.5, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1.1 }}
                                transition={{ type: 'timing', duration: 1000, loop: true }}
                                style={{
                                    width: 96,
                                    height: 96,
                                    backgroundColor: '#2563EB',
                                    borderRadius: 32,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginBottom: 32,
                                    borderWidth: 2,
                                    borderColor: 'rgba(255,255,255,0.2)',
                                    shadowColor: '#3B82F6',
                                    shadowOffset: { width: 0, height: 20 },
                                    shadowOpacity: 0.5,
                                    shadowRadius: 30,
                                    elevation: 15
                                }}
                            >
                                <Sparkles size={40} color="white" fill="white" />
                            </MotiView>
                            <Text className="text-white text-3xl font-black text-center tracking-tighter mb-4">Validating Plan</Text>
                            <Text className="text-slate-400 text-center leading-6 text-sm font-medium px-8">
                                Checking calendar availability and analyzing schedule constraints...
                            </Text>
                        </MotiView>
                    ) : step === 'input' ? (
                        <MotiView 
                          key="input"
                          from={{ opacity: 0, translateX: -20 }}
                          animate={{ opacity: 1, translateX: 0 }}
                          exit={{ opacity: 0, translateX: 20 }}
                          transition={{ type: 'timing', duration: 300 }}
                          className="flex-1"
                        >
                        <ScrollView className="flex-1 px-6 pt-8" showsVerticalScrollIndicator={false}>
                            <View className="p-8 rounded-[40px] bg-blue-600/10 border border-blue-500/20 items-center overflow-hidden mb-8">
                                <View className="absolute top-0 right-0 p-4 opacity-10">
                                    <Sparkles size={120} color="#3B82F6" />
                                </View>
                                
                                <View className="mb-6">
                                    <BrandedAvatar 
                                        name={clientContext?.name || 'Athlete'} 
                                        imageUrl={clientContext?.avatar_url} 
                                        size={80} 
                                    />
                                    <View className="absolute -bottom-2 -right-2 bg-blue-600 rounded-full p-2 border-[3px] border-[#020617]">
                                        <Sparkles size={16} color="white" fill="white" />
                                    </View>
                                </View>

                                <Text className="text-white text-2xl font-black text-center tracking-tighter">AI Scheduling</Text>
                                <Text className="text-slate-400 text-center mt-3 leading-5 px-4 text-sm font-medium">
                                    Describe your plan for {(clientContext?.name || 'the athlete').split(' ')[0]}. Our AI handles times, dates, and conflict checks.
                                </Text>
                            </View>
                            
                            <View className="bg-slate-900/50 rounded-[40px] border border-slate-800 p-8 min-h-[220px] mb-20">
                                <TextInput
                                    className="text-white text-lg leading-7 font-medium"
                                    multiline
                                    placeholder="e.g., 'Weekly sessions every Monday at 2pm'"
                                    placeholderTextColor="#1e293b"
                                    value={input}
                                    onChangeText={setInput}
                                    textAlignVertical="top"
                                />
                                <View className="flex-row justify-between items-center mt-8 pt-6 border-t border-white/5">
                                    <TouchableOpacity style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#020617', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#1E293B' }}>
                                        <Mic size={24} color="#3B82F6" />
                                    </TouchableOpacity>
                                    
                                    <TouchableOpacity 
                                        style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            gap: 12,
                                            paddingVertical: 16,
                                            paddingHorizontal: 32,
                                            borderRadius: 24,
                                            backgroundColor: input.trim() ? '#2563EB' : '#1E293B',
                                            ...(input.trim() ? {
                                                shadowColor: '#3B82F6',
                                                shadowOffset: { width: 0, height: 10 },
                                                shadowOpacity: 0.4,
                                                shadowRadius: 20,
                                                elevation: 10
                                            } : {})
                                        }}
                                        onPress={handleAnalyze}
                                        disabled={!input.trim() || loading}
                                    >
                                        {loading ? (
                                            <ActivityIndicator color="white" />
                                        ) : (
                                            <>
                                                <Sparkles size={20} color="white" />
                                                <Text className="text-white font-black text-base uppercase tracking-widest">Draft Plan</Text>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </ScrollView>
                    </MotiView>
                ) : step === 'form' ? (
                    <MotiView 
                        key="form"
                        from={{ opacity: 0, translateX: -20 }}
                        animate={{ opacity: 1, translateX: 0 }}
                        exit={{ opacity: 0, translateX: 20 }}
                        transition={{ type: 'timing', duration: 300 }}
                        className="flex-1 px-6 pt-8"
                    >
                        <>
                             <View className="mb-8 flex-row items-center gap-4">
                                    <View className="w-12 h-12 bg-amber-500/10 rounded-2xl items-center justify-center border border-amber-500/20">
                                        <Info size={24} color="#F59E0B" />
                                    </View>
                                    <View className="flex-1">
                                        <Text className="text-white text-xl font-black tracking-tight leading-7">
                                            {originallyMissingDays && originallyMissingTime ? "Days & Time Needed" : 
                                             originallyMissingDays ? "You didn't mention the days needed" :
                                             originallyMissingTime ? "You didn't mention the time" : "Details Needed"}
                                        </Text>
                                        <Text className="text-slate-500 text-xs font-medium mt-1">
                                            {originallyMissingDays && originallyMissingTime ? "Specify both below for our ai to schedule it for you..." :
                                             originallyMissingDays ? "Specify below for our ai to schedule it for you..." :
                                             originallyMissingTime ? "Mention it in plain english for our ai to understand your session needs" :
                                             "Please refine the schedule details below."}
                                        </Text>
                                    </View>
                                 </View>

                                 <View className="bg-slate-900/50 p-7 rounded-[32px] border border-slate-800">
                                     {/* Days Selector - Only show if originally missing */}
                                     {originallyMissingDays && (
                                        <View className="mb-8">
                                            <Text className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-4">Days Needed</Text>
                                            <View className="flex-row flex-wrap gap-2.5">
                                                {DAYS.map(day => {
                                                    const isSelected = formDates.includes(day);
                                                    return (
                                                        <TouchableOpacity
                                                            key={day}
                                                            onPress={() => toggleDay(day)}
                                                            style={{
                                                                paddingHorizontal: 16,
                                                                paddingVertical: 10,
                                                                borderRadius: 14,
                                                                backgroundColor: isSelected ? '#2563EB' : '#020617',
                                                                borderWidth: 1,
                                                                borderColor: isSelected ? '#3B82F6' : '#1E293B',
                                                            }}
                                                        >
                                                            <Text style={{
                                                                color: isSelected ? 'white' : '#64748B',
                                                                fontSize: 12,
                                                                fontWeight: '700',
                                                                textTransform: 'capitalize'
                                                            }}>{day}</Text>
                                                        </TouchableOpacity>
                                                    );
                                                })}
                                            </View>
                                        </View>
                                     )}

                                     {/* Time Input - Only show if originally missing */}
                                     {originallyMissingTime && (
                                        <View className="mb-10">
                                            <Text className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-4">Selected Time</Text>
                                            <TextInput
                                               style={{
                                                   backgroundColor: '#020617',
                                                   borderWidth: 1,
                                                   borderColor: '#1E293B',
                                                   borderRadius: 18,
                                                   padding: 18,
                                                   color: 'white',
                                                   fontSize: 16,
                                                   fontWeight: '600'
                                               }}
                                               placeholder="e.g. 10:30 PM"
                                               placeholderTextColor="#334155"
                                               value={formTime}
                                               onChangeText={setFormTime}
                                            />
                                        </View>
                                     )}

                                     <TouchableOpacity 
                                         style={{ 
                                            backgroundColor: '#2563EB', 
                                            paddingVertical: 18, 
                                            borderRadius: 20, 
                                            alignItems: 'center',
                                            shadowColor: '#3B82F6',
                                            shadowOffset: { width: 0, height: 8 },
                                            shadowOpacity: 0.3,
                                            shadowRadius: 12,
                                            elevation: 6,
                                            marginTop: (!originallyMissingDays || !originallyMissingTime) ? 8 : 0
                                         }} 
                                         onPress={handleAnalyze}
                                     >
                                        <Text className="text-white font-black text-base uppercase tracking-widest">Validate Plan</Text>
                                     </TouchableOpacity>
                                 </View>
                            </>
                    </MotiView>
                ) : (
                    <MotiView 
                        key="review"
                        from={{ opacity: 0, translateX: -20 }}
                        animate={{ opacity: 1, translateX: 0 }}
                        exit={{ opacity: 0, translateX: 20 }}
                        transition={{ type: 'timing', duration: 300 }}
                        className="flex-1 px-6 pt-8"
                    >
                        <View className="mb-8 flex-row items-center gap-4">
                            <View className="w-12 h-12 bg-emerald-500/10 rounded-2xl items-center justify-center border border-emerald-500/20">
                                <Check size={24} color="#10B981" />
                            </View>
                            <View>
                                <Text className="text-white text-xl font-black tracking-tight">Review Schedule</Text>
                                <Text className="text-slate-500 text-xs font-medium">Verify the sessions before sending invites.</Text>
                            </View>
                        </View>
                        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                            {proposedSessions.map((session, index) => {
                                const conflict = checkConflict(session);
                                return (
                                    <View key={index} className="bg-slate-900 p-5 rounded-3xl border border-slate-800 mb-4">
                                        <View className="flex-row justify-between items-start">
                                            <View className="flex-row gap-4 flex-1">
                                                <View className="w-12 h-12 rounded-2xl bg-blue-600/10 items-center justify-center border border-blue-500/10">
                                                    <Clock size={24} color="#3B82F6" />
                                                </View>
                                                <View className="flex-1">
                                                    <Text className="text-white font-bold text-base">{session.session_type}</Text>
                                                    <Text className="text-slate-400 text-sm mt-0.5 capitalize">{session.day_of_week}, {' '}{new Date(session.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                                                </View>
                                            </View>
                                            <TouchableOpacity onPress={() => setProposedSessions(prev => prev.filter((_, i) => i !== index))}>
                                                <X size={18} color="#475569" />
                                            </TouchableOpacity>
                                        </View>
                                        {conflict && (
                                            <TouchableOpacity 
                                                style={{
                                                    marginTop: 16,
                                                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                                                    borderColor: 'rgba(245, 158, 11, 0.2)',
                                                    borderWidth: 1,
                                                    padding: 12,
                                                    borderRadius: 12,
                                                    flexDirection: 'row',
                                                    alignItems: 'center',
                                                    gap: 12
                                                }}
                                                onPress={() => handleConflictDetected(session, conflict)}
                                            >
                                                <AlertTriangle size={16} color="#F59E0B" />
                                                <Text className="text-amber-400 text-xs font-bold flex-1">{conflict.message}</Text>
                                                <Text className="text-amber-500 text-xs font-bold underline">Review</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                );
                            })}
                        </ScrollView>
                        <View className="pt-6 pb-8 border-t border-slate-900 bg-slate-950">
                             <TouchableOpacity style={{ backgroundColor: '#2563EB', paddingVertical: 16, borderRadius: 16, alignItems: 'center' }} onPress={handleFinalConfirm}>
                                <Text className="text-white font-bold text-lg">Send Session Invites</Text>
                             </TouchableOpacity>
                        </View>
                    </MotiView>
                )}
                </AnimatePresence>
            </View>

            <ConflictResolutionModal 
                visible={showConflictModal}
                onCancel={() => setShowConflictModal(false)}
                conflictInfo={conflictInfo}
                onResolve={handleResolution}
            />
        </Modal>
    );
}
