# 🎯 DAILY CHALLENGES SYSTEM V2.0 - IMPLEMENTATION GUIDE

**Status**: Ready for Migration  
**Date**: January 1, 2026  
**Breaking Change**: Yes - Complete Rebuild

---

## 📋 **What Changed**

### **Old System (v1.0) ❌**
```
Challenge = Multi-day (3-14 days)
├─ duration_days: 7
├─ start_date / end_date
├─ progress: Array of daily logs
└─ Max 1 active challenge per client
```

### **New System (v2.0) ✅**
```
Daily Challenge = Single Day Task
├─ assigned_date: 2026-01-01
├─ completed: true/false
├─ Multiple per day allowed
└─ Each day = separate challenges
```

---

## 🗄️ **New Database Schema**

### **Table: `daily_challenges`**
```sql
- id (UUID)
- coach_id (UUID) → coaches
- client_id (UUID) → clients
- assigned_date (DATE) ← KEY: Single date, not range
- name (TEXT)
- description (TEXT)
- focus_type (ENUM: training|nutrition|recovery|consistency)
- intensity (ENUM: low|medium|high)
- rules (TEXT[])
- status (ENUM: active|completed|cancelled|skipped)
- created_by (ENUM: coach|ai)
- completed (BOOLEAN) ← Simple binary
- completed_at (TIMESTAMPTZ)
- notes (TEXT)
- proof_image_url (TEXT)
- trigger_reason (TEXT)
- ai_reasoning (TEXT)
```

### **Table: `daily_challenge_suggestions`**
```sql
- id (UUID)
- coach_id (UUID)
- client_id (UUID)
- suggested_date (DATE) ← Single day
- challenge_data (JSONB) ← Full challenge schema
- trigger_reason (TEXT)
- ai_reasoning (TEXT)
- priority (1-5)
- status (pending|approved|dismissed|expired)
- expires_at (TIMESTAMPTZ)
```

---

## 🔧 **New RPC Functions**

### **1. create_daily_challenge**
```typescript
create_daily_challenge(
  coach_id,
  client_id,
  assigned_date,  // Single date: '2026-01-01'
  name,
  description,
  focus_type,
  intensity,
  rules[]
) → challenge_id
```

### **2. get_daily_challenges_for_date**
```typescript
get_daily_challenges_for_date(
  client_id,
  date  // '2026-01-01'
) → Challenge[]  // All challenges for that day
```

### **3. get_coach_client_challenges**
```typescript
get_coach_client_challenges(
  coach_id,
  client_id?,
  start_date,
  end_date
) → Challenge[]  // Range view (e.g., week)
```

### **4. mark_daily_challenge**
```typescript
mark_daily_challenge(
  challenge_id,
  client_id,
  completed: boolean,
  notes?,
  proof_url?
) → boolean
```

### **5. create_daily_challenges_batch**
```typescript
create_daily_challenges_batch(
  coach_id,
  client_id,
  challenges: [{
    assigned_date,
    name,
    focus_type,
    rules,
    ...
  }]
) → { created_count, challenge_ids[] }
```

### **6-9. Suggestion Management**
- `get_daily_challenge_suggestions(coach_id)`
- `approve_daily_suggestion(suggestion_id, modifications?)`
- `dismiss_daily_suggestion(suggestion_id)`
- `cancel_daily_challenge(challenge_id)`

---

## 🤖 **AI Generation Changes**

### **Old Approach ❌**
```typescript
generateChallenge() → {
  name: "7-Day Strength Challenge",
  duration_days: 7,
  rules: [...]
}
```

### **New Approach ✅**
```typescript
generateDailyChallenges(date, count?) → [
  {
    assigned_date: "2026-01-01",
    name: "Morning Walk",
    focus_type: "training",
    rules: ["30min walk"]
  },
  {
    assigned_date: "2026-01-01",
    name: "3 Veggies",
    focus_type: "nutrition",
    rules: ["Eat 3 servings"]
  }
]

// For week generation
generateWeekChallenges(startDate) → [
  // Day 1 challenges
  { assigned_date: "2026-01-01", ... },
  { assigned_date: "2026-01-01", ... },
  // Day 2 challenges
  { assigned_date: "2026-01-02", ... },
  ...
]
```

