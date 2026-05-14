import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Platform, PanResponder, Animated as RNAnimated } from 'react-native';
import { Mic, Trash2, Send, Lock, ArrowUp, ChevronLeft } from 'lucide-react-native';
import { MotiView, AnimatePresence } from 'moti';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  withTiming,
  interpolate,
  Extrapolate,
  runOnJS
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface VoiceInputProps {
  onStart?: () => void;
  onStop?: (uri: string, duration: number) => void;
  onCancel?: () => void;
  theme: any;
  disabled?: boolean;
  style?: any;
}

export function VoiceInput({ onStart, onStop, onCancel, theme, disabled, style }: VoiceInputProps) {
  console.log('VoiceInput rendering', { disabled });
  const [isRecording, setIsRecording] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [time, setTime] = useState(0);
  const [metering, setMetering] = useState<number[]>(new Array(40).fill(-160));
  
  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Animation values
  const translateY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const scale = useSharedValue(1);
  const lockOpacity = useSharedValue(0);

  useEffect(() => {
    // Pre-request permissions
    Audio.requestPermissionsAsync();
  }, []);

  const isInitializingRef = useRef(false);
  const pendingStopRef = useRef<{ shouldSend: boolean } | null>(null);

  const startRecording = async () => {
    if (disabled || recordingRef.current || isRecording || isInitializingRef.current) return;
    
    isInitializingRef.current = true;
    pendingStopRef.current = null;
    // Instant feedback - NO AWAIT HERE
    setIsRecording(true);
    setTime(0);
    scale.value = withSpring(1.3);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      console.log('Voice recording: Initializing audio...');
      
      const permission = await Audio.getPermissionsAsync();
      if (permission.status !== 'granted') {
        const request = await Audio.requestPermissionsAsync();
        if (request.status !== 'granted') {
          setIsRecording(false);
          isInitializingRef.current = false;
          return;
        }
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
        (status) => {
          if (status.metering !== undefined) {
            setMetering(prev => {
              const newMetering = [...prev.slice(1), status.metering || -160];
              return newMetering;
            });
          }
        },
        50
      );
      
      recordingRef.current = recording;
      setIsRecording(true);
      setTime(0);
      
      // If user released during initialization, stop now
      if (pendingStopRef.current) {
        const { shouldSend } = pendingStopRef.current;
        pendingStopRef.current = null;
        stopRecording(shouldSend);
        return;
      }

      onStart?.();
      
      timerRef.current = setInterval(() => {
        setTime(t => t + 1);
      }, 1000);

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (err) {
      console.error('Failed to start recording', err);
      setIsRecording(false);
    } finally {
      isInitializingRef.current = false;
    }
  };

  const stopRecording = async (shouldSend: boolean) => {
    if (isInitializingRef.current) {
      console.log('Stop requested during initialization, marking pending');
      pendingStopRef.current = { shouldSend };
      return;
    }
    try {
      console.log('Voice recording: Stopping...', { shouldSend });
      if (timerRef.current) clearInterval(timerRef.current);
      
      const recording = recordingRef.current;
      recordingRef.current = null;
      
      let uri = null;
      let duration = 0;

      if (recording) {
        await recording.stopAndUnloadAsync();
        uri = recording.getURI();
        duration = time;
      }

      setIsRecording(false);
      setIsLocked(false);
      
      if (shouldSend && uri && duration >= 1) {
        onStop?.(uri, duration);
      } else {
        if (shouldSend && duration < 1 && recording) {
          console.log('Recording too short, discarding');
        }
        onCancel?.();
      }

      // Reset animations
      translateY.value = withSpring(0);
      translateX.value = withSpring(0);
      scale.value = withSpring(1);
      lockOpacity.value = withTiming(0);
      
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (err) {
      console.error('Failed to stop recording', err);
      setIsRecording(false);
      setIsLocked(false);
    }
  };

  // PanResponder to handle the touch interaction
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled,
      onMoveShouldSetPanResponder: () => !disabled,
      onPanResponderGrant: () => {
        if (disabled) return;
        console.log('PanResponder: Grant');
        startRecording();
        scale.value = withSpring(1.3);
      },
      onPanResponderMove: (_, gestureState) => {
        if (isLocked || disabled) return;

        // Vertical slide for locking
        if (gestureState.dy < -10) {
          translateY.value = gestureState.dy;
          lockOpacity.value = interpolate(
            gestureState.dy,
            [0, -20, -100],
            [0, 0.4, 1],
            Extrapolate.CLAMP
          );
        }

        // Horizontal slide for canceling
        if (gestureState.dx < -10) {
          translateX.value = gestureState.dx;
        }

        // Trigger lock if pulled up enough
        if (gestureState.dy < -100) {
          runOnJS(setIsLocked)(true);
          translateY.value = withSpring(0);
          lockOpacity.value = withTiming(0);
          runOnJS(Haptics.notificationAsync)(Haptics.NotificationFeedbackType.Success);
        }
        
        // Trigger cancel if pulled left enough
        if (gestureState.dx < -100) {
          stopRecording(false);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        console.log('PanResponder: Release', { dx: gestureState.dx, dy: gestureState.dy, isLocked });
        if (isLocked || disabled) return;
        
        if (gestureState.dx < -80) {
          stopRecording(false);
        } else {
          stopRecording(true);
        }
      },
      onPanResponderTerminate: () => {
        console.log('PanResponder: Terminated');
        if (!isLocked) stopRecording(false);
      }
    })
  ).current;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const animatedMicStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateY: isLocked ? 0 : translateY.value },
      { translateX: isLocked ? 0 : translateX.value },
    ],
  }));

  const animatedLockStyle = useAnimatedStyle(() => ({
    opacity: lockOpacity.value,
    transform: [{ translateY: translateY.value - 40 }],
  }));

  return (
    <View style={[
      styles.container, 
      isRecording && styles.containerActive,
      style
    ]}>
      <AnimatePresence>
        {isRecording && (
          <MotiView 
            from={{ opacity: 0, scale: 0.9, translateX: 20 }}
            animate={{ opacity: 1, scale: 1, translateX: 0 }}
            exit={{ opacity: 0, scale: 0.9, translateX: 20 }}
            style={[
              styles.recordingOverlay,
              !isLocked && { right: 56 }
            ]}
          >
            <View style={styles.recordingInfo}>
              <View style={styles.redDot} />
              <Text style={styles.timerText}>{formatTime(time)}</Text>
            </View>
            
            <View style={styles.waveformContainer}>
              {metering.map((level, i) => (
                <MotiView
                  key={i}
                  animate={{
                    height: Math.max(3, (level + 160) * 0.25),
                  }}
                  transition={{ type: 'timing', duration: 50 }}
                  style={[styles.waveBar, { backgroundColor: '#EF4444' }]}
                />
              ))}
            </View>

            {!isLocked && (
              <MotiView 
                from={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={styles.slideCancel}
              >
                <ChevronLeft size={16} color="#64748B" />
                <Text style={styles.slideCancelText}>Slide to cancel</Text>
              </MotiView>
            )}

            {isLocked && (
              <View style={styles.lockedControls}>
                <TouchableOpacity 
                  onPress={() => stopRecording(false)}
                  style={styles.lockActionBtn}
                >
                  <Trash2 size={20} color="#EF4444" />
                </TouchableOpacity>
                
                <TouchableOpacity 
                  onPress={() => stopRecording(true)}
                  style={[styles.lockActionBtn, { backgroundColor: '#3B82F6' }]}
                >
                  <Send size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            )}
          </MotiView>
        )}
      </AnimatePresence>

      {!isLocked && isRecording && (
        <Animated.View style={[styles.lockIndicator, animatedLockStyle]}>
          <View style={styles.lockIconContainer}>
            <Lock size={18} color="#FFFFFF" strokeWidth={2.5} />
          </View>
          <MotiView 
            animate={{ translateY: [-4, 0, -4] }}
            transition={{ loop: true, duration: 1000, type: 'timing' }}
          >
            <ArrowUp size={14} color="#64748B" strokeWidth={3} />
          </MotiView>
        </Animated.View>
      )}

      {!isLocked && (
        <View 
          {...panResponder.panHandlers}
          style={[
            styles.micButton, 
            { 
              backgroundColor: isRecording ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
              zIndex: 999,
            }
          ]}
        >
          <Animated.View style={animatedMicStyle}>
            {isRecording ? (
              <View style={styles.recordingPulse} />
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
  container: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  containerActive: {
    position: 'absolute',
    right: 0,
    width: SCREEN_WIDTH,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    zIndex: 1000,
  },
  micButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingOverlay: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 0,
    height: 48,
    backgroundColor: '#0F172A',
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    zIndex: 100,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  recordingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  redDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    marginRight: 6,
  },
  timerText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    minWidth: 35,
  },
  waveformContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 8,
    height: 30,
  },
  waveBar: {
    width: 2,
    borderRadius: 1,
  },
  slideCancel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 8,
  },
  slideCancelText: {
    color: '#64748B',
    fontSize: 13,
  },
  lockIndicator: {
    position: 'absolute',
    bottom: 60,
    right: 12,
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 80,
    gap: 8,
    zIndex: 1001,
  },
  lockIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 5,
  },
  recordingPulse: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#EF4444',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
  },
  lockedControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  lockActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
