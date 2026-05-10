import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Dimensions, StatusBar } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Clock, Flame, Utensils, Zap, ChevronLeft, Target, Info } from 'lucide-react-native';
import { MotiView } from 'moti';
import { formatCompactNumber } from '@/lib/format-utils';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type MealDetails = {
  id: string;
  meal_name: string;
  description: string;
  photo_url: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
  meal_date: string;
  meal_time: string;
  ai_notes: string;
  ingredients: {
    ingredient_name: string;
    quantity: number;
    unit: string;
  }[];
};

export default function MealDetailsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [meal, setMeal] = useState<MealDetails | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMealDetails();
  }, [id]);

  const fetchMealDetails = async () => {
    try {
      // Fetch meal info
      const { data: mealData, error: mealError } = await supabase
        .from('meals')
        .select('*')
        .eq('id', id)
        .single();

      if (mealError) throw mealError;

      // Fetch ingredients
      const { data: ingredientsData, error: ingError } = await supabase
        .from('meal_ingredients')
        .select('*')
        .eq('meal_id', id);

      if (ingError) throw ingError;

      setMeal({
        ...mealData,
        ingredients: ingredientsData || [],
      });
    } catch (error) {
      console.error('Error fetching meal details:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  if (!meal) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Info size={48} color="#64748b" />
        <Text style={styles.errorText}>Analysis not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.errorButton}>
          <Text style={styles.errorButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Fixed Background Image */}
      {meal.photo_url && (
        <View style={styles.fixedImageContainer}>
          <Image 
            source={{ uri: meal.photo_url }} 
            style={styles.image} 
            contentFit="cover" 
            transition={200} 
            cachePolicy="disk"
          />
          <View style={styles.imageOverlay} />
        </View>
      )}

      {/* Floating Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <TouchableOpacity 
          onPress={() => router.back()} 
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <ChevronLeft size={24} color="#F8FAFC" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerSubtitle}>Meal Analysis</Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[]}
      >
        {/* Spacer to show the fixed image */}
        <View style={styles.imageSpacer} />

        <MotiView
          from={{ opacity: 0, translateY: 100 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 600, delay: 100 }}
          style={styles.mainContent}
        >
          <View style={styles.titleSection}>
            <View style={styles.badgeRow}>
              <View style={styles.categoryBadge}>
                <Clock size={12} color="#3B82F6" />
                <Text style={styles.categoryText}>{meal.meal_time || 'Planned'}</Text>
              </View>
              <Text style={styles.dateText}>
                {new Date(meal.meal_date).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
              </Text>
            </View>
            <Text style={styles.mealName}>{meal.meal_name}</Text>
            {meal.description && (
              <Text style={styles.description}>{meal.description}</Text>
            )}
          </View>

          {/* Macros Grid */}
          <View style={styles.macrosGrid}>
            <MacroTile 
              label="Energy" 
              value={formatCompactNumber(meal.calories)} 
              unit="kcal" 
              icon={<Flame size={16} color="#3B82F6" fill="#3B82F6" />}
            />
            <MacroTile 
              label="Protein" 
              value={formatCompactNumber(meal.protein_g)} 
              unit="g" 
            />
            <MacroTile 
              label="Carbs" 
              value={formatCompactNumber(meal.carbs_g)} 
              unit="g" 
            />
            <MacroTile 
              label="Fat" 
              value={formatCompactNumber(meal.fat_g)} 
              unit="g" 
            />
          </View>

          {/* Ingredients Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIcon}>
                <Utensils size={16} color="#3B82F6" />
              </View>
              <Text style={styles.sectionTitle}>Protocol Ingredients</Text>
            </View>
            
            <View style={styles.ingredientsCard}>
              {meal.ingredients.length > 0 ? meal.ingredients.map((ing, index) => (
                <View key={index} style={[styles.ingredientRow, index === meal.ingredients.length - 1 && styles.noBorder]}>
                  <View style={styles.dot} />
                  <Text style={styles.ingredientText}>
                    <Text style={styles.ingredientQuantity}>{ing.quantity}{ing.unit} </Text>
                    <Text style={styles.ingredientName}>{ing.ingredient_name}</Text>
                  </Text>
                </View>
              )) : (
                <Text style={styles.emptyText}>No ingredients listed for this analysis.</Text>
              )}
            </View>
          </View>

          {/* AI Insight Section */}
          {meal.ai_notes && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionIcon, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                  <Zap size={16} color="#3B82F6" fill="#3B82F6" />
                </View>
                <Text style={styles.sectionTitle}>Coach Insights</Text>
              </View>
              <View style={styles.aiInsightCard}>
                <Text style={styles.aiText}>{meal.ai_notes}</Text>
              </View>
            </View>
          )}
        </MotiView>
      </ScrollView>
    </View>
  );
}

function MacroTile({ label, value, unit, icon }: { label: string; value: string; unit: string; icon?: React.ReactNode }) {
  return (
    <View style={styles.macroTile}>
      <Text style={styles.macroTileLabel}>{label}</Text>
      <View style={styles.macroTileValueRow}>
        {icon && <View style={{ marginRight: 4 }}>{icon}</View>}
        <Text style={styles.macroTileValue}>{value}</Text>
        <Text style={styles.macroTileUnit}>{unit}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617', // slate-950
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  fixedImageContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 400,
    backgroundColor: '#0f172a',
    zIndex: 0,
  },
  imageSpacer: {
    height: 320,
    backgroundColor: 'transparent',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.5)', // semi-transparent
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleContainer: {
    alignItems: 'center',
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 2,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2, 6, 23, 0.1)',
  },
  mainContent: {
    backgroundColor: '#020617',
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    paddingHorizontal: 24,
    paddingTop: 40,
    minHeight: 800,
    zIndex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -20 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 20,
  },
  titleSection: {
    marginBottom: 32,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#3B82F6',
    textTransform: 'uppercase',
  },
  dateText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  mealName: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -1,
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: '#94a3b8',
    lineHeight: 24,
    fontWeight: '500',
  },
  macrosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 32,
  },
  macroTile: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  macroTileLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  macroTileValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  macroTileValue: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFFFFF',
    marginRight: 4,
  },
  macroTileUnit: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  sectionIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  ingredientsCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 32,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.03)',
  },
  noBorder: {
    borderBottomWidth: 0,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#3B82F6',
    marginRight: 16,
  },
  ingredientText: {
    flex: 1,
    fontSize: 16,
  },
  ingredientQuantity: {
    fontWeight: '900',
    color: '#FFFFFF',
  },
  ingredientName: {
    fontWeight: '500',
    color: '#94a3b8',
  },
  aiInsightCard: {
    backgroundColor: 'rgba(59, 130, 246, 0.03)',
    borderRadius: 32,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.1)',
  },
  aiText: {
    fontSize: 16,
    color: '#F1F5F9',
    lineHeight: 26,
    fontWeight: '500',
  },
  errorText: {
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 24,
  },
  errorButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#3B82F6',
    borderRadius: 16,
  },
  errorButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  emptyText: {
    color: '#64748b',
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
