import { useBrandColors } from '@/contexts/BrandContext';
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  SafeAreaView,
  Platform,
  ScrollView,
  Animated,
  StyleSheet,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Clock, Check, X } from 'lucide-react-native';
import SectionLabel from '../SectionLabel';

interface Step3Props {
  formData: {
    selectedWeekdays: number[];
    start_time: string;
    end_time: string;
  };
  updateForm: (key: string, value: any) => void;
  toggleWeekday: (dayIdx: number) => void;
}

const DAYS = [
  { label: 'Mon', index: 1 },
  { label: 'Tue', index: 2 },
  { label: 'Wed', index: 3 },
  { label: 'Thu', index: 4 },
  { label: 'Fri', index: 5 },
  { label: 'Sat', index: 6 },
  { label: 'Sun', index: 0 },
];

function timeStringToDate(t: string): Date {
  const [h, m] = (t || '09:00').split(':').map(Number);
  const d = new Date();
  d.setHours(isNaN(h) ? 9 : h, isNaN(m) ? 0 : m, 0, 0);
  return d;
}

function dateToTimeString(d: Date): string {
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

function formatDisplay(t: string): string {
  const [h, m] = (t || '09:00').split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
}

export default function Step3({ formData, updateForm, toggleWeekday }: Step3Props) {
  const colors = useBrandColors();
  const [pickerTarget, setPickerTarget] = useState<'start_time' | 'end_time' | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(new Date());

  // Separate animations: backdrop fades, sheet slides
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(400)).current;

  const openPicker = (field: 'start_time' | 'end_time') => {
    setTempDate(timeStringToDate(formData[field]));
    setPickerTarget(field);
    setModalVisible(true);
    // Animate in: fade backdrop + slide sheet up simultaneously
    Animated.parallel([
      Animated.timing(backdropOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.spring(sheetTranslateY, { toValue: 0, damping: 22, stiffness: 180, useNativeDriver: true }),
    ]).start();
  };

  const closePicker = () => {
    // Animate out: fade backdrop + slide sheet down simultaneously
    Animated.parallel([
      Animated.timing(backdropOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(sheetTranslateY, { toValue: 400, duration: 220, useNativeDriver: true }),
    ]).start(() => {
      setModalVisible(false);
      setPickerTarget(null);
    });
  };

  const confirmTime = () => {
    if (pickerTarget) updateForm(pickerTarget, dateToTimeString(tempDate));
    closePicker();
  };

  const selectedCount = formData.selectedWeekdays.length;

  // Duration pill
  const getDuration = () => {
    const [sh, sm] = formData.start_time.split(':').map(Number);
    const [eh, em] = formData.end_time.split(':').map(Number);
    const diff = (eh * 60 + em) - (sh * 60 + sm);
    if (diff <= 0) return null;
    const hrs = Math.floor(diff / 60);
    const mins = diff % 60;
    return hrs > 0 ? `${hrs}h${mins > 0 ? ` ${mins}m` : ''}` : `${mins}m`;
  };

  const duration = getDuration();

  return (
    <View style={{ gap: 36 }}>
      <SectionLabel step="Step 3" title="Working Hours" desc="Set the days and times you're available. Used for scheduling sessions and AI booking suggestions." />

      {/* ── Active Days ── */}
      <View style={{ gap: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: '#64748B', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 2.5 }}>
            Active Days
          </Text>
          <View style={{
            paddingHorizontal: 12,
            paddingVertical: 4,
            borderRadius: 20,
            backgroundColor: selectedCount > 0 ? 'rgba(37,99,235,0.15)' : '#0F172A',
            borderWidth: 1,
            borderColor: selectedCount > 0 ? '#2563EB' : '#1E293B',
          }}>
            <Text style={{ color: selectedCount > 0 ? colors.primary : '#475569', fontSize: 12, fontWeight: '800' }}>
              {selectedCount === 0 ? 'None selected' : `${selectedCount} day${selectedCount > 1 ? 's' : ''}`}
            </Text>
          </View>
        </View>

        {/* Horizontally scrollable day pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 10, paddingHorizontal: 2, paddingVertical: 4 }}
        >
          {DAYS.map((day) => {
            const isOn = formData.selectedWeekdays.includes(day.index);
            const isWeekend = day.index === 0 || day.index === 6;
            return (
              <TouchableOpacity
                key={day.index}
                onPress={() => toggleWeekday(day.index)}
                activeOpacity={0.75}
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 22,
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  backgroundColor: isOn
                    ? '#2563EB'
                    : isWeekend
                    ? '#0A0F1E'
                    : '#0F172A',
                  borderWidth: 2,
                  borderColor: isOn
                    ? colors.primary
                    : isWeekend
                    ? '#1E293B'
                    : '#1E293B',
                  shadowColor: isOn ? colors.primary : 'transparent',
                  shadowOpacity: 0.4,
                  shadowRadius: 8,
                  shadowOffset: { width: 0, height: 2 },
                }}
              >
                <Text style={{
                  fontSize: 15,
                  fontWeight: '900',
                  color: isOn ? '#FFFFFF' : isWeekend ? '#334155' : '#475569',
                  letterSpacing: 0.3,
                }}>
                  {day.label}
                </Text>
                {isOn && (
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.6)' }} />
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Session Hours ── */}
      <View style={{ gap: 16 }}>
        <Text style={{ color: '#64748B', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 2.5 }}>
          Session Hours
        </Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {/* Start card */}
          <TouchableOpacity
            onPress={() => openPicker('start_time')}
            activeOpacity={0.8}
            style={{
              flex: 1,
              backgroundColor: '#0A1628',
              borderRadius: 24,
              borderWidth: 1.5,
              borderColor: '#1E293B',
              paddingVertical: 24,
              paddingHorizontal: 16,
              alignItems: 'center',
              gap: 10,
            }}
          >
            <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: 'rgba(37,99,235,0.18)', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={20} color={colors.primary} />
            </View>
            <Text style={{ color: '#475569', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.5 }}>Start</Text>
            <Text style={{ color: '#FFFFFF', fontSize: 24, fontWeight: '900', letterSpacing: -0.5 }}>
              {formatDisplay(formData.start_time)}
            </Text>
          </TouchableOpacity>

          {/* Divider arrow */}
          <View style={{ alignItems: 'center', justifyContent: 'center', width: 24 }}>
            <Text style={{ color: '#1E293B', fontSize: 22 }}>→</Text>
          </View>

          {/* End card */}
          <TouchableOpacity
            onPress={() => openPicker('end_time')}
            activeOpacity={0.8}
            style={{
              flex: 1,
              backgroundColor: '#0A1628',
              borderRadius: 24,
              borderWidth: 1.5,
              borderColor: '#1E293B',
              paddingVertical: 24,
              paddingHorizontal: 16,
              alignItems: 'center',
              gap: 10,
            }}
          >
            <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: 'rgba(37,99,235,0.18)', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={20} color={colors.primary} />
            </View>
            <Text style={{ color: '#475569', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.5 }}>End</Text>
            <Text style={{ color: '#FFFFFF', fontSize: 24, fontWeight: '900', letterSpacing: -0.5 }}>
              {formatDisplay(formData.end_time)}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Duration badge */}
        {duration && (
          <View style={{ alignItems: 'center', marginTop: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(37,99,235,0.1)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(37,99,235,0.2)' }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary }} />
              <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '700' }}>{duration} work day</Text>
            </View>
          </View>
        )}
      </View>

      {/* ── Time Picker ── */}

      {/* iOS: custom bottom-sheet — backdrop fades independently from sheet slide */}
      {Platform.OS === 'ios' && (
        <Modal
          visible={modalVisible}
          transparent
          animationType="none"
          onRequestClose={closePicker}
        >
          <View style={{ flex: 1, justifyContent: 'flex-end' }}>
            {/* Backdrop: fades in/out */}
            <Animated.View
              style={{
                ...StyleSheet.absoluteFillObject,
                backgroundColor: 'rgba(0,0,0,0.65)',
                opacity: backdropOpacity,
              }}
            >
              <TouchableOpacity style={{ flex: 1 }} onPress={closePicker} activeOpacity={1} />
            </Animated.View>

            {/* Sheet: slides up/down */}
            <Animated.View style={{ transform: [{ translateY: sheetTranslateY }] }}>
              <SafeAreaView style={{ backgroundColor: '#0A1628', borderTopLeftRadius: 32, borderTopRightRadius: 32, overflow: 'hidden' }}>
                {/* Handle bar */}
                <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 4 }}>
                  <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#1E293B' }} />
                </View>

                {/* Header */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 12, paddingBottom: 8 }}>
                  <TouchableOpacity
                    onPress={closePicker}
                    style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: '#1E293B', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <X size={18} color="#64748B" />
                  </TouchableOpacity>

                  <Text style={{ color: '#FFFFFF', fontSize: 17, fontWeight: '800' }}>
                    {pickerTarget === 'start_time' ? 'Start Time' : 'End Time'}
                  </Text>

                  <TouchableOpacity
                    onPress={confirmTime}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#2563EB', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 14 }}
                  >
                    <Check size={14} color="white" />
                    <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '800' }}>Done</Text>
                  </TouchableOpacity>
                </View>

                {/* Spinner — centered */}
                <View style={{ alignItems: 'center', width: '100%' }}>
                  <DateTimePicker
                    value={tempDate}
                    mode="time"
                    display="spinner"
                    onChange={(_, selected) => { if (selected) setTempDate(selected); }}
                    style={{ height: 180, width: 280 }}
                    themeVariant="dark"
                  />
                </View>

                <View style={{ height: 20 }} />
              </SafeAreaView>
            </Animated.View>
          </View>
        </Modal>
      )}

      {/* Android: render directly — native dialog manages its own window layer */}
      {Platform.OS === 'android' && pickerTarget !== null && (
        <DateTimePicker
          value={tempDate}
          mode="time"
          display="default"
          onChange={(event, selected) => {
            setPickerTarget(null);
            if (event.type === 'set' && selected && pickerTarget) {
              updateForm(pickerTarget, dateToTimeString(selected));
            }
          }}
        />
      )}
    </View>
  );
}


