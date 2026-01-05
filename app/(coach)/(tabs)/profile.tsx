import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useBrand } from '@/contexts/BrandContext';
import { LogOut, User, Settings, Brain, Palette, Users, UserPlus } from 'lucide-react-native';

export default function CoachProfileScreen() {
  const router = useRouter();
  const { profile, signOut, coach } = useAuth();
  const { brand, canManageBrand } = useBrand();

  const handleSignOut = async () => {
    try {
      await signOut();
      router.replace('/(auth)/login');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <User size={48} color="#3B82F6" />
          </View>
          <Text style={styles.name}>{profile?.full_name}</Text>
          <Text style={styles.role}>Coach Account</Text>
        </View>

        <View style={styles.menuSection}>
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/(coach)/settings')}>
            <Settings size={20} color="#6B7280" />
            <Text style={styles.menuItemText}>Settings</Text>
          </TouchableOpacity>

          {/* Brand Settings - Only show if coach has brand_id or can manage brand */}
          {(coach?.brand_id || coach?.can_manage_brand) && (
            <TouchableOpacity 
              style={styles.menuItem} 
              onPress={() => router.push('/(coach)/settings/branding')}
            >
              <Palette size={20} color="#F59E0B" />
              <Text style={styles.menuItemText}>
                Brand Settings
                {canManageBrand && <Text style={styles.badgeText}> • Manage</Text>}
              </Text>
            </TouchableOpacity>
          )}

          {/* Team Management - Only for parent coaches */}
          {coach?.is_parent_coach && (
            <TouchableOpacity 
              style={styles.menuItem} 
              onPress={() => router.push('/(coach)/team')}
            >
              <Users size={20} color="#10B981" />
              <Text style={styles.menuItemText}>
                Team Management
                <Text style={styles.parentBadge}> • Parent</Text>
              </Text>
            </TouchableOpacity>
          )}

          {/* Invite Client - For all coaches */}
          <TouchableOpacity 
            style={styles.menuItem} 
            onPress={() => router.push('/(coach)/invite-client')}
          >
            <UserPlus size={20} color="#8B5CF6" />
            <Text style={styles.menuItemText}>Invite Client</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/(coach)/(tabs)/ai-brain')}>
            <Brain size={20} color="#8B5CF6" />
            <Text style={[styles.menuItemText, styles.aiBrainText]}>AI Brain</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={handleSignOut}>
            <LogOut size={20} color="#EF4444" />
            <Text style={[styles.menuItemText, styles.signOutText]}>
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
    backgroundColor: '#F9FAFB',
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
  },
  content: {
    padding: 16,
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
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
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
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
