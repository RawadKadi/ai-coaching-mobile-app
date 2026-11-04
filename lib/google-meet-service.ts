import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { Coach } from '@/types/database';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

const GOOGLE_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ||
  process.env.GOOGLE_CLIENT_ID ||
  '';

const GOOGLE_CLIENT_SECRET =
  process.env.EXPO_PUBLIC_GOOGLE_CLIENT_SECRET ||
  process.env.GOOGLE_CLIENT_SECRET ||
  '';

const REDIRECT_URI = 'https://ieqccstmunvlmxsohhsa.supabase.co/auth/v1/callback';
const MEET_SCOPE = 'openid email profile https://www.googleapis.com/auth/meetings.space.created https://www.googleapis.com/auth/meetings.space.readonly';

const STORAGE_KEY_PREFIX = '@coach_google_meet_connected_';
const STORAGE_ACCESS_TOKEN_PREFIX = '@coach_google_access_token_';
const STORAGE_REFRESH_TOKEN_PREFIX = '@coach_google_refresh_token_';
const STORAGE_EXPIRY_PREFIX = '@coach_google_expiry_';

const memoryCache: Record<string, boolean> = {};

// Google Meet Service for coaching sessions
export interface ConnectResult {
  success: boolean;
  error?: string;
  errorType?: 'email_mismatch' | 'scope_missing' | 'cancelled' | 'general';
  expectedEmail?: string;
  connectedEmail?: string;
}

class GoogleMeetService {
  /**
   * Synchronous check for 0ms instant UI rendering.
   */
  isConnectedSync(coach?: Coach | null): boolean {
    if (!coach?.id) return false;
    if (coach.google_meet_connected) {
      memoryCache[coach.id] = true;
      return true;
    }
    return memoryCache[coach.id] === true;
  }

  /**
   * Check if a coach has connected their Google Meet account.
   */
  async isConnected(coach?: Coach | null): Promise<boolean> {
    if (!coach?.id) return false;

    if (coach.google_meet_connected) {
      memoryCache[coach.id] = true;
      return true;
    }

    if (memoryCache[coach.id] !== undefined) {
      return memoryCache[coach.id];
    }

    try {
      const cached = await AsyncStorage.getItem(STORAGE_KEY_PREFIX + coach.id);
      if (cached === 'true') {
        memoryCache[coach.id] = true;
        return true;
      }
    } catch {
      // ignore
    }

    // Direct database check
    try {
      const { data } = await supabase
        .from('coaches')
        .select('google_meet_connected')
        .eq('id', coach.id)
        .maybeSingle();

      const isConn = !!data?.google_meet_connected;
      memoryCache[coach.id] = isConn;
      if (isConn) {
        await AsyncStorage.setItem(STORAGE_KEY_PREFIX + coach.id, 'true');
      }
      return isConn;
    } catch (e) {
      console.warn('[GoogleMeet] Database connection check error:', e);
    }

    memoryCache[coach.id] = false;
    return false;
  }

  /**
   * Launch OAuth flow to authenticate coach with Google Meet.
   * Uses an isolated Supabase client so the coach's active login session is NEVER changed.
   * Verifies that the authenticated Google account matches the coach's sign-in email.
   */
  async connect(coachId: string, expectedEmail?: string): Promise<ConnectResult> {
    if (!coachId) {
      return { success: false, error: 'Coach profile missing' };
    }

    try {
      // 1. Create isolated auth client to completely prevent overwriting the main session
      const isolatedClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          flowType: 'pkce',
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      });

