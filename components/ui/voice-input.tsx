import { useBrandColors } from '@/contexts/BrandContext';
import { isDarkColor } from '@/lib/theme-utils';
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, PanResponder, Platform } from 'react-native';
import { Mic, Trash2, Send, Lock, ChevronLeft, ChevronUp } from 'lucide-react-native';
import { MotiView } from 'moti';
import { 
  useAudioRecorder, 
  RecordingPresets, 
  getRecordingPermissionsAsync, 
  requestRecordingPermissionsAsync, 
  setAudioModeAsync 
} from 'expo-audio';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
  interpolate, Extrapolate, runOnJS,
} from 'react-native-reanimated';

interface VoiceInputProps {
  onStart?: () => void;
  onStop?: (uri: string, duration: number) => void;
  onCancel?: () => void;
  theme: any;
  disabled?: boolean;
  style?: any;
}

const RECORDING_OPTIONS = {
  ...RecordingPresets.HIGH_QUALITY,
  isMeteringEnabled: true,
};

const NUM_BARS = 24;
const MIN_BAR_HEIGHT = 3;
const MAX_BAR_HEIGHT = 22;

export function VoiceInput({ onStart, onStop, onCancel, theme, disabled, style }: VoiceInputProps) {
  const colors = useBrandColors();
  const styles = getStyles(colors);
  const [isRecording, setIsRecording] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [time, setTime] = useState(0);
  const [metering, setMetering] = useState<number[]>(new Array(NUM_BARS).fill(MIN_BAR_HEIGHT));

  const recorder = useAudioRecorder(RECORDING_OPTIONS);

  // ── Refs for PanResponder closures & race-condition prevention ─────────────
  const isRecordingRef = useRef(false);
  const isLockedRef = useRef(false);
  const isPressedRef = useRef(false);
  const isStartingRef = useRef(false);
  const pendingActionRef = useRef<'stop' | 'cancel' | null>(null);

  const timerRef = useRef<any>(null);
  const meteringTimerRef = useRef<any>(null);
  const holdTimerRef = useRef<any>(null);
  const timeRef = useRef(0);
  const isMountedRef = useRef(true);
  const envRef = useRef(0);
  const startTimeRef = useRef(0);

  // ── Reanimated shared values ──────────────────────────────────────────────
  const scale = useSharedValue(1);
  const lockDragY = useSharedValue(0);
  const slideX = useSharedValue(0);

  useEffect(() => { 
    isMountedRef.current = true;
    requestRecordingPermissionsAsync().catch(() => {}); 
    return () => {
      isMountedRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
      if (meteringTimerRef.current) clearInterval(meteringTimerRef.current);
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      if (isRecordingRef.current) {
        try {
          recorder.stop().catch(() => {});
        } catch {}
      }
    };
  }, []);

  // keep timeRef in sync
  useEffect(() => { timeRef.current = time; }, [time]);

  // ── Recording start / stop ────────────────────────────────────────────────
  const startRecording = async () => {
    if (disabled || isRecordingRef.current || isStartingRef.current) return;
    isStartingRef.current = true;
    pendingActionRef.current = null;
    startTimeRef.current = Date.now();

    isRecordingRef.current = true;
    setIsRecording(true);
    setTime(0);
    timeRef.current = 0;
    scale.value = withSpring(1.25);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Attach global web pointerup so releasing mouse anywhere stops recording
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handleWebUp = () => {
        window.removeEventListener('pointerup', handleWebUp);
        window.removeEventListener('mouseup', handleWebUp);
        if (!isLockedRef.current && (isRecordingRef.current || isStartingRef.current)) {
          handleFingerRelease();
        }
      };
      window.addEventListener('pointerup', handleWebUp);
      window.addEventListener('mouseup', handleWebUp);
    }

    try {
      const perm = await getRecordingPermissionsAsync();
      if (!perm.granted) {
        const r = await requestRecordingPermissionsAsync();
        if (!r.granted) { 
          reset(); 
          return; 
        }
      }

      try {
        if (recorder.isRecording) {
          await recorder.stop();
        }
      } catch {}

      // Configure audio session for recording
      try {
        await setAudioModeAsync({
          allowsRecording: true,
          playsInSilentMode: true,
        });
      } catch {}

      await recorder.prepareToRecordAsync();
      recorder.record();

      if (!isMountedRef.current) {
        try {
          recorder.stop().catch(() => {});
        } catch {}
        return;
      }

      // Check if user already released their finger while preparation was pending
      if (!isPressedRef.current || pendingActionRef.current) {
        const action = pendingActionRef.current || 'stop';
        pendingActionRef.current = null;
        isStartingRef.current = false;
        await stopRecording(action === 'stop');
        return;
      }

      onStart?.();
      timerRef.current = setInterval(() => {
        if (isMountedRef.current) setTime(t => t + 1);
      }, 1000);

      envRef.current = 0;

      meteringTimerRef.current = setInterval(() => {
        if (!isMountedRef.current) return;
        try {
          const st = recorder.getStatus();
          let rawLevel = 0;
          if (st && typeof st.metering === 'number' && !isNaN(st.metering) && st.metering > -100) {
            const clamped = Math.max(-48, Math.min(-8, st.metering));
            rawLevel = (clamped - (-48)) / 40;
          } else if (recorder.isRecording) {
            const t = (Date.now() - startTimeRef.current) / 1000;
            const synth = 0.5 * Math.sin(t * 9) + 0.3 * Math.sin(t * 14) + 0.2 * Math.sin(t * 22);
            rawLevel = Math.max(0, 0.12 + 0.16 * synth);
          }

          const currentEnv = envRef.current;
          const attack = 0.55;
          const release = 0.18;
          const nextEnv = rawLevel > currentEnv
            ? currentEnv + (rawLevel - currentEnv) * attack
            : currentEnv + (rawLevel - currentEnv) * release;
          envRef.current = nextEnv;

          const jitter = 0.82 + 0.36 * Math.random();
          const barHeight = Math.max(
            MIN_BAR_HEIGHT,
            Math.min(MAX_BAR_HEIGHT, Math.round(MIN_BAR_HEIGHT + (MAX_BAR_HEIGHT - MIN_BAR_HEIGHT) * nextEnv * jitter))
          );

          setMetering(prev => {
            const next = prev.slice(1);
            next.push(barHeight);
            return next;
          });
        } catch {}
      }, 65);
    } catch (e) {
      console.error('startRecording error', e);
      reset();
    } finally {
      isStartingRef.current = false;
    }
  };

  const stopRecording = async (shouldSend: boolean) => {
    let wasRecording = isRecordingRef.current;
    if (!wasRecording) {
      try {
        wasRecording = !!recorder.isRecording;
      } catch {
        wasRecording = false;
      }
    }
    if (!wasRecording) {
      reset();
      return;
    }

    if (timerRef.current) clearInterval(timerRef.current);
    if (meteringTimerRef.current) clearInterval(meteringTimerRef.current);

    const elapsedMs = Date.now() - startTimeRef.current;
    const durationSeconds = Math.max(1, Math.round(elapsedMs / 1000));
    reset();

    try {
      let isRec = false;
      try {
        isRec = !!recorder.isRecording;
      } catch {
        isRec = false;
      }

      if (isRec) {
        await recorder.stop();
        let uri = null;
        try {
          uri = recorder.uri;
        } catch {}

        // Only send if duration was at least 500ms (avoids accidental quick-tap noise)
        if (shouldSend && uri && elapsedMs >= 500) {
          onStop?.(uri, durationSeconds);
        } else {
          onCancel?.();
        }
      } else {
        onCancel?.();
      }
    } catch (e) {
      console.error('stopRecording error', e);
      onCancel?.();
    }

    // Release audio session back to normal mode
    try {
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    } catch {}
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const reset = () => {
    isRecordingRef.current = false;
    isLockedRef.current = false;
    isPressedRef.current = false;
    isStartingRef.current = false;
    pendingActionRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
    if (meteringTimerRef.current) clearInterval(meteringTimerRef.current);
    envRef.current = 0;
    if (!isMountedRef.current) return;
    setIsRecording(false);
    setIsLocked(false);
    setMetering(new Array(NUM_BARS).fill(MIN_BAR_HEIGHT));
    scale.value = withSpring(1);
    lockDragY.value = withTiming(0);
    slideX.value = withSpring(0);
  };

  const handleFingerRelease = (dx: number = 0) => {
    isPressedRef.current = false;
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
      reset();
      return;
    }

    // If locked into hands-free mode, releasing finger does nothing
    if (isLockedRef.current) return;

    // If still in async initialization phase, queue action
    if (isStartingRef.current) {
      pendingActionRef.current = dx < -60 ? 'cancel' : 'stop';
      return;
    }

    if (!isRecordingRef.current) return;

    if (dx < -60) {
      stopRecording(false); // cancelled
    } else {
      stopRecording(true); // send
    }
  };

  // ── PanResponder for WhatsApp-style Hold & Slide ─────────────────────────
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled,
      onMoveShouldSetPanResponder: () => !disabled,

      onPanResponderGrant: () => {
        if (disabled) return;
        isPressedRef.current = true;
        holdTimerRef.current = setTimeout(() => {
          holdTimerRef.current = null;
          startRecording();
        }, 80);
      },

      onPanResponderMove: (_, gs) => {
        if (!isRecordingRef.current || disabled) return;
        if (isLockedRef.current) return;

        // Slide left → cancel drag
        if (gs.dx < 0) {
          slideX.value = Math.max(-120, gs.dx);
        }

        // Slide up → track lock drag
        if (gs.dy < 0) {
          lockDragY.value = Math.max(-45, gs.dy * 0.5);
        }

        // Trigger lock if slid up past threshold (-50px)
        if (gs.dy <= -50) {
          isLockedRef.current = true;
          runOnJS(setIsLocked)(true);
          lockDragY.value = withTiming(0);
          slideX.value = withSpring(0);
          runOnJS(Haptics.notificationAsync)(Haptics.NotificationFeedbackType.Success);
          return;
        }

        // Trigger cancel if slid left past threshold (-100px)
        if (gs.dx <= -100) {
          runOnJS(stopRecording)(false);
        }
      },

      onPanResponderRelease: (_, gs) => {
        handleFingerRelease(gs.dx);
      },

      onPanResponderTerminate: () => {
        if (!isLockedRef.current) {
          handleFingerRelease(0);
        }
      },
    })
  ).current;

  // ── Animated styles ───────────────────────────────────────────────────────
  const micAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const lockPillAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: lockDragY.value }],
  }));

  const slideCancelAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: Math.min(0, slideX.value) }],
  }));

  const formatTime = (s: number) =>
    `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  const isDark = isDarkColor(colors.surface || colors.background || '#0F172A');

  return (
    <View style={[styles.root, (isRecording || isLocked) && styles.rootExpanded, style]}>

      {/* ── Holding mode: [red dot + timer] [waveform] [slide to cancel] ── */}
      {isRecording && !isLocked && (
        <MotiView
          from={{ opacity: 0, translateX: 10 }}
          animate={{ opacity: 1, translateX: 0 }}
          style={styles.recordingContent}
        >
          <View style={styles.recordingInfo}>
            <View style={styles.redDot} />
            <Text style={styles.timerText}>{formatTime(time)}</Text>
          </View>
          <View style={styles.waveform}>
            {metering.map((barHeight, i) => (
              <View
                key={i}
                style={[
                  styles.waveBar,
                  {
                    height: barHeight,
                    opacity: Math.max(0.4, Math.min(1, 0.4 + 0.6 * ((barHeight - MIN_BAR_HEIGHT) / (MAX_BAR_HEIGHT - MIN_BAR_HEIGHT)))),
                  },
                ]}
              />
            ))}
          </View>
          <Animated.View style={[styles.slideCancel, slideCancelAnimStyle]}>
            <ChevronLeft size={14} color="#64748B" />
            <Text style={styles.slideCancelText}>Slide to cancel</Text>
          </Animated.View>
        </MotiView>
      )}

      {/* ── Locked layout: [Trash] ... [Timer + Waveform] ... [Send replaces Mic] ── */}
      {isLocked && (
        <MotiView
          from={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          style={styles.lockedContent}
        >
          {/* Trash button on left */}
          <TouchableOpacity 
            onPress={() => stopRecording(false)} 
            style={styles.trashBtn} 
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Trash2 size={20} color="#EF4444" />
          </TouchableOpacity>

          {/* Timer + waveform in center */}
          <View style={styles.lockedCenter}>
            <View style={styles.recordingInfo}>
              <View style={styles.redDot} />
              <Text style={styles.timerText}>{formatTime(time)}</Text>
            </View>
            <View style={styles.waveform}>
              {metering.map((barHeight, i) => (
                <View
                  key={i}
                  style={[
                    styles.waveBar,
                    {
                      height: barHeight,
                      opacity: Math.max(0.4, Math.min(1, 0.4 + 0.6 * ((barHeight - MIN_BAR_HEIGHT) / (MAX_BAR_HEIGHT - MIN_BAR_HEIGHT)))),
                    },
                  ]}
                />
              ))}
            </View>
          </View>
        </MotiView>
      )}

      {/* ── WhatsApp-style Lock Pill: Floats directly above mic button while holding ── */}
      {isRecording && !isLocked && (
        <Animated.View 
          style={[
            styles.lockPill, 
            { backgroundColor: isDark ? '#1E293B' : '#FFFFFF', borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)' },
            lockPillAnimStyle
          ]} 
          pointerEvents="none"
        >
          <View style={[styles.lockIconBox, { backgroundColor: colors.primary }]}>
            <Lock size={14} color="#FFFFFF" strokeWidth={2.5} />
          </View>
          <MotiView
            animate={{ translateY: [-4, 1, -4] }}
            transition={{ loop: true, duration: 800, type: 'timing' } as any}
            style={{ alignItems: 'center', marginTop: 3 }}
          >
            <ChevronUp size={16} color={colors.primary} strokeWidth={3} />
          </MotiView>
        </Animated.View>
      )}

      {/* ── Mic button — replaced with Send circle when locked ── */}
      {isLocked ? (
        <TouchableOpacity
          onPress={() => stopRecording(true)}
          style={[styles.micBtn, styles.lockedSendCircle]}
          activeOpacity={0.8}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Send size={18} color="#FFFFFF" />
        </TouchableOpacity>
      ) : (
        <View
          {...panResponder.panHandlers}
          style={[styles.micBtn, isRecording && styles.micBtnActive]}
        >
          <Animated.View style={micAnimStyle}>
            {isRecording ? (
              <View style={styles.pulse} />
            ) : (
              <Mic size={24} color={theme.colors.primary} strokeWidth={2.5} />
            )}
          </Animated.View>
        </View>
      )}

    </View>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  root: {
    width: 44,
    height: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
    position: 'relative',
  },
  rootExpanded: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    width: undefined,
  },
  micBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  micBtnActive: {
    backgroundColor: 'rgba(239,68,68,0.12)',
  },
  pulse: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#EF4444',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },
  recordingContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 6,
  },
  lockedContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 4,
  },
  lockedCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 4,
  },
  recordingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  redDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  timerText: {
    color: colors.text || '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    minWidth: 34,
    flexShrink: 0,
  },
  waveform: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    height: 28,
    overflow: 'hidden',
  },
  waveBar: {
    width: 2,
    borderRadius: 1,
    backgroundColor: '#EF4444',
  },
  slideCancel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flexShrink: 0,
  },
  slideCancelText: {
    color: colors.textSecondary || '#64748B',
    fontSize: 12,
  },
  trashBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(239,68,68,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  // WhatsApp-style Lock Pill floating directly above the mic button
  lockPill: {
    position: 'absolute',
    right: 4,
    bottom: 54,
    width: 36,
    height: 68,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    zIndex: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  lockIconBox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockedSendCircle: {
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 5,
  },
});
