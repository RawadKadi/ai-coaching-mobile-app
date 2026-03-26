import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Platform, SafeAreaView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, Sparkles, Calendar, Users, ChevronRight, Zap } from 'lucide-react-native';
import { generateWeeklyChallenges } from '@/lib/ai-challenge-service';
import { BrandedAvatar } from '@/components/BrandedAvatar';

interface Client {
  id: string;
  full_name: string;
  avatar_url?: string;
}

export default function AISuggestChallengeScreen() {
  const router = useRouter();
  const { clientId } = useLocalSearchParams();
  const { user, coach } = useAuth();

  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [generating, setGenerating] = useState(false);

  const ClientSkeleton = () => (
    <View
      className="mb-4 p-5 rounded-[28px] bg-slate-900 border-2 border-slate-800 flex-row items-center justify-between h-[92px] opacity-50"
    >
      <View className="flex-row items-center gap-4">
        <View className="w-12 h-12 rounded-full bg-slate-800" />
        <View>
          <View className="w-32 h-4 bg-slate-800 rounded-md mb-2" />
          <View className="w-20 h-3 bg-slate-800 rounded-md" />
        </View>
      </View>
      <View className="w-6 h-6 rounded-full border-2 border-slate-800" />
    </View>
  );

  useEffect(() => {
    loadClients();
  }, [coach]);

  const loadClients = async () => {
    if (!coach) return;
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_coach_clients', { p_coach_id: coach.id });
      if (error) throw error;
      setClients(data || []);
      if (clientId && data) {
        const preSelected = data.find((c: Client) => c.id === clientId);
        if (preSelected) setSelectedClient(preSelected);
      }
    } catch (error) {
      console.error('Error loading clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!selectedClient) return;
    try {
      setGenerating(true);
      const startDate = getNextMonday();
      const challenges = await generateWeeklyChallenges(selectedClient.id, selectedClient.full_name, startDate);

      if (!challenges || challenges.length === 0) {
        Alert.alert('Try Again', 'The AI engine is currently optimizing the memory. Please try generating again in a few seconds.');
        return;
      }

      router.push({
        pathname: '/(coach)/challenges/review',
        params: {
          clientId: selectedClient.id,
          clientName: selectedClient.full_name,
          startDate: startDate.toISOString().split('T')[0],
          challenges: JSON.stringify(challenges)
        }
      });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'AI generation failed');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <View className="flex-1 bg-slate-950">
      <SafeAreaView className="flex-1">
        {/* Header */}
        <View className="px-6 pt-8 pb-6 flex-row items-center gap-4 border-b border-slate-900 bg-slate-950">
          <TouchableOpacity onPress={() => router.back()} className="p-2 bg-slate-900 rounded-full">
            <ArrowLeft size={20} color="#94A3B8" />
          </TouchableOpacity>
          <Text className="text-white text-xl font-bold">AI Strategist</Text>
        </View>

        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
          {/* Hero Section */}
        <View 
            className="mx-6 mt-8 p-8 rounded-[40px] bg-blue-600/10 border border-blue-500/20 items-center"
        >
            <View className="w-20 h-20 bg-blue-600 rounded-3xl items-center justify-center shadow-2xl shadow-blue-500/50 mb-6">
                <Zap size={40} color="white" />
            </View>
            <Text className="text-white text-2xl font-bold text-center">Plan the Perfect Week</Text>
            <Text className="text-slate-400 text-center mt-3 leading-5 px-4 text-sm">
                Our AI analyzes past performance and consistency to suggest the most effective sessions for your clients.
            </Text>
        </View>

          {/* Date Context */}
          <View className="px-6 mt-10 mb-6 flex-row justify-between items-center">
               <Text className="text-white text-lg font-bold">Recommended Start</Text>
               <View className="flex-row items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-full border border-slate-800">
                  <Calendar size={14} color="#3B82F6" />
                  <Text className="text-blue-400 text-xs font-bold">
                      {getNextMonday().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </Text>
               </View>
          </View>

          {/* Client Picker */}
          <View className="px-6">
              {loading ? (
                  <>
                      <ClientSkeleton />
                      <ClientSkeleton />
                      <ClientSkeleton />
                      <ClientSkeleton />
                  </>
              ) : (
                clients.map((client, index) => {
                    const isSelected = selectedClient?.id === client.id;
                    return (
                        <View
                            key={client.id}
                        >
                            <TouchableOpacity
                                onPress={() => setSelectedClient(client)}
                                className={`mb-4 p-5 rounded-[28px] border-2 flex-row items-center justify-between ${isSelected ? 'bg-blue-600/5 border-blue-500' : 'bg-slate-900 border-slate-800'}`}
                            >
                                <View className="flex-row items-center gap-4">
                                    <BrandedAvatar size={48} name={client.full_name} imageUrl={client.avatar_url} />
                                    <View>
                                        <Text className="text-white font-bold text-base">{client.full_name}</Text>
                                        <Text className="text-slate-500 text-xs">Active Client</Text>
                                    </View>
                                </View>
                                <View className={`w-6 h-6 rounded-full border-2 items-center justify-center ${isSelected ? 'border-blue-500' : 'border-slate-700'}`}>
                                    {isSelected && <View className="w-3 h-3 bg-blue-500 rounded-full" />}
                                </View>
                            </TouchableOpacity>
                        </View>
                    );
                })
              )}
          </View>
        </ScrollView>

        {/* Action Bar */}
        <View className="absolute bottom-0 w-full p-6 bg-slate-950/90 border-t border-slate-900">
            <TouchableOpacity 
              className={`h-16 rounded-2xl flex-row items-center justify-center gap-3 ${selectedClient ? 'bg-blue-600 shadow-xl shadow-blue-500/20' : 'bg-slate-900'}`}
              onPress={handleGenerate}
              disabled={!selectedClient || generating}
            >
                {generating ? (
                    <ActivityIndicator color="white" />
                ) : (
                    <>
                      <Sparkles size={22} color={selectedClient ? "white" : "#94A3B8"} />
                      <Text className={`font-bold text-lg ${selectedClient ? 'text-white' : 'text-slate-400'}`}>Generate Training Strategy</Text>
                    </>
                )}
            </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

function getNextMonday(): Date {
  const today = new Date();
  const day = today.getDay();
  const daysUntilMonday = day === 0 ? 1 : (8 - day) % 7 || 7;
  const nextMonday = new Date(today);
  nextMonday.setDate(today.getDate() + daysUntilMonday);
  nextMonday.setHours(0, 0, 0, 0);
  return nextMonday;
}
