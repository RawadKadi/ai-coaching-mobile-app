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
import { UserPlus, Mail, Search, Check } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useBrandColors } from '@/contexts/BrandContext';
import { supabase } from '@/lib/supabase';
import { BrandedHeader } from '@/components/BrandedHeader';
import { BrandedButton } from '@/components/BrandedButton';

export default function AddSubCoachScreen() {
  const router = useRouter();
  const { coach } = useAuth();
  const { primary, secondary } = useBrandColors();
  
  const [email, setEmail] = useState('');
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);
  const [foundCoach, setFoundCoach] = useState<any>(null);

  const handleSearch = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter an email address');
      return;
    }

    setSearching(true);
    setFoundCoach(null);

    try {
      // Search for coach by email
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('email', email.trim().toLowerCase())
        .eq('role', 'coach')
        .single();

      if (profileError || !profileData) {
        Alert.alert(
          'Not Found',
          'No coach account found with this email address. They need to create a coach account first.'
        );
        return;
      }

      // Get coach record
      const { data: coachData, error: coachError } = await supabase
        .from('coaches')
        .select('id, brand_id')
        .eq('user_id', profileData.id)
        .single();

      if (coachError || !coachData) {
        Alert.alert('Error', 'Failed to find coach record');
        return;
      }

      // Check if already linked
      const { data: existingLink, error: linkError } = await supabase
        .from('coach_hierarchy')
        .select('id')
        .eq('parent_coach_id', coach?.id)
        .eq('child_coach_id', coachData.id)
        .maybeSingle();

      if (existingLink) {
        Alert.alert('Already Added', 'This coach is already part of your team');
        return;
      }

      // Check if coach already has a different brand
      if (coachData.brand_id && coachData.brand_id !== coach?.brand_id) {
        Alert.alert(
          'Warning',
          'This coach is already part of another brand. Adding them will change their brand association.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Continue',
              onPress: () => {
                setFoundCoach({ ...profileData, coach_id: coachData.id });
              },
            },
          ]
        );
        return;
      }

      setFoundCoach({ ...profileData, coach_id: coachData.id });
    } catch (error) {
      console.error('[AddSubCoach] Search error:', error);
      Alert.alert('Error', 'Failed to search for coach');
    } finally {
      setSearching(false);
    }
  };

  const handleAdd = async () => {
    if (!foundCoach) return;

    setAdding(true);

    try {
      const { data, error } = await supabase.rpc('add_sub_coach', {
        p_parent_coach_id: coach?.id,
        p_child_coach_id: foundCoach.coach_id,
      });

      if (error) throw error;

      Alert.alert(
        'Success',
        `${foundCoach.full_name} has been added to your team!`,
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error) {
      console.error('[AddSubCoach] Add error:', error);
      Alert.alert('Error', 'Failed to add sub-coach. Please try again.');
    } finally {
      setAdding(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <BrandedHeader
        title="Add Sub-Coach"
        showBackButton
        onBackPress={() => router.back()}
      />

      <ScrollView style={styles.content}>
        {/* Instructions */}
        <View style={styles.instructionsCard}>
          <UserPlus size={24} color={primary} />
          <Text style={styles.instructionsTitle}>Add a Team Member</Text>
          <Text style={styles.instructionsText}>
            Enter the email address of an existing coach to add them to your team.
            They must already have a coach account.
          </Text>
        </View>

        {/* Search Form */}
        <View style={styles.section}>
          <Text style={styles.label}>Coach Email Address</Text>
          <View style={styles.searchContainer}>
            <Mail size={20} color="#9CA3AF" style={styles.searchIcon} />
            <TextInput
              style={styles.input}
              placeholder="coach@example.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <BrandedButton
            title="Search"
            variant="primary"
            onPress={handleSearch}
            loading={searching}
            disabled={!email.trim() || searching}
            icon={<Search size={20} color="#FFFFFF" />}
            style={styles.searchButton}
          />
        </View>

        {/* Found Coach Card */}
        {foundCoach && (
          <View style={[styles.foundCard, { borderColor: secondary }]}>
            <View style={styles.foundHeader}>
              <View style={[styles.checkIcon, { backgroundColor: secondary }]}>
                <Check size={20} color="#FFFFFF" />
              </View>
              <Text style={styles.foundTitle}>Coach Found!</Text>
            </View>

            <View style={styles.foundInfo}>
              <Text style={styles.foundName}>{foundCoach.full_name}</Text>
              <Text style={styles.foundEmail}>{foundCoach.email}</Text>
            </View>

            <BrandedButton
              title="Add to Team"
              variant="secondary"
              onPress={handleAdd}
              loading={adding}
              disabled={adding}
              icon={<UserPlus size={20} color="#FFFFFF" />}
              style={styles.addButton}
            />
          </View>
        )}

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>What happens next?</Text>
          <Text style={styles.infoText}>
            • The coach will be added to your team{'\n'}
            • They will inherit your brand settings{'\n'}
            • You can assign clients to them{'\n'}
            • They can only see their own clients
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
    marginBottom: 24,
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
    marginBottom: 24,
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
  searchButton: {
    marginTop: 4,
  },
  foundCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    borderWidth: 2,
  },
  foundHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  checkIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  foundTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  foundInfo: {
    marginBottom: 16,
  },
  foundName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  foundEmail: {
    fontSize: 14,
    color: '#6B7280',
  },
  addButton: {
    marginTop: 8,
  },
  infoBox: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#BFDBFE',
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
