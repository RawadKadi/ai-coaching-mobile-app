import { Stack } from 'expo-router';
import SessionMonitor from '@/components/SessionMonitor';
import TeamInvitationMonitor from '@/components/TeamInvitationMonitor';

export default function CoachLayout() {
  return (
    <>
      <SessionMonitor />
      <TeamInvitationMonitor />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="team-welcome" options={{ presentation: 'modal' }} />
      </Stack>
    </>
  );
}
