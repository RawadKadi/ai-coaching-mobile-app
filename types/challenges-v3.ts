// =====================================================
// CHALLENGES V3 - Mother + Sub-Challenges Types
// =====================================================

export type V3ChallengeStatus = 'active' | 'completed' | 'cancelled' | 'skipped';
export type V3ChallengeCreator = 'coach' | 'ai';
export type V3ChallengeFocusType = 'training' | 'nutrition' | 'recovery' | 'consistency';
export type V3ChallengeIntensity = 'low' | 'medium' | 'high';

// Mother Challenge (Container/Phase)
export interface MotherChallenge {
    id: string;
    coach_id: string;
    client_id: string;

    // Phase Info
    name: string;  // "Weekly Wellness Challenge"
    description?: string;

    // Duration
    start_date: string;
    end_date: string;
    duration_days: number;

    // Status
    status: V3ChallengeStatus;
    created_by: V3ChallengeCreator;

    // AI Context
    trigger_reason?: string;
    ai_reasoning?: string;

    created_at: string;
    updated_at: string;
}

// Sub-Challenge (Daily Task)
export interface SubChallenge {
    id: string;
    mother_challenge_id: string;

    // Daily Assignment
    assigned_date: string;  // Specific day

    // Task Details
    name: string;  // "Eat 3 servings of vegetables today"
    description?: string;
    focus_type: V3ChallengeFocusType;
    intensity: V3ChallengeIntensity;

    // Completion
    completed: boolean;
    completed_at?: string;
    notes?: string;
    proof_image_url?: string;

    created_at: string;
    updated_at: string;
}

// Mother Challenge with Sub-Challenges and Progress
export interface MotherChallengeWithProgress extends MotherChallenge {
    total_subs: number;
    completed_subs: number;
    completion_rate: number;
    sub_challenges?: SubChallenge[];
    client_name?: string;
}

// Today's Sub-Challenge (with mother context)
export interface TodaysSubChallenge extends SubChallenge {
    mother_name: string;
    created_by: V3ChallengeCreator;
}
