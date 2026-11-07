import { useBrandColors } from '@/contexts/BrandContext';
import { isDarkColor } from '@/lib/theme-utils';
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Platform,
  UIManager,
  LayoutAnimation,
} from 'react-native';
import {
  CheckCircle,
  Circle,
  Dumbbell,
  Apple,
  Moon,
  Zap,
  Clock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react-native';
import { MotiView } from 'moti';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useReducedMotion } from 'react-native-reanimated';
import { getExerciseVisualUrl } from '@/lib/exercise-assets';
import { parseChallengeDescription } from '@/lib/challenge-description';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export interface NestedTaskCardProps {
  task: any;
  isCompleted?: boolean;
  isFailed?: boolean;
  isPast?: boolean;
  index?: number;
  onToggleParent?: (task: any) => void;
  layoutType?: 'feed' | 'detail';
  showGlobalRule?: boolean;
}

interface ExerciseTask {
  id: string;
  exercise: string;
  sets: number;
  notes?: string;
}

interface ParsedTaskData {
  global_rule?: string;
  sub_tasks: ExerciseTask[];
  plainText?: string;
}

function getFocusIcon(
  type: string,
  completed: boolean,
  primaryColor: string,
  isDark: boolean = true,
) {
  const color = completed ? primaryColor : isDark ? '#94A3B8' : '#64748B';
  switch (type?.toLowerCase()) {
    case 'training':
      return <Dumbbell size={22} color={color} />;
    case 'nutrition':
      return <Apple size={22} color={color} />;
    case 'recovery':
      return <Moon size={22} color={color} />;
    default:
      return <Zap size={22} color={color} />;
  }
}

