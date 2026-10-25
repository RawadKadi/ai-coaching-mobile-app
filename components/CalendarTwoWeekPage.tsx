import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, Platform } from 'react-native';

export interface CalendarTwoWeekPageProps {
  pageIndex: number;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  viewingMonth: Date;
  sessionDatesSet: Set<string>;
  colors: any;
  pageWidth: number;
}

export const CalendarTwoWeekPage = React.memo(({
  pageIndex,
  selectedDate,
  onSelectDate,
  viewingMonth,
  sessionDatesSet,
  colors,
  pageWidth,
}: CalendarTwoWeekPageProps) => {
  const colWidth = pageWidth / 7;
  const daySize = 36;
  const colOffset = (colWidth - daySize) / 2;

  const pageDays = React.useMemo(() => {
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date();
      const day = d.getDay();
      const diff = (day === 0 ? 6 : day - 1);
      d.setDate(d.getDate() - diff + (pageIndex * 14) + i);
      return d;
    });
  }, [pageIndex]);

  const week1 = React.useMemo(() => pageDays.slice(0, 7), [pageDays]);
  const week2 = React.useMemo(() => pageDays.slice(7, 14), [pageDays]);

  const selectedDateStr = selectedDate.toDateString();
  const selectedIndex = pageDays.findIndex(d => d.toDateString() === selectedDateStr);

  const targetX = selectedIndex >= 0 ? (selectedIndex % 7) * colWidth + colOffset : 0;
  const targetY = selectedIndex >= 0 ? (Math.floor(selectedIndex / 7) === 0 ? 4 : 64) : 4;

  const animX = useRef(new Animated.Value(targetX)).current;
  const animY = useRef(new Animated.Value(targetY)).current;
  const hasMounted = useRef(false);
  const prevIndexRef = useRef(selectedIndex);

  useEffect(() => {
    if (selectedIndex >= 0) {
      if (!hasMounted.current || prevIndexRef.current < 0) {
        animX.setValue(targetX);
        animY.setValue(targetY);
        hasMounted.current = true;
      } else {
        Animated.parallel([
          Animated.spring(animX, {
            toValue: targetX,
            useNativeDriver: true,
            tension: 220,
            friction: 14,
          }),
          Animated.spring(animY, {
            toValue: targetY,
            useNativeDriver: true,
            tension: 220,
            friction: 14,
          }),
        ]).start();
      }
      prevIndexRef.current = selectedIndex;
    } else {
      prevIndexRef.current = -1;
    }
  }, [selectedIndex, targetX, targetY]);

  const renderDay = (item: Date) => {
    const isS = item.toDateString() === selectedDateStr;
    const isToday = item.toDateString() === new Date().toDateString();
    const has = sessionDatesSet.has(item.toDateString());
    const isOtherMonth = item.getMonth() !== viewingMonth.getMonth();

    return (
      <TouchableOpacity
        key={item.toISOString()}
        activeOpacity={0.7}
        onPress={() => onSelectDate(item)}
        style={{
          flex: 1,
          height: 44,
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2,
        }}
      >
        <View style={{ width: daySize, height: daySize, alignItems: 'center', justifyContent: 'center' }}>
          <Text
            style={{
              color: isS
                ? (colors.textOnPrimary || '#FFFFFF')
                : isToday
                  ? colors.primary
                  : isOtherMonth
                    ? (colors.textTertiary || '#94A3B8')
                    : (colors.text || '#0F172A'),
              fontWeight: isS || isToday ? '900' : '700',
              fontSize: 16,
            }}
          >
            {item.getDate()}
          </Text>
          {has && (
            <View
              style={{
                position: 'absolute',
                bottom: -2,
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: isS ? (colors.textOnPrimary || '#FFFFFF') : colors.primary
              }}
              className="absolute -bottom-1 w-1.5 h-1.5 rounded-full"
            />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ width: pageWidth, position: 'relative' }}>
      {/* Sliding Active Day Indicator with primary glow */}
      {selectedIndex >= 0 && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: daySize,
            height: daySize,
            borderRadius: daySize / 2,
            backgroundColor: colors.primary,
            zIndex: 1,
            transform: [
              { translateX: animX },
              { translateY: animY },
            ],
            ...Platform.select({
              web: {
                boxShadow: `0 0 8px 2px ${colors.primary}66`,
              } as any,
              default: {
                shadowColor: colors.primary,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.5,
                shadowRadius: 5,
                elevation: 3,
              }
            })
          }}
        />
      )}

      <View className="flex-row mb-4" style={{ flexDirection: 'row', marginBottom: 16 }}>
        {week1.map(renderDay)}
      </View>
      <View className="flex-row" style={{ flexDirection: 'row' }}>
        {week2.map(renderDay)}
      </View>
    </View>
  );
});

CalendarTwoWeekPage.displayName = 'CalendarTwoWeekPage';
export default CalendarTwoWeekPage;
