import React, { useState } from 'react';
import { View, Text, Modal, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, Alert, Platform, SafeAreaView } from 'react-native';
import { MotiView, AnimatePresence } from 'moti';
import { X, Mic, Send, Calendar, Clock, Check, AlertTriangle, Pencil, Trash2, Save, Repeat, Sparkles, ChevronLeft } from 'lucide-react-native';
import { useTheme } from '@/contexts/BrandContext';
import { parseScheduleRequest, ProposedSession, RateLimitError, extractSchedulingIntent } from '@/lib/ai-scheduling-service';
import { Session } from '@/types/database';
import ConflictResolutionModal from './ConflictResolutionModal';
import { ConflictInfo, Resolution } from '@/types/conflict';
import { findAvailableSlots } from '@/lib/time-slot-finder';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface SchedulerModalProps {
    visible: boolean;
    onClose: () => void;
    onConfirm: (sessions: ProposedSession[]) => Promise<void>;
    clientContext: {
        name: string;
        timezone: string;
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

    // Conflict resolution state
    const [conflictInfo, setConflictInfo] = useState<ConflictInfo | null>(null);
    const [showConflictModal, setShowConflictModal] = useState(false);
    
    const resetForm = () => {
        setStep('input');
        setInput('');
        setFormTime('');
        setFormDates([]);
        setFormRecurrence(null);
        setProposedSessions([]);
        setConflictInfo(null);
        setShowConflictModal(false);
    };

    const handleAnalyze = async () => {
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

            if (newDates.length === 0 || (intent.sessions.length > 0 && intent.sessions.some(s => s.time === null)) || !newRecurrence) {
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
            if (diff === 0 && timeStr) {
                 const [h, m] = timeStr.split(':').map(Number);
                 const r = new Date(now); r.setHours(h || 0, m || 0, 0, 0);
                 if (r < now) diff = 7;
            }
            const d = new Date(now); d.setDate(d.getDate() + diff);
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
        setLoading(true);
        try {
            await onConfirm(proposedSessions);
            resetForm();
            onClose();
        } catch (error) {
            Alert.alert('Error', 'Failed to schedule sessions.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
            <View className="flex-1 bg-slate-950">
                <View className="px-6 pt-6 pb-4 flex-row justify-between items-center border-b border-slate-900 bg-slate-950/80">
                    <View className="flex-row items-center gap-3">
                        {step !== 'input' && (
                           <TouchableOpacity onPress={() => setStep(step === 'review' ? 'form' : 'input')}>
                               <ChevronLeft size={24} color="#94A3B8" />
                           </TouchableOpacity>
                        )}
                        <View>
                            <Text className="text-white text-xl font-bold">AI Scheduler</Text>
                            <Text className="text-slate-500 text-xs">Setup sessions with {clientContext.name}</Text>
                        </View>
                    </View>
                    <TouchableOpacity onPress={() => { resetForm(); onClose(); }} className="p-2 bg-slate-900 rounded-full">
                        <X size={20} color="#94A3B8" />
                    </TouchableOpacity>
                </View>

                {step === 'input' ? (
                    <MotiView 
                      key="input"
                      from={{ opacity: 0, translateX: -20 }}
                      animate={{ opacity: 1, translateX: 0 }}
                      className="flex-1 px-6 pt-8"
                    >
                        <Text className="text-slate-400 text-sm font-medium mb-6 leading-relaxed">
                            Describe the training plan for {clientContext.name.split(' ')[0]}.
                        </Text>
                        
                        <View className="bg-slate-900/50 rounded-3xl border border-slate-800 p-6 min-h-[200px]">
                            <TextInput
                                className="text-white text-lg leading-6"
                                multiline
                                placeholder="e.g., 'Weekly sessions every Monday at 2pm'"
                                placeholderTextColor="#475569"
                                value={input}
                                onChangeText={setInput}
                                textAlignVertical="top"
                            />
                            <View className="flex-row justify-between items-center mt-auto pt-4">
                                <TouchableOpacity className="w-12 h-12 rounded-full bg-slate-950 items-center justify-center border border-slate-800">
                                    <Mic size={24} color="#3B82F6" />
                                </TouchableOpacity>
                                
                                <TouchableOpacity 
                                    className={`flex-row items-center gap-2 py-3 px-6 rounded-2xl ${input.trim() ? 'bg-blue-600' : 'bg-slate-800'}`}
                                    onPress={handleAnalyze}
                                    disabled={!input.trim() || loading}
                                >
                                    {loading ? (
                                        <ActivityIndicator color="white" />
                                    ) : (
                                        <>
                                            <Sparkles size={18} color="white" />
                                            <Text className="text-white font-bold">Draft Plan</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    </MotiView>
                ) : step === 'form' ? (
                    <MotiView 
                        key="form"
                        from={{ opacity: 0, translateX: -20 }}
                        animate={{ opacity: 1, translateX: 0 }}
                        className="flex-1 px-6 pt-8"
                    >
                         <Text className="text-white text-lg font-bold mb-2">More details needed</Text>
                         <View className="bg-slate-900 p-6 rounded-3xl border border-slate-800">
                             <Text className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Selected Days</Text>
                             <View className="flex-row flex-wrap gap-2 mb-6">
                                 {formDates.map(day => (
                                     <View key={day} className="bg-blue-600/10 border border-blue-500/20 px-3 py-1.5 rounded-full flex-row items-center gap-2">
                                         <Calendar size={12} color="#3B82F6" />
                                         <Text className="text-blue-400 text-xs font-medium capitalize">{day}</Text>
                                     </View>
                                 ))}
                             </View>
                             <TextInput
                                className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white text-base mb-6"
                                placeholder="e.g. 10:00 AM"
                                placeholderTextColor="#475569"
                                value={formTime}
                                onChangeText={setFormTime}
                             />
                             <TouchableOpacity className="bg-blue-600 py-4 rounded-2xl items-center" onPress={handleAnalyze}>
                                <Text className="text-white font-bold text-lg">Validate Plan</Text>
                             </TouchableOpacity>
                         </View>
                    </MotiView>
                ) : (
                    <MotiView 
                        key="review"
                        from={{ opacity: 0, translateX: -20 }}
                        animate={{ opacity: 1, translateX: 0 }}
                        className="flex-1 px-6 pt-8"
                    >
                        <Text className="text-white text-lg font-bold mb-2">Review Schedule</Text>
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
                                                className="mt-4 bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl flex-row items-center gap-3"
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
                             <TouchableOpacity className="bg-blue-600 py-4 rounded-2xl items-center" onPress={handleFinalConfirm}>
                                <Text className="text-white font-bold text-lg">Send Session Invites</Text>
                             </TouchableOpacity>
                        </View>
                    </MotiView>
                )}
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
