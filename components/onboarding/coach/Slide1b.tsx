import React from 'react';
import { View, Text } from 'react-native';
import { Image } from 'expo-image';
import { Star } from 'lucide-react-native';

interface Slide1bProps {
  formData: {
    logo_url: string;
    business_name: string;
  };
}

export default function Slide1b({ formData }: Slide1bProps) {
  const brandName = formData.business_name || 'Your Brand';
  const initial = brandName.charAt(0).toUpperCase();

  return (
    <View style={{ gap: 28 }}>
      {/* Heading */}
      <View style={{ gap: 8 }}>
        <Text style={{ color: '#3B82F6', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 3 }}>
          Brand Preview
        </Text>
        <Text style={{ color: '#FFFFFF', fontSize: 28, fontWeight: '900', letterSpacing: -0.5, lineHeight: 34 }}>
          How clients{'\n'}see you
        </Text>
        <Text style={{ color: '#64748B', fontSize: 15, fontWeight: '500', lineHeight: 22 }}>
          Your brand shows everywhere clients interact with you — home, messages, and challenges.
        </Text>
      </View>

      {/* Phone mockup */}
      <View style={{ backgroundColor: '#060F1E', borderRadius: 28, borderWidth: 1.5, borderColor: '#0F2040', overflow: 'hidden' }}>

        {/* App header */}
        <View style={{ paddingHorizontal: 18, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#0F2040' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {formData.logo_url ? (
              <Image
                source={{ uri: formData.logo_url }}
                style={{ width: 32, height: 32, borderRadius: 10 }}
                contentFit="cover"
              />
            ) : (
              <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: '#1E3A5F', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#3B82F6', fontSize: 14, fontWeight: '900' }}>{initial}</Text>
              </View>
            )}
            <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '800' }}>{brandName}</Text>
          </View>
          <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: '#0A1628', borderWidth: 1, borderColor: '#1E293B', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#475569', fontSize: 14 }}>👤</Text>
          </View>
        </View>

        {/* Client content */}
        <View style={{ padding: 18, gap: 14 }}>
          <View>
            <Text style={{ color: '#475569', fontSize: 12, fontWeight: '600' }}>Good morning</Text>
            <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '900' }}>Alex 👋</Text>
          </View>

          {/* Today's plan */}
          <View style={{ backgroundColor: '#0A1628', borderRadius: 18, padding: 14, borderWidth: 1, borderColor: '#1E293B' }}>
            <Text style={{ color: '#475569', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 10 }}>Today's Plan</Text>
            {[
              { label: 'Morning workout', done: true },
              { label: 'Track nutrition', done: false },
              { label: 'Evening stretch', done: false },
            ].map((item, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5 }}>
                <View style={{ width: 20, height: 20, borderRadius: 6, backgroundColor: item.done ? '#2563EB' : '#1E293B', alignItems: 'center', justifyContent: 'center', borderWidth: item.done ? 0 : 1, borderColor: '#334155' }}>
                  {item.done && <Text style={{ color: 'white', fontSize: 9, fontWeight: '900' }}>✓</Text>}
                </View>
                <Text style={{ color: item.done ? '#475569' : '#94A3B8', fontSize: 12, fontWeight: '600', textDecorationLine: item.done ? 'line-through' : 'none' }}>
                  {item.label}
                </Text>
              </View>
            ))}
          </View>

          {/* Challenge card */}
          <View style={{ backgroundColor: 'rgba(37,99,235,0.08)', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: 'rgba(59,130,246,0.2)', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Text style={{ fontSize: 22 }}>⚡</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#3B82F6', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 }}>Active Challenge</Text>
              <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '800', marginTop: 2 }}>7-Day Strength</Text>
              <Text style={{ color: '#475569', fontSize: 11, fontWeight: '500' }}>Day 3 of 7</Text>
            </View>
          </View>

          {/* Powered by */}
          <View style={{ alignItems: 'center', paddingTop: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#0A1628', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#1E293B' }}>
              {formData.logo_url ? (
                <Image source={{ uri: formData.logo_url }} style={{ width: 14, height: 14, borderRadius: 4 }} contentFit="cover" />
              ) : (
                <View style={{ width: 14, height: 14, borderRadius: 4, backgroundColor: '#1E3A5F', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: '#3B82F6', fontSize: 8, fontWeight: '900' }}>{initial}</Text>
                </View>
              )}
              <Text style={{ color: '#475569', fontSize: 11, fontWeight: '600' }}>
                Powered by <Text style={{ color: '#64748B', fontWeight: '800' }}>{brandName}</Text>
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Note */}
      <View style={{ flexDirection: 'row', gap: 12, backgroundColor: 'rgba(37,99,235,0.07)', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: 'rgba(59,130,246,0.15)' }}>
        <View style={{ marginTop: 1 }}>
          <Star size={17} color="#3B82F6" />
        </View>
        <Text style={{ flex: 1, color: '#64748B', fontSize: 13, fontWeight: '500', lineHeight: 20 }}>
          Every screen your client sees carries your brand identity — consistent and professional from day one.
        </Text>
      </View>
    </View>
  );
}
