import React, { useState, useRef } from 'react';
import { View, Text, Modal, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, Alert, Platform, SafeAreaView } from 'react-native';
import { MotiView, AnimatePresence } from 'moti';
import { X, Mic, Send, Calendar, Clock, Check, AlertTriangle, Pencil, Trash2, Save, Repeat, Sparkles, ChevronLeft, Info, Activity } from 'lucide-react-native';
import { useTheme } from '@/contexts/BrandContext';
import { parseScheduleRequest, ProposedSession, RateLimitError, extractSchedulingIntent, extractAgendaContext, AgendaContext } from '@/lib/ai-scheduling-service';
import { Session } from '@/types/database';
import ConflictResolutionModal from './ConflictResolutionModal';
import { ConflictInfo, Resolution } from '@/types/conflict';
import { findAvailableSlots } from '@/lib/time-slot-finder';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { BrandedAvatar } from '@/components/BrandedAvatar';
import { useEffect, useMemo } from 'react';

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
    reschedulingMessageId?: string | null;
}

export default function SchedulerModal({ visible, onClose, onConfirm, clientContext, existingSessions, targetClientId, reschedulingMessageId }: SchedulerModalProps) {
    const { coach, profile } = useAuth();
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [proposedSessions, setProposedSessions] = useState<ProposedSession[]>([]);
    const [step, setStep] = useState<'input' | 'form' | 'review'>('input');

    // Agenda state
    const [agendaSessions, setAgendaSessions] = useState<any[]>([]);
    const [agendaLoading, setAgendaLoading] = useState(false);
    const [isAgendaThinking, setIsAgendaThinking] = useState(false);
    const [agendaContext, setAgendaContext] = useState<AgendaContext>({ days: [], times: [] });
    
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

    // Fetch all coach sessions for the agenda
    useEffect(() => {
        if (visible && coach?.id) {
            fetchAgenda();
            
            // Realtime subscription
            const channel = supabase
                .channel('coach_agenda_sync')
                .on('postgres_changes', { 
                    event: '*', 
                    schema: 'public', 
                    table: 'sessions',
                    filter: `coach_id=eq.${coach.id}`
                }, () => {
                    fetchAgenda();
                })
                .subscribe();

            return () => {
                supabase.removeChannel(channel);
            };
        }
    }, [visible, coach?.id]);

    const fetchAgenda = async () => {
        if (!coach?.id) return;
        setAgendaLoading(true);
        try {
            const { data, error } = await supabase
                .from('sessions')
                .select(`
                    *,
                    client:clients(
                        id,
                        profiles:profiles(
                            full_name,
                            avatar_url
                        )
                    )
                `)
                .eq('coach_id', coach.id)
                .neq('status', 'cancelled')
                .order('scheduled_at', { ascending: true });

            if (error) throw error;
            setAgendaSessions(data || []);
        } catch (err) {
            console.error('[SchedulerModal] Error fetching agenda:', err);
        } finally {
            setAgendaLoading(false);
        }
    };

    // AI-driven agenda context debouncer
    const lastProcessedInput = useRef('');

    useEffect(() => {
        if (step !== 'input') return;
        
        const timeout = setTimeout(async () => {
            const trimmed = input.trim();
            if (trimmed.length > 8 && trimmed !== lastProcessedInput.current) {
                lastProcessedInput.current = trimmed;
                setIsAgendaThinking(true);
                try {
                    const context = await extractAgendaContext(trimmed);
                    setAgendaContext(context);
                } catch (e) {
                    console.warn('Agenda filter skip (Rate Limit)', e);
                } finally {
                    setIsAgendaThinking(false);
                }
            } else if (trimmed.length <= 8) {
                setAgendaContext({ days: [], times: [] });
                setIsAgendaThinking(false);
                lastProcessedInput.current = '';
            }
        }, 2000); // 2s debounce to protect API quota
        return () => clearTimeout(timeout);
    }, [input, step]);

    // Smart filtering logic for the agenda
    const filteredAgenda = useMemo(() => {
        if (!agendaSessions.length) return [];
        const now = new Date();
        const { days, times } = agendaContext;
        
        const isFiltering = days.length > 0 || times.length > 0;

        return agendaSessions.filter(s => {
            const d = new Date(s.scheduled_at);
            const dayName = d.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
            const sessionClientId = s.client_id;
            const isTargetClient = sessionClientId === clientContext?.id;

            // 1. Always show target client sessions if we are filtering by day/time
            if (isFiltering) {
                const matchesDay = days.length > 0 ? days.includes(dayName) : true;
                
                // If specific times are mentioned, show target client sessions for those days
                if (isTargetClient && matchesDay) return true;

                // 2. Conflict Detection for other clients:
                // Only show other clients if they are on the mentioned days AND within +/- 1 hour of mentioned times
                if (!isTargetClient && matchesDay && times.length > 0) {
                    const sessionHour = d.getHours();
                    const sessionMin = d.getMinutes();
                    const sessionTotalMin = sessionHour * 60 + sessionMin;

                    return times.some(t => {
                        const [h, m] = t.split(':').map(Number);
                        const targetTotalMin = h * 60 + m;
                        return Math.abs(sessionTotalMin - targetTotalMin) <= 60; // +/- 1 hour window
                    });
                }

                return false;
            }
            
            // Default: Show target client sessions for next 3 days OR next 3 days of all sessions if no context
            const threeDaysFromNow = new Date();
            threeDaysFromNow.setDate(now.getDate() + 3);
            threeDaysFromNow.setHours(23, 59, 59, 999);

            if (isTargetClient) return d >= now; // Show all upcoming for target client by default
            return d >= now && d <= threeDaysFromNow;
        });
    }, [agendaSessions, agendaContext, clientContext]);

    // Rough parser to detect conflicts while typing (before AI draft)
    const draftStartTime = useMemo(() => {
        if (!input.trim() || input.length < 5) return null;
        const inputLower = input.toLowerCase();
        
        // Find date
        let date = new Date();
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
        const dayMap: {[key: string]: number} = {sun:0, mon:1, tue:2, wed:3, thu:4, fri:5, sat:6, sunday:0, monday:1, tuesday:2, wednesday:3, thursday:4, friday:5, saturday:6};
        
        let foundDate = false;
        if (inputLower.includes('today')) {
            foundDate = true;
        } else if (inputLower.includes('tomorrow')) {
            date.setDate(date.getDate() + 1);
            foundDate = true;
        } else {
            const foundDay = days.find(d => inputLower.includes(d));
            if (foundDay) {
                const targetDay = dayMap[foundDay];
                const currentDay = date.getDay();
                let diff = targetDay - currentDay;
                if (diff < 0) diff += 7;
                date.setDate(date.getDate() + diff);
                foundDate = true;
            }
        }

        if (!foundDate) return null;

        // Find time: e.g. "at 10am", "2:30pm", "14:00"
        const timeMatch = inputLower.match(/(\d+)(?::(\d+))?\s*(am|pm)/);
        if (timeMatch) {
            let hours = parseInt(timeMatch[1], 10);
            const minutes = parseInt(timeMatch[2] || '0', 10);
            const ampm = timeMatch[3];
            if (ampm === 'pm' && hours < 12) hours += 12;
            if (ampm === 'am' && hours === 12) hours = 0;
            date.setHours(hours, minutes, 0, 0);
            return date;
        }
        return null;
    }, [input]);

    const draftConflict = useMemo(() => {
        if (!draftStartTime) return null;
        const dEnd = new Date(draftStartTime.getTime() + 60 * 60000); // assume 60m
        const sessionsToCheck = agendaSessions.length > 0 ? agendaSessions : existingSessions;

        for (const existing of sessionsToCheck) {
            if (existing.status === 'cancelled') continue;
            const existingStart = new Date(existing.scheduled_at);
            const existingEnd = new Date(existingStart.getTime() + (existing.duration_minutes || 60) * 60000);

            // 1. Absolute Daily Singularity check (Same Client, Same Day)
            if (existing.client_id === targetClientId && draftStartTime.toDateString() === existingStart.toDateString()) {
                return {
                    type: 'daily_limit',
                    message: `Conflict Detected: ${clientContext.name} already has a session on ${draftStartTime.toLocaleDateString('en-US', { weekday: 'long' })} at ${existingStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`
                };
            }

            // 2. Coach overlap check
            if (draftStartTime < existingEnd && dEnd > existingStart) {
                return {
                    type: 'time_conflict',
                    message: `Conflict: You already have a session at this time with ${existing.client?.profiles?.full_name || 'another client'}.`
                };
            }
        }
        return null;
    }, [draftStartTime, agendaSessions, existingSessions, targetClientId, clientContext]);

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
            const lowerInput = input.toLowerCase();
            const hasRecurringKeyword = ["every", "weekly", "monthly", "each", "repeatedly"].some(k => lowerInput.includes(k));
            const hasOneTimeKeyword = ["this", "once", "on", "today", "tomorrow"].some(k => lowerInput.includes(k));
            const wasAiDetected = hasRecurringKeyword || hasOneTimeKeyword;

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
                newRecurrence || 'once',
                wasAiDetected
            );
        } catch (error) {
            console.error('Error in handleAnalyze:', error);
            Alert.alert('Error', 'Failed to analyze request.');
        } finally {
            setLoading(false);
        }
    };

    // Builds a full UTC ISO string from a local date string + a human time string like "1:00 PM" or "13:00"
    const buildISODateTime = (isoDate: string, timeStr: string): string | null => {
        const timeMatch = timeStr.toLowerCase().match(/(\d+)(?::(\d+))?\s*(am|pm)?/);
        if (!timeMatch) return null;

        let hours = parseInt(timeMatch[1], 10);
        const minutes = parseInt(timeMatch[2] || '0', 10);
        const ampm = timeMatch[3];

        if (ampm === 'pm' && hours < 12) hours += 12;
        if (ampm === 'am' && hours === 12) hours = 0;
        if (!ampm && hours < 7) hours += 12; // Treat bare "1" as 1pm if under 7

        // Build as local time to avoid timezone shift
        const [year, month, day] = isoDate.split('-').map(Number);
        const date = new Date(year, month - 1, day, hours, minutes, 0, 0);
        return date.toISOString();
    };

    const finalizeWithAI = async (sessionIntents: { date: string, time: string | null }[], recurrence: 'weekly' | 'once', aiDetected = false) => {
        setLoading(true);
        try {
            const allSessions: ProposedSession[] = [];

            for (const intent of sessionIntents) {
                if (!intent.date || !intent.time) continue;

                const isoDate = resolveDateKeywordToISO(intent.date, intent.time);
                const scheduledAt = buildISODateTime(isoDate, intent.time);

                if (!scheduledAt) {
                    console.warn('[finalizeWithAI] Could not parse time for intent:', intent);
                    continue;
                }

                allSessions.push({
                    scheduled_at: scheduledAt,
                    duration_minutes: 60,
                    session_type: 'training',
                    notes: `AI scheduled session for ${clientContext?.name || 'Athlete'}`,
                    recurrence,
                    day_of_week: new Date(isoDate).toLocaleDateString('en-US', { weekday: 'long' }),
                    aiRecurrenceDetected: aiDetected,
                });
            }

            if (allSessions.length > 0) {
                setProposedSessions(allSessions as any);
                setStep('review');
            } else {
                Alert.alert('No Sessions', 'Could not build sessions from the given info. Please try again.');
            }
        } catch (error) {
            console.error('[finalizeWithAI] Error:', error);
            Alert.alert('Error', 'Failed to build sessions. Please try again.');
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
        const duration = proposed.duration_minutes || 60;
        
        // Use the internally fetched agendaSessions for accurate conflict detection
        const sessionsToCheck = agendaSessions.length > 0 ? agendaSessions : existingSessions;

        // If weekly, check the next 8 weeks
        const occurrences = proposed.recurrence === 'weekly' ? 8 : 1;

        for (let i = 0; i < occurrences; i++) {
            const currentOccurrenceStart = new Date(proposedStart.getTime() + i * 7 * 24 * 60 * 60 * 1000);
            const currentOccurrenceEnd = new Date(currentOccurrenceStart.getTime() + duration * 60000);

            for (const existing of sessionsToCheck) {
                if (existing.status === 'cancelled') continue;
                const existingStart = new Date(existing.scheduled_at);
                const existingEnd = new Date(existingStart.getTime() + (existing.duration_minutes || 60) * 60000);

                // --- 1. Daily Singularity Conflict (Same Client, Same Day) ---
                const sameClient = existing.client_id === targetClientId;
                const sameDay = currentOccurrenceStart.toDateString() === existingStart.toDateString();
                
                if (sameClient && sameDay) {
                    return {
                        type: 'daily_limit',
                        message: `Conflict Detected: ${clientContext.name} already has a session on ${currentOccurrenceStart.toLocaleDateString('en-US', { weekday: 'long' })} at ${existingStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`,
                        existingSession: {
                            id: existing.id,
                            client_id: existing.client_id,
                            client_name: clientContext.name,
                            scheduled_at: existing.scheduled_at,
                            duration_minutes: existing.duration_minutes,
                            session_type: existing.session_type,
                            recurrence: existing.recurrence_rule ? 'weekly' : 'once'
                        },
                        proposedSession: {
                            client_id: targetClientId,
                            client_name: clientContext.name,
                            scheduled_at: currentOccurrenceStart.toISOString(),
                            duration_minutes: duration,
                            session_type: proposed.session_type,
                            recurrence: proposed.recurrence as any,
                            day_of_week: proposed.day_of_week
                        },
                        recommendations: []
                    };
                }

                // --- 2. Time Overlap Conflict (General, Coach Time Overlap) ---
                if (currentOccurrenceStart < existingEnd && currentOccurrenceEnd > existingStart) {
                    return {
                        type: 'time_conflict',
                        message: i === 0 
                            ? `Conflict with ${existing.client?.profiles?.full_name || 'another session'}`
                            : `Conflict in week ${i + 1} with ${existing.client?.profiles?.full_name || 'another session'}`,
                        existingSession: {
                            id: existing.id,
                            client_id: existing.client_id,
                            client_name: existing.client?.profiles?.full_name || 'Unknown Client',
                            scheduled_at: existing.scheduled_at,
                            duration_minutes: existing.duration_minutes,
                            session_type: existing.session_type,
                            recurrence: existing.recurrence_rule ? 'weekly' : 'once'
                        },
                        proposedSession: {
                            client_id: targetClientId,
                            client_name: clientContext.name,
                            scheduled_at: currentOccurrenceStart.toISOString(),
                            duration_minutes: duration,
                            session_type: proposed.session_type,
                            recurrence: proposed.recurrence as any,
                            day_of_week: proposed.day_of_week
                        },
                        recommendations: []
                    };
                }
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

    const handleFinalConfirm = async (bypassConfirmation = false) => {
        if (!coach?.id) return;

        // Check if there is any daily singularity conflict
        const dailySingularityConflict = proposedSessions
            .map(s => checkConflict(s))
            .find(c => c && c.type === 'daily_limit');

        if (dailySingularityConflict && !bypassConfirmation) {
            const isExistingRecurrent = dailySingularityConflict.existingSession.recurrence === 'weekly';
            const sessionTypeLabel = isExistingRecurrent ? 'Recurrent' : 'One-Time';

            Alert.alert(
                'Replace Session?',
                `This will replace the existing ${sessionTypeLabel} session. Proceed?`,
                [
                    { text: 'Cancel', style: 'cancel' },
                    { 
                        text: 'Proceed', 
                        onPress: () => handleFinalConfirm(true) // Confirmed, bypass check
                    }
                ]
            );
            return;
        }

        setLoading(true);
        try {
            const sessionsToInsert = [];
            const idsToDelete = [];
            const idsToCancel = [];

            // If we confirmed the replacement, execute the Replacement Protocol
            if (dailySingularityConflict) {
                const existing = dailySingularityConflict.existingSession;
                const isExistingRecurrent = existing.recurrence === 'weekly';

                if (isExistingRecurrent) {
                    // Recurrent: Exception Overlay -> cancel this specific date's session
                    idsToCancel.push(existing.id);
                } else {
                    // One-Time: DELETE the old session
                    idsToDelete.push(existing.id);
                }
            }
            
            for (const proposed of proposedSessions) {
                const recurrenceRule = proposed.recurrence === 'weekly' ? `FREQ=WEEKLY;BYDAY=${proposed.day_of_week?.substring(0, 2).toUpperCase()}` : null;
                
                // Create multiple instances if recurring (next 8 weeks)
                const occurrences = proposed.recurrence === 'weekly' ? 8 : 1;
                const startDate = new Date(proposed.scheduled_at);
                
                for (let i = 0; i < occurrences; i++) {
                    const scheduledAt = new Date(startDate.getTime() + i * 7 * 24 * 60 * 60 * 1000);
                    sessionsToInsert.push({
                        coach_id: coach.id,
                        client_id: targetClientId,
                        scheduled_at: scheduledAt.toISOString(),
                        duration_minutes: proposed.duration_minutes || 60,
                        session_type: proposed.session_type || 'training',
                        status: 'scheduled',
                        is_locked: true,
                        ai_generated: true,
                        meet_link: `https://meet.jit.si/${coach.id}-${targetClientId}-${Date.now()}-${Math.random().toString(36).substring(7)}`,
                        notes: proposed.notes || `AI Scheduled session for ${clientContext?.name || 'Athlete'}`,
                        recurrence_rule: i === 0 ? recurrenceRule : null // Store RRULE on the first instance
                    });
                }
            }

            // Perform DELETEs for One-Time replacements
            if (idsToDelete.length > 0) {
                const { error: deleteError } = await supabase
                    .from('sessions')
                    .delete()
                    .in('id', idsToDelete);
                if (deleteError) throw deleteError;
            }

            // Perform UPDATE status to 'cancelled' for Recurrent exception overlays
            if (idsToCancel.length > 0) {
                const { error: cancelError } = await supabase
                    .from('sessions')
                    .update({ status: 'cancelled', notes: 'Exception Overlay Cancelled' })
                    .in('id', idsToCancel);
                if (cancelError) throw cancelError;
            }

            const { error } = await supabase.from('sessions').insert(sessionsToInsert);
            if (error) throw error;

            // If we are rescheduling an existing invite, update the original message
            if (reschedulingMessageId) {
                const { data: originalMsg } = await supabase
                    .from('messages')
                    .select('content')
                    .eq('id', reschedulingMessageId)
                    .single();
                
                if (originalMsg) {
                    try {
                        const p = JSON.parse(originalMsg.content);
                        const updatedContent = JSON.stringify({
                            ...p,
                            status: 'rescheduled'
                        });
                        await supabase
                            .from('messages')
                            .update({ content: updatedContent })
                            .eq('id', reschedulingMessageId);
                    } catch (e) {
                        console.error('[SchedulerModal] Error updating original message:', e);
                    }
                }
            }

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
                    <TouchableOpacity 
                        onPress={() => {
                            const hasAnyProgress = input.trim().length > 0 || proposedSessions.length > 0 || formDates.length > 0 || formTime.length > 0;
                            if (hasAnyProgress) {
                                Alert.alert(
                                    "Discard Draft?",
                                    "You will lose any progress made in this session. Are you sure you want to exit?",
                                    [
                                        { text: "Cancel", style: "cancel" },
                                        { text: "Exit", style: "destructive", onPress: () => { resetForm(); onClose(); } }
                                    ]
                                );
                            } else {
                                resetForm();
                                onClose();
                            }
                        }} 
                        style={{ padding: 8, backgroundColor: '#0F172A', borderRadius: 9999 }}
                    >
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
                        <ScrollView className="flex-1 px-6 pt-8" showsVerticalScrollIndicator={false} style={{ overflow: 'visible' }} contentContainerStyle={{ overflow: 'visible' }}>
                            <View className="p-8 rounded-[40px] bg-blue-600/10 border border-blue-500/20 items-center mb-8">
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
                                {draftConflict && (
                                    <MotiView
                                        from={{ opacity: 0, translateY: 10 }}
                                        animate={{ opacity: 1, translateY: 0 }}
                                        className="mt-4 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex-row items-center gap-3"
                                    >
                                        <AlertTriangle size={18} color="#EF4444" />
                                        <Text className="text-red-400 text-xs font-bold flex-1 leading-4">{draftConflict.message}</Text>
                                    </MotiView>
                                )}
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
                            {/* Coach Agenda Section */}
                            <View className="mb-12">
                                <View className="flex-row items-center justify-between mb-4">
                                    <View className="flex-row items-center gap-3">
                                        <Text className="text-white text-lg font-black tracking-tight">Your Agenda</Text>
                                        {isAgendaThinking && (
                                            <MotiView
                                                from={{ opacity: 0, scale: 0.5, rotate: '0deg' }}
                                                animate={{ opacity: 1, scale: 1, rotate: '360deg' }}
                                                transition={{
                                                    opacity: { type: 'timing', duration: 300 },
                                                    scale: { type: 'spring', damping: 10 },
                                                    rotate: { type: 'timing', duration: 2000, loop: true, ease: 'linear' }
                                                }}
                                                className="w-6 h-6 rounded-full bg-blue-600/20 border border-blue-500/30 items-center justify-center"
                                            >
                                                <Sparkles size={12} color="#3B82F6" fill="#3B82F6" />
                                            </MotiView>
                                        )}
                                    </View>
                                    <View className="px-3 py-1 bg-blue-500/10 rounded-full border border-blue-500/20">
                                        <Text className="text-blue-400 text-[10px] font-black uppercase tracking-widest">
                                            {isAgendaThinking ? "Thinking..." : (agendaContext.days.length > 0 || agendaContext.times.length > 0 ? "Filtered" : "Next 3 Days")}
                                        </Text>
                                    </View>
                                </View>

                                {agendaLoading && agendaSessions.length === 0 ? (
                                    <ActivityIndicator size="small" color="#3B82F6" className="py-4" />
                                ) : filteredAgenda.length > 0 ? (
                                    <View className="gap-3">
                                        {filteredAgenda.map((session, idx) => {
                                            const sessionDate = new Date(session.scheduled_at);
                                            const isFar = sessionDate.getTime() - new Date().getTime() > 24 * 60 * 60 * 1000;
                                            
                                            // Simple conflict check for pulse
                                            const sStart = new Date(session.scheduled_at);
                                            const sEnd = new Date(sStart.getTime() + (session.duration_minutes || 60) * 60000);
                                            
                                            // 1. Check against finalized proposed sessions
                                            let isConflicted = proposedSessions.some(p => {
                                                const pStart = new Date(p.scheduled_at);
                                                const pEnd = new Date(pStart.getTime() + (p.duration_minutes || 60) * 60000);
                                                return pStart < sEnd && pEnd > sStart;
                                            });

                                            // 2. Also check against current "draft" being typed
                                            if (!isConflicted && draftStartTime) {
                                                const dEnd = new Date(draftStartTime.getTime() + 60 * 60000); // assume 60m for draft check
                                                if (draftStartTime < sEnd && dEnd > sStart) {
                                                    isConflicted = true;
                                                }
                                            }

                                            return (
                                                <MotiView
                                                    key={session.id}
                                                    from={{ opacity: isFar ? 0.3 : 1, scale: 1, borderColor: 'rgba(255,255,255,0.05)', borderWidth: 1 }}
                                                    animate={{ 
                                                        opacity: isFar ? 0.3 : 1,
                                                        borderColor: isConflicted ? '#EF4444' : 'rgba(255,255,255,0.05)',
                                                        borderWidth: 1,
                                                        scale: isConflicted ? [1, 1.02, 1] : 1,
                                                        backgroundColor: isConflicted ? 'rgba(239, 68, 68, 0.05)' : 'rgba(15, 23, 42, 0.4)'
                                                    }}
                                                    transition={isConflicted ? {
                                                        type: 'timing',
                                                        duration: 1000,
                                                        loop: true
                                                    } : { type: 'timing', duration: 300 }}
                                                    className="p-4 rounded-2xl flex-row items-center justify-between"
                                                >
                                                    <View className="flex-row items-center gap-4 flex-1">
                                                        <View className={`w-10 h-10 rounded-xl items-center justify-center ${isConflicted ? 'bg-red-500/10' : 'bg-slate-800'}`}>
                                                            {isConflicted ? (
                                                                <AlertTriangle size={18} color="#EF4444" />
                                                            ) : (
                                                                <Calendar size={18} color="#94A3B8" />
                                                            )}
                                                        </View>
                                                        <View className="flex-1">
                                                            <View className="flex-row items-center justify-between pr-2">
                                                                <Text className="text-white font-bold text-sm">
                                                                    {session.client?.profiles?.full_name || 'Client'}
                                                                </Text>
                                                                {isConflicted && (
                                                                    <View className="flex-row items-center gap-1">
                                                                        <Activity size={10} color="#EF4444" />
                                                                        <Text className="text-[10px] font-black text-red-500 uppercase tracking-widest">Conflict</Text>
                                                                    </View>
                                                                )}
                                                            </View>
                                                            <Text className="text-slate-500 text-[11px] font-bold mt-0.5">
                                                                {sessionDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} • {sessionDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </Text>
                                                        </View>
                                                    </View>
                                                </MotiView>
                                            );
                                        })}
                                    </View>
                                ) : (
                                    <View className="py-12 items-center bg-slate-900/20 rounded-[32px] border border-dashed border-slate-800 px-8">
                                        <View className="w-16 h-16 bg-slate-800/50 rounded-2xl items-center justify-center mb-4">
                                            <Calendar size={32} color="#475569" />
                                        </View>
                                        <Text className="text-white text-base font-black tracking-tight text-center">Your schedule is clear</Text>
                                        <Text className="text-slate-500 text-xs font-medium mt-2 text-center leading-5">
                                            No sessions match your current request or target client. You're free to schedule!
                                        </Text>
                                    </View>
                                )}
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
                            <ScrollView showsVerticalScrollIndicator={false} style={{ overflow: 'visible' }} contentContainerStyle={{ overflow: 'visible' }}>
                                <View className="mb-8 flex-row items-center gap-4">
                                    <View className="w-12 h-12 bg-amber-500/10 rounded-2xl items-center justify-center border border-amber-500/20">
                                        <Info size={24} color="#F59E0B" />
                                    </View>
                                    <View className="flex-1">
                                        <Text className="text-white text-xl font-black tracking-tight leading-7">
                                            {originallyMissingDays && originallyMissingTime ? "Days & Time Needed" : 
                                             originallyMissingDays ? "You didn't mention the days" :
                                             originallyMissingTime ? "You didn't mention the time" : "Details Needed"}
                                        </Text>
                                        <Text className="text-slate-500 text-xs font-medium mt-1">
                                            Help the AI by clarifying these specific details below.
                                        </Text>
                                    </View>
                                </View>

                                <View className="bg-slate-900/50 p-7 rounded-[32px] border border-slate-800">
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
                                                                fontSize: 13,
                                                                fontWeight: '800',
                                                                textTransform: 'capitalize'
                                                            }}>{day.substring(0, 3)}</Text>
                                                        </TouchableOpacity>
                                                    );
                                                })}
                                            </View>
                                        </View>
                                    )}

                                    {originallyMissingTime && (
                                        <View className="mb-8">
                                            <Text className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-4">Time Needed</Text>
                                            <TextInput
                                                className="bg-slate-950 p-5 rounded-2xl text-white font-bold border border-slate-800"
                                                placeholder="e.g., '10am' or '2:30pm'"
                                                placeholderTextColor="#334155"
                                                value={formTime}
                                                onChangeText={setFormTime}
                                            />
                                        </View>
                                    )}

                                    <Text className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-4">Frequency</Text>
                                    <View className="flex-row gap-3">
                                        <TouchableOpacity 
                                            onPress={() => setFormRecurrence('once')}
                                            className={`flex-1 p-5 rounded-2xl border flex-row items-center justify-center gap-3 ${formRecurrence === 'once' ? 'bg-blue-600 border-blue-500' : 'bg-slate-950 border-slate-800'}`}
                                        >
                                            <Calendar size={18} color={formRecurrence === 'once' ? 'white' : '#475569'} />
                                            <Text className={`font-bold text-sm ${formRecurrence === 'once' ? 'text-white' : 'text-slate-500'}`}>One-time</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity 
                                            onPress={() => setFormRecurrence('weekly')}
                                            className={`flex-1 p-5 rounded-2xl border flex-row items-center justify-center gap-3 ${formRecurrence === 'weekly' ? 'bg-blue-600 border-blue-500' : 'bg-slate-950 border-slate-800'}`}
                                        >
                                            <Repeat size={18} color={formRecurrence === 'weekly' ? 'white' : '#475569'} />
                                            <Text className={`font-bold text-sm ${formRecurrence === 'weekly' ? 'text-white' : 'text-slate-500'}`}>Weekly</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                <TouchableOpacity 
                                    className="mt-8 bg-blue-600 p-6 rounded-[28px] items-center flex-row justify-center gap-3 shadow-xl shadow-blue-500/30"
                                    onPress={handleAnalyze}
                                >
                                    <Sparkles size={20} color="white" />
                                    <Text className="text-white font-black text-base uppercase tracking-widest">Re-Draft Plan</Text>
                                </TouchableOpacity>
                            </ScrollView>
                        </MotiView>
                    ) : (
                        <MotiView 
                            key="review"
                            from={{ opacity: 0, translateX: -20 }}
                            animate={{ opacity: 1, translateX: 0 }}
                            exit={{ opacity: 0, translateX: 20 }}
                            transition={{ type: 'timing', duration: 300 }}
                            className="flex-1 px-6 pt-8 pb-32"
                            style={{ overflow: 'visible' }}
                        >
                            <View className="mb-8 flex-row items-center gap-4">
                                <View className="w-12 h-12 bg-green-500/10 rounded-2xl items-center justify-center border border-green-500/20">
                                    <Check size={24} color="#10B981" />
                                </View>
                                <View className="flex-1">
                                    <Text className="text-white text-xl font-black tracking-tight leading-7">Review Schedule</Text>
                                    <Text className="text-slate-500 text-xs font-medium mt-1">
                                        I've drafted {proposedSessions.length} session{proposedSessions.length !== 1 ? 's' : ''} based on your request.
                                    </Text>
                                </View>
                            </View>

                            <ScrollView className="flex-1" showsVerticalScrollIndicator={false} style={{ overflow: 'visible' }} contentContainerStyle={{ overflow: 'visible' }}>
                                {proposedSessions.some(s => checkConflict(s)?.type === 'daily_limit') && (
                                    <View className="mb-6 p-5 rounded-[28px] bg-blue-600/10 border border-blue-500/20 flex-row gap-4 items-start">
                                        <View className="w-10 h-10 rounded-xl bg-blue-600/20 items-center justify-center border border-blue-500/30">
                                            <Sparkles size={20} color="#3B82F6" fill="#3B82F6" />
                                        </View>
                                        <View className="flex-1">
                                            <Text className="text-white text-sm font-black tracking-tight">AI Assistant Tip</Text>
                                            <Text className="text-slate-300 text-xs font-medium mt-1 leading-5">
                                                {(() => {
                                                    const conf = proposedSessions.map(s => checkConflict(s)).find(c => c && c.type === 'daily_limit');
                                                    if (!conf) return '';
                                                    const proposedTime = new Date(conf.proposedSession.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                                    const proposedDay = new Date(conf.proposedSession.scheduled_at).toLocaleDateString('en-US', { weekday: 'long' });
                                                    const existingTime = new Date(conf.existingSession.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                                    return `I've drafted that for ${proposedDay} at ${proposedTime}, but I noticed ${clientContext.name.split(' ')[0]} already has a ${existingTime} sync. I'll swap them once you hit send.`;
                                                })()}
                                            </Text>
                                        </View>
                                    </View>
                                )}
                                {proposedSessions.map((session, index) => {
                                    const conflict = checkConflict(session);
                                    const isNeuralGlow = session.aiRecurrenceDetected;

                                    return (
                                        <View key={index} className="relative mb-6" style={{ overflow: 'visible' }}>
                                            {isNeuralGlow && (
                                                <MotiView
                                                    from={{ opacity: 0.1, scale: 0.98 }}
                                                    animate={{ opacity: [0.1, 0.2, 0.1], scale: [0.98, 1, 0.98] }}
                                                    transition={{ loop: true, duration: 2000 }}
                                                    style={{
                                                        position: 'absolute',
                                                        top: -2,
                                                        left: -2,
                                                        right: -2,
                                                        bottom: -2,
                                                        borderRadius: 34,
                                                        backgroundColor: '#3B82F6',
                                                        zIndex: -1
                                                    }}
                                                />
                                            )}
                                            <View className={`bg-slate-900 p-6 rounded-[32px] border ${conflict ? 'border-red-500/50' : 'border-slate-800'}`}>
                                                <View className="flex-row justify-between items-start mb-6">
                                                    <View className="flex-row gap-4 flex-1">
                                                        <View className={`w-12 h-12 rounded-2xl items-center justify-center border ${conflict ? 'bg-red-500/10 border-red-500/20' : 'bg-blue-600/10 border-blue-500/10'}`}>
                                                            {conflict ? (
                                                                <AlertTriangle size={24} color="#EF4444" />
                                                            ) : (
                                                                <Clock size={24} color="#3B82F6" />
                                                            )}
                                                        </View>
                                                        <View className="flex-1">
                                                            <Text className="text-white font-black text-lg tracking-tight capitalize">
                                                                {session.session_type}
                                                            </Text>
                                                            <Text className="text-slate-400 text-sm mt-0.5 font-medium capitalize">
                                                                {session.day_of_week}, {' '}{new Date(session.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </Text>
                                                        </View>
                                                    </View>
                                                    <TouchableOpacity 
                                                        className="w-8 h-8 rounded-full bg-slate-800 items-center justify-center"
                                                        onPress={() => setProposedSessions(prev => prev.filter((_, i) => i !== index))}
                                                    >
                                                        <X size={16} color="#94A3B8" />
                                                    </TouchableOpacity>
                                                </View>

                                                <View className="flex-row bg-slate-950 p-1.5 rounded-2xl border border-slate-800/50">
                                                    <TouchableOpacity 
                                                        onPress={() => {
                                                            const newSessions = [...proposedSessions];
                                                            newSessions[index] = { ...session, recurrence: 'once', aiRecurrenceDetected: false };
                                                            setProposedSessions(newSessions);
                                                        }}
                                                        className={`flex-1 py-3.5 rounded-xl items-center justify-center flex-row gap-2 ${session.recurrence === 'once' ? 'bg-slate-800' : ''}`}
                                                    >
                                                        <Calendar size={14} color={session.recurrence === 'once' ? 'white' : '#475569'} />
                                                        <Text className={`text-xs font-black uppercase tracking-widest ${session.recurrence === 'once' ? 'text-white' : 'text-slate-500'}`}>One-time</Text>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity 
                                                        onPress={() => {
                                                            const newSessions = [...proposedSessions];
                                                            newSessions[index] = { ...session, recurrence: 'weekly', aiRecurrenceDetected: false };
                                                            setProposedSessions(newSessions);
                                                        }}
                                                        className={`flex-1 py-3.5 rounded-xl items-center justify-center flex-row gap-2 ${session.recurrence === 'weekly' ? 'bg-slate-800' : ''}`}
                                                    >
                                                        <Repeat size={14} color={session.recurrence === 'weekly' ? 'white' : '#475569'} />
                                                        <Text className={`text-xs font-black uppercase tracking-widest ${session.recurrence === 'weekly' ? 'text-white' : 'text-slate-500'}`}>Weekly</Text>
                                                    </TouchableOpacity>
                                                </View>

                                                {conflict && (
                                                    <TouchableOpacity 
                                                        className="mt-4 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex-row items-center gap-3"
                                                        onPress={() => handleConflictDetected(session, conflict)}
                                                    >
                                                        <AlertTriangle size={16} color="#EF4444" />
                                                        <Text className="text-red-400 text-xs font-bold flex-1 leading-4">Conflict: {conflict.message}</Text>
                                                        <ChevronLeft size={16} color="#EF4444" style={{ transform: [{ rotate: '180deg' }] }} />
                                                    </TouchableOpacity>
                                                )}
                                            </View>
                                        </View>
                                    );
                                })}
                            </ScrollView>

                            <View className="absolute bottom-0 left-0 right-0 p-8 pt-0 bg-[#020617]">
                                <TouchableOpacity 
                                    className="bg-blue-600 p-6 rounded-[32px] items-center flex-row justify-center gap-3 shadow-2xl shadow-blue-500/50"
                                    onPress={handleFinalConfirm}
                                >
                                    <Send size={20} color="white" />
                                    <Text className="text-white font-black text-lg uppercase tracking-widest">
                                        Send {proposedSessions.length} Session Invite{proposedSessions.length !== 1 ? 's' : ''}
                                    </Text>
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
