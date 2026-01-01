# CRITICAL FIXES NEEDED

## Problem 1: Duplicate Sessions (3 sessions for same client on same day)

**Root Cause**: The system creates NEW sessions without checking if a session already exists on that day for the client.

**Fix**: Before inserting, check if the client already has a session on that day. If yes, UPDATE it instead of INSERT.

## Problem 2: Tag Not Updating on First Attempt

**Root Cause**: The database IS updating correctly, but the PendingResolutionsModal isn't re-rendering with the new data immediately.

**Fix**: Force an immediate state update after database update AND ensure the modal receives fresh props.

---

## IMPLEMENTATION STEPS:

### Step 1: Fix Duplicate Sessions in handleSaveSessions

Replace the entire `handleSaveSessions` function in `/app/(coach)/clients/[id].tsx`:

```typescript
const handleSaveSessions = async (proposedSessions: ProposedSession[]) => {
  if (!coach || !client) return;

  try {
    const sessionsToInsert: any[] = [];
    const sessionsToUpdate: { id: string; data: any }[] = [];
    const WEEKS_TO_SCHEDULE = 4;

    for (const session of proposedSessions) {
      if (session.recurrence === 'weekly') {
        const startDate = new Date(session.scheduled_at);
        
        for (let i = 0; i < WEEKS_TO_SCHEDULE; i++) {
          const nextDate = new Date(startDate);
          nextDate.setDate(startDate.getDate() + (i * 7));
          
          // Check if client already has a session on this day
          const existingOnSameDay = allCoachSessions.find(s => {
            if (s.client_id !== client.id) return false;
            if (s.status === 'cancelled') return false;
            
            const existingDate = new Date(s.scheduled_at);
            return (
              existingDate.getFullYear() === nextDate.getFullYear() &&
              existingDate.getMonth() === nextDate.getMonth() &&
              existingDate.getDate() === nextDate.getDate()
            );
          });

          const sessionData = {
            coach_id: coach.id,
            client_id: client.id,
            scheduled_at: nextDate.toISOString(),
            duration_minutes: session.duration_minutes,
            session_type: session.session_type,
            notes: session.notes,
            status: 'scheduled',
            is_locked: true,
            ai_generated: true,
          };

          if (existingOnSameDay) {
            // UPDATE existing session
            sessionsToUpdate.push({ id: existingOnSameDay.id, data: sessionData });
          } else {
            // INSERT new session
            sessionsToInsert.push({
              ...sessionData,
              meet_link: `https://meet.jit.si/${coach.id}-${client.id}-${Date.now()}-${i}`,
            });
          }
        }
      } else {
        // Single session
        const proposedDate = new Date(session.scheduled_at);
        const existingOnSameDay = allCoachSessions.find(s => {
          if (s.client_id !== client.id) return false;
          if (s.status === 'cancelled') return false;
          
          const existingDate = new Date(s.scheduled_at);
          return (
            existingDate.getFullYear() === proposedDate.getFullYear() &&
            existingDate.getMonth() === proposedDate.getMonth() &&
            existingDate.getDate() === proposedDate.getDate()
          );
        });

        const sessionData = {
          coach_id: coach.id,
          client_id: client.id,
          scheduled_at: session.scheduled_at,
          duration_minutes: session.duration_minutes,
          session_type: session.session_type,
          notes: session.notes,
          status: 'scheduled',
          is_locked: true,
          ai_generated: true,
        };

        if (existingOnSameDay) {
          sessionsToUpdate.push({ id: existingOnSameDay.id, data: sessionData });
        } else {
          sessionsToInsert.push({
            ...sessionData,
            meet_link: `https://meet.jit.si/${coach.id}-${client.id}-${Date.now()}`,
          });
        }
      }
    }

    // Perform updates
    for (const { id, data } of sessionsToUpdate) {
      const { error } = await supabase.from('sessions').update(data).eq('id', id);
      if (error) throw error;
    }

    // Perform inserts
    if (sessionsToInsert.length > 0) {
      const { error } = await supabase.from('sessions').insert(sessionsToInsert);
      if (error) throw error;
    }

    Alert.alert('Success', 'Sessions saved!');
    await loadClientData();
  } catch (error) {
    console.error('Error saving sessions:', error);
    Alert.alert('Error', 'Failed to save sessions');
  }
};
```

### Step 2: Fix Tag Update - Force Modal Re-render

After the database update in the `onResolve` handler, we need to:
1. Wait for database update
2. Force reload data  
3. Manually update  pending resolutions state

The issue is that `loadClientData()` is async and the modal might close before it completes.

**Solution**: Close modal AFTER data refresh completes.

Change the order in `/app/(coach)/clients/[id].tsx` line ~634:

```typescript
// WRONG ORDER:
setConflictModalVisible(false);
setCurrentConflict(null);
console.log('[ConflictResolution] Refreshing data...');
await loadClientData();

// CORRECT ORDER:
console.log('[ConflictResolution] Refreshing data...');
await loadClientData(); // Wait for data to load first
setConflictModalVisible(false); // Then close modal
setCurrentConflict(null);
```

This ensures the PendingResolutionsModal receives the updated data before it unmounts.
