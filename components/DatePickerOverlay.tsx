import { useBrandColors } from '@/contexts/BrandContext';
import { isDarkColor } from '@/lib/theme-utils';
import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  Dimensions,
} from 'react-native';
import { MotiView } from 'moti';
import { ChevronLeft, ChevronRight, X } from 'lucide-react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface DatePickerOverlayProps {
  visible: boolean;
  selectedDate: Date;
  onSelect: (date: Date) => void;
  onClose: () => void;
}

const PRESETS = [
  { label: 'Today', offset: 0 },
  { label: 'Tomorrow', offset: 1 },
  { label: 'In 3 days', offset: 3 },
  { label: 'In a week', offset: 7 },
  { label: 'In 2 weeks', offset: 14 },
];

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function firstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

export const DatePickerOverlay: React.FC<DatePickerOverlayProps> = ({
  visible,
  selectedDate,
  onSelect,
  onClose,
}) => {
  const colors = useBrandColors();
  const isDark = isDarkColor(colors.surface || colors.background || '#0F172A');
  const styles = React.useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const [currentMonth, setCurrentMonth] = useState(
    () => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
  );

  // Sync state when selectedDate changes or modal opens
  useEffect(() => {
    if (visible) {
      setCurrentMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
    }
  }, [visible, selectedDate]);

  const handlePrev = () =>
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)
    );

  const handleNext = () =>
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)
    );

  const handlePreset = (offset: number) => {
    const newDate = addDays(new Date(), offset);
    onClose();
    onSelect(newDate);
  };

  const handleDayPress = (date: Date) => {
    onClose();
    onSelect(date);
  };

  const isPresetSelected = (offset: number) => {
    const today = new Date();
    const presetDate = addDays(today, offset);
    return presetDate.toDateString() === selectedDate.toDateString();
  };

  const renderDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const total = daysInMonth(year, month);
    const rawStart = firstDayOfMonth(year, month);
    const startOffset = rawStart === 0 ? 6 : rawStart - 1;

    const cells: React.ReactNode[] = [];

    // Empty leading cells
    for (let i = 0; i < startOffset; i++) {
      cells.push(<View key={`e-${i}`} style={styles.cell} />);
    }

    for (let d = 1; d <= total; d++) {
      const date = new Date(year, month, d);
      const isSelected = date.toDateString() === selectedDate.toDateString();
      const isToday = date.toDateString() === new Date().toDateString();

      cells.push(
        <Pressable
          key={d}
          onPress={() => handleDayPress(date)}
          style={styles.cell}
        >
          <View
            style={[
              styles.dayInner,
              isSelected && styles.daySelected,
              !isSelected && isToday && styles.dayToday,
            ]}
          >
            <Text
              style={[
                styles.dayText,
                isSelected && styles.dayTextSelected,
                !isSelected && isToday && styles.dayTextToday,
              ]}
            >
              {d}
            </Text>
          </View>
        </Pressable>
      );
    }

    return cells;
  };

  return (
    <Modal
      transparent
      visible={visible}
      onRequestClose={onClose}
      animationType="fade"
    >
      <View style={styles.overlayContainer}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        
        <MotiView
          from={{ opacity: 0, scale: 0.95, translateY: 15 }}
          animate={{ opacity: 1, scale: 1, translateY: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          style={styles.card}
        >
          {/* Month navigation */}
          <View style={styles.monthRow}>
            <View>
              <Text style={styles.monthTitle}>
                {currentMonth.toLocaleString('default', { month: 'long' })}
              </Text>
              <Text style={styles.yearLabel}>
                {currentMonth.getFullYear()}
              </Text>
            </View>

            <View style={styles.navButtons}>
              <Pressable onPress={handlePrev} style={styles.navBtn}>
                <ChevronLeft size={16} color={colors.textSecondary} />
              </Pressable>
              <Pressable onPress={handleNext} style={styles.navBtn}>
                <ChevronRight size={16} color={colors.textSecondary} />
              </Pressable>
              <Pressable onPress={onClose} style={[styles.navBtn, styles.closeBtn]}>
                <X size={14} color={colors.textSecondary} />
              </Pressable>
            </View>
          </View>

          {/* Weekday headers */}
          <View style={styles.weekRow}>
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
              <Text key={i} style={styles.weekLabel}>
                {d}
              </Text>
            ))}
          </View>

          {/* Day grid */}
          <View style={styles.grid}>{renderDays()}</View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Preset shortcuts */}
          <View style={styles.presets}>
            {PRESETS.map((p) => {
              const isSelected = isPresetSelected(p.offset);
              return (
                <Pressable
                  key={p.label}
                  onPress={() => handlePreset(p.offset)}
                >
                  <View
                    style={[
                      styles.presetBtn,
                      isSelected && styles.presetBtnSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.presetText,
                        isSelected && styles.presetTextSelected,
                      ]}
                    >
                      {p.label}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </MotiView>
      </View>
    </Modal>
  );
};

const getStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  overlayContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 24,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  card: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: 32,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: isDark ? 0.5 : 0.1,
        shadowRadius: 32,
      },
      android: { elevation: 20 },
    }),
    zIndex: 100,
  },
  // Month row
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
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
    letterSpacing: 2,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  navButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  navBtn: {
    width: 36,
    height: 36,
    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : (colors.background || '#F8FAFC'),
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  closeBtn: {
    marginLeft: 4,
  },
  // Weekday row
  weekRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekLabel: {
    flex: 1,
    textAlign: 'center',
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  // Grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 3,
  },
  dayInner: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : (colors.background || '#F8FAFC'),
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.06)' : colors.border,
  },
  daySelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dayToday: {
    backgroundColor: `${colors.primary}18`,
    borderColor: colors.primary,
  },
  dayText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  dayTextSelected: {
    color: colors.textOnPrimary || '#FFFFFF',
    fontWeight: '900',
  },
  dayTextToday: {
    color: colors.primary,
    fontWeight: '900',
  },
  // Divider
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 16,
  },
  // Presets
  presets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  presetBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : (colors.background || '#F8FAFC'),
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 10,
    marginBottom: 10,
  },
  presetBtnPressed: {
    backgroundColor: colors.surfaceHover || colors.background,
    opacity: 0.8,
  },
  presetBtnSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  presetText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
  },
  presetTextSelected: {
    color: colors.textOnPrimary || '#FFFFFF',
    fontWeight: '900',
  },
});
