import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert, ActivityIndicator, Modal, KeyboardAvoidingView, Platform, SafeAreaView } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { MotiView, AnimatePresence } from 'moti';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { X, ChevronLeft, AlertTriangle, Check, Plus, Minus, Send, RefreshCw, Image as ImageIcon, Camera, Zap, Activity } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { analyzeMealImage, reanalyzeMealWithContext, recalculateNutrition, MealAnalysisResult, reanalyzeMealWithFeedback, guessIngredientQuantity, generateMealName } from '@/lib/ai-meal-service';
import { MealIngredient } from '@/types/database';
import * as ImagePicker from 'expo-image-picker';
import FeedbackModal from '@/components/FeedbackModal';
import { formatCompactNumber } from '@/lib/format-utils';
import { safeBack } from '@/lib/navigation-utils';

type Step = 'camera' | 'analyzing' | 'needs_info' | 'review' | 'nutrition';

export default function LogMealScreen() {
  const router = useRouter();
  const { client, user } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<any>(null);
  
  const [currentStep, setCurrentStep] = useState<Step>('camera');
  const [facing, setFacing] = useState<CameraType>('back');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<MealAnalysisResult | null>(null);
  const [ingredients, setIngredients] = useState<MealIngredient[]>([]);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackType, setFeedbackType] = useState<'wrong_name' | 'wrong_ingredients' | 'wrong_portion' | 'other'>('wrong_name');
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

  useEffect(() => { if (!permission) requestPermission(); }, []);

  if (!permission) return <View className="flex-1 bg-slate-950 items-center justify-center"><ActivityIndicator color="#3B82F6" /></View>;
  if (!permission.granted) return (
    <View className="flex-1 bg-slate-950 items-center justify-center p-8">
      <Text className="text-white text-center font-bold text-lg mb-6">Neural sync requires visual sensors.</Text>
      <TouchableOpacity onPress={requestPermission} className="bg-blue-600 px-8 py-4 rounded-3xl">
          <Text className="text-white font-black">Authorize Camera</Text>
      </TouchableOpacity>
    </View>
  );

  const takePicture = async () => {
    if (cameraRef.current) {
        try {
            const photo = await cameraRef.current.takePictureAsync({ quality: 0.7, skipProcessing: false });
            setCapturedImage(photo.uri);
            analyzeImage(photo.uri);
        } catch (e) { Alert.alert('Capture error'); }
    }
  };

  const pickFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7, allowsEditing: true, aspect: [4, 3] });
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
      setIngredients((result.ingredients || []).map(ing => ({
        id: Math.random().toString(),
        meal_id: '',
        ingredient_name: ing.name || 'Unknown',
        quantity: ing.quantity || 0,
        unit: ing.unit || 'g',
        ai_detected: true,
        confidence: ing.confidence || 0,
        created_at: new Date().toISOString(),
      })));
      if (result.needsMoreInfo) { setCurrentStep('needs_info'); setShowInfoModal(true); } 
      else { setCurrentStep('review'); }
    } catch (e) { setCurrentStep('camera'); setCapturedImage(null); } finally { setLoading(false); }
  };

  const saveMeal = async (shareWithCoach: boolean = false) => {
    if (!analysisResult || !client || !capturedImage) return;
    console.log('Starting saveMeal...', { shareWithCoach, hasClient: !!client, hasAnalysis: !!analysisResult });
    setSaving(true);
    try {
      const fileExt = 'jpg';
      const fileName = `${client.id}/${Date.now()}.${fileExt}`;
      console.log('[saveMeal] Fetching image from URI:', capturedImage);
      const response = await fetch(capturedImage);
      if (!response.ok) throw new Error('Failed to fetch captured image');
      
      const arrayBuffer = await response.arrayBuffer();
      console.log('[saveMeal] Uploading to storage...', fileName);
      const { error: uploadError } = await supabase.storage.from('meal-photos').upload(fileName, arrayBuffer, { contentType: 'image/jpeg', upsert: true });
      if (uploadError) {
        console.error('[saveMeal] Upload error:', uploadError);
        throw uploadError;
      }

      console.log('[saveMeal] Upload successful, getting public URL');
      const { data: { publicUrl } } = supabase.storage.from('meal-photos').getPublicUrl(fileName);
      const now = new Date();
      console.log('[saveMeal] Calling RPC create_meal_entry');
      
      // Determine meal type based on time of day
      const hour = now.getHours();
      let mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack' = 'snack';
      if (hour >= 5 && hour < 11) mealType = 'breakfast';
      else if (hour >= 11 && hour < 16) mealType = 'lunch';
      else if (hour >= 16 && hour < 22) mealType = 'dinner';
      
      // Use RPC to insert the meal - more robust than direct table insert with RLS
      const { data: mealDataArr, error: mealError } = await supabase.rpc('create_meal_entry', {
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
      });

      if (mealError) {
        console.error('[saveMeal] RPC Error:', mealError);
        // Special handling for the meal_type error to be more user-friendly if needed
        if (mealError.message?.includes('meal_type')) {
          throw new Error('Database type mismatch. Please ensure meal_type enum exists.');
        }
        throw new Error(`Database error: ${mealError.message}`);
      }
      
      console.log('[saveMeal] RPC Success:', mealDataArr);
      const mealData = mealDataArr && (mealDataArr as any[]).length > 0 ? mealDataArr[0] : null;

      if (!mealData) {
        throw new Error('Meal created but no data returned.');
      }

      // Save ingredients if they exist
      if (ingredients.length > 0) {
        console.log('[saveMeal] Saving ingredients...', ingredients.length);
        const ingredientsToSave = ingredients.map(ing => ({
          meal_id: mealData.id,
          ingredient_name: ing.ingredient_name,
          quantity: ing.quantity,
          unit: ing.unit,
          ai_detected: ing.ai_detected,
          confidence: ing.confidence
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
          const { data: coachLink } = await supabase.from('coach_client_links').select('coach_id').eq('client_id', client.id).eq('status', 'active').single();
          if (coachLink) {
              const { data: coach } = await supabase.from('coaches').select('user_id').eq('id', coachLink.coach_id).single();
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
      Alert.alert('Save Failed', e.message || 'Check your internet and try again.'); 
    } finally { 
      setSaving(false); 
    }
  };

  if (currentStep === 'camera' && !capturedImage) {
    return (
      <View className="flex-1 bg-black">
        <CameraView style={StyleSheet.absoluteFill} facing={facing} ref={cameraRef} />
        
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
          <View className="flex-row justify-between items-center px-6 mt-4" pointerEvents="box-none">
            <TouchableOpacity 
              onPress={() => safeBack()} 
              className="w-12 h-12 bg-black/40 rounded-full items-center justify-center border border-white/10"
            >
              <X size={24} color="white" />
            </TouchableOpacity>
            
            <View className="px-4 py-1.5 bg-blue-600 rounded-full items-center justify-center border border-white/20 shadow-xl shadow-blue-500/50">
              <Text className="text-white font-black text-[10px] uppercase tracking-widest">Scanning</Text>
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
      <View className="flex-1 bg-slate-950 items-center justify-center">
        <MotiView 
            from={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="items-center px-8"
        >
            <ScanPreview imageUri={capturedImage} />
            
            <View className="items-center mt-12">
                <Text className="text-white text-2xl font-black text-center">Checking Meal</Text>
                <Text className="text-slate-500 font-bold mt-2 text-center leading-5 px-10">
                    Identifying ingredients and estimating portions...
                </Text>
                
                <View className="mt-12 flex-row items-center bg-blue-500/10 px-6 py-3 rounded-full border border-blue-500/20">
                    <ActivityIndicator color="#3B82F6" size="small" className="mr-3" />
                    <Text className="text-blue-500 font-black text-[12px] uppercase tracking-widest">Working...</Text>
                </View>
            </View>
        </MotiView>
      </View>
    );
  }

  if (currentStep === 'review' && analysisResult) {
    return (
      <View style={{ flex: 1, backgroundColor: '#020617' }}>
        <SafeAreaView style={{ flex: 1 }}>
            <View className="flex-row justify-between items-center px-6 py-4">
                <TouchableOpacity onPress={() => { setCapturedImage(null); setCurrentStep('camera'); }} className="w-10 h-10 bg-slate-900 rounded-full items-center justify-center">
                    <ChevronLeft size={20} color="white" />
                </TouchableOpacity>
                <Text className="text-white font-black text-lg">Review Meal</Text>
                <View className="w-10" />
            </View>

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                <ScrollView 
                    ref={scrollViewRef}
                    style={{ flex: 1 }}
                    contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 100, flexGrow: 1 }}
                    showsVerticalScrollIndicator={true}
                    keyboardShouldPersistTaps="handled"
                >
                    <View className="w-full h-56 rounded-[32px] overflow-hidden mb-6 border border-slate-900 bg-slate-900 shadow-lg">
                        <Image 
                            key={capturedImage}
                            source={{ uri: capturedImage! }} 
                            style={{ width: '100%', height: '100%' }}
                            contentFit="cover"
                            transition={200}
                        />
                    </View>

                    <View className="mb-8">
                        <Text className="text-white text-3xl font-black">{analysisResult.mealName || 'Unknown Protocol'}</Text>
                        <Text className="text-slate-500 font-bold mt-2 text-lg leading-6">{analysisResult.description || 'Analysis completed with limited data.'}</Text>
                    </View>

                    <View className="flex-row items-center gap-3 mb-6">
                        <View className="w-1.5 h-6 bg-blue-600 rounded-full" />
                        <Text className="text-white text-xl font-black">Composition</Text>
                        <TouchableOpacity 
                            onPress={() => {
                                const newId = Math.random().toString();
                                setIngredients([...ingredients, { id: newId, meal_id: '', ingredient_name: '', quantity: 0, unit: 'g', ai_detected: false, created_at: new Date().toISOString() }]);
                                // Scroll to bottom and focus after state update
                                setTimeout(() => {
                                    scrollViewRef.current?.scrollToEnd({ animated: true });
                                    inputRefs.current[newId]?.focus();
                                }, 100);
                            }} 
                            className="ml-auto bg-slate-900/80 px-4 py-2 rounded-2xl border border-slate-800"
                        >
                            <Text className="text-blue-500 font-bold text-xs">+ Manual Entry</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={{ gap: 12 }}>
                        {ingredients.map((ing, i) => (
                            <MotiView key={ing.id} from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ delay: i * 50 }}>
                                <View className="flex-row items-center bg-slate-900/40 border border-slate-900 rounded-2xl p-4">
                                    <View className="flex-1">
                                        <TextInput 
                                            ref={el => inputRefs.current[ing.id] = el}
                                            className="text-white font-bold text-base"
                                            value={ing.ingredient_name || ''}
                                            onChangeText={t => setIngredients(prev => prev.map(m => m.id === ing.id ? { ...m, ingredient_name: t } : m))}
                                            onBlur={async () => {
                                                // Trigger AI guess for quantity if manual entry and empty quantity
                                                if (!ing.ai_detected && ing.ingredient_name && ing.quantity === 0) {
                                                    setGuessingId(ing.id);
                                                    const otherIngs = ingredients
                                                        .filter(item => item.id !== ing.id)
                                                        .map(item => ({ name: item.ingredient_name, quantity: item.quantity, unit: item.unit }));
                                                    
                                                    try {
                                                        const result = await guessIngredientQuantity(capturedImage!, ing.ingredient_name, otherIngs);
                                                        
                                                        setIngredients(prev => prev.map(m => 
                                                            m.id === ing.id ? { ...m, quantity: result.quantity, unit: result.unit } : m
                                                        ));
                                                        setAiGuessedIds(prev => new Set(prev).add(ing.id));
                                                    } catch (err) {
                                                        Alert.alert('AI Notice', `Could not identify "${ing.ingredient_name}" in the photo. Please enter the amount manually if you're sure it exists.`);
                                                    } finally {
                                                        setGuessingId(null);
                                                    }
                                                }

                                                // Sync meal name if a main ingredient changed
                                                if (ing.ingredient_name && analysisResult) {
                                                    const updatedIngredients = ingredients.map(m => ({ 
                                                        name: m.ingredient_name, 
                                                        quantity: m.quantity, 
                                                        unit: m.unit 
                                                    }));
                                                    const newMealName = await generateMealName(updatedIngredients);
                                                    setAnalysisResult({ ...analysisResult, mealName: newMealName });
                                                }
                                            }}
                                            placeholder="Add ingredient..."
                                            placeholderTextColor="#475569"
                                        />
                                        <View className="flex-row items-center mt-1">
                                            <Text className="text-slate-600 text-[10px] font-black uppercase tracking-widest">
                                                {ing.ai_detected ? 'AI Detected' : 'Manual Entry'}
                                            </Text>
                                        </View>
                                    </View>
                                    <View className="flex-row items-center gap-2">
                                        <View className="relative">
                                            {(aiGuessedIds.has(ing.id) || ing.ai_detected) && (
                                                <TouchableOpacity 
                                                    onPress={() => Alert.alert('AI Calculation', 'Ai generated this calculation based on the picture analysed')}
                                                    className="absolute -top-2 -right-2 bg-blue-600 w-5 h-5 rounded-full items-center justify-center z-10 border-2 border-slate-900"
                                                >
                                                    <Text className="text-white font-black text-[7px] uppercase">AI</Text>
                                                </TouchableOpacity>
                                            )}
                                            {guessingId === ing.id ? (
                                                <View className="bg-slate-950 px-3 py-2 rounded-xl w-[80px] h-[40px] items-center justify-center relative">
                                                    <ActivityIndicator size="small" color="#3B82F6" />
                                                    <View className="absolute inset-0 items-center justify-center pointer-events-none">
                                                        <Text className="text-white font-black text-[8px] uppercase">Ai</Text>
                                                    </View>
                                                </View>
                                            ) : (
                                                <TextInput 
                                                    className="bg-slate-950 px-3 py-2 rounded-xl text-blue-500 font-black w-[80px] text-center"
                                                    value={(ing.quantity ?? 0).toString()}
                                                    onChangeText={t => {
                                                        const val = parseFloat(t) || 0;
                                                        setIngredients(prev => prev.map(m => m.id === ing.id ? { ...m, quantity: val } : m));
                                                        // If user manually changes it, remove the AI tag for this manual entry
                                                        if (!ing.ai_detected) {
                                                            setAiGuessedIds(prev => {
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
                                        <TouchableOpacity onPress={() => setIngredients(prev => prev.filter(m => m.id !== ing.id))} className="ml-1">
                                            <Minus size={20} color="#EF4444" />
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
                                const updatedMacros = await recalculateNutrition(ingredients, analysisResult.cookingMethod || 'grilled');
                                setAnalysisResult({ ...analysisResult, ...updatedMacros });
                                setCurrentStep('nutrition');
                            } catch (e) {
                                Alert.alert('Recalculation failed');
                            } finally {
                                setLoading(false);
                            }
                        }}
                        className="mt-12 mb-8 p-6 bg-blue-600 rounded-[32px] items-center flex-row justify-center shadow-xl shadow-blue-500/20"
                    >
                        {loading ? <ActivityIndicator color="white" /> : (
                            <>
                                <Zap size={20} color="white" className="mr-3" />
                                <Text className="text-white font-black text-lg">Calculate Macros</Text>
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
          <View style={{ flex: 1, backgroundColor: '#020617' }}>
              <SafeAreaView style={{ flex: 1 }}>
                  <View className="flex-row justify-between items-center px-6 py-4">
                      <TouchableOpacity onPress={() => setCurrentStep('review')} className="w-10 h-10 bg-slate-900 rounded-full items-center justify-center">
                          <ChevronLeft size={20} color="white" />
                      </TouchableOpacity>
                      <Text className="text-white font-black text-lg">Nutrition Facts</Text>
                      <View className="w-10" />
                  </View>

                  <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                      <ScrollView 
                          key="nutrition-scroll"
                          style={{ flex: 1 }} 
                          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 100, flexGrow: 1 }}
                          showsVerticalScrollIndicator={true}
                          keyboardShouldPersistTaps="handled"
                      >
                          <View className="w-full aspect-video rounded-[32px] overflow-hidden mb-8 border border-slate-900 mt-2">
                              <Image 
                                source={{ uri: capturedImage! }} 
                                style={{ width: '100%', height: '100%' }}
                                contentFit="cover"
                                transition={200}
                                cachePolicy="disk"
                              />
                          </View>

                          {/* Power Cards */}
                          <View className="flex-row flex-wrap gap-4 justify-between mb-10">
                              <MacroCard label="Calories" value={analysisResult.calories || 0} color="#3B82F6" />
                              <MacroCard label="Protein" value={`${analysisResult.protein_g || 0}g`} color="#E11D48" />
                              <MacroCard label="Carbs" value={`${analysisResult.carbs_g || 0}g`} color="#10B981" />
                              <MacroCard label="Fat" value={`${analysisResult.fat_g || 0}g`} color="#F59E0B" />
                          </View>

                          <View className="bg-slate-900/30 border border-slate-900 rounded-[32px] p-8 mb-12">
                              <Text className="text-white font-black mb-6 uppercase tracking-widest text-xs">Other Info</Text>
                              <MicroRow label="Fiber" value={`${analysisResult.fiber_g || 0}g`} />
                              <MicroRow label="Sugar" value={`${analysisResult.sugar_g || 0}g`} />
                              <MicroRow label="Sodium" value={`${analysisResult.sodium_mg || 0}mg`} />
                          </View>

                          <TouchableOpacity 
                            onPress={() => saveMeal(true)}
                            disabled={saving}
                            className="p-6 bg-blue-600 rounded-[32px] items-center flex-row justify-center shadow-xl shadow-blue-500/20 mb-3"
                          >
                              {saving ? <ActivityIndicator color="white" /> : (
                                  <>
                                    <Send size={20} color="white" className="mr-3" />
                                    <Text className="text-white font-black text-lg">Send to Coach</Text>
                                  </>
                              )}
                          </TouchableOpacity>

                          <TouchableOpacity 
                            onPress={() => saveMeal(false)}
                            disabled={saving}
                            className="p-6 bg-slate-900 rounded-[32px] items-center mb-12 border border-slate-800"
                          >
                              <Text className="text-white font-black text-lg">Save Stealthily</Text>
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
  const scanY = useSharedValue(0);

  useEffect(() => {
    scanY.value = withRepeat(
      withTiming(268, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      -1,   // infinite loops
      true   // reverse each time
    );
  }, []);

  const scanLineStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: scanY.value }],
  }));

  return (
    <View className="w-72 h-72 rounded-[48px] overflow-hidden border border-blue-500/30 shadow-2xl bg-black">
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
            backgroundColor: '#3B82F6',
            shadowColor: '#60A5FA',
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
        className="absolute inset-0 bg-blue-500/10"
        pointerEvents="none"
      />
    </View>
  );
}

const MacroCard = ({ label, value, color }: any) => {
    const displayValue = typeof value === 'number' ? formatCompactNumber(value) : value;
    return (
        <View className="w-[47%] bg-slate-900/50 p-6 rounded-[28px] border border-slate-900 items-start">
            <View style={{ backgroundColor: color + '15' }} className="w-8 h-8 rounded-xl items-center justify-center mb-4">
                <Activity size={16} color={color} />
            </View>
            <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">{label}</Text>
            <Text className="text-white text-2xl font-black">{displayValue}</Text>
        </View>
    );
};

const MicroRow = ({ label, value }: any) => (
    <View className="flex-row justify-between py-3 border-b border-slate-800/50">
        <Text className="text-slate-400 font-bold">{label}</Text>
        <Text className="text-white font-black">{value}</Text>
    </View>
);

const styles = StyleSheet.create({
  camera: { flex: 1 },
});
