import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

interface BrandedCalendarProps {
  selectedDate: Date | null;
  onSelect: (date: Date) => void;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const BrandedCalendar: React.FC<BrandedCalendarProps> = ({ selectedDate, onSelect }) => {
  const today = new Date();

  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(y => y - 1);
    } else {
      setViewMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(y => y + 1);
    } else {
      setViewMonth(m => m + 1);
    }
  };

  const totalDays = new Date(viewYear, viewMonth + 1, 0).getDate();
  const startDay = new Date(viewYear, viewMonth, 1).getDay();
  // Monday-first: 0=Sun→6, 1=Mon→0, ...
  const adjustedStartDay = startDay === 0 ? 6 : startDay - 1;

  const cells: React.ReactNode[] = [];

  // Empty leading cells
  for (let i = 0; i < adjustedStartDay; i++) {
    cells.push(<View key={`empty-${i}`} style={styles.cell} />);
  }

  // Day cells
  for (let d = 1; d <= totalDays; d++) {
    const date = new Date(viewYear, viewMonth, d);
    const isSelected = selectedDate
      ? date.toDateString() === selectedDate.toDateString()
      : false;
    const isToday = date.toDateString() === today.toDateString();

    cells.push(
      <TouchableOpacity
        key={d}
        onPress={() => onSelect(date)}
        style={styles.cell}
        activeOpacity={0.7}
      >
        <View style={[
          styles.dayInner,
          isSelected && styles.daySelected,
          !isSelected && isToday && styles.dayToday,
        ]}>
          <Text style={[
            styles.dayText,
            isSelected && styles.dayTextSelected,
            !isSelected && isToday && styles.dayTextToday,
          ]}>
            {d}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  const weekDays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.monthTitle}>{MONTH_NAMES[viewMonth]}</Text>
          <Text style={styles.yearLabel}>{viewYear}</Text>
        </View>

        <View style={styles.navButtons}>
          <TouchableOpacity onPress={handlePrevMonth} style={styles.navBtn} activeOpacity={0.7}>
            <ChevronLeft size={18} color="#94A3B8" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleNextMonth} style={styles.navBtn} activeOpacity={0.7}>
            <ChevronRight size={18} color="#94A3B8" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Week day labels */}
      <View style={styles.weekRow}>
        {weekDays.map((day, i) => (
          <Text key={i} style={styles.weekLabel}>{day}</Text>
        ))}
      </View>

      {/* Days grid — plain View, zero gesture conflict */}
      <View style={styles.grid}>
        {cells}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 32,
    padding: 24,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  monthTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  yearLabel: {
    color: '#475569',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginTop: 4,
  },
  navButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  navBtn: {
    width: 40,
    height: 40,
    backgroundColor: '#0F172A',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  weekLabel: {
    flex: 1,
    textAlign: 'center',
    color: '#475569',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  dayInner: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  daySelected: {
    backgroundColor: '#2563EB',
    borderColor: '#3B82F6',
  },
  dayToday: {
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  dayText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '900',
  },
  dayTextSelected: {
    color: '#FFFFFF',
  },
  dayTextToday: {
    color: '#60A5FA',
  },
});
