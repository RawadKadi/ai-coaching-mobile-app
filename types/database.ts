export type UserRole = 'client' | 'coach' | 'admin';
export type LinkStatus = 'active' | 'inactive' | 'pending';
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type PlanStatus = 'draft' | 'approved' | 'active' | 'completed';
export type LogLevel = 'info' | 'warning' | 'error';
export type SubscriptionStatus = 'active' | 'canceled' | 'expired' | 'trialing';
export type PaymentStatus = 'pending' | 'succeeded' | 'failed' | 'refunded';

export interface Profile {
    id: string;
    role: UserRole;
    full_name: string;
    phone?: string;
    avatar_url?: string;
    timezone: string;
    onboarding_completed: boolean;
    created_at: string;
    updated_at: string;
}

export interface Coach {
    id: string;
    user_id: string;
    business_name?: string;
    specialty?: string;
    bio?: string;
    brand_color: string;
    logo_url?: string | null;
    is_active: boolean;
    subscription_tier: string;
    meeting_link?: string | null;
    created_at: string;
    updated_at: string;
}

export interface Client {
    id: string;
    user_id: string;
    date_of_birth?: string;
    gender?: string;
    height_cm?: number;
    goal?: string;
    experience_level?: string;
    dietary_restrictions: string[];
    medical_conditions: string[];
    created_at: string;
    updated_at: string;
}

export interface CoachClientLink {
    id: string;
    coach_id: string;
    client_id: string;
    status: LinkStatus;
    started_at: string;
    ended_at?: string;
    created_at: string;
}

export interface AICoachBrain {
    id: string;
    coach_id: string;
    tone: string;
    style: string;
    philosophy?: string;
    rules: string[];
    forbidden_advice: string[];
    specialty_focus?: string;
    system_prompt?: string;
    created_at: string;
    updated_at: string;
}

export interface CheckIn {
    id: string;
    client_id: string;
    date: string;
    weight_kg?: number;
    sleep_hours?: number;
    energy_level?: number;
    stress_level?: number;
    hunger_level?: number;
    mood?: string;
    notes?: string;
    photo_urls: string[];
    ai_analysis?: string;
    created_at: string;
}

export interface Meal {
    id: string;
    client_id: string;
    meal_date: string;
    meal_type: MealType;
    name: string;
    description?: string;
    calories?: number;
    protein_g?: number;
    carbs_g?: number;
    fat_g?: number;
    photo_url?: string;
    created_at: string;
}

export interface MealPlan {
    id: string;
    client_id: string;
    coach_id?: string;
    start_date: string;
    end_date: string;
    daily_calories?: number;
    meals_data: Record<string, any>;
    shopping_list: string[];
    restrictions: string[];
    preferences: string[];
    status: PlanStatus;
    ai_generated: boolean;
    created_at: string;
    updated_at: string;
}

export interface Session {
    id: string;
    client_id: string;
    coach_id: string;
    scheduled_at: string;
    duration_minutes: number;
    status: 'proposed' | 'scheduled' | 'completed' | 'cancelled';
    session_type: 'training' | 'nutrition' | 'check_in' | 'consultation' | 'other';
    notes?: string;
    meet_link?: string;
    is_locked: boolean;
    invite_sent?: boolean;
    cancellation_reason?: string;
    ai_generated: boolean;
    created_at: string;
}

export interface Workout {
    id: string;
    client_id: string;
    date: string;
    workout_plan_id?: string;
    name: string;
    duration_minutes?: number;
    exercises: Exercise[];
    notes?: string;
    completed: boolean;
    created_at: string;
}

export interface Exercise {
    name: string;
    sets?: number;
    reps?: number;
    weight?: number;
    duration_seconds?: number;
    notes?: string;
}

export interface WorkoutPlan {
    id: string;
    client_id: string;
    coach_id?: string;
    name: string;
    start_date: string;
    end_date: string;
    goal?: string;
    experience_level?: string;
    equipment: string[];
    weekly_schedule: Record<string, any>;
    status: PlanStatus;
    ai_generated: boolean;
    created_at: string;
    updated_at: string;
}

export interface Habit {
    id: string;
    client_id: string;
    name: string;
    description?: string;
    target_value?: number;
    unit?: string;
    frequency: string;
    verification_type?: string;
    is_active: boolean;
    created_at: string;
}

export interface HabitLog {
    id: string;
    habit_id: string;
    client_id: string;
    date: string;
    value?: number;
    completed: boolean;
    notes?: string;
    proof_url?: string;
    created_at: string;
}

export interface Message {
    id: string;
    sender_id: string;
    recipient_id: string;
    content: string;
    read: boolean;
    ai_generated: boolean;
    created_at: string;
}

export interface Notification {
    id: string;
    user_id: string;
    title: string;
    message: string;
    type: string;
    read: boolean;
    action_url?: string;
    created_at: string;
}

export interface Program {
    id: string;
    coach_id: string;
    name: string;
    description?: string;
    duration_weeks: number;
    program_data: Record<string, any>;
    is_template: boolean;
    ai_generated: boolean;
    created_at: string;
    updated_at: string;
}

