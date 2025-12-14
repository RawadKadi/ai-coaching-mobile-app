import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { X, Mic, Send, Calendar, Clock, Check, AlertTriangle, Pencil, Trash2, Save, Repeat } from 'lucide-react-native';
import { parseScheduleRequest, ProposedSession, RateLimitError } from '@/lib/ai-scheduling-service';
import { Session } from '@/types/database';

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
    const [clarification, setClarification] = useState<{ type: string; message: string } | null>(null);
    const [step, setStep] = useState<'input' | 'review' | 'clarification'>('input');
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editForm, setEditForm] = useState<ProposedSession | null>(null);
    const [lastContext, setLastContext] = useState<string>('');

    const handleAnalyze = async () => {
        if (!input.trim()) return;

        setLoading(true);
        try {
            const result = await parseScheduleRequest({
                coachInput: input,
                currentDate: new Date().toISOString(),
                clientContext,
                currentProposedSessions: proposedSessions,
                existingSessions: existingSessions, // Pass existing sessions for context
            });

            if (result.clarification) {
                if (result.clarification.type === 'duration_invalid') {
                    Alert.alert('Invalid Duration', result.clarification.message);
                    return; // Stay on input step
                }
                
                if (result.clarification.type === 'recurrence_ambiguity') {
                    setClarification(result.clarification);
                    setStep('clarification');
                    return;
                }

                // General clarification (missing info)
                setClarification(result.clarification);
                setStep('clarification');
                setLastContext(input); // Save what the user asked
                setInput(''); // Clear input for the user's answer 
            } else {
                setProposedSessions(result.sessions);
                setStep('review');
                setClarification(null);
            }
        } catch (error: any) {
            if (error instanceof RateLimitError || error.name === 'RateLimitError') {
                Alert.alert('AI Usage Limit', error.message);
            } else {
                Alert.alert('Error', 'Failed to understand request. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleConfirm = async () => {
        setLoading(true);
        try {
            await onConfirm(proposedSessions);
            onClose();
            setStep('input');
            setInput('');
            setProposedSessions([]);
        } catch (error) {
            Alert.alert('Error', 'Failed to save sessions.');
        } finally {
            setLoading(false);
        }
    };

    const checkConflict = (session: ProposedSession) => {
        const newStart = new Date(session.scheduled_at);
        const newEnd = new Date(newStart.getTime() + session.duration_minutes * 60000);

        // 1. Check for Overlaps (Coach Availability)
        const overlap = existingSessions.find(existing => {
            const start = new Date(existing.scheduled_at);
            const end = new Date(start.getTime() + existing.duration_minutes * 60000);
            return (newStart < end && newEnd > start);
        });

        if (overlap) return { type: 'overlap', message: 'Overlaps with another session' };

        // 2. Check for One Session Per Day (Client Limit)
        const sameDaySession = existingSessions.find(existing => {
            if (existing.client_id !== targetClientId) return false;
            
            const existingDate = new Date(existing.scheduled_at);
            return existingDate.getDate() === newStart.getDate() &&
                   existingDate.getMonth() === newStart.getMonth() &&
                   existingDate.getFullYear() === newStart.getFullYear();
        });

        if (sameDaySession) return { type: 'limit', message: 'Client already has a session this day' };

        return null;
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

    const handleClarificationResponse = (response: string) => {
        // Send the NEW response as the main input, but keep context of what was asked
        // Use the saved context from the previous turn
        const fullContext = `Original Request: "${lastContext}"\nClarification Answer: "${response}"`;
        setInput(fullContext);
        setStep('input');
        // Trigger analysis immediately? Or let user review?
        // Let's trigger immediately for smoother flow
        setTimeout(() => handleAnalyze(), 100);
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
                    <TouchableOpacity onPress={onClose}>
                        <X size={24} color="#374151" />
                    </TouchableOpacity>
                </View>

                {step === 'input' ? (
                    <View style={styles.content}>
                        <Text style={styles.label}>
                            {clarification?.type === 'general' ? clarification.message : `Tell me when you want to schedule sessions with ${clientContext.name}...`}
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
                ) : step === 'clarification' && clarification ? (
                    <View style={styles.content}>
                        <Text style={styles.label}>{clarification.message}</Text>
                        
                        {clarification.type === 'recurrence_ambiguity' ? (
                            <View style={styles.clarificationOptions}>
                                <TouchableOpacity 
                                    style={styles.optionButton} 
                                    onPress={() => handleClarificationResponse("This specific date only")}
                                >
                                    <Calendar size={20} color="#3B82F6" />
                                    <Text style={styles.optionButtonText}>Just this date</Text>
                                </TouchableOpacity>

                                <TouchableOpacity 
                                    style={styles.optionButton} 
                                    onPress={() => handleClarificationResponse("Every week on this weekday")}
                                >
                                    <Repeat size={20} color="#3B82F6" />
                                    <Text style={styles.optionButtonText}>Every week</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                             <View style={styles.inputContainer}>
                                <TextInput
                                    style={styles.textInput}
                                    multiline
                                    placeholder="Type your answer..."
                                    value={input} // Bind to state to capture text
                                    onChangeText={setInput} // Update state as user types
                                    onSubmitEditing={() => handleClarificationResponse(input)}
                                    returnKeyType="send"
                                />
                                <TouchableOpacity 
                                    style={styles.micButton} 
                                    onPress={() => handleClarificationResponse(input)}
                                >
                                    <Send size={24} color="#3B82F6" />
                                </TouchableOpacity>
                            </View>
                        )}
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
                                            <View style={styles.conflictBadge}>
                                                <AlertTriangle size={12} color="#B91C1C" />
                                                <Text style={styles.conflictText}>{conflict.message}</Text>
                                            </View>
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
                            <TouchableOpacity style={styles.secondaryButton} onPress={() => setStep('input')}>
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
        flex: 1,
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#D1D5DB',
        alignItems: 'center',
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
});
