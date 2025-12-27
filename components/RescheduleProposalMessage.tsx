import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Modal, ScrollView } from 'react-native';
import { Clock, Calendar, CheckCircle2, X } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';

interface RescheduleProposalMessageProps {
    messageId: string;
    metadata: {
        sessionId: string;
        originalTime: string;
        availableSlots?: string[];
        proposedSlots?: string[]; // Legacy support
        status?: 'pending' | 'accepted' | 'declined';
        acceptedSlot?: string;
        mode?: 'select_time' | 'accept_reject' | 'open_calendar' | 'confirm_reschedule';
        text?: string;
        recurrence?: 'weekly' | 'once';
        dayOfWeek?: string;
    };
    isOwn: boolean;
}

export default function RescheduleProposalMessage({ messageId, metadata, isOwn }: RescheduleProposalMessageProps) {
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState(metadata.status || 'pending');
    const [acceptedSlot, setAcceptedSlot] = useState(metadata.acceptedSlot || null);
    const [showPicker, setShowPicker] = useState(false);

    const slots = metadata.availableSlots || metadata.proposedSlots || [];

    const handleAcceptSlot = async (slot: string) => {
        if (loading || status !== 'pending') return;

        Alert.alert(
            'Confirm Reschedule',
            `Are you sure you want to move your session to ${new Date(slot).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Confirm',
                    onPress: async () => {
                        setLoading(true);
                        try {
                            // 1. Update the session in the database
                            const { error: sessionError } = await supabase
                                .from('sessions')
                                .update({ 
                                    scheduled_at: slot,
                                    status: 'scheduled' 
                                })
                                .eq('id', metadata.sessionId);

                            if (sessionError) throw sessionError;

                            // 2. Update the message metadata
                            const { error: msgError } = await supabase
                                .from('messages')
                                .update({
                                    content: JSON.stringify({
                                        ...metadata,
                                        status: 'accepted',
                                        acceptedSlot: slot
                                    })
                                })
                                .eq('id', messageId);

                            if (msgError) throw msgError;

                            setStatus('accepted');
                            setAcceptedSlot(slot);
                            setShowPicker(false);
                            Alert.alert('Success', 'Session rescheduled successfully!');

                        } catch (error) {
                            console.error('Error rescheduling:', error);
                            Alert.alert('Error', 'Failed to reschedule. Please try again.');
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    const handleDecline = async () => {
        if (loading || status !== 'pending') return;

        Alert.alert(
            'Decline Request',
            'Are you sure you want to decline this rescheduling request?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Decline',
                    style: 'destructive',
                    onPress: async () => {
                        setLoading(true);
                        try {
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

    return (
        <View style={[styles.container, isOwn ? styles.ownContainer : styles.theirContainer]}>
            <View style={styles.header}>
                <Calendar size={20} color="#B45309" />
                <Text style={styles.title}>Reschedule Request</Text>
            </View>
            
            <Text style={styles.description}>
                {metadata.text || `The coach has proposed new times for your session on ${originalDate.toLocaleDateString()}.`}
            </Text>

            {status === 'accepted' && acceptedSlot ? (
                <View style={styles.acceptedContainer}>
                    <CheckCircle2 size={24} color="#059669" />
                    <Text style={styles.acceptedText}>
                        Rescheduled to: {new Date(acceptedSlot).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    </Text>
                </View>
            ) : status === 'declined' ? (
                <View style={[styles.acceptedContainer, { borderColor: '#EF4444', backgroundColor: '#FEF2F2' }]}>
                    <Text style={[styles.acceptedText, { color: '#B91C1C' }]}>
                        You declined this request.
                    </Text>
                </View>
            ) : (
                <View style={styles.actionsContainer}>
                    {/* Mode: Open Calendar (Option 1) */}
                    {(metadata.mode === 'open_calendar' || metadata.mode === 'select_time') && (
                        <TouchableOpacity 
                            style={styles.primaryButton}
                            onPress={() => setShowPicker(true)}
                            disabled={loading}
                        >
                            <Calendar size={16} color="#FFF" />
                            <Text style={styles.primaryButtonText}>Open Calendar</Text>
                        </TouchableOpacity>
                    )}

                    {/* Mode: Confirm Reschedule (Option 2) */}
                    {(metadata.mode === 'confirm_reschedule' || metadata.mode === 'accept_reject') && (
                        <View style={styles.row}>
                            <TouchableOpacity 
                                style={[styles.primaryButton, { flex: 1, backgroundColor: '#059669', borderColor: '#059669' }]}
                                onPress={() => setShowPicker(true)} // Accepting means picking a new time
                                disabled={loading}
                            >
                                <Text style={styles.primaryButtonText}>Accept & Reschedule</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.slotButton, styles.declineButton, { flex: 1, marginTop: 0 }]}
                                onPress={handleDecline}
                                disabled={loading}
                            >
                                <Text style={styles.declineText}>Decline</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            )}

            {/* Slot Picker Modal */}
            <Modal visible={showPicker} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Select a New Time</Text>
                            <TouchableOpacity onPress={() => setShowPicker(false)}>
                                <X size={24} color="#374151" />
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.modalSubtitle}>Available slots:</Text>
                        <ScrollView style={styles.slotsList}>
                            {(() => {
                                const filteredSlots = slots.filter(slot => {
                                    const slotDate = new Date(slot);
                                    if (metadata.recurrence === 'weekly') {
                                        const originalDay = originalDate.getDay();
                                        return slotDate.getDay() === originalDay;
                                    }
                                    if (metadata.recurrence === 'once') {
                                        return slotDate.getFullYear() === originalDate.getFullYear() &&
                                               slotDate.getMonth() === originalDate.getMonth() &&
                                               slotDate.getDate() === originalDate.getDate();
                                    }
                                    return true;
                                });

                                // Fallback: if filter returns nothing, show all slots (better than empty)
                                const displaySlots = filteredSlots.length > 0 ? filteredSlots : slots;

                                return displaySlots.map((slot, index) => {
                                    const slotDate = new Date(slot);
                                    const isSameDay = slotDate.getFullYear() === originalDate.getFullYear() &&
                                                     slotDate.getMonth() === originalDate.getMonth() &&
                                                     slotDate.getDate() === originalDate.getDate();
                                    
                                    // For weekly, we want to show the day name clearly
                                    const dayName = slotDate.toLocaleDateString([], { weekday: 'long' });
                                    const dateStr = slotDate.toLocaleDateString([], { month: 'short', day: 'numeric' });

                                    return (
                                        <TouchableOpacity 
                                            key={index} 
                                            style={styles.modalSlot}
                                            onPress={() => handleAcceptSlot(slot)}
                                        >
                                            <Clock size={16} color="#374151" />
                                            <View>
                                                <Text style={styles.modalSlotText}>
                                                    {slotDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                                                </Text>
                                                <Text style={styles.modalSlotSubtext}>
                                                    {metadata.recurrence === 'weekly' ? `${dayName}s (starting ${dateStr})` : dateStr}
                                                </Text>
                                            </View>
                                        </TouchableOpacity>
                                    );
                                });
                            })()}
                            {slots.length === 0 && (
                                <Text style={styles.noSlotsText}>No slots available.</Text>
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        maxWidth: '80%',
        padding: 16,
        borderRadius: 16,
        marginVertical: 4,
        backgroundColor: '#FEFCE8', // Yellow-50
        borderWidth: 1,
        borderColor: '#FEF08A', // Yellow-200
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
        color: '#B45309', // Yellow-700
    },
    description: {
        fontSize: 14,
        color: '#92400E', // Yellow-800
        marginBottom: 12,
    },
    slotsContainer: {
        gap: 8,
    },
    slotButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#FFFFFF',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    slotText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
    },
    acceptedContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#ECFDF5',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#10B981',
    },
    acceptedText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#065F46',
    },
    declineButton: {
        marginTop: 8,
        backgroundColor: '#FEF2F2',
        borderColor: '#FCA5A5',
        justifyContent: 'center',
    },
    declineText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#B91C1C',
    },
    actionsContainer: {
        marginTop: 12,
        gap: 8,
    },
    row: {
        flexDirection: 'row',
        gap: 8,
    },
    primaryButton: {
        backgroundColor: '#3B82F6',
        padding: 12,
        borderRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        borderWidth: 1,
        borderColor: '#2563EB',
    },
    primaryButtonText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '600',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#FFF',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        maxHeight: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
    },
    modalSubtitle: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 12,
    },
    slotsList: {
        maxHeight: 400,
    },
    modalSlot: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#F3F4F6',
        borderRadius: 12,
        marginBottom: 8,
        gap: 12,
    },
    modalSlotText: {
        fontSize: 16,
        color: '#374151',
        fontWeight: '500',
    },
    modalSlotSubtext: {
        fontSize: 12,
        color: '#6B7280',
    },
    noSlotsText: {
        textAlign: 'center',
        color: '#6B7280',
        marginTop: 20,
        marginBottom: 20,
    },
});
