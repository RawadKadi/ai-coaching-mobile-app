# System Architecture

## Overview

This AI-powered coaching platform is built as a full-stack mobile application using React Native (Expo), Supabase backend, and Anthropic Claude AI. The architecture follows a multi-tenant pattern with role-based access control supporting three user types: Clients, Coaches, and Admins.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT APPLICATIONS                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Client     │  │    Coach     │  │    Admin     │      │
│  │  Mobile App  │  │  Mobile App  │  │    Panel     │      │
│  │ (React Native│  │ (React Native│  │ (React Native│      │
│  │    Expo)     │  │    Expo)     │  │  Web/Mobile) │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                  │                  │              │
│         └──────────────────┴──────────────────┘              │
│                            │                                 │
└────────────────────────────┼─────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                   AUTHENTICATION LAYER                       │
│                    (Supabase Auth)                          │
│  - JWT Token Management                                     │
│  - Session Handling                                         │
│  - Email/Password Auth                                      │
│  - OAuth Providers (Future)                                 │
└────────────────────────────┬─────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                   APPLICATION LAYER                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Supabase API Gateway                     │  │
│  │  - Request Routing                                    │  │
│  │  - Authentication Middleware                          │  │
│  │  - Rate Limiting                                      │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           Edge Functions (Deno Runtime)               │  │
│  │  ┌──────────────────────────────────────────────┐    │  │
│  │  │ 1. generate-meal-plan                        │    │  │
│  │  │    - AI meal generation                      │    │  │
│  │  │    - Nutrition calculation                   │    │  │
│  │  │    - Shopping list creation                  │    │  │
│  │  └──────────────────────────────────────────────┘    │  │
│  │  ┌──────────────────────────────────────────────┐    │  │
│  │  │ 2. generate-workout-plan                     │    │  │
│  │  │    - AI workout programming                  │    │  │
│  │  │    - Progressive overload planning           │    │  │
│  │  │    - Exercise selection                      │    │  │
│  │  └──────────────────────────────────────────────┘    │  │
│  │  ┌──────────────────────────────────────────────┐    │  │
│  │  │ 3. analyze-checkin                           │    │  │
│  │  │    - Daily check-in analysis                 │    │  │
│  │  │    - Trend identification                    │    │  │
│  │  │    - Personalized recommendations            │    │  │
│  │  └──────────────────────────────────────────────┘    │  │
│  │  ┌──────────────────────────────────────────────┐    │  │
│  │  │ 4. generate-weekly-summary                   │    │  │
│  │  │    - Weekly performance analysis             │    │  │
│  │  │    - Progress tracking                       │    │  │
│  │  │    - Goal recommendations                    │    │  │
│  │  └──────────────────────────────────────────────┘    │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────┬─────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    DATA LAYER                                │
│  ┌──────────────────────────────────────────────────────┐  │
│  │          PostgreSQL Database (Supabase)              │  │
│  │                                                       │  │
│  │  Core Tables:                                        │  │
│  │  - profiles (user data)                              │  │
│  │  - coaches (coach data)                              │  │
│  │  - clients (client data)                             │  │
│  │  - coach_client_links (relationships)                │  │
│  │  - ai_coach_brains (AI config)                       │  │
│  │                                                       │  │
│  │  Activity Tables:                                    │  │
│  │  - check_ins (daily metrics)                         │  │
│  │  - meals (nutrition logs)                            │  │
│  │  - meal_plans (AI-generated plans)                   │  │
│  │  - workouts (exercise logs)                          │  │
│  │  - workout_plans (training programs)                 │  │
│  │  - habits (habit definitions)                        │  │
│  │  - habit_logs (daily tracking)                       │  │
│  │                                                       │  │
│  │  Communication Tables:                               │  │
│  │  - messages (chat)                                   │  │
│  │  - notifications (alerts)                            │  │
│  │  - programs (training templates)                     │  │
│  │                                                       │  │
│  │  System Tables:                                      │  │
│  │  - ai_requests (usage tracking)                      │  │
│  │  - system_logs (monitoring)                          │  │
│  │  - subscriptions (billing)                           │  │
│  │  - payments (transactions)                           │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         Row Level Security (RLS) Policies             │  │
│  │  - User data isolation                                │  │
│  │  - Coach-client access control                        │  │
│  │  - Admin elevated permissions                         │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────┬─────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                 EXTERNAL SERVICES                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         Anthropic Claude API                          │  │
│  │  Model: claude-3-haiku-20240307                       │  │
│  │  - Meal plan generation                               │  │
│  │  - Workout plan generation                            │  │
│  │  - Check-in analysis                                  │  │
│  │  - Weekly summaries                                   │  │
│  │  - Motivational content                               │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Technology Stack

### Frontend
- **Framework:** React Native (Expo SDK 54)
- **Language:** TypeScript
- **State Management:** React Context API
- **Navigation:** Expo Router (file-based routing)
- **Icons:** Lucide React Native
- **Platform Support:** iOS, Android, Web

### Backend
- **Database:** PostgreSQL (Supabase)
- **API:** Supabase Client SDK
- **Edge Functions:** Deno Runtime
- **Authentication:** Supabase Auth (JWT)
- **Real-time:** Supabase Realtime
- **Storage:** Supabase Storage (for photos)

