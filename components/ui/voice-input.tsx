import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, PanResponder } from 'react-native';
import { Mic, Trash2, Send, Lock, ChevronLeft, ArrowUp } from 'lucide-react-native';
import { MotiView } from 'moti';
import { Audio } from 'expo-av';
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

export function VoiceInput({ onStart, onStop, onCancel, theme, disabled, style }: VoiceInputProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [time, setTime] = useState(0);
  const [metering, setMetering] = useState<number[]>(new Array(28).fill(-160));

  // ── Refs for PanResponder closures (always fresh values) ──────────────────
  const isRecordingRef = useRef(false);
  const isLockedRef = useRef(false);
  const isInitializingRef = useRef(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const timeRef = useRef(0);

  // ── Reanimated shared values ──────────────────────────────────────────────
  const scale = useSharedValue(1);
  const lockProgress = useSharedValue(0);
  const slideX = useSharedValue(0);

  useEffect(() => { Audio.requestPermissionsAsync(); }, []);

  // keep timeRef in sync
  useEffect(() => { timeRef.current = time; }, [time]);

  // ── Recording start / stop ────────────────────────────────────────────────
  const startRecording = async () => {
    if (disabled || recordingRef.current || isInitializingRef.current) return;
    isInitializingRef.current = true;

    isRecordingRef.current = true;
    setIsRecording(true);
    setTime(0);
    timeRef.current = 0;
    scale.value = withSpring(1.25);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const perm = await Audio.getPermissionsAsync();
      if (perm.status !== 'granted') {
        const r = await Audio.requestPermissionsAsync();
        if (r.status !== 'granted') { reset(); return; }
      }

      // Force-unload any stale recording left over from a previous session
      if (recordingRef.current) {
        try { await recordingRef.current.stopAndUnloadAsync(); } catch {}
        recordingRef.current = null;
      }

      // Release then re-acquire the audio session so iOS allows a new recording
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true,  playsInSilentModeIOS: true });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
        (s) => {
          if (s.metering !== undefined) {
            setMetering(prev => [...prev.slice(1), s.metering ?? -160]);
          }
        },
        50,
      );
      recordingRef.current = recording;
      onStart?.();
      timerRef.current = setInterval(() => setTime(t => t + 1), 1000);
    } catch (e) {
      console.error('startRecording error', e);
      reset();
    } finally {
      isInitializingRef.current = false;
    }
  };

  const stopRecording = async (shouldSend: boolean) => {
    if (!isRecordingRef.current && !recordingRef.current) return;
    if (timerRef.current) clearInterval(timerRef.current);

    const rec = recordingRef.current;
    recordingRef.current = null;
    const dur = timeRef.current;

    reset();

    try {
      if (rec) {
        await rec.stopAndUnloadAsync();
        const uri = rec.getURI();
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
    // Release the iOS audio session so the next recording can start cleanly
    try {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
    } catch {}
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const reset = () => {
    isRecordingRef.current = false;
    isLockedRef.current = false;
    isInitializingRef.current = false; // never leave this stuck
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

const styles = StyleSheet.create({
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
    backgroundColor: '#3B82F6',
    shadowColor: '#3B82F6',
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
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 5,
  },
  lockedSendCircle: {
    backgroundColor: '#3B82F6',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 5,
  },
});
