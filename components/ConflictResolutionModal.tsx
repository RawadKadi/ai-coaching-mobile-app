import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { MotiView } from 'moti';
import { X, AlertTriangle, Clock, ChevronRight, ArrowRight } from 'lucide-react-native';
import { ConflictInfo, Resolution } from '@/types/conflict';
import { useTheme } from '@/contexts/BrandContext';

interface ConflictResolutionModalProps {
    visible: boolean;
    conflictInfo: ConflictInfo | null;
    onResolve: (resolution: Resolution) => void;
    onCancel: () => void;
}

export default function ConflictResolutionModal({ visible, conflictInfo, onResolve, onCancel }: ConflictResolutionModalProps) {
    const theme = useTheme();
    const colors = theme.colors;
    const [selectedOption, setSelectedOption] = useState<'incoming' | null>(null);

    if (!conflictInfo) return null;

    const { existingSession, proposedSession, recommendations } = conflictInfo;

    const handleResolve = () => {
        if (!selectedOption) {
            Alert.alert('Selection Required', 'Please select a resolution option');
            return;
        }

        const availableSlots = recommendations.map(r => r.time);
        onResolve({
            action: 'propose_new_time_for_incoming',
            proposedSlots: availableSlots,
        });
    };

    return (
        <Modal visible={visible} animationType="fade" transparent={true}>
            <View className="flex-1 bg-black/60 justify-end">
                <MotiView 
                    from={{ translateY: 300 }}
                    animate={{ translateY: 0 }}
                    style={{ 
                        backgroundColor: colors.surface, 
                        borderTopColor: colors.border, 
                        borderTopWidth: 1, 
                        maxHeight: '90%' 
                    }}
                    className="rounded-t-[40px] px-8 pt-8 pb-12"
                >
                    {/* Warning Header */}
                    <View className="items-center mb-8">
                        <MotiView 
                            from={{ scale: 0.5, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            style={{ backgroundColor: 'rgba(245, 158, 11, 0.12)', borderColor: 'rgba(245, 158, 11, 0.25)', borderWidth: 1 }}
                            className="w-16 h-16 rounded-full items-center justify-center mb-4"
                        >
                            <AlertTriangle size={32} color="#F59E0B" />
                        </MotiView>
                        <Text style={{ color: colors.text }} className="text-2xl font-bold text-center">Scheduling Conflict</Text>
                        <Text style={{ color: colors.textSecondary }} className="text-center mt-2 px-4 text-sm leading-5">
                            This time slot overlaps with another session. How would you like to proceed?
                        </Text>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false}>
                        {/* Conflict Comparison */}
                        <View className="gap-4">
                            {/* New Session Card */}
                            <View 
                                style={{ 
                                    backgroundColor: `${colors.primary}12`, 
                                    borderColor: `${colors.primary}30`, 
                                    borderWidth: 1 
                                }} 
                                className="p-5 rounded-3xl"
                            >
                                <View className="flex-row justify-between items-center mb-3">
                                    <Text style={{ color: colors.primary }} className="text-[10px] font-bold uppercase tracking-widest">New Session</Text>
                                    <View style={{ backgroundColor: colors.primary }} className="w-2 h-2 rounded-full" />
                                </View>
                                <Text style={{ color: colors.text }} className="font-bold text-lg">{proposedSession.session_type}</Text>
                                <Text style={{ color: colors.textSecondary }} className="text-sm mt-1">{proposedSession.client_name}</Text>
                                <View className="flex-row items-center gap-2 mt-4">
                                    <Clock size={14} color={colors.primary} />
                                    <Text style={{ color: colors.text }} className="text-sm font-medium">
                                       {new Date(proposedSession.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(new Date(proposedSession.scheduled_at).getTime() + proposedSession.duration_minutes * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </Text>
                                </View>
                            </View>

                            <View className="items-center -my-2 z-10">
                                <View 
                                    style={{ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }} 
                                    className="p-2 rounded-full"
                                >
                                   <X size={16} color={colors.textSecondary} />
                                </View>
                            </View>

                            {/* Existing Session Card */}
                            <View 
                                style={{ 
                                    backgroundColor: colors.background, 
                                    borderColor: colors.border, 
                                    borderWidth: 1 
                                }} 
                                className="p-5 rounded-3xl"
                            >
                                <View className="flex-row justify-between items-center mb-3">
                                    <Text style={{ color: colors.textSecondary }} className="text-[10px] font-bold uppercase tracking-widest">Existing Session</Text>
                                    <View style={{ backgroundColor: colors.textTertiary }} className="w-2 h-2 rounded-full" />
                                </View>
                                <Text style={{ color: colors.text }} className="font-bold text-lg">{existingSession.session_type}</Text>
                                <Text style={{ color: colors.textSecondary }} className="text-sm mt-1">{existingSession.client_name}</Text>
                                <View className="flex-row items-center gap-2 mt-4">
                                    <Clock size={14} color={colors.textSecondary} />
                                    <Text style={{ color: colors.textSecondary }} className="text-sm font-medium">
                                       {new Date(existingSession.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(new Date(existingSession.scheduled_at).getTime() + existingSession.duration_minutes * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </Text>
                                </View>
                            </View>
                        </View>

                        {/* Resolution Actions */}
                        <View className="mt-8 gap-3">
                            <TouchableOpacity 
                                style={{ backgroundColor: colors.primary }}
                                className="h-14 rounded-2xl items-center justify-center flex-row gap-3 shadow-xl"
                                onPress={() => {
                                    setSelectedOption('incoming');
                                    handleResolve();
                                }}
                            >
                                <ArrowRight size={20} color={colors.textOnPrimary || 'white'} />
                                <Text style={{ color: colors.textOnPrimary || 'white' }} className="font-bold text-base">Propose New Time</Text>
                            </TouchableOpacity>

                            <TouchableOpacity 
                                style={{ backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1 }}
                                className="h-14 rounded-2xl items-center justify-center flex-row gap-3"
                                onPress={onCancel}
                            >
                                <Text style={{ color: colors.text }} className="font-bold text-sm">Cancel</Text>
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </MotiView>
            </View>
        </Modal>
    );
}
