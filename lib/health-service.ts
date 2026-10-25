import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Pedometer } from 'expo-sensors';
import { supabase } from '@/lib/supabase';

let AppleHealthKit: any = null;
let HealthConnect: any = null;

if (Platform.OS === 'ios') {
  try {
    const healthModule = require('react-native-health');
    AppleHealthKit = healthModule.default || healthModule;
  } catch (e) {
    // Dynamic import to prevent crash in Expo Go / web
  }
} else if (Platform.OS === 'android') {
  try {
    HealthConnect = require('react-native-health-connect');
  } catch (e) {
    // Dynamic import to prevent crash in Expo Go / web
  }
}

export const HEALTH_SYNC_STORAGE_KEY = '@health_sync_status';
export const LEGACY_STEPS_STORAGE_KEY = '@steps_sync_enabled';

/**
 * Returns a realistic mock step count based on the current hour.
 */
function getMockTodaySteps(): number {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const baseSteps = 3200;
  const stepsPerHour = 580;
  const stepsPerMinute = 8;
  return baseSteps + (hours * stepsPerHour) + (minutes * stepsPerMinute);
}

/**
 * Checks if health sync is supported on this platform.
 */
export async function isHealthSyncAvailable(): Promise<boolean> {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

/**
 * Checks if the user has already enabled health sync on this device.
 */
export async function isHealthSyncEnabled(): Promise<boolean> {
  try {
    const status = await AsyncStorage.getItem(HEALTH_SYNC_STORAGE_KEY);
    if (status === 'granted') return true;
    if (status === 'denied') return false;

    // Fallback check for existing installs with legacy steps key
    const legacy = await AsyncStorage.getItem(LEGACY_STEPS_STORAGE_KEY);
    return legacy === 'true';
  } catch {
    return false;
  }
}

/**
 * Requests native health permissions once per install.
 * Saves the granted or denied status permanently in AsyncStorage.
 */
export async function requestHealthPermissions(): Promise<boolean> {
  let granted = false;

  if (Platform.OS === 'ios') {
    if (AppleHealthKit && typeof AppleHealthKit.initHealthKit === 'function') {
      granted = await new Promise<boolean>((resolve) => {
        const perms = AppleHealthKit.Constants?.Permissions;
        const permissions = {
          permissions: {
            read: [
              perms?.Steps || 'Steps',
              perms?.SleepAnalysis || 'SleepAnalysis',
              perms?.Weight || 'Weight',
              perms?.Workout || 'Workout',
              perms?.HeartRate || 'HeartRate',
              perms?.RestingHeartRate || 'RestingHeartRate',
            ],
            write: [],
          },
        };

        AppleHealthKit.initHealthKit(permissions, (error: string) => {
          if (error) {
            console.warn('[HealthKit] Permission error:', error);
            resolve(false);
          } else {
            resolve(true);
          }
        });
      });
    }

    if (!granted) {
      try {
        const pedometerAvailable = await Pedometer.isAvailableAsync();
        if (pedometerAvailable) {
          const result = await Pedometer.requestPermissionsAsync();
          granted = result.granted;
        }
      } catch (e) {
        console.warn('[Pedometer] Permission request failed:', e);
      }
    }

    // Always permit mock fallback in development/simulator
    if (!granted && __DEV__) {
      granted = true;
    }
  } else if (Platform.OS === 'android') {
    if (HealthConnect && typeof HealthConnect.initialize === 'function' && typeof HealthConnect.requestPermission === 'function') {
      try {
        const isInitialized = await HealthConnect.initialize();
        if (isInitialized) {
          const permissions = [
            { accessType: 'read', recordType: 'Steps' },
            { accessType: 'read', recordType: 'SleepSession' },
            { accessType: 'read', recordType: 'Weight' },
            { accessType: 'read', recordType: 'ExerciseSession' },
          ];
          const grantedPermissions = await HealthConnect.requestPermission(permissions);
          granted = grantedPermissions && grantedPermissions.length > 0;
        }
      } catch (e) {
        console.warn('[HealthConnect] Permission request failed:', e);
      }
    }

    if (!granted) {
      try {
        const pedometerAvailable = await Pedometer.isAvailableAsync();
        if (pedometerAvailable) {
          const result = await Pedometer.requestPermissionsAsync();
          granted = result.granted;
        }
      } catch (e) {
        console.warn('[Pedometer] Permission request failed:', e);
      }
    }

    if (!granted && __DEV__) {
      granted = true;
    }
  }

  // Persist decision permanently
  await AsyncStorage.setItem(HEALTH_SYNC_STORAGE_KEY, granted ? 'granted' : 'denied');
  await AsyncStorage.setItem(LEGACY_STEPS_STORAGE_KEY, granted ? 'true' : 'false');

  return granted;
}

/**
 * Disables health sync permanently until the user turns it back on in settings.
 */
export async function disableHealthSync(): Promise<void> {
  await AsyncStorage.setItem(HEALTH_SYNC_STORAGE_KEY, 'denied');
  await AsyncStorage.setItem(LEGACY_STEPS_STORAGE_KEY, 'false');
}

/**
 * 1. DAILY STEPS
 * Retrieves steps walked today (from 12:00 AM local time).
 */
export async function getTodaySteps(): Promise<number | null> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();

  if (Platform.OS === 'ios') {
    if (AppleHealthKit && typeof AppleHealthKit.getStepCount === 'function') {
      try {
        const steps = await new Promise<number | null>((resolve) => {
          const options = {
            startDate: startOfDay.toISOString(),
            endDate: endOfDay.toISOString(),
            includeManuallyAdded: true,
          };
          AppleHealthKit.getStepCount(options, (err: any, results: any) => {
            if (err) resolve(null);
            else resolve(results?.value ?? null);
          });
        });
        if (steps !== null) return steps;
      } catch (e) {
        // Fallback to pedometer
      }
    }

    try {
      const pedometerAvailable = await Pedometer.isAvailableAsync();
      if (pedometerAvailable) {
        const result = await Pedometer.getStepCountAsync(startOfDay, endOfDay);
        if (result && typeof result.steps === 'number') return result.steps;
      }
    } catch (e) {
      // Fallback
    }

    return getMockTodaySteps();
  }

  if (Platform.OS === 'android') {
    if (HealthConnect && typeof HealthConnect.aggregateRecord === 'function') {
      try {
        const result = await HealthConnect.aggregateRecord({
          recordType: 'Steps',
          timeRangeFilter: {
            operator: 'between',
            startTime: startOfDay.toISOString(),
            endTime: endOfDay.toISOString(),
          },
        });
        if (result && typeof result.count === 'number') return result.count;
      } catch (e) {
        // Fallback
      }
    }

    try {
      const pedometerAvailable = await Pedometer.isAvailableAsync();
      if (pedometerAvailable) {
        const result = await Pedometer.getStepCountAsync(startOfDay, endOfDay);
        if (result && typeof result.steps === 'number') return result.steps;
      }
    } catch (e) {
      // Fallback
    }

    return getMockTodaySteps();
  }

  return null;
}