export function NestedTaskCard({
  task,
  isCompleted,
  isFailed,
  isPast,
  index = 0,
  onToggleParent,
  layoutType = 'feed',
  showGlobalRule = true,
}: NestedTaskCardProps) {
  const colors = useBrandColors();
  const isDark = isDarkColor(colors.background || '#020617');
  const cardBg = colors.surface || (isDark ? '#0F172A' : '#FFFFFF');
  const cardBorder =
    colors.border || (isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0');
  const textColor = colors.text || (isDark ? '#FFFFFF' : '#0F172A');
  const textSecondaryColor =
    colors.textSecondary || (isDark ? '#94A3B8' : '#64748B');
  const innerBg = colors.background || (isDark ? '#020617' : '#F8FAFC');

  const reduceMotion = useReducedMotion();
  const [checkedSets, setCheckedSets] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());

  // Strictly parse the JSON layout to enforce exact TypeScript structural types.
  const parsedData: ParsedTaskData = useMemo(() => {
    const parsed = parseChallengeDescription(task.description);
    if (parsed.isStructured && parsed.subTasks && parsed.subTasks.length > 0) {
      return {
        global_rule: parsed.globalRule,
        sub_tasks: parsed.subTasks.map((st, i) => ({
          id: st.id || `ex_${i}`,
          exercise: st.exercise,
          sets: typeof st.sets === 'number' && st.sets > 0 ? st.sets : 1,
          notes: st.notes,
        })),
        plainText: parsed.plainText,
      };
    }
    return {
      global_rule: parsed.globalRule,
      sub_tasks: [],
      plainText:
        parsed.plainText ||
        (typeof task.description === 'string' ? task.description : ''),
    };
  }, [task.description]);

  const isFullyCompleted = task.completed;

  const toggleExpand = (exerciseId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!reduceMotion) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setExpandedId((prev) => (prev === exerciseId ? null : exerciseId));
  };

  const toggleSet = (exerciseId: string, setIndex: number) => {
    if (isFullyCompleted) return; // Locked

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const key = `${exerciseId}_set_${setIndex}`;
    const newChecked = new Set(checkedSets);

    if (newChecked.has(key)) {
      newChecked.delete(key);
    } else {
      newChecked.add(key);
    }

    setCheckedSets(newChecked);

    // Check if all sets for all exercises are completed
    let allCompleted = true;
    for (const ex of parsedData.sub_tasks) {
      const numSets = ex.sets || 1;
      for (let i = 0; i < numSets; i++) {
        if (!newChecked.has(`${ex.id}_set_${i}`)) {
          allCompleted = false;
          break;
        }
      }
      if (!allCompleted) break;
    }

    // Trigger parent state transition immediately when the final set is tapped
    if (allCompleted && !isFullyCompleted && onToggleParent) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onToggleParent(task);
    }
  };

  const isDetail = layoutType === 'detail';

  return (
    <View
      style={{
        marginBottom: isDetail ? 16 : 16,
        padding: isDetail ? 0 : 20,
        borderRadius: isDetail ? 0 : 28,
        borderWidth: isDetail ? 0 : 1,
        borderColor: isFullyCompleted ? `${colors.primary}40` : cardBorder,
        backgroundColor: isDetail ? 'transparent' : cardBg,
        opacity:
          isFailed || (isCompleted && !isFullyCompleted) || isPast
            ? 0.7
            : isFullyCompleted
              ? 0.8
              : 1,
      }}
    >
      {/* Challenge Title & Info Row - Unboxed, clean without wrapping card */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: isDetail ? 12 : 16,
          paddingHorizontal: isDetail ? 2 : 0,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, marginRight: 8 }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F5F9',
              borderWidth: 1,
              borderColor: cardBorder,
            }}
          >
            {getFocusIcon(
              task.focus_type,
              isFullyCompleted,
              colors.primary,
              isDark,
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 16,
                fontWeight: '900',
                color: isFullyCompleted ? textSecondaryColor : textColor,
                textDecorationLine: isFullyCompleted ? 'line-through' : 'none',
              }}
              numberOfLines={1}
            >
              {task.name}
            </Text>
            <Text
              style={{
                color: textSecondaryColor,
                fontSize: 11,
                fontWeight: '800',
                textTransform: 'uppercase',
                letterSpacing: 1.1,
                marginTop: 2,
              }}
            >
              {task.focus_type || 'TRAINING'} • {task.intensity || 'HIGH'}
            </Text>
          </View>
        </View>

        <View
          style={{
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 999,
            backgroundColor: isFullyCompleted
              ? `${colors.primary}20`
              : isDark
              ? 'rgba(255, 255, 255, 0.06)'
              : '#F1F5F9',
            borderWidth: 1,
            borderColor: isFullyCompleted ? `${colors.primary}40` : cardBorder,
          }}
        >
          <Text
            style={{
              color: isFullyCompleted ? colors.primary : textSecondaryColor,
              fontSize: 10,
              fontWeight: '900',
              textTransform: 'uppercase',
              letterSpacing: 1,
            }}
          >
            {isFullyCompleted ? 'Done' : 'Pending'}
          </Text>
        </View>
      </View>

      {/* Subtasks Accordion List */}
      <View style={{ gap: 8 }}>
        {parsedData.sub_tasks.map((ex) => {
          const numSets = ex.sets || 1;
          const isExpanded = expandedId === ex.id;

          let isExerciseDone = true;
          for (let i = 0; i < numSets; i++) {
            if (!checkedSets.has(`${ex.id}_set_${i}`) && !isFullyCompleted) {
              isExerciseDone = false;
              break;
            }
          }

          return (
            <View
              key={ex.id}
              style={{
                backgroundColor: isDetail ? cardBg : innerBg,
                borderColor: cardBorder,
                borderWidth: 1,
                borderRadius: 20,
                overflow: 'hidden',
              }}
            >
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => toggleExpand(ex.id)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 14,
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    flex: 1,
                    marginRight: 8,
                  }}
                >
                  {isExerciseDone ? (
                    <CheckCircle size={20} color={colors.primary} />
                  ) : (
                    <Circle size={20} color={textSecondaryColor} />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: '700',
                        color: isExerciseDone ? textSecondaryColor : textColor,
                        textDecorationLine: isExerciseDone
                          ? 'line-through'
                          : 'none',
                      }}
                    >
                      {ex.exercise}
                    </Text>
                    <Text
                      style={{
                        color: textSecondaryColor,
                        fontSize: 10,
                        fontWeight: '800',
                        textTransform: 'uppercase',
                        letterSpacing: 1.1,
                        marginTop: 3,
                      }}
                    >
                      {numSets} {numSets === 1 ? 'SET' : 'SETS'}
                    </Text>
                  </View>
                </View>

                {isExpanded ? (
                  <ChevronUp size={18} color={textSecondaryColor} />
                ) : (
                  <ChevronDown size={18} color={textSecondaryColor} />
                )}
              </TouchableOpacity>

              {/* Accordion Content with smooth native LayoutAnimation */}
              {isExpanded && (
                <View
                  style={{
                    paddingHorizontal: 16,
                    paddingBottom: 16,
                    paddingTop: 4,
                    borderTopWidth: 1,
                    borderTopColor: isDark
                      ? 'rgba(255, 255, 255, 0.05)'
                      : '#F1F5F9',
                  }}
                >
                  {(() => {
                    const activeMediaUrl = getExerciseVisualUrl(ex.exercise);

                    if (!activeMediaUrl || imageErrors.has(ex.id)) return null;

                    return (
                      <View
                        style={{
                          width: '100%',
                          height: 180,
                          borderRadius: 16,
                          marginBottom: 12,
                          backgroundColor: '#FFFFFF',
                          overflow: 'hidden',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Image
                          source={{ uri: activeMediaUrl }}
                          style={{ width: 160, height: 160 }}
                          contentFit="contain"
                          transition={200}
                          cachePolicy="memory-disk"
                          onError={() => {
                            setImageErrors((prev) =>
                              new Set(prev).add(ex.id),
                            );
                          }}
                        />
                      </View>
                    );
                  })()}

                  {ex.notes && (
                    <Text
                      style={{
                        color: textSecondaryColor,
                        fontSize: 13,
                        lineHeight: 18,
                        marginBottom: 14,
                        marginTop: 2,
                      }}
                    >
                      {ex.notes}
                    </Text>
                  )}

                  {Array.from({ length: numSets }).map((_, i) => {
                    const isSetDone =
                      checkedSets.has(`${ex.id}_set_${i}`) ||
                      isFullyCompleted;
                    return (
                      <TouchableOpacity
                        key={i}
                        activeOpacity={0.7}
                        onPress={() => toggleSet(ex.id, i)}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          paddingVertical: 10,
                          gap: 12,
                        }}
                      >
                        {isSetDone ? (
                          <CheckCircle size={20} color={colors.primary} />
                        ) : (
                          <Circle size={20} color={textSecondaryColor} />
                        )}
                        <Text
                          style={{
                            fontSize: 14,
                            fontWeight: '600',
                            color: isSetDone ? textSecondaryColor : textColor,
                            textDecorationLine: isSetDone
                              ? 'line-through'
                              : 'none',
                          }}
                        >
                          Set {i + 1}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}

        {parsedData.sub_tasks.length === 0 && parsedData.plainText ? (
          <View
            style={{
              padding: 16,
              backgroundColor: isDetail ? cardBg : innerBg,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: cardBorder,
            }}
          >
            <Text
              style={{
                color: textSecondaryColor,
                fontSize: 13,
                lineHeight: 18,
              }}
            >
              {parsedData.plainText}
            </Text>
          </View>
        ) : null}

        {/* Global rule note - hidden for coach if showGlobalRule === false */}
        {showGlobalRule && parsedData.global_rule ? (
          <View
            style={{
              marginTop: 6,
              padding: 14,
              backgroundColor: isDetail ? cardBg : innerBg,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: cardBorder,
            }}
          >
            <Text
              style={{
                color: textSecondaryColor,
                fontSize: 12,
                fontWeight: '500',
                lineHeight: 16,
              }}
            >
              🕒 {parsedData.global_rule}
            </Text>
          </View>
        ) : null}

        {!isDetail && (
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingTop: 16,
              marginTop: 8,
              borderTopWidth: 1,
              borderTopColor: cardBorder,
            }}
          >
            <View className="flex-row items-center gap-2">
              <Clock size={12} color={textSecondaryColor} />
              <Text
                style={{
                  color: textSecondaryColor,
                  fontSize: 10,
                  fontWeight: '700',
                  textTransform: 'uppercase',
                }}
              >
                {new Date(task.assigned_date).toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}
              </Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}
