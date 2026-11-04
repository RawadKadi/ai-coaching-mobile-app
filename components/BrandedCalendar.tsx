import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useTheme } from '@/contexts/BrandContext';
import { hexToRGB, scaleBorderRadius } from '@/lib/theme-utils';

interface BrandedCalendarProps {
  selectedDate: Date | null;
  onSelect: (date: Date) => void;
  style?: ViewStyle;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const BrandedCalendar: React.FC<BrandedCalendarProps> = ({ selectedDate, onSelect, style }) => {
  const theme = useTheme();
  const colors = theme.colors;
  const isDark = theme.isDarkMode;
  const today = new Date();

  const [viewYear, setViewYear] = useState(() => (selectedDate && !isNaN(selectedDate.getTime()) ? selectedDate.getFullYear() : today.getFullYear()));
  const [viewMonth, setViewMonth] = useState(() => (selectedDate && !isNaN(selectedDate.getTime()) ? selectedDate.getMonth() : today.getMonth()));

  useEffect(() => {
    if (selectedDate && !isNaN(selectedDate.getTime())) {
      setViewYear(selectedDate.getFullYear());
      setViewMonth(selectedDate.getMonth());
    }
  }, [selectedDate]);

  const primaryRgb = useMemo(() => {
    try {
      if (colors?.primary && typeof colors.primary === 'string' && colors.primary.startsWith('#')) {
        return hexToRGB(colors.primary);
      }
    } catch {}
    return { r: 124, g: 58, b: 237 };
  }, [colors?.primary]);

  const styles = useMemo(() => getStyles(theme, primaryRgb), [theme, primaryRgb]);

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
    <View style={[styles.container, style]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.monthTitle}>{MONTH_NAMES[viewMonth]}</Text>
          <Text style={styles.yearLabel}>{viewYear}</Text>
        </View>

        <View style={styles.navButtons}>
          <TouchableOpacity onPress={handlePrevMonth} style={styles.navBtn} activeOpacity={0.7}>
            <ChevronLeft size={18} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleNextMonth} style={styles.navBtn} activeOpacity={0.7}>
            <ChevronRight size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Week day labels */}
      <View style={styles.weekRow}>
        {weekDays.map((day, i) => (
          <Text key={i} style={styles.weekLabel}>{day}</Text>
        ))}
      </View>

      {/* Days grid */}
      <View style={styles.grid}>
        {cells}
      </View>
    </View>
  );
};

const getStyles = (theme: any, primaryRgb: { r: number; g: number; b: number }) => {
  const colors = theme.colors;
  const isDark = theme.isDarkMode;
  const borderRadiusScale = theme.spacing?.borderRadiusScale || 1;
  const r = primaryRgb?.r ?? 124;
  const g = primaryRgb?.g ?? 58;
  const b = primaryRgb?.b ?? 237;

  return StyleSheet.create({
    container: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: scaleBorderRadius(32, borderRadiusScale),
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
      color: colors.text,
      fontSize: 20,
      fontWeight: '900',
      letterSpacing: -0.5,
    },
    yearLabel: {
      color: colors.textSecondary,
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
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : (colors.inputBackground || colors.surfaceAlt || '#F8FAFC'),
      borderRadius: scaleBorderRadius(12, borderRadiusScale),
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    weekRow: {
      flexDirection: 'row',
      marginBottom: 16,
    },
    weekLabel: {
      flex: 1,
      textAlign: 'center',
      color: colors.textTertiary || colors.textSecondary,
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
      borderRadius: scaleBorderRadius(12, borderRadiusScale),
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : (colors.inputBackground || '#F1F5F9'),
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.05)' : colors.border,
    },
    daySelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.35,
      shadowRadius: 6,
      elevation: 4,
    },
    dayToday: {
      backgroundColor: `rgba(${r}, ${g}, ${b}, 0.12)`,
      borderColor: `rgba(${r}, ${g}, ${b}, 0.4)`,
    },
    dayText: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '700',
    },
    dayTextSelected: {
      color: colors.textOnPrimary || '#FFFFFF',
      fontWeight: '900',
    },
    dayTextToday: {
      color: colors.primary,
      fontWeight: '900',
    },
  });
};
