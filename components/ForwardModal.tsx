import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  Modal, 
  TouchableOpacity, 
  StyleSheet, 
  FlatList, 
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert
} from 'react-native';
import { MotiView, AnimatePresence } from 'moti';
import { Search, X, Check, Send } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/BrandContext';
import { BrandedAvatar } from './BrandedAvatar';
import * as Haptics from 'expo-haptics';

interface Teammate {
  coach_id: string;
  user_id: string;
  full_name: string;
  avatar_url: string | null;
}

interface ForwardModalProps {
  visible: boolean;
  onClose: () => void;
  onForward: (targetUserIds: string[]) => Promise<void>;
}

export default function ForwardModal({ visible, onClose, onForward }: ForwardModalProps) {
  const { user } = useAuth();
  const theme = useTheme();
  
  const [teammates, setTeammates] = useState<Teammate[]>([]);
  const [filtered, setFiltered] = useState<Teammate[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (visible) {
      loadTeammates();
      setSearch('');
      setSelectedIds(new Set());
    }
  }, [visible]);

  const loadTeammates = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_team_coaches');
      if (error) throw error;
      
      const list = data || [];
      setTeammates(list);
      setFiltered(list);
    } catch (err: any) {
      console.error('[ForwardModal] Failed to load teammates:', err);
      Alert.alert('Error', 'Failed to load team members.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (text: string) => {
    setSearch(text);
    if (!text.trim()) {
      setFiltered(teammates);
    } else {
      const lower = text.toLowerCase();
      setFiltered(teammates.filter(t => t.full_name?.toLowerCase().includes(lower)));
    }
  };

  const toggleSelect = (userId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
    Haptics.selectionAsync();
  };

  const handleSend = async () => {
    if (selectedIds.size === 0) return;
    setIsSending(true);
    try {
      await onForward(Array.from(selectedIds));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
    } catch (err: any) {
      Alert.alert('Error', 'Failed to forward messages: ' + err.message);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Send to</Text>
            <View style={{ width: 60 }} />
          </View>

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <Search size={18} color="rgba(255,255,255,0.4)" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search"
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={search}
              onChangeText={handleSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => handleSearch('')} style={styles.clearBtn}>
                <X size={16} color="rgba(255,255,255,0.4)" />
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.sectionTitle}>Frequently contacted</Text>

          {/* List */}
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={theme.colors.primary} />
            </View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={item => item.user_id}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => {
                const isSelected = selectedIds.has(item.user_id);
                return (
                  <TouchableOpacity 
                    style={styles.contactRow}
                    activeOpacity={0.7}
                    onPress={() => toggleSelect(item.user_id)}
                  >
                    <BrandedAvatar url={item.avatar_url} size={48} name={item.full_name} border />
                    <View style={styles.contactInfo}>
                      <Text style={styles.contactName}>{item.full_name}</Text>
                      <Text style={styles.contactSub}>Teammate</Text>
                    </View>
                    <View style={[styles.circle, isSelected && { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary }]}>
                      {isSelected && <Check size={14} color="#FFF" strokeWidth={3} />}
                    </View>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No teammates found.</Text>
              }
            />
          )}

          {/* Bottom Send Action */}
          {selectedIds.size > 0 && (
            <MotiView 
              from={{ opacity: 0, translateY: 50 }}
              animate={{ opacity: 1, translateY: 0 }}
              style={styles.bottomBar}
            >
              <Text style={styles.selectedCount}>{selectedIds.size} Selected</Text>
              <TouchableOpacity 
                style={[styles.sendBtn, { backgroundColor: theme.colors.primary }]}
                onPress={handleSend}
                disabled={isSending}
              >
                {isSending ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Send size={20} color="#FFF" />
                )}
              </TouchableOpacity>
            </MotiView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#1E1E1E', // standard dark gray background like screenshot
    height: '92%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  cancelBtn: {
    width: 60,
  },
  cancelText: {
    color: '#E2E8F0',
    fontSize: 16,
  },
  title: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 16,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#FFF',
    fontSize: 16,
  },
  clearBtn: {
    padding: 4,
  },
  sectionTitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    fontWeight: '600',
    marginHorizontal: 16,
    marginTop: 24,
    marginBottom: 8,
  },
  listContent: {
    paddingBottom: 100,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  contactInfo: {
    flex: 1,
    marginLeft: 12,
  },
  contactName: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '500',
  },
  contactSub: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
    marginTop: 2,
  },
  circle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    marginTop: 40,
    fontSize: 15,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(20,20,20,0.95)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  selectedCount: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '500',
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  }
});
