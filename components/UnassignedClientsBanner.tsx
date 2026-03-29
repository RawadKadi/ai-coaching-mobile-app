import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { AlertTriangle, ChevronRight } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export function UnassignedClientsBanner({ router }: { router: ReturnType<typeof useRouter> }) {
  const { coach } = useAuth();
  const [unassignedCount, setUnassignedCount] = useState(0);

  const checkUnassigned = async () => {
    if (!coach?.id) return;
    try {
      const { data, error } = await supabase.rpc('get_unassigned_clients', {
        p_main_coach_id: coach.id
      });
      if (error) throw error;
      setUnassignedCount((data || []).length);
    } catch (err) {
      console.error('Failed to check unassigned clients:', err);
    }
  };

  useEffect(() => {
    checkUnassigned();
  }, [coach?.id]);

  if (unassignedCount === 0) return null;

  return (
    <TouchableOpacity
      style={styles.banner}
      onPress={() => {
        requestAnimationFrame(() => {
          try {
            router.push('/(coach)/team/reassign');
          } catch (e) {
            console.error('[UnassignedClientsBanner] Navigation failed', e);
          }
        });
      }}
    >
      <View style={styles.content}>
        <AlertTriangle size={20} color="#B45309" />
        <Text style={styles.text}>
          Action Required: {unassignedCount} client{unassignedCount !== 1 ? 's are' : ' is'} unassigned
        </Text>
      </View>
      <ChevronRight size={20} color="#B45309" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#FFFBEB',
    borderBottomWidth: 1,
    borderBottomColor: '#FCD34D',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  text: {
    color: '#92400E',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
});
