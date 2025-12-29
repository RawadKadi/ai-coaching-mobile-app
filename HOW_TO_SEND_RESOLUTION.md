# HOW TO SEND A RESOLUTION

## Step-by-Step Process:

1. **Open the conflict modal** (when you see "Conflict Detected")

2. **Select an option** by clicking either:
   - "Option 1 — Propose new time to [client]" 
   - OR "Ask [client] to Reschedule"
   
   ✅ The radio button should fill in when selected

3. **Click the "Request Resolution" button at the BOTTOM**
   - This is the blue button that says "Request Resolution"
   - It's BELOW the option cards

4. **Check the console** - You should now see:
   ```
   [ConflictModal] handleResolve called, selectedOption: keep (or reschedule)
   [ConflictModal] Available slots: [...]
   [ConflictModal] Calling onResolve with Option 1 (or Option 2)
   [ConflictResolution] onResolve called with: {...}
   [ConflictResolution] Option 1: updating session...
   ```

## If Nothing Happens:

### Problem 1: Button is disabled
- **Check**: Is an option selected? The radio button should be filled
- **Fix**: Click one of the option cards to select it

### Problem 2: Button isn't visible
- **Check**: Scroll down in the modal
- **Fix**: The button might be below the visible area - scroll to see it

### Problem 3: Nothing in console
- **Check**: Is the console open and showing logs?
- **Fix**: Open developer console/logs in your React Native debugger

## What the UI Looks Like:

```
┌─────────────────────────────────────┐
│ Conflict Detected                [X]│
├─────────────────────────────────────┤
│ Time Conflict Detected              │
│ [Timeline visualization]            │
│                                     │
│ ✅ Resolution Options               │
│                                     │
│ ⭕ Option 1 — Propose new time      │
│    (Sends Message)                  │
│                                     │
│ ⭕ Ask [Client] to Reschedule       │
│                                     │
├─────────────────────────────────────┤
│ [Cancel]  [Request Resolution] ← CLICK THIS
└─────────────────────────────────────┘
```
