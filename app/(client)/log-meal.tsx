import { useBrandColors, useTheme } from '@/contexts/BrandContext';
import { isDarkColor } from '@/lib/theme-utils';
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { MotiView, AnimatePresence } from 'moti';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import {
  X,
  ChevronLeft,
  AlertTriangle,
  Check,
  Plus,
  Minus,
  Send,
  RefreshCw,
  Image as ImageIcon,
  Camera,
  Zap,
  Activity,
  Flame,
  Apple,
  Utensils,
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  analyzeMealImage,
  reanalyzeMealWithContext,
  recalculateNutrition,
  MealAnalysisResult,
  reanalyzeMealWithFeedback,
  guessIngredientQuantity,
  generateMealName,
} from '@/lib/ai-meal-service';
import { MealIngredient } from '@/types/database';
import * as ImagePicker from 'expo-image-picker';
import FeedbackModal from '@/components/FeedbackModal';
import { formatCompactNumber } from '@/lib/format-utils';
import { safeBack } from '@/lib/navigation-utils';

type Step = 'camera' | 'analyzing' | 'needs_info' | 'review' | 'nutrition';

export default function LogMealScreen() {
  const colors = useBrandColors();
  const { isDarkMode } = useTheme();
  const isDark = isDarkMode || isDarkColor(colors.background || '#010417');
  const textColor = colors.text || (isDark ? '#FFFFFF' : '#0F172A');
  const textSecondaryColor =
    colors.textSecondary || (isDark ? '#94A3B8' : '#64748B');
  const cardBg = colors.surface || (isDark ? '#0F172A' : '#FFFFFF');
  const cardBorder =
    colors.border || (isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0');
  const inputBg =
    colors.inputBackground ||
    (isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F5F9');
  const primaryTextOnBtn =
    colors.textOnPrimary ||
    (isDarkColor(colors.primary) ? '#FFFFFF' : '#0F172A');
  const styles = getStyles(colors);
  const router = useRouter();
  const { client, user } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<any>(null);

  const [currentStep, setCurrentStep] = useState<Step>('camera');
  const [facing, setFacing] = useState<CameraType>('back');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] =
    useState<MealAnalysisResult | null>(null);
  const [ingredients, setIngredients] = useState<MealIngredient[]>([]);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackType, setFeedbackType] = useState<
    'wrong_name' | 'wrong_ingredients' | 'wrong_portion' | 'other'
  >('wrong_name');
  const [feedbackText, setFeedbackText] = useState('');
  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [guessingId, setGuessingId] = useState<string | null>(null);
  const [aiGuessedIds, setAiGuessedIds] = useState<Set<string>>(new Set());
  const [showAiTooltip, setShowAiTooltip] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [mealName, setMealName] = useState('');
  const [cookingMethod, setCookingMethod] = useState('');
  const [hasOil, setHasOil] = useState(false);
  const [showMealSuccess, setShowMealSuccess] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const inputRefs = useRef<{ [key: string]: TextInput | null }>({});

  useEffect(() => {
    if (!permission) requestPermission();
  }, []);

  if (!permission)
    return (
      <View
        style={{ flex: 1, backgroundColor: colors.background }}
        className="items-center justify-center"
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  if (!permission.granted)
    return (
      <View
        style={{ flex: 1, backgroundColor: colors.background }}
        className="items-center justify-center p-8"
      >
        <Text
          style={{ color: textColor }}
          className="text-center font-bold text-lg mb-6"
        >
          Camera access is needed to scan your meal.
        </Text>
        <TouchableOpacity
          onPress={requestPermission}
          style={{ backgroundColor: colors.primary }}
          className="px-8 py-4 rounded-3xl"
        >
          <Text style={{ color: primaryTextOnBtn }} className="font-black">
            Allow Camera
          </Text>
        </TouchableOpacity>
      </View>
    );

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.7,
          skipProcessing: false,
        });
        setCapturedImage(photo.uri);
        analyzeImage(photo.uri);
      } catch (e) {
        Alert.alert('Capture error');
      }
    }
  };

  const pickFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!result.canceled && result.assets[0]) {
      setCapturedImage(result.assets[0].uri);
      analyzeImage(result.assets[0].uri);
    }
  };

  const analyzeImage = async (imageUri: string) => {
    setCurrentStep('analyzing');
    setLoading(true);
    try {
      const result = await analyzeMealImage(imageUri, 'lebanese');
      setAnalysisResult(result);
      setIngredients(
        (result.ingredients || []).map((ing) => ({
          id: Math.random().toString(),
          meal_id: '',
          ingredient_name: ing.name || 'Unknown',
          quantity: ing.quantity || 0,
          unit: ing.unit || 'g',
          ai_detected: true,
          confidence: ing.confidence || 0,
          created_at: new Date().toISOString(),
        })),
      );
      if (result.needsMoreInfo) {
        setCurrentStep('needs_info');
        setShowInfoModal(true);
      } else {
        setCurrentStep('review');
      }
    } catch (e) {
      setCurrentStep('camera');
      setCapturedImage(null);
    } finally {
      setLoading(false);
    }
  };

  const saveMeal = async (shareWithCoach: boolean = false) => {
    if (!analysisResult || !client || !capturedImage) return;
    console.log('Starting saveMeal...', {
      shareWithCoach,
      hasClient: !!client,
      hasAnalysis: !!analysisResult,
    });
    setSaving(true);
    try {
      const fileExt = 'jpg';
      const fileName = `${client.id}/${Date.now()}.${fileExt}`;
      console.log('[saveMeal] Fetching image from URI:', capturedImage);
      const response = await fetch(capturedImage);
      if (!response.ok) throw new Error('Failed to fetch captured image');

      const arrayBuffer = await response.arrayBuffer();
      console.log('[saveMeal] Uploading to storage...', fileName);
      const { error: uploadError } = await supabase.storage
        .from('meal-photos')
        .upload(fileName, arrayBuffer, {
          contentType: 'image/jpeg',
          upsert: true,
        });
      if (uploadError) {
        console.error('[saveMeal] Upload error:', uploadError);
        throw uploadError;
      }

      console.log('[saveMeal] Upload successful, getting public URL');
      const {
        data: { publicUrl },
      } = supabase.storage.from('meal-photos').getPublicUrl(fileName);
      const now = new Date();
      console.log('[saveMeal] Calling RPC create_meal_entry');

      // Determine meal type based on time of day
      const hour = now.getHours();
      let mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack' = 'snack';
      if (hour >= 5 && hour < 11) mealType = 'breakfast';
      else if (hour >= 11 && hour < 16) mealType = 'lunch';
      else if (hour >= 16 && hour < 22) mealType = 'dinner';

      // Use RPC to insert the meal - more robust than direct table insert with RLS
      const { data: mealDataArr, error: mealError } = await supabase.rpc(
        'create_meal_entry',
        {
          p_client_id: client.id,
          p_meal_date: now.toISOString().split('T')[0],
          p_meal_time: now.toTimeString().split(' ')[0],
          p_meal_type: mealType,
          p_meal_name: analysisResult.mealName,
          p_description: analysisResult.description,
          p_calories: analysisResult.calories,
          p_protein_g: analysisResult.protein_g,
          p_carbs_g: analysisResult.carbs_g,
          p_fat_g: analysisResult.fat_g,
          p_photo_url: publicUrl,
          p_ai_analyzed: true,
          p_shared_with_coach: shareWithCoach,
        },
      );

      if (mealError) {
        console.error('[saveMeal] RPC Error:', mealError);
        // Special handling for the meal_type error to be more user-friendly if needed
        if (mealError.message?.includes('meal_type')) {
          throw new Error(
            'Database type mismatch. Please ensure meal_type enum exists.',
          );
        }
        throw new Error(`Database error: ${mealError.message}`);
      }

      console.log('[saveMeal] RPC Success:', mealDataArr);
      const mealData =
        mealDataArr && (mealDataArr as any[]).length > 0
          ? mealDataArr[0]
          : null;

      if (!mealData) {
        throw new Error('Meal created but no data returned.');
      }

      // Save ingredients if they exist
      if (ingredients.length > 0) {
        console.log('[saveMeal] Saving ingredients...', ingredients.length);
        const ingredientsToSave = ingredients.map((ing) => ({
          meal_id: mealData.id,
          ingredient_name: ing.ingredient_name,
          quantity: ing.quantity,
          unit: ing.unit,
          ai_detected: ing.ai_detected,
          confidence: ing.confidence,
        }));

        const { error: ingError } = await supabase
          .from('meal_ingredients')
          .insert(ingredientsToSave);

        if (ingError) {
          console.error('[saveMeal] Error saving ingredients:', ingError);
          // We don't throw here to avoid failing the whole process if only ingredients fail
        } else {
          console.log('[saveMeal] Ingredients saved successfully');
        }
      }

      if (shareWithCoach) {
        const { data: coachLink } = await supabase
          .from('coach_client_links')
          .select('coach_id')
          .eq('client_id', client.id)
          .eq('status', 'active')
          .single();
        if (coachLink) {
          const { data: coach } = await supabase
            .from('coaches')
            .select('user_id')
            .eq('id', coachLink.coach_id)
            .single();
          if (coach) {
            await supabase.from('messages').insert({
              sender_id: user?.id,
              recipient_id: coach.user_id,
              content: JSON.stringify({
                type: 'meal_log',
                mealId: mealData.id,
                mealName: analysisResult.mealName,
                imageUrl: publicUrl,
                calories: analysisResult.calories,
                protein: analysisResult.protein_g,
                timestamp: now.toISOString(),
              }),
              ai_generated: false,
            });
          }
        }
      }
      console.log('Meal saved successfully, showing feedback');
      setShowMealSuccess(true);
    } catch (e: any) {
      console.error('[saveMeal] Error caught:', e);
      Alert.alert(
        'Save Failed',
        e.message || 'Check your internet and try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  if (currentStep === 'camera' && !capturedImage) {
    return (
      <View className="flex-1 bg-black">
        <CameraView
          style={StyleSheet.absoluteFill}
          facing={facing}
          ref={cameraRef}
        />

        {/* Central Scan Frame Overlay - Mathematically Centered */}
        <View
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
          className="items-center justify-center"
        >
          <View className="w-[80%] aspect-square border-2 border-dashed border-white/40 rounded-[64px]" />
          <Text className="text-white/60 font-medium mt-8 text-center px-12 text-sm">
            Position your plate within the frame for optimal analysis
          </Text>
        </View>

        {/* UI Controls Overlay - Handled with absolute positioning for maximum reliability */}
        <SafeAreaView style={StyleSheet.absoluteFill} pointerEvents="box-none">
          {/* Top Bar Controls */}
          <View
            className="flex-row justify-between items-center px-6 mt-4"
            pointerEvents="box-none"
          >
            <TouchableOpacity
              onPress={() => safeBack()}
              className="w-12 h-12 bg-black/40 rounded-full items-center justify-center border border-white/10"
            >
              <X size={24} color="white" />
            </TouchableOpacity>

            <View
              style={{ backgroundColor: colors.primary }}
              className="px-4 py-1.5 rounded-full items-center justify-center border border-white/20 shadow-xl"
            >
              <Text
                style={{ color: primaryTextOnBtn }}
                className="font-black text-[10px] uppercase tracking-widest"
              >
                Scanning
              </Text>
            </View>

            <View className="w-12" />
          </View>

          {/* Bottom Bar Controls - Pinned to bottom using absolute position within SafeArea */}
          <View
            className="absolute bottom-12 left-0 right-0 flex-row justify-between items-center px-10"
            pointerEvents="box-none"
          >
            <TouchableOpacity
              onPress={pickFromGallery}
              className="w-12 h-12 bg-black/50 rounded-full items-center justify-center border border-white/10"
            >
              <ImageIcon size={26} color="white" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={takePicture}
              className="w-24 h-24 rounded-full border-4 border-white/30 items-center justify-center shadow-2xl"
            >
              <View className="w-20 h-20 bg-white rounded-full border-4 border-black/10 items-center justify-center">
                <View className="w-16 h-16 rounded-full border-2 border-black/5" />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setFacing(facing === 'back' ? 'front' : 'back')}
              className="w-12 h-12 bg-black/50 rounded-full items-center justify-center border border-white/10"
            >
              <RefreshCw size={24} color="white" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (currentStep === 'analyzing' || loading) {
    return (
      <View
        style={{ flex: 1, backgroundColor: colors.background }}
        className="items-center justify-center"
      >
        <StatusBar
          barStyle={isDark ? 'light-content' : 'dark-content'}
          translucent
        />
        <MotiView
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="items-center px-8"
        >
          <ScanPreview imageUri={capturedImage} />

          <View className="items-center mt-12">
            <Text
              style={{ color: textColor }}
              className="text-2xl font-black text-center"
            >
              Checking Meal
            </Text>
            <Text
              style={{ color: textSecondaryColor }}
              className="font-bold mt-2 text-center leading-5 px-10"
            >
              Identifying ingredients and estimating portions...
            </Text>

            <View
              style={{
                backgroundColor: `${colors.primary}18`,
                borderColor: `${colors.primary}35`,
              }}
              className="mt-12 flex-row items-center px-6 py-3 rounded-full border"
            >
              <ActivityIndicator
                color={colors.primary}
                size="small"
                className="mr-3"
              />
              <Text
                style={{ color: colors.primary }}
                className="font-black text-[12px] uppercase tracking-widest"
              >
                Working...
              </Text>
            </View>
          </View>
        </MotiView>
      </View>
    );
  }

  if (
    (currentStep === 'review' || currentStep === 'needs_info') &&
    analysisResult
  ) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <StatusBar
          barStyle={isDark ? 'light-content' : 'dark-content'}
          translucent
        />
        <SafeAreaView style={{ flex: 1 }}>
          <View className="flex-row justify-between items-center px-6 py-4">
            <TouchableOpacity
              onPress={() => {
                setCapturedImage(null);
                setCurrentStep('camera');
              }}
              style={{ backgroundColor: cardBg, borderColor: cardBorder }}
              className="w-11 h-11 rounded-full border items-center justify-center shadow-sm"
            >
              <ChevronLeft size={20} color={textColor} />
            </TouchableOpacity>
            <Text
              style={{ color: textColor }}
              className="font-black text-lg tracking-tight"
            >
              Review Meal
            </Text>
            <View className="w-11" />
          </View>

          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
          >
            <ScrollView
              ref={scrollViewRef}
              style={{ flex: 1 }}
              contentContainerStyle={{
                paddingHorizontal: 24,
                paddingBottom: 100,
                flexGrow: 1,
              }}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
            >
              <View
                style={{ borderColor: cardBorder, backgroundColor: cardBg }}
                className="w-full h-56 rounded-[32px] overflow-hidden mb-6 border shadow-lg"
              >
                <Image
                  key={capturedImage}
                  source={{ uri: capturedImage! }}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="cover"
                  transition={200}
                />
              </View>

              <View className="mb-8">
                <Text
                  style={{ color: textColor }}
                  className="text-3xl font-black"
                >
                  {analysisResult.mealName || 'Unknown Meal'}
                </Text>
                <Text
                  style={{ color: textSecondaryColor }}
                  className="font-bold mt-2 text-lg leading-6"
                >
                  {analysisResult.description ||
                    'Analysis completed with limited data.'}
                </Text>
              </View>

              <View className="flex-row items-center gap-3 mb-6">
                <View
                  style={{ backgroundColor: colors.primary }}
                  className="w-1.5 h-6 rounded-full"
                />
                <Text
                  style={{ color: textColor }}
                  className="text-xl font-black"
                >
                  Composition
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    const newId = Math.random().toString();
                    setIngredients([
                      ...ingredients,
                      {
                        id: newId,
                        meal_id: '',
                        ingredient_name: '',
                        quantity: 0,
                        unit: 'g',
                        ai_detected: false,
                        created_at: new Date().toISOString(),
                      },
                    ]);
                    // Scroll to bottom and focus after state update
                    setTimeout(() => {
                      scrollViewRef.current?.scrollToEnd({ animated: true });
                      inputRefs.current[newId]?.focus();
                    }, 100);
                  }}
                  style={{ backgroundColor: cardBg, borderColor: cardBorder }}
                  className="ml-auto px-4 py-2 rounded-2xl border"
                >
                  <Text
                    style={{ color: colors.primary }}
                    className="font-bold text-xs"
                  >
                    + Manual Entry
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={{ gap: 12 }}>
                {ingredients.map((ing, i) => (
                  <MotiView
                    key={ing.id}
                    from={{ opacity: 0, translateY: 10 }}
                    animate={{ opacity: 1, translateY: 0 }}
                    transition={{ delay: i * 50 }}
                  >
                    <View
                      style={{
                        backgroundColor: cardBg,
                        borderColor: cardBorder,
                      }}
                      className="flex-row items-center border rounded-2xl p-4"
                    >
                      <View className="flex-1">
                        <TextInput
                          ref={(el) => (inputRefs.current[ing.id] = el)}
                          style={{ color: textColor }}
                          className="font-bold text-base"
                          value={ing.ingredient_name || ''}
                          onChangeText={(t) =>
                            setIngredients((prev) =>
                              prev.map((m) =>
                                m.id === ing.id
                                  ? { ...m, ingredient_name: t }
                                  : m,
                              ),
                            )
                          }
                          onBlur={async () => {
                            // Trigger AI guess for quantity if manual entry and empty quantity
                            if (
                              !ing.ai_detected &&
                              ing.ingredient_name &&
                              ing.quantity === 0
                            ) {
                              setGuessingId(ing.id);
                              const otherIngs = ingredients
                                .filter((item) => item.id !== ing.id)
                                .map((item) => ({
                                  name: item.ingredient_name,
                                  quantity: item.quantity,
                                  unit: item.unit,
                                }));

                              try {
                                const result = await guessIngredientQuantity(
                                  capturedImage!,
                                  ing.ingredient_name,
                                  otherIngs,
                                );

                                setIngredients((prev) =>
                                  prev.map((m) =>
                                    m.id === ing.id
                                      ? {
                                          ...m,
                                          quantity: result.quantity,
                                          unit: result.unit,
                                        }
                                      : m,
                                  ),
                                );
                                setAiGuessedIds((prev) =>
                                  new Set(prev).add(ing.id),
                                );
                              } catch (err) {
                                Alert.alert(
                                  'AI Notice',
                                  `Could not identify "${ing.ingredient_name}" in the photo. Please enter the amount manually if you're sure it exists.`,
                                );
                              } finally {
                                setGuessingId(null);
                              }
                            }

                            // Sync meal name if a main ingredient changed
                            if (ing.ingredient_name && analysisResult) {
                              const updatedIngredients = ingredients.map(
                                (m) => ({
                                  name: m.ingredient_name,
                                  quantity: m.quantity,
                                  unit: m.unit,
                                }),
                              );
                              const newMealName =
                                await generateMealName(updatedIngredients);
                              setAnalysisResult({
                                ...analysisResult,
                                mealName: newMealName,
                              });
                            }
                          }}
                          placeholder="Add ingredient..."
                          placeholderTextColor={textSecondaryColor}
                        />
                        <View className="flex-row items-center mt-1">
                          <Text
                            style={{ color: textSecondaryColor }}
                            className="text-[10px] font-black uppercase tracking-widest"
                          >
                            {ing.ai_detected ? 'AI Detected' : 'Manual Entry'}
                          </Text>
                        </View>
                      </View>
                      <View className="flex-row items-center gap-2">
                        <View className="relative">
                          {(aiGuessedIds.has(ing.id) || ing.ai_detected) && (
                            <TouchableOpacity
                              onPress={() =>
                                Alert.alert(
                                  'AI Calculation',
                                  'Ai generated this calculation based on the picture analysed',
                                )
                              }
                              style={{
                                backgroundColor: colors.primary,
                                borderColor: cardBg,
                              }}
                              className="absolute -top-2 -right-2 w-5 h-5 rounded-full items-center justify-center z-10 border-2"
                            >
                              <Text
                                style={{ color: primaryTextOnBtn }}
                                className="font-black text-[7px] uppercase"
                              >
                                AI
                              </Text>
                            </TouchableOpacity>
                          )}
                          {guessingId === ing.id ? (
                            <View
                              style={{
                                backgroundColor: inputBg,
                                borderColor: cardBorder,
                              }}
                              className="px-3 py-2 rounded-xl w-[80px] h-[40px] items-center justify-center relative border"
                            >
                              <ActivityIndicator
                                size="small"
                                color={colors.primary}
                              />
                              <View className="absolute inset-0 items-center justify-center pointer-events-none">
                                <Text
                                  style={{ color: textColor }}
                                  className="font-black text-[8px] uppercase"
                                >
                                  Ai
                                </Text>
                              </View>
                            </View>
                          ) : (
                            <TextInput
                              style={{
                                backgroundColor: inputBg,
                                color: colors.primary,
                                borderColor: cardBorder,
                              }}
                              className="px-3 py-2 rounded-xl font-black w-[80px] text-center border"
                              value={(ing.quantity ?? 0).toString()}
                              onChangeText={(t) => {
                                const val = parseFloat(t) || 0;
                                setIngredients((prev) =>
                                  prev.map((m) =>
                                    m.id === ing.id
                                      ? { ...m, quantity: val }
                                      : m,
                                  ),
                                );
                                // If user manually changes it, remove the AI tag for this manual entry
                                if (!ing.ai_detected) {
                                  setAiGuessedIds((prev) => {
                                    const next = new Set(prev);
                                    next.delete(ing.id);
                                    return next;
                                  });
                                }
                              }}
                              keyboardType="numeric"
                            />
                          )}
                        </View>
                        <TouchableOpacity
                          onPress={() =>
                            setIngredients((prev) =>
                              prev.filter((m) => m.id !== ing.id),
                            )
                          }
                          className="ml-1"
                        >
                          <Minus size={20} color={colors.error || '#EF4444'} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </MotiView>
                ))}
              </View>

              <TouchableOpacity
                onPress={async () => {
                  setLoading(true);
                  try {
                    const updatedMacros = await recalculateNutrition(
                      ingredients,
                      analysisResult.cookingMethod || 'grilled',
                    );
                    setAnalysisResult({ ...analysisResult, ...updatedMacros });
                    setCurrentStep('nutrition');
                  } catch (e) {
                    Alert.alert('Recalculation failed');
                  } finally {
                    setLoading(false);
                  }
                }}
                style={{ backgroundColor: colors.primary }}
                className="mt-12 mb-8 p-6 rounded-[32px] items-center flex-row justify-center shadow-xl"
              >
                {loading ? (
                  <ActivityIndicator color={primaryTextOnBtn} />
                ) : (
                  <>
                    <Zap size={20} color={primaryTextOnBtn} className="mr-3" />
                    <Text
                      style={{ color: primaryTextOnBtn }}
                      className="font-black text-lg"
                    >
                      Calculate Macros
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    );
  }

  if (currentStep === 'nutrition' && analysisResult) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <StatusBar
          barStyle={isDark ? 'light-content' : 'dark-content'}
          translucent
        />
        <SafeAreaView style={{ flex: 1 }}>
          <View className="flex-row justify-between items-center px-6 py-4">
            <TouchableOpacity
              onPress={() => setCurrentStep('review')}
              style={{ backgroundColor: cardBg, borderColor: cardBorder }}
              className="w-11 h-11 rounded-full border items-center justify-center shadow-sm"
            >
              <ChevronLeft size={20} color={textColor} />
            </TouchableOpacity>
            <Text
              style={{ color: textColor }}
              className="font-black text-lg tracking-tight"
            >
              Nutrition Facts
            </Text>
            <View className="w-11" />
          </View>

          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
          >
            <ScrollView
              key="nutrition-scroll"
              style={{ flex: 1 }}
              contentContainerStyle={{
                paddingHorizontal: 12,
                paddingBottom: 100,
                flexGrow: 1,
              }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Meal Photo Hero Card */}
              <View
                style={{ borderColor: cardBorder, backgroundColor: cardBg }}
                className="w-full h-56 rounded-[36px] overflow-hidden mb-4 border shadow-lg mt-2"
              >
                <Image
                  source={{ uri: capturedImage! }}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="cover"
                  transition={200}
                  cachePolicy="disk"
                />
              </View>

              {/* 4 Core Macro Grid (Matching Coach/Client Dashboard 2x2 Metric Cards) */}
              <View className="mb-4">
                <View className="flex-row gap-3 mb-3">
                  <MacroCard
                    label="Calories"
                    value={analysisResult.calories || 0}
                    unit="kcal"
                    color={colors.primary}
                    icon={<Flame size={22} color={colors.primary} />}
                    cardBg={cardBg}
                    cardBorder={cardBorder}
                    textColor={textColor}
                    textSecondaryColor={textSecondaryColor}
                  />
                  <MacroCard
                    label="Protein"
                    value={analysisResult.protein_g || 0}
                    unit="g"
                    color="#E11D48"
                    icon={<Zap size={22} color="#E11D48" />}
                    cardBg={cardBg}
                    cardBorder={cardBorder}
                    textColor={textColor}
                    textSecondaryColor={textSecondaryColor}
                  />
                </View>
                <View className="flex-row gap-3">
                  <MacroCard
                    label="Carbs"
                    value={analysisResult.carbs_g || 0}
                    unit="g"
                    color="#10B981"
                    icon={<Apple size={22} color="#10B981" />}
                    cardBg={cardBg}
                    cardBorder={cardBorder}
                    textColor={textColor}
                    textSecondaryColor={textSecondaryColor}
                  />
                  <MacroCard
                    label="Fat"
                    value={analysisResult.fat_g || 0}
                    unit="g"
                    color="#F59E0B"
                    icon={<Activity size={22} color="#F59E0B" />}
                    cardBg={cardBg}
                    cardBorder={cardBorder}
                    textColor={textColor}
                    textSecondaryColor={textSecondaryColor}
                  />
                </View>
              </View>

              {/* Other Info Card (Matching Dashboard Big Section Cards) */}
              <View
                style={{ backgroundColor: cardBg, borderColor: cardBorder }}
                className="border rounded-[40px] p-7 mb-6 relative overflow-hidden shadow-xl"
              >
                <View
                  style={{ backgroundColor: `${colors.primary}10` }}
                  className="absolute -top-16 -right-16 w-48 h-48 rounded-full"
                />
                <View className="flex-row items-center gap-3 mb-4">
                  <View
                    style={{
                      backgroundColor: `${colors.primary}20`,
                      borderColor: `${colors.primary}40`,
                    }}
                    className="w-10 h-10 rounded-2xl items-center justify-center border"
                  >
                    <Utensils size={18} color={colors.primary} />
                  </View>
                  <Text
                    style={{ color: textColor }}
                    className="text-lg font-black tracking-tight"
                  >
                    Other Info
                  </Text>
                </View>

                <MicroRow
                  label="Fiber"
                  value={`${analysisResult.fiber_g || 0}g`}
                  textColor={textColor}
                  textSecondaryColor={textSecondaryColor}
                  dividerColor={`${colors.primary}25`}
                />
                <MicroRow
                  label="Sugar"
                  value={`${analysisResult.sugar_g || 0}g`}
                  textColor={textColor}
                  textSecondaryColor={textSecondaryColor}
                  dividerColor={`${colors.primary}25`}
                />
                <MicroRow
                  label="Sodium"
                  value={`${analysisResult.sodium_mg || 0}mg`}
                  textColor={textColor}
                  textSecondaryColor={textSecondaryColor}
                  dividerColor={`${colors.primary}25`}
                  isLast
                />
              </View>

              <TouchableOpacity
                onPress={() => saveMeal(true)}
                disabled={saving}
                style={{ backgroundColor: colors.primary }}
                className="p-6 rounded-[32px] items-center flex-row justify-center shadow-xl mb-3"
              >
                {saving ? (
                  <ActivityIndicator color={primaryTextOnBtn} />
                ) : (
                  <>
                    <Send size={20} color={primaryTextOnBtn} className="mr-3" />
                    <Text
                      style={{ color: primaryTextOnBtn }}
                      className="font-black text-lg"
                    >
                      Send to Coach
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>

        <FeedbackModal
          visible={showMealSuccess}
          onClose={() => {
            setShowMealSuccess(false);
            safeBack();
          }}
          variant="success"
          icon={<Check size={60} color="#10B981" />}
          title="Meal Saved"
          body={`${analysisResult?.mealName} has been added to your day.`}
          statLabel="Estimated Calories"
          statIcon={<Zap size={22} color="#F59E0B" fill="#F59E0B" />}
          stat={`${formatCompactNumber(analysisResult?.calories || 0)} KCAL`}
          ctaLabel="Continue"
        />
      </View>
    );
  }

  return null;
}

