import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { X, Mic, Send, Calendar, Clock, Check, AlertTriangle, Pencil, Trash2, Save, Repeat } from 'lucide-react-native';
import { useTheme } from '@/contexts/BrandContext';
import { parseScheduleRequest, ProposedSession, RateLimitError, extractSchedulingIntent } from '@/lib/ai-scheduling-service';
import { Session } from '@/types/database';
import ConflictResolutionModal from './ConflictResolutionModal';
import ManualSchedulerModal from './ManualSchedulerModal';
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
    const theme = useTheme();
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [proposedSessions, setProposedSessions] = useState<ProposedSession[]>([]);
    const [step, setStep] = useState<'input' | 'form' | 'review'>('input');
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editForm, setEditForm] = useState<ProposedSession | null>(null);
    
    // Form state for structured input
    const [formTime, setFormTime] = useState('');
    const [formDates, setFormDates] = useState<string[]>([]); // Changed to array for multiple dates
    const [formRecurrence, setFormRecurrence] = useState<'once' | 'weekly' | null>(null);

    // Conflict resolution state
    const [conflictInfo, setConflictInfo] = useState<ConflictInfo | null>(null);
    const [showConflictModal, setShowConflictModal] = useState(false);
    
    // Manual scheduling mode
    const [showManualMode, setShowManualMode] = useState(false);
    const { coach } = useAuth();
    
    const resetForm = () => {
        setStep('input');
        setInput('');
        setFormTime('');
        setFormDates([]);
        setFormRecurrence(null);
        setProposedSessions([]);
        setEditingIndex(null);
        setEditForm(null);
        setConflictInfo(null);
        setShowConflictModal(false);
    };

    const formatTimeToHHmm = (isoString: string) => {
        try {
            const date = new Date(isoString);
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        } catch (e) {
            return '';
        }
    };

    const updateSessionTime = (isoString: string, timeStr: string): string => {
        try {
            const date = new Date(isoString);
            const [hours, minutes] = timeStr.split(':').map(Number);
            if (!isNaN(hours) && !isNaN(minutes) && hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
                date.setHours(hours, minutes, 0, 0);
            }
            return date.toISOString();
        } catch (e) {
            return isoString;
        }
    };

    const handleAnalyze = async () => {
        if (!input.trim()) return;

        setLoading(true);
        
        // CRITICAL: Clear previous analysis state for a fresh start to avoid "sticky" fields
        setFormTime('');
        setFormDates([]);
        setFormRecurrence(null);
        setProposedSessions([]);

        try {
            // Use AI to extract intent robustly (handles typos, abbreviations, multiple sessions)
            const intent = await extractSchedulingIntent(input);
            
            // Map NEW sessions to form state (filter out null dates for initial analysis)
            const newDates = intent.sessions.map(s => s.date).filter((d): d is string => d !== null);
            const firstTime = intent.sessions.find(s => s.time !== null)?.time || '';
            const newRecurrence = intent.recurrence;

            // Update form state with whatever was found
            if (firstTime) setFormTime(firstTime);
            if (newDates.length > 0) setFormDates(newDates);
            if (newRecurrence) setFormRecurrence(newRecurrence);

            // Check what we have and what we need
            // needsTime is true if ANY session is missing a time
            const needsDates = newDates.length === 0;
            const needsTime = intent.sessions.length > 0 && intent.sessions.some(s => s.time === null);
            const needsRecurrence = !newRecurrence;

            // If we're missing date or time, show the form
            if (needsDates || needsTime || needsRecurrence) {
                setStep('form');
                return;
            }

            // We have everything, proceed to AI validation
            await finalizeWithAI(
                intent.sessions.filter((s): s is { date: string, time: string | null } => s.date !== null),
                newRecurrence || 'once'
            );
        } catch (error) {
            console.error('Error in handleAnalyze:', error);
            Alert.alert('Error', 'Failed to analyze scheduling request. Please try again.');
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

        // Helper to format local date as YYYY-MM-DD
        const toLocalISO = (date: Date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        if (keyword === 'today') {
             // If time is provided and in the past, maybe warn? But usually 'today' means today.
            return toLocalISO(now);
        } else if (keyword === 'tomorrow') {
            const tomorrow = new Date(now);
            tomorrow.setDate(now.getDate() + 1);
            return toLocalISO(tomorrow);
        } else if (keyword in dayMap) {
            // For day names, resolve to the actual date
            const targetDay = dayMap[keyword];
            const currentDay = now.getDay();
            
            // Calculate basic diff
            let daysToAdd = targetDay - currentDay;
            if (daysToAdd < 0) daysToAdd += 7;
            
            // Same day logic: if today is Monday and user says "Monday"
            if (daysToAdd === 0) {
                 // Check if time is passed
                 if (timeStr) {
                     const [hours, mins] = timeStr.split(':').map(Number);
                     const requestedTime = new Date(now);
                     requestedTime.setHours(hours || 0, mins || 0, 0, 0);
                     
                     // If requested time is earlier than now, assume next week
                     if (requestedTime < now) {
                         daysToAdd = 7;
                     }
                 } else {
                     // No time provided, ambiguous. 
                     // Usually if I say "Monday" on Monday, I mean "next Monday" unless I say "today".
                     // But let's stick to simple logic: if it's SAME day, default to today unless logic says otherwise.
                     // The user complained specifically about past time.
                 }
            }

            const targetDate = new Date(now);
            targetDate.setDate(targetDate.getDate() + daysToAdd);
            return toLocalISO(targetDate);
        }
        
        return keyword; // Fallback
    };

    const finalizeWithAI = async (
        sessionIntents: { date: string, time: string | null }[], 
        recurrence: 'weekly' | 'once'
    ) => {
        setLoading(true);
        try {
            const allSessions: ProposedSession[] = [];
            
            // Create a session for each unique intent
            for (const intent of sessionIntents) {
                // If date is a keyword (monday, today), resolve to ISO
                const isoDate = resolveDateKeywordToISO(intent.date, intent.time);
                
                const result = await parseScheduleRequest({
                    coachInput: `Schedule on ${isoDate} at ${intent.time} ${recurrence === 'weekly' ? 'every week' : 'one time'}`,
                    currentDate: new Date().toLocaleString('en-US', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        timeZoneName: 'short'
                    }),
                    clientContext,
                    currentProposedSessions: proposedSessions,
                    existingSessions: existingSessions,
                });

                if (result.sessions && result.sessions.length > 0) {
                    // Force the recurrence and day_of_week from our intent if AI didn't pick it up
                    const sessionsWithIntent = result.sessions.map(s => ({
                        ...s,
                        recurrence: recurrence, // Always use the form's recurrence
                        day_of_week: s.day_of_week || new Date(isoDate).toLocaleDateString('en-US', { weekday: 'long' })
                    }));
                    allSessions.push(...sessionsWithIntent);
                } else if (result.clarification) {
                    Alert.alert('Validation Error', result.clarification.message);
                    setLoading(false);
                    return;
                }
            }
            
            if (allSessions.length > 0) {
                setProposedSessions(allSessions);
                setStep('review');
            }
        } catch (error: any) {
            if (error instanceof RateLimitError || error.name === 'RateLimitError') {
                Alert.alert(
                    'Please Wait', 
                    `The AI service is rate-limited. Please wait ${error.retryAfter || 60} seconds before trying again.\n\nTip: The scheduler works better when you provide complete information at once (e.g., "Schedule at 2pm on Monday").`
                );
            } else {
                Alert.alert('Error', 'Failed to create session. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleFormSubmit = async () => {
        if (!formTime.trim() || formDates.length === 0) {
            Alert.alert('Missing Information', 'Please provide dates and times.');
            return;
        }

        setLoading(true);
        try {
            // Re-analyze the follow-up input (which might be "Mon at 1, Tue at 4" OR just "1pm")
            const intent = await extractSchedulingIntent(formTime);
            const finalRecurrence = intent.recurrence || formRecurrence || 'once';
            
            let finalIntents: { date: string, time: string | null }[] = [];

            // Case 1: AI found specific sessions (e.g., "Monday at 1pm")
            const specificSessions = intent.sessions.filter(s => s.date !== null);
            const catchAllTime = intent.sessions.find(s => s.date === null)?.time;

            if (specificSessions.length > 0) {
                // Use specific sessions found in text
                finalIntents = specificSessions.map(s => ({ date: s.date!, time: s.time }));
                
                // If there's a catch-all time (e.g. "Mon at 1 and everything else at 4"),
                // apply it to UI-selected dates NOT mentioned in text.
                if (catchAllTime) {
                    const mentionedDates = new Set(specificSessions.map(s => s.date!));
                    for (const day of formDates) {
                        if (!mentionedDates.has(day)) {
                            finalIntents.push({ date: day, time: catchAllTime });
                        }
                    }
                }
            } else if (catchAllTime) {
                // Case 2: AI only found a time (e.g., "1pm")
                // Apply this time to all selected dates from the UI
                finalIntents = formDates.map(day => ({ date: day, time: catchAllTime }));
            } else {
                // Case 3: AI couldn't parse it well, fallback to treating the whole string as time
                finalIntents = formDates.map(day => ({ date: day, time: formTime }));
            }

            // Proceed to finalize
            await finalizeWithAI(finalIntents, finalRecurrence);
        } catch (error) {
            console.error('Error in handleFormSubmit:', error);
            Alert.alert('Error', 'Failed to process follow-up input.');
        } finally {
            setLoading(false);
        }
    };

    const handleConfirm = async () => {
        setLoading(true);
        try {
            // Only confirm sessions that are NOT pending resolution
            const sessionsToConfirm = proposedSessions.filter(s => s.status !== 'pending_resolution');
            if (sessionsToConfirm.length > 0) {
                await onConfirm(sessionsToConfirm);
            }
            onClose();
            resetForm();
        } catch (error) {
            Alert.alert('Error', 'Failed to save sessions.');
        } finally {
            setLoading(false);
        }
    };

    const checkConflict = (session: ProposedSession) => {
        const newStart = new Date(session.scheduled_at);
        const newEnd = new Date(newStart.getTime() + session.duration_minutes * 60000);

        // Helper: Check if two dates are the same day
        const isSameDay = (date1: Date, date2: Date) => {
            return date1.getDate() === date2.getDate() &&
                   date1.getMonth() === date2.getMonth() &&
                   date1.getFullYear() === date2.getFullYear();
        };

        // 1. Check for Overlaps (Coach Availability) - MUST be same day
        const overlap = existingSessions.find(existing => {
            const existingStart = new Date(existing.scheduled_at);
            
            // CRITICAL: Check same day first!
            if (!isSameDay(newStart, existingStart)) return false;
            
            const existingEnd = new Date(existingStart.getTime() + existing.duration_minutes * 60000);
            return (newStart < existingEnd && newEnd > existingStart);
        });

        if (overlap) {
            return { 
                type: 'overlap', 
                message: 'Overlaps with another session',
                existingSession: {
                    ...overlap,
                    client_id: overlap.client_id // Ensure client_id is passed
                }
            };
        }

        // 2. Check for One Session Per Day (Client Limit)
        const sameDaySession = existingSessions.find(existing => {
            if (existing.client_id !== targetClientId) return false;
            
            const existingDate = new Date(existing.scheduled_at);
            return isSameDay(newStart, existingDate);
        });

        if (sameDaySession) {
            // Check if it's the EXACT same time (not a conflict, just re-confirming)
            const existingStart = new Date(sameDaySession.scheduled_at);
            const isSameTime = existingStart.getTime() === newStart.getTime();
            
            if (isSameTime) {
                // Same client, same day, same time = Already scheduled!
                Alert.alert(
                    'Already Scheduled',
                    `${clientContext.name} already has a session at this time.`,
                    [{ text: 'OK' }]
                );
                return { type: 'already_scheduled', message: 'Already scheduled at this time', existingSession: sameDaySession };
            }
            
            // Same client, same day, DIFFERENT time = Conflict (max 1 per day)
            return { 
                type: 'limit', 
                message: 'Client already has a session this day',
                existingSession: {
                    ...sameDaySession,
                    client_id: sameDaySession.client_id
                }
            };
        }

        return null;
    };

    const handleConflictDetected = (session: ProposedSession, conflict: any) => {
        // Generate recommendations
        const recommendations = findAvailableSlots({
            proposedTime: session.scheduled_at,
            duration: session.duration_minutes,
            existingSessions: existingSessions,
            targetClientId: targetClientId,
            ignoreSessionId: conflict.existingSession?.client_id === targetClientId ? conflict.existingSession?.id : undefined,
            recurrence: session.recurrence,
        });


        // Build conflict info
        const conflictData: ConflictInfo = {
            type: conflict.type,
            message: conflict.message,
            existingSession: {
                id: conflict.existingSession.id,
                client_id: conflict.existingSession.client_id,
                client_name: conflict.existingSession.client_name || 'Unknown',
                scheduled_at: conflict.existingSession.scheduled_at,
                duration_minutes: conflict.existingSession.duration_minutes,
                session_type: conflict.existingSession.session_type,
                recurrence: conflict.existingSession.recurrence,
            },
            proposedSession: {
                client_id: targetClientId,
                client_name: clientContext.name,
                scheduled_at: session.scheduled_at,
                duration_minutes: session.duration_minutes,
                session_type: session.session_type,
                recurrence: session.recurrence,
                day_of_week: session.day_of_week,
            },
            recommendations,
        };

        setConflictInfo(conflictData);
        setShowConflictModal(true);
    };

    const handleResolution = async (resolution: Resolution) => {
        if (resolution.action === 'cancel') {
            setShowConflictModal(false);
            setConflictInfo(null);
            return;
        }

        if (!conflictInfo) return;

        try {
            setLoading(true);
            const { existingSession, proposedSession } = conflictInfo;
            const currentUser = (await supabase.auth.getUser()).data.user;

            if (!currentUser) throw new Error('Not authenticated');

            if (resolution.action === 'propose_new_time_for_incoming') {
                // Option 1: Propose to INCOMING client
                // NOTE: We do NOT create a session here because the proposed time conflicts!
                // The session will be created AFTER the client picks an available time.
                
                // 1. Get Incoming Client User ID
                const { data: clientData, error: clientError } = await supabase
                    .from('clients')
                    .select('user_id')
                    .eq('id', proposedSession.client_id)
                    .single();
                
                if (clientError || !clientData) throw new Error('Client not found');

                // 2. Send Message with available slots
                const isWeekly = proposedSession.recurrence === 'weekly';
                const dayName = new Date(proposedSession.scheduled_at).toLocaleDateString('en-US', { weekday: 'long' });
                const dateStr = new Date(proposedSession.scheduled_at).toLocaleDateString();
                
                const messageText = isWeekly
                    ? `Hi ${proposedSession.client_name}, the time you requested for your weekly sessions on ${dayName}s is unavailable. Please tap here to choose another time.`
                    : `Hi ${proposedSession.client_name}, the time you requested for ${dayName}, ${dateStr} is unavailable. Please tap here to choose another time.`;

                const messageContent = {
                    type: 'reschedule_proposal',
                    sessionId: null, // No session created yet - client will pick time first
                    originalTime: proposedSession.scheduled_at,
                    availableSlots: resolution.proposedSlots,
                    mode: 'open_calendar',
                    text: messageText,
                    recurrence: proposedSession.recurrence,
                    dayOfWeek: dayName,
                    // Add metadata needed to create session later
                    proposedSessionData: {
                        client_id: proposedSession.client_id,
                        duration_minutes: proposedSession.duration_minutes,
                        session_type: proposedSession.session_type,
                        coach_id: existingSessions[0]?.coach_id,
                    }
                };

                await supabase.from('messages').insert({
                    sender_id: currentUser.id,
                    recipient_id: clientData.user_id,
                    content: JSON.stringify(messageContent),
                    read: false
                });

                console.log('[SchedulerModal] Option 1: Message sent without creating conflicting session');
                Alert.alert('Request Sent', `Resolution request sent to ${proposedSession.client_name}`);
            }

            // Cleanup: Mark as pending instead of removing
            const updatedSessions = proposedSessions.map(s => {
                if (s.scheduled_at === proposedSession.scheduled_at) {
                    return { ...s, status: 'pending_resolution' };
                }
                return s;
            });
            setProposedSessions(updatedSessions);
            setShowConflictModal(false);
            setConflictInfo(null);

        } catch (error) {
            console.error('Error handling resolution:', error);
            Alert.alert('Error', 'Failed to process resolution request');
        } finally {
            setLoading(false);
        }
    };

    const startEditing = (index: number) => {
        setEditingIndex(index);
        setEditForm({ ...proposedSessions[index] });
    };

    const saveEdit = () => {
        if (editForm && editingIndex !== null) {
            const updated = [...proposedSessions];
            updated[editingIndex] = editForm;
            setProposedSessions(updated);
            setEditingIndex(null);
            setEditForm(null);
        }
    };

    const deleteSession = (index: number) => {
        const updated = proposedSessions.filter((_, i) => i !== index);
        setProposedSessions(updated);
    };

    const handleMicPress = () => {
        Alert.alert('Coming Soon', 'Voice input is currently under development. Please type your request for now.');
    };

    const toggleRecurrence = (index: number) => {
        const updated = [...proposedSessions];
        updated[index].recurrence = updated[index].recurrence === 'weekly' ? 'once' : 'weekly';
        setProposedSessions(updated);
    };

    const hasAnyConflict = proposedSessions.some(s => checkConflict(s) !== null);

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
            <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
                <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
                    <View style={styles.headerLeft}>
                        <Text style={[styles.title, { color: theme.colors.text }]}>AI Scheduler</Text>
                        <TouchableOpacity 
                            style={[styles.manualButton, { backgroundColor: theme.colors.primary + '15', borderColor: theme.colors.primary }]}
                            onPress={() => setShowManualMode(true)}
                        >
                            <Text style={[styles.manualButtonText, { color: theme.colors.primary }]}>Edit manually</Text>
                        </TouchableOpacity>
                    </View>
                    <TouchableOpacity onPress={() => { 
                        if (proposedSessions.length > 0 && step === 'review') {
                            Alert.alert(
                                'Save Progress?',
                                'Do you want to save these proposed sessions as pending resolutions?',
                                [
                                    { text: 'Discard', style: 'destructive', onPress: () => { resetForm(); onClose(); } },
                                    { text: 'Save', onPress: () => { handleConfirm(); resetForm(); onClose(); } }
                                ]
                            );
                        } else {
                            resetForm(); 
                            onClose(); 
                        }
                    }}>
                        <X size={24} color={theme.colors.text} />
                    </TouchableOpacity>
                </View>

                {step === 'input' ? (
                    <View style={styles.content}>
                        <Text style={[styles.label, { color: theme.colors.text }]}>
                            Tell me when you want to schedule sessions with {clientContext.name}...
                        </Text>
                        
                        <View style={[styles.inputContainer, { backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.border }]}>
                            <TextInput
                                style={[styles.textInput, { color: theme.colors.text }]}
                                multiline
                                placeholder="e.g., 'Schedule training every Monday at 10am for 1 hour'"
                                placeholderTextColor={theme.colors.textTertiary}
                                value={input}
                                onChangeText={setInput}
                            />
                            <TouchableOpacity style={styles.micButton} onPress={handleMicPress}>
                                <Mic size={24} color={theme.colors.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity 
                            style={[
                                styles.button,
                                { backgroundColor: (!input.trim() || loading) ? theme.colors.primaryDisabled : theme.colors.primary },
                                (!input.trim() || loading) && styles.buttonDisabled
                            ]} 
                            onPress={handleAnalyze}
                            disabled={!input.trim() || loading}
                        >
                            {loading ? <ActivityIndicator color={theme.colors.textOnPrimary} /> : (
                                <>
                                    <Text style={[styles.buttonText, { color: theme.colors.textOnPrimary }]}>Analyze Schedule</Text>
                                    <Send size={20} color={theme.colors.textOnPrimary} />
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                ) : step === 'form' ? (
                    <View style={styles.content}>
                        <View style={styles.conversationalHeader}>
                            <Text style={[styles.conversationalLabel, { color: theme.colors.textSecondary }]}>
                                {formDates.length > 0 
                                    ? `You didn't mention the time for ${formDates.length === 1 ? formDates[0] : 'these days'}.` 
                                    : "You didn't mention the days or time."
                                }
                            </Text>
                            <Text style={[styles.label, { color: theme.colors.text }]}>
                                What time do you want to schedule? 
                                {formDates.length > 1 && <Text style={[styles.subLabel, { color: theme.colors.textSecondary }]}> (Mention individual days if they are different)</Text>}
                            </Text>
                        </View>
                        
                        {/* Selected Days Summary */}
                        {formDates.length > 0 && (
                            <View style={[styles.summaryContainer, { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border }]}>
                                <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>Selected Days:</Text>
                                <View style={styles.summaryTags}>
                                    {formDates.map(day => (
                                        <View key={day} style={[styles.summaryTag, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                                            <Calendar size={12} color={theme.colors.primary} />
                                            <Text style={[styles.summaryTagText, { color: theme.colors.text }]}>{day.charAt(0).toUpperCase() + day.slice(1)}</Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )}

                        {/* Natural Language Input */}
                        <View style={styles.formGroup}>
                            <Text style={[styles.formLabel, { color: theme.colors.text }]}>Time or Details</Text>
                            <TextInput
                                style={[styles.formInput, { backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.border, color: theme.colors.text }, !formTime && { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary + '10' }]}
                                placeholder={formDates.length > 1 
                                    ? "e.g., '1pm' or 'Mon at 1 and Tue at 4'"
                                    : "e.g., '10am' or '7:25pm'"
                                }
                                placeholderTextColor={theme.colors.textTertiary}
                                value={formTime}
                                autoFocus={!formTime}
                                onChangeText={setFormTime}
                            />
                            <Text style={[styles.inputHint, { color: theme.colors.textSecondary }]}>
                                Tip: You can say "All days at 1pm" or specify times per day.
                            </Text>
                        </View>

                        {/* Date selection is HIDDEN if days are chosen, unless they want to edit */}
                        {formDates.length > 0 ? (
                            <TouchableOpacity 
                                style={styles.editDatesToggle}
                                onPress={() => setFormDates([])}
                            >
                                <Text style={[styles.editDatesText, { color: theme.colors.primary }]}>+ Add or Change Dates</Text>
                            </TouchableOpacity>
                        ) : (
                            <View style={styles.formGroup}>
                                <Text style={[styles.formLabel, { color: theme.colors.text }]}>Select Dates</Text>
                                <View style={styles.dateButtons}>
                                    {['today', 'tomorrow', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday'].map((day) => (
                                        <TouchableOpacity
                                            key={day}
                                            style={[styles.dayButton, { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border }, formDates.includes(day) && { backgroundColor: theme.colors.primary + '15', borderColor: theme.colors.primary }]}
                                            onPress={() => {
                                                if (formDates.includes(day)) {
                                                    setFormDates(formDates.filter(d => d !== day));
                                                } else {
                                                    setFormDates([...formDates, day]);
                                                }
                                            }}
                                        >
                                            <Text style={[styles.dayButtonText, { color: theme.colors.textSecondary }, formDates.includes(day) && { color: theme.colors.primary, fontWeight: '600' }]}>
                                                {day.charAt(0).toUpperCase() + day.slice(1)}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        )}

                        {/* Recurrence (Shown only if we have a basic input or if user wants to set global recurrence) */}
                        <View style={styles.formGroup}>
                            <Text style={[styles.formLabel, { color: theme.colors.text }]}>Recurrence</Text>
                            <View style={styles.recurrenceButtons}>
                                <TouchableOpacity
                                    style={[styles.optionButton, { backgroundColor: theme.colors.primary + '15', borderColor: theme.colors.primary + '40' }, (formRecurrence === 'once' || !formRecurrence) && { backgroundColor: theme.colors.primary + '25', borderColor: theme.colors.primary }]}
                                    onPress={() => setFormRecurrence('once')}
                                >
                                    <Calendar size={20} color={formRecurrence === 'once' ? theme.colors.primary : theme.colors.textSecondary} />
                                    <View>
                                        <Text style={[styles.optionButtonText, { color: theme.colors.primary }, (formRecurrence === 'once' || !formRecurrence) && { fontWeight: '700' }]}>One-time</Text>
                                        <Text style={[styles.optionSubText, { color: theme.colors.textSecondary }]}>Just for the days mentioned</Text>
                                    </View>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.optionButton, { backgroundColor: theme.colors.primary + '15', borderColor: theme.colors.primary + '40' }, formRecurrence === 'weekly' && { backgroundColor: theme.colors.primary + '25', borderColor: theme.colors.primary }]}
                                    onPress={() => setFormRecurrence('weekly')}
                                >
                                    <Repeat size={20} color={formRecurrence === 'weekly' ? theme.colors.primary : theme.colors.textSecondary} />
                                    <View>
                                        <Text style={[styles.optionButtonText, { color: theme.colors.primary }, formRecurrence === 'weekly' && { fontWeight: '700' }]}>Weekly</Text>
                                        <Text style={[styles.optionSubText, { color: theme.colors.textSecondary }]}>Repeating every week</Text>
                                    </View>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <View style={styles.buttonGroup}>
                            <TouchableOpacity
                                style={[styles.button, { backgroundColor: theme.colors.primary }, (!formTime || formDates.length === 0 || loading) && styles.buttonDisabled]}
                                onPress={handleFormSubmit}
                                disabled={!formTime || formDates.length === 0 || loading}
                            >
                                {loading ? <ActivityIndicator color={theme.colors.textOnPrimary} /> : (
                                    <>
                                        <Text style={[styles.buttonText, { color: theme.colors.textOnPrimary }]}>Review Schedule</Text>
                                        <Check size={20} color={theme.colors.textOnPrimary} />
                                    </>
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity style={[styles.secondaryButton, { borderColor: theme.colors.border }]} onPress={resetForm}>
                                <Text style={[styles.secondaryButtonText, { color: theme.colors.text }]}>Back</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                ) : (
                    <View style={styles.content}>
                        <Text style={[styles.label, { color: theme.colors.text }]}>Review Proposed Sessions</Text>
                        <ScrollView style={styles.list}>
                            {proposedSessions.map((session, index) => {
                                const isPending = session.status === 'pending_resolution';
                                const conflict = !isPending ? checkConflict(session) : null;
                                const isEditing = editingIndex === index;

                                if (isEditing && editForm) {
                                    return (
                                        <View key={index} style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                                            <Text style={[styles.editLabel, { color: theme.colors.text }]}>Edit Session</Text>
                                            
                                            <View style={styles.formGroup}>
                                                <Text style={[styles.fieldLabel, { color: theme.colors.textSecondary }]}>Time (24h format)</Text>
                                                <TextInput
                                                    style={[styles.editInput, { borderColor: theme.colors.border, backgroundColor: theme.colors.inputBackground, color: theme.colors.text }]}
                                                    value={formatTimeToHHmm(editForm.scheduled_at)}
                                                    onChangeText={(text) => {
                                                        const updatedTime = updateSessionTime(editForm.scheduled_at, text);
                                                        setEditForm({ ...editForm, scheduled_at: updatedTime });
                                                    }}
                                                    placeholder="HH:mm"
                                                    placeholderTextColor={theme.colors.textTertiary}
                                                />
                                            </View>

                                            <View style={styles.formGroup}>
                                                <Text style={[styles.fieldLabel, { color: theme.colors.textSecondary }]}>Notes</Text>
                                                <TextInput
                                                    style={[styles.editInput, { borderColor: theme.colors.border, backgroundColor: theme.colors.inputBackground, color: theme.colors.text }]}
                                                    value={editForm.notes}
                                                    onChangeText={(text) => setEditForm({...editForm, notes: text})}
                                                    placeholder="Notes"
                                                    placeholderTextColor={theme.colors.textTertiary}
                                                />
                                            </View>

                                            <View style={styles.editActions}>
                                                <TouchableOpacity style={styles.iconButton} onPress={() => setEditingIndex(null)}>
                                                    <X size={20} color={theme.colors.textSecondary} />
                                                </TouchableOpacity>
                                                <TouchableOpacity style={styles.iconButton} onPress={saveEdit}>
                                                    <Save size={20} color={theme.colors.primary} />
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    );
                                }

                                return (
                                    <View key={index} style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }, conflict && { borderColor: theme.colors.warning + '80', backgroundColor: theme.colors.warning + '10' }]}>
                                        <View style={styles.cardHeader}>
                                            <View style={styles.row}>
                                                <Calendar size={16} color={theme.colors.textSecondary} />
                                                <Text style={[styles.date, { color: theme.colors.text }]}>
                                                    {session.recurrence === 'weekly' 
                                                        ? `Every ${session.day_of_week || 'Week'}`
                                                        : new Date(session.scheduled_at).toLocaleDateString()
                                                    }
                                                </Text>
                                            </View>
                                            <View style={styles.cardActions}>
                                                <TouchableOpacity onPress={() => startEditing(index)}>
                                                    <Pencil size={16} color={theme.colors.textSecondary} />
                                                </TouchableOpacity>
                                                <TouchableOpacity onPress={() => deleteSession(index)}>
                                                    <Trash2 size={16} color={theme.colors.warning} />
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                        
                                        {isPending ? (
                                            <View style={[styles.conflictBadge, { backgroundColor: theme.colors.warning + '20', borderColor: theme.colors.warning }]}>
                                                <Clock size={12} color={theme.colors.warning} />
                                                <Text style={[styles.conflictText, { color: theme.colors.warning }]}>Pending Resolution</Text>
                                            </View>
                                        ) : conflict && (
                                            <TouchableOpacity 
                                                style={[styles.conflictBadge, { backgroundColor: theme.colors.warning + '20' }]}
                                                onPress={() => handleConflictDetected(session, conflict)}
                                            >
                                                <AlertTriangle size={12} color={theme.colors.warning} />
                                                <Text style={[styles.conflictText, { color: theme.colors.warning }]}>Conflict Detected • Tap to Resolve</Text>
                                            </TouchableOpacity>
                                        )}

                                        <View style={styles.row}>
                                            <Clock size={16} color={theme.colors.textSecondary} />
                                            <Text style={[styles.time, { color: theme.colors.textSecondary }]}>
                                                {new Date(session.scheduled_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} 
                                                {' '}({session.duration_minutes} min)
                                            </Text>
                                        </View>
                                        <Text style={[styles.type, { color: theme.colors.primary }]}>{session.session_type.toUpperCase()}</Text>
                                        {session.notes && <Text style={[styles.notes, { color: theme.colors.textSecondary }]}>{session.notes}</Text>}

                                        {/* Recurrence Toggle */}
                                        <TouchableOpacity 
                                            style={[styles.recurrenceToggle, { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border }, session.recurrence === 'weekly' && { backgroundColor: theme.colors.primary + '15', borderColor: theme.colors.primary + '60' }]} 
                                            onPress={() => toggleRecurrence(index)}
                                        >
                                            <Repeat size={14} color={session.recurrence === 'weekly' ? theme.colors.primary : theme.colors.textSecondary} />
                                            <Text style={[styles.recurrenceText, { color: theme.colors.textSecondary }, session.recurrence === 'weekly' && { color: theme.colors.primary, fontWeight: '600' }]}>
                                                {session.recurrence === 'weekly' ? 'Recurring (Weekly)' : 'One-time Session'}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                );
                            })}
                        </ScrollView>

                        <View style={styles.footer}>
                            <TouchableOpacity style={[styles.secondaryButton, { borderColor: theme.colors.border }]} onPress={() => setStep('form')}>
                                <Text style={[styles.secondaryButtonText, { color: theme.colors.text }]}>Back</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.button, { backgroundColor: theme.colors.primary }, (loading || hasAnyConflict) && styles.buttonDisabled]} 
                                onPress={handleConfirm} 
                                disabled={loading || hasAnyConflict}
                            >
                                {loading ? <ActivityIndicator color={theme.colors.textOnPrimary} /> : (
                                    <>
                                        <Text style={[styles.buttonText, { color: theme.colors.textOnPrimary }]}>
                                            {hasAnyConflict ? 'Resolve Conflicts' : proposedSessions.every(s => s.status === 'pending_resolution') ? 'Done' : 'Confirm & Lock'}
                                        </Text>
                                        {!hasAnyConflict && <Check size={20} color={theme.colors.textOnPrimary} />}
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </View>
            <ConflictResolutionModal
                visible={showConflictModal}
                conflictInfo={conflictInfo}
                onResolve={handleResolution}
                onCancel={() => setShowConflictModal(false)}
            />

            {/* Manual Scheduler Modal */}
            {showManualMode && coach && (
                <ManualSchedulerModal
                    visible={showManualMode}
                    onClose={() => setShowManualMode(false)}
                    onConfirm={onConfirm}
                    existingSessions={existingSessions}
                    coachId={coach.id}
                />
            )}
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingTop: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    manualButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
    },
    manualButtonText: {
        fontSize: 13,
        fontWeight: '600',
    },
    content: {
        flex: 1,
        padding: 20,
    },
    label: {
        fontSize: 16,
        marginBottom: 12,
        fontWeight: '500',
    },
    inputContainer: {
        borderRadius: 12,
        borderWidth: 1,
        padding: 12,
        height: 150,
        marginBottom: 20,
    },
    textInput: {
        flex: 1,
        fontSize: 16,
        textAlignVertical: 'top',
    },
    micButton: {
        position: 'absolute',
        bottom: 12,
        right: 12,
        padding: 8,
    },
    button: {
        padding: 16,
        borderRadius: 12,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
    },
    buttonDisabled: {
        opacity: 0.5,
    },
    buttonText: {
        fontSize: 16,
        fontWeight: '600',
    },
    list: {
        flex: 1,
    },
    card: {
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    cardActions: {
        flexDirection: 'row',
        gap: 12,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4,
    },
    date: {
        fontSize: 16,
        fontWeight: '600',
    },
    time: {
        fontSize: 14,
    },
    type: {
        fontSize: 12,
        fontWeight: '700',
        marginTop: 4,
    },
    notes: {
        fontSize: 14,
        marginTop: 4,
        fontStyle: 'italic',
    },
    conflictBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 12,
        marginBottom: 8,
    },
    conflictText: {
        fontSize: 12,
        fontWeight: '600',
    },
    footer: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 20,
    },
    secondaryButton: {
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        marginTop:10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    secondaryButtonText: {
        fontSize: 16,
        fontWeight: '600',
    },
    editLabel: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
    },
    editInput: {
        borderWidth: 1,
        borderRadius: 8,
        padding: 12,
        marginBottom: 12,
    },
    editActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12,
        marginTop: 8,
    },
    fieldLabel: {
        fontSize: 12,
        fontWeight: '500',
        marginBottom: 4,
    },
    iconButton: {
        padding: 8,
    },
    recurrenceToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 12,
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 8,
        alignSelf: 'flex-start',
        borderWidth: 1,
    },
    recurrenceText: {
        fontSize: 12,
        fontWeight: '500',
    },
    clarificationOptions: {
        gap: 12,
        marginTop: 20,
    },
    optionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
    },
    optionButtonText: {
        fontSize: 16,
        fontWeight: '600',
    },
    formGroup: {
        marginBottom: 24,
    },
    formLabel: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
    },
    formInput: {
        borderRadius: 8,
        borderWidth: 1,
        padding: 12,
        fontSize: 16,
    },
    dateButtons: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    dayButton: {
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        borderWidth: 1,
    },
    dayButtonText: {
        fontSize: 14,
        fontWeight: '500',
    },
    recurrenceButtons: {
        gap: 12,
    },
    buttonGroup: {
        flexDirection: 'column',
        gap: 12,
    },
    summaryContainer: {
        marginBottom: 20,
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
    },
    summaryLabel: {
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 8,
        textTransform: 'uppercase',
    },
    summaryTags: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    summaryTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 16,
        borderWidth: 1,
    },
    summaryTagText: {
        fontSize: 13,
        fontWeight: '500',
    },
    editDatesToggle: {
        marginTop: -16,
        marginBottom: 24,
        padding: 4,
    },
    editDatesText: {
        fontSize: 13,
        fontWeight: '500',
    },
    conversationalHeader: {
        marginBottom: 20,
    },
    conversationalLabel: {
        fontSize: 15,
        marginBottom: 4,
        lineHeight: 20,
    },
    subLabel: {
        fontSize: 13,
        fontWeight: '400',
    },
    inputHint: {
        fontSize: 12,
        marginTop: 6,
        fontStyle: 'italic',
    },
    optionSubText: {
        fontSize: 12,
        marginTop: 2,
    },
});
