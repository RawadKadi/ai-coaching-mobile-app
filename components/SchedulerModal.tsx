import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { X, Mic, Send, Calendar, Clock, Check, AlertTriangle, Pencil, Trash2, Save, Repeat } from 'lucide-react-native';
import { parseScheduleRequest, ProposedSession, RateLimitError, extractSchedulingIntent } from '@/lib/ai-scheduling-service';
import { Session } from '@/types/database';
import ConflictResolutionModal from './ConflictResolutionModal';
import { ConflictInfo, Resolution } from '@/types/conflict';
import { findAvailableSlots } from '@/lib/time-slot-finder';
import { supabase } from '@/lib/supabase';

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


    const resolveDateKeywordToISO = (keyword: string): string => {
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
            return toLocalISO(now);
        } else if (keyword === 'tomorrow') {
            const tomorrow = new Date(now);
            tomorrow.setDate(now.getDate() + 1);
            return toLocalISO(tomorrow);
        } else if (keyword in dayMap) {
            // For day names, resolve to the actual date
            const targetDay = dayMap[keyword];
            const currentDay = now.getDay();
            let daysToAdd = targetDay - currentDay;
            
            // If it's the same day as today, use today's date
            if (daysToAdd === 0) {
                return toLocalISO(now);
            }
            
            // Otherwise get the next occurrence of this day
            if (daysToAdd < 0) daysToAdd += 7;
            
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
                const isoDate = resolveDateKeywordToISO(intent.date);
                
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
            return { 
                type: 'limit', 
                message: 'Client already has a session this day',
                existingSession: {
                    ...sameDaySession,
                    client_id: sameDaySession.client_id // Ensure client_id is passed
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
                client_name: conflict.existingSession.client?.name || 'Unknown',
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
                
                // 1. Get Incoming Client User ID
                const { data: clientData, error: clientError } = await supabase
                    .from('clients')
                    .select('user_id')
                    .eq('id', proposedSession.client_id)
                    .single();
                
                if (clientError || !clientData) throw new Error('Client not found');

                // 2. Create session as pending
                const { data: newSession, error: sessionError } = await supabase
                    .from('sessions')
                    .insert({
                        coach_id: existingSessions[0]?.coach_id, 
                        client_id: proposedSession.client_id,
                        scheduled_at: proposedSession.scheduled_at,
                        duration_minutes: proposedSession.duration_minutes,
                        session_type: proposedSession.session_type,
                        status: 'pending_resolution',
                    })
                    .select()
                    .single();

                if (sessionError) throw sessionError;

                // 3. Send Message
                const isWeekly = proposedSession.recurrence === 'weekly';
                const dayName = new Date(proposedSession.scheduled_at).toLocaleDateString('en-US', { weekday: 'long' });
                const dateStr = new Date(proposedSession.scheduled_at).toLocaleDateString();
                
                const messageText = isWeekly
                    ? `Hi ${proposedSession.client_name}, the time you requested for your weekly sessions on ${dayName}s is unavailable. Please tap here to choose another time.`
                    : `Hi ${proposedSession.client_name}, the time you requested for ${dayName}, ${dateStr} is unavailable. Please tap here to choose another time.`;

                const messageContent = {
                    type: 'reschedule_proposal',
                    sessionId: newSession.id,
                    originalTime: proposedSession.scheduled_at,
                    availableSlots: resolution.proposedSlots,
                    mode: 'open_calendar',
                    text: messageText,
                    recurrence: proposedSession.recurrence,
                    dayOfWeek: dayName
                };

                await supabase.from('messages').insert({
                    sender_id: currentUser.id,
                    recipient_id: clientData.user_id,
                    content: JSON.stringify(messageContent),
                    read: false
                });

                Alert.alert('Request Sent', `Resolution request sent to ${proposedSession.client_name}`);

            } else if (resolution.action === 'propose_reschedule_for_existing') {
                // Option 2: Propose to EXISTING client
                
                // 1. Get Existing Client User ID
                const { data: clientData, error: clientError } = await supabase
                    .from('clients')
                    .select('user_id')
                    .eq('id', existingSession.client_id)
                    .single();

                if (clientError || !clientData) throw new Error('Client not found');

                // 2. Send Message
                const isWeekly = existingSession.recurrence === 'weekly';
                const dayName = new Date(existingSession.scheduled_at).toLocaleDateString('en-US', { weekday: 'long' });
                const dateStr = new Date(existingSession.scheduled_at).toLocaleDateString();

                const messageText = isWeekly
                    ? `Hi ${existingSession.client_name}, could we reschedule our weekly sessions on ${dayName}s to accommodate another client?`
                    : `Hi ${existingSession.client_name}, could we reschedule our session on ${dayName}, ${dateStr} to accommodate another client?`;

                const messageContent = {
                    type: 'reschedule_proposal',
                    sessionId: existingSession.id,
                    originalTime: existingSession.scheduled_at,
                    availableSlots: resolution.proposedSlots,
                    mode: 'confirm_reschedule',
                    text: messageText,
                    recurrence: existingSession.recurrence,
                    dayOfWeek: dayName
                };

                await supabase.from('messages').insert({
                    sender_id: currentUser.id,
                    recipient_id: clientData.user_id,
                    content: JSON.stringify(messageContent),
                    read: false
                });

                 // 3. Create INCOMING session as pending
                 await supabase
                    .from('sessions')
                    .insert({
                        coach_id: existingSessions[0]?.coach_id,
                        client_id: proposedSession.client_id,
                        scheduled_at: proposedSession.scheduled_at,
                        duration_minutes: proposedSession.duration_minutes,
                        session_type: proposedSession.session_type,
                        status: 'pending_resolution',
                    });

                Alert.alert('Request Sent', `Resolution request sent to ${existingSession.client_name}`);
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
            <View style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.title}>AI Scheduler</Text>
                    <TouchableOpacity onPress={() => { resetForm(); onClose(); }}>
                        <X size={24} color="#374151" />
                    </TouchableOpacity>
                </View>

                {step === 'input' ? (
                    <View style={styles.content}>
                        <Text style={styles.label}>
                            Tell me when you want to schedule sessions with {clientContext.name}...
                        </Text>
                        
                        <View style={styles.inputContainer}>
                            <TextInput
                                style={styles.textInput}
                                multiline
                                placeholder="e.g., 'Schedule training every Monday at 10am for 1 hour'"
                                value={input}
                                onChangeText={setInput}
                            />
                            <TouchableOpacity style={styles.micButton} onPress={handleMicPress}>
                                <Mic size={24} color="#6B7280" />
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity 
                            style={[styles.button, (!input.trim() || loading) && styles.buttonDisabled]} 
                            onPress={handleAnalyze}
                            disabled={!input.trim() || loading}
                        >
                            {loading ? <ActivityIndicator color="#FFF" /> : (
                                <>
                                    <Text style={styles.buttonText}>Analyze Schedule</Text>
                                    <Send size={20} color="#FFF" />
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                ) : step === 'form' ? (
                    <View style={styles.content}>
                        <View style={styles.conversationalHeader}>
                            <Text style={styles.conversationalLabel}>
                                {formDates.length > 0 
                                    ? `You didn't mention the time for ${formDates.length === 1 ? formDates[0] : 'these days'}.` 
                                    : "You didn't mention the days or time."
                                }
                            </Text>
                            <Text style={styles.label}>
                                What time do you want to schedule? 
                                {formDates.length > 1 && <Text style={styles.subLabel}> (Mention individual days if they are different)</Text>}
                            </Text>
                        </View>
                        
                        {/* Selected Days Summary */}
                        {formDates.length > 0 && (
                            <View style={styles.summaryContainer}>
                                <Text style={styles.summaryLabel}>Selected Days:</Text>
                                <View style={styles.summaryTags}>
                                    {formDates.map(day => (
                                        <View key={day} style={styles.summaryTag}>
                                            <Calendar size={12} color="#3B82F6" />
                                            <Text style={styles.summaryTagText}>{day.charAt(0).toUpperCase() + day.slice(1)}</Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )}

                        {/* Natural Language Input */}
                        <View style={styles.formGroup}>
                            <Text style={styles.formLabel}>Time or Details</Text>
                            <TextInput
                                style={[styles.formInput, !formTime && styles.inputHighlight]}
                                placeholder={formDates.length > 1 
                                    ? "e.g., '1pm' or 'Mon at 1 and Tue at 4'"
                                    : "e.g., '10am' or '7:25pm'"
                                }
                                value={formTime}
                                autoFocus={!formTime}
                                onChangeText={setFormTime}
                            />
                            <Text style={styles.inputHint}>
                                Tip: You can say "All days at 1pm" or specify times per day.
                            </Text>
                        </View>

                        {/* Date selection is HIDDEN if days are chosen, unless they want to edit */}
                        {formDates.length > 0 ? (
                            <TouchableOpacity 
                                style={styles.editDatesToggle}
                                onPress={() => setFormDates([])}
                            >
                                <Text style={styles.editDatesText}>+ Add or Change Dates</Text>
                            </TouchableOpacity>
                        ) : (
                            <View style={styles.formGroup}>
                                <Text style={styles.formLabel}>Select Dates</Text>
                                <View style={styles.dateButtons}>
                                    {['today', 'tomorrow', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday'].map((day) => (
                                        <TouchableOpacity
                                            key={day}
                                            style={[styles.dayButton, formDates.includes(day) && styles.dayButtonActive]}
                                            onPress={() => {
                                                if (formDates.includes(day)) {
                                                    setFormDates(formDates.filter(d => d !== day));
                                                } else {
                                                    setFormDates([...formDates, day]);
                                                }
                                            }}
                                        >
                                            <Text style={[styles.dayButtonText, formDates.includes(day) && styles.dayButtonTextActive]}>
                                                {day.charAt(0).toUpperCase() + day.slice(1)}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        )}

                        {/* Recurrence (Shown only if we have a basic input or if user wants to set global recurrence) */}
                        <View style={styles.formGroup}>
                            <Text style={styles.formLabel}>Recurrence</Text>
                            <View style={styles.recurrenceButtons}>
                                <TouchableOpacity
                                    style={[styles.optionButton, (formRecurrence === 'once' || !formRecurrence) && styles.optionButtonActive]}
                                    onPress={() => setFormRecurrence('once')}
                                >
                                    <Calendar size={20} color={formRecurrence === 'once' ? '#3B82F6' : '#6B7280'} />
                                    <View>
                                        <Text style={[styles.optionButtonText, (formRecurrence === 'once' || !formRecurrence) && styles.optionButtonTextActive]}>One-time</Text>
                                        <Text style={styles.optionSubText}>Just for the days mentioned</Text>
                                    </View>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.optionButton, formRecurrence === 'weekly' && styles.optionButtonActive]}
                                    onPress={() => setFormRecurrence('weekly')}
                                >
                                    <Repeat size={20} color={formRecurrence === 'weekly' ? '#3B82F6' : '#6B7280'} />
                                    <View>
                                        <Text style={[styles.optionButtonText, formRecurrence === 'weekly' && styles.optionButtonTextActive]}>Weekly</Text>
                                        <Text style={styles.optionSubText}>Repeating every week</Text>
                                    </View>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <View style={styles.buttonGroup}>
                            <TouchableOpacity
                                style={[styles.button, (!formTime || formDates.length === 0 || loading) && styles.buttonDisabled]}
                                onPress={handleFormSubmit}
                                disabled={!formTime || formDates.length === 0 || loading}
                            >
                                {loading ? <ActivityIndicator color="#FFF" /> : (
                                    <>
                                        <Text style={styles.buttonText}>Review Schedule</Text>
                                        <Check size={20} color="#FFF" />
                                    </>
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.secondaryButton} onPress={resetForm}>
                                <Text style={styles.secondaryButtonText}>Back</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                ) : (
                    <View style={styles.content}>
                        <Text style={styles.label}>Review Proposed Sessions</Text>
                        <ScrollView style={styles.list}>
                            {proposedSessions.map((session, index) => {
                                const isPending = session.status === 'pending_resolution';
                                const conflict = !isPending ? checkConflict(session) : null;
                                const isEditing = editingIndex === index;

                                if (isEditing && editForm) {
                                    return (
                                        <View key={index} style={styles.card}>
                                            <Text style={styles.editLabel}>Edit Session</Text>
                                            
                                            <View style={styles.formGroup}>
                                                <Text style={styles.fieldLabel}>Time (24h format)</Text>
                                                <TextInput
                                                    style={styles.editInput}
                                                    value={formatTimeToHHmm(editForm.scheduled_at)}
                                                    onChangeText={(text) => {
                                                        const updatedTime = updateSessionTime(editForm.scheduled_at, text);
                                                        setEditForm({ ...editForm, scheduled_at: updatedTime });
                                                    }}
                                                    placeholder="HH:mm"
                                                />
                                            </View>

                                            <View style={styles.formGroup}>
                                                <Text style={styles.fieldLabel}>Notes</Text>
                                                <TextInput
                                                    style={styles.editInput}
                                                    value={editForm.notes}
                                                    onChangeText={(text) => setEditForm({...editForm, notes: text})}
                                                    placeholder="Notes"
                                                />
                                            </View>

                                            <View style={styles.editActions}>
                                                <TouchableOpacity style={styles.iconButton} onPress={() => setEditingIndex(null)}>
                                                    <X size={20} color="#6B7280" />
                                                </TouchableOpacity>
                                                <TouchableOpacity style={styles.iconButton} onPress={saveEdit}>
                                                    <Save size={20} color="#3B82F6" />
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    );
                                }

                                return (
                                    <View key={index} style={[styles.card, conflict && styles.cardConflict]}>
                                        <View style={styles.cardHeader}>
                                            <View style={styles.row}>
                                                <Calendar size={16} color="#4B5563" />
                                                <Text style={styles.date}>
                                                    {session.recurrence === 'weekly' 
                                                        ? `Every ${session.day_of_week || 'Week'}`
                                                        : new Date(session.scheduled_at).toLocaleDateString()
                                                    }
                                                </Text>
                                            </View>
                                            <View style={styles.cardActions}>
                                                <TouchableOpacity onPress={() => startEditing(index)}>
                                                    <Pencil size={16} color="#6B7280" />
                                                </TouchableOpacity>
                                                <TouchableOpacity onPress={() => deleteSession(index)}>
                                                    <Trash2 size={16} color="#EF4444" />
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                        
                                        {isPending ? (
                                            <View style={[styles.conflictBadge, { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' }]}>
                                                <Clock size={12} color="#B45309" />
                                                <Text style={[styles.conflictText, { color: '#B45309' }]}>Pending Resolution</Text>
                                            </View>
                                        ) : conflict && (
                                            <TouchableOpacity 
                                                style={styles.conflictBadge}
                                                onPress={() => handleConflictDetected(session, conflict)}
                                            >
                                                <AlertTriangle size={12} color="#B91C1C" />
                                                <Text style={styles.conflictText}>Conflict Detected • Tap to Resolve</Text>
                                            </TouchableOpacity>
                                        )}

                                        <View style={styles.row}>
                                            <Clock size={16} color="#4B5563" />
                                            <Text style={styles.time}>
                                                {new Date(session.scheduled_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} 
                                                {' '}({session.duration_minutes} min)
                                            </Text>
                                        </View>
                                        <Text style={styles.type}>{session.session_type.toUpperCase()}</Text>
                                        {session.notes && <Text style={styles.notes}>{session.notes}</Text>}

                                        {/* Recurrence Toggle */}
                                        <TouchableOpacity 
                                            style={[styles.recurrenceToggle, session.recurrence === 'weekly' && styles.recurrenceActive]} 
                                            onPress={() => toggleRecurrence(index)}
                                        >
                                            <Repeat size={14} color={session.recurrence === 'weekly' ? '#2563EB' : '#6B7280'} />
                                            <Text style={[styles.recurrenceText, session.recurrence === 'weekly' && styles.recurrenceTextActive]}>
                                                {session.recurrence === 'weekly' ? 'Recurring (Weekly)' : 'One-time Session'}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                );
                            })}
                        </ScrollView>

                        <View style={styles.footer}>
                            <TouchableOpacity style={styles.secondaryButton} onPress={() => setStep('form')}>
                                <Text style={styles.secondaryButtonText}>Back</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.button, (loading || hasAnyConflict) && styles.buttonDisabled]} 
                                onPress={handleConfirm} 
                                disabled={loading || hasAnyConflict}
                            >
                                {loading ? <ActivityIndicator color="#FFF" /> : (
                                    <>
                                        <Text style={styles.buttonText}>
                                            {hasAnyConflict ? 'Resolve Conflicts' : proposedSessions.every(s => s.status === 'pending_resolution') ? 'Done' : 'Confirm & Lock'}
                                        </Text>
                                        {!hasAnyConflict && <Check size={20} color="#FFF" />}
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
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
        paddingTop: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
    },
    content: {
        flex: 1,
        padding: 20,
    },
    label: {
        fontSize: 16,
        color: '#374151',
        marginBottom: 12,
        fontWeight: '500',
    },
    inputContainer: {
        backgroundColor: '#FFF',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#D1D5DB',
        padding: 12,
        height: 150,
        marginBottom: 20,
    },
    textInput: {
        flex: 1,
        fontSize: 16,
        color: '#111827',
        textAlignVertical: 'top',
    },
    micButton: {
        position: 'absolute',
        bottom: 12,
        right: 12,
        padding: 8,
    },
    button: {
        backgroundColor: '#3B82F6',
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
        color: '#FFF',
        fontSize: 16,
        fontWeight: '600',
    },
    list: {
        flex: 1,
    },
    card: {
        backgroundColor: '#FFF',
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    cardConflict: {
        borderColor: '#FECACA',
        backgroundColor: '#FEF2F2',
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
        color: '#111827',
    },
    time: {
        fontSize: 14,
        color: '#4B5563',
    },
    type: {
        fontSize: 12,
        fontWeight: '700',
        color: '#3B82F6',
        marginTop: 4,
    },
    notes: {
        fontSize: 14,
        color: '#6B7280',
        marginTop: 4,
        fontStyle: 'italic',
    },
    conflictBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#FEE2E2',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 12,
        marginBottom: 8,
    },
    conflictText: {
        color: '#B91C1C',
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
        borderColor: '#D1D5DB',
        alignItems: 'center',
        justifyContent: 'center',
    },
    secondaryButtonText: {
        color: '#374151',
        fontSize: 16,
        fontWeight: '600',
    },
    editLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
    },
    editInput: {
        borderWidth: 1,
        borderColor: '#E5E7EB',
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
        color: '#6B7280',
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
        backgroundColor: '#F3F4F6',
        borderRadius: 8,
        alignSelf: 'flex-start',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    recurrenceActive: {
        backgroundColor: '#EFF6FF',
        borderColor: '#BFDBFE',
    },
    recurrenceText: {
        fontSize: 12,
        color: '#6B7280',
        fontWeight: '500',
    },
    recurrenceTextActive: {
        color: '#2563EB',
        fontWeight: '600',
    },
    clarificationOptions: {
        gap: 12,
        marginTop: 20,
    },
    optionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: '#EFF6FF',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#BFDBFE',
    },
    optionButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#2563EB',
    },
    formGroup: {
        marginBottom: 24,
    },
    formLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
    },
    formInput: {
        backgroundColor: '#FFF',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#D1D5DB',
        padding: 12,
        fontSize: 16,
        color: '#111827',
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
        backgroundColor: '#F3F4F6',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    dayButtonActive: {
        backgroundColor: '#EFF6FF',
        borderColor: '#3B82F6',
    },
    dayButtonText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#6B7280',
    },
    dayButtonTextActive: {
        color: '#3B82F6',
        fontWeight: '600',
    },
    recurrenceButtons: {
        gap: 12,
    },
    optionButtonActive: {
        backgroundColor: '#DBEAFE',
        borderColor: '#3B82F6',
    },
    optionButtonTextActive: {
        color: '#1E40AF',
        fontWeight: '700',
    },
    buttonGroup: {
        flexDirection: 'column',
        gap: 12,
    },
    summaryContainer: {
        marginBottom: 20,
        backgroundColor: '#F9FAFB',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#F3F4F6',
    },
    summaryLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#6B7280',
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
        backgroundColor: '#FFF',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    summaryTagText: {
        fontSize: 13,
        fontWeight: '500',
        color: '#374151',
    },
    inputHighlight: {
        borderColor: '#3B82F6',
        backgroundColor: '#EFF6FF',
    },
    editDatesToggle: {
        marginTop: -16,
        marginBottom: 24,
        padding: 4,
    },
    editDatesText: {
        fontSize: 13,
        color: '#3B82F6',
        fontWeight: '500',
    },
    conversationalHeader: {
        marginBottom: 20,
    },
    conversationalLabel: {
        fontSize: 15,
        color: '#4B5563',
        marginBottom: 4,
        lineHeight: 20,
    },
    subLabel: {
        fontSize: 13,
        color: '#6B7280',
        fontWeight: '400',
    },
    inputHint: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 6,
        fontStyle: 'italic',
    },
    optionSubText: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 2,
    },
});
