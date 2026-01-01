---
description: AI-Assisted Challenges System - Implementation Plan
---

# AI-Assisted Challenges System - Implementation Plan

## Executive Summary
This document outlines the complete implementation of the AI-Assisted Challenges System for the AI coaching platform. The system enables coaches to assign focused, time-boxed challenges to clients with AI assistance while maintaining strict coach authority and preventing system abuse.

## Core Principles (NON-NEGOTIABLE)
1. **Coach Authority First**: AI suggests, never auto-assigns
2. **Challenges ≠ Habits**: Temporary (3-14 days) vs. daily recurring
3. **Low Noise**: Max 1 active challenge per client by default
4. **AI Constraint**: Operate strictly within coach's defined philosophy

## Implementation Phases

### Phase 1: Database Schema & Migrations
**Priority**: CRITICAL
**Dependencies**: None

#### Tables to Create:

1. **`challenges`** - Main challenge table
   - `id` (uuid, primary key)
   - `client_id` (uuid, foreign key → profiles)
   - `coach_id` (uuid, foreign key → coaches)
   - `name` (text, not null)
   - `description` (text)
   - `focus_type` (enum: training, nutrition, recovery, consistency)
   - `duration_days` (integer, CHECK: 3-14)
   - `rules` (text[], structured rules)
   - `start_date` (date)
   - `end_date` (date, computed from start_date + duration_days)
   - `status` (enum: draft, suggested, active, completed, cancelled)
   - `created_by` (enum: coach, ai)
   - `approved_by` (uuid, nullable, foreign key → coaches)
   - `approved_at` (timestamp)
   - `trigger_reason` (text, for AI suggestions)
   - `ai_metadata` (jsonb, stores AI context)
   - `created_at` (timestamp)
   - `updated_at` (timestamp)

2. **`challenge_progress`** - Track daily completion
   - `id` (uuid, primary key)
   - `challenge_id` (uuid, foreign key → challenges)
   - `date` (date)
   - `completed` (boolean, default false)
   - `notes` (text, client notes)
   - `proof_url` (text, photo evidence if required)
   - `created_at` (timestamp)

3. **`ai_challenge_suggestions`** - Passive suggestion queue
   - `id` (uuid, primary key)
   - `client_id` (uuid, foreign key → profiles)
   - `coach_id` (uuid, foreign key → coaches)
   - `challenge_payload` (jsonb, full challenge data)
   - `trigger_reason` (text, why suggested)
   - `trigger_data` (jsonb, supporting metrics)
   - `status` (enum: pending, approved, dismissed, expired)
   - `priority` (integer, 1-5)
   - `expires_at` (timestamp, auto-expire after 7 days)
   - `created_at` (timestamp)
   - `reviewed_at` (timestamp)

#### AI Brain Enhancement:

4. **Update `ai_coach_brains` table** - Add challenge-specific fields
   - `training_style` (text)
   - `forbidden_methods` (text[])
   - `nutrition_philosophy` (text)
   - `max_challenge_duration` (integer, default 14)
   - `preferred_intensity` (enum: light, moderate, intense)
   - `allowed_challenge_types` (text[], defaults to all)
   - `challenge_tone` (text)

#### Constraints & Validations:
- CHECK constraint: `duration_days BETWEEN 3 AND 14`
- CHECK constraint: `end_date = start_date + duration_days`
- UNIQUE constraint: `(client_id, status)` WHERE `status = 'active'` (max 1 active)
- Trigger: Auto-update `end_date` when `start_date` or `duration_days` changes
- Trigger: Auto-expire suggestions after 7 days

### Phase 2: RPC Functions & Business Logic
**Priority**: CRITICAL
**Dependencies**: Phase 1

#### Functions to Create:

1. **`get_client_challenge_context(client_id UUID)`**
   - Returns: JSON with recent check-ins, missed sessions, plateau indicators
   - Used by: AI suggestion triggers

