import React from 'react';
import { View } from 'react-native';
import FeedbackModal from '@/components/FeedbackModal';
import { useBrand, useBrandColors } from '@/contexts/BrandContext';
import { Palette, Sparkles } from 'lucide-react-native';
import { isDarkColor } from '@/lib/theme-utils';

export default function ClientBrandChangedModal() {
  const { showClientBrandChangedModal, dismissClientBrandChangedModal } = useBrand();
  const colors = useBrandColors();
  const isDark = isDarkColor(colors.surface || colors.background || '#010417');
  const modalBg = colors.surface || (isDark ? '#0f172a' : '#ffffff');
  const primaryColor = colors.primary || '#7FA7FF';

  return (
    <FeedbackModal
      visible={showClientBrandChangedModal}
      onClose={dismissClientBrandChangedModal}
      variant="info"
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
              backgroundColor: primaryColor,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 2,
              borderColor: modalBg,
            }}
          >
            <Sparkles size={13} color="#FFFFFF" />
          </View>
        </View>
      }
      title="Brand Updated"
      body="Your coach updated the brand for this app."
      ctaLabel="Got it"
      ctaBg={primaryColor}
    />
  );
}
