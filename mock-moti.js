import React from 'react';
import { View, Text, ScrollView, Image, SafeAreaView, FlatList, SectionList } from 'react-native';

export const MotiView = View;
export const MotiText = Text;
export const MotiScrollView = ScrollView;
export const MotiImage = Image;
export const MotiSafeAreaView = SafeAreaView;
export const MotiFlatList = FlatList;
export const MotiSectionList = SectionList;
export const AnimatePresence = ({ children }) => children || null;

export function useAnimationState() { return { current: 'from', transitionTo: () => { } }; }
export function useDynamicAnimation() { return { animateTo: () => { }, state: {} }; }
