import React, { useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Pressable, 
  Dimensions, 
  Platform,
  BackHandler,
  ScrollView,
  StyleProp,
  ViewStyle
} from 'react-native';
import Animated, { 
  FadeIn, 
  FadeOut, 
  ZoomIn, 
  ZoomOut,
  FadeInDown,
  FadeOutDown,
  withSpring,
  withTiming,
  withDelay,
  useSharedValue,
  useAnimatedStyle
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { 
  Reply, 
  Copy, 
  Trash2, 
  Forward,
  Star,
  Pencil,
  Calendar,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/BrandContext';
import { isDarkColor, getContrastColor } from '@/lib/theme-utils';

import { Keyframe } from 'react-native-reanimated';

const SubtleBubblePop = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 0.85 }] },
  70: { opacity: 1, transform: [{ scale: 1.02 }] },
  100: { opacity: 1, transform: [{ scale: 1 }] },
}).duration(250);

const SubtleMenuPop = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 0.9 }, { translateY: 15 }] },
  70: { opacity: 1, transform: [{ scale: 1.02 }, { translateY: -2 }] },
  100: { opacity: 1, transform: [{ scale: 1 }, { translateY: 0 }] },
}).duration(250);

const SubtleEmojiBarPop = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 0.9 }, { translateY: -10 }] },
  70: { opacity: 1, transform: [{ scale: 1.02 }, { translateY: 2 }] },
  100: { opacity: 1, transform: [{ scale: 1 }, { translateY: 0 }] },
}).duration(250);

