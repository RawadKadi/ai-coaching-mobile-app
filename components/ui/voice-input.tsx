import { useBrandColors } from '@/contexts/BrandContext';
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, PanResponder } from 'react-native';
import { Mic, Trash2, Send, Lock, ChevronLeft, ArrowUp } from 'lucide-react-native';
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

export function VoiceInput({ onStart, onStop, onCancel, theme, disabled, style }: VoiceInputProps) {
  const colors = useBrandColors();
  const styles = getStyles(colors);
  const [isRecording, setIsRecording] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [time, setTime] = useState(0);
  const [metering, setMetering] = useState<number[]>(new Array(28).fill(-160));

  const recorder = useAudioRecorder(RECORDING_OPTIONS);

  // ── Refs for PanResponder closures (always fresh values) ──────────────────
  const isRecordingRef = useRef(false);
  const isLockedRef = useRef(false);
  const isInitializingRef = useRef(false);
  const timerRef = useRef<any>(null);
  const meteringTimerRef = useRef<any>(null);
  const holdTimerRef = useRef<any>(null);
  const timeRef = useRef(0);
  const isMountedRef = useRef(true);

  // ── Reanimated shared values ──────────────────────────────────────────────
  const scale = useSharedValue(1);
  const lockProgress = useSharedValue(0);
  const slideX = useSharedValue(0);

  useEffect(() => { 
    isMountedRef.current = true;
    requestRecordingPermissionsAsync().catch(() => {}); 
    return () => {
      isMountedRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
      if (meteringTimerRef.current) clearInterval(meteringTimerRef.current);
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      if (recorder.isRecording) {
        recorder.stop().catch(() => {});
      }
    };
  }, []);

  // keep timeRef in sync
  useEffect(() => { timeRef.current = time; }, [time]);

  // ── Recording start / stop ────────────────────────────────────────────────
  const startRecording = async () => {
    if (disabled || isRecordingRef.current || isInitializingRef.current) return;
    isInitializingRef.current = true;

    isRecordingRef.current = true;
    setIsRecording(true);
    setTime(0);
    timeRef.current = 0;
    scale.value = withSpring(1.25);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const perm = await getRecordingPermissionsAsync();
      if (!perm.granted) {
        const r = await requestRecordingPermissionsAsync();
        if (!r.granted) { reset(); return; }
      }

      if (recorder.isRecording) {
        try { await recorder.stop(); } catch {}
      }

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
        recorder.stop().catch(() => {});
        return;
      }

      onStart?.();
      timerRef.current = setInterval(() => {
        if (isMountedRef.current) setTime(t => t + 1);
      }, 1000);

      meteringTimerRef.current = setInterval(() => {
        if (isMountedRef.current) {
          try {
            const st = recorder.getStatus();
            if (st.metering !== undefined) {
              setMetering(prev => [...prev.slice(1), st.metering ?? -160]);
            }
          } catch {}
        }
      }, 100);
    } catch (e) {
      console.error('startRecording error', e);
      reset();
    } finally {
      isInitializingRef.current = false;
    }
  };

  const stopRecording = async (shouldSend: boolean) => {
    if (!isRecordingRef.current && !recorder.isRecording) return;
    if (timerRef.current) clearInterval(timerRef.current);
    if (meteringTimerRef.current) clearInterval(meteringTimerRef.current);

    const dur = timeRef.current;
    reset();

    try {
      if (recorder.isRecording) {
        await recorder.stop();
        const uri = recorder.uri;
        if (shouldSend && uri && dur >= 1) {
          onStop?.(uri, dur);
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

    // Release the audio session so normal playback/system audio behaves properly
    try {
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    } catch {}
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const reset = () => {
    isRecordingRef.current = false;
    isLockedRef.current = false;
    isInitializingRef.current = false; // never leave this stuck
    if (timerRef.current) clearInterval(timerRef.current);
    if (meteringTimerRef.current) clearInterval(meteringTimerRef.current);
    if (!isMountedRef.current) return;
    setIsRecording(false);
    setIsLocked(false);
    scale.value = withSpring(1);
    lockProgress.value = withTiming(0);
    slideX.value = withSpring(0);
  };

  // ── PanResponder — single, never unmounts ─────────────────────────────────
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled,
      onMoveShouldSetPanResponder: () => !disabled,

      onPanResponderGrant: () => {
        if (disabled) return;
        // Hold-to-record: only start after 150 ms still pressed
        holdTimerRef.current = setTimeout(() => {
          holdTimerRef.current = null;
          startRecording();
        }, 150);
      },

      onPanResponderMove: (_, gs) => {
        if (!isRecordingRef.current || disabled) return;
        if (isLockedRef.current) return;

        // Slide left → cancel hint
        if (gs.dx < 0) slideX.value = gs.dx;

        // Slide up → lock hint
        if (gs.dy < -10) {
          lockProgress.value = interpolate(gs.dy, [0, -20, -80], [0, 0.5, 1], Extrapolate.CLAMP);
        }

        // Trigger lock
        if (gs.dy < -80) {
          isLockedRef.current = true;
          runOnJS(setIsLocked)(true);
          lockProgress.value = withTiming(0);
          slideX.value = withSpring(0);
          runOnJS(Haptics.notificationAsync)(Haptics.NotificationFeedbackType.Success);
        }

        // Trigger cancel (slide left enough)
        if (gs.dx < -100) {
          runOnJS(stopRecording)(false);
        }
      },

      onPanResponderRelease: (_, gs) => {
        // Finger lifted before hold threshold — abort
        if (holdTimerRef.current) {
          clearTimeout(holdTimerRef.current);
          holdTimerRef.current = null;
          return;
        }
        if (isLockedRef.current) return; // locked: user must tap trash/send
        if (!isRecordingRef.current) return;

        if (gs.dx < -80) {
          stopRecording(false); // cancel
        } else {
          stopRecording(true); // send
        }
      },

      onPanResponderTerminate: () => {
        if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null; }
        if (!isLockedRef.current && isRecordingRef.current) stopRecording(false);
      },
    })
  ).current;

  // ── Animated styles ───────────────────────────────────────────────────────
  const micAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const lockIndicatorStyle = useAnimatedStyle(() => ({
    opacity: lockProgress.value,
    transform: [{ translateY: interpolate(lockProgress.value, [0, 1], [8, 0], Extrapolate.CLAMP) }],
  }));

  const formatTime = (s: number) =>
    `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  // ── Render — SINGLE return, PanResponder always on micBtn ─────────────────
  return (
    <View style={[styles.root, (isRecording || isLocked) && styles.rootExpanded, style]}>

      {/* ── Recording content (left of mic) ── */}
      {isRecording && !isLocked && (
        <MotiView
          from={{ opacity: 0, translateX: 20 }}
          animate={{ opacity: 1, translateX: 0 }}
          style={styles.recordingContent}
        >
          <View style={styles.recordingInfo}>
            <View style={styles.redDot} />
            <Text style={styles.timerText}>{formatTime(time)}</Text>
          </View>
          <View style={styles.waveform}>
            {metering.map((lvl, i) => (
              <MotiView
                key={i}
                animate={{ height: Math.max(3, (lvl + 160) * 0.28) }}
                transition={{ type: 'timing', duration: 50 }}
                style={styles.waveBar}
              />
            ))}
          </View>
          <View style={styles.slideCancel}>
            <ChevronLeft size={14} color="#64748B" />
            <Text style={styles.slideCancelText}>Slide to cancel</Text>
          </View>
        </MotiView>
      )}

      {/* ── Locked layout: [trash] [timer+waveform] ... [send replaces mic] ── */}
      {isLocked && (
        <MotiView
          from={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          style={styles.lockedContent}
        >
          {/* Trash — leftmost */}
          <TouchableOpacity onPress={() => stopRecording(false)} style={styles.actionBtn} activeOpacity={0.7}>
            <Trash2 size={20} color="#EF4444" />
          </TouchableOpacity>

          {/* Timer + waveform — center */}
          <View style={styles.lockedCenter}>
            <View style={styles.recordingInfo}>
              <View style={styles.redDot} />
              <Text style={styles.timerText}>{formatTime(time)}</Text>
            </View>
            <View style={styles.waveform}>
              {metering.map((lvl, i) => (
                <MotiView
                  key={i}
                  animate={{ height: Math.max(3, (lvl + 160) * 0.28) }}
                  transition={{ type: 'timing', duration: 50 }}
                  style={styles.waveBar}
                />
              ))}
            </View>
          </View>
        </MotiView>
      )}

      {/* ── Lock indicator — floats above mic button ── */}
      {isRecording && !isLocked && (
        <Animated.View style={[styles.lockIndicator, lockIndicatorStyle]}>
          <View style={styles.lockIconBox}>
            <Lock size={13} color="#FFFFFF" strokeWidth={2.5} />
          </View>
          <MotiView
            animate={{ translateY: [-3, 0, -3] }}
            transition={{ loop: true, duration: 900, type: 'timing' }}
          >
            <ArrowUp size={11} color="#64748B" strokeWidth={3} />
          </MotiView>
        </Animated.View>
      )}

      {/* ── Mic button — hidden when locked; send button takes its place ── */}
      {isLocked ? (
        <TouchableOpacity
          onPress={() => stopRecording(true)}
          style={[styles.micBtn, styles.lockedSendCircle]}
          activeOpacity={0.8}
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
    backgroundColor: 'rgba(239,68,68,0.08)',
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
    gap: 6,
  },
  lockedContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
    color: '#FFFFFF',
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
    color: '#64748B',
    fontSize: 12,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  sendBtn: {
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  // Lock indicator — positioned above the mic button
  lockIndicator: {
    position: 'absolute',
    right: 6,
    bottom: 52,
    alignItems: 'center',
    gap: 4,
    zIndex: 100,
  },
  lockIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 5,
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
