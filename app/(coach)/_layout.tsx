import { Stack } from 'expo-router';
import SessionMonitor from '@/components/SessionMonitor';

export default function CoachLayout() {
  return (
    <>
      <SessionMonitor />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  );
}
