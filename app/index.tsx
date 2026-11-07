import { useBrand, useBrandColors } from '@/contexts/BrandContext';
import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { ClientDashboardSkeleton } from '@/components/ClientDashboardSkeleton';
import { CoachDashboardSkeleton } from '@/components/CoachDashboardSkeleton';

export default function Index() {
  const colors = useBrandColors();
  const { loading: brandLoading, isCacheHydrated } = useBrand();
  const styles = getStyles(colors);
  const router = useRouter();
  const { session, profile, loading } = useAuth();

  useEffect(() => {
    if (!loading && isCacheHydrated) {
      if (!session) {
        router.replace('/(auth)');
      } else if (profile) {
        if (brandLoading) return;
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
      } else {
        // Session exists but no profile - wait then redirect
        console.warn('[Index] Session exists but no profile loaded');
        const timeout = setTimeout(() => {
          router.replace('/(auth)');
        }, 2000);
        return () => clearTimeout(timeout);
      }
    }
  }, [loading, brandLoading, isCacheHydrated, session, profile]);

  if (profile?.role === 'coach') {
    return <CoachDashboardSkeleton />;
  }

  if (profile?.role === 'client') {
    return <ClientDashboardSkeleton />;
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background || '#010417',
  },
});
