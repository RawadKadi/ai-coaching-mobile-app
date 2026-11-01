import { Alert, Linking } from 'react-native';
import { googleMeetService } from '@/lib/google-meet-service';

/**
 * Creates a real Google Meet space using Google Meet REST API v2 if connected,
 * or returns a fallback Google Meet URL.
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
  return 'https://meet.google.com';
}

/**
 * Default generator (synchronous fallback)
 */
export function generateGoogleMeetUrl(): string {
  return 'https://meet.google.com';
}

/**
 * Validates and opens a Google Meet session link via external deep linking.
 * - If a custom valid Google Meet URL is stored (e.g. https://meet.google.com/abc-defg-hij), opens that meeting room.
 */
export async function joinSession(meetingUrl?: string | null, sessionId?: string) {
  let targetUrl = meetingUrl ? meetingUrl.trim() : '';

  // Filter out empty URLs, legacy deep links, or dummy internal placeholders
  if (
    !targetUrl ||
    targetUrl.startsWith('coachingapp://') ||
    targetUrl.includes('pending')
  ) {
    targetUrl = 'https://meet.google.com';
  } else if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    targetUrl = `https://${targetUrl}`;
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
