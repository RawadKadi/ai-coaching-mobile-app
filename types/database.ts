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
    logo_url?: string;
    is_active: boolean;
    subscription_tier: string;
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
    date: string;
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
