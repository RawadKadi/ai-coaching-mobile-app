import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { X, Calendar as CalendarIcon, Clock, ChevronRight, Check, ChevronLeft } from 'lucide-react-native';
import { availabilityService } from '@/lib/availability-service';

type PostponeReason = 'Sickness' | 'Family Emergency' | 'Schedule Conflict' | 'Personal Emergency' | 'Other';

type ReschedulePreference = 'later_today' | 'tomorrow' | 'specific_date' | 'next_available';

interface PostponeModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (reason: string, newDate: string) => Promise<void>;
  coachId: string;
  initialDate: string; // The original session date
  clientId?: string;
  sessionId?: string;
}

export default function PostponeModal({ visible, onClose, onConfirm, coachId, initialDate, clientId, sessionId }: PostponeModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1); // 1=Reason, 2=Day Selection, 3=Slot Selection
  const [reason, setReason] = useState<string>('');
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [groupedSlots, setGroupedSlots] = useState<Record<string, string[]>>({});
  const [availableDays, setAvailableDays] = useState<string[]>([]);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setStep(1);
      setReason('');
      setSelectedSlot(null);
      setAvailableSlots([]);
      setGroupedSlots({});
      setAvailableDays([]);
      setSelectedDay(null);
      setSubmitting(false);
    }
  }, [visible]);

  const handleReasonSelect = async (r: string) => {
    setReason(r);
    setStep(2);
    setLoadingSlots(true);
    setAvailableSlots([]);
    setGroupedSlots({});
    setAvailableDays([]);

    try {
      const today = new Date();
      const originalDate = initialDate ? new Date(initialDate) : undefined;
      
      // Fetch plenty of slots to cover multiple days (limit 100 to cover "End of Next Week")
      const slots = await availabilityService.findNextAvailableSlots(coachId, today, 100, clientId, sessionId, originalDate);
      
      // Group slots by day
      const grouped: Record<string, string[]> = {};
      slots.forEach(slot => {
          const date = new Date(slot);
          const dateKey = date.toDateString(); // "Sat Dec 06 2025"
          if (!grouped[dateKey]) {
              grouped[dateKey] = [];
          }
          grouped[dateKey].push(slot);
      });

      setGroupedSlots(grouped);
      setAvailableDays(Object.keys(grouped));
      setAvailableSlots(slots);
      
    } catch (error) {
      console.error('Error fetching slots:', error);
      Alert.alert('Error', 'Failed to find available slots. Please try again.');
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleDaySelect = (day: string) => {
      setSelectedDay(day);
      setStep(3);
  };

  const handleConfirm = async () => {
    if (!selectedSlot || !reason) return;
    
    try {
      setSubmitting(true);
      await onConfirm(reason, selectedSlot);
      onClose();
    } catch (error) {
      console.error('Error confirming postpone:', error);
      Alert.alert('Error', 'Failed to postpone session');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelSession = () => {
      Alert.alert(
          'Cancel Session', 
          'To cancel, please use the "Cancel" button on the session invite card.',
          [{ text: 'OK', onPress: onClose }]
      );
  };

  const formatDayLabel = (dateString: string) => {
      const date = new Date(dateString);
      const today = new Date();
      const isToday = date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
      
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const isTomorrow = date.getDate() === tomorrow.getDate() && date.getMonth() === tomorrow.getMonth() && date.getFullYear() === tomorrow.getFullYear();

      if (isToday) return 'Later Today';
      if (isTomorrow) return 'Tomorrow';
      return date.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
  };

  const formatSlotTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>
              {step === 1 && 'Why are you postponing?'}
              {step === 2 && 'Select a Day'}
              {step === 3 && 'Select a Time'}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressContainer}>
            <View style={[styles.progressBar, { width: `${(step / 3) * 100}%` }]} />
          </View>

          <ScrollView style={styles.content}>
            
            {/* STEP 1: Reason */}
            {step === 1 && (
              <View style={styles.optionsContainer}>
                {['Sickness', 'Family Emergency', 'Schedule Conflict', 'Personal Emergency', 'Other'].map((r) => (
                  <TouchableOpacity 
                    key={r} 
                    style={[styles.optionButton, reason === r && styles.selectedOption]}
                    onPress={() => handleReasonSelect(r)}
                  >
                    <Text style={[styles.optionText, reason === r && styles.selectedOptionText]}>{r}</Text>
                    {reason === r && <Check size={20} color="#3B82F6" />}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* STEP 2: Day Selection */}
            {step === 2 && (
              <View>
                {loadingSlots ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#3B82F6" />
                    <Text style={styles.loadingText}>Finding best available days...</Text>
                  </View>
                ) : availableDays.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyTitle}>No Available Days</Text>
                    <Text style={styles.emptyText}>
                        Your schedule or the coach's schedule is full for the next 2 weeks.
                    </Text>
                    <TouchableOpacity onPress={handleCancelSession} style={styles.cancelLinkButton}>
                      <Text style={styles.cancelLinkText}>Cancel Session Instead</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.optionsContainer}>
                    {availableDays.map((day) => (
                      <TouchableOpacity
                        key={day}
                        style={styles.optionButton}
                        onPress={() => handleDaySelect(day)}
                      >
                        <View style={styles.optionRow}>
                            <CalendarIcon size={20} color="#4B5563" />
                            <Text style={styles.optionText}>{formatDayLabel(day)}</Text>
                        </View>
                        <ChevronRight size={20} color="#9CA3AF" />
                      </TouchableOpacity>
                    ))}
                    
                    <View style={styles.cantDoTodayContainer}>
                        <TouchableOpacity onPress={handleCancelSession} style={styles.cancelLinkButton}>
                            <Text style={styles.cancelLinkText}>Cancel Session Instead</Text>
                        </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* STEP 3: Slot Selection */}
            {step === 3 && selectedDay && (
                <View>
                    <Text style={styles.dayHeader}>{formatDayLabel(selectedDay)}</Text>
                    <View style={styles.slotsGrid}>
                        {groupedSlots[selectedDay]?.map((slot) => (
                            <TouchableOpacity
                                key={slot}
                                style={[styles.slotButton, selectedSlot === slot && styles.selectedSlot]}
                                onPress={() => setSelectedSlot(slot)}
                            >
                                <Text style={[styles.slotText, selectedSlot === slot && styles.selectedSlotText]}>
                                    {formatSlotTime(slot)}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            )}

          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.footer}>
            {step > 1 && (
              <TouchableOpacity 
                style={styles.backButton} 
                onPress={() => setStep(prev => (prev - 1) as 1 | 2 | 3)}
                disabled={submitting}
              >
                <Text style={styles.backButtonText}>Back</Text>
              </TouchableOpacity>
            )}
            
            {step === 3 && selectedSlot && (
              <TouchableOpacity 
                style={[styles.confirmButton, submitting && styles.disabledButton]} 
                onPress={handleConfirm}
                disabled={submitting}
              >
                {submitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.confirmButtonText}>Confirm Change</Text>}
              </TouchableOpacity>
            )}
          </View>

        </View>
      </View>
    </Modal>
  );
}

const SparklesIcon = () => (
    <View style={{ width: 20, height: 20, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 16 }}>✨</Text>
    </View>
);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '80%',
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  closeButton: {
    padding: 4,
  },
  progressContainer: {
    height: 4,
    backgroundColor: '#F3F4F6',
    width: '100%',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#3B82F6',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  optionsContainer: {
    gap: 12,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  selectedOption: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  optionText: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
  },
  selectedOptionText: {
    color: '#3B82F6',
    fontWeight: '600',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    color: '#6B7280',
    fontSize: 14,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    gap: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  emptyText: {
    color: '#6B7280',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  cancelLinkButton: {
    padding: 12,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  cancelLinkText: {
    color: '#EF4444',
    fontWeight: '600',
    fontSize: 16,
  },
  backLink: {
    padding: 8,
  },
  backLinkText: {
    color: '#3B82F6',
    fontWeight: '600',
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  slotButton: {
    width: '48%',
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  selectedSlot: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  slotText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  selectedSlotText: {
    color: '#3B82F6',
    fontWeight: '600',
  },
  dayHeader: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
    marginTop: 8,
  },
  cantDoTodayContainer: {
    marginTop: 24,
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  cantDoTodayText: {
    color: '#6B7280',
    fontSize: 14,
    marginBottom: 12,
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    padding: 12,
  },
  backButtonText: {
    color: '#6B7280',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginLeft: 'auto',
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.7,
  },
});
