import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { UserPlus, CheckCircle, ChevronRight } from 'lucide-react-native';
import { useBrandColors } from '@/contexts/BrandContext';
import { supabase } from '@/lib/supabase';
import { BrandedButton } from '@/components/BrandedButton';

export default function TeamWelcomeScreen() {
  const router = useRouter();
  const { primary } = useBrandColors();
  const params = useLocalSearchParams();
  
  const parentCoachName = params.parentCoachName as string || 'Your Coach';
  const hierarchyId = params.hierarchyId as string;

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, damping: 22, stiffness: 160, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleContinue = async () => {
    if (hierarchyId) {
      await supabase
        .from('coach_hierarchy')
        .update({ acknowledged_at: new Date().toISOString() })
        .eq('id', hierarchyId);
    }
    router.replace('/(coach)/(tabs)');
  };

  const checks = [
    {
      label: 'Shared Content',
      sub: "Access your team's programs and tasks.",
    },
    {
      label: 'Client Management',
      sub: 'Manage assigned clients in your workspace.',
    },
    {
      label: 'Brand Synced',
      sub: 'Your branding automatically matches the team.',
    },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: '#020617' }}>
      <SafeAreaView style={{ flex: 1 }}>
        <Animated.View style={{ flex: 1, opacity: fadeAnim, transform: [{ translateY: slideAnim }], paddingHorizontal: 24, justifyContent: 'center', gap: 36 }}>
          
          {/* Hero */}
          <View style={{ alignItems: 'center', gap: 20 }}>
            <View
              style={{
                width: 88,
                height: 88,
                borderRadius: 30,
                backgroundColor: 'rgba(37,99,235,0.12)',
                borderWidth: 2,
                borderColor: 'rgba(59,130,246,0.3)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <UserPlus size={44} color={primary} />
            </View>

            <View style={{ alignItems: 'center', gap: 8 }}>
              <Text style={{ color: '#FFFFFF', fontSize: 30, fontWeight: '900', textAlign: 'center', letterSpacing: -0.5, lineHeight: 36 }}>
                Welcome to{'\n'}the Team 🎉
              </Text>
              <Text style={{ color: '#64748B', fontSize: 15, fontWeight: '500', textAlign: 'center', lineHeight: 22 }}>
                You've been added to <Text style={{ color: primary || '#FFFFFF', fontWeight: '800' }}>{parentCoachName}'s</Text> coaching roster!
              </Text>
            </View>
          </View>

          {/* Checklist */}
          <View style={{ gap: 10 }}>
            <Text style={{ color: '#475569', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 2.5, marginBottom: 4, paddingHorizontal: 4 }}>
              What this means
            </Text>
            {checks.map((item, i) => (
              <View
                key={i}
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: 14,
                  backgroundColor: '#060F1E',
                  borderRadius: 20,
                  padding: 18,
                  borderWidth: 1,
                  borderColor: '#0F2040',
                }}
              >
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 11,
                    backgroundColor: 'rgba(37,99,235,0.18)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: 1,
                  }}
                >
                  <CheckCircle size={17} color={primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '800', marginBottom: 4 }}>
                    {item.label}
                  </Text>
                  <Text style={{ color: '#64748B', fontSize: 13, fontWeight: '500', lineHeight: 19 }}>
                    {item.sub}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          {/* Spacer */}
          <View style={{ flex: 1, maxHeight: 20 }} />

          {/* Action button */}
          <View style={{ paddingBottom: 20 }}>
            <BrandedButton
              title="Continue to Dashboard"
              onPress={handleContinue}
              icon={<ChevronRight size={20} color="#FFFFFF" />}
              style={{
                flexDirection: 'row-reverse',
                borderRadius: 20,
                paddingVertical: 18,
                borderWidth: 1.5,
                borderColor: 'rgba(255,255,255,0.1)',
                backgroundColor: primary || primary,
              }}
              textStyle={{ fontSize: 17, fontWeight: '800' }}
            />
          </View>
          
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}
