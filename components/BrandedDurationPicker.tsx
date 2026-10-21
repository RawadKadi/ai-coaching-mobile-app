import { useBrandColors, useTheme } from '@/contexts/BrandContext';
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
  Animated,
  Easing,
  Dimensions,
  AccessibilityInfo,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronDown, Clock, Check } from 'lucide-react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SLIDE_DISTANCE = Math.min(SCREEN_HEIGHT * 0.7, 500);

interface BrandedDurationPickerProps {
  value: number;
  onSelect: (value: number) => void;
  label?: string;
}

export const BrandedDurationPicker: React.FC<BrandedDurationPickerProps> = ({
  value,
  onSelect,
  label = "Duration",
}) => {
  const colors = useBrandColors();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const isDark = theme.isDarkMode;
  const styles = getStyles(colors, isDark, insets);

  const [modalVisible, setModalVisible] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(SLIDE_DISTANCE)).current;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);

  const openPicker = () => {
    setModalVisible(true);
    fadeAnim.setValue(0);
    slideAnim.setValue(reduceMotion ? 0 : SLIDE_DISTANCE);

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: reduceMotion ? 0 : 250,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: reduceMotion ? 0 : 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closePicker = (callback?: () => void) => {
    if (reduceMotion) {
      setModalVisible(false);
      if (callback) callback();
      return;
    }

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: SLIDE_DISTANCE,
        duration: 250,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setModalVisible(false);
      if (callback) callback();
    });
  };

  const handleSelect = (opt: number) => {
    closePicker(() => {
      onSelect(opt);
    });
  };

  const options = Array.from({ length: 12 }, (_, i) => i + 3); // 3-14 days

  return (
    <View>
      <Text style={styles.headerLabel}>{label}</Text>

      <TouchableOpacity
        onPress={openPicker}
        activeOpacity={0.8}
        style={styles.pickerButton}
      >
        <View style={styles.pickerContent}>
          <View style={styles.iconContainer}>
            <Clock size={20} color={colors.primary} />
          </View>
          <View>
            <Text style={styles.daysText}>{value} Days</Text>
            <Text style={styles.subText}>Length</Text>
          </View>
        </View>
        <ChevronDown size={20} color={colors.textSecondary} />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="none"
        statusBarTranslucent
        onRequestClose={() => closePicker()}
      >
        <View style={styles.modalRoot}>
          {/* Fading dark background */}
          <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => closePicker()} />
          </Animated.View>

          {/* Sliding sheet */}
          <Animated.View
            style={[
              styles.modalContent,
              { transform: [{ translateY: slideAnim }] },
            ]}
          >
            {/* Drag Handle */}
            <View style={styles.handleBar} />

            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Select Duration</Text>
                <Text style={styles.modalSubtitle}>Days Range: 3-14</Text>
              </View>
              <TouchableOpacity
                onPress={() => closePicker()}
                style={styles.doneButton}
              >
                <Text style={styles.doneButtonText}>Done</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.gridContainer}>
                {options.map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    onPress={() => handleSelect(opt)}
                    style={[
                      styles.gridOption,
                      value === opt
                        ? styles.gridOptionActive
                        : styles.gridOptionInactive,
                    ]}
                  >
                    <View style={styles.optionRow}>
                      <Text
                        style={[
                          styles.optionText,
                          value === opt
                            ? styles.optionTextActive
                            : styles.optionTextInactive,
                        ]}
                      >
                        {opt}
                      </Text>
                      {value === opt && (
                        <Check
                          size={14}
                          color={colors.textOnPrimary || 'white'}
                          strokeWidth={3}
                        />
                      )}
                    </View>
                    <Text
                      style={[
                        styles.optionLabel,
                        value === opt
                          ? styles.optionLabelActive
                          : styles.optionLabelInactive,
                      ]}
                    >
                      Days
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
};

const getStyles = (colors: any, isDark: boolean, insets: any) =>
  StyleSheet.create({
    headerLabel: {
      color: colors.textSecondary,
      fontSize: 10,
      fontWeight: '900',
      textTransform: 'uppercase',
      letterSpacing: 2,
      marginBottom: 12,
      marginLeft: 4,
    },
    pickerButton: {
      height: 80,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 20,
      paddingHorizontal: 24,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      shadowColor: colors.border,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.3 : 0.06,
      shadowRadius: 10,
      elevation: 3,
    },
    pickerContent: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    iconContainer: {
      width: 44,
      height: 44,
      backgroundColor: isDark
        ? 'rgba(255, 255, 255, 0.06)'
        : `${colors.primary}15`,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: `${colors.primary}33`,
      marginRight: 16,
    },
    daysText: {
      color: colors.text,
      fontWeight: '900',
      fontSize: 20,
    },
    subText: {
      color: colors.textSecondary,
      fontSize: 10,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginTop: 2,
    },
    modalRoot: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    backdrop: {
      ...StyleSheet.absoluteFill,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modalContent: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 36,
      borderTopRightRadius: 36,
      borderTopWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 24,
      paddingTop: 16,
      paddingBottom: Math.max(insets.bottom + 16, 36),
      maxHeight: '65%',
    },
    handleBar: {
      width: 44,
      height: 5,
      backgroundColor: colors.border,
      borderRadius: 999,
      alignSelf: 'center',
      marginBottom: 20,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 24,
    },
    modalTitle: {
      color: colors.text,
      fontSize: 22,
      fontWeight: '900',
      letterSpacing: -0.5,
    },
    modalSubtitle: {
      color: colors.textSecondary,
      fontSize: 10,
      fontWeight: '900',
      textTransform: 'uppercase',
      letterSpacing: 2,
      marginTop: 4,
    },
    doneButton: {
      paddingHorizontal: 18,
      paddingVertical: 10,
      backgroundColor: colors.background,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    doneButtonText: {
      color: colors.text,
      fontWeight: '700',
      fontSize: 13,
    },
    gridContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
    },
    gridOption: {
      width: '31%',
      height: 64,
      borderRadius: 16,
      borderWidth: 1.5,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    gridOptionActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    gridOptionInactive: {
      backgroundColor: colors.background,
      borderColor: colors.border,
    },
    optionRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    optionText: {
      fontSize: 20,
      fontWeight: '900',
      marginRight: 4,
    },
    optionTextActive: {
      color: colors.textOnPrimary || '#FFFFFF',
    },
    optionTextInactive: {
      color: colors.text,
    },
    optionLabel: {
      fontSize: 9,
      fontWeight: '900',
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    optionLabelActive: {
      color: colors.textOnPrimary || '#FFFFFF',
      opacity: 0.85,
    },
    optionLabelInactive: {
      color: colors.textSecondary,
    },
  });
