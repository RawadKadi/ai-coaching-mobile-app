import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Utensils, ChevronRight, Zap } from 'lucide-react-native';
import { formatCompactNumber } from '@/lib/format-utils';

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
  onLongPress?: () => void;
};

export default function MealMessageCard({ content, isOwn, onLongPress }: Props) {
  const router = useRouter();
  
  // Parse content if it's a string
  const data: MealMessageContent = typeof content === 'string' ? JSON.parse(content) : content;

  const handlePress = () => {
    router.push(`/meal-details/${data.mealId}`);
  };

  return (
    <TouchableOpacity 
      activeOpacity={0.9}
      delayLongPress={400}
      onLongPress={onLongPress}
      style={[
        styles.container,
        isOwn ? styles.ownContainer : styles.otherContainer
      ]}
    >
      {/* Header Signal */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.iconWrapper}>
            <Utensils size={14} color="#3B82F6" />
          </View>
          <Text style={styles.headerTitle}>Meal Log</Text>
        </View>
      </View>

      <View style={styles.content}>
        {data.imageUrl && (
          <View style={styles.imageContainer}>
            <Image 
              source={{ uri: data.imageUrl }} 
              style={styles.image} 
              contentFit="cover"
              transition={200}
              cachePolicy="disk"
            />
            {/* Overlay Gradient Placeholder (simulated with absolute view if needed, but keeping it clean) */}
          </View>
        )}
        
        <View style={styles.details}>
          <Text style={styles.mealName} numberOfLines={2}>{data.mealName || 'Unknown Protocol'}</Text>
          <View style={styles.macrosRow}>
            <View style={styles.macroItem}>
                <Zap size={10} color="#3B82F6" fill="#3B82F6" />
                <Text style={styles.macroValue}>{formatCompactNumber(data.calories || 0)} <Text style={styles.macroLabel}>kcal</Text></Text>
            </View>
            <View style={styles.dot} />
            <Text style={styles.macroValue}>{formatCompactNumber(data.protein || 0)}g <Text style={styles.macroLabel}>protein</Text></Text>
          </View>
        </View>

        <TouchableOpacity onPress={handlePress} activeOpacity={0.7} style={styles.footerButton}>
          <Text style={styles.footerText}>View Full Analysis</Text>
          <ChevronRight size={14} color="#3B82F6" strokeWidth={3} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 280,
    borderRadius: 32,
    borderWidth: 1,
    overflow: 'hidden',
    marginVertical: 4,
    backgroundColor: '#0f172a', // slate-900
    borderColor: 'rgba(255, 255, 255, 0.05)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  ownContainer: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: 8,
  },
  otherContainer: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 8,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.03)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconWrapper: {
    width: 24,
    height: 24,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
  },
  headerTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: '#3B82F6',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  content: {
    padding: 0,
  },
  imageContainer: {
    width: '100%',
    height: 160,
    backgroundColor: '#020617',
    padding: 8,
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
  },
  details: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  mealName: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  macrosRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  macroItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  macroValue: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '900',
  },
  macroLabel: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  footerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    gap: 6,
  },
  footerText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
