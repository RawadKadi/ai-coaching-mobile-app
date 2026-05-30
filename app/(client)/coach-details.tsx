import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, StatusBar, Linking, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { ChevronLeft, User, Phone, Globe, Calendar, Briefcase, Award, ExternalLink, Mail, MessageSquare } from 'lucide-react-native';
import { BrandedAvatar } from '@/components/BrandedAvatar';
import * as Haptics from 'expo-haptics';

const InfoRow = ({ icon, label, value }: { icon: React.ReactNode, label: string, value: string | undefined | null }) => (
    <View className="flex-row items-center py-4 border-b border-white/5">
        <View className="w-8 h-8 rounded-full bg-blue-600/10 items-center justify-center mr-4">
            {icon}
        </View>
        <View className="flex-1">
            <Text className="text-slate-500 text-xs font-bold uppercase tracking-wider">{label}</Text>
            <Text className="text-white text-base font-semibold mt-1">{value || 'Not provided'}</Text>
        </View>
    </View>
);

export default function CoachDetailsScreen() {
    const router = useRouter();
    const { coachId } = useLocalSearchParams();
    const insets = useSafeAreaInsets();
    const { user } = useAuth();

    const [loading, setLoading] = useState(true);
    const [coachData, setCoachData] = useState<any>(null);

    useEffect(() => {
        loadCoachDetails();
    }, [coachId, user?.id]);

    const loadCoachDetails = async () => {
        try {
            setLoading(true);
            
            // 1. Identify which ID to use (if none passed, fetch the client's assigned coach ID)
            let finalCoachId = coachId as string;
            if (!finalCoachId && user) {
                const { data: clientRecord } = await supabase
                    .from('clients')
                    .select('coach_id')
                    .eq('user_id', user.id)
                    .single();
                if (clientRecord?.coach_id) {
                    finalCoachId = clientRecord.coach_id;
                }
            }

            if (!finalCoachId) {
                setLoading(false);
                return;
            }

            // 2. Fetch coach details via the secure RPC (or join)
            const { data, error } = await supabase.rpc('get_coach_details', { p_coach_id: finalCoachId });
            
            if (error) {
                // If RPC fails (e.g. not migrated yet, though it should be), try fallback select
                const { data: directCoach } = await supabase
                    .from('coaches')
                    .select('*, profiles:user_id(*)')
                    .eq('id', finalCoachId)
                    .single();
                if (directCoach) {
                    setCoachData({
                        id: directCoach.id,
                        business_name: directCoach.business_name,
                        specialty: directCoach.specialty,
                        bio: directCoach.bio,
                        meeting_link: directCoach.meeting_link,
                        profiles: directCoach.profiles
                    });
                }
            } else {
                setCoachData(data);
            }
        } catch (e) {
            console.error('Failed to load coach details:', e);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenMeeting = async () => {
        if (!coachData?.meeting_link) return;
        try {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            const supported = await Linking.canOpenURL(coachData.meeting_link);
            if (supported) {
                await Linking.openURL(coachData.meeting_link);
            } else {
                Alert.alert('Cannot Open Link', 'The meeting link is invalid or unsupported.');
            }
        } catch (err) {
            Alert.alert('Error', 'Could not open the meeting link.');
        }
    };

    if (loading) {
        return (
            <View className="flex-1 bg-slate-950 items-center justify-center">
                <ActivityIndicator size="large" color="#3B82F6" />
            </View>
        );
    }

    if (!coachData) {
        return (
            <View className="flex-1 bg-slate-950 items-center justify-center p-6">
                <Text className="text-white text-lg font-bold text-center">Coach details not found</Text>
                <TouchableOpacity 
                    onPress={() => router.back()}
                    className="mt-6 bg-slate-900 border border-white/10 px-6 py-3 rounded-full"
                >
                    <Text className="text-white font-bold">Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const p = coachData.profiles || {};

    return (
        <View className="flex-1 bg-slate-950">
            <StatusBar barStyle="light-content" translucent />
            <View style={{ flex: 1, paddingTop: insets.top }}>
                
                {/* Header */}
                <View className="flex-row items-center justify-between px-6 py-4 border-b border-white/5">
                    <TouchableOpacity 
                        onPress={() => router.back()}
                        className="w-10 h-10 bg-slate-900 rounded-full items-center justify-center border border-white/5"
                    >
                        <ChevronLeft size={20} color="white" />
                    </TouchableOpacity>
                    <Text className="text-white font-black text-lg">Coach Profile</Text>
                    <View className="w-10" />
                </View>

                <ScrollView 
                    className="flex-1 px-6"
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 120 }}
                >
                    {/* Header Identity */}
                    <View className="items-center mt-10 mb-8">
                        <View className="relative">
                            <View className="absolute inset-0 bg-blue-600/20 rounded-full blur-3xl opacity-40" />
                            <View className="p-1 rounded-full border-2 border-blue-600/20">
                                <BrandedAvatar 
                                  name={p.full_name || 'Coach'} 
                                  size={120}
                                  imageUrl={p.avatar_url}
                                />
                            </View>
                        </View>

                        <Text className="text-white text-3xl font-black mt-6 leading-tight tracking-tighter text-center">
                          {p.full_name || 'Your Coach'}
                        </Text>
                        <Text className="text-blue-500 text-sm font-bold mt-2 text-center">
                          {coachData.specialty || 'Professional Coach'}
                        </Text>
                    </View>

                    {/* Quick Call-to-action Meeting Link */}
                    {coachData.meeting_link && (
                        <TouchableOpacity 
                            onPress={handleOpenMeeting}
                            activeOpacity={0.8}
                            className="bg-blue-600 flex-row items-center justify-center py-5 rounded-[28px] mb-8 shadow-lg shadow-blue-500/20 gap-3"
                        >
                            <ExternalLink size={18} color="white" />
                            <Text className="text-white font-black text-base tracking-tight">Join Meeting Room</Text>
                        </TouchableOpacity>
                    )}

                    {/* About section */}
                    {coachData.bio && (
                        <View className="bg-slate-900/40 rounded-[32px] p-6 border border-white/5 mb-6">
                            <Text className="text-white font-black text-lg mb-3">About Me</Text>
                            <Text className="text-slate-300 text-sm leading-6 font-medium">{coachData.bio}</Text>
                        </View>
                    )}

                    {/* Coach Details List */}
                    <View className="bg-slate-900/40 rounded-[32px] p-6 border border-white/5 mb-6">
                        <Text className="text-white font-black text-lg mb-4">Credentials & Info</Text>
                        {coachData.business_name && (
                            <InfoRow icon={<Briefcase size={16} color="#3B82F6" />} label="Business Name" value={coachData.business_name} />
                        )}
                        <InfoRow icon={<Mail size={16} color="#3B82F6" />} label="Email" value={p.email} />
                        {p.phone && (
                            <InfoRow icon={<Phone size={16} color="#3B82F6" />} label="Phone" value={p.phone} />
                        )}
                        <View className="flex-row items-center py-4">
                            <View className="w-8 h-8 rounded-full bg-blue-600/10 items-center justify-center mr-4">
                                <Globe size={16} color="#3B82F6" />
                            </View>
                            <View className="flex-1">
                                <Text className="text-slate-500 text-xs font-bold uppercase tracking-wider">Timezone</Text>
                                <Text className="text-white text-base font-semibold mt-1">{p.timezone || 'Not provided'}</Text>
                            </View>
                        </View>
                    </View>

                </ScrollView>
            </View>
        </View>
    );
}
