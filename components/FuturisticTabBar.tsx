import React, { useEffect, useRef } from 'react';
import { View, TouchableOpacity, StyleSheet, Animated, Platform, Dimensions } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { useTabBarScroll } from '@/contexts/TabBarScrollContext';

const { width } = Dimensions.get('window');
const TAB_BAR_MARGIN_WIDE = 16;
const TAB_BAR_MARGIN_SHRUNK = 32; // Less aggressive shrink
const TAB_BAR_WIDTH_WIDE = width - (TAB_BAR_MARGIN_WIDE * 2);
const TAB_BAR_WIDTH_SHRUNK = width - (TAB_BAR_MARGIN_SHRUNK * 2);

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

export function FuturisticTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { isShrunk } = useTabBarScroll();
  const animatedActiveIndex = useRef(new Animated.Value(state.index)).current;

  const visibleRoutes = state.routes.filter(route => {
    const { options } = descriptors[route.key];
    if (options.href === null) return false;
    if (options.tabBarItemStyle?.display === 'none') return false;
    if (!options.tabBarIcon && !options.tabBarButton) return false;
    return true;
  });

  const tabWidthWide = TAB_BAR_WIDTH_WIDE / visibleRoutes.length;
  const tabWidthShrunk = TAB_BAR_WIDTH_SHRUNK / visibleRoutes.length;

  const dynamicTabWidth = isShrunk.interpolate({
    inputRange: [0, 1],
    outputRange: [tabWidthWide, tabWidthShrunk]
  });

  const animatedMargin = isShrunk.interpolate({
    inputRange: [0, 1],
    outputRange: [TAB_BAR_MARGIN_WIDE, TAB_BAR_MARGIN_SHRUNK]
  });

  const indicatorPosition = Animated.multiply(animatedActiveIndex, dynamicTabWidth);

  // We find the active index among VISIBLE routes
  const activeRouteKey = state.routes[state.index].key;
  const activeOptions = descriptors[activeRouteKey].options;

  const safeActiveIndex = visibleRoutes.findIndex(r => r.key === activeRouteKey) >= 0 
    ? visibleRoutes.findIndex(r => r.key === activeRouteKey) 
    : 0;

  // We create animated scale values for each tab icon
  const scaleValues = useRef(visibleRoutes.map(() => new Animated.Value(1))).current;

  useEffect(() => {
    // Reset navbar to expanded state when switching tabs
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

    // Animate icons scaling
    scaleValues.forEach((anim, idx) => {
      Animated.spring(anim, {
        toValue: idx === safeActiveIndex ? 1.3 : 1,
        useNativeDriver: true,
        friction: 5,
        tension: 80,
      }).start();
    });
  }, [safeActiveIndex]);

  // If the active screen specifically requests to hide the tab bar, return null
  // We do this here to avoid violating React Hook rules (early returns before hooks)
  if (activeOptions.tabBarStyle?.display === 'none') {
    return null;
  }

  return (
    <Animated.View style={[styles.container, { left: animatedMargin, right: animatedMargin }]}>
      {/* Background with rounded corners and clipped glow */}
      <View style={[StyleSheet.absoluteFillObject, { borderRadius: 32, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)' }]}>
        <BlurView intensity={60} tint="dark" style={styles.blurContainer} />
        
        {/* Glow Indicator (Simulating CSS blur with concentric fading circles) */}
        <Animated.View
          style={[
            styles.glowIndicatorWrapper,
            { width: dynamicTabWidth },
            { transform: [{ translateX: indicatorPosition }] }
          ]}
        >
        <View style={styles.glowIndicatorShadow}>
          {[...Array(8)].map((_, i) => (
            <Animated.View 
              key={i} 
              style={[
                styles.glowOrb, 
                { 
                  transform: [
                    { scale: 1.6 - (i * 0.12) },
                    { 
                      scaleX: isShrunk.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 0.8]
                      })
                    }
                  ], 
                  opacity: 0.1 + (i * 0.08) 
                }
              ]} 
            />
          ))}
        </View>
        </Animated.View>
      </View>

      {/* Tab Items */}
      <View style={styles.tabsWrapper}>
        {visibleRoutes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = safeActiveIndex === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate({ name: route.name, merge: true, params: {} });
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            });
          };

          // Support custom tabBarButton (like the Log Meal button)
          if (options.tabBarButton) {
            return (
              <Animated.View key={route.key} style={{ width: dynamicTabWidth, alignItems: 'center', justifyContent: 'center' }}>
                {options.tabBarButton({
                  onPress,
                  onLongPress,
                  accessibilityState: isFocused ? { selected: true } : {},
                })}
              </Animated.View>
            );
          }

          const IconRenderer = options.tabBarIcon;
          const activeColor = '#FFFFFF'; // White pops best against the brand blue glow
          const inactiveColor = '#64748B'; // Slate 500

          return (
            <AnimatedTouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              testID={options.tabBarTestID}
              onPress={onPress}
              onLongPress={onLongPress}
              style={[styles.tabButton, { width: dynamicTabWidth }]}
              activeOpacity={0.8}
            >
              <Animated.View style={{ transform: [{ scale: scaleValues[index] }] }}>
                {IconRenderer ? (
                  <View>
                    {IconRenderer({
                      focused: isFocused,
                      color: isFocused ? activeColor : inactiveColor,
                      size: 24,
                    })}
                    {/* Optional Badge */}
                    {options.tabBarBadge !== undefined && (
                      <View style={[styles.badgeContainer, options.tabBarBadgeStyle]}>
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
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  blurContainer: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.45)', // Slight dark tint
  },
  tabsWrapper: {
    flexDirection: 'row',
    flex: 1,
  },
  glowIndicatorWrapper: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 0,
  },
  glowIndicatorShadow: {
    width: 56,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  glowOrb: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1E3A8A', // Much darker blue (blue-900)
  },
  tabButton: {
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  badgeContainer: {
    position: 'absolute',
    top: -6,
    right: -10,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#020617', // Match navbar background roughly to create a cutout effect
    paddingHorizontal: 4,
  },
  badgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
});
