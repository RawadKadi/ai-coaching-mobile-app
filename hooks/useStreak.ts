import { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

function getLocalDateString(d: Date = new Date()): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

function getPastLocalDateString(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return getLocalDateString(d);
}

export function useStreak() {
  const { client } = useAuth();
  const [streak, setStreak] = useState(0);
  const [isCold, setIsCold] = useState(false);
  const [loading, setLoading] = useState(false);

  const refreshStreak = useCallback(async () => {
    if (!client?.id) return;
    try {
      setLoading(true);
      const todayStr = getLocalDateString();
      const yesterdayStr = getPastLocalDateString(1);
      const dayBeforeYesterdayStr = getPastLocalDateString(2);

      const [habitsRes, pastLogsRes] = await Promise.all([
        supabase
          .from('habits')
          .select('*')
          .eq('client_id', client.id)
          .eq('is_active', true),
        supabase
          .from('habit_logs')
          .select('date, habit_id, completed')
          .eq('client_id', client.id)
          .gte('date', getPastLocalDateString(90))
          .eq('completed', true),
      ]);

      const activeHabitsList = habitsRes.data || [];
      const pastHabitLogs = pastLogsRes.data || [];

      const isDateCompleted = (dateStr: string) => {
        const habitsForDate = activeHabitsList.filter((h: any) => {
          const createdDate = h.created_at
            ? h.created_at.split('T')[0]
            : '2000-01-01';
          return createdDate <= dateStr;
        });
        if (habitsForDate.length === 0) return false;
        return habitsForDate.every((h: any) => {
          return pastHabitLogs.some(
            (l) => l.habit_id === h.id && l.date === dateStr && l.completed,
          );
        });
      };

      const isTodayDone = isDateCompleted(todayStr);
      const isYesterdayDone = isDateCompleted(yesterdayStr);
      const isDayBeforeYesterdayDone = isDateCompleted(dayBeforeYesterdayStr);

      let computedStreak = 0;
      let coldStatus = false;

      if (activeHabitsList.length > 0) {
        if (isYesterdayDone) {
          coldStatus = false;
          let count = isTodayDone ? 1 : 0;
          let daysAgo = 1;
          let consecutiveMiss = 0;
          while (daysAgo <= 90) {
            const dStr = getPastLocalDateString(daysAgo);
            if (isDateCompleted(dStr)) {
              count += 1;
              consecutiveMiss = 0;
            } else {
              consecutiveMiss += 1;
              if (consecutiveMiss >= 2) break;
            }
            daysAgo += 1;
          }
          computedStreak = count;
        } else if (isDayBeforeYesterdayDone) {
          let count = isTodayDone ? 1 : 0;
          let daysAgo = 2;
          let consecutiveMiss = 0;
          while (daysAgo <= 90) {
            const dStr = getPastLocalDateString(daysAgo);
            if (isDateCompleted(dStr)) {
              count += 1;
              consecutiveMiss = 0;
            } else {
              consecutiveMiss += 1;
              if (consecutiveMiss >= 2) break;
            }
            daysAgo += 1;
          }
          computedStreak = count;
          coldStatus = !isTodayDone && computedStreak > 0;
        } else {
          computedStreak = isTodayDone ? 1 : 0;
          coldStatus = false;
        }
      }

      setStreak(computedStreak);
      setIsCold(coldStatus);
    } catch (e) {
      console.error('Error in refreshStreak hook:', e);
    } finally {
      setLoading(false);
    }
  }, [client?.id]);

  useFocusEffect(
    useCallback(() => {
      refreshStreak();
    }, [refreshStreak])
  );

  return { streak, isCold, loading, refreshStreak, setStreak, setIsCold };
}
