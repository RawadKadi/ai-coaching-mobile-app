import React from 'react';
import { View, Text } from 'react-native';
import { Brain, Zap, Target } from 'lucide-react-native';

interface Slide2bProps {
  formData: {
    specialty: string[];
    otherSpecialty?: string;
  };
}

export default function Slide2b({ formData }: Slide2bProps) {
  // Grab the first specialty to use in the example (or fallback)
  let firstSpecialty = formData.specialty?.[0] || 'Fitness';
  if (firstSpecialty === 'Other' && formData.otherSpecialty) {
    firstSpecialty = formData.otherSpecialty;
  }
  
  // Format the text so it fits the sentence nicely
  const specLabel = firstSpecialty.toLowerCase().includes('coaching') 
    ? firstSpecialty 
    : `${firstSpecialty} coaching`;

  return (
    <View style={{ gap: 28 }}>
      {/* Heading */}
      <View style={{ gap: 8 }}>
        <Text style={{ color: '#7C3AED', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 3 }}>
          AI Brain Active
        </Text>
        <Text style={{ color: '#FFFFFF', fontSize: 28, fontWeight: '900', letterSpacing: -0.5, lineHeight: 34 }}>
          Supercharged{'\n'}challenges
        </Text>
        <Text style={{ color: '#64748B', fontSize: 15, fontWeight: '500', lineHeight: 22 }}>
          Your AI Brain is now tuned for <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>{specLabel}</Text>. It can instantly generate targeted challenges for your clients.
        </Text>
      </View>

      {/* Visual representation */}
      <View style={{ backgroundColor: '#060F1E', borderRadius: 28, borderWidth: 1.5, borderColor: '#0F2040', overflow: 'hidden' }}>
        
        {/* Mock Prompt area */}
        <View style={{ padding: 20, borderBottomWidth: 1, borderBottomColor: '#0F2040', backgroundColor: '#0A1628' }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
            <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(124,58,237,0.15)', alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
              <Brain size={16} color="#A78BFA" />
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={{ color: '#94A3B8', fontSize: 13, fontWeight: '600' }}>You</Text>
              <Text style={{ color: '#E2E8F0', fontSize: 15, lineHeight: 22 }}>
                "Create a 7-day challenge for a beginner client focusing on {firstSpecialty.toLowerCase()}"
              </Text>
            </View>
          </View>
        </View>

        {/* Mock Generation Result */}
        <View style={{ padding: 20, gap: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Zap size={14} color="#7C3AED" />
            <Text style={{ color: '#A78BFA', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 }}>AI Generated Challenge</Text>
          </View>
          
          <View style={{ backgroundColor: 'rgba(124,58,237,0.08)', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(124,58,237,0.2)' }}>
            <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '800', marginBottom: 12 }}>
              The Foundation Week
            </Text>
            
            <View style={{ gap: 10 }}>
              {[
                { day: 'Day 1', desc: 'Baseline assessment & simple habit' },
                { day: 'Day 2', desc: 'Core fundamentals introduction' },
                { day: 'Day 3', desc: 'Active recovery and mobility' },
              ].map((item, i) => (
                <View key={i} style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ width: 44, paddingVertical: 4, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 6, alignItems: 'center' }}>
                    <Text style={{ color: '#A78BFA', fontSize: 10, fontWeight: '700' }}>{item.day}</Text>
                  </View>
                  <Text style={{ color: '#CBD5E1', fontSize: 13, flex: 1, marginTop: 2 }}>{item.desc}</Text>
                </View>
              ))}
              <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 4 }}>
                <Text style={{ color: '#64748B', fontSize: 12, fontWeight: '600' }}>+ 4 more days</Text>
              </View>
            </View>
          </View>
        </View>
      </View>

    </View>
  );
}
