import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Clock, Flame, Utensils } from 'lucide-react-native';

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
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  if (!meal) {
    return (
      <View style={styles.container}>
        <Text>Meal not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Meal Details</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {meal.photo_url && (
          <Image source={{ uri: meal.photo_url }} style={styles.image} contentFit="cover" transition={200} />
        )}

        <View style={styles.content}>
          <View style={styles.titleSection}>
            <Text style={styles.mealName}>{meal.meal_name}</Text>
            <Text style={styles.mealTime}>
              {new Date(meal.meal_date).toLocaleDateString()} • {meal.meal_time}
            </Text>
          </View>

          {meal.description && (
            <Text style={styles.description}>{meal.description}</Text>
          )}

          <View style={styles.macrosCard}>
            <View style={styles.macroItem}>
              <Flame size={20} color="#EF4444" />
              <Text style={styles.macroValue}>{meal.calories}</Text>
              <Text style={styles.macroLabel}>Calories</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.macroItem}>
              <Text style={styles.macroValue}>{meal.protein_g}g</Text>
              <Text style={styles.macroLabel}>Protein</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.macroItem}>
              <Text style={styles.macroValue}>{meal.carbs_g}g</Text>
              <Text style={styles.macroLabel}>Carbs</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.macroItem}>
              <Text style={styles.macroValue}>{meal.fat_g}g</Text>
              <Text style={styles.macroLabel}>Fat</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ingredients</Text>
            {meal.ingredients.map((ing, index) => (
              <View key={index} style={styles.ingredientRow}>
                <View style={styles.bullet} />
                <Text style={styles.ingredientText}>
                  {ing.quantity} {ing.unit} {ing.ingredient_name}
                </Text>
              </View>
            ))}
          </View>

          {meal.ai_notes && (
            <View style={styles.aiNoteContainer}>
              <View style={styles.aiHeader}>
                <Utensils size={16} color="#059669" />
                <Text style={styles.aiTitle}>AI Analysis</Text>
              </View>
              <Text style={styles.aiText}>{meal.ai_notes}</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  image: {
    width: '100%',
    height: 250,
  },
  content: {
    padding: 20,
  },
  titleSection: {
    marginBottom: 16,
  },
  mealName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  mealTime: {
    fontSize: 14,
    color: '#6B7280',
  },
  description: {
    fontSize: 16,
    color: '#4B5563',
    marginBottom: 24,
    lineHeight: 24,
  },
  macrosCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  macroItem: {
    alignItems: 'center',
    flex: 1,
  },
  macroValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginTop: 4,
  },
  macroLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  divider: {
    width: 1,
    height: 40,
    backgroundColor: '#E5E7EB',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#3B82F6',
    marginRight: 12,
  },
  ingredientText: {
    fontSize: 16,
    color: '#374151',
  },
  aiNoteContainer: {
    backgroundColor: '#ECFDF5',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#10B981',
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  aiTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#047857',
  },
  aiText: {
    fontSize: 14,
    color: '#065F46',
    lineHeight: 20,
  },
});