/** Returns true if the message was sent within the last 15 minutes */
function isWithin15Minutes(createdAt: string): boolean {
  try {
    const sent = new Date(createdAt).getTime();
    const now = Date.now();
    const diff = now - sent;
    const result = diff <= 15 * 60 * 1000;
    console.log('[MessageOverlay] isWithin15Minutes Check:', { createdAt, diffSeconds: diff / 1000, result });
    return result;
  } catch (e) {
    console.log('[MessageOverlay] Error parsing date:', createdAt, e);
    return false;
  }
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface MessageOverlayProps {
  visible: boolean;
  message: any;
  isMe: boolean;
  onClose: () => void;
  onReaction: (emoji: string) => void;
  onAction: (action: 'reply' | 'copy' | 'delete' | 'forward' | 'edit' | 'reschedule') => void;
  renderMessageContent: (item: any, isMe: boolean) => React.ReactNode;
  isCoach?: boolean;
}

const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

export const MessageOverlay: React.FC<MessageOverlayProps> = ({
  visible,
  message,
  isMe,
  onClose,
  onReaction,
  onAction,
  renderMessageContent,
  isCoach
}) => {
  const { user } = useAuth();
  const theme = useTheme();
  const colors = theme.colors;
  const isDark = isDarkColor(colors.surface || colors.background || '#020617');
  const overlayCardBg = colors.surface || (isDark ? 'rgba(30, 41, 59, 0.95)' : '#FFFFFF');
  const overlayCardBorder = colors.border || (isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)');
  const textColor = colors.text || (isDark ? '#F8FAFC' : '#0F172A');
  const dividerColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
  const pressBg = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.06)';
  
  // Local state to keep the message content during the exit animation
  const [activeMsg, setActiveMsg] = React.useState<any>(null);
  const [internalVisible, setInternalVisible] = React.useState(visible);
  
  useEffect(() => {
    if (message) {
      setActiveMsg(message);
    }
  }, [message]);

  useEffect(() => {
    setInternalVisible(visible);
  }, [visible]);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (visible) {
        handleClose();
        return true;
      }
      return false;
    });
    return () => backHandler.remove();
  }, [visible, internalVisible]);

  const handleClose = () => {
    if (!internalVisible) return;
    setInternalVisible(false);
    setTimeout(() => {
      onClose();
    }, 150);
  };

  if (!activeMsg) return null;

  const canEdit = isMe && isWithin15Minutes(activeMsg?.created_at);

  // Detect if this is a media/non-text message (hide Copy for those)
  const isMediaMessage = (() => {
    try {
      const p = JSON.parse(activeMsg.content);
      const mediaTypes = ['image', 'video', 'gif', 'document', 'audio', 'session_invite', 'call_invite', 'task_completion', 'challenge_completed', 'meal', 'meal_log'];
      return mediaTypes.includes(p.type);
    } catch {
      return false;
    }
  })();

  const handleAction = (action: 'reply' | 'copy' | 'delete' | 'forward' | 'edit' | 'reschedule') => {
    console.log('[MessageOverlay] handleAction internal triggered:', action);
    try {
      onAction(action);
    } catch (e: any) {
      console.error('[MessageOverlay] ERROR calling onAction:', e?.message, e);
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    handleClose();
  };

  const handleReaction = (emoji: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onReaction(emoji);
    handleClose();
  };

  return (
    <>
      {internalVisible && (
        <Animated.View 
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(50)}
          style={[StyleSheet.absoluteFill, { zIndex: 9999 }]} 
          pointerEvents="auto"
        >
          {/* Full-screen backdrop — tapping outside the menu closes the overlay */}
          <Pressable style={StyleSheet.absoluteFill} onPressIn={handleClose}>
            <Animated.View
              entering={FadeIn.duration(100)}
              exiting={FadeOut.duration(50)}
              style={StyleSheet.absoluteFill}
            >
              <BlurView 
                intensity={Platform.OS === 'ios' ? 30 : 100} 
                tint="dark" 
                style={StyleSheet.absoluteFill} 
              />
            </Animated.View>
          </Pressable>

          {/* Menu content — stopPropagation prevents taps here from reaching the backdrop */}
          <View style={styles.container} pointerEvents="box-none">
            <ScrollView 
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
              style={{ width: '100%', maxHeight: '90%' }}
              bounces={true}
            >
              <Pressable onPressIn={handleClose} style={styles.scrollContentWrapper}>
                {/* Emoji Bar */}
                <Pressable onPress={(e) => e.stopPropagation()}>
                  <Animated.View 
                    entering={SubtleEmojiBarPop}
                    exiting={FadeOutDown.duration(50)}
                    style={[styles.emojiBar, { backgroundColor: overlayCardBg, borderColor: overlayCardBorder }]}
                  >
                    {EMOJIS.map((emoji, index) => {
                      let isReacted = false;
                      try {
                        const contentObj = typeof activeMsg.content === 'string' ? JSON.parse(activeMsg.content) : activeMsg.content;
                        const reactionsList = contentObj.reactions || [];
                        isReacted = reactionsList.some((r: any) => r.user_id === user?.id && r.emoji === emoji);
                      } catch {}

                      return (
                        <Animated.View
                          key={index}
                          entering={ZoomIn.duration(200).delay(index * 35).springify().damping(20).stiffness(350)}
                          exiting={ZoomOut.duration(150)}
                        >
                          <TouchableOpacity 
                            onPress={() => handleReaction(emoji)}
                            style={[
                              styles.emojiItem,
                              isReacted && {
                                borderWidth: 2,
                                borderColor: colors.primary,
                                borderRadius: 999,
                                backgroundColor: `${colors.primary}20`,
                              }
                            ]}
                          >
                            <Text style={styles.emojiText}>{emoji}</Text>
                          </TouchableOpacity>
                        </Animated.View>
                      );
                    })}
                  </Animated.View>
                </Pressable>

                {/* Message Preview */}
                <Pressable 
                  onPress={(e) => e.stopPropagation()}
                  style={[
                    styles.messagePreviewContainer, 
                    { alignSelf: isMe ? 'flex-end' : 'flex-start' }
                  ]}
                >
                  <Animated.View
                    entering={SubtleBubblePop}
                    exiting={FadeOut.duration(50)}
                  >
                    {renderMessageContent(activeMsg, isMe)}
                  </Animated.View>
                </Pressable>

                {/* Action Menu */}
                <Pressable onPress={(e) => e.stopPropagation()}>
                  <Animated.View 
                    entering={SubtleMenuPop}
                    exiting={FadeOutDown.duration(50)}
                    style={[styles.menuContainer, { backgroundColor: overlayCardBg, borderColor: overlayCardBorder }]}
                  >
                      <MenuOption 
                        icon={<Reply size={20} color={textColor} />} 
                        label="Reply" 
                        textColor={textColor}
                        pressBg={pressBg}
                        onPress={() => handleAction('reply')} 
                      />
                      {isCoach && (
                        <>
                          <MenuDivider color={dividerColor} />
                          <MenuOption 
                            icon={<Forward size={20} color={textColor} />} 
                            label="Forward" 
                            textColor={textColor}
                            pressBg={pressBg}
                            onPress={() => handleAction('forward')} 
                          />
                        </>
                      )}
                      <MenuDivider color={dividerColor} />
                      {!isMediaMessage && (
                        <>
                          <MenuOption 
                            icon={<Copy size={20} color={textColor} />} 
                            label="Copy" 
                            textColor={textColor}
                            pressBg={pressBg}
                            onPress={() => handleAction('copy')} 
                          />
                          <MenuDivider color={dividerColor} />
                        </>
                      )}
                      <MenuOption 
                        icon={<Star size={20} color={textColor} />} 
                        label="Star" 
                        textColor={textColor}
                        pressBg={pressBg}
                        onPress={() => {}} 
                      />
                      
                      {canEdit && (
                        <>
                          <MenuDivider color={dividerColor} />
                          <MenuOption 
                            icon={<Pencil size={20} color={colors.primary} />} 
                            label="Edit" 
                            textColor={textColor}
                            pressBg={pressBg}
                            onPress={() => handleAction('edit')}
                          />
                        </>
                      )}

                      {(() => {
                        try {
                          const p = JSON.parse(activeMsg.content);
                          if (p.type === 'session_invite' || p.type === 'call_invite') {
                            return (
                              <>
                                <MenuDivider color={dividerColor} />
                                <MenuOption 
                                  icon={<Calendar size={20} color="#10B981" />} 
                                  label="Reschedule" 
                                  textColor={textColor}
                                  pressBg={pressBg}
                                  onPress={() => handleAction('reschedule')}
                                />
                              </>
                            );
                          }
                        } catch {}
                        return null;
                      })()}

                      {isMe && (
                        <>
                          <MenuDivider color={dividerColor} />
                          <MenuOption 
                            icon={<Trash2 size={20} color="#EF4444" />} 
                            label="Delete" 
                            textColor={textColor}
                            pressBg={pressBg}
                            onPress={() => handleAction('delete')}
                            destructive
                          />
                        </>
                      )}
                    </Animated.View>
                  </Pressable>
                  
                  <View style={{ height: 100 }} />
                </Pressable>
              </ScrollView>
          </View>
        </Animated.View>
      )}
    </>
  );
};

