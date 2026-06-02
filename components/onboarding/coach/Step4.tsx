import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Animated, Easing, ActivityIndicator } from 'react-native';
import { CheckCircle, UserPlus, LayoutDashboard } from 'lucide-react-native';
import { useRouter } from 'expo-router';

interface Step4Props {
  coachName?: string;
}

export default function Step4({ coachName }: Step4Props) {
  const router = useRouter();
  
  const [itemsReady, setItemsReady] = useState([false, false, false]);
  const [allReady, setAllReady] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;
  const buttonsFadeAnim = useRef(new Animated.Value(0)).current;

  // Initial load-in animation
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, damping: 22, stiffness: 160, useNativeDriver: true }),
    ]).start();
  }, []);

  // Staggered loading sequence for checklist
  useEffect(() => {
    const sequence = async () => {
      // Small pause before starting
      await new Promise(r => setTimeout(r, 600));
      
      // Item 1
      setItemsReady(prev => [true, prev[1], prev[2]]);
      await new Promise(r => setTimeout(r, 800));
      
      // Item 2
      setItemsReady(prev => [prev[0], true, prev[2]]);
      await new Promise(r => setTimeout(r, 900));
      
      // Item 3
      setItemsReady(prev => [prev[0], prev[1], true]);
      await new Promise(r => setTimeout(r, 500));
      
      // Fade in buttons
      setAllReady(true);
      Animated.timing(buttonsFadeAnim, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
    };
    
    sequence();
  }, []);

  const checks = [
    {
      label: 'Brand Identity Set',
      sub: 'Your logo and name are live.',
    },
    {
      label: 'AI Trained',
      sub: 'Your specialties are loaded. AI will tailor tasks and challenges to your clients.',
    },
    {
      label: 'Calendar Live',
      sub: 'Your availability is saved and ready for bookings.',
    },
  ];

  const actions = [
    {
      icon: <UserPlus size={20} color="#FFFFFF" />,
      label: 'Invite a Client',
      sub: 'Add your first athlete',
      color: '#2563EB',
      onPress: () => router.replace('/(coach)/invite-client'),
    },
    {
      icon: <LayoutDashboard size={20} color="#FFFFFF" />,
      label: 'Go to Dashboard',
      sub: 'Start managing your workspace',
      color: '#0D9488',
      onPress: () => router.replace('/(coach)/(tabs)'),
    },
  ];

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }], gap: 36 }}>
      {/* Hero */}
      <View style={{ alignItems: 'center', gap: 20, paddingTop: 8 }}>
        <View
          style={{
            width: 88,
            height: 88,
            borderRadius: 30,
            backgroundColor: allReady ? 'rgba(37,99,235,0.12)' : 'rgba(15,23,42,0.5)',
            borderWidth: 2,
            borderColor: allReady ? 'rgba(59,130,246,0.3)' : '#1E293B',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {allReady ? (
            <CheckCircle size={44} color="#3B82F6" />
          ) : (
            <ActivityIndicator size="large" color="#3B82F6" />
          )}
        </View>

        <View style={{ alignItems: 'center', gap: 8 }}>
          <Text style={{ color: '#FFFFFF', fontSize: 30, fontWeight: '900', textAlign: 'center', letterSpacing: -0.5, lineHeight: 36 }}>
            Your Workspace{'\n'}is Ready
          </Text>
          {coachName ? (
            <Text style={{ color: '#64748B', fontSize: 15, fontWeight: '600', textAlign: 'center' }}>
              Welcome, {coachName} 👋
            </Text>
          ) : (
            <Text style={{ color: '#64748B', fontSize: 15, fontWeight: '600', textAlign: 'center' }}>
              Everything is set up for you.
            </Text>
          )}
        </View>
      </View>

      {/* Checklist */}
      <View style={{ gap: 10 }}>
        <Text style={{ color: '#475569', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 2.5, marginBottom: 4, paddingHorizontal: 4 }}>
          What's ready
        </Text>
        {checks.map((item, i) => {
          const isReady = itemsReady[i];
          
          return (
            <View
              key={i}
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: 14,
                backgroundColor: isReady ? '#060F1E' : '#020617',
                borderRadius: 20,
                padding: 18,
                borderWidth: 1,
                borderColor: isReady ? '#0F2040' : '#0F172A',
                opacity: isReady ? 1 : 0.6,
              }}
            >
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 11,
                  backgroundColor: isReady ? 'rgba(37,99,235,0.18)' : '#0F172A',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: 1,
                }}
              >
                {isReady ? (
                  <CheckCircle size={17} color="#3B82F6" />
                ) : (
                  <ActivityIndicator size="small" color="#475569" />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '800', marginBottom: 4 }}>
                  {isReady ? item.label : `Configuring ${item.label.toLowerCase()}...`}
                </Text>
                <Text style={{ color: '#64748B', fontSize: 13, fontWeight: '500', lineHeight: 19 }}>
                  {item.sub}
                </Text>
              </View>
            </View>
          );
        })}
      </View>

      {/* Action buttons (Fade in after sequence) */}
      <Animated.View style={{ gap: 10, opacity: buttonsFadeAnim, display: allReady ? 'flex' : 'none' }}>
        <Text style={{ color: '#475569', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 2.5, marginBottom: 4, paddingHorizontal: 4 }}>
          Get started
        </Text>
        {actions.map((action, i) => (
          <TouchableOpacity
            key={i}
            onPress={action.onPress}
            activeOpacity={0.8}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 16,
              backgroundColor: '#060F1E',
              borderRadius: 20,
              padding: 18,
              borderWidth: 1.5,
              borderColor: '#0F2040',
            }}
          >
            <View
              style={{
                width: 46,
                height: 46,
                borderRadius: 15,
                backgroundColor: action.color,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {action.icon}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '800' }}>
                {action.label}
              </Text>
              <Text style={{ color: '#64748B', fontSize: 13, fontWeight: '500', marginTop: 2 }}>
                {action.sub}
              </Text>
            </View>
            <Text style={{ color: '#1E3A5F', fontSize: 22, fontWeight: '300' }}>›</Text>
          </TouchableOpacity>
        ))}
      </Animated.View>

      <View style={{ height: 16 }} />
    </Animated.View>
  );
}
