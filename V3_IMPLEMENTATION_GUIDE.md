# 🚀 CHALLENGES V3 - IMPLEMENTATION GUIDE

## ✅ COMPLETED

### 1. Database Schema ✅
- File: `20260102_mother_sub_challenges_v3.sql`
- Tables: `mother_challenges`, `sub_challenges`, `mother_challenge_suggestions`
- **Status**: RUN THIS MIGRATION FIRST

### 2. RPC Functions ✅
- File: `20260102_mother_sub_rpc_v3.sql`
- Functions:
  - `create_mother_challenge()` - Create mother + all subs
  - `get_client_mother_challenges()` - Get client's challenges
  - `get_todays_sub_challenges()` - Get today's tasks
  - `mark_sub_challenge()` - Mark sub complete
  - `get_mother_challenge_details()` - Full challenge details
  - `cancel_mother_challenge()` - Cancel challenge
  - `get_coach_mother_challenges()` - Coach dashboard
- **Status**: RUN THIS MIGRATION SECOND

### 3. TypeScript Types ✅
- File: `types/challenges-v3.ts`
- Types: `MotherChallenge`, `SubChallenge`, `TodaysSubChallenge`, etc.
- **Status**: READY TO USE

---

## 🔧 TODO - UI SCREENS (4 files to update)

### File 1: `/app/(client)/challenges/index.tsx`

**Current**: Queries `daily_challenges`  
**Needed**: Query `get_todays_sub_challenges()`

```typescript
// REPLACE loadChallenges() with:
const loadChallenges = async () => {
  const { data: clientData } = await supabase
    .from('clients')
    .select('id')
    .eq('user_id', user.id)
    .single();

  const today = new Date().toISOString().split('T')[0];
  const { data } = await supabase.rpc('get_todays_sub_challenges', {
    p_client_id: clientData.id,
    p_date: today
  });

  setSubChallenges(data || []);
};
```

**UI Changes**:
- Show expandable mother challenge name
- List all sub-challenges for today
- Checkboxes to mark each sub complete
- Show "X of Y completed today"

---

### File 2: `/app/(client)/(tabs)/activity.tsx`

**Current**: Line 57 queries `daily_challenges`  
**Needed**: Query `get_todays_sub_challenges()`

```typescript
// REPLACE the query at line 53-60 with:
const today = new Date().toISOString().split('T')[0];
const { data: subsResult } = await supabase.rpc('get_todays_sub_challenges', {
  p_client_id: client?.id,
  p_date: today
});

setSubChallenges(subsResult || []);
```

**UI Changes**:
- Show sub-challenges grouped by mother
- Checkboxes to mark complete

---

### File 3: `/app/(coach)/challenges/index.tsx`

**Current**: Lines 79, 131 query `daily_challenges`  
**Needed**: Query `get_coach_mother_challenges()`

```typescript
const loadActiveChallenges = async () => {
  const { data: coachData } = await supabase
    .from('coaches')
    .select('id')
    .eq('user_id', user!.id)
    .single();

  const { data } = await supabase.rpc('get_coach_mother_challenges', {
    p_coach_id: coachData.id
  });

  const active = data?.filter(c => c.status === 'active') || [];
  setActiveChallenges(active);
};
```

**UI Changes**:
- Show mother challenge name
- Display date range (Jan 1 - Jan 7)
- Show progress: "X/Y subs completed"
- Client name

---

### File 4: `/app/(coach)/challenges/[id].tsx`

**Current**: Line 42 queries `daily_challenges`  
**Needed**: Query `get_mother_challenge_details()`

```typescript
const loadChallengeDetails = async () => {
  const { data } = await supabase.rpc('get_mother_challenge_details', {
    p_mother_id: id
  });

  setMotherChallenge(data.mother);
  setSubChallenges(data.sub_challenges);
};
```

**UI Changes**:
- Show mother challenge info at top
- List all sub-challenges grouped by date
- Show completion status per day

---

## 🤖 TODO - AI GENERATION

### File: `/app/(coach)/challenges/suggest.tsx`

**Current**: Generates single challenge  
**Needed**: Generate mother + week of subs

```typescript
const handleGenerate = async () => {
  // Generate week-long challenge
  const result = {
    mother_name: "Weekly Wellness Challenge",
    mother_description: "...",
    start_date: "2026-01-02",
    end_date: "2026-01-08",
    sub_challenges: [
      {
        assigned_date: "2026-01-02",
        name: "30min morning walk",
        focus_type: "training",
        intensity: "medium"
      },
      {
        assigned_date: "2026-01-02",
        name: "Eat 3 veggies today",
        focus_type: "nutrition",
        intensity: "low"
      },
      // ... more for each day
    ]
  };

  // Create via RPC
  await supabase.rpc('create_mother_challenge', {
    p_coach_id: coachData.id,
    p_client_id: selectedClient.id,
    p_name: result.mother_name,
    p_description: result.mother_description,
    p_start_date: result.start_date,
    p_end_date: result.end_date,
    p_sub_challenges: result.sub_challenges,
    p_created_by: 'coach'
  });
};
```

---

## 📝 STEP-BY-STEP EXECUTION

### Phase 1: Database (5 min)
1. ✅ Run `20260102_mother_sub_challenges_v3.sql`
2. ✅ Run `20260102_mother_sub_rpc_v3.sql`
3. Test: `SELECT * FROM mother_challenges;` should work

### Phase 2: Client Screens (30 min)
1. Update `/app/(client)/challenges/index.tsx`
2. Update `/app/(client)/(tabs)/activity.tsx`
3. Test: Client should see today's sub-challenges

### Phase 3: Coach Screens (30 min)
1. Update `/app/(coach)/challenges/index.tsx`
2. Update `/app/(coach)/challenges/[id].tsx`
3. Test: Coach should see mother challenges

### Phase 4: AI Generation (45 min)
1. Update `/app/(coach)/challenges/suggest.tsx`
2. Build AI generator for week-long challenges
3. Test: Generate 7-day challenge with daily subs

---

## 🎯 TESTING CHECKLIST

- [ ] Coach creates mother challenge manually
- [ ] Mother challenge shows in coach dashboard
- [ ] Client sees today's sub-challenges
- [ ] Client can mark sub-challenges complete
- [ ] Mother challenge progress updates
- [ ] Activity page shows today's subs
- [ ] Coach can view mother challenge details
- [ ] AI generates week-long challenge

---

## 🚨 CRITICAL NOTES

1. **Mother Challenge = Container**
   - 1 mother per client (default)
   - 7-14 days duration
   - Contains N sub-challenges

2. **Sub-Challenges = Daily Tasks**
   - Each day can have 1-N subs
   - Client only sees TODAY's subs
   - Each sub is independent

3. **Completion Logic**
   - Mark individual subs complete
   - Mother is complete when ALL subs are complete
   - Progress = completed_subs / total_subs

---

**CURRENT STATUS**: Database ✅ | RPC Functions ✅ | Types ✅ | UI ❌ | AI ❌
** NEXT**: Update 4 UI screens (2-3 hours)
