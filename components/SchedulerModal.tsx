import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { X, Mic, Send, Calendar, Clock, Check, AlertTriangle, Pencil, Trash2, Save, Repeat } from 'lucide-react-native';
import { parseScheduleRequest, ProposedSession, RateLimitError } from '@/lib/ai-scheduling-service';
import { parseSchedulingInput } from '@/lib/scheduling-parser';
import { Session } from '@/types/database';
import ConflictResolutionModal from './ConflictResolutionModal';
import { ConflictInfo, Resolution } from '@/types/conflict';
import { findAvailableSlots } from '@/lib/time-slot-finder';

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

    const handleAnalyze = async () => {
        if (!input.trim()) return;

        // Parse the input client-side
        const parsed = parseSchedulingInput(input);
        
        // Check what we have and what we need
        const needsDates = !parsed.hasDate && formDates.length === 0;
        const needsTime = !parsed.hasTime && !formTime;
        const needsRecurrence = parsed.recurrence === null && formRecurrence === null;

        // If we're missing date or time, show the form
        if (needsDates || needsTime) {
            setFormTime(parsed.time || formTime || '');
            setFormDates(parsed.dates || formDates);
            setStep('form');
            return;
        }

        // If we have both date and time but recurrence is unclear, ask
        if (needsRecurrence) {
            setFormTime(parsed.time || formTime);
            setFormDates(parsed.dates || formDates);
            setStep('form');
            return;
        }

        // We have everything, proceed to AI validation
        await finalizeWithAI(
            parsed.time || formTime,
            parsed.dates || formDates,
            parsed.recurrence || formRecurrence || 'once'
        );
    };


    const resolveDateKeywordToISO = (keyword: string): string => {
        const now = new Date();
        const dayMap: { [key: string]: number } = {
            'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
            'thursday': 4, 'friday': 5, 'saturday': 6
        };

        if (keyword === 'today') {
            return now.toISOString().split('T')[0];
        } else if (keyword === 'tomorrow') {
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);
            return tomorrow.toISOString().split('T')[0];
        } else if (keyword in dayMap) {
            // For day names, resolve to the actual date
            const targetDay = dayMap[keyword];
            const currentDay = now.getDay();
            let daysToAdd = targetDay - currentDay;
            
            // If it's the same day as today, use today's date
            if (daysToAdd === 0) {
                return now.toISOString().split('T')[0];
            }
            
            // Otherwise get the next occurrence of this day
            if (daysToAdd < 0) daysToAdd += 7;
            
            const targetDate = new Date(now);
            targetDate.setDate(targetDate.getDate() + daysToAdd);
            return targetDate.toISOString().split('T')[0];
        }
        
        return keyword; // Fallback
    };

    const finalizeWithAI = async (time: string, dates: string[], recurrence: 'once' | 'weekly') => {
        setLoading(true);
        try {
            // Resolve all date keywords to ISO dates and deduplicate
            const resolvedDates = dates.map(d => resolveDateKeywordToISO(d));
            const uniqueDates = Array.from(new Set(resolvedDates));
            
            const allSessions: ProposedSession[] = [];
            
            // Create a session for each unique date
            for (const isoDate of uniqueDates) {
                const result = await parseScheduleRequest({
                    coachInput: `Schedule on ${isoDate} at ${time} ${recurrence === 'weekly' ? 'every week' : 'one time'}`,
                    currentDate: new Date().toISOString(),
                    clientContext,
                    currentProposedSessions: proposedSessions,
                    existingSessions: existingSessions,
                });

                if (result.sessions && result.sessions.length > 0) {
                    allSessions.push(...result.sessions);
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

    const handleFormSubmit = () => {
        // Validate form
        if (!formTime || formDates.length === 0 || !formRecurrence) {
            Alert.alert('Missing Information', 'Please fill in all fields.');
            return;
        }
        
        finalizeWithAI(formTime, formDates, formRecurrence);
    };

    const handleConfirm = async () => {
        setLoading(true);
        try {
            await onConfirm(proposedSessions);
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
                existingSession: overlap
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
                existingSession: sameDaySession
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
            },
            proposedSession: {
                client_id: targetClientId,
                client_name: clientContext.name,
                scheduled_at: session.scheduled_at,
                duration_minutes: session.duration_minutes,
                session_type: session.session_type,
            },
            recommendations,
        };

        setConflictInfo(conflictData);
        setShowConflictModal(true);
    };

    const handleResolution = (resolution: Resolution) => {
        if (resolution.action === 'cancel') {
            setShowConflictModal(false);
            setConflictInfo(null);
            return;
        }

        if (resolution.action === 'keep_existing_reschedule_new' && resolution.newTime) {
            // Update the proposed session to the new time
            const updatedSessions = proposedSessions.map(session => {
                if (conflictInfo && session.scheduled_at === conflictInfo.proposedSession.scheduled_at) {
                    return { ...session, scheduled_at: resolution.newTime! };
                }
                return session;
            });
            setProposedSessions(updatedSessions);
            setShowConflictModal(false);
            setConflictInfo(null);
            Alert.alert('Resolved', 'Session rescheduled successfully');
        } else if (resolution.action === 'reschedule_existing' && resolution.newTime) {
            // This would require updating the existing session in the database
            // For now, show a message that this requires backend implementation
            Alert.alert(
                'Advanced Feature',
                'Rescheduling existing sessions requires additional implementation. For now, please cancel this scheduling and manually reschedule the existing session.',
            );
            setShowConflictModal(false);
            setConflictInfo(null);
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
                        <Text style={styles.label}>Complete the schedule details</Text>
                        
                        {/* Time Input */}
                        <View style={styles.formGroup}>
                            <Text style={styles.formLabel}>Time {formTime && '✓'}</Text>
                            <TextInput
                                style={styles.formInput}
                                placeholder="e.g., 7:25pm"
                                value={formTime}
                                onChangeText={(text) => {
                                    const parsed = parseSchedulingInput(`at ${text}`);
                                    setFormTime(parsed.time || text);
                                }}
                            />
                        </View>

                        {/* Date Input - Multiple Selection */}
                        <View style={styles.formGroup}>
                            <Text style={styles.formLabel}>Dates {formDates.length > 0 && `✓ (${formDates.length} selected)`}</Text>
                            <View style={styles.dateButtons}>
                                {['today', 'tomorrow', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday'].map((day) => (
                                    <TouchableOpacity
                                        key={day}
                                        style={[styles.dayButton, formDates.includes(day) && styles.dayButtonActive]}
                                        onPress={() => {
                                            // Toggle date selection
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

                        {/* Recurrence */}
                        {formTime && formDates.length > 0 && (
                            <View style={styles.formGroup}>
                                <Text style={styles.formLabel}>Recurrence {formRecurrence && '✓'}</Text>
                                <View style={styles.recurrenceButtons}>
                                    <TouchableOpacity
                                        style={[styles.optionButton, formRecurrence === 'once' && styles.optionButtonActive]}
                                        onPress={() => setFormRecurrence('once')}
                                    >
                                        <Calendar size={20} color={formRecurrence === 'once' ? '#3B82F6' : '#6B7280'} />
                                        <Text style={[styles.optionButtonText, formRecurrence === 'once' && styles.optionButtonTextActive]}>
                                            Just this date
                                        </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.optionButton, formRecurrence === 'weekly' && styles.optionButtonActive]}
                                        onPress={() => setFormRecurrence('weekly')}
                                    >
                                        <Repeat size={20} color={formRecurrence === 'weekly' ? '#3B82F6' : '#6B7280'} />
                                        <Text style={[styles.optionButtonText, formRecurrence === 'weekly' && styles.optionButtonTextActive]}>
                                            Every week
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}

                        <View style={styles.buttonGroup}>
                            <TouchableOpacity
                                style={[styles.button, (!formTime || formDates.length === 0 || !formRecurrence || loading) && styles.buttonDisabled]}
                                onPress={handleFormSubmit}
                                disabled={!formTime || formDates.length === 0 || !formRecurrence || loading}
                            >
                                {loading ? <ActivityIndicator color="#FFF" /> : (
                                    <>
                                        <Text style={styles.buttonText}>Create Schedule</Text>
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
                                const conflict = checkConflict(session);
                                const isEditing = editingIndex === index;

                                if (isEditing && editForm) {
                                    return (
                                        <View key={index} style={styles.card}>
                                            <Text style={styles.editLabel}>Edit Session</Text>
                                            <TextInput
                                                style={styles.editInput}
                                                value={editForm.notes}
                                                onChangeText={(text) => setEditForm({...editForm, notes: text})}
                                                placeholder="Notes"
                                            />
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
                                        
                                        {conflict && (
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
                                            {hasAnyConflict ? 'Resolve Conflicts' : 'Confirm & Lock'}
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
});
