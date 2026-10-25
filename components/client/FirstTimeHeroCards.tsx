import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Target, Award, X } from 'lucide-react-native';
import { MotiView, AnimatePresence } from 'moti';
import { useRouter } from 'expo-router';
import MagicRings from '../ui/MagicRings';
import { useBrandColors } from '@/contexts/BrandContext';
import { isDarkColor } from '@/lib/theme-utils';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

interface FirstTimeHeroCardsProps {
  clientName: string;
  activeChallengesCount?: number;
}

export const FirstTimeHeroCards = ({
  clientName,
  activeChallengesCount: propCount,
}: FirstTimeHeroCardsProps) => {
  const router = useRouter();
  const { user } = useAuth();
  const colors = useBrandColors();
  const primaryIsDark = isDarkColor(colors.primary || '#2563eb');
  const textColor = primaryIsDark ? '#FFFFFF' : '#0F172A';
  const textMuted = primaryIsDark
    ? 'rgba(255, 255, 255, 0.9)'
    : 'rgba(15, 23, 42, 0.85)';
  const iconBg = primaryIsDark
    ? 'rgba(255, 255, 255, 0.2)'
    : 'rgba(0, 0, 0, 0.1)';
  const btnBg = primaryIsDark ? '#FFFFFF' : '#0F172A';
  const btnText = primaryIsDark ? colors.primary || '#2563eb' : '#FFFFFF';

  const [showTasks, setShowTasks] = useState(false);
  const [showChallenge, setShowChallenge] = useState(false);
  const [activeCount, setActiveCount] = useState(propCount ?? 0);

  useEffect(() => {
    const checkState = async () => {
      const tasksDismissed = await AsyncStorage.getItem(
        '@client_hero_tasks_dismissed',
      );
      const challengeDismissed = await AsyncStorage.getItem(
        '@client_hero_challenge_dismissed',
      );

      if (!tasksDismissed) setShowTasks(true);
      if (!challengeDismissed) setShowChallenge(true);
    };
    checkState();
  }, []);

  useEffect(() => {
    if (propCount !== undefined) {
      setActiveCount(propCount);
      return;
    }
    const fetchActiveCount = async () => {
      if (!user) return;
      try {
        const { data: clientData } = await supabase
          .from('clients')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();
        if (!clientData) return;

        const { data: challenges } = await supabase.rpc(
          'get_client_mother_challenges',
          {
            p_client_id: clientData.id,
            p_status: 'active',
          },
        );
        const todayMidnight = new Date(new Date().setHours(0, 0, 0, 0));
        const count = (challenges || []).filter((c: any) => {
          return c.status === 'active' && new Date(c.end_date) >= todayMidnight;
        }).length;
        setActiveCount(count);
      } catch (e) {
        console.error('Error fetching active challenges count for hero:', e);
      }
    };
    fetchActiveCount();
  }, [user, propCount]);

  const dismissTasks = async () => {
    await AsyncStorage.setItem('@client_hero_tasks_dismissed', 'true');
    setShowTasks(false);
  };

  const handleGoThere = async () => {
    await dismissTasks();
    router.push({
      pathname: '/(client)/activity',
      params: { highlightDailyTasks: 'true' },
    } as any);
  };

  const dismissChallenge = async () => {
    await AsyncStorage.setItem('@client_hero_challenge_dismissed', 'true');
    setShowChallenge(false);
  };

  const handleViewChallenges = () => {
    router.push({
      pathname: '/(client)/challenges',
      params: { highlightChallenges: 'true' },
    } as any);
  };

  if (!showTasks && !showChallenge) return null;

  return (
    <View style={{ gap: 16, marginBottom: 24 }}>
      <AnimatePresence>
        {showTasks && (
          <MotiView
            from={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95, height: 0 }}
            style={{ backgroundColor: colors.primary }}
            className="rounded-[32px] p-6 shadow-xl relative overflow-hidden"
          >
            {/* Animated MagicRings in background */}
            <View
              style={[{ ...(StyleSheet.absoluteFill as any) }, { opacity: 0.35 }]}
              pointerEvents="none"
            >
              <MagicRings
                color={primaryIsDark ? '#93c5fd' : '#1e3a8a'}
                colorTwo={primaryIsDark ? '#3b82f6' : '#172554'}
                backgroundColor={colors.primary}
                ringCount={5}
                speed={0.7}
                attenuation={8}
                lineThickness={2}
                baseRadius={0.3}
                radiusStep={0.12}
                followMouse={false}
                clickBurst={false}
              />
            </View>
            <View className="flex-row items-center gap-3 mb-4">
              <View
                style={{ backgroundColor: iconBg }}
                className="w-10 h-10 rounded-full items-center justify-center"
              >
                <Target size={20} color={textColor} />
              </View>
              <Text
                style={{ color: textColor }}
                className="text-lg font-black tracking-tight flex-1"
              >
                Your Daily Tasks
              </Text>
            </View>
            <Text
              style={{ color: textMuted }}
              className="text-sm font-medium leading-6 mb-6"
            >
              {clientName}, here are your Daily Tasks set by your coach. Mark
              them complete every day to lock in your execution consistency!
            </Text>
            <TouchableOpacity
              onPress={handleGoThere}
              style={{ backgroundColor: btnBg }}
              className="rounded-full py-3.5 items-center justify-center shadow-md"
            >
              <Text
                style={{ color: btnText }}
                className="font-black text-sm uppercase tracking-widest"
              >
                Go There
              </Text>
            </TouchableOpacity>
          </MotiView>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showChallenge &&
          !showTasks && ( // Show challenge card only after tasks card is dismissed to avoid clutter
            <MotiView
              from={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95, height: 0 }}
              style={{ backgroundColor: colors.primary }}
              className="rounded-[32px] p-6 shadow-xl relative overflow-hidden"
            >
              {/* Animated MagicRings in background */}
              <View
                style={[{ ...(StyleSheet.absoluteFill as any) }, { opacity: 0.35 }]}
                pointerEvents="none"
              >
                <MagicRings
                  color={primaryIsDark ? '#93c5fd' : '#1e3a8a'}
                  colorTwo={primaryIsDark ? '#3b82f6' : '#172554'}
                  backgroundColor={colors.primary}
                  ringCount={5}
                  speed={0.7}
                  attenuation={8}
                  lineThickness={2}
                  baseRadius={0.3}
                  radiusStep={0.12}
                  followMouse={false}
                  clickBurst={false}
                />
              </View>

              <View className="flex-row items-start justify-between mb-4">
                <View className="flex-row items-center gap-3 flex-1 pr-2">
                  <View
                    style={{ backgroundColor: iconBg }}
                    className="w-10 h-10 rounded-full items-center justify-center"
                  >
                    <Award size={20} color={textColor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{ color: textColor }}
                      className="text-lg font-black tracking-tight"
                      numberOfLines={1}
                    >
                      Your Challenge Hub
                    </Text>
                    <View className="flex-row items-center mt-1.5">
                      <View
                        style={{
                          backgroundColor: primaryIsDark
                            ? 'rgba(255, 255, 255, 0.2)'
                            : 'rgba(0, 0, 0, 0.08)',
                        }}
                        className="flex-row items-center gap-1.5 px-2.5 py-0.5 rounded-full"
                      >
                        <Text
                          style={{ color: textColor }}
                          className="text-[11px] font-bold"
                        >
                          Active Challenges
                        </Text>
                        <View
                          style={{ backgroundColor: btnBg }}
                          className="min-w-[18px] h-[18px] px-1 rounded-full items-center justify-center"
                        >
                          <Text
                            style={{ color: btnText }}
                            className="text-[10px] font-black"
                          >
                            {activeCount}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={dismissChallenge}
                  style={{
                    backgroundColor: primaryIsDark
                      ? 'rgba(0, 0, 0, 0.15)'
                      : 'rgba(0, 0, 0, 0.06)',
                  }}
                  className="w-8 h-8 rounded-full items-center justify-center mt-1"
                >
                  <X size={16} color={textColor} />
                </TouchableOpacity>
              </View>

              <Text
                style={{ color: textMuted }}
                className="text-sm font-medium leading-6 mb-6"
              >
                Your coach sets challenges to help you build habits and break
                plateaus. Finish them each day to reach your goals faster!
              </Text>

              <TouchableOpacity
                onPress={handleViewChallenges}
                style={{ backgroundColor: btnBg }}
                className="rounded-full py-3.5 items-center justify-center shadow-md"
              >
                <Text
                  style={{ color: btnText }}
                  className="font-black text-sm uppercase tracking-widest"
                >
                  View Challenges
                </Text>
              </TouchableOpacity>
            </MotiView>
          )}
      </AnimatePresence>
    </View>
  );
};
