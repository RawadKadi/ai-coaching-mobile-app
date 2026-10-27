import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const GREETING_STORAGE_KEY = '@client_greeting_session_v2';

export interface GreetingState {
  greeting: string;
  emoji: string;
  isReturnVisit: boolean;
  refreshGreeting: () => Promise<void>;
}

// Runtime session ID generated per app process launch
let runtimeSessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
let lastBackgroundTime = 0;

function getLocalDateString(d: Date = new Date()): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

/**
 * Returns the time-of-day greeting and matching emoji:
 * - Morning: 5:00 AM - 11:59 AM -> "Good morning," 🌅
 * - Noon: 12:00 PM - 1:59 PM -> "Good noon," ☀️
 * - Afternoon: 2:00 PM - 5:59 PM -> "Good afternoon," 🌤️
 * - Night: 6:00 PM - 4:59 AM -> "Good evening," 🌙
 */
export function getTimeBasedGreeting(date: Date = new Date()): { greeting: string; emoji: string } {
  const hour = date.getHours();

  if (hour >= 5 && hour < 12) {
    return { greeting: 'Good morning,', emoji: '🌅' };
  }
  if (hour >= 12 && hour < 14) {
    return { greeting: 'Good noon,', emoji: '☀️' };
  }
  if (hour >= 14 && hour < 18) {
    return { greeting: 'Good afternoon,', emoji: '🌤️' };
  }
  return { greeting: 'Good evening,', emoji: '🌙' };
}

async function evaluateGreeting(): Promise<{ greeting: string; emoji: string; isReturnVisit: boolean }> {
  const now = new Date();
  const todayStr = getLocalDateString(now);
  const timeGreeting = getTimeBasedGreeting(now);

  try {
    const raw = await AsyncStorage.getItem(GREETING_STORAGE_KEY);
    let sessionData: {
      date: string;
      sessionCount: number;
      lastSessionId: string;
    } | null = null;

    if (raw) {
      try {
        sessionData = JSON.parse(raw);
      } catch {
        sessionData = null;
      }
    }

    // New day or first visit ever
    if (!sessionData || sessionData.date !== todayStr) {
      const initialData = {
        date: todayStr,
        sessionCount: 1,
        lastSessionId: runtimeSessionId,
      };
      await AsyncStorage.setItem(GREETING_STORAGE_KEY, JSON.stringify(initialData));
      return {
        greeting: timeGreeting.greeting,
        emoji: timeGreeting.emoji,
        isReturnVisit: false,
      };
    }

    // Same day - check if a new session occurred (app was closed/reopened or resumed from extended background)
    if (sessionData.lastSessionId !== runtimeSessionId) {
      const updatedCount = (sessionData.sessionCount || 1) + 1;
      const updatedData = {
        date: todayStr,
        sessionCount: updatedCount,
        lastSessionId: runtimeSessionId,
      };
      await AsyncStorage.setItem(GREETING_STORAGE_KEY, JSON.stringify(updatedData));
      return {
        greeting: 'Welcome back,',
        emoji: '👋',
        isReturnVisit: true,
      };
    }

    // Ongoing session on same day
    if (sessionData.sessionCount > 1) {
      return {
        greeting: 'Welcome back,',
        emoji: '👋',
        isReturnVisit: true,
      };
    }

    return {
      greeting: timeGreeting.greeting,
      emoji: timeGreeting.emoji,
      isReturnVisit: false,
    };
  } catch (err) {
    console.warn('[useGreeting] Error resolving session storage:', err);
    return {
      greeting: timeGreeting.greeting,
      emoji: timeGreeting.emoji,
      isReturnVisit: false,
    };
  }
}

export function useGreeting(): GreetingState {
  const [greetingState, setGreetingState] = useState<{
    greeting: string;
    emoji: string;
    isReturnVisit: boolean;
  }>(() => {
    const initial = getTimeBasedGreeting();
    return {
      greeting: initial.greeting,
      emoji: initial.emoji,
      isReturnVisit: false,
    };
  });

  const refreshGreeting = useCallback(async () => {
    const result = await evaluateGreeting();
    setGreetingState(result);
  }, []);

  useEffect(() => {
    refreshGreeting();

    const appStateSub = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState.match(/inactive|background/)) {
        lastBackgroundTime = Date.now();
      } else if (nextAppState === 'active') {
        // If app was backgrounded for more than 15 seconds, treat as a new open session
        if (lastBackgroundTime > 0 && Date.now() - lastBackgroundTime > 15_000) {
          runtimeSessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
        }
        refreshGreeting();
      }
    });

    // Check periodically in case time advances across morning/noon/afternoon/evening boundaries
    const interval = setInterval(() => {
      refreshGreeting();
    }, 60_000);

    return () => {
      appStateSub.remove();
      clearInterval(interval);
    };
  }, [refreshGreeting]);

  return {
    ...greetingState,
    refreshGreeting,
  };
}
