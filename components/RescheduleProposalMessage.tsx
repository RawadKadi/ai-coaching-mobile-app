import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Modal, ScrollView } from 'react-native';
import { Clock, Calendar, CheckCircle2, X, Check } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { RescheduleMessageMetadata } from '@/types/conflict';

interface RescheduleProposalMessageProps {
    messageId: string;
    metadata: RescheduleMessageMetadata;
    isOwn: boolean;
}

export default function RescheduleProposalMessage({ messageId, metadata, isOwn }: RescheduleProposalMessageProps) {
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState(metadata.status || 'pending');
    const [acceptedSlot, setAcceptedSlot] = useState(metadata.acceptedSlot || null);
    const [showPicker, setShowPicker] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState<string | null>(null); // NEW: Track selected slot

    const slots = metadata.availableSlots || metadata.proposedSlots || [];

    const handleConfirmSlot = async () => {
        if (!selectedSlot || loading) return;

        setLoading(true);
        try {
            console.log('[Client] Confirming slot:', selectedSlot);
            
            let sessionId = metadata.sessionId;
            
            // If sessionId is null, we need to CREATE a new session (Option 1 case)
            if (!sessionId && metadata.proposedSessionData) {
                console.log('[Client] Creating new session for Option 1');
                const { data: newSession, error: createError } = await supabase
                    .from('sessions')
                    .insert({
                        coach_id: metadata.proposedSessionData.coach_id,
                        client_id: metadata.proposedSessionData.client_id,
                        scheduled_at: selectedSlot,
                        duration_minutes: metadata.proposedSessionData.duration_minutes,
                        session_type: metadata.proposedSessionData.session_type,
                        status: 'scheduled',
                        invite_sent: true,
                        meet_link: `https://meet.jit.si/${metadata.proposedSessionData.coach_id}-${metadata.proposedSessionData.client_id}-${Date.now()}`,
                    })
                    .select()
                    .single();
                
                if (createError) {
                    console.error('[Client] Session creation error:', createError);
                    throw new Error(createError.message);
                }
                
                sessionId = newSession.id;
                console.log('[Client] New session created:', sessionId);
            } 
            // If sessionId exists, UPDATE the existing session (Option 2 case)
            else if (sessionId) {
                console.log('[Client] Updating existing session:', sessionId);
                const { error: sessionError } = await supabase
                    .from('sessions')
                    .update({ 
                        scheduled_at: selectedSlot,
                        status: 'scheduled',
                        cancellation_reason: null,
                        invite_sent: true
                    })
                    .eq('id', sessionId);

                if (sessionError) {
                    console.error('[Client] Session update error:', sessionError);
                    throw new Error(sessionError.message);
                }
            } else {
                throw new Error('Missing session data - cannot create or update session');
            }

            // Update message to mark as accepted
            const { error: msgError } = await supabase
                .from('messages')
                .update({
                    content: JSON.stringify({
                        ...metadata,
                        sessionId: sessionId, // Update with the actual sessionId
                        status: 'accepted',
                        acceptedSlot: selectedSlot
                    })
                })
                .eq('id', messageId);

            if (msgError) {
                console.error('[Client] Message update error:', msgError);
                throw new Error(msgError.message);
            }

            setStatus('accepted');
            setAcceptedSlot(selectedSlot);
            setShowPicker(false);
            setSelectedSlot(null);
            Alert.alert('Success', 'Session scheduled successfully!');

        } catch (error: any) {
            console.error('[Client] Error confirming slot:', error);
            Alert.alert('Scheduling Failed', error.message || 'Failed to schedule. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleDecline = async () => {
        if (loading || status !== 'pending') return;

        Alert.alert(
            'Decline Request',
            'Are you sure you want to decline this request?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Decline',
                    style: 'destructive',
                    onPress: async () => {
                        setLoading(true);
                        try {
                            await supabase
                                .from('sessions')
                                .update({ cancellation_reason: 'reschedule_rejected' })
                                .eq('id', metadata.sessionId);

                            await supabase
                                .from('messages')
                                .update({
                                    content: JSON.stringify({
                                        ...metadata,
                                        status: 'declined'
                                    })
                                })
                                .eq('id', messageId);
                            
                            setStatus('declined');
                        } catch (error) {
                            console.error('Error declining:', error);
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    const originalDate = new Date(metadata.originalTime);
    const isPending = status === 'pending';
    const isAccepted = status === 'accepted';
    const isDeclined = status === 'declined';

    return (
        <View style={[styles.container, isOwn ? styles.ownContainer : styles.theirContainer]}>
            <View style={styles.header}>
                <Calendar size={20} color="#B45309" />
                <Text style={styles.title}>Reschedule Request</Text>
            </View>
            
            <Text style={styles.description}>
                {metadata.text || `The coach has proposed new times for your session on ${originalDate.toLocaleDateString()}.`}
            </Text>

            {isAccepted && acceptedSlot ? (
                <View style={styles.acceptedContainer}>
                    <CheckCircle2 size={24} color="#059669" />
                    <Text style={styles.acceptedText}>
                        Rescheduled to: {new Date(acceptedSlot).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    </Text>
                </View>
            ) : isDeclined ? (
                <View style={[styles.acceptedContainer, { borderColor: '#EF4444', backgroundColor: '#FEF2F2' }]}>
                    <Text style={[styles.acceptedText, { color: '#B91C1C' }]}>Request Declined</Text>
                </View>
            ) : (
                <View style={styles.actionsContainer}>
                    {isPending && (
                        <>
                            <TouchableOpacity 
                                style={styles.primaryButton}
                                onPress={() => setShowPicker(true)}
                                disabled={loading}
                            >
                                <Calendar size={16} color="#FFF" />
                                <Text style={styles.primaryButtonText}>View Available Times</Text>
                            </TouchableOpacity>

                            {(metadata.mode === 'confirm_reschedule' || metadata.mode === 'accept_reject') && (
                                <TouchableOpacity 
                                    style={[styles.slotButton, styles.declineButton]}
                                    onPress={handleDecline}
                                    disabled={loading}
                                >
                                    <Text style={styles.declineText}>Decline Request</Text>
                                </TouchableOpacity>
                            )}
                        </>
                    )}
                </View>
            )}

            {/* Slot Picker Modal */}
            <Modal visible={showPicker} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Select a New Time</Text>
                            <TouchableOpacity onPress={() => { setShowPicker(false); setSelectedSlot(null); }}>
                                <X size={24} color="#374151" />
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.modalSubtitle}>
                            {selectedSlot ? 'Tap "Confirm" to finalize' : 'Please choose a time slot:'}
                        </Text>
                        
                        <ScrollView style={styles.slotsList}>
                            {slots.map((slot, index) => {
                                const slotDate = new Date(slot);
                                const dayName = slotDate.toLocaleDateString([], { weekday: 'long' });
                                const dateStr = slotDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
                                const isSelected = selectedSlot === slot;

                                return (
                                    <TouchableOpacity 
                                        key={index} 
                                        style={[styles.modalSlot, isSelected && styles.modalSlotSelected]}
                                        onPress={() => setSelectedSlot(slot)}
                                        activeOpacity={0.7}
                                    >
                                        <Clock size={18} color={isSelected ? "#3B82F6" : "#6B7280"} />
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.modalSlotText, isSelected && styles.modalSlotTextSelected]}>
                                                {slotDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                                            </Text>
                                            <Text style={styles.modalSlotSubtext}>
                                                {metadata.recurrence === 'weekly' ? `${dayName}s (starting ${dateStr})` : dateStr}
                                            </Text>
                                        </View>
                                        {isSelected && <Check size={20} color="#3B82F6" />}
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>

                        {/* Confirm Button */}
                        {selectedSlot && (
                            <TouchableOpacity 
                                style={[styles.confirmButton, loading && styles.confirmButtonDisabled]}
                                onPress={handleConfirmSlot}
                                disabled={loading}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#FFF" />
                                ) : (
                                    <>
                                        <Check size={20} color="#FFF" />
                                        <Text style={styles.confirmButtonText}>Confirm Slot</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        maxWidth: '85%',
        padding: 16,
        borderRadius: 16,
        marginVertical: 6,
        backgroundColor: '#FEFCE8',
        borderWidth: 1,
        borderColor: '#FEF08A',
    },
    ownContainer: {
        alignSelf: 'flex-end',
        borderBottomRightRadius: 4,
    },
    theirContainer: {
        alignSelf: 'flex-start',
        borderBottomLeftRadius: 4,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    title: {
        fontSize: 16,
        fontWeight: '700',
        color: '#B45309',
    },
    description: {
        fontSize: 14,
        color: '#92400E',
        lineHeight: 20,
        marginBottom: 12,
    },
    actionsContainer: {
        marginTop: 4,
        gap: 8,
    },
    primaryButton: {
        backgroundColor: '#3B82F6',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
    },
    primaryButtonText: {
        color: '#FFF',
        fontSize: 15,
        fontWeight: '600',
    },
    slotButton: {
        backgroundColor: '#FFFFFF',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    declineButton: {
        backgroundColor: '#FEF2F2',
        borderColor: '#FCA5A5',
        alignItems: 'center',
    },
    declineText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#B91C1C',
    },
    acceptedContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#ECFDF5',
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#10B981',
        marginTop: 4,
    },
    acceptedText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#065F46',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#FFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        maxHeight: '85%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
    },
    modalSubtitle: {
        fontSize: 15,
        color: '#6B7280',
        marginBottom: 16,
        fontWeight: '500',
    },
    slotsList: {
        maxHeight: 400,
        marginBottom: 16,
    },
    modalSlot: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#F9FAFB',
        borderRadius: 14,
        marginBottom: 10,
        borderWidth: 2,
        borderColor: '#F3F4F6',
        gap: 14,
    },
    modalSlotSelected: {
        backgroundColor: '#EFF6FF',
        borderColor: '#3B82F6',
    },
    modalSlotText: {
        fontSize: 17,
        color: '#111827',
        fontWeight: '600',
        marginBottom: 2,
    },
    modalSlotTextSelected: {
        color: '#1E40AF',
    },
    modalSlotSubtext: {
        fontSize: 13,
        color: '#6B7280',
    },
    confirmButton: {
        backgroundColor: '#059669',
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginTop: 8,
    },
    confirmButtonDisabled: {
        opacity: 0.6,
    },
    confirmButtonText: {
        color: '#FFF',
        fontSize: 17,
        fontWeight: '700',
    },
});
