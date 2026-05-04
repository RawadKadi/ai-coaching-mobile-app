import React from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MotiView } from 'moti';
import { ArrowLeft, Zap, Target, ClipboardList } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';

export default function CreateSelectionScreen() {
    const router = useRouter();
    const { clientId } = useLocalSearchParams();

    const options = [
        {
            title: 'Challenge',
            subtitle: 'Time-based program with daily progression',
            icon: <Zap size={28} color="white" fill="white" />,
            color: '#3B82F6',
            route: `/(coach)/challenges/create?clientId=${clientId}`,
            description: 'Best for transformation phases, bootcamps, or focused performance blocks.'
        },
        {
            title: 'Daily Protocol',
            subtitle: 'Ongoing daily habits for clients',
            icon: <ClipboardList size={28} color="white" />,
            color: '#10B981',
            route: `/(coach)/clients/create-protocol?clientId=${clientId}`,
            description: 'Best for long-term consistency, daily maintenance, and core lifestyle habits.'
        }
    ];

    return (
        <View style={{ flex: 1, backgroundColor: '#020617' }}>
            <StatusBar style="light" />
            <SafeAreaView style={{ flex: 1 }}>
                {/* Header */}
                <View style={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8, flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity 
                        onPress={() => router.back()} 
                        style={{ padding: 12, backgroundColor: '#0f172a', borderRadius: 16, borderWidth: 1, borderColor: '#1e293b' }}
                    >
                        <ArrowLeft size={20} color="#94A3B8" />
                    </TouchableOpacity>
                    <View style={{ flex: 1, alignItems: 'center', marginRight: 44 }}>
                        <Text style={{ color: 'white', fontSize: 20, fontWeight: 'bold' }}>Create</Text>
                    </View>
                </View>

                <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}>
                    {/* Hero Section */}
                    <MotiView
                        from={{ opacity: 0, translateY: 20 }}
                        animate={{ opacity: 1, translateY: 0 }}
                        style={{ 
                            marginTop: 32, 
                            paddingVertical: 32,
                            paddingHorizontal: 24,
                            borderRadius: 40, 
                            backgroundColor: 'rgba(59, 130, 246, 0.05)', 
                            borderWidth: 1, 
                            borderColor: 'rgba(59, 130, 246, 0.1)', 
                            alignItems: 'center', 
                            overflow: 'hidden' 
                        }}
                    >
                        <View style={{ position: 'absolute', top: 0, right: 0, padding: 16, opacity: 0.05 }}>
                            <Target size={120} color="#3B82F6" />
                        </View>
                        <View style={{ width: 64, height: 64, backgroundColor: '#3B82F6', borderRadius: 24, alignItems: 'center', justifyContent: 'center', shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 12, marginBottom: 20 }}>
                            <Target size={32} color="white" />
                        </View>
                        <Text style={{ color: 'white', fontSize: 32, fontWeight: '900', textAlign: 'center', letterSpacing: -1 }}>Create</Text>
                        <Text style={{ color: '#94A3B8', textAlign: 'center', marginTop: 8, fontSize: 16, fontWeight: '600' }}>
                            What do you want to create?
                        </Text>
                    </MotiView>

                    <View style={{ marginTop: 32, gap: 16 }}>
                        {options.map((option, index) => (
                            <MotiView
                                key={option.title}
                                from={{ opacity: 0, translateX: -20 }}
                                animate={{ opacity: 1, translateX: 0 }}
                                transition={{ delay: 200 + (index * 100) }}
                            >
                                <TouchableOpacity
                                    onPress={() => router.push(option.route)}
                                    activeOpacity={0.7}
                                    style={{
                                        backgroundColor: '#0f172a',
                                        borderRadius: 32,
                                        padding: 24,
                                        borderWidth: 1,
                                        borderColor: '#1e293b',
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        gap: 20
                                    }}
                                >
                                    <View style={{ 
                                        width: 56, 
                                        height: 56, 
                                        borderRadius: 20, 
                                        backgroundColor: option.color, 
                                        alignItems: 'center', 
                                        justifyContent: 'center',
                                        shadowColor: option.color,
                                        shadowOffset: { width: 0, height: 4 },
                                        shadowOpacity: 0.3,
                                        shadowRadius: 8
                                    }}>
                                        {option.icon}
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold' }}>{option.title}</Text>
                                        </View>
                                        <Text style={{ color: '#94A3B8', fontSize: 13, marginTop: 4, fontWeight: '500' }}>{option.subtitle}</Text>
                                    </View>
                                </TouchableOpacity>
                            </MotiView>
                        ))}
                    </View>
                </ScrollView>
            </SafeAreaView>
        </View>
    );
}
