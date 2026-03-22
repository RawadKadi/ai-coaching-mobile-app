import React from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { AlertCircle, CheckCircle, Users } from 'lucide-react-native';
import { useBrandColors, useTheme } from '@/contexts/BrandContext';
import { BrandedText } from './BrandedText';

interface TerminationSuccessModalProps {
  visible: boolean;
  unassignedClients: Array<{
    id: string;
    full_name: string;
    email: string;
  }>;
  onAssignClients: () => void;
  // Intentionally no onClose prop - user MUST take action or close app
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
      animationType="slide"
      presentationStyle="pageSheet"
      // Intentionally not closing on request close (android back button)
      onRequestClose={() => {}}
    >
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <CheckCircle size={64} color={theme.colors.success} />
          </View>
          
          <BrandedText variant="xl" weight="heading" style={styles.title}>
            Sub-Coach Terminated
          </BrandedText>
          
          <BrandedText variant="base" style={StyleSheet.flatten([styles.subtitle, { color: theme.colors.textSecondary }])}>
            The sub-coach has been successfully removed from your team.
          </BrandedText>

          {unassignedClients.length > 0 && (
            <View style={[styles.warningBox, { backgroundColor: `${primary}10`, borderColor: primary }]}>
              <View style={styles.warningHeader}>
                <AlertCircle size={20} color={primary} />
                <BrandedText variant="sm" weight="600" style={{ color: primary, flex: 1, marginLeft: 8 }}>
                  Action Required
                </BrandedText>
              </View>
              <Text style={[styles.warningText, { color: theme.colors.textSecondary }]}>
                The following clients are now unassigned and require reassignment:
              </Text>
              
              <ScrollView style={styles.clientList} nestedScrollEnabled>
                {unassignedClients.map((client) => (
                  <View key={client.id} style={styles.clientItem}>
                    <Users size={16} color={primary} />
                    <Text style={[styles.clientName, { color: theme.colors.text }]}>{client.full_name}</Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          <View style={styles.spacer} />
        </View>

        <View style={[styles.footer, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border }]}>
          <TouchableOpacity
            style={[styles.assignButton, { backgroundColor: primary }]}
            onPress={onAssignClients}
          >
            <BrandedText variant="base" weight="600" style={styles.buttonText}>
              Assign Clients
            </BrandedText>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    marginBottom: 24,
  },
  title: {
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 32,
  },
  warningBox: {
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    maxHeight: 300,
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  warningText: {
    fontSize: 14,
    marginBottom: 12,
  },
  clientList: {
    maxHeight: 150,
  },
  clientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    gap: 8,
  },
  clientName: {
    fontSize: 14,
    fontWeight: '500',
  },
  spacer: {
    flex: 1,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
  },
  assignButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
  },
});
