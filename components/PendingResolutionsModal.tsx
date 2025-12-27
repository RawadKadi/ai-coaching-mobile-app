import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { X, Calendar, Clock, AlertTriangle, CheckCircle, Bell, MessageCircle, Filter, ChevronDown, Check } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';

interface PendingResolutionsModalProps {
    visible: boolean;
    onClose: () => void;
    sessions: any[]; 
    onResolve: (session: any) => void;
}

export default function PendingResolutionsModal({ visible, onClose, sessions: initialSessions, onResolve }: PendingResolutionsModalProps) {
    const [sessions, setSessions] = useState(initialSessions);
    const [filter, setFilter] = useState<'all' | 'pending' | 'unsent'>('all');
    const [sort, setSort] = useState<'newest' | 'oldest'>('newest');

    useEffect(() => {
        setSessions(initialSessions);
    }, [initialSessions]);

    // Real-time subscription
    useEffect(() => {
        if (!visible) return;

        console.log('[PendingResolutions] Subscribing to session updates...');
        const subscription = supabase
            .channel('pending-resolutions-updates')
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'sessions',
                },
                (payload) => {
                    console.log('[PendingResolutions] Update received:', payload);
                    const updatedSession = payload.new;
                    setSessions(prev => 
                        prev.map(s => s.id === updatedSession.id ? { ...s, ...updatedSession } : s)
                    );
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(subscription);
        };
    }, [visible]);

    if (!visible) return null;

    const getStatusInfo = (session: any) => {
        // Option 2 Case: We asked an existing client to reschedule
        if (session.status === 'scheduled' && session.cancellation_reason && session.cancellation_reason.startsWith('pending_reschedule')) {
             // Check if client rejected or accepted (mock logic via cancellation_reason or separate field)
             // If they rejected, we might have updated cancellation_reason to 'reschedule_rejected'
             return {
                label: 'Pending Client',
                color: '#F59E0B', 
                bgColor: '#FFFBEB',
                icon: <Clock size={14} color="#F59E0B" />,
                description: 'Asked this client to reschedule',
                actionable: false
            };
        }
        
        if (session.cancellation_reason === 'reschedule_rejected') {
            return {
                label: 'Rejected',
                color: '#EF4444', 
                bgColor: '#FEF2F2',
                icon: <X size={14} color="#EF4444" />,
                description: 'Client rejected reschedule. TAP TO RESOLVE.',
                actionable: true
            };
        }

        // Option 1 or General Case
        const isNotified = session.invite_sent || session.notification_sent || session.status === 'proposed';
        
        if (isNotified) {
            return {
                label: 'Pending',
                color: '#F59E0B',
                bgColor: '#FFFBEB',
                icon: <Bell size={14} color="#F59E0B" />,
                description: 'Proposal with client',
                actionable: false
            };
        } else {
            return {
                label: 'Not Yet Sent',
                color: '#EF4444',
                bgColor: '#FEF2F2',
                icon: <AlertTriangle size={14} color="#EF4444" />,
                description: 'Waiting for your proposal',
                actionable: true
            };
        }
    };

    const filteredSessions = sessions
        .filter(s => {
            const status = getStatusInfo(s);
            if (filter === 'pending') return status.label === 'Pending' || status.label === 'Pending Client';
            if (filter === 'unsent') return status.label === 'Not Yet Sent' || status.label === 'Rejected';
            return true;
        })
        .sort((a, b) => {
            const dateA = new Date(a.updated_at || a.created_at).getTime();
            const dateB = new Date(b.updated_at || b.created_at).getTime();
            return sort === 'newest' ? dateB - dateA : dateA - dateB;
        });

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

                {/* Filters */}
                <View style={styles.filterBar}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
                        <TouchableOpacity 
                            style={[styles.filterChip, filter === 'all' && styles.filterChipActive]} 
                            onPress={() => setFilter('all')}
                        >
                            <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>All</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            style={[styles.filterChip, filter === 'unsent' && styles.filterChipActive]} 
                            onPress={() => setFilter('unsent')}
                        >
                            <Text style={[styles.filterText, filter === 'unsent' && styles.filterTextActive]}>Action Required</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            style={[styles.filterChip, filter === 'pending' && styles.filterChipActive]} 
                            onPress={() => setFilter('pending')}
                        >
                            <Text style={[styles.filterText, filter === 'pending' && styles.filterTextActive]}>Pending Client</Text>
                        </TouchableOpacity>
                    </ScrollView>
                    
                    <TouchableOpacity 
                        style={styles.sortButton}
                        onPress={() => setSort(prev => prev === 'newest' ? 'oldest' : 'newest')}
                    >
                        <Text style={styles.sortText}>{sort === 'newest' ? 'Newest' : 'Oldest'}</Text>
                        <ChevronDown size={14} color="#4B5563" />
                    </TouchableOpacity>
                </View>

                {/* Subheader */}
                <View style={styles.subheader}>
                    <Text style={styles.subheaderText}>
                        {filteredSessions.length} session{filteredSessions.length !== 1 ? 's' : ''} found.
                    </Text>
                </View>

                {/* List */}
                <ScrollView style={styles.content}>
                    {filteredSessions.map((session, index) => {
                        const status = getStatusInfo(session);
                        const date = new Date(session.scheduled_at);
                        const lastUpdated = new Date(session.updated_at || session.created_at);
                        
                        return (
                            <TouchableOpacity 
                                key={session.id || index} 
                                style={[styles.card, !status.actionable && styles.cardDisabled]}
                                onPress={() => {
                                    if (status.actionable) {
                                        // Open resolution
                                        onResolve(session);
                                    } else {
                                        // Maybe send reminder?
                                        Alert.alert('Send Reminder?', 'Would you like to notify the client again?', [
                                            { text: 'Cancel', style: 'cancel'},
                                            { text: 'Send', onPress: () => console.log('Send reminder') }
                                        ]);
                                    }
                                }}
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

                                <View style={styles.footerRow}>
                                     {session.notes && (
                                        <View style={styles.notesContainer}>
                                            <MessageCircle size={12} color="#6B7280" />
                                            <Text style={styles.notesText} numberOfLines={1}>{session.notes}</Text>
                                        </View>
                                    )}
                                    <Text style={styles.timestamp}>Updated {lastUpdated.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</Text>
                                </View>
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
    // Filter Styles
    filterBar: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        paddingVertical: 12,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
        gap: 12,
    },
    filterScroll: {
        gap: 8,
    },
    filterChip: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 16,
        backgroundColor: '#F3F4F6',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    filterChipActive: {
        backgroundColor: '#EFF6FF',
        borderColor: '#3B82F6',
    },
    filterText: {
        fontSize: 13,
        color: '#6B7280',
        fontWeight: '500',
    },
    filterTextActive: {
        color: '#2563EB',
        fontWeight: '600',
    },
    sortButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 16,
        gap: 4,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    sortText: {
        fontSize: 13,
        color: '#4B5563',
    },
    cardDisabled: {
        opacity: 0.8,
    },
    footerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#F9FAFB',
        paddingTop: 8,
    },
    timestamp: {
        fontSize: 11,
        color: '#9CA3AF',
        marginLeft: 'auto',
    },
});
