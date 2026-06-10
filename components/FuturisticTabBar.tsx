import React, { useEffect, useRef } from 'react';
import { View, TouchableOpacity, StyleSheet, Animated, Platform, Dimensions } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';

const { width } = Dimensions.get('window');
const TAB_BAR_MARGIN = 24;
const TAB_BAR_WIDTH = width - (TAB_BAR_MARGIN * 2);

export function FuturisticTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const visibleRoutes = state.routes.filter(route => {
    const { options } = descriptors[route.key];
    if (options.href === null) return false;
    if (options.tabBarItemStyle?.display === 'none') return false;
    // Expo Router sometimes leaves hidden screens in state.routes
    // If it has no icon and no custom button, it's definitely not meant to be visible.
    if (!options.tabBarIcon && !options.tabBarButton) return false;
    return true;
  });

  const tabWidth = TAB_BAR_WIDTH / visibleRoutes.length;

  // We find the active index among VISIBLE routes
  const activeRouteKey = state.routes[state.index].key;
  const activeOptions = descriptors[activeRouteKey].options;

  // If the active screen specifically requests to hide the tab bar, return null
  if (activeOptions.tabBarStyle?.display === 'none') {
    return null;
  }

  const activeVisibleIndex = visibleRoutes.findIndex(r => r.key === activeRouteKey);
  const safeActiveIndex = activeVisibleIndex >= 0 ? activeVisibleIndex : 0;

  // Animation values
  const indicatorPosition = useRef(new Animated.Value(safeActiveIndex * tabWidth)).current;

  // We create animated scale values for each tab icon
  const scaleValues = useRef(visibleRoutes.map(() => new Animated.Value(1))).current;

  useEffect(() => {
    // Animate the glow indicator to the new active tab
    Animated.spring(indicatorPosition, {
      toValue: safeActiveIndex * tabWidth,
      useNativeDriver: true,
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
  }, [safeActiveIndex, tabWidth]);

  return (
    <View style={styles.container}>
      {/* Background with rounded corners */}
      <View style={[StyleSheet.absoluteFillObject, { borderRadius: 32, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)' }]}>
        <BlurView intensity={60} tint="dark" style={styles.blurContainer} />
      </View>

      {/* Glow Indicator (Simulating CSS blur with concentric fading circles) */}
      <Animated.View
        style={[
          styles.glowIndicatorWrapper,
          { width: tabWidth },
          { transform: [{ translateX: indicatorPosition }] }
        ]}
      >
        <View style={styles.glowIndicatorShadow}>
          <View style={[styles.glowOrb, { transform: [{ scale: 1.5 }], opacity: 0.15 }]} />
          <View style={[styles.glowOrb, { transform: [{ scale: 1.2 }], opacity: 0.25 }]} />
          <View style={[styles.glowOrb, { transform: [{ scale: 0.9 }], opacity: 0.4 }]} />
          <View style={[styles.glowOrb, { transform: [{ scale: 0.6 }], opacity: 0.6 }]} />
        </View>
      </Animated.View>

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
              // Determine if we are nesting under the correct tab stack
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
              <View key={route.key} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                {options.tabBarButton({
                  onPress,
                  onLongPress,
                  accessibilityState: isFocused ? { selected: true } : {},
                })}
              </View>
            );
          }

          const IconRenderer = options.tabBarIcon;
          const activeColor = '#FFFFFF'; // White pops best against the brand blue glow
          const inactiveColor = '#64748B'; // Slate 500

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              testID={options.tabBarTestID}
              onPress={onPress}
              onLongPress={onLongPress}
              style={styles.tabButton}
              activeOpacity={0.7}
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
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 32 : 24,
    left: TAB_BAR_MARGIN,
    right: TAB_BAR_MARGIN,
    height: 64,
    // Note: Do not put overflow: hidden here so custom buttons can pop out
    // Native shadow for floating effect
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
    backgroundColor: '#3B82F6',
  },
  tabButton: {
    flex: 1, // Let flexbox distribute space perfectly
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
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
