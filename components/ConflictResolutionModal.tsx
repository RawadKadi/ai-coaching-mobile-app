import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { MotiView } from 'moti';
import { X, AlertTriangle, Clock, ChevronRight, ArrowRight } from 'lucide-react-native';
import { ConflictInfo, Resolution } from '@/types/conflict';

interface ConflictResolutionModalProps {
    visible: boolean;
    conflictInfo: ConflictInfo | null;
    onResolve: (resolution: Resolution) => void;
    onCancel: () => void;
}

export default function ConflictResolutionModal({ visible, conflictInfo, onResolve, onCancel }: ConflictResolutionModalProps) {
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
                    className="bg-slate-950 rounded-t-[40px] px-8 pt-8 pb-12 border-t border-slate-900"
                    style={{ maxHeight: '90%' }}
                >
                    {/* Warning Header */}
                    <View className="items-center mb-8">
                        <MotiView 
                            from={{ scale: 0.5, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="w-16 h-16 rounded-full bg-amber-500/10 items-center justify-center border border-amber-500/20 mb-4"
                        >
                            <AlertTriangle size={32} color="#F59E0B" />
                        </MotiView>
                        <Text className="text-white text-2xl font-bold text-center">Scheduling Conflict</Text>
                        <Text className="text-slate-500 text-center mt-2 px-4 text-sm leading-5">
                            This time slot overlaps with another session. How would you like to proceed?
                        </Text>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false}>
                        {/* Conflict Comparison */}
                        <View className="gap-4">
                            {/* New Session Card */}
                            <View className="bg-blue-600/10 p-5 rounded-3xl border border-blue-500/20">
                                <View className="flex-row justify-between items-center mb-3">
                                    <Text className="text-blue-400 text-[10px] font-bold uppercase tracking-widest">New Session</Text>
                                    <View className="w-2 h-2 rounded-full bg-blue-500" />
                                </View>
                                <Text className="text-white font-bold text-lg">{proposedSession.session_type}</Text>
                                <Text className="text-slate-400 text-sm mt-1">{proposedSession.client_name}</Text>
                                <View className="flex-row items-center gap-2 mt-4">
                                    <Clock size={14} color="#64748B" />
                                    <Text className="text-slate-300 text-sm font-medium">
                                       {new Date(proposedSession.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(new Date(proposedSession.scheduled_at).getTime() + proposedSession.duration_minutes * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </Text>
                                </View>
                            </View>

                            <View className="items-center -my-2 z-10">
                                <View className="bg-slate-950 p-2 rounded-full border border-slate-900">
                                   <X size={16} color="#475569" />
                                </View>
                            </View>

                            {/* Existing Session Card */}
                            <View className="bg-slate-900/50 p-5 rounded-3xl border border-slate-800">
                                <View className="flex-row justify-between items-center mb-3">
                                    <Text className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Existing Session</Text>
                                    <View className="w-2 h-2 rounded-full bg-slate-700" />
                                </View>
                                <Text className="text-white font-bold text-lg">{existingSession.session_type}</Text>
                                <Text className="text-slate-400 text-sm mt-1">{existingSession.client_name}</Text>
                                <View className="flex-row items-center gap-2 mt-4">
                                    <Clock size={14} color="#64748B" />
                                    <Text className="text-slate-300 text-sm font-medium">
                                       {new Date(existingSession.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(new Date(existingSession.scheduled_at).getTime() + existingSession.duration_minutes * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </Text>
                                </View>
                            </View>
                        </View>

                        {/* Resolution Actions */}
                        <View className="mt-10 gap-4">
                            <TouchableOpacity 
                                className="bg-blue-600 h-16 rounded-2xl items-center justify-center flex-row gap-3 shadow-xl"
                                onPress={() => {
                                    setSelectedOption('incoming');
                                    handleResolve();
                                }}
                            >
                                <ArrowRight size={20} color="white" />
                                <Text className="text-white font-bold text-lg">Propose New Time</Text>
                            </TouchableOpacity>

                            <TouchableOpacity 
                                className="bg-slate-900 border border-slate-800 h-16 rounded-2xl items-center justify-center flex-row gap-3"
                                onPress={onCancel}
                            >
                                <Text className="text-white font-bold">Cancel & Go Back</Text>
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </MotiView>
            </View>
        </Modal>
    );
}
