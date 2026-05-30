import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StatusBar, Linking, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { ChevronLeft, User, Phone, Globe, Briefcase, Award, ExternalLink, Mail, Award as TierIcon, Shield } from 'lucide-react-native';
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

export default function CoachPersonalInformationScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { profile, coach, user } = useAuth();

    const handleOpenMeeting = async () => {
        if (!coach?.meeting_link) return;
        try {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            const supported = await Linking.canOpenURL(coach.meeting_link);
            if (supported) {
                await Linking.openURL(coach.meeting_link);
            } else {
                Alert.alert('Cannot Open Link', 'The meeting link is invalid.');
            }
        } catch (err) {
            Alert.alert('Error', 'Could not open meeting link.');
        }
    };

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
                    <Text className="text-white font-black text-lg">Personal Info</Text>
                    <View className="w-10" />
                </View>

                <ScrollView 
                    className="flex-1 px-6 pt-6"
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 100 }}
                >
                    <View className="mb-8">
                        <Text className="text-white text-2xl font-black mb-2 tracking-tight">Your Details</Text>
                        <Text className="text-slate-400 text-sm font-medium">This information represents your professional identity and public profile.</Text>
                    </View>

                    {/* Account Info */}
                    <View className="bg-slate-900/40 rounded-[32px] p-5 border border-white/5 mb-6">
                        <Text className="text-white font-black text-lg mb-4 ml-1">Identity</Text>
                        <InfoRow icon={<User size={16} color="#3B82F6" />} label="Full Name" value={profile?.full_name} />
                        <InfoRow icon={<Mail size={16} color="#3B82F6" />} label="Email" value={user?.email} />
                        <InfoRow icon={<Phone size={16} color="#3B82F6" />} label="Phone" value={profile?.phone} />
                        <View className="flex-row items-center py-4">
                            <View className="w-8 h-8 rounded-full bg-blue-600/10 items-center justify-center mr-4">
                                <Globe size={16} color="#3B82F6" />
                            </View>
                            <View className="flex-1">
                                <Text className="text-slate-500 text-xs font-bold uppercase tracking-wider">Timezone</Text>
                                <Text className="text-white text-base font-semibold mt-1">{profile?.timezone || 'Not provided'}</Text>
                            </View>
                        </View>
                    </View>

                    {/* Professional Bio */}
                    {coach?.bio && (
                        <View className="bg-slate-900/40 rounded-[32px] p-5 border border-white/5 mb-6">
                            <Text className="text-white font-black text-lg mb-3 ml-1">About Me</Text>
                            <Text className="text-slate-300 text-sm leading-6 font-medium px-1">{coach.bio}</Text>
                        </View>
                    )}

                    {/* Professional Profile */}
                    <View className="bg-slate-900/40 rounded-[32px] p-5 border border-white/5 mb-6">
                        <Text className="text-white font-black text-lg mb-4 ml-1">Credentials</Text>
                        <InfoRow icon={<Briefcase size={16} color="#3B82F6" />} label="Business Name" value={coach?.business_name || 'Not provided'} />
                        <InfoRow icon={<Award size={16} color="#3B82F6" />} label="Specialty" value={coach?.specialty || 'Professional Coaching'} />
                        <InfoRow icon={<Shield size={16} color="#3B82F6" />} label="Subscription Plan" value={coach?.subscription_tier} />
                        
                        {coach?.meeting_link && (
                            <TouchableOpacity 
                                onPress={handleOpenMeeting}
                                activeOpacity={0.8}
                                className="flex-row items-center py-4 mt-2"
                            >
                                <View className="w-8 h-8 rounded-full bg-blue-600/10 items-center justify-center mr-4">
                                    <ExternalLink size={16} color="#3B82F6" />
                                </View>
                                <View className="flex-1">
                                    <Text className="text-slate-500 text-xs font-bold uppercase tracking-wider">Meeting Room Link</Text>
                                    <Text className="text-blue-400 text-sm font-semibold mt-1 underline" numberOfLines={1}>
                                        {coach.meeting_link}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        )}
                    </View>

                    <View className="items-center mb-10 mt-4">
                        <Text className="text-slate-600 text-xs font-medium text-center px-4">
                            Contact our support team to update your credentials or credentials info.
                        </Text>
                    </View>

                </ScrollView>
            </View>
        </View>
    );
}
