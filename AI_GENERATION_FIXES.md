# AI Challenge Generation - Fixes Required

## Issue 1: RPC Type Mismatch (400 Error)

**Problem**: The `get_client_challenge_history` RPC returns TEXT but schema uses ENUMs.

**Fix**: Run this in Supabase SQL Editor:

```sql
DROP FUNCTION IF EXISTS get_client_challenge_history(UUID);

CREATE OR REPLACE FUNCTION get_client_challenge_history(
  p_client_id UUID
)
RETURNS TABLE (
  task_name TEXT,
  task_description TEXT,
  focus_type challenge_focus_type,
  intensity challenge_intensity,
  assigned_date DATE,
  completed BOOLEAN,
  completed_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sc.name::TEXT,
    sc.description::TEXT,
    sc.focus_type,
    sc.intensity,
    sc.assigned_date,
    sc.completed,
    sc.completed_at
  FROM sub_challenges sc
  JOIN mother_challenges mc ON sc.mother_challenge_id = mc.id
  WHERE mc.client_id = p_client_id
    AND sc.assigned_date >= CURRENT_DATE - INTERVAL '30 days'
    AND mc.status != 'cancelled'
  ORDER BY sc.assigned_date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Issue 2: Google Gemini API 403 Error

**Problem**: Invalid or missing API key.

**Fix Options:**

### Option A: Get a Valid Gemini API Key
1. Go to: https://makersuite.google.com/app/apikey
2. Create new API key
3. Add to `.env`:
   ```
   EXPO_PUBLIC_GOOGLE_API_KEY=AIza...your_key_here
   ```
4. Restart dev server: `npm run dev`

### Option B: Use Mock Data for Testing (Temporary)
Update `lib/ai-challenge-service.ts` to return mock challenges:

```typescript
export async function generateWeeklyChallenges(
  clientId: string,
  clientName: string,
  startDate: Date
): Promise<SubChallengeTemplate[]> {
  // TEMPORARY: Return mock data for testing
  const mockChallenges: SubChallengeTemplate[] = [];
  
  for (let day = 0; day < 7; day++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + day);
    const dateStr = date.toISOString().split('T')[0];
    
    mockChallenges.push(
      {
        name: `Upper body strength`,
        description: `Push-ups 3x12, Pull-ups 3x8, Shoulder press 3x10`,
        assigned_date: dateStr,
        focus_type: 'training',
        intensity: 'medium'
      },
      {
        name: `Protein-rich breakfast`,
        description: `35g protein minimum - eggs, Greek yogurt, or protein shake`,
        assigned_date: dateStr,
        focus_type: 'nutrition',
        intensity: 'low'
      },
      {
        name: `Evening stretching routine`,
        description: `15 minutes full body stretching focusing on tight areas`,
        assigned_date: dateStr,
        focus_type: 'recovery',
        intensity: 'low'
      }
    );
  }
  
  return mockChallenges;
}
```

## Verification Steps

After fixes:
1. Go to Challenges → AI Generate
2. Select a client
3. Should see "Generating with AI..." (5-10 seconds)
4. Should navigate to review screen with 21 tasks
5. Should be able to edit and approve

## Quick Test Command

```bash
# Restart dev server after fixing
npm run dev
```
