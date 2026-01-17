import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Modal, TextInput, ActivityIndicator, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/BrandContext';
import { availabilityService, AvailabilitySlot, DayOfWeek, BlockedDate } from '@/lib/availability-service';
import { ArrowLeft, Plus, Trash2, Sparkles, Calendar as CalendarIcon, Clock } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { generateText } from '@/lib/google-ai';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function AvailabilitySettings() {
  const router = useRouter();
  const { coach } = useAuth();
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [availability, setAvailability] = useState<Record<number, AvailabilitySlot[]>>({});
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [initialAvailability, setInitialAvailability] = useState<Record<number, AvailabilitySlot[]>>({});
  const [initialBlockedDates, setInitialBlockedDates] = useState<BlockedDate[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  
  // AI Modal State
  const [aiModalVisible, setAiModalVisible] = useState(false);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  // Block Date Modal State
  const [blockModalVisible, setBlockModalVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [blockReason, setBlockReason] = useState('');

  // Time Picker State
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [editingSlot, setEditingSlot] = useState<{day: number, index: number, type: 'start' | 'end'} | null>(null);
  const [tempTime, setTempTime] = useState(new Date());

  useEffect(() => {
    loadData();
  }, [coach]);

  useEffect(() => {
    checkChanges();
  }, [availability, blockedDates]);

  const checkChanges = () => {
    const availabilityChanged = JSON.stringify(availability) !== JSON.stringify(initialAvailability);
    const blockedDatesChanged = JSON.stringify(blockedDates) !== JSON.stringify(initialBlockedDates);
    setHasChanges(availabilityChanged || blockedDatesChanged);
  };

  const loadData = async () => {
    if (!coach) return;
    try {
      setLoading(true);
      const slots = await availabilityService.getAvailability(coach.id);
      const blocked = await availabilityService.getBlockedDates(coach.id);
      
      // Group slots by day
      const grouped: Record<number, AvailabilitySlot[]> = {};
      DAYS.forEach((_, index) => {
        grouped[index] = [];
      });
      slots.forEach(slot => {
        if (!grouped[slot.day_of_week]) grouped[slot.day_of_week] = [];
        grouped[slot.day_of_week].push(slot);
      });
      
      setAvailability(grouped);
      setInitialAvailability(JSON.parse(JSON.stringify(grouped))); // Deep copy
      
      setBlockedDates(blocked);
      setInitialBlockedDates(JSON.parse(JSON.stringify(blocked))); // Deep copy
    } catch (error) {
      console.error('Error loading availability:', error);
      Alert.alert('Error', 'Failed to load availability settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAll = async () => {
    if (!coach) return;
    try {
      setLoading(true);
      
      // 1. Save Availability Schedule
      const availabilityPromises = Object.keys(availability).map(async (dayIndexStr) => {
        const dayIndex = parseInt(dayIndexStr);
        // Only update if this day changed
        if (JSON.stringify(availability[dayIndex]) !== JSON.stringify(initialAvailability[dayIndex])) {
             const slots = availability[dayIndex] || [];
             await availabilityService.updateDayAvailability(coach.id, dayIndex as DayOfWeek, slots);
        }
      });

      // 2. Sync Blocked Dates
      // Find added dates (in blockedDates but not in initialBlockedDates)
      // Note: We use date string as key for comparison
      const initialDatesSet = new Set(initialBlockedDates.map(d => d.date));
      const currentDatesSet = new Set(blockedDates.map(d => d.date));

      const addedDates = blockedDates.filter(d => !initialDatesSet.has(d.date));
      const removedDates = initialBlockedDates.filter(d => !currentDatesSet.has(d.date));

      const blockPromises = addedDates.map(d => availabilityService.blockDate(coach.id, d.date, d.reason));
      const unblockPromises = removedDates.map(d => d.id ? availabilityService.unblockDate(d.id) : Promise.resolve());

      await Promise.all([...availabilityPromises, ...blockPromises, ...unblockPromises]);
      
      Alert.alert('Success', 'All availability settings saved successfully');
      
      // Refresh initial state to current state
      setInitialAvailability(JSON.parse(JSON.stringify(availability)));
      setInitialBlockedDates(JSON.parse(JSON.stringify(blockedDates)));
      setHasChanges(false);

    } catch (error) {
      console.error('Save error:', error);
      Alert.alert('Error', 'Failed to save availability settings');
    } finally {
      setLoading(false);
    }
  };

  const addSlot = (dayIndex: number) => {
    const newSlot: AvailabilitySlot = {
      day_of_week: dayIndex as DayOfWeek,
      start_time: '09:00:00',
      end_time: '17:00:00',
      is_active: true
    };
    setAvailability(prev => ({
      ...prev,
      [dayIndex]: [...(prev[dayIndex] || []), newSlot]
    }));
  };

  const removeSlot = (dayIndex: number, slotIndex: number) => {
    setAvailability(prev => ({
      ...prev,
      [dayIndex]: prev[dayIndex].filter((_, i) => i !== slotIndex)
    }));
  };

  const updateSlotTime = (dayIndex: number, slotIndex: number, type: 'start' | 'end', time: Date) => {
    const timeStr = time.toTimeString().split(' ')[0];
    setAvailability(prev => {
      const daySlots = [...prev[dayIndex]];
      daySlots[slotIndex] = { ...daySlots[slotIndex], [type === 'start' ? 'start_time' : 'end_time']: timeStr };
      return { ...prev, [dayIndex]: daySlots };
    });
  };

  const handleAiGenerate = async () => {
    if (!aiInput.trim()) return;
    setAiLoading(true);
    try {
      const prompt = `
        Parse the following availability text into a JSON object where keys are day indices (0=Sunday, 1=Monday, etc.) and values are arrays of objects with "start_time" and "end_time" in HH:MM:SS format.
        Text: "${aiInput}"
        Example Output: {"1": [{"start_time": "09:00:00", "end_time": "12:00:00"}, {"start_time": "14:00:00", "end_time": "18:00:00"}], "2": ...}
        Only return the JSON.
      `;
      const response = await generateText(prompt);
      const parsed = JSON.parse(response.replace(/```json/g, '').replace(/```/g, '').trim());
      
      // Merge with existing structure
      const newAvailability = { ...availability };
      Object.keys(parsed).forEach(day => {
        const dayIndex = parseInt(day);
        if (!isNaN(dayIndex) && dayIndex >= 0 && dayIndex <= 6) {
          newAvailability[dayIndex] = parsed[day].map((slot: any) => ({
            day_of_week: dayIndex,
            start_time: slot.start_time,
            end_time: slot.end_time,
            is_active: true
          }));
        }
      });
      
      setAvailability(newAvailability);
      setAiModalVisible(false);
      
      // Save all updated days
      if (coach) {
        for (const day of Object.keys(parsed)) {
             await availabilityService.updateDayAvailability(coach.id, parseInt(day) as DayOfWeek, newAvailability[parseInt(day)]);
        }
        Alert.alert('Success', 'Availability updated from AI suggestion!');
      }

    } catch (error) {
      console.error('AI Error:', error);
      Alert.alert('Error', 'Failed to generate schedule. Please try again.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleBlockDate = () => {
    const dateStr = selectedDate.toISOString().split('T')[0];
    // Check if already blocked
    if (blockedDates.some(d => d.date === dateStr)) {
        Alert.alert('Info', 'This date is already blocked.');
        return;
    }

    const newBlocked: BlockedDate = {
        date: dateStr,
        reason: blockReason
    };
    
    setBlockedDates(prev => [...prev, newBlocked].sort((a, b) => a.date.localeCompare(b.date)));
    setBlockModalVisible(false);
    setBlockReason('');
  };

  const handleUnblockDate = (dateStr: string) => {
    setBlockedDates(prev => prev.filter(d => d.date !== dateStr));
  };

  const formatTime = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':');
    const date = new Date();
    date.setHours(parseInt(hours), parseInt(minutes));
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.colors.text }]}>Availability</Text>
        <TouchableOpacity 
            onPress={handleSaveAll} 
            style={[styles.saveButton, { backgroundColor: !hasChanges ? theme.colors.primaryDisabled : theme.colors.primary }, !hasChanges && styles.disabledButton]}
            disabled={!hasChanges}
        >
          <Text style={styles.saveButtonText}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <View style={[styles.section, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <View style={styles.sectionHeaderRow}>
             <View>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Weekly Schedule</Text>
                <Text style={[styles.sectionSubtitle, { color: theme.colors.textSecondary }]}>Set your standard working hours.</Text>
             </View>
             <TouchableOpacity onPress={() => setAiModalVisible(true)} style={styles.aiButton}>
                <Sparkles size={16} color="#FFFFFF" />
                <Text style={styles.aiButtonText}>AI Assist</Text>
             </TouchableOpacity>
          </View>
          
          {DAYS.map((day, index) => (
            <View key={index} style={styles.dayContainer}>
              <View style={styles.dayHeader}>
                <Text style={[styles.dayName, { color: theme.colors.text }]}>{day}</Text>
                <TouchableOpacity onPress={() => addSlot(index)} style={styles.addButton}>
                  <Plus size={16} color="#3B82F6" />
                  <Text style={styles.addButtonText}>Add Hours</Text>
                </TouchableOpacity>
              </View>
              
              {availability[index]?.length === 0 && (
                <Text style={styles.unavailableText}>Unavailable</Text>
              )}

              {availability[index]?.map((slot, slotIndex) => (
                <View key={slotIndex} style={styles.slotContainer}>
                  <TouchableOpacity 
                    style={styles.timeButton}
                    onPress={() => {
                        const [h, m] = slot.start_time.split(':');
                        const d = new Date(); d.setHours(parseInt(h), parseInt(m));
                        setTempTime(d);
                        setEditingSlot({ day: index, index: slotIndex, type: 'start' });
                        setShowTimePicker(true);
                    }}
                  >
                    <Text style={styles.timeText}>{formatTime(slot.start_time)}</Text>
                  </TouchableOpacity>
                  <Text style={styles.toText}>to</Text>
                  <TouchableOpacity 
                    style={styles.timeButton}
                    onPress={() => {
                        const [h, m] = slot.end_time.split(':');
                        const d = new Date(); d.setHours(parseInt(h), parseInt(m));
                        setTempTime(d);
                        setEditingSlot({ day: index, index: slotIndex, type: 'end' });
                        setShowTimePicker(true);
                    }}
                  >
                    <Text style={styles.timeText}>{formatTime(slot.end_time)}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => removeSlot(index, slotIndex)} style={styles.removeButton}>
                    <Trash2 size={16} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ))}
              {/* Removed per-day save button */}
            </View>
          ))}
        </View>


        <View style={[styles.section, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <View style={styles.sectionHeaderRow}>
             <View>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Blocked Dates</Text>
                <Text style={[styles.sectionSubtitle, { color: theme.colors.textSecondary }]}>Vacations, holidays, or days off.</Text>
             </View>
             <TouchableOpacity onPress={() => setBlockModalVisible(true)} style={styles.blockButton}>
                <Plus size={16} color="#FFFFFF" />
                <Text style={styles.blockButtonText}>Block Date</Text>
             </TouchableOpacity>
          </View>

          {blockedDates.map((blocked) => (
            <View key={blocked.id} style={styles.blockedItem}>
              <View>
                <Text style={styles.blockedDate}>
                  {new Date(blocked.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                </Text>
                {blocked.reason && <Text style={styles.blockedReason}>{blocked.reason}</Text>}
              </View>
              <TouchableOpacity onPress={() => handleUnblockDate(blocked.date)}>
                <Trash2 size={18} color="#EF4444" />
              </TouchableOpacity>
            </View>
          ))}
          {blockedDates.length === 0 && (
            <Text style={styles.emptyText}>No blocked dates.</Text>
          )}
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* AI Modal */}
      <Modal visible={aiModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.modalHeader}>
                <Sparkles size={24} color={theme.colors.primary} />
                <Text style={[styles.modalTitle, { color: theme.colors.text }]}>AI Schedule Assistant</Text>
            </View>
            <Text style={[styles.modalDescription, { color: theme.colors.textSecondary }]}>
              Tell me your working hours naturally. For example:
              "I work Monday to Friday from 9am to 5pm, and Saturdays from 10am to 2pm."
            </Text>
            <TextInput
              style={styles.aiInput}
              multiline
              placeholder="Type your schedule here..."
              value={aiInput}
              onChangeText={setAiInput}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setAiModalVisible(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.generateButton, aiLoading && styles.disabledButton]} 
                onPress={handleAiGenerate}
                disabled={aiLoading}
              >
                {aiLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.generateButtonText}>Generate</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Block Date Modal */}
      <Modal visible={blockModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Block a Date</Text>
            <DateTimePicker
              value={selectedDate}
              mode="date"
              display="inline"
              onChange={(e, date) => date && setSelectedDate(date)}
              minimumDate={new Date()}
            />
            <TextInput
              style={styles.input}
              placeholder="Reason (optional)"
              value={blockReason}
              onChangeText={setBlockReason}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setBlockModalVisible(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.generateButton} onPress={handleBlockDate}>
                <Text style={styles.generateButtonText}>Block Date</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Time Picker (Platform specific handling needed for better UX, using standard for now) */}
      {showTimePicker && (
        <DateTimePicker
          value={tempTime}
          mode="time"
          display="spinner"
          onChange={(event, date) => {
            setShowTimePicker(false);
            if (date && editingSlot) {
                updateSlotTime(editingSlot.day, editingSlot.index, editingSlot.type, date);
            }
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    paddingTop: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  saveButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  aiButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  aiButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 12,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  dayContainer: {
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingBottom: 16,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dayName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addButtonText: {
    color: '#3B82F6',
    fontSize: 14,
    fontWeight: '600',
  },
  unavailableText: {
    color: '#9CA3AF',
    fontStyle: 'italic',
    fontSize: 14,
  },
  slotContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  timeButton: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  timeText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  toText: {
    color: '#6B7280',
  },
  removeButton: {
    padding: 4,
  },
  saveDayButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  saveDayText: {
    color: '#3B82F6',
    fontSize: 12,
    fontWeight: '600',
  },
  blockButton: {
    backgroundColor: '#EF4444',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  blockButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  blockedItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  blockedDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  blockedReason: {
    fontSize: 14,
    color: '#6B7280',
  },
  emptyText: {
    color: '#9CA3AF',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  modalDescription: {
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 16,
    lineHeight: 20,
  },
  aiInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    height: 100,
    textAlignVertical: 'top',
    fontSize: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginTop: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#4B5563',
    fontWeight: '600',
    fontSize: 16,
  },
  generateButton: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
  },
  generateButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
  disabledButton: {
    opacity: 0.7,
  },
});