2. **`check_challenge_eligibility(client_id UUID)`**
   - Returns: Boolean (can assign new challenge?)
   - Validates: No active challenges, not overloaded

3. **`approve_challenge_suggestion(suggestion_id UUID, coach_id UUID)`**
   - Converts suggestion to active challenge
   - Validates: Coach ownership, suggestion not expired
   - Returns: Challenge ID

4. **`generate_ai_challenge(client_id UUID, coach_id UUID, focus_type TEXT)`**
   - On-demand generation
   - Returns: Challenge payload (not yet saved)
   - Enforces: AI brain constraints

5. **`detect_challenge_triggers()`**
   - Background job (run daily)
   - Detects: Plateaus, missed check-ins, motivation drops
   - Creates: AI suggestions (status: pending)

6. **`get_coach_challenge_suggestions(coach_id UUID)`**
   - Returns: Pending suggestions for all clients
   - Ordered by: Priority DESC, created_at ASC

### Phase 3: AI Service Layer
**Priority**: HIGH
**Dependencies**: Phase 2

#### New Service: `lib/ai-challenge-generator.ts`

**Key Functions:**
- `generateChallengeFromBrain(context)`: Generate challenge respecting AI Brain
- `suggestChallengeForTrigger(trigger, clientData, aiBrain)`: Passive suggestions
- `validateChallengeAgainstBrain(challenge, aiBrain)`: Ensure compliance
- `formatChallengeForClient(challenge)`: User-friendly formatting

**AI Prompting Strategy:**
```typescript
System Prompt:
- You are assisting a certified coach
- NEVER auto-assign or auto-approve
- Operate within coach's defined philosophy
- Suggest conservatively, respecting client capacity
- Output: Structured JSON schema
```

**Prompt Inputs:**
- Coach AI Brain config (training style, forbidden methods, etc.)
- Client goals + recent behavior (check-ins, sessions, meals)
- Current phase/program
- Recent challenges (avoid repetition)

**Prompt Outputs:**
```json
{
  "name": "string",
  "description": "string",
  "focus_type": "training | nutrition | recovery | consistency",
  "duration_days": 3-14,
  "rules": ["specific", "measurable", "achievable"],
  "reasoning": "why this challenge fits",
  "expected_impact": "high | medium | low"
}
```

### Phase 4: Coach UI (React Native)
**Priority**: HIGH
**Dependencies**: Phase 3

#### Screens to Create:

1. **`app/(coach)/challenges/index.tsx`** - Challenge Management Dashboard
   - Tab 1: Active Challenges (by client)
   - Tab 2: AI Suggestions (pending approval)
   - Tab 3: Challenge History

2. **`app/(coach)/challenges/create.tsx`** - Manual Creation Flow
   - Form: Name, focus type, duration, rules, start date
   - Client selector
   - Preview before assign

3. **`app/(coach)/challenges/suggest.tsx`** - AI Generation (On-Demand)
   - Client selector
   - Focus type selector
   - "Generate" button → AI produces 1 challenge
   - Actions: Approve, Edit, Regenerate, Cancel

4. **`app/(coach)/challenges/suggestions.tsx`** - Passive Suggestions Queue
   - List of AI-generated suggestions
   - Show: Client, trigger reason, priority
   - Actions per suggestion: Approve, Edit, Dismiss

5. **`app/(coach)/clients/[id]/challenges.tsx`** - Client-Specific Challenge View
   - Shows all challenges for this client
   - Quick actions: Assign new, view history

#### Components to Create:

1. **`ChallengeCard.tsx`** - Display challenge summary
2. **`ChallengeForm.tsx`** - Reusable form for create/edit
3. **`SuggestionCard.tsx`** - Display AI suggestion with context
4. **`ChallengeRulesEditor.tsx`** - Add/edit challenge rules
5. **`ChallengeProgressTracker.tsx`** - Visual progress indicator

### Phase 5: Client UI (React Native)
**Priority**: MEDIUM
**Dependencies**: Phase 4

#### Screens to Create:

