/**
 * Conflict Resolution Type Definitions
 * Defines the structure for handling scheduling conflicts
 */

export type ConflictType = 'overlap' | 'limit';

export interface ConflictingSession {
    id: string;
    client_id: string;
    client_name?: string;
    scheduled_at: string;
    duration_minutes: number;
    session_type: string;
}

export interface ConflictInfo {
    type: ConflictType;
    message: string;
    existingSession: ConflictingSession;
    proposedSession: {
        client_id: string;
        client_name: string;
        scheduled_at: string;
        duration_minutes: number;
        session_type: string;
    };
    recommendations?: TimeSlotRecommendation[];
}

export interface TimeSlotRecommendation {
    time: string; // ISO string
    label: string; // e.g., "Next available slot today", "Same time tomorrow"
    reason: string;
    priority: 'high' | 'medium' | 'low';
}

export type ResolutionAction =
    | 'keep_existing_reschedule_new'
    | 'reschedule_existing'
    | 'cancel';

export interface Resolution {
    action: ResolutionAction;
    newTime?: string; // ISO string for the rescheduled session
    targetSessionId?: string; // Which session to reschedule (if rescheduling existing)
}
