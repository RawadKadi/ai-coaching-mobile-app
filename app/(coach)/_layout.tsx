import { View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import SessionMonitor from '@/components/SessionMonitor';
import TeamInvitationMonitor from '@/components/TeamInvitationMonitor';
import { UnassignedClientsBanner } from '@/components/UnassignedClientsBanner';

export default function CoachLayout() {
  const router = useRouter();
  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="team-welcome" options={{ presentation: 'modal' }} />
        <Stack.Screen name="challenges" />
        <Stack.Screen name="clients/[id]" />
      </Stack>
      
      <SessionMonitor router={router} />
      <TeamInvitationMonitor router={router} />
      <UnassignedClientsBanner router={router} />
    </View>
  );
}