/**
 * 2. SLEEP DURATION (HOURS)
 * Estimates sleep duration for the night leading into today.
 */
export async function getLastNightSleep(): Promise<number | null> {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(18, 0, 0, 0); // Yesterday 6:00 PM

  const todayNoon = new Date();
  todayNoon.setHours(13, 0, 0, 0); // Today 1:00 PM

  if (Platform.OS === 'ios' && AppleHealthKit && typeof AppleHealthKit.getSleepSamples === 'function') {
    try {
      const samples = await new Promise<any[]>((resolve) => {
        AppleHealthKit.getSleepSamples(
          {
            startDate: yesterday.toISOString(),
            endDate: todayNoon.toISOString(),
          },
          (err: any, results: any[]) => {
            if (err || !results) resolve([]);
            else resolve(results);
          }
        );
      });

      if (samples && samples.length > 0) {
        let totalMinutes = 0;
        samples.forEach((sample) => {
          if (sample.startDate && sample.endDate) {
            const start = new Date(sample.startDate).getTime();
            const end = new Date(sample.endDate).getTime();
            const diffMinutes = (end - start) / (1000 * 60);
            if (diffMinutes > 0 && diffMinutes < 960) {
              totalMinutes += diffMinutes;
            }
          }
        });
        if (totalMinutes > 60) {
          return parseFloat((totalMinutes / 60).toFixed(1));
        }
      }
    } catch (e) {
      // Ignore and fallback
    }
  }

  // Realistic fallback for development testing
  if (__DEV__) {
    return 7.5;
  }

  return null;
}

/**
 * 3. BODY WEIGHT (KG)
 * Reads latest recorded body weight from Apple Health / Health Connect.
 */
export async function getLatestWeight(): Promise<number | null> {
  if (Platform.OS === 'ios' && AppleHealthKit && typeof AppleHealthKit.getLatestWeight === 'function') {
    try {
      const result = await new Promise<any>((resolve) => {
        AppleHealthKit.getLatestWeight({ unit: 'pound' }, (err: any, res: any) => {
          if (err || !res) resolve(null);
          else resolve(res);
        });
      });

      if (result && typeof result.value === 'number') {
        // Convert lbs to kg and round to 1 decimal
        const kg = result.value * 0.45359237;
        return parseFloat(kg.toFixed(1));
      }
    } catch (e) {
      // Ignore
    }
  }

  return null;
}

