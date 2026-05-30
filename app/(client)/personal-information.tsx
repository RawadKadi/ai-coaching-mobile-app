import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { ChevronLeft, User, Mail, Phone, Globe, Calendar, Activity, Ruler, Target, Trophy, Info, AlertTriangle } from 'lucide-react-native';

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

const TagList = ({ icon, label, tags, isLast }: { icon: React.ReactNode, label: string, tags: string[] | undefined, isLast?: boolean }) => (
    <View className={`py-4 ${!isLast ? 'border-b border-white/5' : ''}`}>
        <View className="flex-row items-center mb-3">
            <View className="w-8 h-8 rounded-full bg-blue-600/10 items-center justify-center mr-4">
                {icon}
            </View>
            <Text className="text-slate-500 text-xs font-bold uppercase tracking-wider">{label}</Text>
        </View>
        <View className="flex-row flex-wrap gap-2 ml-12">
            {(!tags || tags.length === 0) ? (
                <Text className="text-slate-400 text-sm font-medium">None specified</Text>
            ) : (
                tags.map((tag, idx) => (
                    <View key={idx} className="bg-slate-800 px-3 py-1.5 rounded-full border border-white/5">
                        <Text className="text-slate-300 text-xs font-bold capitalize">{tag}</Text>
                    </View>
                ))
            )}
        </View>
    </View>
);

export default function PersonalInformationScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { profile, client, user } = useAuth();

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
                        <Text className="text-slate-400 text-sm font-medium">This information helps your coach tailor your protocol.</Text>
                    </View>

                    {/* Account Info */}
                    <View className="bg-slate-900/40 rounded-[32px] p-5 border border-white/5 mb-6">
                        <Text className="text-white font-black text-lg mb-4 ml-1">Account</Text>
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

                    {/* Physical Profile */}
                    <View className="bg-slate-900/40 rounded-[32px] p-5 border border-white/5 mb-6">
                        <Text className="text-white font-black text-lg mb-4 ml-1">Physical Profile</Text>
                        <InfoRow icon={<Calendar size={16} color="#3B82F6" />} label="Date of Birth" value={client?.date_of_birth} />
                        <InfoRow icon={<Activity size={16} color="#3B82F6" />} label="Gender" value={client?.gender} />
                        <View className="flex-row items-center py-4">
                            <View className="w-8 h-8 rounded-full bg-blue-600/10 items-center justify-center mr-4">
                                <Ruler size={16} color="#3B82F6" />
                            </View>
                            <View className="flex-1">
                                <Text className="text-slate-500 text-xs font-bold uppercase tracking-wider">Height</Text>
                                <Text className="text-white text-base font-semibold mt-1">
                                    {client?.height_cm ? `${client.height_cm} cm` : 'Not provided'}
                                </Text>
                            </View>
                        </View>
                    </View>

                    {/* Fitness Journey */}
                    <View className="bg-slate-900/40 rounded-[32px] p-5 border border-white/5 mb-6">
                        <Text className="text-white font-black text-lg mb-4 ml-1">Fitness Journey</Text>
                        <InfoRow icon={<Target size={16} color="#3B82F6" />} label="Primary Goal" value={client?.goal} />
                        <View className="flex-row items-center py-4">
                            <View className="w-8 h-8 rounded-full bg-blue-600/10 items-center justify-center mr-4">
                                <Trophy size={16} color="#3B82F6" />
                            </View>
                            <View className="flex-1">
                                <Text className="text-slate-500 text-xs font-bold uppercase tracking-wider">Experience Level</Text>
                                <Text className="text-white text-base font-semibold mt-1 capitalize">{client?.experience_level || 'Not provided'}</Text>
                            </View>
                        </View>
                    </View>

                    {/* Health & Nutrition */}
                    <View className="bg-slate-900/40 rounded-[32px] p-5 border border-white/5 mb-6">
                        <Text className="text-white font-black text-lg mb-4 ml-1">Health Context</Text>
                        <TagList 
                            icon={<Info size={16} color="#3B82F6" />} 
                            label="Dietary Restrictions" 
                            tags={client?.dietary_restrictions} 
                        />
                        <TagList 
                            icon={<AlertTriangle size={16} color="#3B82F6" />} 
                            label="Medical Conditions" 
                            tags={client?.medical_conditions} 
                            isLast={true}
                        />
                    </View>
                    
                    <View className="items-center mb-10 mt-4">
                        <Text className="text-slate-600 text-xs font-medium text-center px-4">
                            To update these details, please contact your coach directly. Editing capabilities will be unlocked in a future update.
                        </Text>
                    </View>

                </ScrollView>
            </View>
        </View>
    );
}
