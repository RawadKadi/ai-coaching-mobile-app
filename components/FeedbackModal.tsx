import { useBrandColors } from '@/contexts/BrandContext';
import { isDarkColor, getContrastColor } from '@/lib/theme-utils';
import React, { useEffect, useState, useRef } from 'react';
import {
  AccessibilityInfo,
  Modal,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  Animated,
} from 'react-native';

type Variant = 'success' | 'warning' | 'info' | 'cold';

// ─── Props ─────────────────────────────────────────────────────────────────────

interface FeedbackModalProps {
  visible: boolean;
  onClose: () => void;
  /** Visual theme — drives accent colour and default CTA colour. */
  variant?: Variant;
  /** Icon rendered inside the large circle at the top. */
  icon: React.ReactNode;
  title: string;
  body: string;
  /** Label shown above the stat value (e.g. "Current Streak"). */
  statLabel?: string;
  /** Optional icon shown to the left of the stat value (e.g. a Zap ⚡). */
  statIcon?: React.ReactNode;
  /** Stat value string (e.g. "3 Days"). Omit to hide the pill entirely. */
  stat?: string;
  ctaLabel?: string;
  /** Override the CTA background colour (bypasses variant default). */
  ctaBg?: string;
  /** Override the CTA text colour (bypasses variant default). */
  ctaTextColor?: string;
  /** Custom accent color override */
  accentColor?: string;
  /** Custom accent bg color override */
  accentBg?: string;
  /** Custom accent border color override */
  accentBorder?: string;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function FeedbackModal({
  visible,
  onClose,
  variant = 'success',
  icon,
  title,
  body,
  statLabel,
  statIcon,
  stat,
  ctaLabel = 'Got it',
  ctaBg,
  ctaTextColor,
  accentColor,
  accentBg,
  accentBorder,
}: FeedbackModalProps) {
  const colors = useBrandColors();

  const isDark = isDarkColor(colors.surface || colors.background || '#010417');
  const modalBg = colors.surface || (isDark ? '#0f172a' : '#ffffff');
  const modalBorder =
    colors.border ||
    (isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)');
  const modalText = colors.text || (isDark ? '#ffffff' : '#0f172a');
  const modalTextSecondary =
    colors.textSecondary || (isDark ? '#94a3b8' : '#64748b');

  const brandPrimary = colors.primary || '#8B5CF6';

  const VARIANTS: Record<
    Variant,
    {
      accent: string;
      accentBg: string;
      accentBorder: string;
      ctaBg: string;
      ctaText: string;
    }
  > = {
    success: {
      accent: '#10B981',
      accentBg: 'rgba(16, 185, 129, 0.08)',
      accentBorder: 'rgba(16, 185, 129, 0.2)',
      ctaBg: brandPrimary,
      ctaText: getContrastColor(brandPrimary),
    },
    warning: {
      accent: brandPrimary,
      accentBg: isDark ? `${brandPrimary}1E` : `${brandPrimary}12`,
      accentBorder: `${brandPrimary}33`,
      ctaBg: brandPrimary,
      ctaText: getContrastColor(brandPrimary),
    },
    cold: {
      accent: '#38BDF8',
      accentBg: isDark ? 'rgba(56, 189, 248, 0.16)' : 'rgba(56, 189, 248, 0.10)',
      accentBorder: 'rgba(56, 189, 248, 0.28)',
      ctaBg: brandPrimary,
      ctaText: getContrastColor(brandPrimary),
    },
    info: {
      accent: brandPrimary,
      accentBg: isDark ? `${brandPrimary}1E` : `${brandPrimary}12`,
      accentBorder: `${brandPrimary}33`,
      ctaBg: brandPrimary,
      ctaText: getContrastColor(brandPrimary),
    },
  };

  const v = VARIANTS[variant] || VARIANTS.info;
  const resolvedAccent = accentColor ?? v.accent;
  const resolvedAccentBg = accentBg ?? v.accentBg;
  const resolvedAccentBorder = accentBorder ?? v.accentBorder;
  const resolvedCtaBg = ctaBg ?? v.ctaBg;
  const resolvedCtaText =
    ctaTextColor ?? (ctaBg ? getContrastColor(resolvedCtaBg) : v.ctaText);

  // Respect system-level reduce-motion preference
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);

