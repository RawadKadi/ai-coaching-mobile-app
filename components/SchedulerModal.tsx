import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { X, Mic, Send, Calendar, Clock, Check, AlertTriangle, Pencil, Trash2, Save } from 'lucide-react-native';
import { parseScheduleRequest, ProposedSession } from '@/lib/ai-scheduling-service';
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
}

export default function SchedulerModal({ visible, onClose, onConfirm, clientContext, existingSessions }: SchedulerModalProps) {
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [proposedSessions, setProposedSessions] = useState<ProposedSession[]>([]);
    const [clarifyingQuestion, setClarifyingQuestion] = useState<string | null>(null);
    const [step, setStep] = useState<'input' | 'review'>('input');
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editForm, setEditForm] = useState<ProposedSession | null>(null);

    const handleAnalyze = async () => {
        if (!input.trim()) return;

        setLoading(true);
        try {
            const result = await parseScheduleRequest({
                coachInput: input,
                currentDate: new Date().toISOString(),
                clientContext,
                currentProposedSessions: proposedSessions, // Pass current state
            });

            if (result.clarifying_question) {
                setClarifyingQuestion(result.clarifying_question);
                setInput((prev) => prev + '\n\nAnswer: '); 
            } else {
                setProposedSessions(result.sessions);
                setStep('review');
                setClarifyingQuestion(null);
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to understand request. Please try again.');
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
        const newStart = new Date(session.scheduled_at).getTime();
        const newEnd = newStart + session.duration_minutes * 60000;

        return existingSessions.some(existing => {
            const start = new Date(existing.scheduled_at).getTime();
            const end = start + existing.duration_minutes * 60000;
            return (newStart < end && newEnd > start);
        });
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
                            {clarifyingQuestion || `Tell me when you want to schedule sessions with ${clientContext.name}...`}
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
                ) : (
                    <View style={styles.content}>
                        <Text style={styles.label}>Review Proposed Sessions</Text>
                        <ScrollView style={styles.list}>
                            {proposedSessions.map((session, index) => {
                                const hasConflict = checkConflict(session);
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
                                    <View key={index} style={[styles.card, hasConflict && styles.cardConflict]}>
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
                                        
                                        {hasConflict && (
                                            <View style={styles.conflictBadge}>
                                                <AlertTriangle size={12} color="#B91C1C" />
                                                <Text style={styles.conflictText}>Conflict</Text>
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
                                    </View>
                                );
                            })}
                        </ScrollView>

                        <View style={styles.footer}>
                            <TouchableOpacity style={styles.secondaryButton} onPress={() => setStep('input')}>
                                <Text style={styles.secondaryButtonText}>Back</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.button} onPress={handleConfirm} disabled={loading}>
                                {loading ? <ActivityIndicator color="#FFF" /> : (
                                    <>
                                        <Text style={styles.buttonText}>Confirm & Lock</Text>
                                        <Check size={20} color="#FFF" />
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
});
