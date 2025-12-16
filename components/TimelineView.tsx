import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Clock } from 'lucide-react-native';

interface TimeSlot {
    time: string; // HH:MM format
    sessions: Array<{
        clientName: string;
        duration: number;
        type: 'existing' | 'proposed' | 'conflict';
    }>;
}

interface TimelineViewProps {
    date: string; // ISO date string
    existingSessions: Array<{
        scheduled_at: string;
        duration_minutes: number;
        client_name?: string;
    }>;
    proposedSession: {
        scheduled_at: string;
        duration_minutes: number;
        client_name: string;
    };
}

export default function TimelineView({ date, existingSessions, proposedSession }: TimelineViewProps) {
    // Generate hourly slots from 6 AM to 10 PM
    const generateTimeSlots = (): TimeSlot[] => {
        const slots: TimeSlot[] = [];
        const startHour = 6;
        const endHour = 22;

        for (let hour = startHour; hour <= endHour; hour++) {
            const timeStr = `${hour.toString().padStart(2, '0')}:00`;
            slots.push({ time: timeStr, sessions: [] });
        }

        return slots;
    };

    const slots = generateTimeSlots();

    // Map sessions to timeline slots
    const mapSessionToSlot = (scheduledAt: string, duration: number, clientName: string, type: 'existing' | 'proposed') => {
        const sessionDate = new Date(scheduledAt);
        const hour = sessionDate.getHours();
        const minutes = sessionDate.getMinutes();

        slots.forEach((slot, index) => {
            const [slotHour] = slot.time.split(':').map(Number);
            const sessionStart = hour + minutes / 60;
            const sessionEnd = sessionStart + duration / 60;
            const slotStart = slotHour;
            const slotEnd = slotHour + 1;

            // Check if session overlaps with this slot
            if (sessionStart < slotEnd && sessionEnd > slotStart) {
                slot.sessions.push({ clientName, duration, type });
            }
        });
    };

    // Map all existing sessions
    existingSessions.forEach(session => {
        mapSessionToSlot(session.scheduled_at, session.duration_minutes, session.client_name || 'Unknown', 'existing');
    });

    // Map proposed session
    mapSessionToSlot(proposedSession.scheduled_at, proposedSession.duration_minutes, proposedSession.client_name, 'proposed');

    // Check for conflicts
    slots.forEach(slot => {
        const hasExisting = slot.sessions.some(s => s.type === 'existing');
        const hasProposed = slot.sessions.some(s => s.type === 'proposed');
        if (hasExisting && hasProposed) {
            slot.sessions.forEach(s => {
                if (s.type === 'proposed') s.type = 'conflict';
            });
        }
    });

    return (
        <ScrollView style={styles.container}>
            <Text style={styles.dateLabel}>{new Date(date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
            
            {slots.map((slot, index) => (
                <View key={index} style={styles.slotRow}>
                    <View style={styles.timeLabel}>
                        <Clock size={12} color="#6B7280" />
                        <Text style={styles.timeText}>{slot.time}</Text>
                    </View>
                    
                    <View style={styles.sessionsColumn}>
                        {slot.sessions.length === 0 ? (
                            <View style={styles.emptySlot} />
                        ) : (
                            slot.sessions.map((session, sIdx) => (
                                <TouchableOpacity
                                    key={sIdx}
                                    style={[
                                        styles.sessionBlock,
                                        session.type === 'existing' && styles.sessionExisting,
                                        session.type === 'proposed' && styles.sessionProposed,
                                        session.type === 'conflict' && styles.sessionConflict,
                                    ]}
                                >
                                    <Text style={[
                                        styles.sessionText,
                                        session.type === 'conflict' && styles.sessionTextConflict
                                    ]}>
                                        {session.clientName}
                                    </Text>
                                    <Text style={styles.sessionDuration}>{session.duration} min</Text>
                                </TouchableOpacity>
                            ))
                        )}
                    </View>
                </View>
            ))}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    dateLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 16,
        paddingHorizontal: 16,
    },
    slotRow: {
        flexDirection: 'row',
        paddingVertical: 4,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    timeLabel: {
        width: 80,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    timeText: {
        fontSize: 14,
        color: '#6B7280',
        fontWeight: '500',
    },
    sessionsColumn: {
        flex: 1,
        gap: 4,
    },
    emptySlot: {
        height: 24,
    },
    sessionBlock: {
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 6,
        borderWidth: 1,
        borderLeftWidth: 4,
    },
    sessionExisting: {
        backgroundColor: '#EFF6FF',
        borderColor: '#BFDBFE',
        borderLeftColor: '#3B82F6',
    },
    sessionProposed: {
        backgroundColor: '#F0FDF4',
        borderColor: '#BBF7D0',
        borderLeftColor: '#22C55E',
    },
    sessionConflict: {
        backgroundColor: '#FEF2F2',
        borderColor: '#FECACA',
        borderLeftColor: '#EF4444',
    },
    sessionText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
    },
    sessionTextConflict: {
        color: '#B91C1C',
    },
    sessionDuration: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 2,
    },
});
