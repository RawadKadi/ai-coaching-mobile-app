import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

interface BrandedCalendarProps {
  selectedDate: Date;
  onSelect: (date: Date) => void;
}

export const BrandedCalendar: React.FC<BrandedCalendarProps> = ({ selectedDate, onSelect }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date(selectedDate));

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const renderDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const totalDays = daysInMonth(year, month);
    const startDay = firstDayOfMonth(year, month);
    
    // Adjust startDay for Monday start (0=Sun -> 0=Mon, ..., 6=Sun)
    const adjustedStartDay = startDay === 0 ? 6 : startDay - 1;

    const days = [];
    
    // Empty slots for previous month
    for (let i = 0; i < adjustedStartDay; i++) {
      days.push(<View key={`empty-${i}`} className="w-[14.28%] aspect-square" />);
    }

    // Actual days
    for (let d = 1; d <= totalDays; d++) {
      const date = new Date(year, month, d);
      const isSelected = date.toDateString() === selectedDate.toDateString();
      const isToday = date.toDateString() === new Date().toDateString();

      days.push(
        <Pressable
          key={d}
          onPress={() => onSelect(date)}
          className="w-[14.28%] aspect-square items-center justify-center p-1"
        >
          {({ pressed }) => (
            <View 
              className={`w-full h-full rounded-xl items-center justify-center border ${
                isSelected 
                  ? 'bg-blue-600 border-blue-400 shadow-lg shadow-blue-500/20' 
                  : isToday 
                    ? 'bg-blue-600/10 border-blue-600/30' 
                    : 'bg-slate-900/50 border-white/5'
              } ${pressed ? 'opacity-70 scale-95' : ''}`}
            >
              <Text 
                className={`text-sm font-black ${
                  isSelected ? 'text-white' : isToday ? 'text-blue-400' : 'text-slate-400'
                }`}
              >
                {d}
              </Text>
            </View>
          )}
        </Pressable>
      );
    }

    return days;
  };

  const weekDays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  return (
    <View className="bg-slate-950 border border-white/5 rounded-[32px] p-6 overflow-hidden">
      {/* Header */}
      <View className="flex-row items-center justify-between mb-8">
        <View>
          <Text className="text-white text-xl font-black tracking-tight">
            {currentMonth.toLocaleString('default', { month: 'long' })}
          </Text>
          <Text className="text-slate-600 text-[10px] font-black uppercase tracking-[2px] mt-1">
            {currentMonth.getFullYear()}
          </Text>
        </View>
        
        <View className="flex-row gap-2">
          <Pressable 
            onPress={handlePrevMonth}
            className="w-10 h-10 rounded-xl items-center justify-center border border-white/5"
            style={({ pressed }) => ({
              backgroundColor: pressed ? '#1E293B' : '#0F172A',
            })}
          >
            <ChevronLeft size={18} color="#94A3B8" />
          </Pressable>
          <Pressable 
            onPress={handleNextMonth}
            className="w-10 h-10 rounded-xl items-center justify-center border border-white/5"
            style={({ pressed }) => ({
              backgroundColor: pressed ? '#1E293B' : '#0F172A',
            })}
          >
            <ChevronRight size={18} color="#94A3B8" />
          </Pressable>
        </View>
      </View>

      {/* Week Day Labels */}
      <View className="flex-row mb-4">
        {weekDays.map((day, i) => (
          <Text key={i} className="flex-1 text-center text-slate-600 text-[10px] font-black uppercase tracking-widest">
            {day}
          </Text>
        ))}
      </View>

      {/* Days Grid */}
      <View className="flex-row flex-wrap">
        {renderDays()}
      </View>
    </View>
  );
};
