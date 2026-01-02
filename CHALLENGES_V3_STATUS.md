# 🚨 CHALLENGES V3 MIGRATION STATUS

## Current Situation
We just migrated to V3 schema (mother + sub-challenges) but ALL UI code still references the old tables.

## What Just Happened
✅ Ran migration: `20260102_mother_sub_challenges_v3.sql`
- Dropped: `daily_challenges` table
- Dropped: `daily_challenge_suggestions` table  
- Created: `mother_challenges` table (container)
- Created: `sub_challenges` table (daily tasks)
- Created: `mother_challenge_suggestions` table

## 🔴 Breaking Changes
All screens are broken because they query deleted tables:

### Files Using `daily_challenges` (BROKEN):
1. `/app/(coach)/challenges/index.tsx` - Lines 79, 131
2. `/app/(coach)/challenges/[id].tsx` - Lines 40-42
3. `/app/(client)/challenges/index.tsx` - Line 53
4. `/app/(client)/(tabs)/activity.tsx` - Line 57

### Files Using `daily_challenge_suggestions` (BROKEN):
- Coach dashboard suggestions tab

## 📋 What Needs to Be Done

### 1. Create RPC Functions (URGENT)
- `create_mother_challenge_with_subs()`
- `get_mother_challenges_for_client()`
- `get_todays_sub_challenges()`
- `mark_sub_challenge_complete()`
- `get_mother_challenge_progress()`

### 2. Update Coach Dashboard
- Query `mother_challenges` instead of `daily_challenges`
- Show mother challenges with sub-challenge count
- Display date range instead of single date

### 3. Update Client Challenges Screen
- Get active mother challenge
- Show TODAY's sub-challenges
- Expandable list to check off sub-tasks

### 4. Update Activity Page
- Query sub_challenges for today
- Show as checkable list

### 5. Update AI Generation
- Generate mother challenge with 7 days of sub-challenges
- Store in `mother_challenge_suggestions`

## 🎯 Recommended Next Steps

**Option A: Quick Fix (Rollback)**
- Drop V3 tables
- Recreate V2 `daily_challenges`
- Everything works again
- BUT: No mother+sub structure

**Option B: Complete V3 (2-3 hours work)**
1. Create all RPC functions
2. Update all 4 UI screens
3. Update AI generator
4. Test full flow

## Current Status
❌ App is BROKEN - all challenge features return 404
⏰ Need decision: Rollback to V2 or complete V3?

---

**Your call**: Do you want to:
1. **Rollback** and stick with simple daily challenges? (15 min)
2. **Complete V3** with proper mother+sub structure? (2-3 hours)