      const { data, error } = await isolatedClient.auth.signInWithOAuth({
        provider: 'google',
        options: {
          scopes: MEET_SCOPE,
          redirectTo: 'coachingapp://',
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
            ...(expectedEmail ? { login_hint: expectedEmail } : {}),
          },
          skipBrowserRedirect: true,
        },
      });

      if (error || !data?.url) {
        return { success: false, error: error?.message || 'Could not start Google sign in' };
      }

      console.log('[GoogleMeet] Launching auth session:', data.url);

      // 2. Open auth session in browser listening for coachingapp://
      const result = await WebBrowser.openAuthSessionAsync(data.url, 'coachingapp://');

      if (result.type !== 'success' || !result.url) {
        return { success: false, errorType: 'cancelled', error: 'Authentication was cancelled' };
      }

      const returnUrl = result.url;
      console.log('[GoogleMeet] Returned URL:', returnUrl);

      // Helper to parse query or hash parameter
      const extractParam = (url: string, param: string): string | null => {
        const regex = new RegExp(`[?&#]${param}=([^&#]+)`);
        const match = url.match(regex);
        return match && match[1] ? decodeURIComponent(match[1].replace(/\+/g, ' ')) : null;
      };

      // Check for explicit error parameter
      const errorDesc = extractParam(returnUrl, 'error_description');
      const errorCode = extractParam(returnUrl, 'error');
      if (errorDesc || errorCode) {
        const readableErr = errorDesc || errorCode;
        console.error('[GoogleMeet] Callback error:', readableErr);
        return { success: false, error: readableErr! };
      }

      let providerToken: string | null = extractParam(returnUrl, 'provider_token');
      let providerRefreshToken: string | null = extractParam(returnUrl, 'provider_refresh_token');

      // If code was returned, exchange ONLY within isolated client
      const code = extractParam(returnUrl, 'code');
      if (code) {
        try {
          const { data: sessionData } = await isolatedClient.auth.exchangeCodeForSession(code);
          if (sessionData?.session) {
            providerToken = (sessionData.session as any).provider_token || providerToken;
            providerRefreshToken = (sessionData.session as any).provider_refresh_token || providerRefreshToken;
          }
        } catch (exchangeErr) {
          console.warn('[GoogleMeet] isolated exchangeCode error:', exchangeErr);
        }
      }

      // 3. Ensure we received a valid providerToken
      if (!providerToken) {
        console.error('[GoogleMeet] No provider_token received from Google OAuth flow');
        return {
          success: false,
          error: 'Could not obtain Google Meet permissions. Please try again.',
        };
      }

      // 4. Verify connected email from Google
      let connectedEmail: string | null = null;
      try {
        const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${providerToken}` },
        });
        if (userinfoRes.ok) {
          const userinfo = await userinfoRes.json();
          connectedEmail = userinfo.email || null;
          console.log('[GoogleMeet] Google account email verified:', connectedEmail);
        }
      } catch (uiErr) {
        console.warn('[GoogleMeet] userinfo fetch error:', uiErr);
      }

      // 5. Validate email match with coach's personal account
      if (expectedEmail && connectedEmail) {
        const cleanExpected = expectedEmail.trim().toLowerCase();
        const cleanConnected = connectedEmail.trim().toLowerCase();
        if (cleanExpected !== cleanConnected) {
          console.warn('[GoogleMeet] Email mismatch:', { cleanExpected, cleanConnected });
          return {
            success: false,
            errorType: 'email_mismatch',
            expectedEmail: cleanExpected,
            connectedEmail: cleanConnected,
            error: `Your personal email is ${cleanExpected} and you connected your Google Meet with a different email (${cleanConnected}). Make sure to connect your Google email that matches this sign in email or else it won't work.`,
          };
        }
      }

      // 6. Verify Google Meet API space creation works before completing connection
      try {
        const testSpaceRes = await fetch('https://meet.googleapis.com/v2/spaces', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${providerToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        });

        if (!testSpaceRes.ok) {
          const testSpaceData = await testSpaceRes.json().catch(() => ({}));
          console.warn('[GoogleMeet] Space verification failed:', testSpaceData);
          const errDetail = testSpaceData.error?.message?.toLowerCase() || '';
          if (
            testSpaceRes.status === 403 &&
            (errDetail.includes('insufficient') || errDetail.includes('scope') || errDetail.includes('permission'))
          ) {
            return {
              success: false,
              errorType: 'scope_missing',
              error: 'Meeting permissions were not granted. Please make sure to check "Select all" on Google\'s screen.',
            };
          }
          return {
            success: false,
            error: testSpaceData.error?.message || 'Could not verify meeting permissions with Google.',
          };
        } else {
          const spaceData = await testSpaceRes.json().catch(() => ({}));
          console.log('[GoogleMeet] Pre-verified meeting space created successfully:', spaceData.meetingUri);
        }
      } catch (testErr: any) {
        console.warn('[GoogleMeet] Space verification network error:', testErr);
      }

      // 7. Clear any stale cached tokens before saving new ones
      await AsyncStorage.multiRemove([
        STORAGE_ACCESS_TOKEN_PREFIX + coachId,
        STORAGE_REFRESH_TOKEN_PREFIX + coachId,
        STORAGE_EXPIRY_PREFIX + coachId,
      ]);

      const expiryDate = new Date(Date.now() + 3600 * 1000).toISOString();

      // 8. Persist fresh verified credentials
      await AsyncStorage.multiSet([
        [STORAGE_KEY_PREFIX + coachId, 'true'],
        [STORAGE_ACCESS_TOKEN_PREFIX + coachId, providerToken],
        ...(providerRefreshToken ? [[STORAGE_REFRESH_TOKEN_PREFIX + coachId, providerRefreshToken] as [string, string]] : []),
        [STORAGE_EXPIRY_PREFIX + coachId, expiryDate],
      ]);

      // Best effort DB save (wrapped in catch in case DB columns are missing)
      try {
        await supabase
          .from('coaches')
          .update({
            google_meet_connected: true,
            google_access_token: providerToken,
            ...(providerRefreshToken ? { google_refresh_token: providerRefreshToken } : {}),
            google_token_expiry: expiryDate,
          })
          .eq('id', coachId);
      } catch (dbErr) {
        console.warn('[GoogleMeet] DB update error:', dbErr);
      }

      memoryCache[coachId] = true;
      console.log('[GoogleMeet] Successfully connected Google Meet for coach:', coachId);
      return {
        success: true,
        connectedEmail: connectedEmail || expectedEmail,
      };
    } catch (e: any) {
      console.error('[GoogleMeet] Connect error:', e);
      return { success: false, error: e.message || 'Connection failed' };
    }
  }

  /**
   * Disconnect Google Meet for this coach.
   */
  async disconnect(coachId: string): Promise<boolean> {
    try {
      memoryCache[coachId] = false;
      await AsyncStorage.multiRemove([
        STORAGE_KEY_PREFIX + coachId,
        STORAGE_ACCESS_TOKEN_PREFIX + coachId,
        STORAGE_REFRESH_TOKEN_PREFIX + coachId,
        STORAGE_EXPIRY_PREFIX + coachId,
      ]);

      try {
        await supabase
          .from('coaches')
          .update({
            google_meet_connected: false,
            google_access_token: null,
            google_refresh_token: null,
            google_token_expiry: null,
          })
          .eq('id', coachId);
      } catch (dbErr) {
        console.warn('[GoogleMeet] DB disconnect error:', dbErr);
      }

      return true;
    } catch (e) {
      console.error('[GoogleMeet] Disconnect error:', e);
      return false;
    }
  }

  /**
   * Retrieves a valid access token, refreshing if necessary.
   */
  async getValidToken(coachId: string): Promise<string | null> {
    try {
      // 1. Check local storage / DB
      let accessToken = await AsyncStorage.getItem(STORAGE_ACCESS_TOKEN_PREFIX + coachId);
      let refreshToken = await AsyncStorage.getItem(STORAGE_REFRESH_TOKEN_PREFIX + coachId);
      let expiryStr = await AsyncStorage.getItem(STORAGE_EXPIRY_PREFIX + coachId);

      if (!accessToken || !expiryStr) {
        const { data } = await supabase
          .from('coaches')
          .select('google_access_token, google_refresh_token, google_token_expiry')
          .eq('id', coachId)
          .maybeSingle();

        if (data) {
          accessToken = data.google_access_token;
          refreshToken = data.google_refresh_token;
          expiryStr = data.google_token_expiry;
        }
      }

      if (!accessToken) return null;

      const isExpired = expiryStr ? new Date(expiryStr).getTime() < Date.now() + 60000 : false;

      if (!isExpired) {
        return accessToken;
      }

      // Refresh token if expired
      if (refreshToken && GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
        console.log('[GoogleMeet] Refreshing expired access token...');
        const res = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            refresh_token: refreshToken,
            grant_type: 'refresh_token',
          }).toString(),
        });

        const data = await res.json();
        if (res.ok && data.access_token) {
          const newAccess = data.access_token;
          const newExpiry = new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString();

          await AsyncStorage.multiSet([
            [STORAGE_ACCESS_TOKEN_PREFIX + coachId, newAccess],
            [STORAGE_EXPIRY_PREFIX + coachId, newExpiry],
          ]);

          try {
            await supabase
              .from('coaches')
              .update({
                google_access_token: newAccess,
                google_token_expiry: newExpiry,
              })
              .eq('id', coachId);
          } catch {
            // ignore
          }

          return newAccess;
        }
      }

      return accessToken;
    } catch (e) {
      console.error('[GoogleMeet] Failed to get valid token:', e);
      return null;
    }
  }

  /**
   * Calls Google Meet REST API v2 to create a real meeting space.
   * Returns the official meetingUri (e.g. https://meet.google.com/abc-defg-hij).
   */
  async createMeetingSpace(coachId: string): Promise<string> {
    try {
      const token = await this.getValidToken(coachId);

      if (!token) {
        throw new Error('Google Meet is not connected. Please connect your account.');
      }

      console.log('[GoogleMeet] Creating space via Google Meet REST API v2...');
      const response = await fetch('https://meet.googleapis.com/v2/spaces', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      const spaceData = await response.json();

      if (!response.ok) {
        console.error('[GoogleMeet] Create space failed:', spaceData);
        if (
          response.status === 403 &&
          spaceData.error?.message?.toLowerCase().includes('insufficient authentication scopes')
        ) {
          console.warn('[GoogleMeet] Insufficient scope on cached token. Clearing stale token...');
          await this.disconnect(coachId);
          throw new Error('Google Meet permissions were not granted. Please reconnect Google Meet in your Profile and allow meeting permissions.');
        }
        throw new Error(spaceData.error?.message || 'Failed to create Google Meet space');
      }

      // Standard Google Meet v2 space structure includes meetingUri
      const meetUrl = spaceData.meetingUri || (spaceData.meetingCode ? `https://meet.google.com/${spaceData.meetingCode}` : null);

      if (!meetUrl) {
        throw new Error('No meetingUri returned by Google Meet API');
      }

      console.log('[GoogleMeet] Successfully created space:', meetUrl);
      return meetUrl;
    } catch (error: any) {
      console.error('[GoogleMeet] Error creating space:', error);
      throw error;
    }
  }
}

export const googleMeetService = new GoogleMeetService();

