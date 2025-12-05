import { Stack } from 'expo-router';
import SessionMonitor from '@/components/SessionMonitor';

export default function ClientLayout() {
  return (
    <>
      <SessionMonitor />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  );
}
