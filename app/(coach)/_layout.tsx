import { Stack } from 'expo-router';

export default function CoachLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="team-welcome" options={{ presentation: 'modal' }} />
      <Stack.Screen name="challenges/suggest" />
      <Stack.Screen name="challenges/create" />
      <Stack.Screen name="challenges/review" />
      <Stack.Screen name="challenges/[id]" />
      <Stack.Screen name="clients/[id]" />
    </Stack>
  );
}
