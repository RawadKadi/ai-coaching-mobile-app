import { Alert, Linking } from 'react-native';
import { googleMeetService } from '@/lib/google-meet-service';
import { supabase } from '@/lib/supabase';

/**
 * Creates a real Google Meet space using Google Meet REST API v2 if connected,
 * or returns a direct meeting launcher URL (https://meet.google.com/new).
 */
export async function createSessionMeetLink(coachId?: string): Promise<string> {
  if (coachId) {
    try {
      const isConnected = await googleMeetService.isConnected({ id: coachId } as any);
      if (isConnected) {
        const spaceUrl = await googleMeetService.createMeetingSpace(coachId);
        if (spaceUrl) return spaceUrl;
      }
    } catch (e) {
      console.warn('[Session] Failed to auto-create Google Meet space:', e);
    }
  }
  return 'https://meet.google.com/new';
}

/**
 * Default generator (synchronous fallback that launches a new call directly)
 */
export function generateGoogleMeetUrl(): string {
  return 'https://meet.google.com/new';
}

/**
 * Validates and opens a Google Meet session link via external deep linking.
 * - If a specific meeting room URL is stored (e.g. https://meet.google.com/abc-defg-hij), opens that room.
 * - If a generic link was stored (https://meet.google.com), upgrades it to https://meet.google.com/new
 *   so the user is directly placed into a call instead of an empty home screen.
 */
export async function joinSession(
  meetingUrl?: string | null,
  sessionId?: string,
  coachId?: string
) {
  let targetUrl = meetingUrl ? meetingUrl.trim() : '';

  // Filter out empty URLs, legacy deep links, or dummy internal placeholders
  if (
    !targetUrl ||
    targetUrl.startsWith('coachingapp://') ||
    targetUrl.includes('pending')
  ) {
    targetUrl = 'https://meet.google.com/new';
  } else if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    targetUrl = `https://${targetUrl}`;
  }

  // If the link is the bare homepage without a meeting room code, upgrade to instant room
  const isBareHome =
    targetUrl === 'https://meet.google.com' ||
    targetUrl === 'https://meet.google.com/' ||
    targetUrl === 'http://meet.google.com' ||
    targetUrl === 'http://meet.google.com/';

  if (isBareHome) {
    // Attempt on-demand space creation if coachId is available
    if (coachId) {
      try {
        const spaceUrl = await googleMeetService.createMeetingSpace(coachId);
        if (spaceUrl) {
          targetUrl = spaceUrl;
        }
      } catch (err) {
        console.warn('[Session] On-demand space creation fallback to /new:', err);
        targetUrl = 'https://meet.google.com/new';
      }
    } else {
      targetUrl = 'https://meet.google.com/new';
    }

    // Persist upgraded link in DB so subsequent joins use the valid call link
    if (sessionId) {
      supabase
        .from('sessions')
        .update({ meet_link: targetUrl })
        .eq('id', sessionId)
        .then(() => {});
    }
  }

  try {
    const canOpen = await Linking.canOpenURL(targetUrl);
    if (canOpen) {
      await Linking.openURL(targetUrl);
    } else {
      await Linking.openURL(targetUrl);
    }
  } catch (error) {
    console.error('Failed to open Google Meet URL:', error);
    Alert.alert(
      'Link Not Available',
      'Google Meet link not available. Please contact your coach.'
    );
  }
}
