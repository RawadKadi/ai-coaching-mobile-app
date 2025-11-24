# AI-Powered Coaching Platform

A comprehensive mobile application ecosystem for coaches and clients, featuring AI-powered meal planning, workout generation, progress tracking, and personalized coaching insights.

## Overview

This platform enables coaches to manage clients, configure AI-powered coaching systems, and deliver personalized training and nutrition plans. Clients can track their progress, receive AI-generated insights, and communicate directly with their coaches.

## Features

### Client Features
- Daily check-ins with AI analysis
- Habit tracking
- Meal and workout logging
- AI-generated meal plans
- AI-generated workout plans
- Progress tracking with visual insights
- Coach messaging
- Personalized recommendations

### Coach Features
- Client management dashboard
- AI coaching brain configuration
- Approve/modify AI-generated plans
- View client progress and analytics
- Generate custom programs
- Client communication
- Performance tracking

### Admin Features
- User management
- System analytics
- AI usage monitoring
- Payment management
- System logs and monitoring

## Tech Stack

- **Frontend:** React Native (Expo SDK 54)
- **Backend:** Supabase (PostgreSQL + Edge Functions)
- **AI:** Anthropic Claude 3 Haiku
- **Authentication:** Supabase Auth
- **Real-time:** Supabase Realtime
- **Storage:** Supabase Storage

## Database Schema

### Core Tables
- `profiles` - Extended user information
- `coaches` - Coach-specific data
- `clients` - Client-specific data
- `coach_client_links` - Many-to-many coach-client relationships
- `ai_coach_brains` - AI configuration per coach

### Activity Tables
- `check_ins` - Daily client check-ins
- `meals` - Meal logs
- `meal_plans` - AI-generated meal plans
- `workouts` - Workout logs
- `workout_plans` - AI-generated workout plans
- `habits` - Habit definitions
- `habit_logs` - Daily habit tracking

### Communication Tables
- `messages` - Coach-client messaging
- `notifications` - In-app notifications
- `programs` - Multi-week training programs

### System Tables
- `ai_requests` - AI API call logging
- `system_logs` - System event logs
- `subscriptions` - Coach subscriptions
- `payments` - Payment history

## Setup Instructions

### Prerequisites
- Node.js 18+ installed
- Supabase account
- Anthropic API key

### 1. Clone and Install

\`\`\`bash
npm install
\`\`\`

### 2. Environment Configuration

Create a \`.env\` file in the project root:

\`\`\`env
# Supabase Configuration
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
\`\`\`

### 3. Supabase Setup

The database migrations have already been applied to your Supabase instance. The following tables are ready:
- User profiles and role management
- Coach and client data structures
- Activity tracking (check-ins, meals, workouts)
- Communication systems
- AI request logging

### 4. Anthropic API Key Configuration

The Edge Functions require an Anthropic API key. This is automatically configured in your Supabase project.

### 5. Run the Application

\`\`\`bash
npm run dev
\`\`\`

This will start the Expo development server. You can:
- Press \`w\` to open in web browser
- Scan QR code with Expo Go app (iOS/Android)
- Press \`i\` for iOS simulator
- Press \`a\` for Android emulator

## AI Edge Functions

Three Edge Functions have been deployed:

### 1. Generate Meal Plan
**Endpoint:** \`/functions/v1/generate-meal-plan\`

Generates personalized meal plans based on client preferences and restrictions.

**Request:**
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

### 2. Generate Workout Plan
**Endpoint:** \`/functions/v1/generate-workout-plan\`

Creates structured workout programs based on goals and available equipment.

**Request:**
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

### 3. Analyze Check-in
**Endpoint:** \`/functions/v1/analyze-checkin\`

Analyzes daily check-ins and provides personalized insights.

**Request:**
\`\`\`json
{
  "checkInId": "uuid"
}
\`\`\`

## User Roles and Navigation

### Client Flow
1. Sign up as client
2. Complete profile setup
3. Access client dashboard with tabs:
   - Dashboard: Daily overview and quick actions
   - Activity: Meal and workout tracking
   - Messages: Coach communication
   - Profile: Settings and account management

### Coach Flow
1. Sign up as coach
2. Configure AI coaching brain
3. Access coach dashboard with tabs:
   - Dashboard: Client overview and statistics
   - Clients: Client management
   - AI Brain: Configure AI personality and rules
   - Profile: Settings and account management

### Admin Flow
1. Admin access (configured in database)
2. Access admin panel with tabs:
   - Dashboard: System overview
   - Users: User management
   - Analytics: Platform analytics
   - Profile: Account settings

## Security

### Row Level Security (RLS)
All tables have RLS enabled with policies ensuring:
- Users can only access their own data
- Coaches can view their clients' data
- Clients can view their coaches' data
- Admins have elevated access
- AI-generated content requires coach approval

### Authentication
- JWT-based session management
- Secure password hashing
- Email/password authentication
- Optional OAuth providers

## Development Guidelines

### Adding New Features
1. Update database schema with migrations
2. Create/update Edge Functions for AI features
3. Implement UI components
4. Add appropriate RLS policies
5. Test across user roles

### Code Organization
- \`/app\` - Screen routes and layouts
- \`/contexts\` - React contexts (Auth, etc.)
- \`/lib\` - Utility functions and configs
- \`/types\` - TypeScript type definitions
- \`/supabase/functions\` - Edge Functions

## API Integration Example

\`\`\`typescript
import { supabase } from '@/lib/supabase';

// Call AI meal plan generator
const generateMealPlan = async (clientId: string) => {
  const { data, error } = await supabase.functions.invoke('generate-meal-plan', {
    body: {
      clientId,
      dailyCalories: 2000,
      restrictions: ['vegetarian'],
      preferences: ['high-protein'],
      durationDays: 7,
    },
  });

  return data;
};
\`\`\`

## Deployment

### Web Deployment
\`\`\`bash
npm run build:web
\`\`\`

### Mobile Build
For iOS and Android builds, you'll need to:
1. Set up EAS Build
2. Configure app credentials
3. Run \`eas build\`

## Support and Documentation

For issues or questions:
1. Check Supabase logs in the dashboard
2. Review Edge Function logs
3. Check client-side console for errors

## License

Proprietary - All rights reserved