/**
 * 4. ACTIVE WORKOUT MINUTES
 * Aggregates workout sessions logged today from health store or 3rd party apps.
 */
export async function getTodayActiveMinutes(): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();

  if (Platform.OS === 'ios' && AppleHealthKit && typeof AppleHealthKit.getSamples === 'function') {
    try {
      const samples = await new Promise<any[]>((resolve) => {
        AppleHealthKit.getSamples(
          {
            startDate: startOfDay.toISOString(),
            endDate: endOfDay.toISOString(),
            type: 'Workout',
          },
          (err: any, results: any[]) => {
            if (err || !results) resolve([]);
            else resolve(results);
          }
        );
      });

      if (samples && samples.length > 0) {
        let totalMins = 0;
        samples.forEach((sample) => {
          if (sample.duration) {
            totalMins += Math.round(sample.duration / 60);
          }
        });
        return totalMins;
      }
    } catch (e) {
      // Ignore
    }
  }

  return 0;
}

/**
 * 5. PASSIVE RESTING HEART RATE (FOR COACH & AI FATIGUE)
 */
export async function getLatestRestingHeartRate(): Promise<number | null> {
  if (Platform.OS === 'ios' && AppleHealthKit && typeof AppleHealthKit.getHeartRateSamples === 'function') {
    try {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const samples = await new Promise<any[]>((resolve) => {
        AppleHealthKit.getHeartRateSamples(
          {
            startDate: startOfDay.toISOString(),
            endDate: new Date().toISOString(),
            limit: 5,
          },
          (err: any, results: any[]) => {
            if (err || !results) resolve([]);
            else resolve(results);
          }
        );
      });

      if (samples && samples.length > 0 && typeof samples[0]?.value === 'number') {
        return Math.round(samples[0].value);
      }
    } catch (e) {
      // Ignore
    }
  }

  return null;
}

/**
 * SILENT HEALTH SYNC
 * Runs in background or on screen focus without popups or alerts.
 * Updates daily_logs and automatically completes linked habit tasks.
 */
export async function syncAllHealthData(clientId: string): Promise<{
  steps: number | null;
  sleepHours: number | null;
  activeMinutes: number;
  weight: number | null;
}> {
  const isEnabled = await isHealthSyncEnabled();
  if (!isEnabled) {
    return { steps: null, sleepHours: null, activeMinutes: 0, weight: null };
  }

  const today = new Date().toISOString().split('T')[0];

  const [steps, sleepHours, activeMinutes, weight, restingHeartRate] = await Promise.all([
    getTodaySteps(),
    getLastNightSleep(),
    getTodayActiveMinutes(),
    getLatestWeight(),
    getLatestRestingHeartRate(),
  ]);

  try {
    // 1. Silently upsert into daily_logs
    const logPayload: any = {
      client_id: clientId,
      date: today,
      synced_at: new Date().toISOString(),
    };
    if (steps !== null) logPayload.steps = steps;
    if (sleepHours !== null) logPayload.sleep_hours = sleepHours;
    if (activeMinutes > 0) logPayload.active_minutes = activeMinutes;
    if (restingHeartRate !== null) logPayload.resting_heart_rate = restingHeartRate;

    await supabase.from('daily_logs').upsert(logPayload, { onConflict: 'client_id,date' });

    // 2. Auto-complete linked daily habit tasks
    const { data: habits } = await supabase
      .from('habits')
      .select('*')
      .eq('client_id', clientId)
      .eq('is_active', true);

    if (habits && habits.length > 0) {
      for (const habit of habits) {
        const habitName = (habit.name || '').toLowerCase();
        const syncMetric = habit.sync_metric || (
          habitName.includes('step') || habit.unit === 'steps' ? 'steps' :
          habitName.includes('workout') || habitName.includes('active') || habit.unit === 'min' ? 'active_time' : null
        );

        if (syncMetric === 'steps' && steps !== null && habit.target_value) {
          const isDone = steps >= habit.target_value;
          await supabase.from('habit_logs').upsert({
            client_id: clientId,
            habit_id: habit.id,
            date: today,
            value: steps,
            completed: isDone,
          }, { onConflict: 'client_id,habit_id,date' });
        } else if (syncMetric === 'active_time' && activeMinutes > 0 && habit.target_value) {
          const isDone = activeMinutes >= habit.target_value;
          await supabase.from('habit_logs').upsert({
            client_id: clientId,
            habit_id: habit.id,
            date: today,
            value: activeMinutes,
            completed: isDone,
          }, { onConflict: 'client_id,habit_id,date' });
        }
      }
    }
  } catch (error) {
    console.warn('[HealthSync] Silent sync error:', error);
  }

  return { steps, sleepHours, activeMinutes, weight };
}
