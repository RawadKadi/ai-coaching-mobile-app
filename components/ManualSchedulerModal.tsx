import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { X, Calendar, Clock, AlertCircle, Check } from 'lucide-react-native';
import { useTheme } from '@/contexts/BrandContext';
import { ProposedSession } from '@/lib/ai-scheduling-service';
import { Session } from '@/types/database';
import { availabilityService } from '@/lib/availability-service';
import { supabase } from '@/lib/supabase';

interface ManualSchedulerModalProps {
    visible: boolean;
    onClose: () => void;
    onConfirm: (sessions: ProposedSession[]) => Promise<void>;
    clientContext: {
        name: string;
        timezone: string;
    };
    existingSessions: Session[];
    targetClientId: string;
    coachId: string;
}

interface TimeSlot {
    time: Date;
    available: boolean;
    reason?: string;
    sessionId?: string;
    clientName?: string;
}

export default function ManualSchedulerModal({
    visible,
    onClose,
    onConfirm,
    clientContext,
    existingSessions,
    targetClientId,
    coachId,
}: ManualSchedulerModalProps) {
    const theme = useTheme();
    const [loading, setLoading] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
    const [proposedSessions, setProposedSessions] = useState<ProposedSession[]>([]);
    const [blockedDates, setBlockedDates] = useState<Set<string>>(new Set());

    // Generate next 7 days
    const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() + i);
        return d;
    });

    useEffect(() => {
        if (visible && coachId) {
            loadAvailabilityData();
        }
    }, [visible, coachId]);

    useEffect(() => {
        if (visible && selectedDate) {
            loadSlotsForDate(selectedDate);
        }
    }, [selectedDate, visible, existingSessions]);

    const loadAvailabilityData = async () => {
        try {
            const blocked = await availabilityService.getBlockedDates(coachId);
            const blockedSet = new Set(blocked.map(b => b.date));
            setBlockedDates(blockedSet);
        } catch (error) {
            console.error('Error loading availability data:', error);
        }
    };

    const loadSlotsForDate = async (date: Date) => {
        setLoading(true);
        try {
            const dateStr = date.toISOString().split('T')[0];
            const dayOfWeek = date.getDay();

            // Check if date is blocked
            if (blockedDates.has(dateStr)) {
                setTimeSlots([]);
                setLoading(false);
                return;
            }

            // Get coach availability for this day
            const availability = await availabilityService.getAvailability(coachId);
            const dayAvailability = availability.filter(slot => slot.day_of_week === dayOfWeek && slot.is_active);

            if (dayAvailability.length === 0) {
                setTimeSlots([]);
                setLoading(false);
                return;
            }

            // Generate 30-minute slots for the working hours
            const slots: TimeSlot[] = [];
            const now = new Date();
            const isToday = dateStr === now.toISOString().split('T')[0];

            for (const workSlot of dayAvailability) {
                const [startHour, startMinute] = workSlot.start_time.split(':').map(Number);
                const [endHour, endMinute] = workSlot.end_time.split(':').map(Number);

                let currentTime = new Date(date);
                currentTime.setHours(startHour, startMinute, 0, 0);

                const endTime = new Date(date);
                endTime.setHours(endHour, endMinute, 0, 0);

                while (currentTime < endTime) {
                    // Skip past times if it's today
                    if (isToday && currentTime <= now) {
                        currentTime.setMinutes(currentTime.getMinutes() + 30);
                        continue;
                    }

                    const eligibility = await checkSlotEligibility(currentTime);
                    slots.push(eligibility);

                    currentTime.setMinutes(currentTime.getMinutes() + 30);
                }
            }

            setTimeSlots(slots);
        } catch (error) {
            console.error('Error loading slots:', error);
            Alert.alert('Error', 'Failed to load available time slots');
        } finally {
            setLoading(false);
        }
    };

    const checkSlotEligibility = async (time: Date): Promise<TimeSlot> => {
        const slotStart = time;
        const slotEnd = new Date(time.getTime() + 60 * 60000); // 60 minutes

        // Check for conflicts with existing sessions
        for (const session of existingSessions) {
            if (session.status === 'cancelled') continue;

            const sessionStart = new Date(session.scheduled_at);
            const sessionEnd = new Date(sessionStart.getTime() + session.duration_minutes * 60000);

            // Check if same day
            if (sessionStart.toDateString() !== slotStart.toDateString()) continue;

            // Check overlap
            if (slotStart < sessionEnd && slotEnd > sessionStart) {
                return {
                    time,
                    available: false,
                    reason: 'Conflicts with existing session',
                    sessionId: session.id,
                    clientName: (session as any).client?.profiles?.full_name || 'Client',
                };
            }
        }

        // Check client daily limit (1 session per day)
        const clientHasSessionToday = existingSessions.some(session => {
            if (session.status === 'cancelled') return false;
            if (session.client_id !== targetClientId) return false;

            const sessionDate = new Date(session.scheduled_at);
            return sessionDate.toDateString() === slotStart.toDateString();
        });

        if (clientHasSessionToday) {
            return {
                time,
                available: false,
                reason: `${clientContext.name} already has a session this day`,
            };
        }

        return {
            time,
            available: true,
        };
    };

    const handleSlotPress = async (slot: TimeSlot) => {
        if (!slot.available) {
            Alert.alert('Slot Unavailable', slot.reason || 'This time slot is not available');
            return;
        }

        // Add to proposed sessions
        const newSession: ProposedSession = {
            scheduled_at: slot.time.toISOString(),
            duration_minutes: 60,
            session_type: 'training',
            notes: `Manually scheduled for ${clientContext.name}`,
            recurrence: 'once',
            day_of_week: slot.time.toLocaleDateString('en-US', { weekday: 'long' }),
        };

        setProposedSessions([...proposedSessions, newSession]);
        
        Alert.alert(
            'Session Added',
            `Session scheduled for ${slot.time.toLocaleString()}`,
            [{ text: 'OK' }]
        );
    };

    const handleConfirm = async () => {
        if (proposedSessions.length === 0) {
            Alert.alert('No Sessions', 'Please select at least one time slot');
            return;
        }

        setLoading(true);
        try {
            await onConfirm(proposedSessions);
            setProposedSessions([]);
            onClose();
        } catch (error) {
            Alert.alert('Error', 'Failed to confirm sessions');
        } finally {
            setLoading(false);
        }
    };

    const formatTime = (time: Date) => {
        return time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const dateStr = selectedDate.toISOString().split('T')[0];
    const isBlocked = blockedDates.has(dateStr);

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
            <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
                <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
                    <Text style={[styles.title, { color: theme.colors.text }]}>Manual Scheduler</Text>
                    <TouchableOpacity onPress={onClose}>
                        <X size={24} color={theme.colors.text} />
                    </TouchableOpacity>
                </View>

                <View style={styles.content}>
                    <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
                        Scheduling for {clientContext.name}
                    </Text>

                    {/* Day selector */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.daySelector}>
                        {days.map(day => {
                            const isSelected = day.toDateString() === selectedDate.toDateString();
                            const dayStr = day.toISOString().split('T')[0];
                            const isDayBlocked = blockedDates.has(dayStr);

                            return (
                                <TouchableOpacity
                                    key={day.toISOString()}
                                    style={[
                                        styles.dayButton,
                                        { backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.border },
                                        isSelected && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
                                        isDayBlocked && styles.blockedDay,
                                    ]}
                                    onPress={() => setSelectedDate(day)}
                                    disabled={isDayBlocked}
                                >
                                    <Text style={[
                                        styles.dayText,
                                        { color: theme.colors.textSecondary },
                                        isSelected && { color: theme.colors.textOnPrimary },
                                        isDayBlocked && { color: theme.colors.textTertiary },
                                    ]}>
                                        {day.toLocaleDateString('en-US', { weekday: 'short' })}
                                    </Text>
                                    <Text style={[
                                        styles.dateText,
                                        { color: theme.colors.text },
                                        isSelected && { color: theme.colors.textOnPrimary },
                                        isDayBlocked && { color: theme.colors.textTertiary },
                                    ]}>
                                        {day.getDate()}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>

                    {/* Time slots */}
                    <View style={styles.slotsContainer}>
                        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                            {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                        </Text>

                        {loading ? (
                            <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 40 }} />
                        ) : isBlocked ? (
                            <View style={styles.emptyState}>
                                <AlertCircle size={48} color={theme.colors.border} />
                                <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                                    This date is blocked
                                </Text>
                            </View>
                        ) : timeSlots.length === 0 ? (
                            <View style={styles.emptyState}>
                                <Calendar size={48} color={theme.colors.border} />
                                <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                                    No working hours set for this day
                                </Text>
                            </View>
                        ) : (
                            <ScrollView style={styles.slotsList}>
                                {timeSlots.map((slot, index) => (
                                    <TouchableOpacity
                                        key={index}
                                        style={[
                                            styles.slotButton,
                                            { borderColor: theme.colors.border },
                                            slot.available ? { backgroundColor: theme.colors.primary + '15' } : { backgroundColor: theme.colors.inputBackground },
                                        ]}
                                        onPress={() => handleSlotPress(slot)}
                                        disabled={!slot.available}
                                    >
                                        <View style={styles.slotContent}>
                                            <Clock size={18} color={slot.available ? theme.colors.primary : theme.colors.textTertiary} />
                                            <Text style={[
                                                styles.slotTime,
                                                { color: slot.available ? theme.colors.primary : theme.colors.textTertiary }
                                            ]}>
                                                {formatTime(slot.time)}
                                            </Text>
                                        </View>
                                        {!slot.available && (
                                            <Text style={[styles.slotReason, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                                                {slot.reason}
                                            </Text>
                                        )}
                                        {slot.available && (
                                            <Check size={18} color={theme.colors.primary} />
                                        )}
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        )}
                    </View>
                </View>

                {/* Footer with proposed sessions count and confirm button */}
                <View style={[styles.footer, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border }]}>
                    {proposedSessions.length > 0 && (
                        <View style={styles.sessionCount}>
                            <Text style={[styles.sessionCountText, { color: theme.colors.text }]}>
                                {proposedSessions.length} session{proposedSessions.length > 1 ? 's' : ''} selected
                            </Text>
                        </View>
                    )}
                    <View style={styles.buttonGroup}>
                        <TouchableOpacity
                            style={[styles.secondaryButton, { borderColor: theme.colors.border }]}
                            onPress={onClose}
                        >
                            <Text style={[styles.secondaryButtonText, { color: theme.colors.text }]}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[
                                styles.primaryButton,
                                { backgroundColor: theme.colors.primary },
                                (proposedSessions.length === 0 || loading) && styles.buttonDisabled
                            ]}
                            onPress={handleConfirm}
                            disabled={proposedSessions.length === 0 || loading}
                        >
                            {loading ? (
                                <ActivityIndicator color={theme.colors.textOnPrimary} />
                            ) : (
                                <Text style={[styles.primaryButtonText, { color: theme.colors.textOnPrimary }]}>
                                    Confirm ({proposedSessions.length})
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        paddingTop: 60,
        borderBottomWidth: 1,
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
    },
    content: {
        flex: 1,
        padding: 20,
    },
    subtitle: {
        fontSize: 16,
        marginBottom: 16,
    },
    daySelector: {
        marginBottom: 24,
    },
    dayButton: {
        width: 60,
        height: 70,
        borderRadius: 12,
        borderWidth: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    blockedDay: {
        opacity: 0.4,
    },
    dayText: {
        fontSize: 12,
        fontWeight: '500',
        marginBottom: 4,
    },
    dateText: {
        fontSize: 18,
        fontWeight: '700',
    },
    slotsContainer: {
        flex: 1,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 16,
    },
    slotsList: {
        flex: 1,
    },
    slotButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 8,
    },
    slotContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1,
    },
    slotTime: {
        fontSize: 16,
        fontWeight: '600',
    },
    slotReason: {
        fontSize: 12,
        flex: 1,
        marginLeft: 8,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 60,
        gap: 12,
    },
    emptyText: {
        fontSize: 16,
    },
    footer: {
        padding: 20,
        borderTopWidth: 1,
    },
    sessionCount: {
        marginBottom: 12,
    },
    sessionCountText: {
        fontSize: 14,
        fontWeight: '500',
    },
    buttonGroup: {
        flexDirection: 'row',
        gap: 12,
    },
    secondaryButton: {
        flex: 1,
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        alignItems: 'center',
    },
    secondaryButtonText: {
        fontSize: 16,
        fontWeight: '600',
    },
    primaryButton: {
        flex: 2,
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    primaryButtonText: {
        fontSize: 16,
        fontWeight: '600',
    },
    buttonDisabled: {
        opacity: 0.5,
    },
});
