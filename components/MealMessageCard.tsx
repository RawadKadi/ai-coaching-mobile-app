import { useBrandColors } from '@/contexts/BrandContext';
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import Reanimated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
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
  const colors = useBrandColors();
  const styles = getStyles(colors);
  const router = useRouter();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });
  
  // Parse content if it's a string
  const data: MealMessageContent = typeof content === 'string' ? JSON.parse(content) : content;

  const handlePress = () => {
    router.push(`/meal-details/${data.mealId}`);
  };

  return (
    <Pressable 
      delayLongPress={200}
      onPressIn={() => {
        scale.value = withSpring(0.9, { stiffness: 450, damping: 25 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { stiffness: 450, damping: 25 });
      }}
      onLongPress={onLongPress}
    >
      <Reanimated.View
        style={[
          styles.container,
          isOwn ? styles.ownContainer : styles.otherContainer,
          animatedStyle
        ]}
      >
        {/* Header Signal */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.iconWrapper}>
              <Utensils size={14} color={colors.primary} />
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
            <Text style={styles.mealName} numberOfLines={2}>{data.mealName || 'Unknown Meal'}</Text>
            <View style={styles.macrosRow}>
              <View style={styles.macroItem}>
                  <Zap size={10} color={colors.primary} fill={colors.primary} />
                  <Text style={styles.macroValue}>{formatCompactNumber(data.calories || 0)} <Text style={styles.macroLabel}>kcal</Text></Text>
              </View>
              <View style={styles.dot} />
              <Text style={styles.macroValue}>{formatCompactNumber(data.protein || 0)}g <Text style={styles.macroLabel}>protein</Text></Text>
            </View>
          </View>

          <TouchableOpacity onPress={handlePress} activeOpacity={0.7} style={styles.footerButton}>
            <Text style={styles.footerText}>View Full Analysis</Text>
            <ChevronRight size={14} color={colors.primary} strokeWidth={3} />
          </TouchableOpacity>
        </View>
      </Reanimated.View>
    </Pressable>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    width: 280,
    borderRadius: 32,
    borderWidth: 1,
    overflow: 'hidden',
    marginVertical: 4,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 6,
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
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconWrapper: {
    width: 24,
    height: 24,
    backgroundColor: `${colors.primary}1A`,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: `${colors.primary}33`,
  },
  headerTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  content: {
    padding: 0,
  },
  imageContainer: {
    width: '100%',
    height: 160,
    backgroundColor: colors.background,
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
    color: colors.text,
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
    color: colors.text,
    fontWeight: '900',
  },
  macroLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  footerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 6,
  },
  footerText: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.text,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
