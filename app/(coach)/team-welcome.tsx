import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { UserPlus, Check } from 'lucide-react-native';
import { useBrandColors } from '@/contexts/BrandContext';
import { supabase } from '@/lib/supabase';

export default function TeamWelcomeScreen() {
  const router = useRouter();
  const { primary, secondary } = useBrandColors();
  const params = useLocalSearchParams();
  
  const parentCoachName = params.parentCoachName as string || 'Your Coach';
  const hierarchyId = params.hierarchyId as string;

  const handleContinue = async () => {
    // Mark as acknowledged in database
    if (hierarchyId) {
      await supabase
        .from('coach_hierarchy')
        .update({ acknowledged_at: new Date().toISOString() })
        .eq('id', hierarchyId);
    }

    // Navigate to dashboard
    router.replace('/(coach)/(tabs)');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Success Icon */}
        <View style={[styles.iconContainer, { backgroundColor: `${secondary}15` }]}>
          <View style={[styles.iconCircle, { backgroundColor: secondary }]}>
            <UserPlus size={48} color="#FFFFFF" />
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>Welcome to the Team! 🎉</Text>

        {/* Message */}
        <Text style={styles.message}>
          You've been added to{' '}
          <Text style={[styles.coachName, { color: primary }]}>
            {parentCoachName}'s
          </Text>
          {' '}coaching team!
        </Text>

        {/* Info Card */}
        <View style={[styles.infoCard, { borderColor: `${primary}30` }]}>
          <View style={styles.infoRow}>
            <Check size={20} color={secondary} />
            <Text style={styles.infoText}>
              You now have access to their brand and resources
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Check size={20} color={secondary} />
            <Text style={styles.infoText}>
              Clients can be assigned to you
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Check size={20} color={secondary} />
            <Text style={styles.infoText}>
              You can manage your own client list
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Check size={20} color={secondary} />
            <Text style={styles.infoText}>
              Your branding has been synchronized
            </Text>
          </View>
        </View>

        {/* Continue Button */}
        <TouchableOpacity
          style={[styles.button, { backgroundColor: primary }]}
          onPress={handleContinue}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>Continue to Dashboard</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 16,
  },
  message: {
    fontSize: 17,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
    paddingHorizontal: 16,
  },
  coachName: {
    fontWeight: '700',
  },
  infoCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    marginBottom: 32,
    borderWidth: 1,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  infoText: {
    fontSize: 15,
    color: '#374151',
    marginLeft: 12,
    flex: 1,
    lineHeight: 22,
  },
  button: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
});
