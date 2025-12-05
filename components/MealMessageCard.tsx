import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Utensils, ChevronRight } from 'lucide-react-native';

type MealMessageContent = {
  type: 'meal_log';
  mealId: string;
  mealName: string;
  imageUrl: string;
  calories: number;
  protein: number;
  timestamp: string;
};

type Props = {
  content: MealMessageContent | string;
  isOwn: boolean;
};

export default function MealMessageCard({ content, isOwn }: Props) {
  const router = useRouter();
  
  // Parse content if it's a string
  const data: MealMessageContent = typeof content === 'string' ? JSON.parse(content) : content;

  const handlePress = () => {
    router.push(`/meal-details/${data.mealId}`);
  };

  return (
    <View style={[
      styles.container,
      isOwn ? styles.ownContainer : styles.otherContainer
    ]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.iconContainer}>
            <Utensils size={16} color="#2563EB" />
          </View>
          <Text style={styles.headerTitle}>One of my meals today</Text>
        </View>
      </View>

      <View style={styles.content}>
        {data.imageUrl && (
          <Image 
            source={{ uri: data.imageUrl }} 
            style={styles.image} 
            contentFit="cover"
            transition={200}
          />
        )}
        
        <View style={styles.details}>
          <Text style={styles.mealName}>{data.mealName}</Text>
          <View style={styles.macrosContainer}>
            <Text style={styles.macroText}>{data.calories} kcal</Text>
            <Text style={styles.macroDivider}>•</Text>
            <Text style={styles.macroText}>{data.protein}g protein</Text>
          </View>
        </View>

        <TouchableOpacity onPress={handlePress} style={styles.button}>
          <Text style={styles.buttonText}>View Meal Details</Text>
          <ChevronRight size={16} color="#2563EB" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 280,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginVertical: 4,
    backgroundColor: '#EFF6FF', // blue-50
    borderColor: '#BFDBFE', // blue-200
  },
  ownContainer: {
    alignSelf: 'flex-end',
  },
  otherContainer: {
    alignSelf: 'flex-start',
  },
  header: {
    padding: 12,
    backgroundColor: '#DBEAFE', // blue-100
    borderBottomWidth: 1,
    borderBottomColor: '#BFDBFE', // blue-200
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconContainer: {
    backgroundColor: '#FFFFFF',
    padding: 4,
    borderRadius: 8,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E40AF', // blue-800
  },
  content: {
    padding: 0,
  },
  image: {
    width: '100%',
    height: 150,
    backgroundColor: '#E5E7EB',
  },
  details: {
    padding: 12,
  },
  mealName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E3A8A', // blue-900
    marginBottom: 4,
  },
  macrosContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  macroText: {
    fontSize: 14,
    color: '#3B82F6', // blue-500
    fontWeight: '500',
  },
  macroDivider: {
    color: '#93C5FD', // blue-300
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#BFDBFE', // blue-200
    backgroundColor: '#FFFFFF',
    gap: 4,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563EB', // blue-600
  },
});
