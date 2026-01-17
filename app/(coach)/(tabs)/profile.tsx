import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useBrand, useTheme } from '@/contexts/BrandContext';
import { LogOut, User, Settings, Brain, Palette, Users, UserPlus, Link } from 'lucide-react-native';

export default function CoachProfileScreen() {
  const router = useRouter();
  const { profile, signOut, coach } = useAuth();
  const { brand, canManageBrand } = useBrand();
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
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Profile</Text>
      </View>

      <View style={styles.content}>
        <View style={[styles.profileCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <View style={styles.avatarContainer}>
            <User size={48} color={theme.colors.primary} />
          </View>
          <Text style={[styles.name, { color: theme.colors.text }]}>{profile?.full_name}</Text>
          <Text style={[styles.role, { color: theme.colors.textSecondary }]}>Coach Account</Text>
        </View>

        <View style={[styles.menuSection, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <TouchableOpacity style={[styles.menuItem, { borderBottomColor: theme.colors.border }]} onPress={() => router.push('/(coach)/settings')}>
            <Settings size={20} color={theme.colors.textSecondary} />
            <Text style={[styles.menuItemText, { color: theme.colors.text }]}>Settings</Text>
          </TouchableOpacity>

          {/* Team Management - Only for parent coaches */}
          {coach?.is_parent_coach && (
            <TouchableOpacity 
              style={[styles.menuItem, { borderBottomColor: theme.colors.border }]} 
              onPress={() => router.push('/(coach)/team')}
            >
              <Users size={20} color={theme.colors.secondary} />
              <Text style={[styles.menuItemText, { color: theme.colors.text }]}>
                Team Management
                <Text style={styles.parentBadge}> • Parent</Text>
              </Text>
            </TouchableOpacity>
          )}

          {/* Invite Client - For all coaches */}
          <TouchableOpacity 
            style={[styles.menuItem, { borderBottomColor: theme.colors.border }]} 
            onPress={() => router.push('/(coach)/invite-client')}
          >
            <UserPlus size={20} color={theme.colors.accent} />
            <Text style={[styles.menuItemText, { color: theme.colors.text }]}>Invite Client</Text>
          </TouchableOpacity>

          {/* TEST: Deep Link Tester (Remove after testing) */}
          {/* <TouchableOpacity 
            style={[styles.menuItem, { backgroundColor: '#FFF7ED' }]} 
            onPress={() => router.push('/(coach)/test-deeplink')}
          >
            <Link size={20} color="#F97316" />
            <Text style={[styles.menuItemText, { color: '#F97316' }]}>
              🧪 Test Deep Links
            </Text>
          </TouchableOpacity> */}

          <TouchableOpacity style={[styles.menuItem, { borderBottomColor: theme.colors.border }]} onPress={handleSignOut}>
            <LogOut size={20} color={theme.colors.error} />
            <Text style={[styles.menuItemText, { color: theme.colors.error }]}>
              Sign Out
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 24,
    paddingTop: 60,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  content: {
    padding: 16,
  },
  profileCard: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: 16,
  },
  avatarContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  name: {
    fontSize: 24,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  role: {
    fontSize: 14,
    color: '#6B7280',
  },
  menuSection: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  menuItemText: {
    fontSize: 16,
    color: '#111827',
  },
  badgeText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '600',
  },
  parentBadge: {
    fontSize: 12,
    color: '#3B82F6',
    fontWeight: '600',
  },
  aiBrainText: {
    color: '#8B5CF6',
  },
  signOutText: {
    color: '#EF4444',
  },
});
