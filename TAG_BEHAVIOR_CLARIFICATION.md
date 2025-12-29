# CLARIFICATION: "Not Yet Sent" Tag

## Current Flow (Which is CORRECT):

### Step 1: AI Scheduler Detects Conflict
- You schedule a session via AI
- AI detects it conflicts with another session
- Session is saved with:
  - `status: 'pending_resolution'`
  - `invite_sent: false`
- **Tag: "Not Yet Sent"** ← This is CORRECT because you haven't sent anything to the client yet!

### Step 2: You Open Pending Resolutions
- You see the session with "Not Yet Sent" tag
- This means: "You need to resolve this conflict and send a request to the client"

### Step 3: You Click "Resolve"
- Conflict modal opens
- You select Option 1 or Option 2
- You click "Request Resolution"
- Database updates to:
  - `status: 'proposed'`
  - `invite_sent: true`
- **Tag: "Pending"** ← This means "Waiting for client response"

## Why "Not Yet Sent" is Correct

"Not Yet Sent" means:
- ✅ Conflict was detected
- ✅ Session was saved
- ❌ You haven't sent a resolution request to the client yet

"Pending" means:
- ✅ You sent Option 1 or Option 2 to the client
- ⏳ Waiting for client to respond

## If You Want Different Behavior

If you want the tag to show "Pending" IMMEDIATELY after the AI Scheduler saves the session (without requiring you to click "Resolve" and send Option 1/2), then we need to:

1. **Auto-send** Option 1 or Option 2 when the session is first saved
2. Skip the "Not Yet Sent" state entirely
3. Go straight from AI Scheduler → "Pending"

**Question: Do you want sessions to automatically send Option 1/2 when first created, or do you want the coach to manually choose which option to send?**

Current behavior = Coach manually chooses
Alternative = Auto-send Option 1
