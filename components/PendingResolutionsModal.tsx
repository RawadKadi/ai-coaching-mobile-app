import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { X, Calendar, Clock, AlertTriangle, CheckCircle, Bell, MessageCircle } from 'lucide-react-native';
import { Session } from '@/types/database';

interface PendingResolutionsModalProps {
    visible: boolean;
    onClose: () => void;
    sessions: any[]; // Using any because of potential schema mismatches (e.g. invite_sent)
    onResolve: (session: any) => void;
}

export default function PendingResolutionsModal({ visible, onClose, sessions, onResolve }: PendingResolutionsModalProps) {
    if (!visible) return null;

    const getStatusInfo = (session: any) => {
        // Mock logic for status - replace with actual fields if available
        // Assumption: If 'invite_sent' is true, we notified the client.
        const isNotified = session.invite_sent || session.notification_sent;
        
        if (isNotified) {
            return {
                label: 'Pending',
                color: '#F59E0B', // Amber
                bgColor: '#FFFBEB',
                icon: <Bell size={14} color="#F59E0B" />,
                description: 'Proposal with client'
            };
        } else {
            return {
                label: 'Not Yet Sent',
                color: '#EF4444', // Red
                bgColor: '#FEF2F2',
                icon: <AlertTriangle size={14} color="#EF4444" />,
                description: 'Waiting for your proposal'
            };
        }
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.headerContent}>
                        <AlertTriangle size={24} color="#B45309" />
                        <Text style={styles.title}>Pending Resolutions</Text>
                    </View>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <X size={24} color="#374151" />
                    </TouchableOpacity>
                </View>

                {/* Subheader */}
                <View style={styles.subheader}>
                    <Text style={styles.subheaderText}>
                        {sessions.length} session{sessions.length > 1 ? 's' : ''} require your attention.
                    </Text>
                </View>

                {/* List */}
                <ScrollView style={styles.content}>
                    {sessions.map((session, index) => {
                        const status = getStatusInfo(session);
                        const date = new Date(session.scheduled_at);
                        
                        return (
                            <TouchableOpacity 
                                key={session.id || index} 
                                style={styles.card}
                                onPress={() => onResolve(session)}
                            >
                                <View style={styles.cardHeader}>
                                    <View style={styles.dateTimeContainer}>
                                        <Calendar size={14} color="#4B5563" />
                                        <Text style={styles.dateText}>
                                            {date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                                        </Text>
                                        <Text style={styles.separator}>•</Text>
                                        <Clock size={14} color="#4B5563" />
                                        <Text style={styles.timeText}>
                                            {date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                                        </Text>
                                    </View>
                                    <View style={[styles.statusBadge, { backgroundColor: status.bgColor, borderColor: status.color }]}>
                                        {status.icon}
                                        <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
                                    </View>
                                </View>

                                <View style={styles.detailsContainer}>
                                    <Text style={styles.sessionType}>{session.session_type}</Text>
                                    <Text style={styles.statusDescription}>{status.description}</Text>
                                </View>

                                {session.notes && (
                                    <View style={styles.notesContainer}>
                                        <MessageCircle size={12} color="#6B7280" />
                                        <Text style={styles.notesText} numberOfLines={1}>{session.notes}</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        );
                    })}
                    <View style={{ height: 40 }} />
                </ScrollView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
    },
    closeButton: {
        padding: 4,
    },
    subheader: {
        paddingVertical: 12,
        paddingHorizontal: 20,
        backgroundColor: '#FEF3C7',
        borderBottomWidth: 1,
        borderBottomColor: '#FCD34D',
    },
    subheaderText: {
        color: '#92400E',
        fontSize: 14,
        fontWeight: '500',
    },
    content: {
        flex: 1,
        padding: 16,
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    dateTimeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    dateText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
    },
    separator: {
        color: '#9CA3AF',
    },
    timeText: {
        fontSize: 14,
        color: '#4B5563',
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 12,
        borderWidth: 1,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
    },
    detailsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    sessionType: {
        fontSize: 14,
        fontWeight: '500',
        color: '#374151',
        textTransform: 'capitalize',
        backgroundColor: '#F3F4F6',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
    },
    statusDescription: {
        fontSize: 13,
        color: '#6B7280',
        fontStyle: 'italic',
    },
    notesContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 4,
    },
    notesText: {
        fontSize: 12,
        color: '#6B7280',
        flex: 1,
    },
});
