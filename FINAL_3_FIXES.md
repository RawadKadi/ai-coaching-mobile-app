# 🔧 FINAL 3 CRITICAL FIXES

## Fix 1: Activity Page - Replace Lines 33-62

**File**: `/app/(client)/(tabs)/activity.tsx`

**FIND** (lines 33-62):
```typescript
const [mealsResult, workoutsResult, habitsResult, logsResult, challengesResult] = await Promise.all([
  supabase
    .from('meals')
    .select('*')
    .eq('client_id', client?.id)
    .eq('meal_date', selectedDate)
    .order('created_at', { ascending: false }),
  supabase
    .from('workouts')
    .select('*')
    .eq('client_id', client?.id)
    .eq('date', selectedDate)
    .order('created_at', { ascending: false }),
  supabase
    .from('habits')
    .select('*')
    .eq('client_id', client?.id)
    .eq('is_active', true),
  supabase
    .from('habit_logs')
    .select('*')
    .eq('client_id', client?.id)
    .eq('date', selectedDate),
  supabase
    .from('daily_challenges')
    .select('*')
    .eq('client_id', client?.id)
    .eq('assigned_date', selectedDate)
    .eq('status', 'active'),
]);
```

**REPLACE WITH**:
```typescript
const [mealsResult, workoutsResult, habitsResult, logsResult] = await Promise.all([
  supabase
    .from('meals')
    .select('*')
    .eq('client_id', client?.id)
    .eq('meal_date', selectedDate)
    .order('created_at', { ascending: false }),
  supabase
    .from('workouts')
    .select('*')
    .eq('client_id', client?.id)
    .eq('date', selectedDate)
    .order('created_at', { ascending: false }),
  supabase
    .from('habits')
    .select('*')
    .eq('client_id', client?.id)
    .eq('is_active', true),
  supabase
    .from('habit_logs')
    .select('*')
    .eq('client_id', client?.id)
    .eq('date', selectedDate),
]);

// Get sub-challenges separately via RPC
const { data: subsData } = await supabase.rpc('get_todays_sub_challenges', {
  p_client_id: client?.id,
  p_date: selectedDate
});
```

**AND UPDATE** (lines 64-77):
```typescript
if (mealsResult.error) throw mealsResult.error;
if (workoutsResult.error) throw workoutsResult.error;
if (habitsResult.error) throw habitsResult.error;
if (logsResult.error) throw logsResult.error;

setMeals(mealsResult.data || []);
setWorkouts(workoutsResult.data || []);
setHabits(habitsResult.data || []);
const logs = logsResult.data || [];
setHabitLogs(logs);
setChallenges(subsData || []); // Use RPC data
setChallengeProgress([]);
```

---

## Fix 2: Auto-Refresh Coach Dashboard

**File**: `/app/(coach)/challenges/suggest.tsx`

**Line 163** - After successful creation, add reload:

**FIND**:
```typescript
Alert.alert(
  'Success!',
  `Created weekly challenge with ${subChallenges.length} daily tasks for ${selectedClient.full_name}`,
  [{ text: 'OK', onPress: () => router.back() }]
);
```

**REPLACE WITH**:
```typescript
// Navigate back immediately - dashboard will reload via useEffect
router.back();

// Show success toast (optional)
Alert.alert(
  'Success!',
  `Created weekly challenge with ${subChallenges.length} daily tasks for ${selectedClient.full_name}`
);
```

---

## Fix 3: Coach Dashboard - Auto Reload on Focus

**File**: `/app/(coach)/challenges/index.tsx`

**Add at top of file** (after imports):
```typescript
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
```

**REPLACE the useEffect** (around line 38):

**FROM**:
```typescript
useEffect(() => {
  loadChallenges();
}, []);
```

**TO**:
```typescript
useFocusEffect(
  useCallback(() => {
    loadChallenges();
  }, [])
);
```

This makes the dashboard reload every time it comes into focus!

---

## Summary of Changes

### ✅ Activity Page Fix
- Removed `daily_challenges` query
- Added `get_todays_sub_challenges` RPC call
- Client will now see today's sub-challenges

### ✅ Auto-Navigate Fix  
- Coach auto-navigates back after creation
- No manual refresh needed

### ✅ Dashboard Auto-Reload
- Uses `useFocusEffect` instead of `useEffect`
- Dashboard reloads when screen comes into focus
- Shows new challenge immediately

---

## Test Checklist

1. [ ] Coach creates challenge → auto-navigates back
2. [ ] Coach dashboard shows new challenge immediately
3. [ ] Client activity page shows today's sub-challenges
4. [ ] Client can check off sub-challenges
5. [ ] Refreshing works on all screens