/** Scan preview with Reanimated-powered scan line — works reliably on native iOS */
function ScanPreview({ imageUri }: { imageUri: string | null }) {
  const colors = useBrandColors();
  const scanY = useSharedValue(0);

  useEffect(() => {
    scanY.value = withRepeat(
      withTiming(268, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      -1, // infinite loops
      true, // reverse each time
    );
  }, []);

  const scanLineStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: scanY.value }],
  }));

  return (
    <View
      style={{ borderColor: `${colors.primary}50` }}
      className="w-72 h-72 rounded-[48px] overflow-hidden border shadow-2xl bg-black"
    >
      {imageUri && (
        <Image
          key={imageUri}
          source={{ uri: imageUri }}
          style={{ width: '100%', height: '100%', opacity: 0.8 }}
          contentFit="cover"
          transition={400}
        />
      )}

      {/* Reanimated scan line */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: 4,
            backgroundColor: colors.primary,
            shadowColor: colors.primary,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 1,
            shadowRadius: 15,
            zIndex: 10,
          },
          scanLineStyle,
        ]}
      />

      {/* Scanning Overlay Glow */}
      <View
        style={{ backgroundColor: `${colors.primary}1A` }}
        className="absolute inset-0"
        pointerEvents="none"
      />
    </View>
  );
}

