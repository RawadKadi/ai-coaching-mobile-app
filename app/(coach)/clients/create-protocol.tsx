import { useTheme } from '@/contexts/BrandContext';
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  Alert, 
  ActivityIndicator, 
  SafeAreaView, 
  Platform, 
  KeyboardAvoidingView,
  Keyboard
} from 'react-native';
import { useRouter, useLocalSearchParams, useNavigation } from 'expo-router';
import { MotiView, AnimatePresence } from 'moti';
import Animated, { 
  FadeInDown, 
  FadeOut, 
  LinearTransition, 
  useReducedMotion,
  useSharedValue,
  useAnimatedStyle,
  withTiming
} from 'react-native-reanimated';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, Plus, Trash2, Check, ChevronDown } from 'lucide-react-native';
import { BrandedAvatar } from '@/components/BrandedAvatar';

interface Client {
  id: string;
  full_name: string;
  avatar_url?: string;
}

interface ProtocolTask {
  clientKey: string;
  id?: string;
  name: string;
  description: string;
  category: 'training' | 'nutrition' | 'recovery' | 'consistency';
  target_value?: number;
  unit?: string;
  frequency?: string;
  verification_type?: string;
  originalName?: string;
  initialName?: string;
  initialDescription?: string;
  initialCategory?: string;
  isNew?: boolean;
}

const generateTaskKey = () => 'task_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);

