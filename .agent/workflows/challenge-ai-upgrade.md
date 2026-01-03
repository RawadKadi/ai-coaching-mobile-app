---
description: Challenge AI Memory & Coach Editing - Implementation Plan
---

# Challenge Generation Upgrade - AI Memory & Coach Editing

## Overview
Upgrade the weekly challenge generation to include AI memory (avoid repetition), coach editing interface, and improved contextual generation.

## Architecture

### 1. Database Updates
- **No schema changes needed** - existing `mother_challenges` and `sub_challenges` tables already support this
- Use existing data to track history per client

### 2. New RPC Function: `get_client_challenge_history`
```sql
-- Returns last 30 days of sub-challenges for a client
-- Used by AI to avoid repetition and understand patterns
CREATE OR REPLACE FUNCTION get_client_challenge_history(
  p_client_id UUID
)
RETURNS TABLE (
  task_name TEXT,
  task_description TEXT,
  focus_type TEXT,
  intensity TEXT,
  assigned_date DATE,
  completed BOOLEAN,
  completed_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sc.name,
    sc.description,
    sc.focus_type,
    sc.intensity,
    sc.assigned_date,
    sc.completed,
    sc.completed_at
  FROM sub_challenges sc
  JOIN mother_challenges mc ON sc.mother_challenge_id = mc.id
  WHERE mc.client_id = p_client_id
    AND sc.assigned_date >= CURRENT_DATE - INTERVAL '30 days'
  ORDER BY sc.assigned_date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 3. Enhanced AI Generation Service
**File**: `lib/ai-challenge-service.ts`
- Fetches client challenge history
- Builds context-aware prompt
- Generates 7 days of varied, non-repetitive challenges
- Returns structured JSON for review

### 4. New Review/Edit Screen
**File**: `app/(coach)/challenges/review.tsx`
- Shows all 7 days of generated sub-challenges
- Inline editing for each sub-challenge (name, description, focus, intensity)
- Add/delete sub-challenges
- "Approve All" button → creates mother challenge via RPC
- "Regenerate" button → calls AI again with feedback

### 5. Updated Flow
```
suggest.tsx (select client + generate)
    ↓
review.tsx (edit all sub-challenges)
    ↓
create_mother_challenge RPC (approve & save)
    ↓
index.tsx (back to dashboard)
```

## Implementation Steps

### Phase 1: Database & RPC (15 min)
- [ ] Create `get_client_challenge_history` RPC function
- [ ] Test RPC returns correct data

### Phase 2: AI Service (30 min)
- [ ] Create `lib/ai-challenge-service.ts`
- [ ] Implement `generateWeeklyChallenges(clientId, clientProfile)` function
- [ ] Build context-aware prompt with history
- [ ] Parse AI response into structured sub-challenge array

### Phase 3: Review Screen (45 min)
- [ ] Create `app/(coach)/challenges/review.tsx`
- [ ] Display all 7 days in editable cards
- [ ] Implement add/edit/delete sub-challenge
- [ ] Add "Approve All" and "Regenerate" buttons
- [ ] Handle navigation and state management

### Phase 4: Update Suggest Screen (15 min)
- [ ] Update `suggest.tsx` to use new AI service
- [ ] Navigate to review screen instead of creating directly
- [ ] Pass generated challenges via route params or context

### Phase 5: Testing & Polish (15 min)
- [ ] Test full flow end-to-end
- [ ] Verify AI memory works (no duplicates)
- [ ] Test editing and approval
- [ ] Polish UI/UX

## Key Design Decisions

1. **AI Memory**: Uses last 30 days of sub-challenges to build context
2. **No Draft Table**: Generated challenges stored in component state until approved
3. **Batch Approval**: Single RPC call creates mother + all sub-challenges atomically
4. **Client-Scoped**: Each client has independent challenge history
5. **Balance Algorithm**: AI prompted to ensure 40% training, 35% nutrition, 25% recovery
6. **Progressive Difficulty**: AI considers completion rate to adjust intensity

## Success Criteria
- ✅ AI generates 7 unique days without repeating previous challenges
- ✅ Coach can edit any sub-challenge before approval
- ✅ "Approve All" creates complete mother challenge in one click
- ✅ Client experience unchanged (sees today's tasks only)
- ✅ System handles multiple clients independently
