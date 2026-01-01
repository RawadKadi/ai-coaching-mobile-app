import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Alert, ScrollView, SafeAreaView } from 'react-native';
import { X, AlertTriangle, Check, Calendar, Clock } from 'lucide-react-native';
import TimelineView from './TimelineView';
import { ConflictInfo, Resolution, TimeSlotRecommendation } from '@/types/conflict';

interface ConflictResolutionModalProps {
    visible: boolean;
    conflictInfo: ConflictInfo | null;
    onResolve: (resolution: Resolution) => void;
    onCancel: () => void;
}

// Reusable Time Slot Picker Modal
const TimeSlotPicker = ({ 
    visible, 
    onClose, 
    onSelect, 
    slots, 
    selectedTime 
}: { 
    visible: boolean; 
    onClose: () => void; 
    onSelect: (time: string) => void; 
    slots: TimeSlotRecommendation[]; 
    selectedTime: string | null;
}) => (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
        <View style={styles.pickerOverlay}>
            <View style={styles.pickerContainer}>
                <View style={styles.pickerHeader}>
                    <Text style={styles.pickerTitle}>Select a Time</Text>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <X size={24} color="#374151" />
                    </TouchableOpacity>
                </View>
                <Text style={styles.pickerSubtitle}>{slots.length} available slots</Text>
                
                <ScrollView style={styles.pickerList}>
                    {slots.map((rec, idx) => (
                        <TouchableOpacity
                            key={idx}
                            style={[
                                styles.pickerItem,
                                selectedTime === rec.time && styles.pickerItemSelected
                            ]}
                            onPress={() => {
                                onSelect(rec.time);
                                onClose();
                            }}
                        >
                            <View style={styles.pickerItemContent}>
                                <Text style={[styles.pickerItemLabel, selectedTime === rec.time && styles.pickerItemLabelSelected]}>
                                    {rec.label}
                                </Text>
                                <Text style={styles.pickerItemReason}>{rec.reason}</Text>
                            </View>
                            {selectedTime === rec.time && <Check size={20} color="#3B82F6" />}
                        </TouchableOpacity>
                    ))}
                    <View style={{ height: 40 }} /> 
                </ScrollView>
            </View>
        </View>
    </Modal>
);