1. **`app/(client)/challenges/index.tsx`** - Active Challenge View
   - Show current challenge (if any)
   - Progress tracker (days completed)
   - Daily check-in button
   - Rules display

2. **`app/(client)/challenges/[id].tsx`** - Challenge Detail
   - Full description
   - Rules breakdown
   - Progress calendar
   - Daily notes/proof upload

3. **`app/(client)/(tabs)/home.tsx`** - Update to show challenge widget
   - Banner: "Active Challenge"
   - Quick complete button

#### Components to Create:

1. **`ActiveChallengeWidget.tsx`** - Home screen widget
2. **`ChallengeCountdown.tsx`** - Days remaining display
3. **`DailyCheckInButton.tsx`** - Mark day complete
4. **`ChallengeCompletionModal.tsx`** - Celebration on finish

### Phase 6: Safeguards & Validations
**Priority**: CRITICAL
**Dependencies**: All phases

#### Enforcements:

1. **Database Level:**
   - Unique constraint on (client_id, 'active')
   - CHECK constraints on duration
   - Foreign key cascades
   - RLS policies (coach can only see their clients' challenges)

2. **API Level:**
   - Validate coach-client relationship before assignment
   - Prevent assigning to client with active challenge
   - Require coach approval for all AI suggestions
   - Rate limit AI generation (max 10/day per coach)

3. **AI Level:**
   - Validate AI Brain config exists before generating
   - Fallback to conservative defaults if config missing
   - Reject challenges violating forbidden_methods
   - Limit challenge intensity based on client experience

4. **UI Level:**
   - Disable "Assign" if client has active challenge
   - Show warning if challenge duration > max allowed
   - Require confirmation before dismissing suggestions

### Phase 7: Background Jobs & Automation
**Priority**: MEDIUM
**Dependencies**: Phase 3

#### Scheduled Jobs (Supabase pg_cron or Edge Functions):

1. **Daily Trigger Detection** (Run at 6 AM UTC)
   - Query: Clients with plateau indicators
   - Action: Generate AI suggestions (status: pending)
   - Notification: Email coach with suggestion count

2. **Auto-Expire Suggestions** (Run hourly)
   - Update: suggestions WHERE expires_at < NOW()
   - Set status: 'expired'

3. **Challenge Completion Detection** (Run at midnight UTC)
   - Query: Challenges WHERE end_date = TODAY()
   - Update: Set status = 'completed'
   - Notification: Congratulate client, notify coach

### Phase 8: Testing & Validation
**Priority**: HIGH
**Dependencies**: All phases

#### Test Cases:

1. **Coach Authority:**
   - ✅ AI cannot auto-assign
   - ✅ All challenges require coach approval
   - ✅ Coach can edit AI suggestions before approval

2. **Constraints:**
   - ✅ Max 1 active challenge per client
   - ✅ Duration 3-14 days enforced
   - ✅ No overlapping challenges

3. **AI Brain Compliance:**
   - ✅ AI respects forbidden_methods
   - ✅ AI follows training_style
   - ✅ AI uses correct tone
   - ✅ Fallback to conservative defaults if config missing

4. **Edge Cases:**
   - ✅ Client with no AI Brain → use sensible defaults
   - ✅ Suggestion expires before approval → graceful handling
   - ✅ Client deletes account → cascade delete challenges

## Technical Architecture

### Data Flow: AI Suggestion (Passive)

```
Daily Cron Job
  ↓
Detect Trigger (missed check-ins, plateau)
  ↓
Fetch Client Context (goals, recent behavior)
  ↓
Fetch Coach AI Brain Config
  ↓
Call AI Service (generateChallengeFromBrain)
  ↓
Store Suggestion (status: pending, expires_at: +7 days)
  ↓
Notify Coach (in-app badge, optional email)
  ↓
[WAIT FOR COACH]
  ↓
Coach Reviews Suggestion
  ↓
  ├─→ Approve → Create Challenge (status: active)
  ├─→ Edit → Modify + Approve → Create Challenge
  ├─→ Dismiss → Mark suggestion dismissed
  └─→ Ignore → Auto-expire after 7 days
```

### Data Flow: AI Generate (On-Demand)

```
Coach Clicks "Generate Challenge"
  ↓
Select Client + Focus Type
  ↓
Fetch Client Context + AI Brain
  ↓
Call AI Service (real-time generation)
  ↓
Display Challenge (not saved yet)
  ↓
Coach Actions:
  ├─→ Approve → Save as Challenge (status: active)
  ├─→ Edit → Modify fields → Save
  ├─→ Regenerate → Call AI again
  └─→ Cancel → Discard
```

### Data Flow: Manual Creation

```
Coach Clicks "Create Challenge"
  ↓
Fill Form (name, duration, rules, start_date)
  ↓
Select Client
  ↓
Preview Challenge
  ↓
Submit → Save as Challenge (status: active, created_by: coach)
  ↓
Notify Client (in-app + optional push)
```

## API Endpoints Summary

### Supabase RPC Functions:
- `get_client_challenge_context(client_id)` → JSON
- `check_challenge_eligibility(client_id)` → boolean
- `approve_challenge_suggestion(suggestion_id, coach_id)` → challenge_id
- `generate_ai_challenge(client_id, coach_id, focus_type)` → challenge_payload
- `detect_challenge_triggers()` → void
- `get_coach_challenge_suggestions(coach_id)` → suggestions[]

### Client SDK Queries:
- `supabase.from('challenges').select('*, progress:challenge_progress(*)')`
- `supabase.from('ai_challenge_suggestions').select('*').eq('coach_id', id)`

## Security & RLS Policies

### `challenges` table:
- **INSERT**: Only coaches for their clients
- **SELECT**: Coaches (their clients) + Clients (their own)
- **UPDATE**: Only coach who created it
- **DELETE**: Only coach who created it

### `ai_challenge_suggestions` table:
- **INSERT**: System only (via RPC)
- **SELECT**: Coach only (their own)
- **UPDATE**: Coach only (for approval/dismissal)
- **DELETE**: System only (auto-cleanup)

### `challenge_progress` table:
- **INSERT**: Client only (their own challenge)
- **SELECT**: Client + Coach
- **UPDATE**: Client only (their own)
- **DELETE**: None (immutable log)

## Success Metrics

1. **Coach Adoption Rate**: % of coaches using challenges
2. **Challenge Completion Rate**: % of challenges completed by clients
3. **AI Suggestion Approval Rate**: % of AI suggestions approved by coaches
4. **Client Engagement**: Active days during challenge vs. baseline
5. **Coach Workload**: Time spent creating challenges (should be minimal)
6. **Client Overwhelm**: Zero complaints about too many challenges

## Development Timeline

| Phase | Task | Est. Hours | Priority |
|-------|------|-----------|----------|
| 1 | Database Schema & Migrations | 4h | CRITICAL |
| 2 | RPC Functions & Business Logic | 6h | CRITICAL |
| 3 | AI Service Layer | 8h | HIGH |
| 4 | Coach UI (React Native) | 12h | HIGH |
| 5 | Client UI (React Native) | 8h | MEDIUM |
| 6 | Safeguards & Validations | 4h | CRITICAL |
| 7 | Background Jobs & Automation | 4h | MEDIUM |
| 8 | Testing & Validation | 6h | HIGH |
| **TOTAL** | | **52 hours** | |

## Next Steps

1. Review and approve this implementation plan
2. Create database migrations (Phase 1)
3. Implement RPC functions (Phase 2)
4. Build AI service (Phase 3)
5. Develop Coach UI (Phase 4)
6. Develop Client UI (Phase 5)
7. Implement safeguards (Phase 6)
8. Setup automation (Phase 7)
9. Test thoroughly (Phase 8)

---

**Document Status**: Ready for Implementation
**Last Updated**: 2026-01-01
**Owner**: AI Engineering Team
