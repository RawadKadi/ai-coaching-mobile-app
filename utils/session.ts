import { Alert, Linking } from 'react-native';

/**
 * Generates a clean default Google Meet URL (https://meet.google.com/new).
 * Google Meet creates live meeting rooms on-demand via /new.
 */
export function generateGoogleMeetUrl(): string {
  return 'https://meet.google.com/new';
}

/**
 * Validates and opens a Google Meet session link via external deep linking.
 * - If a custom valid Google Meet URL is stored (e.g. https://meet.google.com/abc-defg-hij), opens that meeting room.
 * - If missing, legacy, or unformatted, opens https://meet.google.com/new to launch an instant meeting cleanly without "No such meeting" errors.
 */
export async function joinSession(meetingUrl?: string | null, sessionId?: string) {
  let targetUrl = meetingUrl ? meetingUrl.trim() : '';

  // Filter out empty URLs, legacy deep links, or dummy internal placeholders
  if (
    !targetUrl ||
    targetUrl.startsWith('coachingapp://') ||
    targetUrl.includes('jit.si') ||
    targetUrl.includes('pending')
  ) {
    targetUrl = 'https://meet.google.com/new';
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
