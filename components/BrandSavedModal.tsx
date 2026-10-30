import React from 'react';
import { View } from 'react-native';
import FeedbackModal from '@/components/FeedbackModal';
import { useBrand, useBrandColors } from '@/contexts/BrandContext';
import { Palette, Check } from 'lucide-react-native';
import { isDarkColor } from '@/lib/theme-utils';

export default function BrandSavedModal() {
  const { showBrandSavedModal, setShowBrandSavedModal } = useBrand();
  const colors = useBrandColors();
  const isDark = isDarkColor(colors.surface || colors.background || '#010417');
  const modalBg = colors.surface || (isDark ? '#0f172a' : '#ffffff');
  const primaryColor = colors.primary || '#7FA7FF';

  return (
    <FeedbackModal
      visible={showBrandSavedModal}
      onClose={() => setShowBrandSavedModal(false)}
      variant="success"
      accentColor={primaryColor}
      accentBg={isDark ? `${primaryColor}22` : `${primaryColor}15`}
      accentBorder={isDark ? `${primaryColor}44` : `${primaryColor}30`}
      icon={
        <View style={{ position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
          <Palette size={48} color={primaryColor} />
          <View
            style={{
              position: 'absolute',
              bottom: -4,
              right: -6,
              width: 24,
              height: 24,
              borderRadius: 12,
              backgroundColor: '#10B981',
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 2,
              borderColor: modalBg,
            }}
          >
            <Check size={14} color="#FFFFFF" strokeWidth={3} />
          </View>
        </View>
      }
      title="Brand Updated"
      body="Your brand changes are saved. Your clients now see your new colors and style."
      ctaLabel="Got it"
      ctaBg={primaryColor}
    />
  );
}
