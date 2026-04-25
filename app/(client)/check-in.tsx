import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, StatusBar, Alert, Dimensions, StyleSheet, PanResponder, TouchableWithoutFeedback, Keyboard } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { MotiView, AnimatePresence } from 'moti';
import { 
  ChevronLeft, 
  ChevronRight, 
  Zap, 
  Moon, 
  TrendingUp, 
  Heart, 
  Target, 
  Smile, 
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Timer,
  Scale,
  Check
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/BrandContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Step = 'metrics' | 'vitals' | 'mood' | 'summary';

export default function CheckInScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { client, profile } = useAuth();
  const theme = useTheme();

  const [currentStep, setCurrentStep] = useState<Step>('metrics');
  const [loading, setLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [alreadyCheckedIn, setAlreadyCheckedIn] = useState(false);
  const [lastWeight, setLastWeight] = useState<string | null>(null);

  // Form State
  const [weight, setWeight] = useState('');
  const [sleep, setSleep] = useState('');
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
  }, [client]);

  const fetchLastWeight = async () => {
    if (!client) return;
    try {
      const { data, error } = await supabase
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
      const { data, error } = await supabase
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
      const { error } = await supabase
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
        });

      if (error) throw error;

      // Success animation then back
      setCurrentStep('summary');
      setTimeout(() => {
        router.back();
      }, 2500);
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
        className="w-12 h-12 bg-slate-900/50 rounded-2xl items-center justify-center border border-white/5"
      >
        <ChevronLeft size={24} color="white" />
      </TouchableOpacity>
      <View className="items-center">
        <Text className="text-white font-black text-xs uppercase tracking-[4px]">Daily Protocol</Text>
        <Text className="text-blue-500 font-bold text-[10px] mt-1">STEP {['metrics', 'vitals', 'mood', 'summary'].indexOf(currentStep) + 1} OF 4</Text>
      </View>
      <TouchableOpacity 
        onPress={() => {
          if (currentStep === 'metrics') setCurrentStep('vitals');
          else if (currentStep === 'vitals') setCurrentStep('mood');
          else if (currentStep === 'mood') handleSave();
        }}
        disabled={currentStep === 'metrics' && !isMetricsValid}
        className={`w-12 h-12 rounded-full items-center justify-center ${
          currentStep === 'metrics' && !isMetricsValid 
            ? 'bg-blue-600/20 opacity-50' 
            : 'bg-blue-600 shadow-lg shadow-blue-500/50'
        }`}
      >
        <Check size={20} color="white" strokeWidth={3} />
      </TouchableOpacity>
    </View>
  );

  const renderMetrics = () => (
    <MotiView
      from={{ opacity: 0, translateX: 50 }}
      animate={{ opacity: 1, translateX: 0 }}
      exit={{ opacity: 0, translateX: -50 }}
      className="flex-1 px-8"
    >
      <View className="mb-10">
        <Text className="text-white text-4xl font-black tracking-tighter">Physical Status</Text>
        <Text className="text-slate-500 font-medium text-lg mt-2">Let's track your core metrics for today.</Text>
      </View>

      <View className="gap-6">
        <View className="bg-slate-900/40 rounded-[32px] p-6 border border-white/5">
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 bg-blue-600/10 rounded-xl items-center justify-center border border-blue-600/20">
                <Scale size={20} color="#3B82F6" />
              </View>
              <Text className="text-white font-bold text-lg">Body Weight</Text>
            </View>
            {lastWeight && (
              <TouchableOpacity 
                onPress={() => {
                  setWeight(lastWeight);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                className="bg-slate-800/80 px-3 py-1.5 rounded-full border border-white/10"
              >
                <Text className="text-slate-400 text-[10px] font-black uppercase tracking-wider">Same as before</Text>
              </TouchableOpacity>
            )}
          </View>
          <View className="flex-row items-center">
            <TextInput
              value={weight}
              onChangeText={setWeight}
              placeholder="0.0"
              placeholderTextColor="#334155"
              keyboardType="numeric"
              className="text-white text-5xl font-black flex-1"
            />
            <Text className="text-slate-500 text-xl font-bold ml-2">KG</Text>
          </View>
        </View>

        <View className="bg-slate-900/40 rounded-[32px] p-6 border border-white/5">
          <View className="flex-row items-center gap-3 mb-4">
            <View className="w-10 h-10 bg-indigo-600/10 rounded-xl items-center justify-center border border-indigo-600/20">
              <Timer size={20} color="#818CF8" />
            </View>
            <Text className="text-white font-bold text-lg">Sleep Duration</Text>
          </View>
          <View className="flex-row items-center">
            <TextInput
              value={sleep}
              onChangeText={setSleep}
              placeholder="0.0"
              placeholderTextColor="#334155"
              keyboardType="numeric"
              className="text-white text-5xl font-black flex-1"
            />
            <Text className="text-slate-500 text-xl font-bold ml-2">HOURS</Text>
          </View>
        </View>
      </View>

      <View className="flex-1" />
      <TouchableOpacity 
        onPress={() => isMetricsValid && setCurrentStep('vitals')}
        disabled={!isMetricsValid}
        className={`${
          isMetricsValid ? 'bg-blue-600 shadow-blue-500/30' : 'bg-slate-800 opacity-50'
        } h-20 rounded-[32px] items-center justify-center flex-row gap-3 mb-10 shadow-2xl`}
      >
        <Text className="text-white font-black text-lg uppercase tracking-widest">Continue</Text>
        <ChevronRight size={20} color="white" strokeWidth={3} />
      </TouchableOpacity>
    </MotiView>
  );

  const renderVitals = () => (
    <MotiView
      from={{ opacity: 0, translateX: 50 }}
      animate={{ opacity: 1, translateX: 0 }}
      exit={{ opacity: 0, translateX: -50 }}
      className="flex-1 px-8"
    >
      <View className="mb-10">
        <Text className="text-white text-4xl font-black tracking-tighter">Vitality Shield</Text>
        <Text className="text-slate-500 font-medium text-lg mt-2">How are your internal levels today?</Text>
      </View>

      <View className="gap-10">
        <ElasticSlider 
          label="Energy Level" 
          value={energy} 
          min={1} max={10} 
          onChange={setEnergy} 
          icon={<Zap size={18} color="#F59E0B" />}
          color="#F59E0B"
        />
        <ElasticSlider 
          label="Stress Level" 
          value={stress} 
          min={1} max={10} 
          onChange={setStress} 
          icon={<Heart size={18} color="#EF4444" />}
          color="#EF4444"
        />
        <ElasticSlider 
          label="Hunger Level" 
          value={hunger} 
          min={1} max={10} 
          onChange={setHunger} 
          icon={<Target size={18} color="#10B981" />}
          color="#10B981"
        />
      </View>

      <View className="flex-1" />
      <View className="flex-row gap-4 mb-10">
        <TouchableOpacity 
          onPress={() => setCurrentStep('metrics')}
          className="w-20 bg-slate-900 rounded-[32px] items-center justify-center border border-white/5"
        >
          <ChevronLeft size={24} color="white" />
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={() => setCurrentStep('mood')}
          className="flex-1 bg-blue-600 h-20 rounded-[32px] items-center justify-center flex-row gap-3 shadow-2xl shadow-blue-500/30"
        >
          <Text className="text-white font-black text-lg uppercase tracking-widest">Next Phase</Text>
          <ChevronRight size={20} color="white" strokeWidth={3} />
        </TouchableOpacity>
      </View>
    </MotiView>
  );

  const renderMood = () => (
    <MotiView
      from={{ opacity: 0, translateX: 50 }}
      animate={{ opacity: 1, translateX: 0 }}
      exit={{ opacity: 0, translateX: -50 }}
      className="flex-1 px-8"
    >
      <View className="mb-10">
        <Text className="text-white text-4xl font-black tracking-tighter">Psychological Ops</Text>
        <Text className="text-slate-500 font-medium text-lg mt-2">Capture your mental state and any notes.</Text>
      </View>

      <Text className="text-slate-500 text-[10px] font-black uppercase tracking-[3px] mb-4">Core Mindset</Text>
      <View className="flex-row flex-wrap gap-2 mb-10">
        {moods.map((m) => (
          <TouchableOpacity 
            key={m}
            onPress={() => setMood(m)}
            className={`px-6 py-3 rounded-2xl border ${mood === m ? 'bg-blue-600 border-blue-500' : 'bg-slate-900 border-white/5'}`}
          >
            <Text className={`font-bold ${mood === m ? 'text-white' : 'text-slate-400'}`}>{m}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text className="text-slate-500 text-[10px] font-black uppercase tracking-[3px] mb-4">Debrief Notes</Text>
      <View className="bg-slate-900/40 rounded-[32px] p-6 border border-white/5 min-h-[160px]">
        <TextInput
          multiline
          placeholder="How was your training? Any injuries or wins?"
          placeholderTextColor="#334155"
          value={notes}
          onChangeText={setNotes}
          className="text-white font-medium text-lg"
          style={{ textAlignVertical: 'top' }}
        />
      </View>

      <View className="flex-1" />
      <View className="flex-row gap-4 mb-10">
        <TouchableOpacity 
          onPress={() => setCurrentStep('vitals')}
          className="w-20 bg-slate-900 rounded-[32px] items-center justify-center border border-white/5"
        >
          <ChevronLeft size={24} color="white" />
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={handleSave}
          disabled={saveLoading}
          className="flex-1 bg-blue-600 h-20 rounded-[32px] items-center justify-center flex-row gap-3 shadow-2xl shadow-blue-500/30"
        >
          {saveLoading ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <Text className="text-white font-black text-lg uppercase tracking-widest">Sync Protocol</Text>
              <Sparkles size={20} color="white" strokeWidth={3} />
            </>
          )}
        </TouchableOpacity>
      </View>
    </MotiView>
  );

  const renderSummary = () => (
    <MotiView
      from={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="flex-1 px-8 items-center justify-center"
    >
      <MotiView
        from={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', delay: 200 }}
        className="w-32 h-32 bg-emerald-500/10 rounded-[48px] items-center justify-center border-4 border-emerald-500/20 mb-8"
      >
        <CheckCircle2 size={64} color="#10B981" strokeWidth={2.5} />
      </MotiView>
      <Text className="text-white text-4xl font-black tracking-tighter text-center">Protocol Synced</Text>
      <Text className="text-slate-500 font-medium text-lg mt-4 text-center px-10">Your coach has been notified. Keep smashing it!</Text>
      
      <MotiView
        from={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1000 }}
        className="mt-12 flex-row items-center gap-2"
      >
        <ActivityIndicator size="small" color="#334155" />
        <Text className="text-slate-700 font-black text-[10px] uppercase tracking-[3px]">Returning to base</Text>
      </MotiView>
    </MotiView>
  );

  if (loading) {
    return (
      <View className="flex-1 bg-slate-950 items-center justify-center">
        <ActivityIndicator color="#3B82F6" size="large" />
      </View>
    );
  }

  if (alreadyCheckedIn && currentStep !== 'summary') {
    return (
      <View className="flex-1 bg-slate-950">
        <StatusBar barStyle="light-content" />
        {renderHeader()}
        <View className="flex-1 px-8 items-center justify-center">
          <View className="w-24 h-24 bg-blue-600/10 rounded-[32px] items-center justify-center border border-blue-600/20 mb-8">
            <Heart size={40} color="#3B82F6" />
          </View>
          <Text className="text-white text-3xl font-black tracking-tighter text-center">Already Synced</Text>
          <Text className="text-slate-500 font-medium text-lg mt-4 text-center px-10">You've already completed your daily protocol. Rest up!</Text>
          <TouchableOpacity 
            onPress={() => router.back()}
            className="mt-12 bg-slate-900 px-10 py-5 rounded-[24px] border border-white/5"
          >
            <Text className="text-white font-black text-xs uppercase tracking-widest">Return to Base</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={{ flex: 1 }} className="bg-slate-950">
        <StatusBar barStyle="light-content" />
        
        <AnimatePresence>
          {currentStep !== 'summary' && renderHeader()}
        </AnimatePresence>

        <View className="flex-1">
          <AnimatePresence>
            {currentStep === 'metrics' && renderMetrics()}
            {currentStep === 'vitals' && renderVitals()}
            {currentStep === 'mood' && renderMood()}
            {currentStep === 'summary' && renderSummary()}
          </AnimatePresence>
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
}

import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  withTiming, 
  runOnJS,
  useDerivedValue,
  interpolate
} from 'react-native-reanimated';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';

const ElasticSlider = ({ label, value, min, max, onChange, icon, color }: any) => {
  const [containerWidth, setContainerWidth] = useState(0);
  
  // Shared values for high-performance UI thread animations
  const translationX = useSharedValue(0);
  const startX = useRef(0);
  const isPressed = useSharedValue(false);
  
  // Update translationX when value prop changes (initial or external change)
  useEffect(() => {
    if (containerWidth > 0 && !isPressed.value) {
      const initialPos = ((value - min) / (max - min)) * containerWidth;
      translationX.value = withSpring(initialPos, { damping: 20 });
      startX.current = initialPos;
    }
  }, [containerWidth, value]);

  // High-performance gesture handler
  const gesture = Gesture.Pan()
    .onBegin(() => {
      isPressed.value = true;
    })
    .onUpdate((event) => {
      let newX = startX.current + event.translationX;
      
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
        startX.current = 0;
      } else if (translationX.value > containerWidth) {
        translationX.value = withSpring(containerWidth);
        startX.current = containerWidth;
      } else {
        startX.current = translationX.value;
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
          <Text className="text-white font-black text-lg tracking-tight">{label}</Text>
        </View>
        <Text style={{ color }} className="text-2xl font-black">{value}</Text>
      </View>
      
      <GestureDetector gesture={gesture}>
        <View 
          onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
          style={{ height: 44, justifyContent: 'center' }}
        >
          {/* Background Track */}
          <View className="h-4 bg-slate-900 rounded-full border border-white/5 overflow-hidden">
            <Animated.View 
              style={[{ height: '100%', backgroundColor: color }, animatedProgressStyle]} 
            />
          </View>
          
          {/* Elastic Thumb */}
          <Animated.View
            style={[
              { 
                position: 'absolute',
                width: 32,
                height: 32,
                backgroundColor: 'white',
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
        <Text className="text-slate-700 text-[10px] font-black uppercase tracking-widest">Low</Text>
        <Text className="text-slate-700 text-[10px] font-black uppercase tracking-widest">Peak</Text>
      </View>
    </View>
  );
};
