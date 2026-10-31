import React, { useCallback, useRef, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, StatusBar } from 'react-native';
import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Calendar as CalendarIcon, Scale, Clock, Zap } from 'lucide-react-native';
import { MotiView } from 'moti';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/contexts/BrandContext';
import { isDarkColor } from '@/lib/theme-utils';
import CoachSubpageHeader from '@/components/CoachSubpageHeader';

export default function CoachClientCheckinsScreen() {
  const { clientId, name, avatar } = useLocalSearchParams<{ clientId: string; name?: string; avatar?: string }>();
  const theme = useTheme();
  const colors = theme.colors;
  const isDark = isDarkColor(colors.background || '#020617');
  const textColor = colors.text;
  const textSecondaryColor = colors.textSecondary;
  const cardBg = colors.surface;
  const cardBorder = colors.border;

  const [checkins, setCheckins] = useState<any[]>([]);
  const [clientAvatar, setClientAvatar] = useState<string | null>(avatar || null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const hasLoaded = useRef(false);

  const load = useCallback(async () => {
    if (!clientId) return;
    try {
      if (!hasLoaded.current) setLoading(true);
      const [checkinsRes, clientRes] = await Promise.all([
        supabase
          .from('check_ins')
          .select('*')
          .eq('client_id', clientId)
          .order('date', { ascending: false }),
        !clientAvatar
          ? supabase.rpc('get_client_details', { target_client_id: clientId })
          : Promise.resolve({ data: null, error: null }),
      ]);
      setCheckins(checkinsRes.data || []);
      if (clientRes?.data?.profiles?.avatar_url) {
        setClientAvatar(clientRes.data.profiles.avatar_url);
      }
      hasLoaded.current = true;
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [clientId, clientAvatar]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <CoachSubpageHeader
        title="Check-ins"
        subtitle={name}
        clientName={name}
        avatarUrl={clientAvatar}
      />
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 64 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={colors.primary}
          />
        }
      >
        {loading ? null : (
                  <View className="px-3 pt-3">
                    {checkins.length === 0 ? (
                        <View 
                            className="p-8 items-center justify-center rounded-[32px] border border-dashed"
                            style={{ backgroundColor: cardBg, borderColor: cardBorder }}
                        >
                             <View 
                               className="w-12 h-12 rounded-2xl items-center justify-center border mb-3"
                               style={{ backgroundColor: `${colors.primary}18`, borderColor: `${colors.primary}35` }}
                             >
                               <CalendarIcon size={24} color={colors.primary} />
                             </View>
                             <Text className="font-black text-base" style={{ color: textColor }}>No Check-ins Yet</Text>
                             <Text className="text-xs mt-1 text-center px-4" style={{ color: textSecondaryColor }}>The client hasn't logged any daily check-ins.</Text>
                        </View>
                    ) : (
                        checkins.map((checkin, idx) => (
                            <MotiView 
                                key={checkin.id}
                                from={{ opacity: 0, translateY: 10 }} 
                                animate={{ opacity: 1, translateY: 0 }} 
                                transition={{ delay: idx * 50 }}
                                className="rounded-[30px] p-5 mb-3 border"
                                style={{ backgroundColor: cardBg, borderColor: cardBorder }}
                            >
                                <View className="flex-row justify-between items-center mb-3">
                                    <Text className="font-black text-base" style={{ color: textColor }}>{new Date(checkin.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</Text>
                                    <View 
                                      className="px-2.5 py-1 rounded-full border"
                                      style={{ backgroundColor: `${colors.primary}15`, borderColor: `${colors.primary}30` }}
                                    >
                                        <Text style={{ color: colors.primary }} className="text-[10px] font-black uppercase tracking-wider">Logged</Text>
                                    </View>
                                </View>
                                
                                <View className="flex-row flex-wrap gap-y-3 mb-2">
                                    <View className="w-1/2 flex-row items-center gap-2">
                                        <Scale size={16} color={colors.primary} />
                                        <Text className="font-bold text-sm" style={{ color: textColor }}>{checkin.weight_kg ? `${checkin.weight_kg} kg` : '--'}</Text>
                                    </View>
                                    <View className="w-1/2 flex-row items-center gap-2">
                                        <Clock size={16} color={colors.primary} />
                                        <Text className="font-bold text-sm" style={{ color: textColor }}>{checkin.sleep_hours ? `${checkin.sleep_hours} hrs` : '--'}</Text>
                                    </View>
                                    <View className="w-1/2 flex-row items-center gap-2">
                                        <Zap size={16} color={colors.primary} />
                                        <Text className="font-bold text-sm" style={{ color: textColor }}>Energy: {checkin.energy_level ? `${checkin.energy_level}/10` : '--'}</Text>
                                    </View>
                                </View>

                                {checkin.notes && (
                                    <View 
                                        className="mt-2 p-3.5 rounded-2xl border"
                                        style={{ backgroundColor: colors.background, borderColor: cardBorder }}
                                    >
                                        <Text className="text-[10px] font-black uppercase tracking-wider mb-1" style={{ color: textSecondaryColor }}>Notes</Text>
                                        <Text className="text-xs leading-5" style={{ color: textColor }}>{checkin.notes}</Text>
                                    </View>
                                )}
                            </MotiView>
                        ))
                    )}
                  </View>
        )}
      </ScrollView>
    </View>
  );
}
