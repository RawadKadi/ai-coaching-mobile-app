import React, { useEffect } from 'react';
import { View, Text, SafeAreaView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MotiView } from 'moti';
import { useReducedMotion } from 'react-native-reanimated';
import { Sparkles, Brain } from 'lucide-react-native';
import RotatingText from '@/components/ui/RotatingText';
import { generateDailyProtocol } from '@/lib/ai-protocol-service';
import { useBrandColors } from '@/contexts/BrandContext';

export default function AIProtocolLoadingScreen() {
    const colors = useBrandColors();
    const reduceMotion = useReducedMotion();
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
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <MotiView
                    from={{ opacity: reduceMotion ? 1 : 0, scale: reduceMotion ? 1 : 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: 'spring', damping: 15 }}
                    style={{ alignItems: 'center' }}
                >
                    <View 
                        style={{ 
                            width: 96, 
                            height: 96, 
                            backgroundColor: colors.primary, 
                            borderRadius: 32, 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            shadowColor: colors.primary, 
                            shadowOffset: { width: 0, height: 12 }, 
                            shadowOpacity: 0.4, 
                            shadowRadius: 16, 
                            elevation: 8, 
                            marginBottom: 48 
                        }}
                    >
                        <Brain size={48} color={colors.textOnPrimary || 'white'} />
                        <MotiView
                            from={{ opacity: reduceMotion ? 1 : 0, scale: reduceMotion ? 1 : 0 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: reduceMotion ? 0 : 500, type: 'spring' }}
                            style={{ 
                                position: 'absolute', 
                                top: -8, 
                                right: -8, 
                                width: 32, 
                                height: 32, 
                                backgroundColor: colors.accent || '#F59E0B', 
                                borderRadius: 16, 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                borderWidth: 4, 
                                borderColor: colors.background 
                            }}
                        >
                            <Sparkles size={14} color="white" />
                        </MotiView>
                    </View>

                    <Text style={{ color: colors.text, fontSize: 24, fontWeight: '900', marginBottom: 16 }}>Planning Tasks</Text>
                    
                    <View style={{ paddingHorizontal: 16, paddingVertical: 8, backgroundColor: `${colors.primary}15`, borderRadius: 16, borderWidth: 1, borderColor: `${colors.primary}30` }}>
                        <RotatingText
                            texts={loadingKeywords}
                            elementLevelClassName="font-bold text-sm text-center"
                            elementLevelStyle={{ color: colors.primary }}
                            staggerDuration={0.025}
                            rotationInterval={2500}
                        />
                    </View>

                    {!reduceMotion && (
                        <View style={{ marginTop: 64, flexDirection: 'row', gap: 8 }}>
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
                                    style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary }}
                                />
                            ))}
                        </View>
                    )}
                </MotiView>
            </SafeAreaView>
        </View>
    );
}
