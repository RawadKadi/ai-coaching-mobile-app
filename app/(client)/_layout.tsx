import { Stack, useRouter } from 'expo-router';
import SessionMonitor from '@/components/SessionMonitor';

export default function ClientLayout() {
  const router = useRouter();
  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="challenges" />
      </Stack>
      
      <SessionMonitor router={router} />
    </>
  );
}
