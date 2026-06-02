import React from 'react';
import { View, Text } from 'react-native';
import { Settings, Palette, Type } from 'lucide-react-native';

export default function Slide1c() {
  return (
    <View style={{ gap: 28 }}>
      {/* Heading */}
      <View style={{ gap: 8 }}>
        <Text style={{ color: '#3B82F6', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 3 }}>
          Brand Settings
        </Text>
        <Text style={{ color: '#FFFFFF', fontSize: 28, fontWeight: '900', letterSpacing: -0.5, lineHeight: 34 }}>
          Make it{'\n'}yours later
        </Text>
        <Text style={{ color: '#64748B', fontSize: 15, fontWeight: '500', lineHeight: 22 }}>
          You can always fine-tune your brand identity from the app settings once you're inside.
        </Text>
      </View>

      {/* Visual Guide */}
      <View style={{ gap: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: '#060F1E', padding: 20, borderRadius: 20, borderWidth: 1, borderColor: '#0F2040' }}>
          <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(59,130,246,0.1)', alignItems: 'center', justifyContent: 'center' }}>
            <Palette size={22} color="#3B82F6" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>Custom Colors</Text>
            <Text style={{ color: '#64748B', fontSize: 13, fontWeight: '500', marginTop: 2 }}>Match your exact brand palette</Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: '#060F1E', padding: 20, borderRadius: 20, borderWidth: 1, borderColor: '#0F2040' }}>
          <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(124,58,237,0.1)', alignItems: 'center', justifyContent: 'center' }}>
            <Type size={22} color="#7C3AED" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>Typography</Text>
            <Text style={{ color: '#64748B', fontSize: 13, fontWeight: '500', marginTop: 2 }}>Choose fonts that fit your vibe</Text>
          </View>
        </View>
        
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: '#060F1E', padding: 20, borderRadius: 20, borderWidth: 1, borderColor: '#0F2040' }}>
          <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(16,185,129,0.1)', alignItems: 'center', justifyContent: 'center' }}>
            <Settings size={22} color="#10B981" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>Brand Assets</Text>
            <Text style={{ color: '#64748B', fontSize: 13, fontWeight: '500', marginTop: 2 }}>Update logos and cover images</Text>
          </View>
        </View>
      </View>
    </View>
  );
}