---

## 📱 **UI Changes Required**

### **Client View**
```
TODAY (Jan 1, 2026)
├─ ✓ 30min Morning Walk (Training)
├─ ○ 3 Veggies (Nutrition) 
└─ ○ 8hrs Sleep (Recovery)

[Mark Complete] [Add Photo] [Skip]
```

**Implementation:**
- Call `get_daily_challenges_for_date(client_id, TODAY)`
- Show list of challenges
- Each has its own complete button
- Track completion individually

### **Coach View**
```
WEEK VIEW (Jan 1-7)
Monday (Jan 1):
  ├─ John: Morning Walk ✓
  └─ Jane: 3 Veggies ○

Tuesday (Jan 2):
  ├─ John: Upper Body Workout ○
  ...
```

**Implementation:**
- Call `get_coach_client_challenges(coach_id, start, end)`
- Group by date
- Show completion status
- Allow batch generation

### **Activity Page**
```
Challenges (Today)
├─ ✓ Morning Walk
├─ ○ 3 Veggies  
└─ ○ 8hrs Sleep
```

**Implementation:**  
- Use `get_daily_challenges_for_date(client_id, TODAY)`
- Simple list with checkboxes
- Tap to mark complete

---

## 🚀 **Migration Steps**

### **1. Run New Migrations** ✅
```bash
# These files are ready:
supabase/migrations/20260101_daily_challenges_v2.sql
supabase/migrations/20260101_daily_challenges_rpc_v2.sql
```

### **2. Update TypeScript Types**
```typescript
export interface DailyChallenge {
  id: string;
  coach_id: string;
  client_id: string;
  assigned_date: string;  // Date string
  name: string;
  description?: string;
  focus_type: 'training' | 'nutrition' | 'recovery' | 'consistency';
  intensity: 'low' | 'medium' | 'high';
  rules: string[];
  status: 'active' | 'completed' | 'cancelled' | 'skipped';
  created_by: 'coach' | 'ai';
  completed: boolean;
  completed_at?: string;
  notes?: string;
  proof_image_url?: string;
  ai_reasoning?: string;
}
```

### **3. Update AI Generator**
- Generate per-day instead of multi-day
- Return array of daily challenges
- Support batch generation for weeks

### **4. Update All UI Screens**
- Client challenge view (today's challenges)
- Coach management (week view)
- Activity page (today's list)
- Progress tracker (daily grid)

---

## ✅ **Benefits**

1. **Simpler Logic** - No duration tracking, no progress arrays
2. **Better UX** - Clients see clear daily tasks
3. **Flexible** - Multiple challenges per day
4. **Accurate Tracking** - Each challenge = clear complete/incomplete
5. **Scalable** - Easy to generate weeks/months
6. **AI-Friendly** - Easier to generate contextual daily tasks

---

## 📝 **TODO Checklist**

### **Database** ✅
- [x] Create new schema migration
- [x] Create RPC functions
- [ ] Run migrations in Supabase

### **Backend**
- [ ] Update TypeScript types
- [ ] Rebuild AI generator for daily model
- [ ] Add batch generation logic

### **Frontend**
- [ ] Update client challenges screen (show today)
- [ ] Update coach challenges screen (week grid)
- [ ] Update activity page (daily list)
- [ ] Add week generation UI
- [ ] Update progress tracking

### **Testing**
- [ ] Test daily creation
- [ ] Test batch creation
- [ ] Test completion tracking
- [ ] Test AI generation
- [ ] Test suggestions flow

---

## 🎯 **Next Steps for You**

1. **Run the migrations** in your Supabase dashboard
2. **Test the new schema** with SQL queries
3. **I'll update the TypeScript types** and AI generator
4. **We'll rebuild the UI screens** together

Ready to proceed? Run the migrations and let me know! 🚀
