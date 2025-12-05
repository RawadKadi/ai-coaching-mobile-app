import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, TextInput, Alert, ActivityIndicator, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { X, ChevronLeft, AlertTriangle, Check, Plus, Minus, Send } from 'lucide-react-native';
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
  
  // State management
  const [currentStep, setCurrentStep] = useState<Step>('camera');
  const [facing, setFacing] = useState<CameraType>('back');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<MealAnalysisResult | null>(null);
  const [ingredients, setIngredients] = useState<MealIngredient[]>([]);
  
  // Feedback State
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackType, setFeedbackType] = useState<'wrong_name' | 'wrong_ingredients' | 'wrong_portion' | 'other'>('wrong_name');
  const [feedbackText, setFeedbackText] = useState('');
  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Unknown meal modal
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [mealName, setMealName] = useState('');
  const [cookingMethod, setCookingMethod] = useState('');
  const [hasOil, setHasOil] = useState(false);

  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
  }, []);

  if (!permission) {
    return <View style={styles.container}><ActivityIndicator /></View>;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>We need camera permission</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({ 
          quality: 0.7,
          skipProcessing: false,
        });
        
        // Resize image if needed (using ImageManipulator or just relying on camera quality)
        // For now, we'll rely on quality 0.7 which is good for mobile
        
        setCapturedImage(photo.uri);
        analyzeImage(photo.uri);
      } catch (error) {
        console.error('Error taking picture:', error);
        Alert.alert('Error', 'Failed to capture photo');
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
      
      // Convert to MealIngredient format
      const ingredientList: MealIngredient[] = result.ingredients.map(ing => ({
        id: Math.random().toString(),
        meal_id: '',
        ingredient_name: ing.name,
        quantity: ing.quantity,
        unit: ing.unit,
        ai_detected: true,
        confidence: ing.confidence,
        created_at: new Date().toISOString(),
      }));
      
      setIngredients(ingredientList);
      
      if (result.needsMoreInfo) {
        setCurrentStep('needs_info');
        setShowInfoModal(true);
      } else {
        setCurrentStep('review');
      }
    } catch (error) {
      console.error('Analysis error:', error);
      Alert.alert('Analysis Failed', 'Could not analyze meal. Please try again or enter details manually.');
      setCurrentStep('camera');
      setCapturedImage(null);
    } finally {
      setLoading(false);
    }
  };

  const handleReanalyze = async () => {
    if (!capturedImage || !mealName) {
      Alert.alert('Missing Info', 'Please provide meal name');
      return;
    }
    
    setShowInfoModal(false);
    setLoading(true);
    setCurrentStep('analyzing');
    
    try {
      const result = await reanalyzeMealWithContext(
        capturedImage,
        mealName,
        cookingMethod || 'unknown',
        hasOil,
        'lebanese'
      );
      
      setAnalysisResult(result);
      const ingredientList: MealIngredient[] = result.ingredients.map(ing => ({
        id: Math.random().toString(),
        meal_id: '',
        ingredient_name: ing.name,
        quantity: ing.quantity,
        unit: ing.unit,
        ai_detected: true,
        confidence: ing.confidence,
        created_at: new Date().toISOString(),
      }));
      
      setIngredients(ingredientList);
      setCurrentStep('review');
    } catch (error) {
      Alert.alert('Error', 'Failed to reanalyze meal');
      setCurrentStep('camera');
    } finally {
      setLoading(false);
    }
  };

  const handleReanalyzeWithFeedback = async () => {
    if (!capturedImage || !analysisResult || !feedbackText.trim()) {
      Alert.alert('Missing Info', 'Please provide feedback to reanalyze.');
      return;
    }

    setIsReanalyzing(true);
    setShowFeedbackModal(false);
    setLoading(true);
    setCurrentStep('analyzing');

    try {
      const result = await reanalyzeMealWithFeedback(
        capturedImage,
        analysisResult,
        feedbackType,
        feedbackText,
        'lebanese'
      );

      setAnalysisResult(result);
      const ingredientList: MealIngredient[] = result.ingredients.map(ing => ({
        id: Math.random().toString(),
        meal_id: '',
        ingredient_name: ing.name,
        quantity: ing.quantity,
        unit: ing.unit,
        ai_detected: true,
        confidence: ing.confidence,
        created_at: new Date().toISOString(),
      }));
      setIngredients(ingredientList);
      setCurrentStep('review');
      setFeedbackText(''); // Clear feedback text
    } catch (error) {
      console.error('Error reanalyzing with feedback:', error);
      Alert.alert('Error', 'Failed to reanalyze meal with feedback.');
      setCurrentStep('camera');
    } finally {
      setIsReanalyzing(false);
      setLoading(false);
    }
  };

  const addIngredient = () => {
    const newIngredient: MealIngredient = {
      id: Math.random().toString(),
      meal_id: '',
      ingredient_name: '',
      quantity: 0,
      unit: 'g',
      ai_detected: false,
      created_at: new Date().toISOString(),
    };
    setIngredients([...ingredients, newIngredient]);
  };

  const removeIngredient = (id: string) => {
    setIngredients(ingredients.filter(ing => ing.id !== id));
  };

  const updateIngredient = (id: string, field: keyof MealIngredient, value: any) => {
    setIngredients(ingredients.map(ing => 
      ing.id === id ? { ...ing, [field]: value } : ing
    ));
  };

  const finalizeAnalysis = async () => {
    if (!analysisResult) return;
    
    setLoading(true);
    setCurrentStep('analyzing');
    
    try {
      // Recalculate nutrition based on modified ingredients
      const updatedNutrition = await recalculateNutrition(
        ingredients,
        analysisResult.cookingMethod
      );
      
      setAnalysisResult({
        ...analysisResult,
        ...updatedNutrition,
      });
      
      setCurrentStep('nutrition');
    } catch (error) {
      console.error('Error finalizing:', error);
      // Continue anyway with current data
      setCurrentStep('nutrition');
    } finally {
      setLoading(false);
    }
  };

  const saveMeal = async (shareWithCoach: boolean = false) => {
    if (!analysisResult || !client || !capturedImage) return;
    
    setSaving(true);
    
    try {
      // Upload image to Supabase Storage
      const fileExt = 'jpg';
      const fileName = `${client.id}/${Date.now()}.${fileExt}`;
      
      const response = await fetch(capturedImage);
      const arrayBuffer = await response.arrayBuffer();
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('meal-photos')
        .upload(fileName, arrayBuffer, {
          contentType: 'image/jpeg',
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('meal-photos')
        .getPublicUrl(fileName);

      // Determine meal type based on time
      const now = new Date();
      const hour = now.getHours();
      let mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack' = 'snack';
      if (hour >= 6 && hour < 11) mealType = 'breakfast';
      else if (hour >= 11 && hour < 16) mealType = 'lunch';
      else if (hour >= 16 && hour < 22) mealType = 'dinner';

      // Save meal to database
      const { data: mealData, error: mealError } = await supabase
        .from('meals')
        .insert({
          client_id: client.id,
          meal_date: now.toISOString().split('T')[0],
          meal_time: now.toTimeString().split(' ')[0],
          meal_type: mealType,
          meal_name: analysisResult.mealName,
          description: analysisResult.description,
          photo_url: publicUrl,
          calories: analysisResult.calories,
          protein_g: analysisResult.protein_g,
          carbs_g: analysisResult.carbs_g,
          fat_g: analysisResult.fat_g,
          fiber_g: analysisResult.fiber_g,
          sugar_g: analysisResult.sugar_g,
          sodium_mg: analysisResult.sodium_mg,
          potassium_mg: analysisResult.potassium_mg,
          calcium_mg: analysisResult.calcium_mg,
          iron_mg: analysisResult.iron_mg,
          vitamin_a_ug: analysisResult.vitamin_a_ug,
          vitamin_c_mg: analysisResult.vitamin_c_mg,
          vitamin_d_ug: analysisResult.vitamin_d_ug,
          cooking_method: analysisResult.cookingMethod,
          portion_size: analysisResult.portionSize,
          ai_analyzed: true,
          ai_confidence: analysisResult.confidence,
          ai_notes: analysisResult.aiNotes,
          user_modified: ingredients.some(ing => !ing.ai_detected),
          shared_with_coach: shareWithCoach,
          shared_at: shareWithCoach ? now.toISOString() : null,
        })
        .select()
        .single();

      if (mealError) throw mealError;

      // Save ingredients
      const ingredientsToSave = ingredients.map(ing => ({
        meal_id: mealData.id,
        ingredient_name: ing.ingredient_name,
        quantity: ing.quantity,
        unit: ing.unit,
        ai_detected: ing.ai_detected,
        confidence: ing.confidence,
      }));

      await supabase.from('meal_ingredients').insert(ingredientsToSave);

      // If shared, send message to coach
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
            const messageContent = JSON.stringify({
              type: 'meal_log',
              mealId: mealData.id,
              mealName: analysisResult.mealName,
              imageUrl: publicUrl,
              calories: analysisResult.calories,
              protein: analysisResult.protein_g,
              timestamp: now.toISOString(),
            });

            await supabase.from('messages').insert({
              sender_id: client.user_id,
              recipient_id: coach.user_id,
              content: messageContent,
              ai_generated: false,
            });
          }
        }
      }

      Alert.alert(
        'Success!',
        shareWithCoach ? 'Meal logged and shared with your coach!' : 'Meal logged successfully!',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      console.error('Error saving meal:', error);
      Alert.alert('Error', 'Failed to save meal. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Render different steps
  if (currentStep === 'camera' && !capturedImage) {
    return (
      <View style={styles.container}>
        <CameraView style={styles.camera} facing={facing} ref={cameraRef}>
          <View style={styles.cameraHeader}>
            <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
              <X size={28} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.cameraTitle}>Capture Your Meal</Text>
            <TouchableOpacity onPress={() => setFacing(facing === 'back' ? 'front' : 'back')}>
              <ChevronLeft size={28} color="#FFF" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.cameraFooter}>
            <TouchableOpacity onPress={pickFromGallery} style={styles.galleryButton}>
              <Text style={styles.galleryButtonText}>Gallery</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={takePicture} style={styles.captureButton}>
              <View style={styles.captureButtonInner} />
            </TouchableOpacity>
            <View style={{ width: 80 }} />
          </View>
        </CameraView>
      </View>
    );
  }

  if (currentStep === 'analyzing' || loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Analyzing Meal...</Text>
        </View>
        <View style={styles.loadingContainer}>
          {capturedImage && (
            <Image source={{ uri: capturedImage }} style={styles.previewImage} />
          )}
          <ActivityIndicator size="large" color="#3B82F6" style={{ marginTop: 20 }} />
          <Text style={styles.loadingText}>Our AI dietitian is analyzing your meal</Text>
          <Text style={styles.loadingSubtext}>This may take a few seconds...</Text>
        </View>
      </View>
    );
  }

  if (currentStep === 'review' && analysisResult) {
    return (
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Review Ingredients</Text>
          <TouchableOpacity onPress={() => {
            setCapturedImage(null);
            setCurrentStep('camera');
          }}>
            <X size={24} color="#000" />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <Image source={{ uri: capturedImage! }} style={styles.reviewImage} />
          
          <View style={styles.mealHeader}>
            <Text style={styles.mealName}>{analysisResult.mealName}</Text>
            <Text style={styles.mealDescription}>{analysisResult.description}</Text>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Ingredients</Text>
              <TouchableOpacity onPress={addIngredient} style={styles.addButton}>
                <Plus size={20} color="#3B82F6" />
                <Text style={styles.addButtonText}>Add</Text>
              </TouchableOpacity>
            </View>

            {ingredients.map((ing, index) => (
              <View key={ing.id} style={styles.ingredientRow}>
                <TextInput
                  style={styles.ingredientInput}
                  value={ing.ingredient_name}
                  onChangeText={(text) => updateIngredient(ing.id, 'ingredient_name', text)}
                  placeholder="Ingredient name"
                />
                <TextInput
                  style={styles.quantityInput}
                  value={ing.quantity?.toString() || ''}
                  onChangeText={(text) => updateIngredient(ing.id, 'quantity', parseFloat(text) || 0)}
                  keyboardType="numeric"
                  placeholder="Qty"
                />
                <TextInput
                  style={styles.unitInput}
                  value={ing.unit || ''}
                  onChangeText={(text) => updateIngredient(ing.id, 'unit', text)}
                  placeholder="Unit"
                />
                <TouchableOpacity onPress={() => removeIngredient(ing.id)}>
                  <Minus size={20} color="#EF4444" />
                </TouchableOpacity>
              </View>
            ))}
          </View>

          <TouchableOpacity style={styles.saveButton} onPress={finalizeAnalysis} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Check size={20} color="#FFF" />
                <Text style={styles.saveButtonText}>Finalize Analysis</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.adjustmentContainer}>
            <Text style={styles.adjustmentHelperText}>
              If something doesn't look right, you can correct the AI and adjust the analysis before saving.
            </Text>
            <TouchableOpacity 
              style={styles.adjustButton}
              onPress={() => setShowFeedbackModal(true)}
            >
              <Text style={styles.adjustButtonText}>Adjust Analysis</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Feedback Modal */}
        <Modal
          visible={showFeedbackModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowFeedbackModal(false)}
        >
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalContainer}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>What looks wrong?</Text>
                <TouchableOpacity onPress={() => setShowFeedbackModal(false)}>
                  <X size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <View style={styles.chipsContainer}>
                {[
                  { id: 'wrong_name', label: 'Wrong Name' },
                  { id: 'wrong_ingredients', label: 'Ingredients' },
                  { id: 'wrong_portion', label: 'Portion Size' },
                  { id: 'other', label: 'Other' }
                ].map((chip) => (
                  <TouchableOpacity
                    key={chip.id}
                    style={[
                      styles.chip,
                      feedbackType === chip.id && styles.chipSelected
                    ]}
                    onPress={() => setFeedbackType(chip.id as any)}
                  >
                    <Text style={[
                      styles.chipText,
                      feedbackType === chip.id && styles.chipTextSelected
                    ]}>{chip.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>
                {feedbackType === 'wrong_name' && "What is the correct meal name?"}
                {feedbackType === 'wrong_ingredients' && "Which ingredients are missing or wrong?"}
                {feedbackType === 'wrong_portion' && "Describe the correct portion size"}
                {feedbackType === 'other' && "Describe the issue"}
              </Text>

              <TextInput
                style={styles.feedbackInput}
                value={feedbackText}
                onChangeText={setFeedbackText}
                placeholder="Type correction here..."
                multiline
                numberOfLines={3}
              />

              <TouchableOpacity 
                style={styles.reanalyzeButton}
                onPress={handleReanalyzeWithFeedback}
                disabled={isReanalyzing || !feedbackText.trim()}
              >
                {isReanalyzing ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.reanalyzeButtonText}>Fix Analysis</Text>
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </ScrollView>
    );
  }

  if (currentStep === 'nutrition' && analysisResult) {
    return (
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Nutrition Breakdown</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <X size={24} color="#000" />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <Image source={{ uri: capturedImage! }} style={styles.reviewImage} />
          
          <View style={styles.nutritionCard}>
            <Text style={styles.nutritionTitle}>{analysisResult.mealName}</Text>
            <Text style={styles.nutritionSubtitle}>{analysisResult.portionSize}</Text>
            
            <View style={styles.macrosGrid}>
              <View style={styles.macroCard}>
                <Text style={styles.macroValue}>{analysisResult.calories}</Text>
                <Text style={styles.macroLabel}>Calories</Text>
              </View>
              <View style={styles.macroCard}>
                <Text style={styles.macroValue}>{analysisResult.protein_g}g</Text>
                <Text style={styles.macroLabel}>Protein</Text>
              </View>
              <View style={styles.macroCard}>
                <Text style={styles.macroValue}>{analysisResult.carbs_g}g</Text>
                <Text style={styles.macroLabel}>Carbs</Text>
              </View>
              <View style={styles.macroCard}>
                <Text style={styles.macroValue}>{analysisResult.fat_g}g</Text>
                <Text style={styles.macroLabel}>Fat</Text>
              </View>
            </View>

            <View style={styles.detailsSection}>
              <Text style={styles.detailsTitle}>Additional Nutrients</Text>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Fiber</Text>
                <Text style={styles.detailValue}>{analysisResult.fiber_g}g</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Sugar</Text>
                <Text style={styles.detailValue}>{analysisResult.sugar_g}g</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Sodium</Text>
                <Text style={styles.detailValue}>{analysisResult.sodium_mg}mg</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Iron</Text>
                <Text style={styles.detailValue}>{analysisResult.iron_mg}mg</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Vitamin C</Text>
                <Text style={styles.detailValue}>{analysisResult.vitamin_c_mg}mg</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity 
            onPress={() => saveMeal(true)} 
            style={styles.shareButton}
            disabled={saving}
          >
            <Send size={20} color="#FFF" />
            <Text style={styles.shareButtonText}>Send to Coach</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => saveMeal(false)} 
            style={styles.saveButton}
            disabled={saving}
          >
            <Check size={20} color="#3B82F6" />
            <Text style={styles.saveButtonText}>Save & Close</Text>
          </TouchableOpacity>
        </View>

        {/* Unknown Meal Info Modal */}
        <Modal
          visible={showInfoModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowInfoModal(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Tell us more about this meal</Text>
              <Text style={styles.modalSubtitle}>
                {analysisResult?.questions?.[0] || 'Help us identify your meal better'}
              </Text>

              <TextInput
                style={styles.modalInput}
                placeholder="Meal name (e.g., Chicken Shawarma)"
                value={mealName}
                onChangeText={setMealName}
              />

              <TextInput
                style={styles.modalInput}
                placeholder="Cooking method (e.g., grilled, fried)"
                value={cookingMethod}
                onChangeText={setCookingMethod}
              />

              <View style={styles.oilToggle}>
                <Text style={styles.oilLabel}>Was oil used?</Text>
                <TouchableOpacity
                  onPress={() => setHasOil(!hasOil)}
                  style={[styles.toggle, hasOil && styles.toggleActive]}
                >
                  <Text style={[styles.toggleText, hasOil && styles.toggleTextActive]}>
                    {hasOil ? 'Yes' : 'No'}
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity onPress={handleReanalyze} style={styles.modalButton}>
                <Text style={styles.modalButtonText}>Reanalyze</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setShowInfoModal(false)} style={styles.modalCancelButton}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </ScrollView>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  camera: {
    flex: 1,
  },
  cameraHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  closeButton: {
    padding: 10,
  },
  cameraTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
  cameraFooter: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 40,
    paddingTop: 20,
  },
  galleryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  galleryButtonText: {
    color: '#FFF',
    fontSize: 16,
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFF',
    borderWidth: 4,
    borderColor: '#3B82F6',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  previewImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 20,
  },
  loadingSubtext: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
  },
  content: {
    padding: 20,
  },
  reviewImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 20,
  },
  mealHeader: {
    marginBottom: 20,
  },
  mealName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  mealDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addButtonText: {
    color: '#3B82F6',
    fontSize: 16,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  ingredientInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
  },
  quantityInput: {
    width: 60,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
  },
  unitInput: {
    width: 50,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
  },
  shareButton: {
    flexDirection: 'row',
    backgroundColor: '#3B82F6',
    padding: 16,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  shareButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flexDirection: 'row',
    backgroundColor: '#3B82F6',
    padding: 16,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  adjustmentContainer: {
    marginTop: 12,
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  adjustmentHelperText: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 12,
  },
  adjustButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFF',
  },
  adjustButtonText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '500',
  },
  nutritionCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  nutritionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  nutritionSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
    marginBottom: 16,
  },
  macrosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  macroCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  macroValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#3B82F6',
  },
  macroLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  detailsSection: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 16,
  },
  detailsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },

  permissionText: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 20,
  },
  permissionButton: {
    backgroundColor: '#3B82F6',
    padding: 16,
    borderRadius: 12,
    marginHorizontal: 20,
  },
  permissionButtonText: {
    color: '#FFF',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  oilToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  oilLabel: {
    fontSize: 16,
    color: '#1F2937',
  },
  toggle: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
  },
  toggleActive: {
    backgroundColor: '#3B82F6',
  },
  toggleText: {
    color: '#6B7280',
    fontWeight: '600',
  },
  toggleTextActive: {
    color: '#FFF',
  },
  modalButton: {
    backgroundColor: '#3B82F6',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  modalButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalCancelButton: {
    padding: 14,
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#6B7280',
    fontSize: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  chipSelected: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  chipText: {
    fontSize: 14,
    color: '#4B5563',
    fontWeight: '500',
  },
  chipTextSelected: {
    color: '#2563EB',
    fontWeight: '600',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  feedbackInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    color: '#111827',
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  reanalyzeButton: {
    backgroundColor: '#2563EB',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  reanalyzeButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
