export interface TimeSlotRecommendation {
    time: string;
    label: string;
    reason: string;
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
