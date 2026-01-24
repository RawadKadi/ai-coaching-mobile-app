import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/BrandContext';
import { LogOut, User, Settings } from 'lucide-react-native';
import { BrandedText } from '@/components/BrandedText';
import { BrandedCard } from '@/components/BrandedCard';
import { BrandedAvatar } from '@/components/BrandedAvatar';

export default function ProfileScreen() {
  const router = useRouter();
  const { profile, signOut } = useAuth();
  const theme = useTheme();

  const handleSignOut = async () => {
    try {
      await signOut();
      router.replace('/(auth)/login');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View 
        style={[
          styles.header, 
          { 
            backgroundColor: theme.colors.surface,
            borderBottomColor: theme.colors.border,
            paddingHorizontal: 24 * theme.spacing.scale,
            paddingTop: 60 * theme.spacing.scale,
            paddingBottom: 24 * theme.spacing.scale,
          }
        ]}
      >
        <BrandedText variant="xxl" weight="heading">Profile</BrandedText>
      </View>

      <View style={[styles.content, { padding: 16 * theme.spacing.scale }]}>
        <BrandedCard variant="elevated" style={styles.profileCard}>
          <BrandedAvatar 
            name={profile?.full_name || 'User'} 
            size={96}
            useBrandColor={true}
          />
          <BrandedText variant="xl" weight="heading" style={styles.name}>
            {profile?.full_name}
          </BrandedText>
          <BrandedText variant="sm" color="secondary">
            Client Account
          </BrandedText>
        </BrandedCard>

        <BrandedCard variant="elevated" style={styles.menuSection}>
          <TouchableOpacity style={[styles.menuItem, { borderBottomColor: theme.colors.surfaceAlt }]}>
            <Settings size={20} color={theme.colors.textSecondary} />
            <BrandedText variant="base" style={styles.menuItemText}>
              Settings
            </BrandedText>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={handleSignOut}>
            <LogOut size={20} color={theme.colors.error} />
            <BrandedText variant="base" color="error" style={styles.menuItemText}>
              Sign Out
            </BrandedText>
          </TouchableOpacity>
        </BrandedCard>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    borderBottomWidth: 1,
  },
  content: {
  },
  profileCard: {
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  name: {
    marginBottom: 4,
    marginTop: 16,
  },
  menuSection: {
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
    borderBottomWidth: 1,
  },
  menuItemText: {
    flex: 1,
  },
});
