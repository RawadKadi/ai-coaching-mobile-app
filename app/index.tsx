import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';

export default function Index() {
  const router = useRouter();
  const { session, profile, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (!session) {
        router.replace('/(auth)/login');
      } else if (profile) {
        switch (profile.role) {
          case 'client':
            router.replace('/(client)/(tabs)');
            break;
          case 'coach':
            router.replace('/(coach)/(tabs)');
            break;
          case 'admin':
            router.replace('/(admin)/(tabs)');
            break;
        }
      }
    }
  }, [loading, session, profile]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#3B82F6" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
});
