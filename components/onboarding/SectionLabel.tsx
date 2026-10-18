import React from 'react';
import { View, Text } from 'react-native';

interface SectionLabelProps {
  step: string;
  title: string;
  desc: string;
}

export default function SectionLabel({ step, title, desc }: SectionLabelProps) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ color: '#3B82F6', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 3, marginBottom: 8 }}>
        {step}
      </Text>
      <Text style={{ color: '#FFFFFF', fontSize: 32, fontWeight: '900', letterSpacing: -0.5, lineHeight: 38 }}>
        {title}
      </Text>
      <Text style={{ color: '#94A3B8', fontSize: 15, fontWeight: '500', lineHeight: 22, marginTop: 8 }}>
        {desc}
      </Text>
    </View>
  );
}
