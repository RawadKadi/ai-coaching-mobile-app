import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator, StatusBar, Alert, Dimensions, TouchableWithoutFeedback, Keyboard } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { MotiView } from 'moti';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  runOnJS,
  interpolate
} from 'react-native-reanimated';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { 
  ChevronLeft, 
  ChevronRight, 
  Zap, 
  Heart, 
  Target, 
  CheckCircle2,
  Timer,
  Scale,
  Check
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/BrandContext';
import { isDarkColor } from '@/lib/theme-utils';
import FeedbackModal from '@/components/FeedbackModal';
import { getLastNightSleep, getLatestWeight } from '@/lib/health-service';
import { processCheckInAI } from '@/lib/checkin-ai-service';

type Step = 'metrics' | 'vitals' | 'mood';

export default function CheckInScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { client } = useAuth();
  const theme = useTheme();
  const colors = theme.colors;

  // Dynamic theme contrast logic
  const isDark = isDarkColor(colors.background || '#010417');
  const textColor = colors.text || (isDark ? '#FFFFFF' : '#0F172A');
  const textSecondaryColor = colors.textSecondary || (isDark ? '#94A3B8' : '#64748B');
  const cardBg = colors.surface || (isDark ? '#0F172A' : '#FFFFFF');
  const cardBorder = colors.border || (isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0');
  const placeholderColor = isDark ? '#475569' : '#94A3B8';

  const [currentStep, setCurrentStep] = useState<Step>('metrics');
  const [loading, setLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [alreadyCheckedIn, setAlreadyCheckedIn] = useState(false);
  const [lastWeight, setLastWeight] = useState<string | null>(null);
  const [showAcknowledgment, setShowAcknowledgment] = useState(false);

  // Form State
  const [weight, setWeight] = useState('');
  const [sleep, setSleep] = useState('');
  const [isWeightFromHealth, setIsWeightFromHealth] = useState(false);
  const [isSleepFromHealth, setIsSleepFromHealth] = useState(false);
  const [energy, setEnergy] = useState(7);
  const [stress, setStress] = useState(3);
  const [hunger, setHunger] = useState(5);
  const [mood, setMood] = useState('Focused');
  const [notes, setNotes] = useState('');

  const moods = ['Energized', 'Focused', 'Tired', 'Stressed', 'Happy', 'Calm', 'Recovering'];

  const isMetricsValid = weight.trim() !== '' && sleep.trim() !== '';

  useEffect(() => {
    checkTodayStatus();
    fetchLastWeight();
    fetchHealthData();
  }, [client]);

  const fetchHealthData = async () => {
    try {
      const [healthSleep, healthWeight] = await Promise.all([
        getLastNightSleep(),
        getLatestWeight(),
      ]);

      if (healthWeight !== null) {
        setWeight(healthWeight.toString());
        setIsWeightFromHealth(true);
      }
      if (healthSleep !== null) {
        setSleep(healthSleep.toString());
        setIsSleepFromHealth(true);
      }
    } catch (e) {
      console.warn('Error fetching health sync data:', e);
    }
  };

  const fetchLastWeight = async () => {
    if (!client) return;
    try {
      const { data } = await supabase
        .from('check_ins')
        .select('weight_kg')
        .eq('client_id', client.id)
        .not('weight_kg', 'is', null)
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data?.weight_kg) {
        setLastWeight(data.weight_kg.toString());
      }
    } catch (e) {
      console.error('Error fetching last weight:', e);
    }
  };

  const checkTodayStatus = async () => {
    if (!client) return;
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('check_ins')
        .select('id')
        .eq('client_id', client.id)
        .eq('date', today)
        .maybeSingle();
      
      if (data) setAlreadyCheckedIn(true);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!client) return;
    setSaveLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('check_ins')
        .upsert({
          client_id: client.id,
          date: today,
          weight_kg: weight ? parseFloat(weight) : null,
          sleep_hours: sleep ? parseFloat(sleep) : null,
          energy_level: energy,
          stress_level: stress,
          hunger_level: hunger,
          mood: mood,
          notes: notes,
        }, { onConflict: 'client_id,date' })
        .select()
        .single();

      if (error) throw error;
      
      const checkinData = data;

      // Show modal immediately
      setShowAcknowledgment(true);

      // Trigger AI analysis asynchronously with guaranteed speed & fallback
      processCheckInAI(checkinData.id, {
        weight,
        sleep,
        energy,
        stress,
        hunger,
        mood,
        notes,
      }).catch((aiError) => {
        console.error("AI Analysis failed in background:", aiError);
      });
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save check-in');
    } finally {
      setSaveLoading(false);
    }
  };

  const renderHeader = () => (
    <View style={{ paddingTop: insets.top + 20 }} className="px-6 flex-row items-center justify-between mb-8">
      <TouchableOpacity 
        onPress={() => router.back()}
        style={{
          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : cardBg,
          borderColor: cardBorder,
        }}
        className="w-12 h-12 rounded-2xl items-center justify-center border"
      >
        <ChevronLeft size={24} color={textColor} />
      </TouchableOpacity>
      <View className="items-center">
        <Text style={{ color: textColor }} className="font-black text-xs uppercase tracking-[4px]">Daily Check-in</Text>
        <Text style={{ color: theme.colors.primary }} className="font-bold text-[10px] mt-1">
          STEP {['metrics', 'vitals', 'mood'].indexOf(currentStep) + 1} OF 3
        </Text>
      </View>
      <TouchableOpacity 
        key={`header-check-${currentStep === 'metrics' && !isMetricsValid ? 'disabled' : 'enabled'}`}
        onPress={() => {
          if (currentStep === 'metrics') setCurrentStep('vitals');
          else if (currentStep === 'vitals') setCurrentStep('mood');
          else if (currentStep === 'mood') handleSave();
        }}
        disabled={currentStep === 'metrics' && !isMetricsValid}
        style={{
          backgroundColor: currentStep === 'metrics' && !isMetricsValid 
            ? (isDark ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.15)') 
            : theme.colors.primary,
          opacity: currentStep === 'metrics' && !isMetricsValid ? 0.5 : 1,
        }}
        className="w-12 h-12 rounded-full items-center justify-center shadow-lg"
      >
        <Check size={20} color={theme.colors.textOnPrimary || '#FFFFFF'} strokeWidth={3} />
      </TouchableOpacity>
    </View>
  );

  const renderMetrics = () => (
    <MotiView
      from={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex-1 px-8"
    >
      <View className="mb-10">
        <Text style={{ color: textColor }} className="text-4xl font-black tracking-tighter">Physical Status</Text>
        <Text style={{ color: textSecondaryColor }} className="font-medium text-lg mt-2">Let's track your core metrics for today.</Text>
      </View>

      <View className="gap-6">
        <View 
          style={{ backgroundColor: cardBg, borderColor: cardBorder }}
          className="rounded-[32px] p-6 border shadow-sm"
        >
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-row items-center gap-3">
              <View 
                style={{ backgroundColor: `${theme.colors.primary}15`, borderColor: `${theme.colors.primary}30` }}
                className="w-10 h-10 rounded-xl items-center justify-center border"
              >
                <Scale size={20} color={theme.colors.primary} />
              </View>
              <Text style={{ color: textColor }} className="font-bold text-lg">Body Weight</Text>
            </View>
            <View className="flex-row items-center gap-2">
              {isWeightFromHealth && (
                <View className="bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-full flex-row items-center gap-1.5">
                  <Check size={12} color="#10B981" />
                  <Text className="text-emerald-500 text-[10px] font-black uppercase tracking-wider">From Health</Text>
                </View>
              )}
              {lastWeight && !isWeightFromHealth && (
                <TouchableOpacity 
                  onPress={() => {
                    setWeight(lastWeight);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={{
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : (colors.inputBackground || '#F1F5F9'),
                    borderColor: cardBorder,
                  }}
                  className="px-3 py-1.5 rounded-full border"
                >
                  <Text style={{ color: textSecondaryColor }} className="text-[10px] font-black uppercase tracking-wider">Same as before</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
          <View className="flex-row items-center">
            <TextInput
              value={weight}
              onChangeText={(text) => {
                setWeight(text);
                if (isWeightFromHealth) setIsWeightFromHealth(false);
              }}
              placeholder="0.0"
              placeholderTextColor={placeholderColor}
              keyboardType="numeric"
              style={{ color: textColor }}
              className="text-5xl font-black flex-1"
            />
            <Text style={{ color: textSecondaryColor }} className="text-xl font-bold ml-2">KG</Text>
          </View>
        </View>

        <View 
          style={{ backgroundColor: cardBg, borderColor: cardBorder }}
          className="rounded-[32px] p-6 border shadow-sm"
        >
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-row items-center gap-3">
              <View 
                style={{ backgroundColor: `${theme.colors.secondary || '#10B981'}15`, borderColor: `${theme.colors.secondary || '#10B981'}30` }}
                className="w-10 h-10 rounded-xl items-center justify-center border"
              >
                <Timer size={20} color={theme.colors.secondary || '#10B981'} />
              </View>
              <Text style={{ color: textColor }} className="font-bold text-lg">Sleep Duration</Text>
            </View>
            {isSleepFromHealth && (
              <View className="bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-full flex-row items-center gap-1.5">
                <Check size={12} color="#10B981" />
                <Text className="text-emerald-500 text-[10px] font-black uppercase tracking-wider">From Health</Text>
              </View>
            )}
          </View>
          <View className="flex-row items-center">
            <TextInput
              value={sleep}
              onChangeText={(text) => {
                setSleep(text);
                if (isSleepFromHealth) setIsSleepFromHealth(false);
              }}
              placeholder="0.0"
              placeholderTextColor={placeholderColor}
              keyboardType="numeric"
              style={{ color: textColor }}
              className="text-5xl font-black flex-1"
            />
            <Text style={{ color: textSecondaryColor }} className="text-xl font-bold ml-2">HOURS</Text>
          </View>
        </View>
      </View>

      <View className="flex-1" />
      <TouchableOpacity 
        key={`continue-btn-${isMetricsValid}`}
        onPress={() => isMetricsValid && setCurrentStep('vitals')}
        disabled={!isMetricsValid}
        style={{
          backgroundColor: isMetricsValid ? theme.colors.primary : (isDark ? '#1E293B' : '#E2E8F0'),
          opacity: isMetricsValid ? 1 : 0.6,
        }}
        className="h-20 rounded-[32px] items-center justify-center flex-row gap-3 mb-10 shadow-2xl"
      >
        <Text 
          style={{ 
            color: isMetricsValid 
              ? (theme.colors.textOnPrimary || '#FFFFFF') 
              : (isDark ? '#64748B' : '#94A3B8') 
          }} 
          className="font-black text-lg uppercase tracking-widest"
        >
          Continue
        </Text>
        <ChevronRight 
          size={20} 
          color={isMetricsValid ? (theme.colors.textOnPrimary || '#FFFFFF') : (isDark ? '#64748B' : '#94A3B8')} 
          strokeWidth={3} 
        />
      </TouchableOpacity>
    </MotiView>
  );

  const renderVitals = () => (
    <MotiView
      from={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex-1 px-8"
    >
      <View className="mb-10">
        <Text style={{ color: textColor }} className="text-4xl font-black tracking-tighter">Energy & Recovery</Text>
        <Text style={{ color: textSecondaryColor }} className="font-medium text-lg mt-2">How are your internal levels today?</Text>
      </View>

      <View className="gap-10">
        <ElasticSlider 
          label="Energy Level" 
          value={energy} 
          min={1} max={10} 
          onChange={setEnergy} 
          icon={<Zap size={18} color={theme.colors.primary} />}
          color={theme.colors.primary}
          textColor={textColor}
          textSecondaryColor={textSecondaryColor}
          isDark={isDark}
          cardBorder={cardBorder}
        />
        <ElasticSlider 
          label="Stress Level" 
          value={stress} 
          min={1} max={10} 
          onChange={setStress} 
          icon={<Heart size={18} color={theme.colors.primary} />}
          color={theme.colors.primary}
          textColor={textColor}
          textSecondaryColor={textSecondaryColor}
          isDark={isDark}
          cardBorder={cardBorder}
        />
        <ElasticSlider 
          label="Hunger Level" 
          value={hunger} 
          min={1} max={10} 
          onChange={setHunger} 
          icon={<Target size={18} color={theme.colors.primary} />}
          color={theme.colors.primary}
          textColor={textColor}
          textSecondaryColor={textSecondaryColor}
          isDark={isDark}
          cardBorder={cardBorder}
        />
      </View>

      <View className="flex-1" />
      <View className="flex-row gap-4 mb-10">
        <TouchableOpacity 
          onPress={() => setCurrentStep('metrics')}
          style={{
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : cardBg,
            borderColor: cardBorder,
          }}
          className="w-20 rounded-[32px] items-center justify-center border"
        >
          <ChevronLeft size={24} color={textColor} />
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={() => setCurrentStep('mood')}
          style={{ backgroundColor: theme.colors.primary }}
          className="flex-1 h-20 rounded-[32px] items-center justify-center flex-row gap-3 shadow-2xl"
        >
          <Text style={{ color: theme.colors.textOnPrimary || '#FFFFFF' }} className="font-black text-lg uppercase tracking-widest">
            Continue
          </Text>
          <ChevronRight size={20} color={theme.colors.textOnPrimary || '#FFFFFF'} strokeWidth={3} />
        </TouchableOpacity>
      </View>
    </MotiView>
  );

  const renderMood = () => (
    <MotiView
      from={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex-1 px-8"
    >
      <View className="mb-10">
        <Text style={{ color: textColor }} className="text-4xl font-black tracking-tighter">Mindset & Notes</Text>
        <Text style={{ color: textSecondaryColor }} className="font-medium text-lg mt-2">Capture your mental state and any notes.</Text>
      </View>

      <Text style={{ color: textSecondaryColor }} className="text-[10px] font-black uppercase tracking-[3px] mb-4">Core Mindset</Text>
      <View className="flex-row flex-wrap gap-2 mb-10">
        {moods.map((m) => {
          const isSelected = mood === m;
          return (
            <TouchableOpacity 
              key={m}
              onPress={() => setMood(m)}
              style={{
                backgroundColor: isSelected 
                  ? theme.colors.primary 
                  : (isDark ? 'rgba(255, 255, 255, 0.05)' : cardBg),
                borderColor: isSelected 
                  ? theme.colors.primary 
                  : cardBorder,
              }}
              className="px-6 py-3 rounded-2xl border"
            >
              <Text 
                style={{ 
                  color: isSelected 
                    ? (theme.colors.textOnPrimary || '#FFFFFF') 
                    : textColor 
                }} 
                className="font-bold"
              >
                {m}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={{ color: textSecondaryColor }} className="text-[10px] font-black uppercase tracking-[3px] mb-4">Notes for Coach</Text>
      <View 
        style={{
          backgroundColor: cardBg,
          borderColor: cardBorder,
        }}
        className="rounded-[32px] p-6 border min-h-[160px] shadow-sm"
      >
        <TextInput
          multiline
          placeholder="How was your training? Any injuries or wins?"
          placeholderTextColor={placeholderColor}
          value={notes}
          onChangeText={setNotes}
          style={{ 
            color: textColor, 
            textAlignVertical: 'top' 
          }}
          className="font-medium text-lg flex-1"
        />
      </View>

      <View className="flex-1" />
      <View className="flex-row gap-4 mb-10">
        <TouchableOpacity 
          onPress={() => setCurrentStep('vitals')}
          style={{
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : cardBg,
            borderColor: cardBorder,
          }}
          className="w-20 rounded-[32px] items-center justify-center border"
        >
          <ChevronLeft size={24} color={textColor} />
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={handleSave}
          disabled={saveLoading}
          style={{ backgroundColor: theme.colors.primary }}
          className="flex-1 h-20 rounded-[32px] items-center justify-center flex-row gap-3 shadow-2xl"
        >
          {saveLoading ? (
            <ActivityIndicator color={theme.colors.textOnPrimary || '#FFFFFF'} />
          ) : (
            <>
              <Text style={{ color: theme.colors.textOnPrimary || '#FFFFFF' }} className="font-black text-lg uppercase tracking-widest">
                Submit Check-in
              </Text>
              <Check size={20} color={theme.colors.textOnPrimary || '#FFFFFF'} strokeWidth={3} />
            </>
          )}
        </TouchableOpacity>
      </View>
    </MotiView>
  );

  if (loading) {
    return (
      <View 
        style={{ flex: 1, backgroundColor: colors.background || (isDark ? '#020617' : '#F8FAFC') }} 
        className="items-center justify-center"
      >
        <ActivityIndicator color={theme.colors.primary} size="large" />
      </View>
    );
  }

  if (alreadyCheckedIn) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background || (isDark ? '#020617' : '#F8FAFC') }}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        {renderHeader()}
        <View className="flex-1 px-8 items-center justify-center">
          <View 
            style={{ 
              backgroundColor: `${theme.colors.primary}15`, 
              borderColor: `${theme.colors.primary}30` 
            }}
            className="w-24 h-24 rounded-[32px] items-center justify-center border mb-8"
          >
            <Heart size={40} color={theme.colors.primary} />
          </View>
          <Text style={{ color: textColor }} className="text-3xl font-black tracking-tighter text-center">
            Already Checked In
          </Text>
          <Text style={{ color: textSecondaryColor }} className="font-medium text-lg mt-4 text-center px-10">
            You've already completed your check-in for today. Rest up!
          </Text>
          <TouchableOpacity 
            onPress={() => router.back()}
            style={{
              backgroundColor: cardBg,
              borderColor: cardBorder,
            }}
            className="mt-12 px-10 py-5 rounded-[24px] border"
          >
            <Text style={{ color: textColor }} className="font-black text-xs uppercase tracking-widest">
              Back to Dashboard
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={{ flex: 1, backgroundColor: colors.background || (isDark ? '#020617' : '#F8FAFC') }}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        
        {renderHeader()}

        <View className="flex-1">
          {currentStep === 'metrics' && renderMetrics()}
          {currentStep === 'vitals' && renderVitals()}
          {currentStep === 'mood' && renderMood()}
        </View>

        <FeedbackModal
          visible={showAcknowledgment}
          onClose={() => {
            setShowAcknowledgment(false);
            router.back();
          }}
          variant="info"
          icon={<CheckCircle2 size={60} color={theme.colors.primary} />}
          title="Check-in Complete"
          body="Your update was sent to your coach."
          ctaLabel="Back to Dashboard"
        />
      </View>
    </TouchableWithoutFeedback>
  );
}

interface ElasticSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (val: number) => void;
  icon: React.ReactNode;
  color: string;
  textColor: string;
  textSecondaryColor: string;
  isDark: boolean;
  cardBorder: string;
}

const ElasticSlider = ({ 
  label, 
  value, 
  min, 
  max, 
  onChange, 
  icon, 
  color,
  textColor,
  textSecondaryColor,
  isDark,
  cardBorder,
}: ElasticSliderProps) => {
  const [containerWidth, setContainerWidth] = useState(0);
  
  // Shared values for high-performance UI thread animations
  const translationX = useSharedValue(0);
  const startX = useSharedValue(0);
  const isPressed = useSharedValue(false);
  
  // Update translationX when value prop changes (initial or external change)
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (containerWidth > 0 && !isPressed.value) {
      const initialPos = ((value - min) / (max - min)) * containerWidth;
      if (isFirstRender.current) {
        translationX.value = initialPos;
        isFirstRender.current = false;
      } else {
        translationX.value = withSpring(initialPos, { damping: 20 });
      }
      startX.value = initialPos;
    }
  }, [containerWidth, value]);

  // High-performance gesture handler
  const gesture = Gesture.Pan()
    .onBegin(() => {
      isPressed.value = true;
      startX.value = translationX.value;
    })
    .onUpdate((event) => {
      let newX = startX.value + event.translationX;
      
      // Elastic stretch logic
      if (newX < 0) {
        newX = newX * 0.35; // Apply tension
      } else if (newX > containerWidth) {
        newX = containerWidth + (newX - containerWidth) * 0.35; // Apply tension
      }
      
      translationX.value = newX;
      
      // Calculate and trigger state update
      const clampedX = Math.max(0, Math.min(containerWidth, newX));
      const percentage = clampedX / containerWidth;
      const newValue = Math.round(percentage * (max - min) + min);
      
      if (newValue !== value) {
        runOnJS(onChange)(newValue);
        runOnJS(Haptics.selectionAsync)();
      }
    })
    .onFinalize(() => {
      isPressed.value = false;
      
      // Snap back to boundaries if stretched
      if (translationX.value < 0) {
        translationX.value = withSpring(0);
        startX.value = 0;
      } else if (translationX.value > containerWidth) {
        translationX.value = withSpring(containerWidth);
        startX.value = containerWidth;
      } else {
        startX.value = translationX.value;
      }
      
      runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
    });

  const animatedThumbStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translationX.value },
      { scale: withSpring(isPressed.value ? 1.2 : 1) }
    ],
  }));

  const animatedProgressStyle = useAnimatedStyle(() => ({
    width: interpolate(
      translationX.value,
      [0, containerWidth],
      [0, containerWidth],
      'clamp'
    ),
  }));

  return (
    <View className="mb-8">
      <View className="flex-row items-center justify-between mb-6">
        <View className="flex-row items-center gap-3">
          <View style={{ backgroundColor: `${color}1a`, borderColor: `${color}33` }} className="w-10 h-10 rounded-xl items-center justify-center border">
            {icon}
          </View>
          <Text style={{ color: textColor }} className="font-black text-lg tracking-tight">{label}</Text>
        </View>
        <Text style={{ color }} className="text-2xl font-black">{value}</Text>
      </View>
      
      <GestureDetector gesture={gesture}>
        <View 
          onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
          style={{ height: 44, justifyContent: 'center' }}
        >
          {/* Background Track */}
          <View 
            style={{ 
              backgroundColor: isDark ? '#1E293B' : '#E2E8F0',
              borderColor: cardBorder,
            }} 
            className="h-3 rounded-full border overflow-hidden"
          >
            <Animated.View 
              style={[{ height: '100%', backgroundColor: color }, animatedProgressStyle]} 
            />
          </View>
          
          {/* Elastic Thumb */}
          <Animated.View
            style={[
              { 
                position: 'absolute',
                width: 24,
                height: 24,
                backgroundColor: '#FFFFFF',
                borderRadius: 16,
                borderWidth: 4,
                borderColor: color,
                shadowColor: color,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.4,
                shadowRadius: 10,
                elevation: 8,
                left: -16
              },
              animatedThumbStyle
            ]}
          />
        </View>
      </GestureDetector>

      <View className="flex-row justify-between mt-3 px-1">
        <Text style={{ color: textSecondaryColor }} className="text-[10px] font-black uppercase tracking-widest">Low</Text>
        <Text style={{ color: textSecondaryColor }} className="text-[10px] font-black uppercase tracking-widest">Peak</Text>
      </View>
    </View>
  );
};
