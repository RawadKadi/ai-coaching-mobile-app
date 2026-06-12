import React, { createContext, useContext, useRef } from 'react';
import { Animated, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';

interface TabBarScrollContextProps {
  isShrunk: Animated.Value;
  handleScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
}

const TabBarScrollContext = createContext<TabBarScrollContextProps | null>(null);

export const useTabBarScroll = () => {
  const context = useContext(TabBarScrollContext);
  if (!context) {
    throw new Error('useTabBarScroll must be used within a TabBarScrollProvider');
  }
  return context;
};

export const TabBarScrollProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isShrunk = useRef(new Animated.Value(0)).current;
  const lastOffsetY = useRef(0);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const currentOffsetY = event.nativeEvent.contentOffset.y;
    
    // Always expand when at the very top
    if (currentOffsetY <= 10) {
      Animated.spring(isShrunk, {
        toValue: 0,
        useNativeDriver: false,
        friction: 8,
        tension: 50
      }).start();
      lastOffsetY.current = currentOffsetY;
      return;
    }

    const diff = currentOffsetY - lastOffsetY.current;
    
    // Ignore tiny scroll movements to prevent jitter
    if (Math.abs(diff) > 10) {
      if (diff > 0) {
        // Scrolling Down - Shrink
        Animated.spring(isShrunk, {
          toValue: 1,
          useNativeDriver: false,
          friction: 8,
          tension: 50
        }).start();
      } else {
        // Scrolling Up - Expand
        Animated.spring(isShrunk, {
          toValue: 0,
          useNativeDriver: false,
          friction: 8,
          tension: 50
        }).start();
      }
      lastOffsetY.current = currentOffsetY;
    }
  };

  return (
    <TabBarScrollContext.Provider value={{ isShrunk, handleScroll }}>
      {children}
    </TabBarScrollContext.Provider>
  );
};