const MenuOption = ({ icon, label, onPress, destructive, textColor, pressBg }: any) => {
  const bgOpacity = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      backgroundColor: pressBg ? pressBg : 'rgba(255, 255, 255, 0.1)',
      opacity: bgOpacity.value,
      width: '100%',
    };
  });

  return (
    <Pressable 
      onPressIn={() => {
        bgOpacity.value = withTiming(1, { duration: 80 });
      }}
      onPressOut={() => {
        bgOpacity.value = withTiming(0, { duration: 150 });
      }}
      onPress={() => {
        console.log('[MessageOverlay] MenuOption pressed:', label);
        onPress();
      }} 
    >
      <View style={{ width: '100%', position: 'relative' }}>
        <Animated.View style={[StyleSheet.absoluteFill, animatedStyle]} />
        <View style={styles.menuOptionInternal}>
          <Text numberOfLines={1} style={[styles.menuLabel, { color: destructive ? '#EF4444' : (textColor || '#F8FAFC') }]}>{label}</Text>
          <View style={styles.menuIconWrapper}>
            {icon}
          </View>
        </View>
      </View>
    </Pressable>
  );
};

const MenuDivider = ({ color }: { color?: string }) => (
  <View style={[styles.divider, color ? { backgroundColor: color } : null]} />
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '100%',
    alignItems: 'center',
    maxHeight: '90%',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 40,
    flexGrow: 1,
  },
  scrollContentWrapper: {
    alignItems: 'center',
    width: '100%',
    flexGrow: 1,
  },
  emojiBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
    borderRadius: 40,
    padding: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  emojiItem: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emojiText: {
    fontSize: 26,
  },
  messagePreviewContainer: {
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.4,
    shadowRadius: 30,
    elevation: 15,
  },
  menuContainer: {
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
    borderRadius: 24,
    width: 250,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  menuOptionInternal: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 20,
    width: '100%',
  },
  menuLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#F8FAFC',
    letterSpacing: -0.2,
    flex: 1,
  },
  menuIconWrapper: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.8,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
});
