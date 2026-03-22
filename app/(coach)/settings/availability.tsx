import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, TextInput, ActivityIndicator, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { MotiView, AnimatePresence } from 'moti';
import { useAuth } from '@/contexts/AuthContext';
import { availabilityService, AvailabilitySlot, DayOfWeek, BlockedDate } from '@/lib/availability-service';
import { ArrowLeft, Plus, Trash2, Sparkles, Calendar as CalendarIcon, Clock, X, ChevronRight, Zap } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { generateText } from '@/lib/google-ai';

const DAYS_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAYS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function AvailabilitySettings() {
  const router = useRouter();
  const { coach } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [activeDay, setActiveDay] = useState(new Date().getDay());
  const [availability, setAvailability] = useState<Record<number, AvailabilitySlot[]>>({});
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [initialAvailability, setInitialAvailability] = useState<Record<number, AvailabilitySlot[]>>({});
  const [initialBlockedDates, setInitialBlockedDates] = useState<BlockedDate[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  
  // Modals
  const [aiModalVisible, setAiModalVisible] = useState(false);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [blockModalVisible, setBlockModalVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [blockReason, setBlockReason] = useState('');
  
  // Time Picker
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [editingSlot, setEditingSlot] = useState<{day: number, index: number, type: 'start' | 'end'} | null>(null);
  const [tempTime, setTempTime] = useState(new Date());

  useEffect(() => { loadData(); }, [coach]);
  useEffect(() => { checkChanges(); }, [availability, blockedDates]);

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
      const grouped: Record<number, AvailabilitySlot[]> = {};
      DAYS_FULL.forEach((_, index) => { grouped[index] = []; });
      slots.forEach(slot => { grouped[slot.day_of_week].push(slot); });
      setAvailability(grouped);
      setInitialAvailability(JSON.parse(JSON.stringify(grouped)));
      setBlockedDates(blocked);
      setInitialBlockedDates(JSON.parse(JSON.stringify(blocked)));
    } catch (error) {
      console.error('Load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAll = async () => {
    if (!coach) return;
    try {
      setLoading(true);
      const availabilityPromises = Object.keys(availability).map(async (dayIndexStr) => {
        const dayIndex = parseInt(dayIndexStr);
        if (JSON.stringify(availability[dayIndex]) !== JSON.stringify(initialAvailability[dayIndex])) {
             await availabilityService.updateDayAvailability(coach.id, dayIndex as DayOfWeek, availability[dayIndex] || []);
        }
      });
      const currentDatesSet = new Set(blockedDates.map(d => d.date));
      const initialDatesSet = new Set(initialBlockedDates.map(d => d.date));
      const addedDates = blockedDates.filter(d => !initialDatesSet.has(d.date));
      const removedDates = initialBlockedDates.filter(d => !currentDatesSet.has(d.date));
      const blockPromises = addedDates.map(d => availabilityService.blockDate(coach.id, d.date, d.reason));
      const unblockPromises = removedDates.map(d => d.id ? availabilityService.unblockDate(d.id) : Promise.resolve());
      await Promise.all([...availabilityPromises, ...blockPromises, ...unblockPromises]);
      router.back();
    } catch (e) {
      Alert.alert('Error', 'Save failed');
    } finally {
      setLoading(false);
    }
  };

  const addSlot = (dayIndex: number) => {
    const newSlot: AvailabilitySlot = { day_of_week: dayIndex as DayOfWeek, start_time: '09:00:00', end_time: '17:00:00', is_active: true };
    setAvailability(prev => ({ ...prev, [dayIndex]: [...(prev[dayIndex] || []), newSlot] }));
  };

  const removeSlot = (dayIndex: number, slotIndex: number) => {
    setAvailability(prev => ({ ...prev, [dayIndex]: prev[dayIndex].filter((_, i) => i !== slotIndex) }));
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
      const prompt = `Parse: "${aiInput}". Return ONLY JSON: {day_index: [{start_time: "HH:MM:SS", end_time: "HH:MM:SS"}]}. Day 0=Sun, 1=Mon...`;
      const response = await generateText(prompt);
      const parsed = JSON.parse(response.replace(/```json/g, '').replace(/```/g, '').trim());
      const newAvailability = { ...availability };
      Object.keys(parsed).forEach(day => {
        const d = parseInt(day);
        newAvailability[d] = parsed[day].map((s: any) => ({ day_of_week: d, start_time: s.start_time, end_time: s.end_time, is_active: true }));
      });
      setAvailability(newAvailability);
      setAiModalVisible(false);
    } catch (error) {
      Alert.alert('AI Error', 'Failed to parse schedule.');
    } finally {
      setAiLoading(false);
    }
  };

  const formatTime = (timeStr: string) => {
    const [h, m] = timeStr.split(':');
    const d = new Date(); d.setHours(parseInt(h), parseInt(m));
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <View className="flex-1 bg-slate-950 justify-center items-center">
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  const currentSlots = availability[activeDay] || [];

  return (
    <View className="flex-1 bg-slate-950">
      {/* Header */}
      <View className="px-6 pt-16 pb-6 flex-row items-center justify-between border-b border-slate-900 bg-slate-950">
        <TouchableOpacity onPress={() => router.back()} className="p-2 bg-slate-900 rounded-full border border-slate-800">
          <ArrowLeft size={20} color="#94A3B8" />
        </TouchableOpacity>
        <Text className="text-white text-xl font-bold">Availability Hub</Text>
        <TouchableOpacity 
          onPress={handleSaveAll}
          disabled={!hasChanges}
          className={`px-5 py-2 rounded-full ${hasChanges ? 'bg-blue-600' : 'bg-slate-800'}`}
        >
          <Text className={`font-bold text-sm ${hasChanges ? 'text-white' : 'text-slate-500'}`}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
          {/* Day Selector */}
          <MotiView 
            from={{ opacity: 0, translateY: -10 }}
            animate={{ opacity: 1, translateY: 0 }}
            className="flex-row justify-between px-6 py-8"
          >
            {DAYS_SHORT.map((day, i) => {
               const isActive = activeDay === i;
               return (
                  <TouchableOpacity 
                    key={i} 
                    onPress={() => setActiveDay(i)}
                    className={`w-10 h-10 rounded-xl items-center justify-center border-2 ${isActive ? 'bg-blue-600 border-blue-400 shadow-lg shadow-blue-500/30' : 'bg-slate-900 border-slate-800'}`}
                  >
                    <Text className={`font-bold text-sm ${isActive ? 'text-white' : 'text-slate-500'}`}>{day}</Text>
                  </TouchableOpacity>
               );
            })}
          </MotiView>

          {/* Slots Content */}
          <View className="px-6">
              <View className="flex-row justify-between items-center mb-6">
                  <View>
                    <Text className="text-white text-lg font-bold">{DAYS_FULL[activeDay]}</Text>
                    <Text className="text-slate-500 text-xs font-medium">Standard Working Hours</Text>
                  </View>
                  <TouchableOpacity 
                    onPress={() => addSlot(activeDay)}
                    className="flex-row items-center gap-2 bg-slate-900 px-4 py-2 rounded-2xl border border-slate-800"
                  >
                    <Plus size={14} color="#3B82F6" />
                    <Text className="text-blue-400 text-xs font-bold">New Slot</Text>
                  </TouchableOpacity>
              </View>

              <AnimatePresence>
                {currentSlots.length === 0 ? (
                  <MotiView 
                    from={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="bg-slate-900 p-8 rounded-[32px] border border-slate-800 items-center border-dashed"
                  >
                    <Clock size={32} color="#475569" />
                    <Text className="text-slate-500 mt-3 font-medium">No hours assigned</Text>
                  </MotiView>
                ) : (
                  currentSlots.map((slot, idx) => (
                    <MotiView
                      key={idx}
                      from={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-slate-900 mb-4 p-6 rounded-[32px] border border-slate-800 flex-row items-center justify-between"
                    >
                      <View className="flex-row items-center gap-6">
                         <TouchableOpacity 
                            onPress={() => {
                                const [h, m] = slot.start_time.split(':');
                                const d = new Date(); d.setHours(parseInt(h), parseInt(m));
                                setTempTime(d); setEditingSlot({ day: activeDay, index: idx, type: 'start' }); setShowTimePicker(true);
                            }}
                            className="bg-slate-950 px-4 py-2 rounded-xl border border-slate-800"
                         >
                            <Text className="text-white font-bold text-sm">{formatTime(slot.start_time)}</Text>
                         </TouchableOpacity>
                         <ChevronRight size={16} color="#475569" />
                         <TouchableOpacity 
                            onPress={() => {
                                const [h, m] = slot.end_time.split(':');
                                const d = new Date(); d.setHours(parseInt(h), parseInt(m));
                                setTempTime(d); setEditingSlot({ day: activeDay, index: idx, type: 'end' }); setShowTimePicker(true);
                            }}
                            className="bg-slate-950 px-4 py-2 rounded-xl border border-slate-800"
                         >
                            <Text className="text-white font-bold text-sm">{formatTime(slot.end_time)}</Text>
                         </TouchableOpacity>
                      </View>
                      <TouchableOpacity onPress={() => removeSlot(activeDay, idx)}>
                        <X size={18} color="#EF4444" />
                      </TouchableOpacity>
                    </MotiView>
                  ))
                )}
              </AnimatePresence>

              {/* AI Trigger */}
              <TouchableOpacity 
                onPress={() => setAiModalVisible(true)}
                className="mt-6 bg-blue-600/10 border border-blue-500/20 p-5 rounded-[32px] flex-row items-center gap-4"
              >
                  <View className="w-10 h-10 bg-blue-600 rounded-xl items-center justify-center shadow-lg shadow-blue-500/30">
                     <Zap size={20} color="white" />
                  </View>
                  <View className="flex-1">
                     <Text className="text-white font-bold">AI Quick Configure</Text>
                     <Text className="text-blue-400/70 text-xs">Set entire week via voice or text</Text>
                  </View>
              </TouchableOpacity>
          </View>

          {/* Exceptions */}
          <View className="mt-12 px-6">
              <View className="flex-row justify-between items-center mb-6">
                <Text className="text-white text-lg font-bold">Exceptions</Text>
                <TouchableOpacity onPress={() => setBlockModalVisible(true)} className="flex-row items-center gap-2">
                   <Text className="text-blue-500 text-sm font-bold">Add Vacation</Text>
                   <ChevronRight size={16} color="#3B82F6" />
                </TouchableOpacity>
              </View>
              
              {blockedDates.map((b) => (
                 <View key={b.id || b.date} className="bg-slate-900 p-5 rounded-2xl border border-slate-800 mb-3 flex-row justify-between items-center">
                    <View>
                       <Text className="text-white font-bold">
                         {new Date(b.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                       </Text>
                       <Text className="text-slate-500 text-xs">{b.reason || 'Blocked Out'}</Text>
                    </View>
                    <TouchableOpacity onPress={() => setBlockedDates(prev => prev.filter(d => d.date !== b.date))}>
                       <Trash2 size={16} color="#EF4444" />
                    </TouchableOpacity>
                 </View>
              ))}
          </View>
      </ScrollView>

      {/* AI Modal Overhaul */}
      <Modal visible={aiModalVisible} animationType="fade" transparent>
         <View className="flex-1 bg-slate-950/90 justify-center p-6">
            <MotiView from={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-slate-900 p-8 rounded-[40px] border border-slate-800">
               <View className="flex-row items-center gap-3 mb-6">
                  <Sparkles size={24} color="#3B82F6" />
                  <Text className="text-white text-xl font-bold">Schedule Assistant</Text>
               </View>
               <TextInput 
                  multiline className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-white min-h-[120px] mb-6"
                  placeholder="e.g. I work 9-5 weekdays and 10-2 on Saturdays" placeholderTextColor="#475569"
                  value={aiInput} onChangeText={setAiInput}
               />
               <View className="flex-row gap-4">
                  <TouchableOpacity onPress={() => setAiModalVisible(false)} className="flex-1 bg-slate-800 py-4 rounded-2xl items-center">
                     <Text className="text-slate-400 font-bold">Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleAiGenerate} disabled={aiLoading} className="flex-2 bg-blue-600 py-4 rounded-2xl items-center px-8 shadow-lg shadow-blue-500/20">
                     {aiLoading ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold">Configure Hub</Text>}
                  </TouchableOpacity>
               </View>
            </MotiView>
         </View>
      </Modal>

      {showTimePicker && (
        <DateTimePicker value={tempTime} mode="time" display="spinner" onChange={(e, d) => {
            setShowTimePicker(false);
            if (d && editingSlot) updateSlotTime(editingSlot.day, editingSlot.index, editingSlot.type, d);
        }} />
      )}
    </View>
  );
}
