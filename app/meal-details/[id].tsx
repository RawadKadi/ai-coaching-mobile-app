import { useBrandColors, useTheme } from '@/contexts/BrandContext';
import { useAuth } from '@/contexts/AuthContext';
import { isDarkColor } from '@/lib/theme-utils';
import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  Animated,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import {
  ArrowLeft,
  Clock,
  Flame,
  Utensils,
  Zap,
  ChevronLeft,
  Target,
  Info,
  MessageSquare,
} from 'lucide-react-native';
import { MotiView } from 'moti';
import { formatCompactNumber } from '@/lib/format-utils';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { safeBack } from '@/lib/navigation-utils';
import { BrandedAvatar } from '@/components/BrandedAvatar';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HERO_HEIGHT = 750;

type MealDetails = {
  id: string;
  client_id?: string;
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
  const theme = useTheme();
  const colors = theme.colors;
  const isDark = theme.isDarkMode;
  const styles = getStyles(colors, isDark);
  const {
    id,
    clientId: paramClientId,
    clientName: paramClientName,
    clientAvatar: paramClientAvatar,
    messageId: paramMessageId,
    mealName: paramMealName,
    photoUrl: paramPhotoUrl,
    calories: paramCalories,
    protein: paramProtein,
  } = useLocalSearchParams<{
    id: string;
    clientId?: string;
    clientName?: string;
    clientAvatar?: string;
    messageId?: string;
    mealName?: string;
    photoUrl?: string;
    calories?: string;
    protein?: string;
  }>();
  const { coach, profile } = useAuth();
  const isCoach = !!coach || profile?.role === 'coach';
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [meal, setMeal] = useState<MealDetails | null>(null);
  const [resolvedMessageId, setResolvedMessageId] = useState<string>(
    paramMessageId || '',
  );
  const [clientInfo, setClientInfo] = useState<{
    id: string;
    name: string;
    avatar?: string;
  } | null>(
    paramClientId
      ? {
          id: paramClientId,
          name: paramClientName || 'Client',
          avatar: paramClientAvatar,
        }
      : null,
  );
  const [loading, setLoading] = useState(true);

  const scrollY = useRef(new Animated.Value(0)).current;

  // Stretchy pull-to-expand hero animation:
  // When pulling down (scrollY < 0), the image scales gracefully and stays anchored with zero gaps
  const imageScale = scrollY.interpolate({
    inputRange: [-300, 0],
    outputRange: [1.35, 1],
    extrapolateLeft: 'extend',
    extrapolateRight: 'clamp',
  });

  const imageTranslateY = scrollY.interpolate({
    inputRange: [-300, 0, 300],
    outputRange: [0, 0, -80],
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  useEffect(() => {
    fetchMealDetails();
  }, [id]);

  const fetchMealDetails = async () => {
    try {
      const [mealRes, ingredientsRes, msgRes] = await Promise.all([
        supabase.from('meals').select('*').eq('id', id).maybeSingle(),
        supabase.from('meal_ingredients').select('*').eq('meal_id', id),
        paramMessageId
          ? supabase
              .from('messages')
              .select('*')
              .eq('id', paramMessageId)
              .maybeSingle()
          : supabase
              .from('messages')
              .select('*')
              .ilike('content', `%${id}%`)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle(),
      ]);

      const mealData = mealRes.data;
      const ingredientsData = ingredientsRes.data;
      const msgRow = msgRes.data;

      if (msgRow?.id) {
        setResolvedMessageId(msgRow.id);
      }

      let parsedMsg: any = null;
      if (msgRow?.content) {
        try {
          parsedMsg =
            typeof msgRow.content === 'string'
              ? JSON.parse(msgRow.content)
              : msgRow.content;
          if (
            typeof parsedMsg === 'string' &&
            parsedMsg.trim().startsWith('{')
          ) {
            parsedMsg = JSON.parse(parsedMsg.trim());
          }
        } catch {}
      }

      if (mealData) {
        setMeal({
          ...mealData,
          meal_name:
            mealData.meal_name ||
            mealData.name ||
            parsedMsg?.mealName ||
            paramMealName ||
            'Meal Log',
          photo_url:
            mealData.photo_url ||
            parsedMsg?.imageUrl ||
            parsedMsg?.photo_url ||
            paramPhotoUrl ||
            '',
          ingredients: ingredientsData || [],
        });
      } else if (parsedMsg || paramMealName || paramPhotoUrl) {
        setMeal({
          id: String(id),
          client_id: paramClientId,
          meal_name: parsedMsg?.mealName || paramMealName || 'Meal Log',
          description: parsedMsg?.description || '',
          photo_url:
            parsedMsg?.imageUrl ||
            parsedMsg?.photo_url ||
            parsedMsg?.url ||
            paramPhotoUrl ||
            '',
          calories: Number(parsedMsg?.calories ?? paramCalories) || 0,
          protein_g: Number(parsedMsg?.protein ?? paramProtein) || 0,
          carbs_g: 0,
          fat_g: 0,
          fiber_g: 0,
          sugar_g: 0,
          sodium_mg: 0,
          meal_date: (
            parsedMsg?.timestamp ||
            msgRow?.created_at ||
            new Date().toISOString()
          ).split('T')[0],
          meal_time: '',
          ai_notes: '',
          ingredients: ingredientsData || [],
        });
      }

      // Resolve client info for Coach view using SECURITY DEFINER RPCs
      let resolvedClientId = mealData?.client_id || paramClientId;
      if (isCoach) {
        if (!resolvedClientId && msgRow?.sender_id) {
          const { data: myClients } = await supabase.rpc('get_my_clients');
          const matchedClient = (myClients || []).find(
            (c: any) => (c.user_id || c.client_user_id) === msgRow.sender_id,
          );
          if (matchedClient) {
            resolvedClientId = matchedClient.client_id;
            setClientInfo({
              id: matchedClient.client_id,
              name: matchedClient.client_name || 'Client',
              avatar: matchedClient.client_avatar,
            });
          }
        } else if (resolvedClientId) {
          const { data: cData } = await supabase.rpc('get_client_details', {
            target_client_id: resolvedClientId,
          });
          if (cData) {
            setClientInfo({
              id: resolvedClientId,
              name: cData?.profiles?.full_name || paramClientName || 'Client',
              avatar: cData?.profiles?.avatar_url || paramClientAvatar,
            });
          } else {
            setClientInfo({
              id: resolvedClientId,
              name: paramClientName || 'Client',
              avatar: paramClientAvatar,
            });
          }
        }
      }
    } catch (error) {
      console.error('Error fetching meal details:', error);
    } finally {
      setLoading(false);
    }
  };

  const targetClientId = clientInfo?.id || meal?.client_id || paramClientId;
  const primaryBtnText =
    colors.textOnPrimary ||
    (isDarkColor(colors.primary) ? '#FFFFFF' : '#0F172A');

  const handleMessageClient = () => {
    if (!targetClientId || !meal) return;
    router.navigate({
      pathname: '/(coach)/chat/[id]',
      params: {
        id: String(targetClientId),
        replyToMealId: String(meal.id || id),
        replyToMessageId: resolvedMessageId || paramMessageId || '',
        replyToMealName: meal.meal_name || paramMealName || 'Meal Log',
        replyToMealPhoto: meal.photo_url || paramPhotoUrl || '',
        replyToClientName: clientInfo?.name || paramClientName || '',
      },
    });
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!meal) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Info size={48} color={colors.textTertiary} />
        <Text style={styles.errorText}>Meal not found</Text>
        <TouchableOpacity onPress={() => safeBack()} style={styles.errorButton}>
          <Text style={styles.errorButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Background Image with Stretchy Expansion */}
      {meal.photo_url && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.fixedImageContainer,
            {
              transform: [
                { translateY: imageTranslateY },
                { scale: imageScale },
              ],
            },
          ]}
        >
          <Image
            source={{ uri: meal.photo_url }}
            style={styles.image}
            contentFit="cover"
            contentPosition="top"
            transition={200}
            cachePolicy="disk"
          />
          <View style={styles.imageOverlay} />
        </Animated.View>
      )}

      {/* Floating Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <TouchableOpacity
          onPress={() => safeBack()}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <ChevronLeft size={24} color="#F8FAFC" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerSubtitle}>Meal Details</Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      <Animated.ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          isCoach && targetClientId
            ? { paddingBottom: Math.max(insets.bottom + 112, 128) }
            : null,
        ]}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true },
        )}
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
            {isCoach && clientInfo && (
              <View style={styles.clientPill}>
                <BrandedAvatar
                  name={clientInfo.name}
                  imageUrl={clientInfo.avatar}
                  size={28}
                />
                <Text style={styles.clientPillText} numberOfLines={1}>
                  {clientInfo.name}
                </Text>
              </View>
            )}
            <View style={styles.badgeRow}>
              <View style={styles.categoryBadge}>
                <Clock size={12} color={colors.primary} />
                <Text style={styles.categoryText}>
                  {meal.meal_time || 'Logged'}
                </Text>
              </View>
              <Text style={styles.dateText}>
                {new Date(meal.meal_date).toLocaleDateString(undefined, {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </Text>
            </View>
            <Text style={styles.mealName}>{meal.meal_name}</Text>
            {meal.description ? (
              <Text style={styles.description}>{meal.description}</Text>
            ) : null}
          </View>

          {/* Macros Grid */}
          <View style={styles.macrosGrid}>
            <MacroTile
              label="Energy"
              value={formatCompactNumber(meal.calories)}
              unit="kcal"
              icon={
                <Flame size={16} color={colors.primary} fill={colors.primary} />
              }
              styles={styles}
            />
            <MacroTile
              label="Protein"
              value={formatCompactNumber(meal.protein_g)}
              unit="g"
              styles={styles}
            />
            <MacroTile
              label="Carbs"
              value={formatCompactNumber(meal.carbs_g)}
              unit="g"
              styles={styles}
            />
            <MacroTile
              label="Fat"
              value={formatCompactNumber(meal.fat_g)}
              unit="g"
              styles={styles}
            />
          </View>

          {/* Ingredients Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIcon}>
                <Utensils size={16} color={colors.primary} />
              </View>
              <Text style={styles.sectionTitle}>Ingredients</Text>
            </View>

            <View style={styles.ingredientsCard}>
              {meal.ingredients.length > 0 ? (
                meal.ingredients.map((ing, index) => (
                  <View
                    key={index}
                    style={[
                      styles.ingredientRow,
                      index === meal.ingredients.length - 1 && styles.noBorder,
                    ]}
                  >
                    <View style={styles.dot} />
                    <Text style={styles.ingredientText}>
                      <Text style={styles.ingredientQuantity}>
                        {ing.quantity}
                        {ing.unit}{' '}
                      </Text>
                      <Text style={styles.ingredientName}>
                        {ing.ingredient_name}
                      </Text>
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>No ingredients listed.</Text>
              )}
            </View>
          </View>

          {/* Coach Insight Section */}
          {meal.ai_notes && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionIcon}>
                  <Zap size={16} color={colors.primary} fill={colors.primary} />
                </View>
                <Text style={styles.sectionTitle}>Coach Insights</Text>
              </View>
              <View style={styles.aiInsightCard}>
                <Text style={styles.aiText}>{meal.ai_notes}</Text>
              </View>
            </View>
          )}
        </MotiView>
      </Animated.ScrollView>

      {/* Coach Bottom CTA: Message Client (Auto-replies to this Meal Log) */}
      {isCoach && targetClientId && (
        <View
          style={[
            styles.bottomCtaBar,
            {
              paddingBottom: Math.max(insets.bottom + 8, 20),
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
            },
          ]}
        >
          <TouchableOpacity
            onPress={handleMessageClient}
            activeOpacity={0.85}
            style={[
              styles.messageClientButton,
              { backgroundColor: colors.primary },
            ]}
          >
            <MessageSquare size={20} color={primaryBtnText} strokeWidth={2.5} />
            <Text
              style={[
                styles.messageClientButtonText,
                { color: primaryBtnText },
              ]}
            >
              Message Client
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function MacroTile({
  label,
  value,
  unit,
  icon,
  styles,
}: {
  label: string;
  value: string;
  unit: string;
  icon?: React.ReactNode;
  styles: any;
}) {
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

const getStyles = (colors: any, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
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
      height: HERO_HEIGHT,
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
    },
    backButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: 'rgba(0, 0, 0, 0.45)',
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
      fontSize: 11,
      fontWeight: '800',
      color: '#FFFFFF',
      textTransform: 'uppercase',
      letterSpacing: 2,
      marginBottom: 2,
      textShadowColor: 'rgba(0, 0, 0, 0.6)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
    },
    scrollContent: {
      paddingBottom: 40,
    },
    image: {
      width: '100%',
      height: '100%',
    },
    imageOverlay: {
      ...StyleSheet.absoluteFill,
      backgroundColor: isDark ? 'rgba(0, 0, 0, 0.4)' : 'rgba(0, 0, 0, 0.15)',
    },
    mainContent: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 40,
      borderTopRightRadius: 40,
      paddingHorizontal: 24,
      paddingTop: 36,
      minHeight: 800,
      zIndex: 1,
      borderTopWidth: 1,
      borderLeftWidth: 1,
      borderRightWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -10 },
      shadowOpacity: isDark ? 0.35 : 0.08,
      shadowRadius: 24,
      elevation: 20,
    },
    titleSection: {
      marginBottom: 28,
    },
    clientPill: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 8,
      backgroundColor: colors.background,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 14,
    },
    clientPillText: {
      fontSize: 13,
      fontWeight: '800',
      color: colors.text,
    },
    bottomCtaBar: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: 24,
      paddingTop: 14,
      borderTopWidth: 1,
      zIndex: 50,
    },
    messageClientButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      paddingVertical: 18,
      borderRadius: 24,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.25,
      shadowRadius: 16,
      elevation: 8,
    },
    messageClientButtonText: {
      fontSize: 16,
      fontWeight: '900',
      letterSpacing: 0.3,
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
      backgroundColor: `${colors.primary}15`,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: `${colors.primary}30`,
    },
    categoryText: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.primary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    dateText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    mealName: {
      fontSize: 28,
      fontWeight: '900',
      color: colors.text,
      letterSpacing: -0.5,
      marginBottom: 10,
      lineHeight: 34,
    },
    description: {
      fontSize: 15,
      color: colors.textSecondary,
      lineHeight: 22,
      fontWeight: '500',
    },
    macrosGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      marginBottom: 28,
    },
    macroTile: {
      flex: 1,
      minWidth: '45%',
      backgroundColor: colors.background,
      borderRadius: 20,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    macroTileLabel: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 6,
    },
    macroTileValueRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
    },
    macroTileValue: {
      fontSize: 22,
      fontWeight: '900',
      color: colors.text,
      marginRight: 4,
    },
    macroTileUnit: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    section: {
      marginBottom: 28,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 14,
    },
    sectionIcon: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: `${colors.primary}18`,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: `${colors.primary}30`,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -0.3,
    },
    ingredientsCard: {
      backgroundColor: colors.background,
      borderRadius: 24,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.border,
    },
    ingredientRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    noBorder: {
      borderBottomWidth: 0,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.primary,
      marginRight: 14,
    },
    ingredientText: {
      flex: 1,
      fontSize: 15,
    },
    ingredientQuantity: {
      fontWeight: '800',
      color: colors.text,
    },
    ingredientName: {
      fontWeight: '500',
      color: colors.textSecondary,
    },
    aiInsightCard: {
      backgroundColor: `${colors.primary}10`,
      borderRadius: 24,
      padding: 20,
      borderWidth: 1,
      borderColor: `${colors.primary}25`,
    },
    aiText: {
      fontSize: 15,
      color: colors.text,
      lineHeight: 24,
      fontWeight: '500',
    },
    errorText: {
      color: colors.textSecondary,
      fontSize: 16,
      fontWeight: '600',
      marginTop: 16,
      marginBottom: 24,
    },
    errorButton: {
      paddingHorizontal: 24,
      paddingVertical: 12,
      backgroundColor: colors.primary,
      borderRadius: 16,
    },
    errorButtonText: {
      color: colors.textOnPrimary || '#FFFFFF',
      fontWeight: '900',
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    emptyText: {
      color: colors.textSecondary,
      fontSize: 14,
      textAlign: 'center',
      fontStyle: 'italic',
    },
  });
