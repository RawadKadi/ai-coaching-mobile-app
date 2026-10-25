import { useBrandColors } from '@/contexts/BrandContext';
import { isDarkColor, getContrastColor } from '@/lib/theme-utils';
import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { CheckCircle, Circle, Dumbbell, Apple, Moon, Zap, Clock, ChevronDown, ChevronUp } from 'lucide-react-native';
import { MotiView, AnimatePresence } from 'moti';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';

export interface NestedTaskCardProps {
    task: any;
    isCompleted?: boolean;
    isFailed?: boolean;
    isPast?: boolean;
    index?: number;
    onToggleParent: (task: any) => void;
    layoutType?: 'feed' | 'detail';
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
}

function getFocusIcon(type: string, completed: boolean, primaryColor: string, isDark: boolean = true) {
  const color = completed ? primaryColor : (isDark ? '#94A3B8' : '#64748B');
  switch (type?.toLowerCase()) {
    case 'training': return <Dumbbell size={24} color={color} />;
    case 'nutrition': return <Apple size={24} color={color} />;
    case 'recovery': return <Moon size={24} color={color} />;
    default: return <Zap size={24} color={color} />;
  }
}

function getSanitizedAssetName(exerciseName: string): string {
    const raw = exerciseName.toLowerCase().trim();
    const sanitized = raw.replace(/[\s_]+/g, '-').replace(/[^a-z0-9-]/g, '');

    const mappings: Record<string, string> = {
        'push-up': 'push-up',
        'push-ups': 'push-up',
        'bicep-curl': 'dumbbell-biceps-curl',
        'biceps-curl': 'dumbbell-biceps-curl',
        'bicep-curls': 'dumbbell-biceps-curl',
        'biceps-curls': 'dumbbell-biceps-curl',
        'squat': 'potty-squat',
        'squats': 'potty-squat',
        'bodyweight-squat': 'potty-squat',
        'bodyweight-squats': 'potty-squat',
        'air-squat': 'potty-squat',
        'air-squats': 'potty-squat',
        'plank': 'weighted-front-plank',
        'planks': 'weighted-front-plank',
        'front-plank': 'weighted-front-plank',
        'crunch': 'weighted-crunch',
        'crunches': 'weighted-crunch',
        'sit-up': 'sit-up-v-2',
        'sit-ups': 'sit-up-v-2',
        'bench-press': 'barbell-bench-press',
        'pull-up': 'pull-up',
        'pull-ups': 'pull-up',
        'lunge': 'walking-lunge',
        'lunges': 'walking-lunge',
    };

    return mappings[sanitized] || sanitized;
}