  // Internal visibility & smooth entrance/exit animations
  const [internalVisible, setInternalVisible] = useState(visible);
  const fadeAnim = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const scaleAnim = useRef(new Animated.Value(visible ? 1 : 0.95)).current;
  const isClosingRef = useRef(false);

  useEffect(() => {
    if (visible) {
      isClosingRef.current = false;
      setInternalVisible(true);
      if (reduceMotion) {
        fadeAnim.setValue(1);
        scaleAnim.setValue(1);
      } else {
        fadeAnim.setValue(0);
        scaleAnim.setValue(0.95);
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 220,
            useNativeDriver: true,
          }),
          Animated.spring(scaleAnim, {
            toValue: 1,
            friction: 8,
            tension: 50,
            useNativeDriver: true,
          }),
        ]).start();
      }
    } else if (internalVisible && !isClosingRef.current) {
      handleClose();
    }
  }, [visible, reduceMotion]);

  const handleClose = () => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;

    if (reduceMotion) {
      setInternalVisible(false);
      onClose();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.94,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setInternalVisible(false);
        onClose();
      });
    }
  };

  if (!internalVisible) return null;

  return (
    <Modal
      visible={internalVisible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <TouchableWithoutFeedback onPress={handleClose}>
        <Animated.View
          style={{
            flex: 1,
            backgroundColor: isDark ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.5)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 24,
            opacity: fadeAnim,
          }}
        >
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <Animated.View
              style={{
                backgroundColor: modalBg,
                borderRadius: 40,
                padding: 40,
                width: '100%',
                alignItems: 'center',
                borderWidth: 1,
                borderColor: resolvedAccentBorder || modalBorder,
                shadowColor: resolvedAccent,
                shadowOffset: { width: 0, height: 20 },
                shadowOpacity: isDark ? 0.3 : 0.12,
                shadowRadius: 40,
                elevation: 10,
                transform: [{ scale: scaleAnim }],
              }}
            >
              {/* ── Icon circle ── */}
              <View
                style={{
                  width: 100,
                  height: 100,
                  borderRadius: 50,
                  backgroundColor: resolvedAccentBg,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 24,
                }}
              >
                {icon}
              </View>

              {/* ── Title ── */}
              <Text
                style={{
                  color: modalText,
                  fontSize: 26,
                  fontWeight: '900',
                  textAlign: 'center',
                  marginBottom: 12,
                }}
              >
                {title}
              </Text>

              {/* ── Body ── */}
              <Text
                style={{
                  color: modalTextSecondary,
                  fontSize: 15,
                  textAlign: 'center',
                  lineHeight: 24,
                  marginBottom: stat ? 32 : 40,
                }}
              >
                {body}
              </Text>

              {/* ── Stat pill (optional) ── */}
              {stat && (
                <View
                  style={{
                    backgroundColor: resolvedAccentBg,
                    borderRadius: 24,
                    paddingVertical: 20,
                    paddingHorizontal: 32,
                    width: '100%',
                    alignItems: 'center',
                    marginBottom: 32,
                    borderWidth: 1,
                    borderColor: resolvedAccentBorder || modalBorder,
                  }}
                >
                  {statLabel && (
                    <Text
                      style={{
                        color: modalTextSecondary,
                        fontSize: 11,
                        fontWeight: 'bold',
                        textTransform: 'uppercase',
                        letterSpacing: 2,
                        marginBottom: 8,
                      }}
                    >
                      {statLabel}
                    </Text>
                  )}
                  <View
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
                  >
                    {statIcon}
                    <Text
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      style={{
                        color: modalText,
                        fontSize: 36,
                        fontWeight: '900',
                      }}
                    >
                      {stat}
                    </Text>
                  </View>
                </View>
              )}

              {/* ── CTA button ── */}
              <TouchableOpacity
                onPress={handleClose}
                activeOpacity={0.85}
                style={{
                  backgroundColor: resolvedCtaBg,
                  width: '100%',
                  paddingVertical: 18,
                  borderRadius: 20,
                  alignItems: 'center',
                }}
              >
                <Text
                  style={{
                    color: resolvedCtaText,
                    fontWeight: '900',
                    fontSize: 16,
                  }}
                >
                  {ctaLabel}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          </TouchableWithoutFeedback>
        </Animated.View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}
