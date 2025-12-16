import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Clock, Calendar, CheckCircle2 } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';

interface RescheduleProposalMessageProps {
    messageId: string;
    metadata: {
        sessionId: string;
        originalTime: string;
        proposedSlots: string[];
        status?: 'pending' | 'accepted' | 'declined';
        acceptedSlot?: string;
        mode?: 'select_time' | 'accept_reject';
        text?: string;
    };
    isOwn: boolean;
}

export default function RescheduleProposalMessage({ messageId, metadata, isOwn }: RescheduleProposalMessageProps) {
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState(metadata.status || 'pending');
    const [acceptedSlot, setAcceptedSlot] = useState(metadata.acceptedSlot || null);

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
                                    status: 'scheduled' // Ensure it's active
                                })
                                .eq('id', metadata.sessionId);

                            if (sessionError) throw sessionError;

                            // 2. Update the message metadata to reflect acceptance
                            const { error: msgError } = await supabase
                                .from('messages')
                                .update({
                                    metadata: {
                                        ...metadata,
                                        status: 'accepted',
                                        acceptedSlot: slot
                                    }
                                })
                                .eq('id', messageId);

                            if (msgError) throw msgError;

                            // 3. Send confirmation message (Optional, or handled by realtime)
                            
                            setStatus('accepted');
                            setAcceptedSlot(slot);
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
                            // Update message metadata
                            await supabase
                                .from('messages')
                                .update({
                                    metadata: {
                                        ...metadata,
                                        status: 'declined'
                                    }
                                })
                                .eq('id', messageId);
                            
                            // If it was a pending session (Option 1), maybe cancel it?
                            // But for Option 2 (Existing), we just keep the old session.
                            // Since we don't know which session ID corresponds to what without more context,
                            // we'll just mark the proposal as declined. 
                            // The coach will see the status update.

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
                <Calendar size={20} color="#B91C1C" />
                <Text style={styles.title}>Reschedule Proposal</Text>
            </View>
            
            <Text style={styles.description}>
                {metadata.text || `The coach has proposed new times for your session on ${originalDate.toLocaleDateString()}.`}
            </Text>

            {status === 'accepted' && acceptedSlot ? (
                <View style={styles.acceptedContainer}>
                    <CheckCircle2 size={24} color="#059669" />
                    <Text style={styles.acceptedText}>
                        You accepted: {new Date(acceptedSlot).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    </Text>
                </View>
            ) : status === 'declined' ? (
                <View style={[styles.acceptedContainer, { borderColor: '#EF4444', backgroundColor: '#FEF2F2' }]}>
                    <Text style={[styles.acceptedText, { color: '#B91C1C' }]}>
                        You declined this request.
                    </Text>
                </View>
            ) : (
                <View style={styles.slotsContainer}>
                    {metadata.proposedSlots.map((slot, index) => (
                        <TouchableOpacity 
                            key={index} 
                            style={styles.slotButton}
                            onPress={() => handleAcceptSlot(slot)}
                            disabled={loading}
                        >
                            <Clock size={16} color="#374151" />
                            <Text style={styles.slotText}>
                                {new Date(slot).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                            </Text>
                            {loading && <ActivityIndicator size="small" color="#374151" />}
                        </TouchableOpacity>
                    ))}
                    
                    {metadata.mode === 'accept_reject' && (
                        <TouchableOpacity 
                            style={[styles.slotButton, styles.declineButton]}
                            onPress={handleDecline}
                            disabled={loading}
                        >
                            <Text style={styles.declineText}>Decline Request</Text>
                        </TouchableOpacity>
                    )}
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        maxWidth: '80%',
        padding: 16,
        borderRadius: 16,
        marginVertical: 4,
        backgroundColor: '#FEF2F2', // Light red bg for urgency/attention
        borderWidth: 1,
        borderColor: '#FECACA',
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
        color: '#B91C1C',
    },
    description: {
        fontSize: 14,
        color: '#7F1D1D',
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
});
