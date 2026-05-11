import { router } from 'expo-router';

/**
 * Safely navigates back or goes to the root/dashboard if no history exists.
 * Prevents the "GO_BACK not handled" warning/error.
 */
export const safeBack = (fallbackPath: string = '/') => {
  if (router.canGoBack()) {
    router.back();
  } else {
    // If we can't go back, navigate to the fallback (usually dashboard)
    router.replace(fallbackPath as any);
  }
};
