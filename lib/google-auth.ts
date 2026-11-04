import * as WebBrowser from 'expo-web-browser';
import { supabase } from '@/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

export interface GoogleAuthResult {
  success: boolean;
  error?: string;
  role?: string;
}

const extractParam = (url: string, param: string): string | null => {
  const regex = new RegExp(`[?&#]${param}=([^&#]+)`);
  const match = url.match(regex);
  return match && match[1] ? decodeURIComponent(match[1].replace(/\+/g, ' ')) : null;
};

/**
 * Handles Google OAuth flow for both Sign In and Sign Up.
 */
async function runGoogleOAuth(): Promise<{ url: string } | { error: string }> {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'coachingapp://',
        queryParams: {
          prompt: 'select_account',
        },
        skipBrowserRedirect: true,
      },
    });

    if (error || !data?.url) {
      return { error: error?.message || 'Could not start Google sign in' };
    }

    const result = await WebBrowser.openAuthSessionAsync(data.url, 'coachingapp://');

    if (result.type !== 'success' || !result.url) {
      return { error: 'Authentication was cancelled' };
    }

    const returnUrl = result.url;
    const errorDesc = extractParam(returnUrl, 'error_description') || extractParam(returnUrl, 'error');
    if (errorDesc) {
      return { error: errorDesc };
    }

    // Check code exchange or tokens in fragment
    const code = extractParam(returnUrl, 'code');
    if (code) {
      const { error: codeErr } = await supabase.auth.exchangeCodeForSession(code);
      if (codeErr) return { error: codeErr.message };
    } else {
      const accessToken = extractParam(returnUrl, 'access_token');
      const refreshToken = extractParam(returnUrl, 'refresh_token');
      if (accessToken && refreshToken) {
        const { error: setErr } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (setErr) return { error: setErr.message };
      }
    }

    return { url: returnUrl };
  } catch (err: any) {
    return { error: err.message || 'Google authentication failed' };
  }
}

/**
 * Sign In with Google:
 * Existing coaches or clients are logged in directly.
 * If user does not exist in the database, rejects with invitation notice.
 */
export async function signInWithGoogle(): Promise<GoogleAuthResult> {
  const res = await runGoogleOAuth();
  if ('error' in res) {
    return { success: false, error: res.error };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'Sign in failed. Could not verify user.' };
  }

  // Check if profile exists
  let { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .maybeSingle();

  // Give backend trigger a brief moment if newly created
  if (!profile) {
    await new Promise((r) => setTimeout(r, 600));
    const retry = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .maybeSingle();
    profile = retry.data;
  }

  if (!profile) {
    // Client accounts are invitation-only. An uninvited new user cannot sign in.
    await supabase.auth.signOut();
    return {
      success: false,
      error: 'No account found. Athlete accounts are invitation only. Please use the invite link from your coach.',
    };
  }

  return { success: true, role: profile.role };
}

/**
 * Coach Sign Up with Google:
 * Creates a coach profile and coach record if new.
 * Rejects if already registered as a client.
 */
export async function signUpCoachWithGoogle(): Promise<GoogleAuthResult> {
  const res = await runGoogleOAuth();
  if ('error' in res) {
    return { success: false, error: res.error };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'Sign up failed. Could not verify user.' };
  }

  let { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile) {
    const rawName = user.user_metadata?.full_name || user.user_metadata?.name;
    const fallbackName = user.email ? user.email.split('@')[0] : 'Coach';
    const fullName = (rawName || fallbackName).trim();

    // 1. Create or update profile as coach
    const { error: profErr } = await supabase.from('profiles').upsert({
      id: user.id,
      role: 'coach',
      full_name: fullName,
      onboarding_completed: false,
    });
    if (profErr) {
      console.warn('[GoogleAuth] Profile creation error:', profErr);
    }

    // 2. Create coach entry
    const { error: coachErr } = await supabase.from('coaches').upsert({
      user_id: user.id,
      is_active: true,
    });
    if (coachErr) {
      console.warn('[GoogleAuth] Coach creation error:', coachErr);
    }

    return { success: true, role: 'coach' };
  }

  if (profile.role !== 'coach') {
    await supabase.auth.signOut();
    return {
      success: false,
      error: 'This Google account is already registered as a client.',
    };
  }

  return { success: true, role: 'coach' };
}