export interface AIRequest {
    id: string;
    user_id?: string;
    request_type: string;
    prompt?: string;
    response?: string;
    tokens_used?: number;
    cost?: number;
    status: string;
    error_message?: string;
    created_at: string;
}

// =====================================================
// AI-Powered Nutrition Tracking Types
// =====================================================

export interface MealEntry {
    id: string;
    client_id: string;

    // Meal Metadata
    meal_date: string;
    meal_time: string;
    meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
    meal_name: string;
    description?: string;

    // Image Data
    photo_url?: string;

    // Macronutrients
    calories?: number;
    protein_g?: number;
    carbs_g?: number;
    fat_g?: number;
    fiber_g?: number;
    sugar_g?: number;

    // Micronutrients
    sodium_mg?: number;
    potassium_mg?: number;
    calcium_mg?: number;
    iron_mg?: number;
    vitamin_a_ug?: number;
    vitamin_c_mg?: number;
    vitamin_d_ug?: number;

    // Cooking Details
    cooking_method?: string;
    portion_size?: string;

    // AI Analysis
    ai_analyzed: boolean;
    ai_confidence?: number;
    ai_notes?: string;

    // User Modifications
    user_modified: boolean;

    // Sharing
    shared_with_coach: boolean;
    shared_at?: string;

    // Timestamps
    created_at: string;
    updated_at: string;
}

export interface MealIngredient {
    id: string;
    meal_id: string;

    // Ingredient Details
    ingredient_name: string;
    quantity?: number;
    unit?: string;

    // Nutritional Contribution
    calories?: number;
    protein_g?: number;
    carbs_g?: number;
    fat_g?: number;

    // AI Detection
    ai_detected: boolean;
    confidence?: number;

    created_at: string;
}

export interface DailyNutritionSummary {
    id: string;
    client_id: string;
    summary_date: string;

    // Daily Totals
    total_calories: number;
    total_protein_g: number;
    total_carbs_g: number;
    total_fat_g: number;
    total_fiber_g: number;

    // Meal Counts
    meals_logged: number;

    // Activity
    active_minutes: number;
    calories_burned: number;

    // Net Calculations
    net_calories: number;

    created_at: string;
    updated_at: string;
}

export interface ClientSettings {
    id: string;
    client_id: string;

    // AI Challenge Settings
    auto_generate_challenges: boolean;
    challenge_difficulty: 'easy' | 'moderate' | 'hard';

    // Nutrition Preferences
    default_cuisine_type: string;
    meal_photo_required: boolean;

    // Privacy
    auto_share_meals: boolean;

    created_at: string;
    updated_at: string;
}

// =====================================================
// AI-Assisted Challenges System Types
// =====================================================

export type ChallengeStatus = 'draft' | 'suggested' | 'active' | 'completed' | 'cancelled';
export type ChallengeCreator = 'coach' | 'ai';
export type ChallengeFocusType = 'training' | 'nutrition' | 'recovery' | 'consistency';
export type SuggestionStatus = 'pending' | 'approved' | 'dismissed' | 'expired';
export type ChallengeIntensity = 'light' | 'moderate' | 'intense';

export interface Challenge {
    id: string;

    // Ownership
    client_id: string;
    coach_id: string;

    // Challenge Definition
    name: string;
    description?: string;
    focus_type: ChallengeFocusType;
    duration_days: number; // 3-14
    rules: string[];

    // Scheduling
    start_date: string;
    end_date: string; // Computed: start_date + duration_days

    // Status & Workflow
    status: ChallengeStatus;
    created_by: ChallengeCreator;
    approved_by?: string;
    approved_at?: string;

    // AI Context
    trigger_reason?: string;
    ai_metadata: Record<string, any>;

    // Audit
    created_at: string;
    updated_at: string;
}

export interface ChallengeProgress {
    id: string;
    challenge_id: string;

    // Daily Tracking
    date: string;
    completed: boolean;
    notes?: string;
    proof_url?: string;

    // Audit
    created_at: string;
}

export interface AISuggestion {
    id: string;

    // Ownership
    client_id: string;
    coach_id: string;

    // Suggestion Payload
    challenge_payload: {
        name: string;
        description: string;
        focus_type: ChallengeFocusType;
        duration_days: number;
        rules: string[];
        reasoning: string;
        expected_impact: 'high' | 'medium' | 'low';
        intensity: ChallengeIntensity;
    };
    trigger_reason: string;
    trigger_data: Record<string, any>;

    // Priority & Status
    priority: number; // 1-5
    status: SuggestionStatus;

    // Expiration
    expires_at: string;

    // Audit
    created_at: string;
    reviewed_at?: string;
    reviewed_by?: string;
}

export interface ChallengeWithProgress extends Challenge {
    progress: ChallengeProgress[];
    completion_rate?: number;
}

// Enhanced AI Coach Brain with Challenge Settings
export interface AICoachBrainEnhanced extends AICoachBrain {
    training_style?: string;
    forbidden_methods?: string[];
    nutrition_philosophy?: string;
    max_challenge_duration?: number; // 3-14
    preferred_intensity?: ChallengeIntensity;
    allowed_challenge_types?: ChallengeFocusType[];
    challenge_tone?: string;
}

