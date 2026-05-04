import React, { useEffect } from 'react';
import { View, Text, SafeAreaView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MotiView } from 'moti';
import { Sparkles, Brain } from 'lucide-react-native';
import RotatingText from '@/components/ui/RotatingText';
import { generateDailyProtocol } from '@/lib/ai-protocol-service';

export default function AIProtocolLoadingScreen() {
    const router = useRouter();
    const { clientId, clientName, focusType, intensity } = useLocalSearchParams();

    useEffect(() => {
        const generate = async () => {
            try {
                // Short artificial delay to appreciate the animation
                await new Promise(resolve => setTimeout(resolve, 2000));

                const habits = await generateDailyProtocol(
                    clientId as string,
                    clientName as string,
                    { 
                        focusType: focusType as any, 
                        intensity: intensity as any 
                    }
                );

                if (!habits || habits.length === 0) {
                    throw new Error('AI failed to generate tasks');
                }

                router.replace({
                    pathname: '/(coach)/clients/ai-protocol-review',
                    params: {
                        clientId,
                        clientName,
                        suggestions: JSON.stringify(habits),
                        focusType,
                        intensity
                    }
                });
            } catch (error: any) {
                console.error('Generation error:', error);
                router.back();
            }
        };

        generate();
    }, []);

    const loadingKeywords = [
        'Analyzing performance data...',
        'Personalizing daily tasks...',
        'Structuring training load...',
        'Optimizing recovery blocks...',
        'Synthesizing habit loops...',
        'Crafting custom plan...'
    ];

    return (
        <View style={{ flex: 1, backgroundColor: '#020617' }}>
            <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <MotiView
                    from={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: 'spring', damping: 15 }}
                    className="items-center"
                >
                    <View className="w-24 h-24 bg-blue-600 rounded-[32px] items-center justify-center shadow-2xl shadow-blue-500/40 mb-12">
                        <Brain size={48} color="white" />
                        <MotiView
                            from={{ opacity: 0, scale: 0 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 500, type: 'spring' }}
                            className="absolute -top-2 -right-2 w-8 h-8 bg-amber-500 rounded-full items-center justify-center border-4 border-slate-950"
                        >
                            <Sparkles size={14} color="white" />
                        </MotiView>
                    </View>

                    <Text className="text-white text-2xl font-black mb-4">Strategizing</Text>
                    
                    <RotatingText
                        texts={loadingKeywords}
                        mainClassName="px-4 py-2 bg-blue-600/10 rounded-2xl border border-blue-500/20"
                        elementLevelClassName="text-blue-400 font-bold text-sm text-center"
                        staggerDuration={0.025}
                        rotationInterval={2500}
                    />

                    <View className="mt-16 flex-row gap-2">
                        {[0, 1, 2].map((i) => (
                            <MotiView
                                key={i}
                                from={{ opacity: 0.3, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{
                                    type: 'timing',
                                    duration: 1000,
                                    loop: true,
                                    delay: i * 200,
                                }}
                                className="w-2 h-2 rounded-full bg-blue-500"
                            />
                        ))}
                    </View>
                </MotiView>
            </SafeAreaView>
        </View>
    );
}