export function NestedTaskCard({ task, isCompleted, isFailed, isPast, index = 0, onToggleParent, layoutType = 'feed' }: NestedTaskCardProps) {
    const colors = useBrandColors();
    const isDark = isDarkColor(colors.background || '#020617');
    const cardBg = colors.surface || (isDark ? '#0F172A' : '#FFFFFF');
    const cardBorder = colors.border || (isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0');
    const textColor = colors.text || (isDark ? '#FFFFFF' : '#0F172A');
    const textSecondaryColor = colors.textSecondary || (isDark ? '#94A3B8' : '#64748B');
    const innerBg = colors.background || (isDark ? '#020617' : '#F8FAFC');

    const [checkedSets, setCheckedSets] = useState<Set<string>>(new Set());
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());

    // Strictly parse the JSON layout to enforce exact TypeScript structural types.
    const parsedData: ParsedTaskData = useMemo(() => {
        try {
            return JSON.parse(task.description);
        } catch (e) {
            return { sub_tasks: [] };
        }
    }, [task.description]);

    const isFullyCompleted = task.completed;

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
        if (allCompleted && !isFullyCompleted) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onToggleParent(task);
        }
    };

    return (
        <MotiView
            from={{ opacity: 0, translateX: -20 }}
            animate={{ opacity: 1, translateX: 0 }}
            transition={{ delay: index * 100 }}
            style={{
                marginBottom: 16,
                padding: 20,
                borderRadius: layoutType === 'detail' ? 24 : 32,
                borderWidth: 1,
                borderColor: isFullyCompleted ? `${colors.primary}40` : cardBorder,
                backgroundColor: cardBg,
                opacity: (isFailed || (isCompleted && !isFullyCompleted) || isPast) ? 0.6 : (isFullyCompleted ? 0.75 : 1)
            }}
        >
            <View className="flex-row justify-between items-start mb-6">
                <View className="flex-row items-center gap-3 flex-1">
                    <View style={{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: innerBg, borderWidth: 1, borderColor: cardBorder }}>
                        {getFocusIcon(task.focus_type, isFullyCompleted, colors.primary, isDark)}
                    </View>
                    <View className="flex-1 pr-2">
                        <Text style={{ fontSize: 16, fontWeight: '900', color: isFullyCompleted ? textSecondaryColor : textColor, textDecorationLine: isFullyCompleted ? 'line-through' : 'none' }}>
                            {task.name}
                        </Text>
                        <Text style={{ color: textSecondaryColor, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 4 }}>
                            {task.focus_type} • {task.intensity}
                        </Text>
                    </View>
                </View>
                {isFailed ? (
                    <View className="bg-red-500/10 px-3 py-1 rounded-full border border-red-500/20">
                        <Text className="text-red-500 text-[10px] font-bold uppercase">Unfulfilled</Text>
                    </View>
                ) : isFullyCompleted ? (
                    <View className="bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                        <Text className="text-emerald-500 text-[10px] font-bold uppercase">Success</Text>
                    </View>
                ) : isPast ? (
                    <View className="bg-red-500/10 px-3 py-1 rounded-full border border-red-500/20">
                        <Text className="text-red-500 text-[10px] font-bold uppercase">Missed</Text>
                    </View>
                ) : (
                    <View style={{ backgroundColor: innerBg, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: cardBorder }}>
                        <Text style={{ color: textSecondaryColor, fontSize: 10, fontWeight: '700', textTransform: 'uppercase' }}>Pending</Text>
                    </View>
                )}
            </View>

            <View>
                {parsedData.sub_tasks?.map((ex) => {
                    const numSets = ex.sets || 1;
                    let completedSets = 0;
                    for (let i=0; i<numSets; i++) {
                        if (checkedSets.has(`${ex.id}_set_${i}`) || isFullyCompleted) completedSets++;
                    }
                    const isExerciseDone = completedSets === numSets;
                    const isExpanded = expandedId === ex.id;

                    return (
                        <View key={ex.id} style={{ marginBottom: 12, backgroundColor: innerBg, borderRadius: 16, borderWidth: 1, borderColor: cardBorder, overflow: 'hidden' }}>
                            <TouchableOpacity 
                                activeOpacity={0.7}
                                onPress={() => {
                                    Haptics.selectionAsync();
                                    setExpandedId(isExpanded ? null : ex.id);
                                }}
                                className="flex-row items-center justify-between p-4"
                            >
                                <View className="flex-row items-center gap-3 flex-1">
                                    {isExerciseDone ? (
                                        <CheckCircle size={20} color={colors.primary} />
                                    ) : (
                                        <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: textSecondaryColor }} />
                                    )}
                                    <View className="flex-1 pr-2">
                                        <Text style={{ fontSize: 14, fontWeight: '700', color: isExerciseDone ? textSecondaryColor : textColor, textDecorationLine: isExerciseDone ? 'line-through' : 'none' }}>
                                            {ex.exercise}
                                        </Text>
                                        <Text style={{ color: textSecondaryColor, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', marginTop: 4 }}>
                                            {numSets} {numSets === 1 ? 'SET' : 'SETS'}
                                        </Text>
                                    </View>
                                </View>
                                {isExpanded ? <ChevronUp size={16} color={textSecondaryColor} /> : <ChevronDown size={16} color={textSecondaryColor} />}
                            </TouchableOpacity>
                            
                            <AnimatePresence>
                                {isExpanded && (
                                    <MotiView
                                        from={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ type: 'timing', duration: 250 }}
                                        style={{ overflow: 'hidden', backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.03)' }}
                                    >
                                        <View className="px-4 pb-4 pt-1">
                                            {(() => {
                                                const assetName = getSanitizedAssetName(ex.exercise);
                                                const activeMediaUrl = `https://ieqccstmunvlmxsohhsa.supabase.co/storage/v1/object/public/exercise-visuals/${assetName}.webp?t=animated`;
                                                
                                                if (imageErrors.has(ex.id)) return null;

                                                return (
                                                    <View className="w-full h-44 rounded-2xl mb-3 bg-white overflow-hidden items-center justify-center">
                                                        <Image 
                                                            source={{ uri: activeMediaUrl }} 
                                                            style={{ width: 150, height: 150 }}
                                                            contentFit="contain"
                                                            transition={200}
                                                            cachePolicy="none"
                                                            onError={() => {
                                                                setImageErrors(prev => new Set(prev).add(ex.id));
                                                            }}
                                                        />
                                                    </View>
                                                );
                                            })()}
                                            {ex.notes && (
                                                <Text style={{ color: textSecondaryColor, fontSize: 12, fontStyle: 'italic', marginBottom: 16 }}>{ex.notes}</Text>
                                            )}
                                            {Array.from({ length: numSets }).map((_, i) => {
                                                const isSetDone = checkedSets.has(`${ex.id}_set_${i}`) || isFullyCompleted;
                                                return (
                                                    <TouchableOpacity 
                                                        key={i}
                                                        activeOpacity={0.7}
                                                        onPress={() => toggleSet(ex.id, i)}
                                                        className="flex-row items-center py-2.5 gap-3"
                                                    >
                                                        {isSetDone ? (
                                                            <CheckCircle size={20} color={colors.primary} />
                                                        ) : (
                                                            <Circle size={20} color={textSecondaryColor} />
                                                        )}
                                                        <Text style={{ fontSize: 14, fontWeight: '500', color: isSetDone ? textSecondaryColor : textColor, textDecorationLine: isSetDone ? 'line-through' : 'none' }}>
                                                            Set {i + 1}
                                                        </Text>
                                                    </TouchableOpacity>
                                                );
                                            })}
                                        </View>
                                    </MotiView>
                                )}
                            </AnimatePresence>
                        </View>
                    );
                })}
                
                {parsedData.global_rule && (
                    <View style={{ marginTop: 8, padding: 12, backgroundColor: innerBg, borderRadius: 12, borderWidth: 1, borderColor: cardBorder }}>
                        <Text style={{ color: textSecondaryColor, fontSize: 12, fontWeight: '500', fontStyle: 'italic' }}>
                            🕒 {parsedData.global_rule}
                        </Text>
                    </View>
                )}

                {layoutType === 'detail' && (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, marginTop: 8, borderTopWidth: 1, borderTopColor: cardBorder }}>
                        <View className="flex-row items-center gap-2">
                            <Clock size={12} color={textSecondaryColor} />
                            <Text style={{ color: textSecondaryColor, fontSize: 10, fontWeight: '700', textTransform: 'uppercase' }}>
                                {new Date(task.assigned_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                            </Text>
                        </View>
                    </View>
                )}
            </View>
        </MotiView>
    );
}
