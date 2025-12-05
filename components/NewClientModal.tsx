import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { PartyPopper, Calendar, X } from 'lucide-react-native';

interface NewClientModalProps {
    visible: boolean;
    clientName: string;
    onSetupSessions: () => void;
    onDismiss: () => void;
}

export default function NewClientModal({ visible, clientName, onSetupSessions, onDismiss }: NewClientModalProps) {
    return (
        <Modal
            visible={visible}
            animationType="fade"
            transparent
            onRequestClose={onDismiss}
        >
            <View style={styles.overlay}>
                <View style={styles.modal}>
                    <TouchableOpacity style={styles.closeButton} onPress={onDismiss}>
                        <X size={24} color="#6B7280" />
                    </TouchableOpacity>

                    <View style={styles.iconContainer}>
                        <PartyPopper size={48} color="#10B981" />
                    </View>

                    <Text style={styles.title}>Congratulations!</Text>
                    <Text style={styles.message}>
                        A new client <Text style={styles.highlight}>{clientName}</Text> has signed up!
                    </Text>
                    <Text style={styles.subtitle}>
                        Set up their weekly sessions now to get started on their fitness journey.
                    </Text>

                    <View style={styles.buttons}>
                        <TouchableOpacity style={styles.primaryButton} onPress={onSetupSessions}>
                            <Calendar size={20} color="#FFFFFF" />
                            <Text style={styles.primaryButtonText}>Set Sessions Now</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.secondaryButton} onPress={onDismiss}>
                            <Text style={styles.secondaryButtonText}>Later</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    modal: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 32,
        width: '100%',
        maxWidth: 400,
        alignItems: 'center',
    },
    closeButton: {
        position: 'absolute',
        top: 16,
        right: 16,
        padding: 8,
    },
    iconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#ECFDF5',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 12,
    },
    message: {
        fontSize: 16,
        color: '#4B5563',
        textAlign: 'center',
        marginBottom: 8,
    },
    highlight: {
        fontWeight: '700',
        color: '#3B82F6',
    },
    subtitle: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
        marginBottom: 24,
    },
    buttons: {
        width: '100%',
        gap: 12,
    },
    primaryButton: {
        flexDirection: 'row',
        backgroundColor: '#3B82F6',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    primaryButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    secondaryButton: {
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    secondaryButtonText: {
        color: '#374151',
        fontSize: 16,
        fontWeight: '600',
    },
});
