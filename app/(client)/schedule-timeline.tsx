import { useBrandColors, useTheme } from '@/contexts/BrandContext';
import { isDarkColor } from '@/lib/theme-utils';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  StatusBar,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { MotiView } from 'moti';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  Calendar as CalendarIcon,
  Clock,
  Video,
  ChevronLeft,
  CalendarDays,
  ChevronsLeftRight,
  CheckCircle2,
} from 'lucide-react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { DatePickerOverlay } from '@/components/DatePickerOverlay';
import { BrandedAvatar } from '@/components/BrandedAvatar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CALENDAR_BOX_MARGIN = 24;
const CALENDAR_BOX_PADDING = 24;
const PAGE_WIDTH =
  SCREEN_WIDTH - CALENDAR_BOX_MARGIN * 2 - CALENDAR_BOX_PADDING * 2;

const PAGE_INDICES = Array.from({ length: 101 }, (_, i) => i - 50);
const INITIAL_PAGE_INDEX = 50;

export default function ClientScheduleTimeline() {
  const colors = useBrandColors();
  const theme = useTheme();
  const { client } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const isDark = isDarkColor(colors.background || '#020617');
  const textColor = colors.text || (isDark ? '#FFFFFF' : '#0F172A');
  const textSecondaryColor = colors.textSecondary || (isDark ? '#94A3B8' : '#64748B');
  const cardBg = colors.surface || (isDark ? '#0F172A' : '#FFFFFF');
  const cardBorder = colors.border || (isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0');
  const cardHoverBg = colors.surfaceHover || (isDark ? '#1E293B' : '#F1F5F9');

  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewingMonth, setViewingMonth] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const flatListRef = useRef<FlatList>(null);

  // ─── Helpers ────────────────────────────────────────────────────────────────

  const getPageIndexForDate = (targetDate: Date) => {
    const today = new Date();
    const day = today.getDay();
    const diff = day === 0 ? 6 : day - 1;
    const startOfThisWeek = new Date(today);
    startOfThisWeek.setDate(today.getDate() - diff);
    startOfThisWeek.setHours(0, 0, 0, 0);

    const target = new Date(targetDate);
    const targetDay = target.getDay();
    const targetDiff = targetDay === 0 ? 6 : targetDay - 1;
    const startOfTargetWeek = new Date(target);
    startOfTargetWeek.setDate(target.getDate() - targetDiff);
    startOfTargetWeek.setHours(0, 0, 0, 0);

    const diffMs = startOfTargetWeek.getTime() - startOfThisWeek.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    return Math.floor(diffDays / 14);
  };

  const scrollToDate = (date: Date) => {
    const pageIndex = getPageIndexForDate(date);
    const arrayIndex = Math.max(0, Math.min(100, pageIndex + 50));
    flatListRef.current?.scrollToIndex({ index: arrayIndex, animated: true });
  };

  const getDaysForPage = (pageIndex: number) =>
    Array.from({ length: 14 }, (_, i) => {
      const d = new Date();
      const day = d.getDay();
      const diff = day === 0 ? 6 : day - 1;
      d.setDate(d.getDate() - diff + pageIndex * 14 + i);
      return d;
    });

  const getSessionsForDate = (date: Date) =>
    sessions.filter((s) => {
      const sd = new Date(s.scheduled_at);
      return (
        sd.getDate() === date.getDate() &&
        sd.getMonth() === date.getMonth() &&
        sd.getFullYear() === date.getFullYear()
      );
    });

  // ─── Data ───────────────────────────────────────────────────────────────────

  useFocusEffect(
    useCallback(() => {
      if (client) loadSessions();
    }, [client])
  );

  const loadSessions = async () => {
    if (!client) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('sessions')
        .select('*, coaches(profiles(full_name, avatar_url))')
        .eq('client_id', client.id)
        .order('scheduled_at', { ascending: true });
      if (error) throw error;
      setSessions(data || []);
    } catch (e) {
      console.error('ClientScheduleTimeline load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // ─── Viewable items handler (updates month header) ──────────────────────────

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      const pageIndex = viewableItems[0].item;
      const pageDays = getDaysForPage(pageIndex);
      setViewingMonth(pageDays[0]);
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (loading && !refreshing) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background || (isDark ? '#020617' : '#F8FAFC'), justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  const selectedDaySessions = getSessionsForDate(selectedDate);
  const now = new Date();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background || (isDark ? '#020617' : '#F8FAFC') }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent />
      <View style={{ flex: 1, paddingTop: insets.top }}>

        {/* ── Header ────────────────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 24, paddingTop: 40, paddingBottom: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            {/* Back */}
            <TouchableOpacity
              onPress={() => router.back()}
              style={{
                width: 40, height: 40,
                backgroundColor: cardBg,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: cardBorder,
                marginBottom: 8,
              }}
            >
              <ChevronLeft size={20} color={colors.primary} />
            </TouchableOpacity>

            <Text style={{ color: textColor, fontSize: 32, fontWeight: '900', letterSpacing: -1, marginBottom: 8 }}>
              {viewingMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </Text>

            {/* Jump to date */}
            <Pressable
              onPress={() => setShowDatePicker(true)}
              style={{
                width: 40, height: 40,
                backgroundColor: cardBg,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: cardBorder,
                marginBottom: 8,
              }}
            >
              <CalendarDays size={18} color={colors.primary} />
            </Pressable>
          </View>

          <Text style={{ color: textSecondaryColor, fontWeight: '600', fontSize: 13 }}>
            {sessions.filter((s) => s.status === 'scheduled').length} upcoming sessions scheduled
          </Text>
        </View>

        {/* Swipe hint */}
        <View style={{ paddingHorizontal: 32, flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 8, opacity: 0.6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <ChevronsLeftRight size={14} color={textSecondaryColor} />
            <Text style={{ color: textSecondaryColor, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' }}>Swipe</Text>
          </View>
        </View>

        {/* ── Calendar Box ─────────────────────────────────────────────────── */}
        <View style={{
          backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : cardBg,
          borderRadius: 36,
          padding: 24,
          marginHorizontal: 24,
          marginBottom: 16,
          borderWidth: 1,
          borderColor: cardBorder,
          ...(isDark ? {} : {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.05,
            shadowRadius: 12,
            elevation: 2,
          }),
        }}>
          {/* Day-of-week headers */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, paddingHorizontal: 8 }}>
            {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((d, i) => (
              <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ color: textSecondaryColor, fontSize: 9, fontWeight: '900' }}>{d}</Text>
              </View>
            ))}
          </View>

          <FlatList
            ref={flatListRef}
            horizontal
            pagingEnabled
            snapToInterval={PAGE_WIDTH}
            snapToAlignment="start"
            decelerationRate="fast"
            showsHorizontalScrollIndicator={false}
            data={PAGE_INDICES}
            keyExtractor={(item) => item.toString()}
            initialScrollIndex={INITIAL_PAGE_INDEX}
            getItemLayout={(_, index) => ({
              length: PAGE_WIDTH,
              offset: PAGE_WIDTH * index,
              index,
            })}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            renderItem={({ item: pageIndex }) => {
              const pageDays = getDaysForPage(pageIndex);
              const week1 = pageDays.slice(0, 7);
              const week2 = pageDays.slice(7, 14);

              const renderDay = (item: Date) => {
                const isSelected = item.toDateString() === selectedDate.toDateString();
                const isToday = item.toDateString() === now.toDateString();
                const isPast = item < now && !isToday;
                const hasSessions = getSessionsForDate(item).length > 0;
                const isOtherMonth = item.getMonth() !== viewingMonth.getMonth();

                let dayNumberColor = textSecondaryColor;
                if (isSelected) {
                  dayNumberColor = colors.textOnPrimary || '#FFFFFF';
                } else if (isToday) {
                  dayNumberColor = colors.primary;
                } else if (isOtherMonth) {
                  dayNumberColor = isDark ? 'rgba(255, 255, 255, 0.18)' : 'rgba(0, 0, 0, 0.18)';
                } else if (isPast) {
                  dayNumberColor = isDark ? 'rgba(255, 255, 255, 0.38)' : 'rgba(0, 0, 0, 0.32)';
                } else {
                  dayNumberColor = textColor;
                }

                return (
                  <View key={item.toISOString()} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <Pressable onPress={() => setSelectedDate(item)} style={{ alignItems: 'center', justifyContent: 'center' }}>
                      <View style={{
                        width: 36, height: 36, borderRadius: 18,
                        alignItems: 'center', justifyContent: 'center',
                        backgroundColor: isSelected ? colors.primary : isToday ? `${colors.primary}18` : 'transparent',
                        borderWidth: isToday && !isSelected ? 1 : 0,
                        borderColor: colors.primary,
                        shadowColor: isSelected ? colors.primary : 'transparent',
                        shadowOpacity: isSelected ? 0.4 : 0,
                        shadowRadius: 6,
                        elevation: isSelected ? 3 : 0,
                      }}>
                        <Text style={{
                          fontSize: 15,
                          fontWeight: '900',
                          color: dayNumberColor,
                        }}>
                          {item.getDate()}
                        </Text>
                        {hasSessions && (
                          <View style={{
                            position: 'absolute',
                            bottom: 2,
                            width: 4, height: 4,
                            borderRadius: 2,
                            backgroundColor: isSelected ? (colors.textOnPrimary || '#fff') : colors.primary,
                          }} />
                        )}
                      </View>
                    </Pressable>
                  </View>
                );
              };

              return (
                <View style={{ width: PAGE_WIDTH }}>
                  <View style={{ flexDirection: 'row', marginBottom: 16 }}>{week1.map(renderDay)}</View>
                  <View style={{ flexDirection: 'row' }}>{week2.map(renderDay)}</View>
                </View>
              );
            }}
          />
        </View>

        {/* ── Session List ─────────────────────────────────────────────────── */}
        <ScrollView
          style={{ flex: 1, paddingHorizontal: 24 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); loadSessions(); }}
              tintColor={colors.primary}
            />
          }
        >
          <View style={{ marginBottom: 20, marginTop: 8 }}>
            <Text style={{ color: textColor, fontSize: 22, fontWeight: '900', letterSpacing: -0.5 }}>
              {selectedDate.toDateString() === now.toDateString()
                ? "Today's Sessions"
                : selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </Text>
          </View>

          {selectedDaySessions.length === 0 ? (
            <View style={{
              padding: 48,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : cardBg,
              borderRadius: 36,
              borderWidth: 1,
              borderColor: cardBorder,
              borderStyle: 'dashed',
            }}>
              <View style={{
                width: 64, height: 64,
                backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : cardHoverBg,
                borderRadius: 22,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: cardBorder,
                marginBottom: 16,
              }}>
                <CalendarIcon size={26} color={textSecondaryColor} />
              </View>
              <Text style={{ color: textSecondaryColor, fontWeight: '900', fontSize: 11, textTransform: 'uppercase', letterSpacing: 2, textAlign: 'center' }}>
                Day Clear
              </Text>
              <Text style={{ color: textSecondaryColor, fontSize: 13, fontWeight: '500', marginTop: 6, textAlign: 'center', lineHeight: 20, paddingHorizontal: 16, opacity: 0.8 }}>
                No sessions scheduled for this date.
              </Text>
            </View>
          ) : (
            <View style={{ gap: 14 }}>
              {selectedDaySessions.map((session, idx) => {
                const isPast = new Date(session.scheduled_at) < now;
                const coachName = session.coaches?.profiles?.full_name || 'Your Coach';
                const coachAvatar = session.coaches?.profiles?.avatar_url;

                return (
                  <MotiView
                    key={session.id}
                    from={{ opacity: 0, translateY: 10 }}
                    animate={{ opacity: 1, translateY: 0 }}
                    transition={{ delay: idx * 60 }}
                  >
                    <View style={{
                      backgroundColor: isPast
                        ? (isDark ? 'rgba(255,255,255,0.025)' : cardBg)
                        : (isDark ? 'rgba(255,255,255,0.05)' : cardBg),
                      borderWidth: 1,
                      borderColor: isPast
                        ? cardBorder
                        : `${colors.primary}33`,
                      borderRadius: 28,
                      padding: 20,
                      flexDirection: 'row',
                      alignItems: 'center',
                      ...(isDark ? {} : {
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.04,
                        shadowRadius: 8,
                        elevation: 1,
                      }),
                    }}>
                      {/* Left: time */}
                      <View style={{ alignItems: 'center', marginRight: 14, width: 52 }}>
                        <Text style={{ color: isPast ? textSecondaryColor : colors.primary, fontWeight: '900', fontSize: 17 }}>
                          {new Date(session.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                        </Text>
                        <Text style={{ color: textSecondaryColor, fontWeight: '900', fontSize: 10, textTransform: 'uppercase', opacity: 0.7 }}>
                          {new Date(session.scheduled_at).getHours() >= 12 ? 'PM' : 'AM'}
                        </Text>
                      </View>

                      {/* Divider */}
                      <View style={{ width: 2, height: 42, backgroundColor: isPast ? cardBorder : `${colors.primary}33`, borderRadius: 1, marginRight: 16 }} />

                      {/* Middle: info */}
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: isPast ? textSecondaryColor : textColor, fontWeight: '900', fontSize: 16, letterSpacing: -0.3, marginBottom: 4 }}>
                          {session.session_type === 'video' ? 'Video Call' : 'Live Coaching'}
                        </Text>
                        <Text style={{ color: textSecondaryColor, fontWeight: '600', fontSize: 12 }}>
                          {coachName} · {session.duration_minutes || 60} min
                        </Text>
                      </View>

                      {/* Right: status + avatar */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        {isPast ? (
                          <View style={{
                            width: 32, height: 32,
                            borderRadius: 16,
                            backgroundColor: 'rgba(16,185,129,0.12)',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}>
                            <CheckCircle2 size={16} color="#10B981" />
                          </View>
                        ) : (
                          <View style={{
                            width: 32, height: 32,
                            borderRadius: 16,
                            backgroundColor: `${colors.primary}18`,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}>
                            <Video size={14} color={colors.primary} />
                          </View>
                        )}
                        <BrandedAvatar name={coachName} imageUrl={coachAvatar} size={32} />
                      </View>
                    </View>
                  </MotiView>
                );
              })}
            </View>
          )}
        </ScrollView>
      </View>

      {showDatePicker && (
        <DatePickerOverlay
          visible={showDatePicker}
          selectedDate={selectedDate}
          onSelect={(date) => {
            setSelectedDate(date);
            setViewingMonth(date);
            setTimeout(() => scrollToDate(date), 50);
          }}
          onClose={() => setShowDatePicker(false)}
        />
      )}
    </View>
  );
}
