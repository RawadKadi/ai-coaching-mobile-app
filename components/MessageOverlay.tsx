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
import { MotiView, AnimatePresence } from 'moti';
import { BlurView } from 'expo-blur';
import { 
  Reply, 
  Copy, 
  Trash2, 
  Forward,
  Info,
  Star,
  Pencil,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

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
  onAction: (action: 'reply' | 'copy' | 'delete' | 'forward' | 'edit') => void;
  renderMessageContent: (item: any, isMe: boolean) => React.ReactNode;
}

const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

export const MessageOverlay: React.FC<MessageOverlayProps> = ({
  visible,
  message,
  isMe,
  onClose,
  onReaction,
  onAction,
  renderMessageContent
}) => {
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

  if (!visible || !message) return null;

  const canEdit = isMe && isWithin15Minutes(message?.created_at);

  const handleAction = (action: 'reply' | 'copy' | 'delete' | 'forward' | 'edit') => {
    console.log('[MessageOverlay] handleAction internal triggered:', action);
    console.log('[MessageOverlay] onAction prop type:', typeof onAction);
    console.log('[MessageOverlay] onAction body:', onAction?.toString?.().substring(0, 200));
    
    try {
      onAction(action);
      console.log('[MessageOverlay] onAction returned successfully');
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
    <View style={StyleSheet.absoluteFill} pointerEvents="auto">
      {/* Full-screen backdrop — tapping outside the menu closes the overlay */}
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
        <BlurView 
          intensity={Platform.OS === 'ios' ? 30 : 100} 
          tint="dark" 
          style={StyleSheet.absoluteFill} 
        />
      </Pressable>

      {/* Menu content — stopPropagation prevents taps here from reaching the backdrop */}
      <View style={styles.container} pointerEvents="box-none">
        <AnimatePresence>
          <MotiView 
            from={{ opacity: 0, scale: 0.9, translateY: 20 }}
            animate={{ opacity: 1, scale: 1, translateY: 0 }}
            exit={{ opacity: 0, scale: 0.9, translateY: 20 }}
            transition={{ type: 'spring', damping: 20, stiffness: 250 }}
            style={styles.modalContent}
            pointerEvents="box-none"
          >
            <ScrollView 
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
              style={{ width: '100%' }}
              bounces={true}
            >
              <Pressable onPress={onClose} style={styles.scrollContentWrapper}>
                {/* Emoji Bar */}
                <Pressable onPress={(e) => e.stopPropagation()}>
                  <MotiView 
                    from={{ translateY: 10, opacity: 0 }}
                    animate={{ translateY: 0, opacity: 1 }}
                    transition={{ delay: 100 }}
                    style={styles.emojiBar}
                  >
                    {EMOJIS.map((emoji, index) => (
                      <TouchableOpacity 
                        key={index} 
                        onPress={() => handleReaction(emoji)}
                        style={styles.emojiItem}
                      >
                        <Text style={styles.emojiText}>{emoji}</Text>
                      </TouchableOpacity>
                    ))}
                  </MotiView>
                </Pressable>

                {/* Message Preview */}
                <Pressable 
                  onPress={(e) => e.stopPropagation()}
                  style={[
                    styles.messagePreviewContainer, 
                    { alignSelf: isMe ? 'flex-end' : 'flex-start' }
                  ]}
                >
                  {renderMessageContent(message, isMe)}
                </Pressable>

                {/* Action Menu */}
                <Pressable onPress={(e) => e.stopPropagation()}>
                  <MotiView 
                    from={{ translateY: -10, opacity: 0 }}
                    animate={{ translateY: 0, opacity: 1 }}
                    transition={{ delay: 150 }}
                    style={styles.menuContainer}
                  >
                    <MenuOption 
                        icon={<Reply size={20} color="#F8FAFC" />} 
                        label="Reply" 
                        onPress={() => handleAction('reply')} 
                    />
                    <MenuDivider />
                    <MenuOption 
                        icon={<Forward size={20} color="#F8FAFC" />} 
                        label="Forward" 
                        onPress={() => handleAction('forward')} 
                    />
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
                  </MotiView>
                </Pressable>
                
                <View style={{ height: 100 }} />
              </Pressable>
            </ScrollView>
          </MotiView>
        </AnimatePresence>
      </View>
    </View>
  );
};

const MenuOption = ({ icon, label, onPress, destructive }: any) => (
  <Pressable 
    onPress={() => {
      console.log('[MessageOverlay] MenuOption pressed:', label);
      onPress();
    }} 
    style={({ pressed }) => [
      styles.menuOption,
      pressed && { opacity: 0.7, backgroundColor: 'rgba(255,255,255,0.05)' }
    ]}
  >
    <Text style={[styles.menuLabel, destructive && { color: '#EF4444' }]}>{label}</Text>
    {icon}
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
  },
  scrollContentWrapper: {
    alignItems: 'center',
    width: '100%',
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
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  menuLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F8FAFC',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
});
