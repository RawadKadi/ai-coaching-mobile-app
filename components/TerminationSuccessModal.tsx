import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { AlertCircle, CheckCircle, Users, ArrowRight, Shield } from 'lucide-react-native';
import { MotiView, AnimatePresence } from 'moti';
import { useBrandColors, useTheme } from '@/contexts/BrandContext';

interface TerminationSuccessModalProps {
  visible: boolean;
  unassignedClients: Array<{
    id: string;
    full_name: string;
    email: string;
  }>;
  onAssignClients: () => void;
}

export function TerminationSuccessModal({
  visible,
  unassignedClients,
  onAssignClients,
}: TerminationSuccessModalProps) {
  const { primary } = useBrandColors();
  const theme = useTheme();

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={() => {}}
    >
      <View className="flex-1 bg-slate-950/90 items-center justify-center p-6">
        <MotiView
          from={{ opacity: 0, scale: 0.9, translateY: 20 }}
          animate={{ opacity: 1, scale: 1, translateY: 0 }}
          className="w-full max-w-md bg-slate-900 rounded-[48px] border border-white/10 p-10 items-center shadow-2xl"
        >
          <MotiView
            from={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', delay: 200 }}
            className="w-24 h-24 rounded-[36px] bg-emerald-500/10 items-center justify-center border-4 border-emerald-500 mb-8"
          >
            <CheckCircle size={48} color="#10B981" strokeWidth={2.5} />
          </MotiView>
          
          <Text className="text-white text-3xl font-black text-center tracking-tighter mb-4">
            Deployment Terminated
          </Text>
          
          <Text className="text-slate-400 text-center font-medium leading-5 mb-10 px-4">
            The sub-coach has been successfully decoupled from your brand ecosystem.
          </Text>

          {unassignedClients.length > 0 && (
            <MotiView 
                from={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 400 }}
                className="w-full bg-amber-500/10 rounded-[32px] border border-amber-500/20 p-6 mb-10"
            >
              <View className="flex-row items-center gap-3 mb-4">
                <AlertCircle size={20} color="#F59E0B" />
                <Text className="text-amber-500 text-xs font-black uppercase tracking-widest flex-1">
                    Neural Re-Routing Required
                </Text>
              </View>
              
              <Text className="text-slate-400 text-xs font-medium mb-4">
                These athletes are currently floating without a strategic lead:
              </Text>
              
              <ScrollView 
                className="max-h-40" 
                nestedScrollEnabled 
                showsVerticalScrollIndicator={false}
              >
                {unassignedClients.map((client, index) => (
                  <View key={client.id} className="flex-row items-center gap-3 py-2 border-b border-white/5 last:border-b-0">
                    <View className="w-1 h-1 rounded-full bg-amber-500" />
                    <Text className="text-white font-bold text-sm tracking-tight flex-1">{client.full_name}</Text>
                    <ArrowRight size={14} color="#334155" />
                  </View>
                ))}
              </ScrollView>
            </MotiView>
          )}

          <TouchableOpacity
            style={{ width: '100%' }}
            onPress={onAssignClients}
            className="h-18 bg-blue-600 rounded-[24px] flex-row items-center justify-center gap-3 shadow-2xl shadow-blue-500/40 border border-white/10"
          >
            <Users size={20} color="white" strokeWidth={2.5} />
            <Text className="text-white font-black text-lg tracking-tight">
               Reassign Roster Now
            </Text>
          </TouchableOpacity>
        </MotiView>
      </View>
    </Modal>
  );
}
