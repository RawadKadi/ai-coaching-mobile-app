import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, ActivityIndicator, Alert, TextInput } from 'react-native';
import { X, Calendar, Clock, AlertCircle, Check, User, ChevronDown, Repeat } from 'lucide-react-native';
import { useTheme } from '@/contexts/BrandContext';
import { ProposedSession } from '@/lib/ai-scheduling-service';
import { Session } from '@/types/database';
import { availabilityService } from '@/lib/availability-service';
import { supabase } from '@/lib/supabase';

interface ManualSchedulerModalProps {
    visible: boolean;
    onClose: () => void;
    onConfirm: (sessions: ProposedSession[]) => Promise<void>;
    existingSessions: Session[];
    coachId: string;
}

interface Client {
    id: string;
    user_id: string;
    profiles: {
        full_name: string;
        avatar_url: string | null;
    };
}

interface TimeSlot {
    time: Date;
    available: boolean;
    reason?: string;
    sessionId?: string;
    clientName?: string;
}

type StepType = 'client' | 'days' | 'time' | 'details' | 'confirm';
type RecurrenceType = 'once' | 'weekly';

export default function ManualSchedulerModal({
    visible,
    onClose,
    onConfirm,
    existingSessions,
    coachId,
}: ManualSchedulerModalProps) {
    const theme = useTheme();
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState<StepType>('client');
    
    // Step 2: Client selection
    const [clients, setClients] = useState<Client[]>([]);
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    
    // Step 3: Day(s) and recurrence
    const [recurrence, setRecurrence] = useState<RecurrenceType>('once');
    const [selectedDates, setSelectedDates] = useState<Date[]>([]);
    const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([]); // 0-6 for Sun-Sat
    
    // Step 4: Time selection
    const [selectedTime, setSelectedTime] = useState<Date | null>(null);
    const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
    
    // Step 5: Session details
    const [duration, setDuration] = useState(60);
    const [sessionType, setSessionType] = useState<'training' | 'nutrition' | 'check_in' | 'consultation' | 'other'>('training');
    const [notes, setNotes] = useState('');
    
    const [blockedDates, setBlockedDates] = useState<Set<string>>(new Set());

    // Generate next 14 days for one-off scheduling
    const next14Days = Array.from({ length: 14 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() + i);
        return d;
    });

    const weekdays = [
        { day: 0, name: 'Sunday', short: 'Sun' },
        { day: 1, name: 'Monday', short: 'Mon' },
        { day: 2, name: 'Tuesday', short: 'Tue' },
        { day: 3, name: 'Wednesday', short: 'Wed' },
        { day: 4, name: 'Thursday', short: 'Thu' },
        { day: 5, name: 'Friday', short: 'Fri' },
        { day: 6, name: 'Saturday', short: 'Sat' },
    ];

    const sessionTypes = [
        { value: 'training', label: 'Training' },
        { value: 'nutrition', label: 'Nutrition' },
        { value: 'check_in', label: 'Check-in' },
        { value: 'consultation', label: 'Consultation' },
        { value: 'other', label: 'Other' },
    ];

    useEffect(() => {
        if (visible) {
            loadClients();
            loadAvailabilityData();
            resetForm();
        }
    }, [visible]);

    useEffect(() => {
        if (step === 'time' && selectedClient) {
            loadAvailableSlots();
        }
    }, [step, selectedDates, selectedWeekdays, selectedClient]);

    const resetForm = () => {
        setStep('client');
        setSelectedClient(null);
        setRecurrence('once');
        setSelectedDates([]);
        setSelectedWeekdays([]);
        setSelectedTime(null);
        setDuration(60);
        setSessionType('training');
        setNotes('');
    };

    const loadClients = async () => {
        try {
            // Query through coach_client_links since clients table doesn't have coach_id
            const { data, error } = await supabase
                .from('coach_client_links')
                .select(`
                    client_id,
                    clients!inner (
                        id,
                        user_id,
                        profiles!inner (
                            full_name,
                            avatar_url
                        )
                    )
                `)
                .eq('coach_id', coachId);

            if (error) {
                console.error('Supabase error:', error);
                throw error;
            }
            
            // Extract and flatten the client data
            const processedData = data?.map(link => {
                const client = Array.isArray(link.clients) ? link.clients[0] : link.clients;
                const profiles = Array.isArray(client.profiles) ? client.profiles[0] : client.profiles;
                return {
                    id: client.id,
                    user_id: client.user_id,
                    profiles: profiles
                };
            }) || [];
            
            setClients(processedData as any);
        } catch (error) {
            console.error('Error loading clients:', error);
            Alert.alert('Error', 'Failed to load clients. Please try again.');
        }
    };

    const loadAvailabilityData = async () => {
        try {
            const blocked = await availabilityService.getBlockedDates(coachId);
            const blockedSet = new Set(blocked.map(b => b.date));
            setBlockedDates(blockedSet);
        } catch (error) {
            console.error('Error loading availability data:', error);
        }
    };

    const loadAvailableSlots = async () => {
        if (!selectedClient) return;
        
        setLoading(true);
        try {
            const datesToCheck = recurrence === 'once' ? selectedDates : getNextOccurrencesOfWeekdays();
            
            if (datesToCheck.length === 0) {
                setAvailableSlots([]);
                setLoading(false);
                return;
            }

            // Get unique weekdays from selected dates
            const uniqueWeekdays = [...new Set(datesToCheck.map(d => d.getDay()))];
            
            // Get coach availability for all unique weekdays
            const availability = await availabilityService.getAvailability(coachId);
            
            // Collect all possible times across all weekdays (UNION instead of intersection)
            const allTimesSet = new Set<string>();
            const slotsByWeekday: { [key: number]: Set<string> } = {};
            
            for (const weekday of uniqueWeekdays) {
                const dayAvailability = availability.filter(slot => slot.day_of_week === weekday && slot.is_active);
                const times = new Set<string>();
                
                if (dayAvailability.length === 0) {
                    console.log(`No availability set for weekday ${weekday}`);
                }
                
                for (const workSlot of dayAvailability) {
                    const [startHour, startMinute] = workSlot.start_time.split(':').map(Number);
                    const [endHour, endMinute] = workSlot.end_time.split(':').map(Number);
                    
                    let hour = startHour;
                    let minute = startMinute;
                    
                    while (hour < endHour || (hour === endHour && minute < endMinute)) {
                        const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
                        times.add(timeStr);
                        allTimesSet.add(timeStr);
                        minute += 30;
                        if (minute >= 60) {
                            minute = 0;
                            hour += 1;
                        }
                    }
                }
                
                slotsByWeekday[weekday] = times;
            }
            
            if (allTimesSet.size === 0) {
                console.error('No working hours set for any of the selected days');
                Alert.alert('No Working Hours', 'You have no working hours set for the selected days. Please set your availability in Settings.');
                setAvailableSlots([]);
                setLoading(false);
                return;
            }
            
            // Sort all possible times
            const allTimes = Array.from(allTimesSet).sort();
            
            // Create time slots with eligibility checking
            const now = new Date();
            const slots: TimeSlot[] = [];
            
            for (const timeStr of allTimes) {
                const [hour, minute] = timeStr.split(':').map(Number);
                
                // Use first date as reference for creating Date object
                const referenceDate = datesToCheck[0];
                const slotTime = new Date(referenceDate);
                slotTime.setHours(hour, minute, 0, 0);
                
                // Skip if it's today and the time has passed
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const refDateOnly = new Date(referenceDate);
                refDateOnly.setHours(0, 0, 0, 0);
                
                if (refDateOnly.getTime() === today.getTime() && slotTime <= now) {
                    continue;
                }
                
                // Check if this time exists on ALL selected weekdays
                const availableOnAllWeekdays = uniqueWeekdays.every(weekday => 
                    slotsByWeekday[weekday]?.has(timeStr)
                );
                
                if (!availableOnAllWeekdays) {
                    // This time is not available on all selected weekdays
                    const missingDays = uniqueWeekdays
                        .filter(wd => !slotsByWeekday[wd]?.has(timeStr))
                        .map(wd => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][wd])
                        .join(', ');
                    
                    slots.push({
                        time: slotTime,
                        available: false,
                        reason: `Not available on ${missingDays}`,
                    });
                    continue;
                }
                
                // Check eligibility across all selected dates (conflicts, daily limits, etc.)
                const eligibility = await checkSlotEligibilityAcrossAllDates(slotTime, datesToCheck);
                slots.push(eligibility);
            }

            setAvailableSlots(slots);
        } catch (error) {
            console.error('Error loading slots:', error);
            Alert.alert('Error', 'Failed to load available time slots');
        } finally {
            setLoading(false);
        }
    };

    const getNextOccurrencesOfWeekdays = (): Date[] => {
        // For recurring, get the next occurrence of each selected weekday
        const dates: Date[] = [];
        const today = new Date();
        
        for (const weekday of selectedWeekdays) {
            const daysUntil = (weekday - today.getDay() + 7) % 7 || 7;
            const nextDate = new Date(today);
            nextDate.setDate(today.getDate() + daysUntil);
            nextDate.setHours(0, 0, 0, 0);
            dates.push(nextDate);
        }
        
        return dates;
    };

    const checkSlotEligibility = async (time: Date): Promise<TimeSlot> => {
        const slotStart = time;
        const slotEnd = new Date(time.getTime() + duration * 60000);

        // Check for conflicts with existing sessions
        for (const session of existingSessions) {
            if (session.status === 'cancelled') continue;

            const sessionStart = new Date(session.scheduled_at);
            const sessionEnd = new Date(sessionStart.getTime() + session.duration_minutes * 60000);

            if (sessionStart.toDateString() !== slotStart.toDateString()) continue;

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

        // Check client daily limit
        const clientHasSessionToday = existingSessions.some(session => {
            if (session.status === 'cancelled') return false;
            if (session.client_id !== selectedClient?.id) return false;

            const sessionDate = new Date(session.scheduled_at);
            return sessionDate.toDateString() === slotStart.toDateString();
        });

        if (clientHasSessionToday) {
            return {
                time,
                available: false,
                reason: `${selectedClient?.profiles?.full_name} already has a session this day`,
            };
        }

        return { time, available: true };
    };

    const checkSlotEligibilityAcrossAllDates = async (time: Date, dates: Date[]): Promise<TimeSlot> => {
        // Check if this time is available on ALL selected dates
        const timeHour = time.getHours();
        const timeMinute = time.getMinutes();

        for (const date of dates) {
            const slotTime = new Date(date);
            slotTime.setHours(timeHour, timeMinute, 0, 0);

            const slotStart = slotTime;
            const slotEnd = new Date(slotTime.getTime() + duration * 60000);

            // Check for conflicts with existing sessions on this date
            for (const session of existingSessions) {
                if (session.status === 'cancelled') continue;

                const sessionStart = new Date(session.scheduled_at);
                const sessionEnd = new Date(sessionStart.getTime() + session.duration_minutes * 60000);

                if (sessionStart.toDateString() !== slotStart.toDateString()) continue;

                if (slotStart < sessionEnd && slotEnd > sessionStart) {
                    return {
                        time,
                        available: false,
                        reason: `Conflicts on ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
                        sessionId: session.id,
                        clientName: (session as any).client?.profiles?.full_name || 'Client',
                    };
                }
            }

            // Check client daily limit on this date
            const clientHasSessionThisDay = existingSessions.some(session => {
                if (session.status === 'cancelled') return false;
                if (session.client_id !== selectedClient?.id) return false;

                const sessionDate = new Date(session.scheduled_at);
                return sessionDate.toDateString() === slotStart.toDateString();
            });

            if (clientHasSessionThisDay) {
                return {
                    time,
                    available: false,
                    reason: `${selectedClient?.profiles?.full_name} has session on ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
                };
            }
        }

        // Time is available on all dates
        return { time, available: true };
    };

    const handleNext = () => {
        if (step === 'client' && selectedClient) {
            setStep('days');
        } else if (step === 'days' && ((recurrence === 'once' && selectedDates.length > 0) || (recurrence === 'weekly' && selectedWeekdays.length > 0))) {
            setStep('time');
        } else if (step === 'time' && selectedTime) {
            setStep('details');
        } else if (step === 'details') {
            setStep('confirm');
        }
    };

    const handleBack = () => {
        if (step === 'days') setStep('client');
        else if (step === 'time') setStep('days');
        else if (step === 'details') setStep('time');
        else if (step === 'confirm') setStep('details');
    };

    const handleConfirm = async () => {
        if (!selectedClient || !selectedTime) {
            Alert.alert('Error', 'Missing required information');
            return;
        }

        setLoading(true);
        try {
            const sessions: ProposedSession[] = [];

            if (recurrence === 'once') {
                // Create one session for each selected date
                for (const date of selectedDates) {
                    const sessionTime = new Date(date);
                    sessionTime.setHours(selectedTime.getHours(), selectedTime.getMinutes(), 0, 0);

                    sessions.push({
                        scheduled_at: sessionTime.toISOString(),
                        duration_minutes: duration,
                        session_type: sessionType,
                        notes: notes || `Manual session with ${selectedClient.profiles.full_name}`,
                        recurrence: 'once',
                        day_of_week: sessionTime.toLocaleDateString('en-US', { weekday: 'long' }),
                    });
                }
            } else {
                // Create recurring sessions
                const nextOccurrences = getNextOccurrencesOfWeekdays();
                for (const date of nextOccurrences) {
                    const sessionTime = new Date(date);
                    sessionTime.setHours(selectedTime.getHours(), selectedTime.getMinutes(), 0, 0);

                    sessions.push({
                        scheduled_at: sessionTime.toISOString(),
                        duration_minutes: duration,
                        session_type: sessionType,
                        notes: notes || `Recurring session with ${selectedClient.profiles.full_name}`,
                        recurrence: 'weekly',
                        day_of_week: sessionTime.toLocaleDateString('en-US', { weekday: 'long' }),
                    });
                }
            }

            await onConfirm(sessions);
            resetForm();
            onClose();
        } catch (error) {
            console.error('Error confirming sessions:', error);
            Alert.alert('Error', 'Failed to create sessions. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const toggleDate = (date: Date) => {
        const dateStr = date.toDateString();
        const exists = selectedDates.some(d => d.toDateString() === dateStr);
        
        if (exists) {
            setSelectedDates(selectedDates.filter(d => d.toDateString() !== dateStr));
        } else {
            setSelectedDates([...selectedDates, date]);
        }
    };

    const toggleWeekday = (day: number) => {
        if (selectedWeekdays.includes(day)) {
            setSelectedWeekdays(selectedWeekdays.filter(d => d !== day));
        } else {
            setSelectedWeekdays([...selectedWeekdays, day]);
        }
    };

    const formatTime = (time: Date) => {
        return time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const getStepTitle = () => {
        switch (step) {
            case 'client': return 'Select Client';
            case 'days': return 'Select Day(s)';
            case 'time': return 'Select Time';
            case 'details': return 'Session Details';
            case 'confirm': return 'Confirm';
            default: return 'Manual Scheduler';
        }
    };

    const canProceed = () => {
        switch (step) {
            case 'client': return selectedClient !== null;
            case 'days': return (recurrence === 'once' && selectedDates.length > 0) || (recurrence === 'weekly' && selectedWeekdays.length > 0);
            case 'time': return selectedTime !== null;
            case 'details': return true;
            case 'confirm': return true;
            default: return false;
        }
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
            <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
                <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
                    <Text style={[styles.title, { color: theme.colors.text }]}>{getStepTitle()}</Text>
                    <TouchableOpacity onPress={onClose}>
                        <X size={24} color={theme.colors.text} />
                    </TouchableOpacity>
                </View>

                <ScrollView style={styles.content}>
                    {/* Step indicator */}
                    <View style={styles.stepIndicator}>
                        <View style={styles.stepDots}>
                            {['client', 'days', 'time', 'details', 'confirm'].map((s, i) => (
                                <View
                                    key={s}
                                    style={[
                                        styles.stepDot,
                                        { backgroundColor: theme.colors.border },
                                        step === s && { backgroundColor: theme.colors.primary },
                                    ]}
                                />
                            ))}
                        </View>
                        <Text style={[styles.stepText, { color: theme.colors.textSecondary }]}>
                            Step {['client', 'days', 'time', 'details', 'confirm'].indexOf(step) + 1} of 5
                        </Text>
                    </View>

                    {/* Step 1: Client Selection */}
                    {step === 'client' && (
                        <View style={styles.stepContent}>
                            <Text style={[styles.description, { color: theme.colors.textSecondary }]}>
                                Select which client to schedule a session for
                            </Text>
                            {clients.map(client => (
                                <TouchableOpacity
                                    key={client.id}
                                    style={[
                                        styles.clientCard,
                                        { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                                        selectedClient?.id === client.id && { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary + '10' },
                                    ]}
                                    onPress={() => setSelectedClient(client)}
                                >
                                    <View style={[styles.avatar, { backgroundColor: theme.colors.surfaceAlt }]}>
                                        <User size={24} color={theme.colors.textSecondary} />
                                    </View>
                                    <Text style={[styles.clientName, { color: theme.colors.text }]}>
                                        {client.profiles.full_name}
                                    </Text>
                                    {selectedClient?.id === client.id && (
                                        <Check size={20} color={theme.colors.primary} />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}

                    {/* Step 2: Day(s) Selection */}
                    {step === 'days' && (
                        <View style={styles.stepContent}>
                            <Text style={[styles.description, { color: theme.colors.textSecondary }]}>
                                Choose between a one-time session or recurring weekly sessions
                            </Text>

                            {/* Recurrence toggle */}
                            <View style={styles.recurrenceToggle}>
                                <TouchableOpacity
                                    style={[
                                        styles.recurrenceButton,
                                        { borderColor: theme.colors.border },
                                        recurrence === 'once' && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
                                    ]}
                                    onPress={() => {
                                        setRecurrence('once');
                                        setSelectedWeekdays([]);
                                    }}
                                >
                                    <Calendar size={20} color={recurrence === 'once' ? theme.colors.textOnPrimary : theme.colors.text} />
                                    <Text style={[styles.recurrenceText, { color: recurrence === 'once' ? theme.colors.textOnPrimary : theme.colors.text }]}>
                                        One-time
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[
                                        styles.recurrenceButton,
                                        { borderColor: theme.colors.border },
                                        recurrence === 'weekly' && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
                                    ]}
                                    onPress={() => {
                                        setRecurrence('weekly');
                                        setSelectedDates([]);
                                    }}
                                >
                                    <Repeat size={20} color={recurrence === 'weekly' ? theme.colors.textOnPrimary : theme.colors.text} />
                                    <Text style={[styles.recurrenceText, { color: recurrence === 'weekly' ? theme.colors.textOnPrimary : theme.colors.text }]}>
                                        Recurring
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            {recurrence === 'once' ? (
                                <>
                                    <Text style={[styles.sectionLabel, { color: theme.colors.text }]}>Select date(s):</Text>
                                    <View style={styles.datesGrid}>
                                        {next14Days.map(date => {
                                            const dateStr = date.toISOString().split('T')[0];
                                            const isBlocked = blockedDates.has(dateStr);
                                            const isSelected = selectedDates.some(d => d.toDateString() === date.toDateString());

                                            return (
                                                <TouchableOpacity
                                                    key={date.toISOString()}
                                                    style={[
                                                        styles.dateCard,
                                                        { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                                                        isSelected && { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary + '15' },
                                                        isBlocked && styles.blockedCard,
                                                    ]}
                                                    onPress={() => !isBlocked && toggleDate(date)}
                                                    disabled={isBlocked}
                                                >
                                                    <Text style={[styles.dateWeekday, { color: theme.colors.textSecondary }, isSelected && { color: theme.colors.primary }]}>
                                                        {date.toLocaleDateString('en-US', { weekday: 'short' })}
                                                    </Text>
                                                    <Text style={[styles.dateDay, { color: theme.colors.text }, isSelected && { color: theme.colors.primary, fontWeight: '700' }]}>
                                                        {date.getDate()}
                                                    </Text>
                                                    <Text style={[styles.dateMonth, { color: theme.colors.textSecondary }, isSelected && { color: theme.colors.primary }]}>
                                                        {date.toLocaleDateString('en-US', { month: 'short' })}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                </>
                            ) : (
                                <>
                                    <Text style={[styles.sectionLabel, { color: theme.colors.text }]}>Select weekday(s):</Text>
                                    <View style={styles.weekdaysGrid}>
                                        {weekdays.map(({ day, name, short }) => {
                                            const isSelected = selectedWeekdays.includes(day);
                                            return (
                                                <TouchableOpacity
                                                    key={day}
                                                    style={[
                                                        styles.weekdayCard,
                                                        { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                                                        isSelected && { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary + '15' },
                                                    ]}
                                                    onPress={() => toggleWeekday(day)}
                                                >
                                                    <Text style={[styles.weekdayText, { color: theme.colors.text }, isSelected && { color: theme.colors.primary, fontWeight: '700' }]}>
                                                        {short}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                </>
                            )}
                        </View>
                    )}

                    {/* Step 3: Time Selection */}
                    {step === 'time' && (
                        <View style={styles.stepContent}>
                            <Text style={[styles.description, { color: theme.colors.textSecondary }]}>
                                Select an available time slot
                            </Text>
                            
                            {loading ? (
                                <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 40 }} />
                            ) : availableSlots.length === 0 ? (
                                <View style={styles.emptyState}>
                                    <AlertCircle size={48} color={theme.colors.border} />
                                    <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                                        No available time slots
                                    </Text>
                                </View>
                            ) : (
                                <View style={styles.timeSlotsList}>
                                    {availableSlots.map((slot, index) => (
                                        <TouchableOpacity
                                            key={index}
                                            style={[
                                                styles.timeSlot,
                                                { borderColor: theme.colors.border },
                                                slot.available ? { backgroundColor: theme.colors.primary + '10' } : { backgroundColor: theme.colors.inputBackground },
                                                selectedTime?.getTime() === slot.time.getTime() && { backgroundColor: theme.colors.primary + '25', borderColor: theme.colors.primary },
                                            ]}
                                            onPress={() => slot.available && setSelectedTime(slot.time)}
                                            disabled={!slot.available}
                                        >
                                            <View style={styles.timeSlotContent}>
                                                <Clock size={18} color={slot.available ? theme.colors.primary : theme.colors.textTertiary} />
                                                <Text style={[
                                                    styles.timeSlotText,
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
                                            {selectedTime?.getTime() === slot.time.getTime() && (
                                                <Check size={18} color={theme.colors.primary} />
                                            )}
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}
                        </View>
                    )}

                    {/* Step 4: Session Details */}
                    {step === 'details' && (
                        <View style={styles.stepContent}>
                            <Text style={[styles.description, { color: theme.colors.textSecondary }]}>
                                Configure session details
                            </Text>

                            <View style={styles.detailsForm}>
                                <View style={styles.formGroup}>
                                    <Text style={[styles.formLabel, { color: theme.colors.text }]}>Duration (minutes)</Text>
                                    <TextInput
                                        style={[styles.formInput, { backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.border, color: theme.colors.text }]}
                                        value={duration.toString()}
                                        onChangeText={(text) => setDuration(parseInt(text) || 60)}
                                        keyboardType="number-pad"
                                    />
                                </View>

                                <View style={styles.formGroup}>
                                    <Text style={[styles.formLabel, { color: theme.colors.text }]}>Session Type</Text>
                                    <View style={styles.typeButtons}>
                                        {sessionTypes.map(type => (
                                            <TouchableOpacity
                                                key={type.value}
                                                style={[
                                                    styles.typeButton,
                                                    { borderColor: theme.colors.border },
                                                    sessionType === type.value && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
                                                ]}
                                                onPress={() => setSessionType(type.value as any)}
                                            >
                                                <Text style={[
                                                    styles.typeButtonText,
                                                    { color: theme.colors.text },
                                                    sessionType === type.value && { color: theme.colors.textOnPrimary }
                                                ]}>
                                                    {type.label}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>

                                <View style={styles.formGroup}>
                                    <Text style={[styles.formLabel, { color: theme.colors.text }]}>Notes (optional)</Text>
                                    <TextInput
                                        style={[styles.formInputMultiline, { backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.border, color: theme.colors.text }]}
                                        value={notes}
                                        onChangeText={setNotes}
                                        multiline
                                        numberOfLines={3}
                                        placeholder="Add session notes..."
                                        placeholderTextColor={theme.colors.textTertiary}
                                    />
                                </View>
                            </View>
                        </View>
                    )}

                    {/* Step 5: Confirm */}
                    {step === 'confirm' && selectedClient && selectedTime && (
                        <View style={styles.stepContent}>
                            <Text style={[styles.description, { color: theme.colors.textSecondary }]}>
                                Review and confirm session details
                            </Text>

                            <View style={[styles.confirmCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                                <View style={styles.confirmRow}>
                                    <Text style={[styles.confirmLabel, { color: theme.colors.textSecondary }]}>Client:</Text>
                                    <Text style={[styles.confirmValue, { color: theme.colors.text }]}>{selectedClient.profiles.full_name}</Text>
                                </View>
                                <View style={styles.confirmRow}>
                                    <Text style={[styles.confirmLabel, { color: theme.colors.textSecondary }]}>Type:</Text>
                                    <Text style={[styles.confirmValue, { color: theme.colors.text }]}>{recurrence === 'once' ? 'One-time' : 'Recurring weekly'}</Text>
                                </View>
                                <View style={styles.confirmRow}>
                                    <Text style={[styles.confirmLabel, { color: theme.colors.textSecondary }]}>
                                        {recurrence === 'once' ? 'Date(s):' : 'Days:'}
                                    </Text>
                                    <Text style={[styles.confirmValue, { color: theme.colors.text }]}>
                                        {recurrence === 'once' 
                                            ? selectedDates.map(d => d.toLocaleDateString()).join(', ')
                                            : selectedWeekdays.map(d => weekdays.find(w => w.day === d)?.name).join(', ')
                                        }
                                    </Text>
                                </View>
                                <View style={styles.confirmRow}>
                                    <Text style={[styles.confirmLabel, { color: theme.colors.textSecondary }]}>Time:</Text>
                                    <Text style={[styles.confirmValue, { color: theme.colors.text }]}>{formatTime(selectedTime)}</Text>
                                </View>
                                <View style={styles.confirmRow}>
                                    <Text style={[styles.confirmLabel, { color: theme.colors.textSecondary }]}>Duration:</Text>
                                    <Text style={[styles.confirmValue, { color: theme.colors.text }]}>{duration} minutes</Text>
                                </View>
                                <View style={styles.confirmRow}>
                                    <Text style={[styles.confirmLabel, { color: theme.colors.textSecondary }]}>Session Type:</Text>
                                    <Text style={[styles.confirmValue, { color: theme.colors.text }]}>
                                        {sessionTypes.find(t => t.value === sessionType)?.label}
                                    </Text>
                                </View>
                                {notes && (
                                    <View style={styles.confirmRow}>
                                        <Text style={[styles.confirmLabel, { color: theme.colors.textSecondary }]}>Notes:</Text>
                                        <Text style={[styles.confirmValue, { color: theme.colors.text }]}>{notes}</Text>
                                    </View>
                                )}
                            </View>
                        </View>
                    )}
                </ScrollView>

                {/* Footer */}
                <View style={[styles.footer, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border }]}>
                    <View style={styles.footerButtons}>
                        {step !== 'client' && (
                            <TouchableOpacity
                                style={[styles.secondaryButton, { borderColor: theme.colors.border }]}
                                onPress={handleBack}
                            >
                                <Text style={[styles.secondaryButtonText, { color: theme.colors.text }]}>Back</Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity
                            style={[
                                styles.primaryButton,
                                { backgroundColor: theme.colors.primary },
                                !canProceed() && styles.buttonDisabled,
                            ]}
                            onPress={step === 'confirm' ? handleConfirm : handleNext}
                            disabled={!canProceed() || loading}
                        >
                            {loading ? (
                                <ActivityIndicator color={theme.colors.textOnPrimary} />
                            ) : (
                                <Text style={[styles.primaryButtonText, { color: theme.colors.textOnPrimary }]}>
                                    {step === 'confirm' ? 'Confirm & Create' : 'Next'}
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
    },
    stepIndicator: {
        padding: 20,
        alignItems: 'center',
    },
    stepDots: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 8,
    },
    stepDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    stepText: {
        fontSize: 12,
    },
    stepContent: {
        padding: 20,
    },
    description: {
        fontSize: 14,
        marginBottom: 20,
        lineHeight: 20,
    },
    clientCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 12,
        borderWidth: 2,
        marginBottom: 12,
        gap: 12,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    clientName: {
        flex: 1,
        fontSize: 16,
        fontWeight: '600',
    },
    recurrenceToggle: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 24,
    },
    recurrenceButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 16,
        borderRadius: 12,
        borderWidth: 2,
    },
    recurrenceText: {
        fontSize: 16,
        fontWeight: '600',
    },
    sectionLabel: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 12,
    },
    datesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    dateCard: {
        width: 80,
        padding: 12,
        borderRadius: 12,
        borderWidth: 2,
        alignItems: 'center',
    },
    blockedCard: {
        opacity: 0.4,
    },
    dateWeekday: {
        fontSize: 12,
        marginBottom: 4,
    },
    dateDay: {
        fontSize: 24,
        fontWeight: '700',
        marginBottom: 2,
    },
    dateMonth: {
        fontSize: 12,
    },
    weekdaysGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    weekdayCard: {
        flex: 1,
        minWidth: 80,
        padding: 16,
        borderRadius: 12,
        borderWidth: 2,
        alignItems: 'center',
    },
    weekdayText: {
        fontSize: 16,
        fontWeight: '600',
    },
    timeSlotsList: {
        gap: 8,
    },
    timeSlot: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
    },
    timeSlotContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1,
    },
    timeSlotText: {
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
    detailsForm: {
        gap: 20,
    },
    formGroup: {
        gap: 8,
    },
    formLabel: {
        fontSize: 14,
        fontWeight: '600',
    },
    formInput: {
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        fontSize: 16,
    },
    formInputMultiline: {
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        fontSize: 16,
        minHeight: 80,
        textAlignVertical: 'top',
    },
    typeButtons: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    typeButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
    },
    typeButtonText: {
        fontSize: 14,
        fontWeight: '500',
    },
    confirmCard: {
        padding: 20,
        borderRadius: 12,
        borderWidth: 1,
        gap: 12,
    },
    confirmRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 12,
    },
    confirmLabel: {
        fontSize: 14,
        fontWeight: '600',
    },
    confirmValue: {
        fontSize: 14,
        flex: 1,
        textAlign: 'right',
    },
    footer: {
        padding: 20,
        borderTopWidth: 1,
    },
    footerButtons: {
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
