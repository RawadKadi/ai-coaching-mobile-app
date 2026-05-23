import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet } from 'react-native';
import { ChevronDown, Clock, Check } from 'lucide-react-native';

interface BrandedDurationPickerProps {
  value: number;
  onSelect: (value: number) => void;
  label?: string;
}

export const BrandedDurationPicker: React.FC<BrandedDurationPickerProps> = ({ value, onSelect, label = "Duration" }) => {
  const [isOpen, setIsOpen] = useState(false);
  const options = Array.from({ length: 12 }, (_, i) => i + 3); // 3-14 days

  return (
    <View>
      <Text style={styles.headerLabel}>{label}</Text>
      
      <TouchableOpacity 
        onPress={() => setIsOpen(true)}
        activeOpacity={0.8}
        style={styles.pickerButton}
      >
        <View style={styles.pickerContent}>
          <View style={styles.iconContainer}>
            <Clock size={20} color="#3B82F6" />
          </View>
          <View>
            <Text style={styles.daysText}>{value} Days</Text>
            <Text style={styles.subText}>Length</Text>
          </View>
        </View>
        <ChevronDown size={20} color="#475569" />
      </TouchableOpacity>

      <Modal
        visible={isOpen}
        transparent={true}
        animationType="fade"
      >
        <TouchableOpacity 
          activeOpacity={1} 
          onPress={() => setIsOpen(false)}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Select Duration</Text>
                <Text style={styles.modalSubtitle}>Days Range: 3-14</Text>
              </View>
              <TouchableOpacity 
                onPress={() => setIsOpen(false)}
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
                    onPress={() => {
                      onSelect(opt);
                      setIsOpen(false);
                    }}
                    style={[
                      styles.gridOption,
                      value === opt ? styles.gridOptionActive : styles.gridOptionInactive
                    ]}
                  >
                    <View style={styles.optionRow}>
                        <Text style={[
                          styles.optionText,
                          value === opt ? styles.optionTextActive : styles.optionTextInactive
                        ]}>{opt}</Text>
                        {value === opt && <Check size={14} color="white" />}
                    </View>
                    <Text style={[
                      styles.optionLabel,
                      value === opt ? styles.optionLabelActive : styles.optionLabelInactive
                    ]}>Days</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  headerLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 12,
    marginLeft: 4,
  },
  pickerButton: {
    height: 80,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 28,
    paddingHorizontal: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 8,
  },
  pickerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 40,
    height: 40,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
    marginRight: 16,
  },
  daysText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 20,
  },
  subText: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#020617',
    borderTopLeftRadius: 48,
    borderTopRightRadius: 48,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: 32,
    paddingBottom: 48,
    maxHeight: '60%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
  },
  modalSubtitle: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginTop: 4,
  },
  doneButton: {
    width: 48,
    height: 48,
    backgroundColor: '#0F172A',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  doneButtonText: {
    color: '#94A3B8',
    fontWeight: '700',
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
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  gridOptionActive: {
    backgroundColor: '#2563EB',
    borderColor: '#3B82F6',
  },
  gridOptionInactive: {
    backgroundColor: '#0F172A',
    borderColor: 'rgba(255, 255, 255, 0.05)',
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
    color: '#FFFFFF',
  },
  optionTextInactive: {
    color: '#94A3B8',
  },
  optionLabel: {
    fontSize: 8,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  optionLabelActive: {
    color: '#BFDBFE',
  },
  optionLabelInactive: {
    color: '#475569',
  },
});
