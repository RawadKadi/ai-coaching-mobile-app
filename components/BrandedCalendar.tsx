import React, { useState, useRef, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList } from 'react-native';
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
  const safeSelectedDate = selectedDate instanceof Date && !isNaN(selectedDate.getTime()) 
    ? selectedDate 
    : new Date();

  const initialMonth = new Date(safeSelectedDate.getFullYear(), safeSelectedDate.getMonth(), 1);

  // Generate 60 months (2 years back, 3 years forward)
  const months = useMemo(() => {
    const list = [];
    const start = new Date(initialMonth.getFullYear() - 2, initialMonth.getMonth(), 1);
    for (let i = 0; i < 60; i++) {
      list.push(new Date(start.getFullYear(), start.getMonth() + i, 1));
    }
    return list;
  }, []);

  const initialIndex = 24; // 2 years back = index 24
  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [containerWidth, setContainerWidth] = useState(0);
  
  // Update internal index silently if container is ready
  useEffect(() => {
    if (containerWidth > 0 && flatListRef.current) {
        flatListRef.current.scrollToIndex({ index: currentIndex, animated: false });
    }
  }, [containerWidth]);

  // Jump to selected date's month if it changes externally
  useEffect(() => {
    if (selectedDate && !isNaN(selectedDate.getTime()) && containerWidth > 0) {
       const targetIndex = months.findIndex(m => m.getMonth() === selectedDate.getMonth() && m.getFullYear() === selectedDate.getFullYear());
       if (targetIndex !== -1 && targetIndex !== currentIndex) {
           setCurrentIndex(targetIndex);
           flatListRef.current?.scrollToIndex({ index: targetIndex, animated: true });
       }
    }
  }, [selectedDate, containerWidth]);

  const handlePrevMonth = () => {
    if (currentIndex > 0) {
      const nextIdx = currentIndex - 1;
      setCurrentIndex(nextIdx);
      flatListRef.current?.scrollToIndex({ index: nextIdx, animated: true });
    }
  };

  const handleNextMonth = () => {
    if (currentIndex < months.length - 1) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      flatListRef.current?.scrollToIndex({ index: nextIdx, animated: true });
    }
  };

  const renderMonth = ({ item: monthDate }: { item: Date }) => {
    if (containerWidth === 0) return <View />;

    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const startDay = new Date(year, month, 1).getDay();
    const adjustedStartDay = startDay === 0 ? 6 : startDay - 1;
    
    const days = [];
    for (let i = 0; i < adjustedStartDay; i++) {
      days.push(<View key={`empty-${i}`} style={styles.cell} />);
    }

    for (let d = 1; d <= totalDays; d++) {
      const date = new Date(year, month, d);
      const isSelected = selectedDate ? date.toDateString() === selectedDate.toDateString() : false;
      const isToday = date.toDateString() === new Date().toDateString();

      days.push(
        <TouchableOpacity
          key={d}
          onPress={() => onSelect(date)}
          style={styles.cell}
          activeOpacity={0.7}
        >
          <View style={[styles.dayInner, isSelected && styles.daySelected, !isSelected && isToday && styles.dayToday]}>
            <Text style={[styles.dayText, isSelected && styles.dayTextSelected, !isSelected && isToday && styles.dayTextToday]}>{d}</Text>
          </View>
        </TouchableOpacity>
      );
    }

    return (
      <View style={{ width: containerWidth, flexDirection: 'row', flexWrap: 'wrap' }}>
        {days}
      </View>
    );
  };

  const weekDays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const currentVisibleMonth = months[currentIndex] || initialMonth;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.monthTitle}>
            {MONTH_NAMES[currentVisibleMonth.getMonth()]}
          </Text>
          <Text style={styles.yearLabel}>
            {currentVisibleMonth.getFullYear()}
          </Text>
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

      {/* Week Day Labels */}
      <View style={styles.weekRow}>
        {weekDays.map((day, i) => (
          <Text key={i} style={styles.weekLabel}>{day}</Text>
        ))}
      </View>

      {/* Days Grid - FlatList Carousel */}
      <View 
        style={{ flex: 1, minHeight: 320 }}
        onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
      >
        {containerWidth > 0 && (
          <FlatList
            ref={flatListRef}
            data={months}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={initialIndex}
            getItemLayout={(_, index) => ({ length: containerWidth, offset: containerWidth * index, index })}
            keyExtractor={item => item.toISOString()}
            renderItem={renderMonth}
            onMomentumScrollEnd={(e) => {
              const newIndex = Math.round(e.nativeEvent.contentOffset.x / containerWidth);
              if (newIndex !== currentIndex) {
                setCurrentIndex(newIndex);
              }
            }}
          />
        )}
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

