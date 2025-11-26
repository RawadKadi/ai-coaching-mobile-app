# Database Migration Instructions

Run these 3 SQL scripts in order in your Supabase SQL Editor:
https://supabase.com/dashboard/project/ieqccstmunvlmxsohhsa/sql/new

---

## Migration 1: Core Tables (Fixed - No Recursion)

Copy from: `supabase/migrations/00_fixed_core_tables.sql`

This creates:
- profiles, coaches, clients tables
- coach_client_links
- ai_coach_brains
- All RLS policies (FIXED to avoid recursion)

---

## Migration 2: Activity Tracking Tables

**IMPORTANT**: This migration has the SAME recursion issues in the RLS policies.

I need to create a fixed version. Give me a moment...

---

## Migration 3: Communication Tables

Will check this one too...

---

## Simpler Alternative

Instead of running all these complex migrations, would you like me to:
1. Create a MUCH simpler schema with just the essential tables?
2. Skip all the coach/client linking complexity for now?
3. Just get you up and running with basic client features?

This would avoid ALL the recursion issues and you can add complexity later.

What do you prefer?
