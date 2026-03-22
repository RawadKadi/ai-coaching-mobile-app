import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { MotiView } from 'moti';
import { useAuth } from '@/contexts/AuthContext';
import { useBrand } from '@/contexts/BrandContext';
import { ChevronLeft, ChevronRight, Clock, Palette, BrainCircuit, Shield, Bell } from 'lucide-react-native';

export default function SettingsScreen() {
  const router = useRouter();
  const { coach } = useAuth();
  const { canManageBrand } = useBrand();

  return (
    <View className="flex-1 bg-slate-950">
      <SafeAreaView className="flex-1">
        <View className="flex-row items-center px-6 pt-10 pb-6 gap-4">
          <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 bg-slate-900 rounded-full items-center justify-center">
            <ChevronLeft size={20} color="white" />
          </TouchableOpacity>
          <View>
            <Text className="text-white text-xl font-black">System Configuration</Text>
            <Text className="text-slate-600 text-[10px] font-black uppercase tracking-widest">Engine Parameters</Text>
          </View>
        </View>

        <ScrollView className="flex-1 px-6" contentContainerStyle={{ paddingBottom: 120 }}>
          <SectionLabel label="Core Systems" />
          <SettingsItem
            icon={<Clock size={20} color="#3B82F6" />}
            iconBg="#3B82F620"
            label="Availability Hub"
            desc="Sync your time windows"
            onPress={() => router.push('/(coach)/settings/availability')}
          />

          {(coach?.brand_id || coach?.can_manage_brand) && (
            <>
              <SectionLabel label="Identity & Brand" />
              <SettingsItem
                icon={<Palette size={20} color="#F59E0B" />}
                iconBg="#F59E0B20"
                label="Brand Studio"
                desc={canManageBrand ? "Customize colors & logo" : "View brand settings"}
                onPress={() => router.push('/(coach)/settings/branding')}
              />
            </>
          )}

          <SectionLabel label="Intelligence Layer" />
          <SettingsItem
            icon={<BrainCircuit size={20} color="#8B5CF6" />}
            iconBg="#8B5CF620"
            label="Neural Engine Config"
            desc="Tune your AI persona"
            onPress={() => router.push('/(coach)/(tabs)/ai-brain')}
          />

          <SectionLabel label="Security" />
          <SettingsItem
            icon={<Shield size={20} color="#10B981" />}
            iconBg="#10B98120"
            label="Clearance Protocols"
            desc="Password & access control"
          />
          <SettingsItem
            icon={<Bell size={20} color="#EC4899" />}
            iconBg="#EC489920"
            label="Alert Channels"
            desc="Configure notifications"
          />

          <View className="mt-16 items-center">
            <Text className="text-slate-800 text-[10px] font-black uppercase tracking-[4px]">V3.0.Neural-Sync</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const SectionLabel = ({ label }: { label: string }) => (
  <Text className="text-slate-600 text-[10px] font-black uppercase tracking-widest px-1 mt-8 mb-3">{label}</Text>
);

const SettingsItem = ({ icon, iconBg, label, desc, onPress }: any) => (
  <MotiView from={{ opacity: 0, translateX: -10 }} animate={{ opacity: 1, translateX: 0 }} className="mb-2">
    <TouchableOpacity
      onPress={onPress}
      className="flex-row items-center p-5 bg-slate-900/40 rounded-[28px] border border-slate-900"
    >
      <View style={{ backgroundColor: iconBg }} className="w-12 h-12 rounded-2xl items-center justify-center mr-4">
        {icon}
      </View>
      <View className="flex-1">
        <Text className="text-slate-200 font-black text-base">{label}</Text>
        {desc && <Text className="text-slate-600 text-[10px] font-bold uppercase tracking-tighter mt-0.5">{desc}</Text>}
      </View>
      <ChevronRight size={18} color="#334155" />
    </TouchableOpacity>
  </MotiView>
);
