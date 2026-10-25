import React, { useEffect, useRef, useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Animated, Platform, useWindowDimensions, LayoutChangeEvent } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import { useTabBarScroll } from '@/contexts/TabBarScrollContext';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

const TAB_BAR_MARGIN_WIDE = 16;
const TAB_BAR_MARGIN_SHRUNK = 32;

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

export function FuturisticTabBar(props: BottomTabBarProps & { emitter?: any; navigateToTab?: (key: string) => void }) {
  const { state, descriptors, navigation } = props;
  const router = useRouter();
  const { isShrunk } = useTabBarScroll();
  const { width: windowWidth } = useWindowDimensions();
  const [measuredBarWidth, setMeasuredBarWidth] = useState<number>(0);
  const animatedActiveIndex = useRef(new Animated.Value(state.index)).current;

  const visibleRoutes = state.routes.filter(route => {
    const { options } = descriptors[route.key] as any;
    if (options.href === null) return false;
    if (options.tabBarItemStyle?.display === 'none') return false;
    if (!options.tabBarIcon && !options.tabBarButton) return false;
    return true;
  });

  const numTabs = visibleRoutes.length || 1;

  // Responsive widths based on actual measured width or window dimensions
  const baseWidthWide = windowWidth - (TAB_BAR_MARGIN_WIDE * 2);
  const baseWidthShrunk = windowWidth - (TAB_BAR_MARGIN_SHRUNK * 2);

  const tabWidthWide = (measuredBarWidth || baseWidthWide) / numTabs;
  const tabWidthShrunk = (measuredBarWidth ? (measuredBarWidth - (TAB_BAR_MARGIN_SHRUNK - TAB_BAR_MARGIN_WIDE) * 2) : baseWidthShrunk) / numTabs;

  const dynamicTabWidth = isShrunk.interpolate({
    inputRange: [0, 1],
    outputRange: [tabWidthWide, tabWidthShrunk]
  });

  const animatedMargin = isShrunk.interpolate({
    inputRange: [0, 1],
    outputRange: [TAB_BAR_MARGIN_WIDE, TAB_BAR_MARGIN_SHRUNK]
  });

  const indicatorPosition = Animated.multiply(animatedActiveIndex, dynamicTabWidth);

  // Find active index among VISIBLE routes
  const activeRouteKey = state.routes[state.index].key;
  const activeOptions = descriptors[activeRouteKey]?.options || {};

  const safeActiveIndex = visibleRoutes.findIndex(r => r.key === activeRouteKey) >= 0 
    ? visibleRoutes.findIndex(r => r.key === activeRouteKey) 
    : 0;

  // Animated scale values for each tab icon
  const scaleValues = useRef(visibleRoutes.map(() => new Animated.Value(1))).current;
  
  // Brand theme for blur and glow colors
  const { isDarkMode, colors } = require('@/contexts/BrandContext').useTheme();

  useEffect(() => {
    Animated.spring(isShrunk, {
      toValue: 0,
      useNativeDriver: false,
      friction: 8,
      tension: 50,
    }).start();

    Animated.spring(animatedActiveIndex, {
      toValue: safeActiveIndex,
      useNativeDriver: false,
      friction: 8,
      tension: 60,
    }).start();

    scaleValues.forEach((anim, idx) => {
      Animated.spring(anim, {
        toValue: idx === safeActiveIndex ? 1.15 : 1,
        useNativeDriver: true,
        friction: 6,
        tension: 80,
      }).start();
    });
  }, [safeActiveIndex]);

  if ((activeOptions.tabBarStyle as any)?.display === 'none') {
    return null;
  }

  const hexToRgba = (hex: string, alpha: number) => {
    if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) {
      return `rgba(2, 6, 23, ${alpha})`;
    }
    const cleanHex = hex.replace('#', '');
    const r = parseInt(cleanHex.slice(0, 2), 16) || 2;
    const g = parseInt(cleanHex.slice(2, 4), 16) || 6;
    const b = parseInt(cleanHex.slice(4, 6), 16) || 23;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const overlayColor = isDarkMode 
    ? hexToRgba(colors.surface, 0.65) 
    : 'rgba(255, 255, 255, 0.68)';

  const handleContainerLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - measuredBarWidth) > 1) {
      setMeasuredBarWidth(w);
    }
  };

  return (
    <Animated.View 
      onLayout={handleContainerLayout}
      style={[
        styles.container, 
        { left: animatedMargin, right: animatedMargin }
      ]}
    >
      {/* Background with frosted glass blur */}
      <BlurView 
        intensity={80} 
        tint={isDarkMode ? 'dark' : 'light'} 
        style={[
          StyleSheet.absoluteFill, 
          { 
            borderRadius: 32, 
            overflow: 'hidden',
            backgroundColor: overlayColor,
            ...Platform.select({
              web: {
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
              } as any,
            }),
          }
        ]}
      >
        {/* Active Tab Glow: Big diffuse ambient blur */}
        <Animated.View
          style={[
            styles.glowIndicatorWrapper,
            { width: dynamicTabWidth },
            { transform: [{ translateX: indicatorPosition }] }
          ]}
        >
          <View 
            className="nav-glow-blur"
            style={[
              styles.glowIndicatorShadow,
              Platform.OS === 'web' ? ({
                backgroundImage: `radial-gradient(ellipse at center, ${colors.primary} 0%, ${colors.primary}D9 25%, ${colors.primary}88 50%, ${colors.primary}33 75%, transparent 100%)`,
                boxShadow: `0 0 28px 12px ${colors.primary}66`,
              } as any) : {}
            ]}
          >
            {Platform.OS !== 'web' && (
              <Svg width={76} height={60} viewBox="0 0 76 60">
                <Defs>
                  <RadialGradient id="activeTabRadialGlow" cx="50%" cy="50%" rx="50%" ry="50%">
                    <Stop offset="0%" stopColor={colors.primary} stopOpacity="0.95" />
                    <Stop offset="30%" stopColor={colors.primary} stopOpacity="0.75" />
                    <Stop offset="65%" stopColor={colors.primary} stopOpacity="0.35" />
                    <Stop offset="100%" stopColor={colors.primary} stopOpacity="0" />
                  </RadialGradient>
                </Defs>
                <Rect x="0" y="0" width={76} height={60} fill="url(#activeTabRadialGlow)" />
              </Svg>
            )}
          </View>
        </Animated.View>
      </BlurView>

      {/* Border overlay */}
      <View 
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill, 
          { 
            borderRadius: 32, 
            borderWidth: 1, 
            borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.6)',
          }
        ]} 
      />

      {/* Tab Items */}
      <View style={styles.tabsWrapper}>
        {visibleRoutes.map((route, index) => {
          const { options } = descriptors[route.key] as any;
          const isFocused = safeActiveIndex === index;

          const emitEvent = (type: 'tabPress' | 'tabLongPress', canPreventDefault?: boolean) => {
            const eventPayload = {
              type,
              target: route.key,
              canPreventDefault,
            } as any;

            if (navigation?.emit) {
              return navigation.emit(eventPayload);
            }
            if (props.emitter?.emit) {
              return props.emitter.emit(eventPayload);
            }
            return { defaultPrevented: false };
          };

          const onPress = () => {
            const event = emitEvent('tabPress', true);

            if (!isFocused && !event?.defaultPrevented) {
              if (typeof props.navigateToTab === 'function') {
                props.navigateToTab(route.key);
              } else if (navigation?.navigate) {
                navigation.navigate({ name: route.name, merge: true, params: {} });
              } else {
                router.push(`/(client)/(tabs)/${route.name}` as any);
              }
            }
          };

          const onLongPress = () => {
            emitEvent('tabLongPress');
          };

          // Support custom tabBarButton (e.g., Log Meal button)
          if (options.tabBarButton) {
            return (
              <View 
                key={route.key} 
                style={styles.tabButton}
              >
                {options.tabBarButton({
                  children: null,
                  onPress,
                  onLongPress,
                  accessibilityState: isFocused ? { selected: true } : {},
                })}
              </View>
            );
          }

          const IconRenderer = options.tabBarIcon;
          const activeColor = '#FFFFFF';
          const inactiveColor = isDarkMode ? '#94A3B8' : '#64748B';

          return (
            <AnimatedTouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              testID={options.tabBarTestID}
              onPress={onPress}
              onLongPress={onLongPress}
              style={styles.tabButton}
              activeOpacity={0.8}
            >
              <Animated.View style={[styles.iconContainer, { transform: [{ scale: scaleValues[index] }] }]}>
                {IconRenderer ? (
                  <View style={styles.iconWrapper}>
                    {IconRenderer({
                      focused: isFocused,
                      color: isFocused ? activeColor : inactiveColor,
                      size: 22,
                    })}
                    {/* Badge */}
                    {options.tabBarBadge !== undefined && (
                      <View style={[styles.badgeContainer, options.tabBarBadgeStyle as any]}>
                        <Animated.Text style={styles.badgeText}>
                          {options.tabBarBadge}
                        </Animated.Text>
                      </View>
                    )}
                  </View>
                ) : null}
              </Animated.View>
            </AnimatedTouchableOpacity>
          );
        })}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 32 : 24,
    height: 64,
    borderRadius: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
    ...Platform.select({
      web: {
        overflow: 'hidden',
      },
    }),
  },
  tabsWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  glowIndicatorWrapper: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 0,
  },
  glowIndicatorShadow: {
    width: 76,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabButton: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapper: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeContainer: {
    position: 'absolute',
    top: -6,
    right: -10,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
});
