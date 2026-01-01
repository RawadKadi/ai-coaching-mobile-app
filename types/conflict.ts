export interface TimeSlotRecommendation {
    time: string;
    label: string;
    reason: string;
    priority?: 'high' | 'medium' | 'low';
}

export interface ConflictInfo {
    type: string;
    message: string;
    existingSession: {
        id: string;
        client_id: string;
        client_name: string;
        scheduled_at: string;
        duration_minutes: number;
        session_type: string;
        recurrence?: 'weekly' | 'once';
    };
    proposedSession: {
        client_id: string;
        client_name: string;
        scheduled_at: string;
        duration_minutes: number;
        session_type: string;
        recurrence?: 'weekly' | 'once';
        day_of_week?: string;
    };
    recommendations: TimeSlotRecommendation[];
}

export interface Resolution {
    action: 'cancel' | 'propose_new_time_for_incoming' | 'propose_reschedule_for_existing';
    proposedSlots?: string[];
    targetSessionId?: string;
}

export interface RescheduleMessageMetadata {
    type: 'reschedule_proposal';
    sessionId: string | null;
    originalTime: string;
    availableSlots?: string[];
    proposedSlots?: string[];
    status?: 'pending' | 'accepted' | 'declined';
    acceptedSlot?: string;
    mode?: 'select_time' | 'open_calendar' | 'confirm_reschedule' | 'time_picker';
    text?: string;
    recurrence?: 'weekly' | 'once';
    dayOfWeek?: string;
    proposedSessionData?: {
        client_id: string;
        duration_minutes: number;
        session_type: string;
        coach_id: string;
    };
}
