import React from 'react';
import { View, Text, ScrollView, Image, SafeAreaView, FlatList, SectionList } from 'react-native';

export const MotiView = ({ children, style, className }) => <View style={style} className={className}>{children}</View>;
export const MotiText = ({ children, style, className }) => <Text style={style} className={className}>{children}</Text>;
export const MotiScrollView = ({ children, style, className }) => <ScrollView style={style} className={className}>{children}</ScrollView>;
export const MotiImage = ({ children, style, className, source }) => <Image source={source} style={style} className={className}>{children}</Image>;
export const MotiSafeAreaView = ({ children, style, className }) => <SafeAreaView style={style} className={className}>{children}</SafeAreaView>;
export const MotiFlatList = (props) => <FlatList {...props} />;
export const MotiSectionList = (props) => <SectionList {...props} />;
export const AnimatePresence = ({ children }) => <>{children}</>;

export function useAnimationState() { return { current: 'from', transitionTo: () => { } }; }
export function useDynamicAnimation() { return { animateTo: () => { }, state: {} }; }
