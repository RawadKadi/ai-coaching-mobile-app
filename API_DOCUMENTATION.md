# API Documentation

## Overview

This document details all API endpoints, database queries, and Edge Functions available in the AI-Powered Coaching Platform.

## Authentication

All API requests require authentication via Supabase Auth. Include the JWT token in the Authorization header:

\`\`\`
Authorization: Bearer <jwt_token>
\`\`\`

## Edge Functions

### 1. Generate Meal Plan

**Endpoint:** \`POST /functions/v1/generate-meal-plan\`

Generates a personalized meal plan using AI based on client preferences and dietary requirements.

**Request Body:**
\`\`\`json
{
  "clientId": "uuid",
  "dailyCalories": 2000,
  "restrictions": ["gluten-free", "dairy-free"],
  "preferences": ["high-protein", "low-carb"],
  "cookingTime": "30 minutes",
  "durationDays": 7
}
\`\`\`

**Response:**
\`\`\`json
{
  "mealPlan": {
    "id": "uuid",
    "client_id": "uuid",
    "start_date": "2024-01-01",
    "end_date": "2024-01-07",
    "daily_calories": 2000,
    "meals_data": {
      "days": [
        {
          "day": 1,
          "meals": [
            {
              "type": "breakfast",
              "name": "Oatmeal with Berries",
              "calories": 400,
              "protein_g": 15,
              "carbs_g": 60,
              "fat_g": 10,
              "recipe": "Cook 1 cup oats..."
            }
          ]
        }
      ],
      "shopping_list": ["oats", "berries", "almond milk"]
    },
    "status": "draft",
    "ai_generated": true
  }
}
\`\`\`

**AI Model:** Claude 3 Haiku
**Max Tokens:** 4096
**Average Response Time:** 3-5 seconds

---

### 2. Generate Workout Plan

**Endpoint:** \`POST /functions/v1/generate-workout-plan\`

Creates a structured workout program based on client goals, experience level, and available equipment.

**Request Body:**
\`\`\`json
{
  "clientId": "uuid",
  "goal": "muscle building",
  "experienceLevel": "intermediate",
  "equipment": ["dumbbells", "barbell", "bench"],
  "durationWeeks": 12,
  "daysPerWeek": 4
}
\`\`\`

**Response:**
\`\`\`json
{
  "workoutPlan": {
    "id": "uuid",
    "client_id": "uuid",
    "name": "12-Week Muscle Building Program",
    "start_date": "2024-01-01",
    "end_date": "2024-03-24",
    "goal": "muscle building",
    "weekly_schedule": {
      "weeks": [
        {
          "week": 1,
          "focus": "Foundation Phase",
          "workouts": [
            {
              "day": "Monday",
              "name": "Upper Body Push",
              "duration_minutes": 60,
              "exercises": [
                {
                  "name": "Barbell Bench Press",
                  "sets": 4,
                  "reps": 8,
                  "rest_seconds": 90,
                  "notes": "Focus on form"
                }
              ]
            }
          ]
        }
      ]
    },
    "status": "draft",
    "ai_generated": true
  }
}
\`\`\`

**AI Model:** Claude 3 Haiku
**Max Tokens:** 4096
**Average Response Time:** 3-5 seconds

---

### 3. Analyze Check-in

**Endpoint:** \`POST /functions/v1/analyze-checkin\`

Analyzes a client's daily check-in data and provides personalized insights and recommendations.

**Request Body:**
\`\`\`json
{
  "checkInId": "uuid"
}
\`\`\`

**Response:**
\`\`\`json
{
  "analysis": "Great progress this week! Your energy levels are improving consistently, which suggests your sleep quality is getting better. I notice your weight has been stable - this is normal when building muscle. Consider increasing your protein intake slightly to support your training. Keep up the excellent work with your habit consistency!"
}
\`\`\`

**AI Model:** Claude 3 Haiku
**Max Tokens:** 512
**Average Response Time:** 1-2 seconds

---

## Database Queries

### Client Queries

#### Get Client Dashboard Data
\`\`\`typescript
const { data: todayCheckIn } = await supabase
  .from('check_ins')
  .select('*')
  .eq('client_id', clientId)
  .eq('date', today)
  .maybeSingle();

const { data: habits } = await supabase
  .from('habits')
  .select('*')
  .eq('client_id', clientId)
  .eq('is_active', true);

const { data: habitLogs } = await supabase
  .from('habit_logs')
  .select('*')
  .eq('client_id', clientId)
  .eq('date', today);
\`\`\`

#### Create Check-in
\`\`\`typescript
const { data, error } = await supabase
  .from('check_ins')
  .insert({
    client_id: clientId,
    date: today,
    weight_kg: 75.5,
    sleep_hours: 7.5,
    energy_level: 8,
    stress_level: 4,
    hunger_level: 5,
    mood: 'energized',
    notes: 'Feeling great today!'
  })
  .select()
  .single();
\`\`\`

#### Log Meal
\`\`\`typescript
const { data, error } = await supabase
  .from('meals')
  .insert({
    client_id: clientId,
    date: today,
    meal_type: 'breakfast',
    name: 'Oatmeal with Berries',
    calories: 400,
    protein_g: 15,
    carbs_g: 60,
    fat_g: 10
  })
  .select()
  .single();
\`\`\`

#### Log Workout
\`\`\`typescript
const { data, error } = await supabase
  .from('workouts')
  .insert({
    client_id: clientId,
    date: today,
    name: 'Upper Body Strength',
    duration_minutes: 60,
    exercises: [
      {
        name: 'Bench Press',
        sets: 4,
        reps: 8,
        weight: 80
      }
    ],
    completed: true
  })
  .select()
  .single();
\`\`\`

---

### Coach Queries

#### Get Coach's Clients
\`\`\`typescript
const { data: clientLinks } = await supabase
  .from('coach_client_links')
  .select('*, clients(*, profiles(*))')
  .eq('coach_id', coachId)
  .eq('status', 'active');
\`\`\`

#### Get Client's Recent Check-ins
\`\`\`typescript
const { data: checkIns } = await supabase
  .from('check_ins')
  .select('*')
  .eq('client_id', clientId)
  .order('date', { ascending: false })
  .limit(30);
\`\`\`

#### Update AI Coach Brain
\`\`\`typescript
const { data, error } = await supabase
  .from('ai_coach_brains')
  .update({
    tone: 'professional and motivating',
    style: 'supportive and educational',
    philosophy: 'Balance is key to long-term success',
    specialty_focus: 'strength training and nutrition'
  })
  .eq('coach_id', coachId);
\`\`\`

#### Approve Meal Plan
\`\`\`typescript
const { data, error } = await supabase
  .from('meal_plans')
  .update({ status: 'approved' })
  .eq('id', mealPlanId)
  .eq('coach_id', coachId);
\`\`\`

---

### Messaging Queries

#### Send Message
\`\`\`typescript
const { data, error } = await supabase
  .from('messages')
  .insert({
    sender_id: senderId,
    recipient_id: recipientId,
    content: 'Great progress this week!',
    ai_generated: false
  })
  .select()
  .single();
\`\`\`

#### Get Conversation
\`\`\`typescript
const { data: messages } = await supabase
  .from('messages')
  .select('*, sender:profiles!sender_id(*), recipient:profiles!recipient_id(*)')
  .or(\`sender_id.eq.\${userId},recipient_id.eq.\${userId}\`)
  .order('created_at', { ascending: true });
\`\`\`

#### Mark Messages as Read
\`\`\`typescript
const { error } = await supabase
  .from('messages')
  .update({ read: true })
  .eq('recipient_id', userId)
  .eq('read', false);
\`\`\`

---

## Real-time Subscriptions

### Subscribe to New Messages
\`\`\`typescript
const subscription = supabase
  .channel('messages')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: \`recipient_id=eq.\${userId}\`
    },
    (payload) => {
      console.log('New message:', payload.new);
    }
  )
  .subscribe();
\`\`\`

### Subscribe to Client Check-ins
\`\`\`typescript
const subscription = supabase
  .channel('check_ins')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'check_ins',
      filter: \`client_id=in.()\${clientIds.join(',')}\`
    },
    (payload) => {
      console.log('New check-in:', payload.new);
    }
  )
  .subscribe();
\`\`\`

---

## Error Handling

### Standard Error Response
\`\`\`json
{
  "error": "Error message description"
}
\`\`\`

### Common Error Codes
- \`401\` - Unauthorized (invalid or missing JWT)
- \`403\` - Forbidden (insufficient permissions)
- \`404\` - Not Found (resource doesn't exist)
- \`500\` - Internal Server Error

### Edge Function Errors
Edge functions return errors in the response body:
\`\`\`json
{
  "error": "Failed to generate meal plan: Invalid calorie target"
}
\`\`\`

---

## Rate Limiting

AI Edge Functions are rate-limited to prevent abuse:
- 10 requests per minute per user
- 100 requests per hour per user

Exceeded rate limits return a 429 status code.

---

## AI Request Logging

All AI requests are automatically logged to the \`ai_requests\` table:
\`\`\`typescript
{
  user_id: "uuid",
  request_type: "meal_plan_generation",
  tokens_used: 1250,
  status: "success",
  created_at: "2024-01-01T12:00:00Z"
}
\`\`\`

This enables:
- Usage tracking per user
- Cost calculation
- Performance monitoring
- Debugging and troubleshooting
