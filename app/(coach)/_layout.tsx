import { Stack } from 'expo-router';
import SessionMonitor from '@/components/SessionMonitor';
import TeamInvitationMonitor from '@/components/TeamInvitationMonitor';
import { UnassignedClientsBanner } from '@/components/UnassignedClientsBanner';

export default function CoachLayout() {
  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="team-welcome" options={{ presentation: 'modal' }} />
        <Stack.Screen name="challenges/suggest" />
        <Stack.Screen name="challenges/create" />
        <Stack.Screen name="challenges/review" />
        <Stack.Screen name="challenges/[id]" />
        <Stack.Screen name="clients/[id]" />
      </Stack>
      <SessionMonitor />
      <TeamInvitationMonitor />
      <UnassignedClientsBanner />
    </>
  );
}
