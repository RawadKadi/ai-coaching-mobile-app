import { useBrandColors } from '@/contexts/BrandContext';
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

function getFocusIcon(type: string, completed: boolean, primaryColor: string) {
  const color = completed ? primaryColor : '#94a3b8';
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
    
    const cardClasses = layoutType === 'detail'
        ? `mb-4 p-5 rounded-[24px] border ${isFailed || (isCompleted && !isFullyCompleted) || isPast ? 'bg-slate-900/50 border-slate-800/50 opacity-50' : 'bg-slate-900 border-slate-800'}`
        : `mb-4 p-5 rounded-[32px] border-2 ${isFullyCompleted ? 'bg-slate-900 border-slate-800 opacity-60' : 'bg-slate-900/50 border-slate-900'}`;

    return (
        <MotiView
            from={{ opacity: 0, translateX: -20 }}
            animate={{ opacity: 1, translateX: 0 }}
            transition={{ delay: index * 100 }}
            className={cardClasses}
        >
            <View className="flex-row justify-between items-start mb-6">
                <View className="flex-row items-center gap-3">
                    <View className="w-10 h-10 bg-slate-950 rounded-xl items-center justify-center border border-slate-800">
                        {getFocusIcon(task.focus_type, isFullyCompleted)}
                    </View>
                    <View className="flex-1 pr-2">
                        <Text className={`font-black text-base ${isFullyCompleted ? 'text-slate-500 line-through' : 'text-white'}`}>{task.name}</Text>
                        <Text className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">{task.focus_type} • {task.intensity}</Text>
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
                    <View className="bg-slate-800 px-3 py-1 rounded-full">
                        <Text className="text-slate-400 text-[10px] font-bold uppercase">Pending</Text>
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
                        <View key={ex.id} className="mb-3 bg-slate-900/50 rounded-2xl border border-slate-800 overflow-hidden">
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
                                        <View className="w-5 h-5 rounded-full border-2 border-slate-600" />
                                    )}
                                    <View className="flex-1 pr-2">
                                        <Text className={`font-bold text-sm ${isExerciseDone ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
                                            {ex.exercise}
                                        </Text>
                                        <Text className="text-slate-500 text-[10px] font-bold uppercase mt-1">
                                            {numSets} {numSets === 1 ? 'SET' : 'SETS'}
                                        </Text>
                                    </View>
                                </View>
                                {isExpanded ? <ChevronUp size={16} color="#64748B" /> : <ChevronDown size={16} color="#64748B" />}
                            </TouchableOpacity>
                            
                            <AnimatePresence>
                                {isExpanded && (
                                    <MotiView
                                        from={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ type: 'timing', duration: 250 }}
                                        className="overflow-hidden bg-slate-950/30"
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
                                                <Text className="text-slate-400 text-xs italic mb-4">{ex.notes}</Text>
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
                                                            <Circle size={20} color="#475569" />
                                                        )}
                                                        <Text className={`text-sm font-medium ${isSetDone ? 'text-slate-500 line-through' : 'text-slate-300'}`}>
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
                    <View className="mt-2 p-3 bg-slate-950/50 rounded-xl border border-slate-900">
                        <Text className="text-slate-500 text-xs font-medium italic">
                            🕒 {parsedData.global_rule}
                        </Text>
                    </View>
                )}

                {layoutType === 'detail' && (
                    <View className="flex-row justify-between items-center pt-4 mt-2 border-t border-slate-950/50">
                        <View className="flex-row items-center gap-2">
                            <Clock size={12} color="#475569" />
                            <Text className="text-slate-500 text-[10px] font-bold uppercase">
                                {new Date(task.assigned_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                            </Text>
                        </View>
                    </View>
                )}
            </View>
        </MotiView>
    );
}