// Dedicated animated task card component with smooth entering and exiting transitions
const TaskCardItem = ({
  task,
  index,
  canDelete,
  colors,
  reduceMotion,
  onRemove,
  onUpdate,
  onInputFocus,
  onInputBlur,
  taskInputRef,
}: {
  task: ProtocolTask;
  index: number;
  canDelete: boolean;
  colors: any;
  reduceMotion: boolean;
  onRemove: (key: string) => void;
  onUpdate: (key: string, field: keyof ProtocolTask, value: any) => void;
  onInputFocus: (key: string) => void;
  onInputBlur: (key: string) => void;
  taskInputRef: (el: any) => void;
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const handleDelete = () => {
    if (isDeleting) return;
    setIsDeleting(true);
    // Smooth fade out and shrink before removal
    opacity.value = withTiming(0, { duration: 250 });
    scale.value = withTiming(0.85, { duration: 250 });
    setTimeout(() => {
      onRemove(task.clientKey);
    }, 260);
  };

  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeInDown.duration(320).springify().damping(18)}
      exiting={reduceMotion ? undefined : FadeOut.duration(250)}
      layout={reduceMotion ? undefined : LinearTransition.duration(250)}
      style={[
        {
          backgroundColor: colors.surface,
          padding: 20,
          borderRadius: 24,
          borderWidth: 1,
          borderColor: colors.border,
          marginBottom: 16,
        },
        animStyle,
      ]}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: colors.textOnPrimary || 'white', fontSize: 11, fontWeight: '900' }}>{index + 1}</Text>
          </View>
          <Text style={{ color: colors.primary, fontWeight: 'bold', fontSize: 12, textTransform: 'uppercase' }}>Daily Task</Text>
        </View>
        {canDelete && (
          <TouchableOpacity 
            onPress={handleDelete} 
            disabled={isDeleting}
            style={{ padding: 6 }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Trash2 size={16} color={colors.error || '#ef4444'} />
          </TouchableOpacity>
        )}
      </View>

      <TextInput 
        ref={taskInputRef}
        style={{ 
          backgroundColor: colors.inputBackground || colors.background, 
          borderWidth: 1,
          borderColor: colors.border,
          padding: 14, 
          borderRadius: 14, 
          color: colors.text, 
          fontWeight: 'bold', 
          fontSize: 15, 
          marginBottom: 10 
        }}
        placeholder="Task Name (e.g. Drink Water)" 
        placeholderTextColor={colors.textTertiary || '#64748b'}
        value={task.name} 
        onFocus={() => onInputFocus(task.clientKey)}
        onBlur={() => onInputBlur(task.clientKey)}
        onChangeText={(v) => onUpdate(task.clientKey, 'name', v)}
      />

      <TextInput 
        style={{ 
          backgroundColor: colors.inputBackground || colors.background, 
          borderWidth: 1,
          borderColor: colors.border,
          padding: 14, 
          borderRadius: 14, 
          color: colors.text, 
          fontWeight: '500', 
          fontSize: 14, 
          marginBottom: 14, 
          minHeight: 56 
        }}
        placeholder="Optional instructions..." 
        placeholderTextColor={colors.textTertiary || '#64748b'}
        multiline
        value={task.description} 
        onFocus={() => onInputFocus(task.clientKey)}
        onBlur={() => onInputBlur(task.clientKey)}
        onChangeText={(v) => onUpdate(task.clientKey, 'description', v)}
        textAlignVertical="top"
      />

      <Text style={{ color: colors.textSecondary, fontSize: 9, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8, marginLeft: 4 }}>
        Category
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row' }}>
        {(['training', 'nutrition', 'recovery', 'consistency'] as const).map((cat) => {
          const isActive = task.category === cat;
          return (
            <TouchableOpacity 
              key={cat} 
              onPress={() => onUpdate(task.clientKey, 'category', cat)} 
              style={{ 
                paddingHorizontal: 14, 
                paddingVertical: 8, 
                borderRadius: 12, 
                borderWidth: 1, 
                marginRight: 8,
                backgroundColor: isActive ? colors.primary : (colors.inputBackground || colors.background),
                borderColor: isActive ? colors.primary : colors.border
              }}
            >
              <Text style={{ fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', color: isActive ? (colors.textOnPrimary || 'white') : colors.textSecondary }}>{cat}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </Animated.View>
  );
};

export default function CreateProtocolScreen() {
  const theme = useTheme();
  const colors = theme.colors;
  const reduceMotion = useReducedMotion();
  const router = useRouter();
  const navigation = useNavigation();
  const { clientId, autoAddNew } = useLocalSearchParams();
  const { coach } = useAuth();

  // Form State
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isAllClients, setIsAllClients] = useState(false);
  const [tasks, setTasks] = useState<ProtocolTask[]>([
    { clientKey: generateTaskKey(), name: '', description: '', category: 'training', isNew: true }
  ]);
  const [deletedTaskIds, setDeletedTaskIds] = useState<string[]>([]);
  const [deletedTaskNames, setDeletedTaskNames] = useState<string[]>([]);

  // UI State
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingCommon, setLoadingCommon] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  
  // Refs
  const scrollViewRef = useRef<any>(null);
  const taskNameInputRefs = useRef<{ [key: string]: any }>({});
  const autoAddHandledRef = useRef(false);
  const initialStateRef = useRef<string>('');
  const isDiscardingRef = useRef(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeFocusedKeyRef = useRef<string | null>(null);

  // Helper to serialize state for dirty checking
  const serializeState = (allClientsMode: boolean, currentTasks: ProtocolTask[]) => {
    return JSON.stringify({
      allClientsMode,
      tasks: currentTasks
        .filter(t => t.name.trim().length > 0 || (t.description && t.description.trim().length > 0))
        .map(t => ({
          name: t.name.trim(),
          description: (t.description || '').trim(),
          category: t.category,
        })),
    });
  };

  // Determine if user has made unsaved adjustments
  const isDirty = useMemo(() => {
    if (!initialStateRef.current) return false;
    return serializeState(isAllClients, tasks) !== initialStateRef.current;
  }, [tasks, isAllClients]);

  // Disable swipe-to-dismiss gesture on iOS when changes exist
  useEffect(() => {
    navigation.setOptions({
      gestureEnabled: !isDirty,
    });
  }, [navigation, isDirty]);

  // Prompt discard confirmation
  const promptDiscard = useCallback((onConfirmDiscard: () => void) => {
    Alert.alert(
      'Discard changes?',
      "You've made changes. Are you sure you want to discard them?",
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            isDiscardingRef.current = true;
            onConfirmDiscard();
          },
        },
      ]
    );
  }, []);

  // Intercept native back navigations when dirty
  useEffect(() => {
    const unsubscribe = (navigation as any).addListener('beforeRemove', (e: any) => {
      if (!isDirty || isDiscardingRef.current) {
        return;
      }
      e.preventDefault();
      promptDiscard(() => (navigation as any).dispatch(e.data.action));
    });

    return unsubscribe;
  }, [navigation, isDirty, promptDiscard]);

  const handleBackPress = () => {
    if (isDirty) {
      promptDiscard(() => router.back());
    } else {
      router.back();
    }
  };

  const loadExistingTasks = async (cid: string) => {
    try {
      const { data, error } = await supabase
        .from('habits')
        .select('*')
        .eq('client_id', cid)
        .eq('is_active', true)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      let loadedTasks: ProtocolTask[] = [];
      if (data && data.length > 0) {
        loadedTasks = data.map(h => ({
          clientKey: h.id || generateTaskKey(),
          id: h.id,
          name: h.name,
          description: h.description || '',
          category: (h.category as any) || 'training',
          target_value: h.target_value,
          unit: h.unit,
          frequency: h.frequency,
          verification_type: h.verification_type,
          initialName: h.name,
          initialDescription: h.description || '',
          initialCategory: h.category,
          isNew: false
        }));
      } else {
        const initialEmptyKey = generateTaskKey();
        loadedTasks = [{ clientKey: initialEmptyKey, name: '', description: '', category: 'training', isNew: true }];
      }

      setDeletedTaskIds([]);
      setDeletedTaskNames([]);

      // Check if autoAddNew requested from previous screen
      if (autoAddNew === 'true' && !autoAddHandledRef.current) {
        autoAddHandledRef.current = true;
        const lastTask = loadedTasks[loadedTasks.length - 1];
        let targetKey = loadedTasks[0].clientKey;
        if (lastTask && lastTask.name && lastTask.name.trim().length > 0) {
          const newKey = generateTaskKey();
          loadedTasks.push({ clientKey: newKey, name: '', description: '', category: 'training', isNew: true });
          targetKey = newKey;
        }

        setTasks(loadedTasks);
        initialStateRef.current = serializeState(false, loadedTasks);

        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 200);
        setTimeout(() => {
          taskNameInputRefs.current[targetKey]?.focus();
        }, 450);
      } else {
        setTasks(loadedTasks);
        initialStateRef.current = serializeState(false, loadedTasks);
      }
    } catch (e) {
      console.error('Error loading existing tasks:', e);
    }
  };

  const loadCommonTasksForAllClients = async (clientList?: Client[], carryOverTasks: ProtocolTask[] = []) => {
    const currentClients = clientList || clients;
    if (!currentClients || currentClients.length === 0) {
      const emptyTasks = carryOverTasks.length > 0 
        ? carryOverTasks 
        : [{ clientKey: generateTaskKey(), name: '', description: '', category: 'training' as const, isNew: true }];
      setTasks(emptyTasks);
      initialStateRef.current = serializeState(true, emptyTasks);
      return;
    }

    try {
      setLoadingCommon(true);
      const clientIds = currentClients.map(c => c.id);
      const { data, error } = await supabase
        .from('habits')
        .select('*')
        .in('client_id', clientIds)
        .eq('is_active', true)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const totalClients = currentClients.length;
      const taskGroups = new Map<string, {
        name: string;
        description: string;
        category: any;
        clientIdsWithTask: Set<string>;
      }>();

      (data || []).forEach(h => {
        const norm = (h.name || '').trim().toLowerCase();
        if (!norm) return;

        if (!taskGroups.has(norm)) {
          taskGroups.set(norm, {
            name: h.name.trim(),
            description: h.description || '',
            category: h.category || 'training',
            clientIdsWithTask: new Set([h.client_id]),
          });
        } else {
          const group = taskGroups.get(norm)!;
          group.clientIdsWithTask.add(h.client_id);
          if (h.description && !group.description) {
            group.description = h.description;
          }
        }
      });

      // Filter tasks common to all clients
      const commonList: ProtocolTask[] = [];
      taskGroups.forEach((group) => {
        if (group.clientIdsWithTask.size === totalClients) {
          commonList.push({
            clientKey: generateTaskKey(),
            name: group.name,
            description: group.description,
            category: group.category,
            originalName: group.name,
            initialName: group.name,
            initialDescription: group.description,
            initialCategory: group.category,
            isNew: false
          });
        }
      });

      // Combine with any newly added tasks carried over
      let finalTasks = [...commonList, ...carryOverTasks];
      if (finalTasks.length === 0) {
        finalTasks = [{ clientKey: generateTaskKey(), name: '', description: '', category: 'training' as const, isNew: true }];
      }

      setTasks(finalTasks);
      initialStateRef.current = serializeState(true, finalTasks);
      setDeletedTaskNames([]);
      setDeletedTaskIds([]);
    } catch (err) {
      console.error('Error loading common tasks:', err);
    } finally {
      setLoadingCommon(false);
    }
  };

  const loadClients = async () => {
    if (!coach) return;
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_coach_clients', { p_coach_id: coach.id });
      if (error) throw error;
      const loadedClients: Client[] = data || [];
      setClients(loadedClients);
      
      const targetId = Array.isArray(clientId) ? clientId[0] : clientId;
      if (targetId && loadedClients.length > 0) {
        const preSelected = loadedClients.find((c: any) => c.id === targetId);
        if (preSelected) {
          setSelectedClient(preSelected);
          await loadExistingTasks(preSelected.id);
        }
      } else if (loadedClients.length > 0) {
        setSelectedClient(loadedClients[0]);
        await loadExistingTasks(loadedClients[0].id);
      }
    } catch (e) {
      console.error('Error loading clients:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    loadClients(); 
  }, [coach, clientId]);

  // Smart toggle for "Do for all clients"
  const handleToggleAllClients = () => {
    // Check if an existing task was edited or deleted
    const hasEditedExistingTask = tasks.some(t => {
      if (!t.id) return false;
      const nameChanged = t.name.trim() !== (t.initialName || '').trim();
      const descChanged = (t.description || '').trim() !== (t.initialDescription || '').trim();
      const catChanged = t.category !== t.initialCategory;
      return nameChanged || descChanged || catChanged;
    });
    const hasDeletedExistingTask = deletedTaskIds.length > 0 || deletedTaskNames.length > 0;

    // Filter any newly added tasks that have content
    const addedNewTasks = tasks.filter(t => (t.isNew || !t.id) && t.name.trim().length > 0);

    if (hasEditedExistingTask || hasDeletedExistingTask) {
      // If existing tasks were altered, show discard confirmation
      Alert.alert(
        'Discard changes?',
        "You've edited existing tasks. Discard them to switch?",
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Discard', 
            style: 'destructive',
            onPress: () => {
              const nextMode = !isAllClients;
              setIsAllClients(nextMode);
              if (nextMode) {
                loadCommonTasksForAllClients();
              } else {
                if (selectedClient) {
                  loadExistingTasks(selectedClient.id);
                }
              }
            }
          }
        ]
      );
      return;
    }

    // If only new tasks were added (no existing tasks edited), switch smoothly and include the added tasks!
    const nextMode = !isAllClients;
    setIsAllClients(nextMode);
    if (nextMode) {
      loadCommonTasksForAllClients(undefined, addedNewTasks);
    } else {
      if (selectedClient) {
        loadExistingTasks(selectedClient.id);
      }
    }
  };

  const addTask = () => {
    const newKey = generateTaskKey();
    const newTask: ProtocolTask = {
      clientKey: newKey,
      name: '',
      description: '',
      category: 'training',
      isNew: true
    };
    
    setTasks(prev => [...prev, newTask]);
    
    // Smoothly scroll down and auto-focus the new task's name input
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
    setTimeout(() => {
      taskNameInputRefs.current[newKey]?.focus();
    }, 300);
  };

  const removeTask = (key: string) => {
    const taskToRemove = tasks.find(t => t.clientKey === key);
    if (taskToRemove) {
      if (isAllClients) {
        const orig = taskToRemove.originalName || taskToRemove.name;
        if (orig && orig.trim()) {
          setDeletedTaskNames(prev => [...prev, orig.trim()]);
        }
      } else {
        if (taskToRemove.id) {
          setDeletedTaskIds(prev => [...prev, taskToRemove.id!]);
        }
      }
    }

    setTasks(prev => {
      const updated = prev.filter(t => t.clientKey !== key);
      if (updated.length === 0) {
        return [{ clientKey: generateTaskKey(), name: '', description: '', category: 'training', isNew: true }];
      }
      return updated;
    });
  };

  const updateTask = (key: string, field: keyof ProtocolTask, value: any) => {
    setTasks(prev => prev.map(t => {
      if (t.clientKey === key) {
        return { ...t, [field]: value };
      }
      return t;
    }));
  };

  // Auto-remove empty new tasks on blur
  const handleInputFocus = (key: string) => {
    activeFocusedKeyRef.current = key;
  };

  const handleInputBlur = (key: string) => {
    if (activeFocusedKeyRef.current === key) {
      activeFocusedKeyRef.current = null;
    }
    setTimeout(() => {
      // If user moved to another input within the same task, don't remove
      if (activeFocusedKeyRef.current === key) return;

      // Check if task is new, completely empty, and there are other tasks
      setTasks(currentTasks => {
        const target = currentTasks.find(t => t.clientKey === key);
        if (target && target.isNew && !target.name.trim() && !target.description.trim()) {
          if (currentTasks.length > 1) {
            return currentTasks.filter(t => t.clientKey !== key);
          }
        }
        return currentTasks;
      });
    }, 180);
  };

  // Clean up any empty new tasks when tapping outside
  const handleBackgroundTap = () => {
    Keyboard.dismiss();
    setTasks(currentTasks => {
      const filtered = currentTasks.filter(t => !t.isNew || t.name.trim().length > 0 || (t.description && t.description.trim().length > 0));
      return filtered.length > 0 ? filtered : currentTasks;
    });
  };

  // Save tasks button visibility: hide if only empty new tasks or no tasks named yet
  const hasEmptyNewTask = tasks.some(t => t.isNew && !t.name.trim());
  const hasValidTasks = tasks.some(t => t.name.trim().length > 0);
  const showSaveButton = hasValidTasks && !hasEmptyNewTask;

  const validate = () => {
    const newErrors: { [key: string]: string } = {};
    if (!isAllClients && !selectedClient) {
      newErrors.client = 'Please select a recipient';
    }
    if (isAllClients && clients.length === 0) {
      newErrors.client = 'No clients available';
    }

    const validTasks = tasks.filter(t => t.name.trim().length > 0);
    if (validTasks.length === 0) {
      newErrors.tasks = 'Please add at least one task';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreate = async () => {
    if (!validate()) {
      Alert.alert('Incomplete Form', 'Please make sure all tasks have names.');
      return;
    }

    if (!coach) return;

    try {
      setCreating(true);
      const tasksToSave = tasks.filter(t => t.name.trim().length > 0);
      
      if (isAllClients) {
        const clientIds = clients.map(c => c.id);

        // 1. Deactivate deleted tasks for all clients
        if (deletedTaskNames.length > 0) {
          for (const nameToDel of deletedTaskNames) {
            await supabase
              .from('habits')
              .update({ is_active: false })
              .in('client_id', clientIds)
              .ilike('name', nameToDel);
          }
        }

        // 2. Upsert/apply tasks to ALL clients
        for (const t of tasksToSave) {
          const trimmedName = t.name.trim();

          for (const c of clients) {
            const searchName = (t.originalName || trimmedName).trim();
            const { data: existingList } = await supabase
              .from('habits')
              .select('id')
              .eq('client_id', c.id)
              .ilike('name', searchName)
              .limit(1);

            if (existingList && existingList.length > 0) {
              await supabase
                .from('habits')
                .update({
                  name: trimmedName,
                  description: t.description.trim() || null,
                  category: t.category,
                  is_active: true,
                  target_value: t.target_value || 1,
                  unit: t.unit || 'completion',
                  frequency: t.frequency || 'daily',
                  verification_type: t.verification_type || 'none',
                })
                .eq('id', existingList[0].id);
            } else {
              await supabase
                .from('habits')
                .insert({
                  client_id: c.id,
                  name: trimmedName,
                  description: t.description.trim() || null,
                  category: t.category,
                  is_active: true,
                  target_value: t.target_value || 1,
                  unit: t.unit || 'completion',
                  frequency: t.frequency || 'daily',
                  verification_type: t.verification_type || 'none',
                });
            }
          }
        }

        setToastMessage('Tasks saved for all clients');
        setToastVisible(true);
        isDiscardingRef.current = true;
        toastTimer.current = setTimeout(() => {
          setToastVisible(false);
          if (selectedClient) {
            router.replace(`/(coach)/clients/${selectedClient.id}?tab=daily_tasks`);
          } else {
            router.back();
          }
        }, 1500);

      } else {
        // 1. Deactivate deleted tasks
        if (deletedTaskIds.length > 0) {
          const { error: delError } = await supabase
            .from('habits')
            .update({ is_active: false })
            .in('id', deletedTaskIds);
          if (delError) throw delError;
        }

        // 2. Upsert remaining tasks
        if (tasksToSave.length > 0) {
          const habitsToUpsert = tasksToSave.map(t => ({
            ...(t.id ? { id: t.id } : {}),
            client_id: selectedClient!.id,
            name: t.name.trim(),
            description: t.description.trim() || null,
            category: t.category,
            is_active: true,
            target_value: t.target_value || 1,
            unit: t.unit || 'completion',
            frequency: t.frequency || 'daily',
            verification_type: t.verification_type || 'none'
          }));

          const { error } = await supabase.from('habits').upsert(habitsToUpsert);
          if (error) throw error;
        }
        
        setToastMessage(`Daily tasks updated for ${selectedClient?.full_name}`);
        setToastVisible(true);
        isDiscardingRef.current = true;
        toastTimer.current = setTimeout(() => {
          setToastVisible(false);
          router.replace(`/(coach)/clients/${selectedClient!.id}?tab=daily_tasks`);
        }, 1500);
      }
    } catch (e: any) {
      Alert.alert('Save Failed', e.message);
    } finally {
      setCreating(false);
    }
  };

  if (loading && !selectedClient) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <TouchableOpacity 
            onPress={handleBackPress} 
            style={{ padding: 12, backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border }}
          >
            <ArrowLeft size={20} color={colors.textSecondary} />
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
              <Text style={{ color: colors.text, fontSize: 20, fontWeight: 'bold' }}>Daily Tasks</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 4 }}>Daily Habits</Text>
          </View>
          <View style={{ width: 44 }} />
        </View>

        {/* Floating / Pinned Target Client & All Clients Bar */}
        <View 
          style={{ 
            paddingHorizontal: 14, 
            paddingBottom: 8, 
            paddingTop: 4, 
            backgroundColor: colors.background,
            borderBottomWidth: 1,
            borderBottomColor: `${colors.border}40`,
            zIndex: 20,
          }}
        >
          {/* Do for all clients checkmark row */}
          <TouchableOpacity
              onPress={handleToggleAllClients}
              activeOpacity={0.7}
              style={{
                  backgroundColor: isAllClients ? `${colors.primary}18` : colors.surface,
                  borderColor: isAllClients ? colors.primary : colors.border,
                  borderWidth: 1.5,
                  borderRadius: 16,
                  padding: 14,
                  marginBottom: isAllClients ? 4 : 10,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between'
              }}
          >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View 
                      style={{
                          width: 22,
                          height: 22,
                          borderRadius: 6,
                          borderWidth: 1.5,
                          borderColor: isAllClients ? colors.primary : colors.textSecondary,
                          backgroundColor: isAllClients ? colors.primary : 'transparent',
                          alignItems: 'center',
                          justifyContent: 'center',
                      }}
                  >
                      {isAllClients && <Check size={14} color={colors.textOnPrimary || 'white'} strokeWidth={3} />}
                  </View>
                  <View>
                      <Text style={{ fontSize: 15, fontWeight: 'bold', color: colors.text }}>
                          Do for all clients
                      </Text>
                      <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 1 }}>
                          {clients.length > 0 ? `Common tasks across ${clients.length} clients` : 'Manage tasks for all clients'}
                      </Text>
                  </View>
              </View>
              {isAllClients && (
                  <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: `${colors.primary}25` }}>
                      <Text style={{ color: colors.primary, fontSize: 11, fontWeight: 'bold' }}>All Clients</Text>
                  </View>
              )}
          </TouchableOpacity>

          {/* Single client selector (when not in all-clients mode) */}
          {!isAllClients && (
            <>
              <TouchableOpacity 
                  onPress={() => setShowClientPicker(!showClientPicker)}
                  style={{ 
                      backgroundColor: colors.surface, 
                      padding: 14, 
                      borderRadius: 16, 
                      borderWidth: 1, 
                      borderColor: errors.client ? (colors.error || '#ef4444') : colors.border,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 4
                  }}
              >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <BrandedAvatar size={34} name={selectedClient?.full_name || '?'} imageUrl={selectedClient?.avatar_url} useBrandColor={true} />
                      <View>
                          <Text style={{ fontSize: 15, fontWeight: 'bold', color: selectedClient ? colors.text : colors.textSecondary }}>
                              {selectedClient ? selectedClient.full_name : 'Select Recipient'}
                          </Text>
                          {errors.client && <Text style={{ color: colors.error || '#f87171', fontSize: 10, marginTop: 2 }}>{errors.client}</Text>}
                      </View>
                  </View>
                  <ChevronDown size={18} color={errors.client ? (colors.error || '#EF4444') : colors.textSecondary} />
              </TouchableOpacity>

              <AnimatePresence>
                  {showClientPicker && (
                      <MotiView 
                          from={{ opacity: reduceMotion ? 1 : 0, height: reduceMotion ? 'auto' : 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: reduceMotion ? 1 : 0, height: reduceMotion ? 'auto' : 0 }}
                          style={{ backgroundColor: colors.surface, marginTop: 6, borderRadius: 16, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}
                      >
                          {clients.map((c) => (
                              <TouchableOpacity 
                                  key={c.id} 
                                  onPress={() => { 
                                      setSelectedClient(c); 
                                      setShowClientPicker(false); 
                                      setErrors(prev => ({ ...prev, client: '' })); 
                                      loadExistingTasks(c.id);
                                  }} 
                                  style={{ padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}
                              >
                                  <BrandedAvatar size={28} name={c.full_name} imageUrl={c.avatar_url} useBrandColor={selectedClient?.id === c.id} />
                                  <Text style={{ color: colors.text, fontWeight: '500' }}>{c.full_name}</Text>
                                  {selectedClient?.id === c.id && <Check size={16} color={colors.primary} style={{ marginLeft: 'auto' }} />}
                              </TouchableOpacity>
                          ))}
                      </MotiView>
                  )}
              </AnimatePresence>
            </>
          )}
        </View>

        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <ScrollView 
            ref={scrollViewRef}
            style={{ flex: 1 }}
            contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 120 }}
            showsVerticalScrollIndicator={false}
            onTouchStart={handleBackgroundTap}
          >
            {/* Protocol Tasks Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <View>
                    <Text style={{ color: colors.text, fontSize: 20, fontWeight: 'bold' }}>Tasks</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                      {isAllClients ? 'Common tasks for all clients' : 'Define daily requirements'}
                    </Text>
                </View>
                <TouchableOpacity 
                    onPress={addTask}
                    style={{ 
                      paddingHorizontal: 14, 
                      paddingVertical: 8, 
                      backgroundColor: `${colors.primary}1a`, 
                      borderRadius: 14, 
                      borderWidth: 1, 
                      borderColor: `${colors.primary}33`, 
                      flexDirection: 'row', 
                      alignItems: 'center', 
                      gap: 6 
                    }}
                >
                    <Plus size={15} color={colors.primary} />
                    <Text style={{ color: colors.primary, fontWeight: 'bold', fontSize: 12 }}>Add Task</Text>
                </TouchableOpacity>
            </View>

            {loadingCommon ? (
                <View style={{ padding: 36, alignItems: 'center', justifyContent: 'center' }}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 10 }}>Finding common tasks...</Text>
                </View>
            ) : (
              tasks.map((task, i) => (
                <TaskCardItem 
                  key={task.clientKey}
                  task={task}
                  index={i}
                  canDelete={tasks.length > 1}
                  colors={colors}
                  reduceMotion={!!reduceMotion}
                  onRemove={removeTask}
                  onUpdate={updateTask}
                  onInputFocus={handleInputFocus}
                  onInputBlur={handleInputBlur}
                  taskInputRef={(el) => { taskNameInputRefs.current[task.clientKey] = el; }}
                />
              ))
            )}
          </ScrollView>

          {/* Action Bar: Only shown when there are valid tasks and no pending un-named task */}
          {showSaveButton && (
            <MotiView
              from={{ opacity: reduceMotion ? 1 : 0, translateY: reduceMotion ? 0 : 20 }}
              animate={{ opacity: 1, translateY: 0 }}
              exit={{ opacity: reduceMotion ? 1 : 0, translateY: reduceMotion ? 0 : 20 }}
              transition={{ type: 'timing', duration: 200 } as any}
              style={{ 
                paddingHorizontal: 16, 
                paddingVertical: 14, 
                backgroundColor: colors.background, 
                borderTopWidth: 1, 
                borderTopColor: colors.border 
              }}
            >
                <TouchableOpacity 
                  onPress={handleCreate} 
                  disabled={creating}
                  style={{ 
                      height: 54, 
                      borderRadius: 16, 
                      backgroundColor: creating ? (colors.surfaceAlt || colors.surface) : colors.primary,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      shadowColor: colors.primary,
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.2,
                      shadowRadius: 8,
                      elevation: 4
                  }}
                  activeOpacity={0.8}
                >
                  {creating ? (
                      <>
                          <ActivityIndicator color={colors.textOnPrimary || 'white'} size="small" />
                          <Text style={{ color: colors.textOnPrimary || 'white', fontWeight: 'bold', fontSize: 16 }}>Saving...</Text>
                      </>
                  ) : (
                      <>
                          <Check size={18} color={colors.textOnPrimary || 'white'} strokeWidth={2.5} />
                          <Text style={{ color: colors.textOnPrimary || 'white', fontWeight: 'bold', fontSize: 16 }}>Save Tasks</Text>
                      </>
                  )}
                </TouchableOpacity>
            </MotiView>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Toast notification */}
      {toastVisible && (
        <MotiView
          from={{ opacity: reduceMotion ? 1 : 0, translateY: reduceMotion ? 0 : 16 }}
          animate={{ opacity: 1, translateY: 0 }}
          style={{
            position: 'absolute',
            bottom: 96,
            left: 20,
            right: 20,
            backgroundColor: colors.primary,
            borderRadius: 16,
            paddingVertical: 14,
            paddingHorizontal: 18,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            shadowColor: colors.primary,
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.3,
            shadowRadius: 12,
            elevation: 8,
            zIndex: 100,
          }}
        >
          <Check size={18} color={colors.textOnPrimary || 'white'} strokeWidth={2.5} />
          <Text style={{ color: colors.textOnPrimary || 'white', fontWeight: 'bold', fontSize: 14, flex: 1 }}>
            {toastMessage}
          </Text>
        </MotiView>
      )}
    </View>
  );
}
