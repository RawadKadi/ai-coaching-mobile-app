import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

interface BrandedCalendarProps {
  selectedDate: Date;
  onSelect: (date: Date) => void;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const BrandedCalendar: React.FC<BrandedCalendarProps> = ({ selectedDate, onSelect }) => {
  // Safe selectedDate parser
  const safeSelectedDate = selectedDate instanceof Date && !isNaN(selectedDate.getTime()) 
    ? selectedDate 
    : new Date();

  // Normalize initial currentMonth to the 1st of the month to prevent rollover bugs
  const [currentMonth, setCurrentMonth] = useState(() => {
    return new Date(safeSelectedDate.getFullYear(), safeSelectedDate.getMonth(), 1);
  });

  const daysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const firstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const handlePrevMonth = () => {
    try {
      setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    } catch (err) {
      console.error('Error in handlePrevMonth:', err);
    }
  };

  const handleNextMonth = () => {
    try {
      setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    } catch (err) {
      console.error('Error in handleNextMonth:', err);
    }
  };

  const renderDays = () => {
    try {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth();
      
      if (isNaN(year) || isNaN(month)) {
        return <Text style={{ color: '#EF4444', textAlign: 'center', margin: 10 }}>Invalid Month state</Text>;
      }

      const totalDays = daysInMonth(year, month);
      const startDay = firstDayOfMonth(year, month);
      
      // Adjust startDay for Monday start (0=Sun -> 0=Mon, ..., 6=Sun)
      const adjustedStartDay = startDay === 0 ? 6 : startDay - 1;

      const days = [];
      
      // Empty slots for previous month
      for (let i = 0; i < adjustedStartDay; i++) {
        days.push(<View key={`empty-${i}`} style={styles.cell} />);
      }

      // Actual days
      for (let d = 1; d <= totalDays; d++) {
        const date = new Date(year, month, d);
        const isSelected = date.toDateString() === safeSelectedDate.toDateString();
        const isToday = date.toDateString() === new Date().toDateString();

        days.push(
          <TouchableOpacity
            key={d}
            onPress={() => {
              try {
                onSelect(date);
              } catch (err) {
                console.error('Error selecting date:', err);
              }
            }}
            style={styles.cell}
            activeOpacity={0.7}
          >
            <View 
              style={[
                styles.dayInner,
                isSelected && styles.daySelected,
                !isSelected && isToday && styles.dayToday
              ]}
            >
              <Text 
                style={[
                  styles.dayText,
                  isSelected && styles.dayTextSelected,
                  !isSelected && isToday && styles.dayTextToday
                ]}
              >
                {d}
              </Text>
            </View>
          </TouchableOpacity>
        );
      }

      return days;
    } catch (err) {
      console.error('Error rendering days:', err);
      return <Text style={{ color: '#EF4444', textAlign: 'center', margin: 10 }}>Error rendering days</Text>;
    }
  };

  const weekDays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  const displayMonthName = MONTH_NAMES[currentMonth.getMonth()] || 'Calendar';
  const displayYear = currentMonth.getFullYear();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.monthTitle}>
            {displayMonthName}
          </Text>
          <Text style={styles.yearLabel}>
            {displayYear}
          </Text>
        </View>
        
        <View style={styles.navButtons}>
          <TouchableOpacity 
            onPress={handlePrevMonth}
            style={styles.navBtn}
            activeOpacity={0.7}
          >
            <ChevronLeft size={18} color="#94A3B8" />
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={handleNextMonth}
            style={styles.navBtn}
            activeOpacity={0.7}
          >
            <ChevronRight size={18} color="#94A3B8" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Week Day Labels */}
      <View style={styles.weekRow}>
        {weekDays.map((day, i) => (
          <Text key={i} style={styles.weekLabel}>
            {day}
          </Text>
        ))}
      </View>

      {/* Days Grid */}
      <View style={styles.grid}>
        {renderDays()}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#020617', // slate-950 (or dark slate)
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
    color: '#475569', // slate-600
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

