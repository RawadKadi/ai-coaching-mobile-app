import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Animated, Easing, ActivityIndicator } from 'react-native';
import { CheckCircle, ChevronRight, LayoutDashboard } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface Step4Props {
  formData: any;
  updateForm: (key: string, value: any) => void;
}

export default function Step4({ formData }: Step4Props) {
  const router = useRouter();
  const { user } = useAuth();
  
  const [coachName, setCoachName] = useState<string>('your coach');
  const [phase, setPhase] = useState<number>(0);
  
  // Animations
  const p1Fade = useRef(new Animated.Value(0)).current;
  const p2Fade = useRef(new Animated.Value(0)).current;
  const p3Fade = useRef(new Animated.Value(0)).current;
  const welcomeFade = useRef(new Animated.Value(0)).current;
  const buttonFade = useRef(new Animated.Value(0)).current;

  // Spinners
  const s1Spin = useRef(new Animated.Value(0)).current;
  const s2Spin = useRef(new Animated.Value(0)).current;
  const s3Spin = useRef(new Animated.Value(0)).current;

  const startSpin = (anim: Animated.Value) => {
    Animated.loop(
      Animated.timing(anim, {
        toValue: 1,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  };

  const stopSpin = (anim: Animated.Value) => {
    anim.stopAnimation();
  };

  useEffect(() => {
    // Fetch coach name
    const fetchCoach = async () => {
      if (!user) return;
      const { data } = await supabase
        .from('coach_client_links')
        .select('coaches(profiles(full_name))')
        .eq('client_id', user.id)
        .eq('status', 'active')
        .single();
      
      const name = (data?.coaches as any)?.profiles?.full_name;
      if (name) setCoachName(name);
    };
    fetchCoach();
  }, [user]);

  useEffect(() => {
    // Phase 1: Profile Set
    Animated.timing(p1Fade, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    startSpin(s1Spin);
    
    setTimeout(() => {
      stopSpin(s1Spin);
      setPhase(1); // Checkmark 1
      
      // Phase 2: Health Guardrails
      setTimeout(() => {
        Animated.timing(p2Fade, { toValue: 1, duration: 400, useNativeDriver: true }).start();
        startSpin(s2Spin);
        
        setTimeout(() => {
          stopSpin(s2Spin);
          setPhase(2); // Checkmark 2
          
          // Phase 3: AI Coach Ready & Brand Synced
          setTimeout(() => {
            Animated.timing(p3Fade, { toValue: 1, duration: 400, useNativeDriver: true }).start();
            startSpin(s3Spin);
            
            setTimeout(() => {
              stopSpin(s3Spin);
              setPhase(3); // Checkmark 3
              
              // Phase 4: Welcome & Button
              setTimeout(() => {
                Animated.stagger(300, [
                  Animated.timing(welcomeFade, { toValue: 1, duration: 600, useNativeDriver: true }),
                  Animated.timing(buttonFade, { toValue: 1, duration: 600, useNativeDriver: true })
                ]).start();
              }, 400);

            }, 1500);
          }, 300);
        }, 1500);
      }, 300);
    }, 1500);
  }, []);

  const spin = (anim: Animated.Value) => anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  const renderRow = (label: string, fade: Animated.Value, spinAnim: Animated.Value, isDone: boolean) => (
    <Animated.View style={{ opacity: fade, flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: '#0F172A', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: isDone ? 'rgba(59,130,246,0.3)' : '#1E293B' }}>
      <View style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}>
        {isDone ? (
          <CheckCircle size={24} color="#3B82F6" weight="fill" />
        ) : (
          <Animated.View style={{ transform: [{ rotate: spin(spinAnim) }] }}>
            <ActivityIndicator size="small" color="#64748B" />
          </Animated.View>
        )}
      </View>
      <Text style={{ color: isDone ? '#FFFFFF' : '#94A3B8', fontSize: 16, fontWeight: '600' }}>{label}</Text>
    </Animated.View>
  );

  return (
    <View style={{ flex: 1, paddingTop: 20, gap: 16 }}>
      
      {renderRow('Profile Set', p1Fade, s1Spin, phase >= 1)}
      {renderRow('Health Guardrails Synced', p2Fade, s2Spin, phase >= 2)}
      {renderRow('AI Coach Ready', p3Fade, s3Spin, phase >= 3)}

      <Animated.View style={{ opacity: welcomeFade, marginTop: 32, alignItems: 'center', paddingVertical: 20 }}>
        <Text style={{ color: '#FFFFFF', fontSize: 24, fontWeight: '900', textAlign: 'center', marginBottom: 8 }}>
          🎉 You're in!
        </Text>
        <Text style={{ color: '#94A3B8', fontSize: 16, textAlign: 'center' }}>
          You've successfully joined {coachName}'s roster.
        </Text>
      </Animated.View>

      <Animated.View style={{ opacity: buttonFade, marginTop: 10 }}>
        <TouchableOpacity
          onPress={() => router.replace('/(client)/(tabs)')}
          style={{
            backgroundColor: '#2563EB',
            height: 64,
            borderRadius: 32,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 12,
            shadowColor: '#3B82F6',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.4,
            shadowRadius: 16,
            elevation: 10
          }}
        >
          <Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: 18 }}>Let's Go</Text>
          <ChevronRight size={22} color="#FFFFFF" />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}
