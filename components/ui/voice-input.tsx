import { useBrandColors } from '@/contexts/BrandContext';
import { isDarkColor } from '@/lib/theme-utils';
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, PanResponder, Platform, Dimensions } from 'react-native';
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

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const OVERLAY_WIDTH = Math.min(SCREEN_WIDTH - 80, 500);

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

  const lastRecordedUrlRef = useRef<string | null>(null);
  const recorder = useAudioRecorder(RECORDING_OPTIONS, (status) => {
    if (status?.url) {
      lastRecordedUrlRef.current = status.url;
    }
  });

  const recorderRef = useRef(recorder);
  useEffect(() => {
    recorderRef.current = recorder;
  }, [recorder]);

  const propsRef = useRef({ onStart, onStop, onCancel, disabled });
  useEffect(() => {
    propsRef.current = { onStart, onStop, onCancel, disabled };
  });

  // ── Refs for PanResponder closures & race-condition prevention ─────────────
  const isRecordingRef = useRef(false);
  const isLockedRef = useRef(false);
  const isPressedRef = useRef(false);
  const isStartingRef = useRef(false);
  const pendingActionRef = useRef<'stop' | 'cancel' | null>(null);
  const startPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const timerRef = useRef<any>(null);
  const meteringTimerRef = useRef<any>(null);
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
      if (isRecordingRef.current) {
        try {
          recorderRef.current.stop().catch(() => {});
        } catch {}
      }
    };
  }, []);

  // keep timeRef in sync
  useEffect(() => { timeRef.current = time; }, [time]);

  // ── Recording start / stop ────────────────────────────────────────────────
  const startRecording = async () => {
    if (propsRef.current.disabled || isRecordingRef.current || isStartingRef.current) return;
    isStartingRef.current = true;
    pendingActionRef.current = null;
    lastRecordedUrlRef.current = null;
    startTimeRef.current = Date.now();

    isRecordingRef.current = true;
    setIsRecording(true);
    setTime(0);
    timeRef.current = 0;
    scale.value = withSpring(1.25);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    } catch {}

    // Notify parent immediately so controls fade out seamlessly
    propsRef.current.onStart?.();

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
        if (recorderRef.current.isRecording) {
          await recorderRef.current.stop();
        }
      } catch {}

      // Configure audio session for recording
      try {
        await setAudioModeAsync({
          allowsRecording: true,
          playsInSilentMode: true,
        });
      } catch {}

      await recorderRef.current.prepareToRecordAsync();
      recorderRef.current.record();

      if (!isMountedRef.current) {
        try {
          recorderRef.current.stop().catch(() => {});
        } catch {}
        return;
      }

      // Check if user already released their finger while preparation was pending (unless already locked)
      if ((!isPressedRef.current && !isLockedRef.current) || pendingActionRef.current) {
        const action = pendingActionRef.current || 'stop';
        pendingActionRef.current = null;
        isStartingRef.current = false;
        await stopRecording(action === 'stop');
        return;
      }

      timerRef.current = setInterval(() => {
        if (isMountedRef.current) setTime(t => t + 1);
      }, 1000);

      envRef.current = 0;

      meteringTimerRef.current = setInterval(() => {
        if (!isMountedRef.current) return;
        try {
          const rec = recorderRef.current;
          const st = rec?.getStatus ? rec.getStatus() : null;
          let rawLevel = 0;
          if (st && typeof st.metering === 'number' && !isNaN(st.metering) && st.metering > -100) {
            const clamped = Math.max(-48, Math.min(-8, st.metering));
            rawLevel = (clamped - (-48)) / 40;
          } else if (rec?.isRecording) {
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
        wasRecording = !!recorderRef.current?.isRecording;
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
    const recordedTime = timeRef.current;
    reset();

    try {
      let uri = lastRecordedUrlRef.current;
      if (!uri) {
        try {
          const rec = recorderRef.current as any;
          const raw = rec?.uri || rec?.url;
          if (raw && typeof raw === 'string' && raw.trim().length > 0) {
            uri = raw;
          }
        } catch {}
      }
      if (!uri && recorderRef.current?.getStatus) {
        try {
          uri = recorderRef.current.getStatus()?.url || null;
        } catch {}
      }

      try {
        await recorderRef.current.stop();
      } catch (err) {
        console.warn('[VoiceInput] recorder.stop error:', err);
      }

      // Check again after stop completes
      if (!uri) {
        uri = lastRecordedUrlRef.current;
      }
      if (!uri) {
        try {
          const rec = recorderRef.current as any;
          const raw = rec?.uri || rec?.url;
          if (raw && typeof raw === 'string' && raw.trim().length > 0) {
            uri = raw;
          }
        } catch {}
      }
      if (!uri && recorderRef.current?.getStatus) {
        try {
          uri = recorderRef.current.getStatus()?.url || null;
        } catch {}
      }

      // If still not available immediately, brief wait for file buffer flush
      if (!uri) {
        await new Promise((resolve) => setTimeout(resolve, 80));
        uri = lastRecordedUrlRef.current || (recorderRef.current as any)?.uri || (recorderRef.current as any)?.url || recorderRef.current?.getStatus()?.url || null;
      }

      console.log('[VoiceInput] stopRecording finished stop. uri:', uri, 'elapsedMs:', elapsedMs, 'shouldSend:', shouldSend);

      // Directly send upon release if held more than 0.5 seconds; quick taps (<0.5s) are cancelled
      const isAboveHalfSec = elapsedMs >= 500 || durationSeconds >= 1 || recordedTime >= 1;
      if (shouldSend && uri && isAboveHalfSec) {
        console.log('[VoiceInput] Calling onStop callback with uri:', uri, 'duration:', durationSeconds);
        propsRef.current.onStop?.(uri, durationSeconds);
      } else {
        console.log('[VoiceInput] Calling onCancel callback. shouldSend:', shouldSend, 'uriExists:', !!uri, 'isAboveHalfSec:', isAboveHalfSec);
        propsRef.current.onCancel?.();
      }
    } catch (e) {
      console.error('stopRecording error', e);
      propsRef.current.onCancel?.();
    }

    // Release audio session back to normal mode
    try {
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    } catch {}
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    } catch {}
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
    console.log('[VoiceInput] handleFingerRelease called. dx:', dx, 'isLocked:', isLockedRef.current, 'isStarting:', isStartingRef.current, 'isRecording:', isRecordingRef.current);
    isPressedRef.current = false;

    // If locked into hands-free mode, releasing finger does nothing
    if (isLockedRef.current) {
      console.log('[VoiceInput] handleFingerRelease ignored because isLocked is true');
      return;
    }

    // If still in async initialization phase, queue action
    if (isStartingRef.current) {
      console.log('[VoiceInput] handleFingerRelease queuing pending action because isStarting is true');
      pendingActionRef.current = dx < -70 ? 'cancel' : 'stop';
      return;
    }

    if (!isRecordingRef.current) {
      console.log('[VoiceInput] handleFingerRelease ignored because isRecording is false');
      return;
    }

    if (dx < -70) {
      console.log('[VoiceInput] handleFingerRelease: cancelling due to dx < -70');
      stopRecording(false); // cancelled
    } else {
      console.log('[VoiceInput] handleFingerRelease: stopping and sending');
      stopRecording(true); // send
    }
  };

  const handleDragMove = (dx: number, dy: number) => {
    if (propsRef.current.disabled || isLockedRef.current) return;
    if (!isPressedRef.current && !isRecordingRef.current) return;

    // Slide left → cancel drag
    if (dx < 0) {
      slideX.value = Math.max(-120, dx);
    } else {
      slideX.value = withTiming(0, { duration: 100 });
    }

    // Slide up → track lock drag
    if (dy < 0) {
      lockDragY.value = Math.max(-50, dy * 0.5);
    } else {
      lockDragY.value = withTiming(0, { duration: 100 });
    }

    // Trigger lock if deliberately slid up past threshold (-65px towards lock icon)
    if (dy <= -65) {
      console.log('[VoiceInput] handleDragMove: Lock triggered! dy:', dy);
      isLockedRef.current = true;
      setIsLocked(true);
      lockDragY.value = withTiming(0);
      slideX.value = withSpring(0);
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      } catch {}
      return;
    }

    // Trigger cancel if slid left past threshold (-70px)
    if (dx <= -70) {
      console.log('[VoiceInput] handleDragMove: Cancel triggered! dx:', dx);
      stopRecording(false);
    }
  };

  // ── PanResponder for WhatsApp-style Hold & Slide ─────────────────────────
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !propsRef.current.disabled,
      onStartShouldSetPanResponderCapture: () => !propsRef.current.disabled,
      onMoveShouldSetPanResponder: () => !propsRef.current.disabled,
      onMoveShouldSetPanResponderCapture: () => !propsRef.current.disabled,
      onPanResponderTerminationRequest: () => !isPressedRef.current && !isRecordingRef.current,

      onPanResponderGrant: (evt) => {
        console.log('[VoiceInput] onPanResponderGrant');
        if (propsRef.current.disabled) return;
        isPressedRef.current = true;
        const clientX = (evt.nativeEvent as any)?.clientX ?? evt.nativeEvent?.pageX ?? 0;
        const clientY = (evt.nativeEvent as any)?.clientY ?? evt.nativeEvent?.pageY ?? 0;
        startPosRef.current = { x: clientX, y: clientY };

        // Attach window listeners on Web for continuous drag tracking outside button bounds
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          const onWebMove = (e: MouseEvent | PointerEvent) => {
            if (!isPressedRef.current || isLockedRef.current) return;
            const dx = e.clientX - startPosRef.current.x;
            const dy = e.clientY - startPosRef.current.y;
            handleDragMove(dx, dy);
          };

          const onWebUp = (e: MouseEvent | PointerEvent) => {
            window.removeEventListener('pointermove', onWebMove);
            window.removeEventListener('mousemove', onWebMove);
            window.removeEventListener('pointerup', onWebUp);
            window.removeEventListener('mouseup', onWebUp);
            if (!isLockedRef.current) {
              const dx = e.clientX - startPosRef.current.x;
              handleFingerRelease(dx);
            }
          };

          window.addEventListener('pointermove', onWebMove);
          window.addEventListener('mousemove', onWebMove);
          window.addEventListener('pointerup', onWebUp);
          window.addEventListener('mouseup', onWebUp);
        }

        startRecording();
      },

      onPanResponderMove: (_, gs) => {
        handleDragMove(gs.dx, gs.dy);
      },

      onPanResponderRelease: (_, gs) => {
        console.log('[VoiceInput] onPanResponderRelease, gs.dx:', gs.dx, 'gs.dy:', gs.dy);
        handleFingerRelease(gs.dx);
      },

      onPanResponderTerminate: (_, gs) => {
        console.log('[VoiceInput] onPanResponderTerminate, gs?.dx:', gs?.dx);
        if (!isLockedRef.current) {
          handleFingerRelease(gs?.dx || 0);
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
  const circleBg = isRecording ? '#EF4444' : (theme?.colors?.primary || colors?.primary || '#3B82F6');
  const isCircleDark = isDarkColor(circleBg);
  const micIconColor = isCircleDark ? '#FFFFFF' : '#0F172A';

  return (
    <View style={[styles.root, style]}>

      {/* ── Holding mode: [red dot + timer] [waveform] [slide to cancel] ── */}
      {isRecording && !isLocked && (
        <MotiView
          key="recording-holding-overlay"
          from={{ opacity: 0, translateX: 10 }}
          animate={{ opacity: 1, translateX: 0 }}
          style={styles.recordingOverlay}
          pointerEvents="none"
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
          key="recording-locked-overlay"
          from={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          style={styles.recordingOverlay}
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
          key="recording-lock-pill"
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

      {/* ── Permanent Mic button touch target with circle ── */}
      <View
        key="recording-mic-btn"
        {...panResponder.panHandlers}
        style={[
          styles.micBtn, 
          Platform.OS === 'web' && ({
            userSelect: 'none',
            touchAction: 'none',
            WebkitUserSelect: 'none',
            cursor: 'pointer',
          } as any)
        ]}
        pointerEvents={isLocked ? 'none' : 'auto'}
      >
        <Animated.View 
          style={[
            styles.micCircle,
            { 
              backgroundColor: circleBg,
              shadowColor: circleBg,
            },
            micAnimStyle
          ]}
        >
          <Mic 
            size={20} 
            color={micIconColor} 
            strokeWidth={2.4} 
          />
        </Animated.View>
      </View>

      {/* ── Send button when locked into hands-free mode ── */}
      {isLocked && (
        <TouchableOpacity
          key="recording-locked-send"
          onPress={() => stopRecording(true)}
          style={[styles.micBtn, styles.lockedSendAbsolute]}
          activeOpacity={0.8}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <View 
            style={[
              styles.micCircle, 
              { 
                backgroundColor: circleBg, 
                shadowColor: circleBg,
              }
            ]}
          >
            <Send size={18} color={micIconColor} />
          </View>
        </TouchableOpacity>
      )}

    </View>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  root: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  recordingOverlay: {
    position: 'absolute',
    right: 48,
    top: 0,
    bottom: 0,
    width: OVERLAY_WIDTH,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
    zIndex: 10,
  },
  micBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
    ...(Platform.OS === 'web' ? {
      userSelect: 'none',
      touchAction: 'none',
      WebkitUserSelect: 'none',
      cursor: 'pointer',
    } : {}),
  },
  micCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.28,
    shadowRadius: 5,
    elevation: 4,
  },
  micBtnActive: {
    backgroundColor: 'transparent',
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
  lockedSendAbsolute: {
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 20,
  },
});
