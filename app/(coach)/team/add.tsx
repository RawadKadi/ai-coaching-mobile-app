import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { UserPlus, Mail, Search as SearchIcon, Check, Send, AlertTriangle } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useBrandColors } from '@/contexts/BrandContext';
import { supabase } from '@/lib/supabase';
import { sendSubCoachInvite } from '@/lib/brevo-service';
import { BrandedHeader } from '@/components/BrandedHeader';
import { BrandedButton } from '@/components/BrandedButton';

type SearchState = 'idle' | 'searching' | 'found' | 'not_found';

export default function AddSubCoachScreen() {
  const router = useRouter();
  const { coach } = useAuth();
  const { primary, secondary } = useBrandColors();
  
  const [email, setEmail] = useState('');
  const [searchState, setSearchState] = useState<SearchState>('idle');
  const [loading, setLoading] = useState(false);
  const [foundCoach, setFoundCoach] = useState<any>(null);

  const handleSearch = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter an email address');
      return;
    }

    setSearchState('searching');
    setFoundCoach(null);

    try {
      // 1. Search for coach by email using RPC
      const { data: searchResult, error: searchError } = await supabase
        .rpc('find_coach_by_email', { p_email: email.trim().toLowerCase() });

      console.log('[AddSubCoach] Search result:', searchResult);

      if (searchError) throw searchError;

      if (searchResult && searchResult.found) {
        setFoundCoach({
          id: searchResult.coach_id,
          full_name: searchResult.full_name,
          email: email.trim().toLowerCase()
        });
        setSearchState('found');
      } else {
        setSearchState('not_found');
      }
    } catch (error: any) {
      console.error('[AddSubCoach] Search error:', error);
      Alert.alert('Error', 'Failed to search for coach');
      setSearchState('idle');
    }
  };

  const sendInviteEmail = async (inviteData: any, isRegistered: boolean) => {
    setLoading(true);
    try {
      const emailResult = await sendSubCoachInvite({
        inviteEmail: inviteData.invite_email,
        inviteToken: inviteData.invite_token,
        parentCoachName: inviteData.parent_coach_name,
        expiresAt: inviteData.expires_at,
        isRegistered: isRegistered
      });

      if (!emailResult.success) {
        Alert.alert(
          'Invite Link Ready',
          'The invite link is valid, but the email failed to send. You can still share the link manually from the team management page.',
          [{ text: 'OK', onPress: () => router.back() }]
        );
      } else {
        Alert.alert(
          'Success! ✅',
          `An invitation has been sent to ${email.trim().toLowerCase()}. They will join your team as soon as they accept the invite.`,
          [{ text: 'Great!', onPress: () => router.back() }]
        );
      }
    } catch (error: any) {
      console.error('[AddSubCoach] Email error:', error);
      Alert.alert('Error', 'Failed to send invitation email');
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (isRegistered: boolean) => {
    setLoading(true);

    try {
      console.log('[AddSubCoach] Processing invite for:', email);

      // 1. Generate or Retrieve invite token via RPC
      const { data, error } = await supabase.rpc('generate_subcoach_invite', {
        p_parent_coach_id: coach?.id,
        p_invite_email: email.trim().toLowerCase(),
      });

      if (error) throw error;

      if (!data || !data.success) {
        throw new Error(data?.message || 'Failed to generate invite');
      }

      // 2. If an active invite already exists, prompt the user
      if (data.active_exists) {
        setLoading(false);
        Alert.alert(
          'Active Invite Exists',
          'An active invite already exists for this email. Do you want to resend it?',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Resend Invite', 
              onPress: () => sendInviteEmail(data, isRegistered) 
            }
          ]
        );
        return;
      }

      // 3. New invite - Send the email immediately
      await sendInviteEmail(data, isRegistered);
      
    } catch (error: any) {
      console.error('[AddSubCoach] Invite error:', error);
      Alert.alert('Error', error.message || 'Failed to process invitation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <BrandedHeader
        title="Add Sub-Coach"
        showBackButton
        onBackPress={() => router.back()}
      />

      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
        {/* Step 1: Search */}
        <View style={styles.instructionsCard}>
          <UserPlus size={24} color={primary} />
          <Text style={styles.instructionsTitle}>Invite a Team Member</Text>
          <Text style={styles.instructionsText}>
            Enter the email address of the coach you'd like to invite. 
            They will receive a secure link to join your coaching team.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Coach Email Address</Text>
          <View style={styles.searchContainer}>
            <Mail size={20} color="#9CA3AF" style={styles.searchIcon} />
            <TextInput
              style={styles.input}
              placeholder="coach@example.com"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (searchState !== 'idle') setSearchState('idle');
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholderTextColor="#9CA3AF"
              editable={!loading && searchState !== 'searching'}
            />
          </View>

          {searchState === 'idle' && (
            <BrandedButton
              title="Search Coach"
              variant="primary"
              onPress={handleSearch}
              icon={<SearchIcon size={20} color="#FFFFFF" />}
              style={styles.actionButton}
            />
          )}

          {searchState === 'searching' && (
            <View style={styles.statusContainer}>
              <ActivityIndicator size="small" color={primary} />
              <Text style={styles.statusText}>Checking database...</Text>
            </View>
          )}
        </View>

        {/* Step 2: Found Coach Flow */}
        {searchState === 'found' && foundCoach && (
          <View style={[styles.resultCard, { borderColor: secondary }]}>
            <View style={styles.resultHeader}>
              <View style={[styles.statusBadge, { backgroundColor: secondary }]}>
                <Check size={18} color="#FFFFFF" />
              </View>
              <Text style={styles.resultTitle}>Coach Found</Text>
            </View>
            
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{foundCoach.full_name}</Text>
              <Text style={styles.profileEmail}>{foundCoach.email}</Text>
              <View style={styles.infoRow}>
                <Check size={14} color="#10B981" />
                <Text style={styles.infoLabel}>Already registered on platform</Text>
              </View>
            </View>

            <BrandedButton
              title="Send Team Invite"
              variant="primary"
              onPress={() => handleInvite(true)}
              loading={loading}
              icon={<Send size={18} color="#FFFFFF" />}
              style={styles.actionButton}
            />
          </View>
        )}

        {/* Step 2: Not Found Flow */}
        {searchState === 'not_found' && (
          <View style={[styles.resultCard, { borderColor: '#F59E0B' }]}>
            <View style={styles.resultHeader}>
              <View style={[styles.statusBadge, { backgroundColor: '#F59E0B' }]}>
                <AlertTriangle size={18} color="#FFFFFF" />
              </View>
              <Text style={styles.resultTitle}>Email Not Registered</Text>
            </View>
            
            <Text style={styles.promptText}>
              This email isn't registered yet. Would you like to invite them to download the app and join your team?
            </Text>

            <BrandedButton
              title="Send Registration Invite"
              variant="primary"
              onPress={() => handleInvite(false)}
              loading={loading}
              icon={<Send size={18} color="#FFFFFF" />}
              style={styles.actionButton}
            />
          </View>
        )}

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>What happens next?</Text>
          <Text style={styles.infoText}>
            • The coach receives an invite email with a link{'\n'}
            • Tapping the link connects them to your brand{'\n'}
            • They automatically become a sub-coach in your team{'\n'}
            • You can then assign clients and collaborate
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  instructionsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginTop: 12,
    marginBottom: 8,
  },
  instructionsText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
    color: '#111827',
  },
  actionButton: {
    marginTop: 4,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  statusText: {
    marginLeft: 8,
    color: '#6B7280',
    fontSize: 14,
  },
  resultCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  resultTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  profileInfo: {
    marginBottom: 16,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 13,
    color: '#10B981',
    fontWeight: '500',
    marginLeft: 4,
  },
  promptText: {
    fontSize: 15,
    color: '#4B5563',
    lineHeight: 22,
    marginBottom: 20,
  },
  infoBox: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginBottom: 32,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E40AF',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: '#1E3A8A',
    lineHeight: 20,
  },
});