### AI Services
- **Provider:** Anthropic
- **Model:** Claude 3 Haiku
- **Use Cases:**
  - Meal planning
  - Workout programming
  - Progress analysis
  - Personalized recommendations

## Data Flow

### 1. User Authentication Flow
```
User Input (Email/Password)
    ↓
Supabase Auth
    ↓
JWT Token Generated
    ↓
Profile Creation/Fetch
    ↓
Role-Based Routing (Client/Coach/Admin)
```

### 2. AI Meal Plan Generation Flow
```
Client Request (calories, restrictions, preferences)
    ↓
Edge Function: generate-meal-plan
    ↓
Fetch Client Data (dietary info, goals)
    ↓
Anthropic API Call
    ↓
Parse AI Response (structured JSON)
    ↓
Store in meal_plans table (status: draft)
    ↓
Notify Coach (if assigned)
    ↓
Coach Reviews/Approves
    ↓
Update status to 'approved'
    ↓
Client Access to Plan
```

### 3. Daily Check-in Flow
```
Client Submits Check-in (weight, sleep, energy, etc.)
    ↓
Store in check_ins table
    ↓
Trigger Edge Function: analyze-checkin
    ↓
Fetch Recent Check-in History
    ↓
Anthropic API Analysis
    ↓
Store AI Analysis in check_ins.ai_analysis
    ↓
Display to Client
    ↓
Notify Coach
```

### 4. Coach-Client Communication Flow
```
Sender Creates Message
    ↓
Store in messages table
    ↓
Real-time Subscription Trigger
    ↓
Recipient Receives Notification
    ↓
Message Display in Chat
    ↓
Mark as Read
```

## Security Architecture

### Authentication
- JWT tokens with automatic refresh
- Secure session storage
- Token expiration handling
- Auth state persistence

### Row Level Security (RLS)
Every table has RLS policies enforcing:
- **Clients:** Can only access their own data
- **Coaches:** Can access their assigned clients' data
- **Admins:** Elevated access to all data
- **Cross-table:** Coach-client relationships validated

### Data Protection
- Encrypted data at rest (PostgreSQL)
- Encrypted data in transit (HTTPS/WSS)
- No sensitive data in client-side code
- Environment variables for secrets
- API keys stored in Edge Function environment

## Scalability Considerations

### Database
- Indexed columns for fast queries
- Partitioning strategy for large tables
- Connection pooling via Supabase
- Query optimization with EXPLAIN

### Edge Functions
- Stateless design for horizontal scaling
- Cold start optimization
- Timeout handling (max 10 minutes)
- Rate limiting per user

### AI API
- Request queuing for high load
- Caching for repeated queries
- Token usage tracking
- Cost monitoring via ai_requests table

## Performance Optimization

### Client-Side
- Lazy loading of screens
- Optimistic UI updates
- Local state for frequently accessed data
- Image optimization and caching
- Pagination for long lists

### API
- Batch requests where possible
- Select only required columns
- Use indexes for filters
- Real-time subscriptions for live updates

### AI
- Appropriate model selection (Haiku for speed)
- Structured outputs for parsing
- Prompt optimization for token efficiency
- Response streaming (where applicable)

## Monitoring and Logging

### Application Logs
- Edge Function execution logs
- Authentication events
- Database query performance
- Error tracking with stack traces

### AI Usage Tracking
- All requests logged to ai_requests table
- Token usage per request
- Cost calculation
- Response time metrics
- Success/failure rates

### System Metrics
- User activity logs
- Performance bottlenecks
- API endpoint usage
- Database connection pool status

## Deployment Strategy

### Development
```
Local Development → Expo Dev Server → Mobile Device/Simulator
                 → Hot Reload
                 → Real-time Updates
```

### Staging
```
Git Push → Supabase Preview Branch → Testing Environment
        → Edge Function Deployment
        → Database Migration
```

### Production
```
Git Push → Main Branch → Production Deployment
        → Database Migration (with rollback plan)
        → Edge Function Deployment
        → Zero-downtime updates
```

## Multi-Tenancy Model

### Coach Branding
Each coach can customize:
- Brand colors
- Logo
- Business name
- AI coaching style and tone

### Data Isolation
- Each coach's data is completely isolated
- Coaches cannot access other coaches' clients
- Clients can only belong to one coach at a time
- Admin oversight without data mixing

### Subscription Tiers
- Free tier: Limited features
- Pro tier: Full features + unlimited clients
- Enterprise: Custom features + white-label

## Future Enhancements

### Planned Features
1. **Mobile Push Notifications:** FCM/APNS integration
2. **Video Content:** Exercise demonstration videos
3. **Social Features:** Client community boards
4. **Advanced Analytics:** ML-powered insights
5. **Stripe Integration:** Payment processing
6. **Calendar Integration:** Workout scheduling
7. **Wearable Integration:** Fitbit, Apple Health sync
8. **Progress Photos:** Before/after comparisons with AI analysis

### AI Enhancements
1. Voice-based check-ins
2. Computer vision for form correction
3. Predictive analytics for goal achievement
4. Automated habit recommendations
5. Context-aware motivation timing

## Disaster Recovery

### Backup Strategy
- Automated daily database backups (Supabase)
- Point-in-time recovery capability
- Backup retention: 30 days

### Failover
- Multi-region database replication
- Edge Function redundancy
- CDN for static assets

### Data Recovery
- Transaction logs for audit trail
- Soft deletes where applicable
- Version history for critical data