export default function ConflictResolutionModal({ visible, conflictInfo, onResolve, onCancel }: ConflictResolutionModalProps) {
    const [selectedOption, setSelectedOption] = useState<'keep' | 'reschedule' | null>(null);
    const [selectedNewTime, setSelectedNewTime] = useState<string | null>(null);
    const [showTimePicker, setShowTimePicker] = useState(false);

    if (!conflictInfo) return null;

    const handleResolve = () => {
        console.log('[ConflictModal] =================================');
        console.log('[ConflictModal] handleResolve START');
        console.log('[ConflictModal] selectedOption:', selectedOption);
        
        if (!selectedOption) {
            Alert.alert('Selection Required', 'Please select a resolution option');
            return;
        }

        // Pass ALL available slots so the client can choose
        const availableSlots = recommendations.map(r => r.time);
        console.log('[ConflictModal] Available slots:', availableSlots);

        try {
            if (selectedOption === 'keep') {
                // Option 1: Propose new time to INCOMING client
                console.log('[ConflictModal] About to call onResolve with Option 1');
                onResolve({
                    action: 'propose_new_time_for_incoming',
                    proposedSlots: availableSlots,
                });
                console.log('[ConflictModal] onResolve called successfully for Option 1');
            } else if (selectedOption === 'reschedule') {
                // Option 2: Propose reschedule to EXISTING client
                console.log('[ConflictModal] About to call onResolve with Option 2');
                onResolve({
                    action: 'propose_reschedule_for_existing',
                    targetSessionId: conflictInfo.existingSession.id,
                    proposedSlots: availableSlots,
                });
                console.log('[ConflictModal] onResolve called successfully for Option 2');
            }
        } catch (error) {
            console.error('[ConflictModal] ERROR calling onResolve:', error);
            Alert.alert('Error', 'Failed to call onResolve: ' + error);
        }
        
        console.log('[ConflictModal] handleResolve END');
        console.log('[ConflictModal] =================================');
    };

    const handleCancel = () => {
        onResolve({ action: 'cancel' });
        onCancel();
    };

    const { existingSession, proposedSession, recommendations } = conflictInfo;
    const isWeekly = proposedSession.recurrence === 'weekly';
    const dayName = new Date(proposedSession.scheduled_at).toLocaleDateString('en-US', { weekday: 'long' });
    
    const conflictDate = isWeekly 
        ? `Every ${dayName}`
        : new Date(proposedSession.scheduled_at).toLocaleDateString('en-US', { 
            weekday: 'long', 
            month: 'long', 
            day: 'numeric' 
        });
    const conflictTime = new Date(proposedSession.scheduled_at).toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
            <View style={styles.container}>
                {/* ... (Header) */}
                <View style={styles.header}>
                    <View style={styles.headerContent}>
                        <AlertTriangle size={24} color="#EF4444" />
                        <Text style={styles.title}>Conflict Detected</Text>
                    </View>
                    <TouchableOpacity onPress={handleCancel}>
                        <X size={24} color="#374151" />
                    </TouchableOpacity>
                </View>

                <ScrollView style={styles.content}>
                    {/* ... (Info Card, Timeline, Session Details remain same) */}
                    <View style={styles.infoCard}>
                        <View style={styles.infoHeader}>
                            <AlertTriangle size={20} color="#B91C1C" />
                            <Text style={styles.infoTitle}>Time Conflict Detected</Text>
                        </View>
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Day/Date:</Text>
                            <Text style={styles.infoValue}>{conflictDate}</Text>
                        </View>
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Time:</Text>
                            <Text style={styles.infoValue}>{conflictTime} - {new Date(new Date(proposedSession.scheduled_at).getTime() + proposedSession.duration_minutes * 60000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</Text>
                        </View>
                    </View>

                    {/* Timeline Visualization */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>📅 Timeline</Text>
                        <View style={styles.timelineContainer}>
                            <TimelineView
                                date={proposedSession.scheduled_at}
                                existingSessions={[{
                                    scheduled_at: existingSession.scheduled_at,
                                    duration_minutes: existingSession.duration_minutes,
                                    client_name: existingSession.client_name,
                                }]}
                                proposedSession={{
                                    scheduled_at: proposedSession.scheduled_at,
                                    duration_minutes: proposedSession.duration_minutes,
                                    client_name: proposedSession.client_name,
                                }}
                            />
                        </View>
                    </View>

                    {/* Session Details */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>👥 Session Details</Text>
                        
                        <View style={styles.sessionCard}>
                            <Text style={styles.sessionLabel}>Existing Session</Text>
                            <Text style={styles.sessionClient}>{existingSession.client_name || 'Unknown Client'}</Text>
                            <Text style={styles.sessionDetails}>
                                {new Date(existingSession.scheduled_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} • {existingSession.duration_minutes} min • {existingSession.session_type}
                            </Text>
                        </View>

                        <View style={[styles.sessionCard, styles.proposedCard]}>
                            <Text style={styles.sessionLabel}>Proposed Session</Text>
                            <Text style={styles.sessionClient}>{proposedSession.client_name}</Text>
                            <Text style={styles.sessionDetails}>
                                {new Date(proposedSession.scheduled_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} • {proposedSession.duration_minutes} min • {proposedSession.session_type}
                            </Text>
                        </View>
                    </View>

                    {/* Resolution Options */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>✅ Resolution Options</Text>

                        {/* Option 1: Propose to Incoming */}
                        <TouchableOpacity
                            style={[styles.optionCard, selectedOption === 'keep' && styles.optionCardSelected]}
                            onPress={() => setSelectedOption('keep')}
                        >
                            <View style={styles.optionHeader}>
                                <View style={styles.optionRadio}>
                                    {selectedOption === 'keep' && <View style={styles.optionRadioInner} />}
                                </View>
                                <View>
                                    <Text style={styles.optionTitle}>Option 1 — Propose new time to {proposedSession.client_name}</Text>
                                    <Text style={styles.advancedLabel}>(Sends Message)</Text>
                                </View>
                            </View>
                            <Text style={styles.optionDescription}>
                                Send a message to {proposedSession.client_name} with alternative times.
                            </Text>


                        </TouchableOpacity>

                        {/* Option 2: Propose to Existing */}
                        <TouchableOpacity
                            style={[styles.optionCard, styles.advancedOption, selectedOption === 'reschedule' && styles.optionCardSelected]}
                            onPress={() => setSelectedOption('reschedule')}
                        >
                            <View style={styles.optionContent}>
                                <View style={styles.optionHeader}>
                                    <View style={[styles.radioOuter, selectedOption === 'reschedule' && styles.radioOuterSelected]}>
                                        {selectedOption === 'reschedule' && <View style={styles.radioInner} />}
                                    </View>
                                    <View style={styles.optionTextContainer}>
                                        <Text style={styles.optionTitle}>Ask {existingSession.client_name} to Reschedule</Text>
                                        <Text style={styles.optionDescription}>
                                            Request {existingSession.client_name} to move their session to accommodate {proposedSession.client_name}.
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        </TouchableOpacity>
                    </View>
                </ScrollView>

                {/* Footer */}
                <View style={styles.footer}>
                    <TouchableOpacity style={styles.secondaryButton} onPress={handleCancel}>
                        <Text style={styles.secondaryButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[styles.primaryButton, !selectedOption && styles.buttonDisabled]} 
                        onPress={handleResolve}
                        disabled={!selectedOption}
                    >
                        <Text style={styles.primaryButtonText}>Request Resolution</Text>
                    </TouchableOpacity>
                </View>

                {/* Time Slot Picker Modal - Kept but unused for now if we auto-select top 3 */}
                <TimeSlotPicker 
                    visible={showTimePicker}
                    onClose={() => setShowTimePicker(false)}
                    onSelect={setSelectedNewTime}
                    slots={recommendations || []}
                    selectedTime={selectedNewTime}
                />
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        backgroundColor: '#FEF2F2',
        borderBottomWidth: 1,
        borderBottomColor: '#FECACA',
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#B91C1C',
    },
    content: {
        flex: 1,
        padding: 20,
    },
    infoCard: {
        backgroundColor: '#FEF2F2',
        padding: 16,
        borderRadius: 12,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#FECACA',
    },
    infoHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#FCA5A5',
    },
    infoTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#B91C1C',
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    infoLabel: {
        fontSize: 14,
        color: '#7F1D1D',
        fontWeight: '500',
    },
    infoValue: {
        fontSize: 14,
        fontWeight: '700',
        color: '#7F1D1D',
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 12,
    },
    timelineContainer: {
        backgroundColor: '#FFF',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        maxHeight: 300,
    },
    sessionCard: {
        backgroundColor: '#EFF6FF',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#BFDBFE',
        borderLeftWidth: 4,
        borderLeftColor: '#3B82F6',
        marginBottom: 12,
    },
    proposedCard: {
        backgroundColor: '#F0FDF4',
        borderColor: '#BBF7D0',
        borderLeftColor: '#22C55E',
    },
    sessionLabel: {
        fontSize: 12,
        color: '#6B7280',
        textTransform: 'uppercase',
        fontWeight: '600',
        marginBottom: 4,
    },
    sessionClient: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 4,
    },
    sessionDetails: {
        fontSize: 14,
        color: '#4B5563',
    },
    optionCard: {
        backgroundColor: '#FFF',
        padding: 16,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#E5E7EB',
        marginBottom: 12,
    },
    optionCardSelected: {
        borderColor: '#3B82F6',
        backgroundColor: '#EFF6FF',
    },
    advancedOption: {
        borderColor: '#FDE047',
        backgroundColor: '#FEFCE8',
    },
    optionHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        marginBottom: 8,
    },
    optionRadio: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: '#3B82F6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    optionRadioInner: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#3B82F6',
    },
    optionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
    },
    advancedLabel: {
        fontSize: 12,
        color: '#CA8A04',
        fontStyle: 'italic',
    },
    optionDescription: {
        fontSize: 14,
        color: '#6B7280',
        marginLeft: 32,
    },
    recommendationsContainer: {
        marginTop: 12,
        marginLeft: 32,
    },
    timeSelectorButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: '#FFF',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#D1D5DB',
    },
    timeSelectorText: {
        flex: 1,
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
    },
    timeSelectorCount: {
        fontSize: 12,
        color: '#6B7280',
    },
    cancelOption: {
        padding: 16,
        borderRadius: 12,
        backgroundColor: '#F3F4F6',
        borderWidth: 1,
        borderColor: '#D1D5DB',
    },
    cancelText: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
    },
    footer: {
        flexDirection: 'row',
        gap: 12,
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        backgroundColor: '#FFF',
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
    primaryButton: {
        flex: 2,
        padding: 16,
        borderRadius: 12,
        backgroundColor: '#3B82F6',
        alignItems: 'center',
    },
    buttonDisabled: {
        opacity: 0.5,
    },
    primaryButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '600',
    },
    // Picker Modal Styles
    pickerOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    pickerContainer: {
        backgroundColor: '#FFF',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '80%',
        paddingBottom: 30,
    },
    pickerHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    pickerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
    },
    pickerSubtitle: {
        fontSize: 14,
        color: '#6B7280',
        paddingHorizontal: 20,
        paddingTop: 10,
    },
    closeButton: {
        padding: 4,
    },
    pickerList: {
        padding: 20,
    },
    pickerItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    pickerItemSelected: {
        backgroundColor: '#EFF6FF',
        borderColor: '#3B82F6',
    },
    pickerItemContent: {
        flex: 1,
    },
    pickerItemLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 2,
    },
    pickerItemLabelSelected: {
        color: '#1E40AF',
    },
    pickerItemReason: {
        fontSize: 12,
        color: '#6B7280',
    },
    miniSlotItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#F3F4F6',
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 6,
        marginBottom: 4,
        alignSelf: 'flex-start',
    },
    miniSlotText: {
        fontSize: 13,
        color: '#4B5563',
        fontWeight: '500',
    },
    recommendationLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
    },
    optionContent: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    radioOuter: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: '#3B82F6',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
        marginTop: 2,
    },
    radioOuterSelected: {
        borderColor: '#3B82F6',
    },
    radioInner: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#3B82F6',
    },
    optionTextContainer: {
        flex: 1,
    },
});