const MacroCard = ({
  label,
  value,
  unit,
  color,
  icon,
  cardBg,
  cardBorder,
  textColor,
  textSecondaryColor,
}: any) => {
  const displayValue =
    typeof value === 'number' ? formatCompactNumber(value) : value;
  return (
    <View
      style={{ backgroundColor: cardBg, borderColor: cardBorder }}
      className="flex-1 p-6 rounded-[36px] border relative overflow-hidden items-start"
    >
      <View
        style={{ backgroundColor: `${color}0D` }}
        className="absolute -top-12 -right-12 w-32 h-32 rounded-full"
      />
      <View
        style={{ backgroundColor: `${color}18`, borderColor: `${color}35` }}
        className="w-12 h-12 rounded-2xl border items-center justify-center mb-4"
      >
        {icon || <Activity size={22} color={color} />}
      </View>
      <View className="flex-row items-baseline gap-1 mb-1">
        <Text
          style={{ color: textColor, fontSize: 32, lineHeight: 38 }}
          className="font-black tracking-tight"
        >
          {displayValue}
        </Text>
        {unit ? (
          <Text
            style={{ color: textSecondaryColor }}
            className="text-base font-bold"
          >
            {unit}
          </Text>
        ) : null}
      </View>
      <Text
        style={{ color: textSecondaryColor }}
        className="text-xs font-bold uppercase tracking-wider"
      >
        {label}
      </Text>
    </View>
  );
};

const MicroRow = ({
  label,
  value,
  textColor,
  textSecondaryColor,
  dividerColor,
  isLast,
}: any) => (
  <View
    style={{
      borderBottomWidth: isLast ? 0 : 1,
      borderBottomColor: dividerColor,
    }}
    className="flex-row justify-between items-center py-4"
  >
    <Text style={{ color: textSecondaryColor }} className="text-base font-bold">
      {label}
    </Text>
    <Text
      style={{ color: textColor }}
      className="text-lg font-black tracking-tight"
    >
      {value}
    </Text>
  </View>
);

const getStyles = (colors: any) =>
  StyleSheet.create({
    camera: { flex: 1 },
  });
