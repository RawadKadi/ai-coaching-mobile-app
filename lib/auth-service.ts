import { supabase } from '@/lib/supabase';

/**
 * Checks if an email is already registered in the system.
 * Uses check_email_exists RPC if present, or falls back to find_coach_by_email
 * which verifies against auth.users.
 */
export async function isEmailRegistered(email: string): Promise<boolean> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) return false;

  // Validate email pattern before querying
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(cleanEmail)) return false;

  try {
    // 1. First check via dedicated RPC if available
    const { data: existsData, error: existsError } = await supabase.rpc('check_email_exists', {
      p_email: cleanEmail,
    });
    if (!existsError && typeof existsData === 'boolean') {
      return existsData;
    }

    // 2. Fall back to find_coach_by_email (which checks auth.users)
    const { data: coachData, error: coachError } = await supabase.rpc('find_coach_by_email', {
      p_email: cleanEmail,
    });

    if (!coachError && coachData) {
      if (coachData.found === true) {
        return true;
      }
      if (coachData.error === 'No user found with this email') {
        return false;
      }
      // If error is "User found but not a coach" or "Coach profile not found",
      // the user exists in auth.users!
      if (
        coachData.error === 'User found but not a coach' ||
        coachData.error === 'Coach profile not found'
      ) {
        return true;
      }
    }
  } catch (err) {
    console.warn('[isEmailRegistered] Verification failed:', err);
  }

  return false;
}

