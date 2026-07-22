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
  withDelay
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { 
  Reply, 
  Copy, 
  Trash2, 
  Forward,
  Info,
  Star,
  Pencil,
  Calendar,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/contexts/AuthContext';

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
  
  // Local state to keep the message content during the exit animation
  const [activeMsg, setActiveMsg] = React.useState<any>(null);
  
  useEffect(() => {
    if (message) {
      setActiveMsg(message);
    }
  }, [message]);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (visible) {
        onClose();
        return true;
      }
      return false;
    });
    return () => backHandler.remove();
  }, [visible]);

  if (!activeMsg) return null;

  const canEdit = isMe && isWithin15Minutes(activeMsg?.created_at);

  const handleAction = (action: 'reply' | 'copy' | 'delete' | 'forward' | 'edit' | 'reschedule') => {
    console.log('[MessageOverlay] handleAction internal triggered:', action);
    try {
      onAction(action);
    } catch (e: any) {
      console.error('[MessageOverlay] ERROR calling onAction:', e?.message, e);
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onClose();
  };

  const handleReaction = (emoji: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onReaction(emoji);
    onClose();
  };

  return (
    <>
      {visible && (
        <Animated.View 
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(200)}
          style={[StyleSheet.absoluteFill, { zIndex: 9999 }]} 
          pointerEvents="auto"
        >
          {/* Full-screen backdrop — tapping outside the menu closes the overlay */}
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
            <Animated.View
              entering={FadeIn.duration(100)}
              exiting={FadeOut.duration(100)}
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
              <Pressable onPress={onClose} style={styles.scrollContentWrapper}>
                {/* Emoji Bar */}
                <Pressable onPress={(e) => e.stopPropagation()}>
                  <Animated.View 
                    entering={SubtleEmojiBarPop}
                    exiting={FadeOutDown.duration(150)}
                    style={styles.emojiBar}
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
                                borderColor: '#3B82F6',
                                borderRadius: 999,
                                backgroundColor: 'rgba(59, 130, 246, 0.15)',
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
                    exiting={FadeOut.duration(150)}
                  >
                    {renderMessageContent(activeMsg, isMe)}
                  </Animated.View>
                </Pressable>

                {/* Action Menu */}
                <Pressable onPress={(e) => e.stopPropagation()}>
                  <Animated.View 
                    entering={SubtleMenuPop}
                    exiting={FadeOutDown.duration(150)}
                    style={styles.menuContainer}
                  >
                      <MenuOption 
                        icon={<Reply size={20} color="#F8FAFC" />} 
                        label="Reply" 
                        onPress={() => handleAction('reply')} 
                      />
                      {isCoach && (
                        <>
                          <MenuDivider />
                          <MenuOption 
                            icon={<Forward size={20} color="#F8FAFC" />} 
                            label="Forward" 
                            onPress={() => handleAction('forward')} 
                          />
                        </>
                      )}
                      <MenuDivider />
                      <MenuOption 
                        icon={<Copy size={20} color="#F8FAFC" />} 
                        label="Copy" 
                        onPress={() => handleAction('copy')} 
                      />
                      <MenuDivider />
                      <MenuOption 
                        icon={<Star size={20} color="#F8FAFC" />} 
                        label="Star" 
                        onPress={() => {}} 
                      />
                      <MenuDivider />
                      <MenuOption 
                        icon={<Info size={20} color="#F8FAFC" />} 
                        label="Info" 
                        onPress={() => {}} 
                      />
                      
                      {canEdit && (
                        <>
                          <MenuDivider />
                          <MenuOption 
                            icon={<Pencil size={20} color="#60A5FA" />} 
                            label="Edit" 
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
                                <MenuDivider />
                                <MenuOption 
                                  icon={<Calendar size={20} color="#10B981" />} 
                                  label="Reschedule" 
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
                          <MenuDivider />
                          <MenuOption 
                            icon={<Trash2 size={20} color="#EF4444" />} 
                            label="Delete" 
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

const MenuOption = ({ icon, label, onPress, destructive }: any) => (
  <Pressable 
    onPress={() => {
      console.log('[MessageOverlay] MenuOption pressed:', label);
      onPress();
    }} 
    style={({ pressed }) => [
      { width: '100%' },
      pressed && { backgroundColor: 'rgba(255, 255, 255, 0.08)' }
    ]}
  >
    <View style={styles.menuOptionInternal}>
      <Text numberOfLines={1} style={[styles.menuLabel, destructive && { color: '#FF453A' }]}>{label}</Text>
      <View style={styles.menuIconWrapper}>
        {icon}
      </View>
    </View>
  </Pressable>
);

const MenuDivider = () => <View style={styles.divider} />;

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
