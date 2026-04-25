import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert, ActivityIndicator, Modal, KeyboardAvoidingView, Platform, SafeAreaView } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { MotiView, AnimatePresence } from 'moti';
import { X, ChevronLeft, AlertTriangle, Check, Plus, Minus, Send, RefreshCw, Image as ImageIcon, Camera, Zap, Activity } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { analyzeMealImage, reanalyzeMealWithContext, recalculateNutrition, MealAnalysisResult, reanalyzeMealWithFeedback } from '@/lib/ai-meal-service';
import { MealIngredient } from '@/types/database';
import * as ImagePicker from 'expo-image-picker';

type Step = 'camera' | 'analyzing' | 'needs_info' | 'review' | 'nutrition';

export default function LogMealScreen() {
  const router = useRouter();
  const { client } = useAuth();
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
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [mealName, setMealName] = useState('');
  const [cookingMethod, setCookingMethod] = useState('');
  const [hasOil, setHasOil] = useState(false);

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
      setIngredients(result.ingredients.map(ing => ({
        id: Math.random().toString(),
        meal_id: '',
        ingredient_name: ing.name,
        quantity: ing.quantity,
        unit: ing.unit,
        ai_detected: true,
        confidence: ing.confidence,
        created_at: new Date().toISOString(),
      })));
      if (result.needsMoreInfo) { setCurrentStep('needs_info'); setShowInfoModal(true); } 
      else { setCurrentStep('review'); }
    } catch (e) { setCurrentStep('camera'); setCapturedImage(null); } finally { setLoading(false); }
  };

  const saveMeal = async (shareWithCoach: boolean = false) => {
    if (!analysisResult || !client || !capturedImage) return;
    setSaving(true);
    try {
      const fileExt = 'jpg';
      const fileName = `${client.id}/${Date.now()}.${fileExt}`;
      const response = await fetch(capturedImage);
      const arrayBuffer = await response.arrayBuffer();
      const { error: uploadError } = await supabase.storage.from('meal-photos').upload(fileName, arrayBuffer, { contentType: 'image/jpeg' });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('meal-photos').getPublicUrl(fileName);
      const now = new Date();
      const { data: mealData, error: mealError } = await supabase.from('meals').insert({
          client_id: client.id,
          meal_date: now.toISOString().split('T')[0],
          meal_time: now.toTimeString().split(' ')[0],
          meal_type: 'lunch', 
          meal_name: analysisResult.mealName,
          description: analysisResult.description,
          photo_url: publicUrl,
          calories: analysisResult.calories,
          protein_g: analysisResult.protein_g,
          carbs_g: analysisResult.carbs_g,
          fat_g: analysisResult.fat_g,
          ai_analyzed: true,
          shared_with_coach: shareWithCoach,
      }).select().single();
      if (mealError) throw mealError;

      if (shareWithCoach) {
          const { data: coachLink } = await supabase.from('coach_client_links').select('coach_id').eq('client_id', client.id).eq('status', 'active').single();
          if (coachLink) {
              const { data: coach } = await supabase.from('coaches').select('user_id').eq('id', coachLink.coach_id).single();
              if (coach) {
                  await supabase.from('messages').insert({
                      sender_id: client.user_id,
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
      router.back();
    } catch (e) { Alert.alert('Error saving'); } finally { setSaving(false); }
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
              onPress={() => router.back()} 
              className="w-12 h-12 bg-black/40 rounded-full items-center justify-center border border-white/10"
            >
              <X size={24} color="white" />
            </TouchableOpacity>
            
            <View className="px-4 py-1.5 bg-blue-600 rounded-full items-center justify-center border border-white/20 shadow-xl shadow-blue-500/50">
              <Text className="text-white font-black text-[10px] uppercase tracking-widest">Neural Scan</Text>
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
            from={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="items-center px-8"
        >
            <View className="w-72 h-72 rounded-[48px] overflow-hidden border border-blue-500/30 shadow-2xl bg-black">
                {capturedImage && (
                    <Image 
                        key={capturedImage}
                        source={{ uri: capturedImage }} 
                        className="w-full h-full opacity-80" 
                        contentFit="cover"
                        transition={400}
                    />
                )}
                
                {/* Robust Scanning Line Animation */}
                <MotiView 
                    from={{ translateY: 0 }}
                    animate={{ translateY: 260 }}
                    transition={{ 
                        loop: true, 
                        duration: 1500, 
                        type: 'timing',
                        repeatReverse: true 
                    }}
                    className="absolute w-full h-[4px] bg-blue-500 shadow-xl shadow-blue-400"
                    style={{
                        shadowColor: '#60A5FA',
                        shadowOffset: { width: 0, height: 0 },
                        shadowOpacity: 1,
                        shadowRadius: 15,
                        zIndex: 10
                    }}
                />
                
                {/* Scanning Overlay Glow */}
                <View className="absolute inset-0 bg-blue-500/10" pointerEvents="none" />
            </View>
            
            <View className="items-center mt-12">
                <Text className="text-white text-2xl font-black text-center">Identifying Protocols</Text>
                <Text className="text-slate-500 font-bold mt-2 text-center leading-5 px-10">
                    Neural engine is extracting nutritional data through visual synthesis...
                </Text>
                
                <View className="mt-12 flex-row items-center bg-blue-500/10 px-6 py-3 rounded-full border border-blue-500/20">
                    <ActivityIndicator color="#3B82F6" size="small" className="mr-3" />
                    <Text className="text-blue-500 font-black text-[12px] uppercase tracking-widest">Processing Layer 7</Text>
                </View>
            </View>
        </MotiView>
      </View>
    );
  }

  if (currentStep === 'review' && analysisResult) {
    return (
      <View className="flex-1 bg-slate-950">
        <SafeAreaView className="flex-1">
            <View className="flex-row justify-between items-center px-6 py-4">
                <TouchableOpacity onPress={() => { setCapturedImage(null); setCurrentStep('camera'); }} className="w-10 h-10 bg-slate-900 rounded-full items-center justify-center">
                    <ChevronLeft size={20} color="white" />
                </TouchableOpacity>
                <Text className="text-white font-black text-lg">Protocol Review</Text>
                <View className="w-10" />
            </View>

            <ScrollView 
                className="flex-1" 
                contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}
                showsVerticalScrollIndicator={false}
            >
                <View className="w-full h-56 rounded-[32px] overflow-hidden mb-6 border border-slate-900 bg-slate-900 shadow-lg">
                    <Image 
                        key={capturedImage}
                        source={{ uri: capturedImage! }} 
                        className="w-full h-full" 
                        contentFit="cover"
                        transition={200}
                    />
                </View>

                <View className="mb-8">
                    <Text className="text-white text-3xl font-black">{analysisResult.mealName}</Text>
                    <Text className="text-slate-500 font-bold mt-2 text-lg leading-6">{analysisResult.description}</Text>
                </View>

                <View className="flex-row items-center gap-3 mb-6">
                    <View className="w-1.5 h-6 bg-blue-600 rounded-full" />
                    <Text className="text-white text-xl font-black">Composition</Text>
                    <TouchableOpacity onPress={() => setIngredients([...ingredients, { id: Math.random().toString(), meal_id: '', ingredient_name: '', quantity: 0, unit: 'g', ai_detected: false, created_at: '' }])} className="ml-auto bg-slate-900/80 px-4 py-2 rounded-2xl border border-slate-800">
                        <Text className="text-blue-500 font-bold text-xs">+ Manual Entry</Text>
                    </TouchableOpacity>
                </View>

                <View style={{ gap: 12 }}>
                    {ingredients.map((ing, i) => (
                        <MotiView key={ing.id} from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ delay: i * 50 }}>
                            <View className="flex-row items-center bg-slate-900/40 border border-slate-900 rounded-2xl p-4">
                                <View className="flex-1">
                                    <TextInput 
                                        className="text-white font-bold text-base"
                                        value={ing.ingredient_name}
                                        onChangeText={t => setIngredients(prev => prev.map(m => m.id === ing.id ? { ...m, ingredient_name: t } : m))}
                                        placeholder="Add ingredient..."
                                        placeholderTextColor="#475569"
                                    />
                                    <View className="flex-row items-center mt-1">
                                        <Text className="text-slate-600 text-[10px] font-black uppercase tracking-widest">{ing.ai_detected ? 'AI Detected' : 'Manual'}</Text>
                                    </View>
                                </View>
                                <View className="flex-row items-center gap-2">
                                    <TextInput 
                                        className="bg-slate-950 px-3 py-2 rounded-xl text-blue-500 font-black min-w-[60px] text-center"
                                        value={ing.quantity.toString()}
                                        onChangeText={t => setIngredients(prev => prev.map(m => m.id === ing.id ? { ...m, quantity: parseFloat(t) || 0 } : m))}
                                        keyboardType="numeric"
                                    />
                                    <TouchableOpacity onPress={() => setIngredients(prev => prev.filter(m => m.id !== ing.id))}>
                                        <Minus size={20} color="#EF4444" />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </MotiView>
                    ))}
                </View>

                <TouchableOpacity 
                    onPress={() => setCurrentStep('nutrition')}
                    className="mt-12 mb-8 p-6 bg-blue-600 rounded-[32px] items-center flex-row justify-center shadow-xl shadow-blue-500/20"
                >
                    <Zap size={20} color="white" className="mr-3" />
                    <Text className="text-white font-black text-lg">Synthesize Nutrition</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
      </View>
    );
  }

  if (currentStep === 'nutrition' && analysisResult) {
      return (
          <View className="flex-1 bg-slate-950">
              <SafeAreaView className="flex-1">
                  <View className="flex-row justify-between items-center px-6 py-4">
                      <TouchableOpacity onPress={() => setCurrentStep('review')} className="w-10 h-10 bg-slate-900 rounded-full items-center justify-center">
                          <ChevronLeft size={20} color="white" />
                      </TouchableOpacity>
                      <Text className="text-white font-black text-lg">Macro Synthesis</Text>
                      <View className="w-10" />
                  </View>

                  <ScrollView className="flex-1 px-6">
                      <View className="w-full aspect-video rounded-[32px] overflow-hidden mb-8 border border-slate-900">
                          <Image 
                            source={{ uri: capturedImage! }} 
                            className="w-full h-full" 
                            contentFit="cover"
                            transition={200}
                            cachePolicy="disk"
                          />
                      </View>

                      {/* Power Cards */}
                      <View className="flex-row flex-wrap gap-4 justify-between mb-10">
                          <MacroCard label="Calories" value={analysisResult.calories} color="#3B82F6" />
                          <MacroCard label="Protein" value={`${analysisResult.protein_g}g`} color="#E11D48" />
                          <MacroCard label="Carbs" value={`${analysisResult.carbs_g}g`} color="#10B981" />
                          <MacroCard label="Fat" value={`${analysisResult.fat_g}g`} color="#F59E0B" />
                      </View>

                      <View className="bg-slate-900/30 border border-slate-900 rounded-[32px] p-8 mb-12">
                          <Text className="text-white font-black mb-6 uppercase tracking-widest text-xs">Micronutrient Breakdown</Text>
                          <MicroRow label="Fiber" value={`${analysisResult.fiber_g}g`} />
                          <MicroRow label="Sugar" value={`${analysisResult.sugar_g}g`} />
                          <MicroRow label="Sodium" value={`${analysisResult.sodium_mg}mg`} />
                      </View>

                      <TouchableOpacity 
                        onPress={() => saveMeal(true)}
                        disabled={saving}
                        className="p-6 bg-blue-600 rounded-[32px] items-center flex-row justify-center shadow-xl shadow-blue-500/20 mb-3"
                      >
                          {saving ? <ActivityIndicator color="white" /> : (
                              <>
                                <Send size={20} color="white" className="mr-3" />
                                <Text className="text-white font-black text-lg">Transmit to Coach</Text>
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
              </SafeAreaView>
          </View>
      );
  }

  return null;
}

const MacroCard = ({ label, value, color }: any) => (
    <View className="w-[47%] bg-slate-900/50 p-6 rounded-[28px] border border-slate-900 items-start">
        <View style={{ backgroundColor: color + '15' }} className="w-8 h-8 rounded-xl items-center justify-center mb-4">
            <Activity size={16} color={color} />
        </View>
        <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">{label}</Text>
        <Text className="text-white text-2xl font-black">{value}</Text>
    </View>
);

const MicroRow = ({ label, value }: any) => (
    <View className="flex-row justify-between py-3 border-b border-slate-800/50">
        <Text className="text-slate-400 font-bold">{label}</Text>
        <Text className="text-white font-black">{value}</Text>
    </View>
);

const styles = StyleSheet.create({
  camera: { flex: 1 },
});
