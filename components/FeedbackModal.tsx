/**
 * FeedbackModal — reusable full-screen moment card.
 *
 * Variants:
 *   success  → green accent,  blue CTA   (task done, streak earned…)
 *   warning  → amber accent,  amber CTA  (streak lost, missed day…)
 *   info     → blue accent,   blue CTA   (neutral confirmations)
 *
 * Usage:
 *   <FeedbackModal
 *     visible={show}
 *     onClose={() => setShow(false)}
 *     variant="success"
 *     icon={<CheckCircle size={60} color="#10B981" />}
 *     title="All Done"
 *     body="You finished everything for today."
 *     statLabel="Current Streak"
 *     statIcon={<Zap size={22} color="#F59E0B" fill="#F59E0B" />}
 *     stat="3 Days"
 *     ctaLabel="Keep it up"
 *   />
 */

import React, { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Modal,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

// ─── Variant tokens ────────────────────────────────────────────────────────────

type Variant = 'success' | 'warning' | 'info';

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
    ctaBg: '#3B82F6',
    ctaText: '#ffffff',
  },
  warning: {
    accent: '#F59E0B',
    accentBg: 'rgba(245, 158, 11, 0.08)',
    accentBorder: 'rgba(245, 158, 11, 0.2)',
    ctaBg: '#F59E0B',
    ctaText: '#0f172a',
  },
  info: {
    accent: '#3B82F6',
    accentBg: 'rgba(59, 130, 246, 0.08)',
    accentBorder: 'rgba(59, 130, 246, 0.2)',
    ctaBg: '#3B82F6',
    ctaText: '#ffffff',
  },
};

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
}: FeedbackModalProps) {
  const v = VARIANTS[variant];
  const resolvedCtaBg = ctaBg ?? v.ctaBg;
  const resolvedCtaText = ctaTextColor ?? v.ctaText;

  // Respect system-level reduce-motion preference
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduceMotion ? 'none' : 'fade'}
      statusBarTranslucent
    >
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.88)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 24,
        }}
      >
        <View
          style={{
            backgroundColor: '#0f172a',
            borderRadius: 40,
            padding: 40,
            width: '100%',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: v.accentBorder,
            shadowColor: v.accent,
            shadowOffset: { width: 0, height: 20 },
            shadowOpacity: 0.18,
            shadowRadius: 40,
            elevation: 10,
          }}
        >
          {/* ── Icon circle ── */}
          <View
            style={{
              width: 100,
              height: 100,
              borderRadius: 50,
              backgroundColor: v.accentBg,
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
              color: '#ffffff',
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
              color: '#94a3b8',
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
                backgroundColor: v.accentBg,
                borderRadius: 24,
                paddingVertical: 20,
                paddingHorizontal: 32,
                width: '100%',
                alignItems: 'center',
                marginBottom: 32,
                borderWidth: 1,
                borderColor: v.accentBorder,
              }}
            >
              {statLabel && (
                <Text
                  style={{
                    color: '#64748b',
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
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                {statIcon}
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  style={{
                    color: '#ffffff',
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
            onPress={onClose}
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
        </View>
      </View>
    </Modal>
  );
}
