# 🏋️ AI COACHING MOBILE APP - COMPLETE PROJECT DOCUMENTATION

## 📋 PROJECT OVERVIEW

This is a **comprehensive fitness coaching mobile application** that connects personal trainers (coaches) with their clients through an AI-enhanced platform. The app facilitates remote coaching with real-time communication, structured challenges, session scheduling, nutrition tracking, and progress monitoring.

---

## 👥 USER ROLES

The system has **three distinct user types**:

1. **CLIENT** - People seeking fitness coaching and guidance
2. **COACH** - Personal trainers managing multiple clients
3. **ADMIN** - System administrators with oversight capabilities

---

## 🚀 ACCOUNT CREATION & AUTHENTICATION

### **Sign Up Flow**

**How it works:**

1. **New User Arrives** → Sees a signup screen
2. **Chooses Role** → Toggles between "I'm a Client" or "I'm a Coach"
3. **Fills Information:**
   - Full Name
   - Email Address (validated for correct format)
   - Password (minimum 6 characters)
   - Password Confirmation
4. **Submits Form** → System validates:
   - Email format is correct (user@example.com)
   - Passwords match
   - All fields are filled
5. **Account Created:**
   - **Auth user** created in Supabase
   - **Profile** created with name and role
   - **Client record** created (if client) OR **Coach record** + **AI Brain** created (if coach)
6. **Automatic Login** → User is signed in immediately
7. **Redirect:**
   - **Clients** → Onboarding flow
   - **Coaches** → Dashboard directly

### **Sign In Flow**

**Returning users:**
1. Enter email and password
2. System validates credentials
3. Redirects based on role and onboarding status

---

## 📱 CLIENT FEATURES & JOURNEY

### **1. ONBOARDING PROCESS**

**First-time clients go through a comprehensive setup:**

**Step 1: Personal Information**
- Date of Birth
- Gender

**Step 2: Physical Stats**
- Height (in cm)
- Current Weight (in kg)

**Step 3: Goals & Experience**
- Fitness Goal (e.g., "Lose 10kg", "Build muscle", "Improve endurance")
- Experience Level (Beginner, Intermediate, Advanced)

**Step 4: Health Information**
- Dietary Restrictions (e.g., "Vegetarian", "Gluten-free", "No dairy")
- Medical Conditions (e.g., "Knee injury", "High blood pressure")

**Step 5: Coach Assignment**
- System shows available coaches
- Client selects their preferred coach
- Coach-client link is created

**After Onboarding:**
- Client is marked as "onboarding_completed"
- Gets access to full dashboard

---

### **2. CLIENT DASHBOARD (Home Tab)**

**What the client sees:**

**Welcome Section:**
- Personalized greeting: "Hi, [Client Name]!"
- Current date
- Motivational quote or message

**Today's Challenges Card:**
- Shows daily tasks from active challenges
- Each task displays:
  - Challenge name
  - Task description
  - Checkbox to mark complete
  - Focus type icon (💪 training, 🥗 nutrition, 😴 recovery, 🎯 consistency)
- Real-time progress tracking
- Completion confetti animation when tasks are done

**Quick Actions:**
- "Log Meal" button
- "Start Workout" button
- "Message Coach" button

**Recent Activity Feed:**
- Latest check-ins
- Completed challenges
- Upcoming sessions

---

### **3. MESSAGING SYSTEM (Messages Tab)**

**Client View:**

**Conversation Screen:**
- Shows their coach's profile
- Real-time chat interface
- Message history with timestamps

**Message Types:**
1. **Regular Text Messages**
   - Client and coach exchange messages
   - Read receipts (✓ = sent, ✓✓ = read)
   - "NEW Messages" separator shows unread count

2. **Session Invites**
   - Coach sends session invitation
   - Shows: Date, Time, Duration
   - Client can:
     - **Accept** → Session confirmed
     - **Propose Alternative Time** → Starts negotiation
     - **Decline** → Session cancelled

3. **Meal Logs**
   - Displayed as rich cards in chat
   - Shows: Photo, meal name, ingredients, nutritional info

4. **Reschedule Proposals**
   - When either party proposes a new time
   - Shows proposed date/time
   - Accept or reject buttons

**Real-Time Features:**
- Messages appear instantly without refresh
- Unread count updates live
- "NEW" separator persists until screen is left
- Auto-scrolls to bottom on new messages

**Message Features:**
- Scroll-to-bottom button (appears when scrolled up)
- Shows unread count on button
- Optimistic updates (messages appear instantly before server confirms)

---

### **4. SESSION MANAGEMENT**

**How Sessions Work:**

**Scenario 1: Coach Invites Client**

1. **Coach sends session invite** via chat
   - Date: January 15, 2026
   - Time: 10:00 AM
   - Duration: 1 hour
   - Meet Link: Auto-generated Jitsi video link

2. **Client receives invite** in messages
   - Sees all session details
   - Has 3 options:
     - ✅ **Accept**
     - 🔄 **Propose Alternative Time**
     - ❌ **Decline**

3. **If Client Accepts:**
   - Session status → "Scheduled"
   - Both parties see it in their calendars
   - Meet link becomes active
   - Chat shows "Session Confirmed ✅"

4. **If Client Proposes Alternative:**
   - Selects different date/time
   - Coach receives reschedule proposal
   - Coach can accept or reject
   - Status: "Pending Reschedule"

**Scenario 2: Session Day Arrives**

**Client Experience:**
1. **Before Coach Joins:**
   - "Join Call" button is **disabled**
   - Shows message: "Waiting for coach to start the session..."
   - Coach must join first (safety feature)

2. **After Coach Joins:**
   - "Join Call" button becomes **active** (turns green)
   - Client can click to join video call
   - Opens Jitsi Meet in browser/app

3. **During Session:**
   - Both in video call
   - Can share screen
   - Can chat in video
   - Session tracked as "In Progress"

4. **After Session:**
   - Status → "Completed"
   - Both can leave feedback
   - Session logged in history

---

### **5. CHALLENGE SYSTEM (CLIENT VIEW)**

**What are Challenges?**
- Structured multi-day programs created by coaches
- Each challenge has daily tasks (sub-challenges)
- Designed to build habits and achieve specific goals

**How it Works:**

**Example: "7-Day Hydration Challenge"**

**Day 1:**
- Task: "Drink 8 glasses of water"
- Description: "Track your water intake throughout the day"
- Focus: Recovery 😴
- Intensity: Light
- **Client Action:** Checks off when complete

**Day 2:**
- Task: "Drink 10 glasses of water"
- Focus: Recovery 😴
- Intensity: Moderate

**... through Day 7**

**Client Dashboard Shows:**
- Challenge name
- Progress: "5/7 tasks completed"
- Completion rate: "71%"
- Status: "Active"
- Progress bar visualization

**When Client Completes a Task:**
1. Taps checkbox
2. ✅ Task marked complete
3. Progress bar updates
4. Completion rate recalculates
5. If all tasks done → **Completion confetti animation!** 🎉

---

### **6. MEAL LOGGING**

**How Clients Log Meals:**

**Option 1: AI-Powered Quick Log**

1. **Client clicks "Log Meal"**
2. **Takes or selects photo** of meal
3. **AI analyzes image** using Google Gemini Vision
4. **Automatically fills in:**
   - Meal name (e.g., "Grilled Chicken Salad")
   - Ingredients list
   - Estimated calories
   - Macronutrients (protein, carbs, fats)
   - Meal type (Breakfast, Lunch, Dinner, Snack)

5. **Client reviews and edits** if needed
6. **Saves** → Meal appears in:
   - Client's meal history
   - Coach's feed
   - Chat as rich card

**Option 2: Manual Entry**
- Client types meal name
- Enters ingredients manually
- Adds nutritional info
- Saves

**Meal Card Display:**
- Photo thumbnail
- Meal name
- Ingredients
- Macros displayed as colored bars
- Timestamp

---

### **7. CHECK-INS & PROGRESS TRACKING**

**Weekly Check-Ins:**

Clients submit regular updates:

**Weight Entry:**
- Current weight in kg
- Automatically tracks weight change over time
- Shows on progress graphs

**Progress Photos:**
- Upload front, side, back photos
- Track visual changes over weeks
- Private to client and coach

**Notes:**
- How client is feeling
- Challenges faced
- Questions for coach

**Coach Reviews:**
- Sees all check-ins
- Can comment
- Tracks client progress over time

---

## 💼 COACH FEATURES & CAPABILITIES

### **1. COACH DASHBOARD**

**Clients Tab:**
- List of all assigned clients
- Each client card shows:
  - Name and avatar
  - Active challenge count
  - Last check-in date
  - Unread message badge
- Search and filter clients
- Click to view client details

---

### **2. CLIENT DETAILS PAGE (ACTIVITY VIEW)**

**When coach taps a client, they see:**

**Client Information Card:**
- Full Name
- Goal (e.g., "Lose 15kg")
- Experience Level
- Age (calculated from DOB)
- Height
- **Latest Weight** (from most recent check-in)
- Dietary Restrictions
- Medical Conditions

**Active Challenges Section:**
- All challenges assigned to this client
- Each shows:
  - Challenge name
  - Start and end dates
  - Completion rate (e.g., "85%")
  - Progress bar
  - Number of tasks: "6/7 tasks"
  - Status badge (Active, Completed, Pending)

**Coach Actions:**
- **Create Challenge Button** → Manual challenge builder
- **AI Button** (purple sparkle icon) → AI-powered challenge generator
- Tap any challenge → View detailed breakdown
- Message client directly

---

### **3. CHALLENGE CREATION SYSTEM**

Coaches have **TWO WAYS** to create challenges:

#### **METHOD 1: MANUAL CREATION**

**Step-by-Step Process:**

1. **Click "Create" button**
2. **Client pre-selected** (if coming from client details)
3. **Fill Challenge Details:**
   - Challenge Name: "Summer Fitness Bootcamp"
   - Description: "Intensive 10-day program focused on cardio and strength"
   - Start Date: January 20, 2026
   - Duration: 10 days (auto-calculates end date)

4. **Customize Daily Tasks:**
   - System auto-generates 10 task cards (one per day)
   - For each day, coach sets:
     - **Task Name**: "Day 1: Morning Run"
     - **Description**: "Run 3km at moderate pace"
     - **Focus Type**: Training 💪
     - **Intensity**: Moderate

5. **Review and Create**
6. **Challenge sent to client** → Appears in their dashboard

**Example Challenge Created:**

**"10-Day Core Strength Program"**
- Day 1: 3x15 Crunches | Intensity: Light
- Day 2: 3x20 Bicycle Crunches | Intensity: Moderate
- Day 3: 30-second Plank x3 | Intensity: Moderate
- Day 4: Rest Day - Stretch | Intensity: Light
- Day 5: 3x15 Russian Twists | Intensity: Moderate
... and so on

#### **METHOD 2: AI-POWERED GENERATION**

**How AI Creates Challenges:**

1. **Coach clicks purple AI button**
2. **AI Challenge Generator opens**
3. **Coach selects:**
   - Client (pre-selected if from client page)
   - Week starting date

4. **AI analyzes client's:**
   - Historical performance data
   - Previous challenges completed
   - Goals and experience level
   - Medical conditions
   - Recent activity patterns

5. **AI generates personalized weekly challenges:**
   - Non-repetitive tasks
   - Progressive difficulty
   - Balanced across all fitness domains
   - Considers recovery needs

6. **Coach reviews AI suggestions**
7. **Can edit or approve** each day's tasks
8. **Confirms and sends** to client

**Example AI-Generated Week:**

**Monday**: "High-intensity cardio - 20 min HIIT" (Training)  
**Tuesday**: "Meal prep Sunday leftovers with extra veggies" (Nutrition)  
**Wednesday**: "Upper body strength - Push focus" (Training)  
**Thursday**: "Active recovery - Yoga or stretching" (Recovery)  
**Friday**: "Lower body strength - Leg day" (Training)  
**Saturday**: "Track all meals and water intake" (Nutrition)  
**Sunday**: "Rest day - Foam rolling session" (Recovery)

---

### **4. COACH MESSAGING**

**Coach Messages Screen:**

**Client List View:**
- All active clients shown as cards
- Each card displays:
  - Client name and avatar
  - Last message preview
  - Timestamp
  - **Unread badge** (blue circle with count)
- **Real-time updates** → New messages appear instantly
- **Auto-sorts** → Most recent conversation at top

**Chat with Client:**
- Same features as client chat
- Can send session invites
- Can view meal logs
- Access to client activity via menu

**Options Menu (3 dots):**
- AI Scheduler → Create session
- Activity → View client progress
- Close Chat

---

### **5. SESSION SCHEDULING (COACH SIDE)**

**AI-Powered Scheduler:**

**How it Works:**

1. **Coach opens chat with client**
2. **Clicks "AI Scheduler"** from menu
3. **Scheduler Modal Opens**

**Coach Provides:**
- Session purpose (e.g., "Strength training review")
- Preferred date
- Preferred time
- Duration (1 hour limit)

**AI Processes:**
- Checks coach's existing schedule
- Identifies conflicts
- Suggests optimal times
- Considers client's availability patterns

**Two Scenarios:**

**Scenario A: No Conflicts**
1. AI creates session
2. Generates video meet link
3. Sends invite to client
4. Waits for client response

**Scenario B: Conflict Detected**

**Example Conflict:**
- Coach already has session at 3:00 PM with Client A
- Tries to schedule session at 3:00 PM with Client B
- **System blocks it** and shows conflict resolution modal

---

### **6. CONFLICT RESOLUTION SYSTEM** ⚠️

**This is a CRITICAL feature for managing scheduling conflicts.**

**How Conflicts Arise:**

**Example Scenario:**
- **Monday 3:00 PM** → Coach scheduled with Client A (existing)
- **Coach tries to schedule** Monday 3:00 PM with Client B (proposed)
- ⚠️ **CONFLICT!**

**Conflict Resolution Modal Appears:**

**Coach Sees:**
1. **Existing Session Details:**
   - Client: Sarah Johnson
   - Date: Monday, Jan 20
   - Time: 3:00 PM
   - Duration: 1 hour
   - Status: Confirmed

2. **Proposed Session Details:**
   - Client: Mike Chen
   - Date: Monday, Jan 20
   - Time: 3:00 PM
   - Duration: 1 hour
   - Status: Pending

**Coach Has 3 Options:**

**OPTION 1: "Keep Existing, Find Another Time for Proposed"**
- Existing session stays scheduled
- Proposed session is **NOT** created
- Coach must schedule Mike at different time manually

**OPTION 2: "Propose Reschedule for Existing Session"**
- System asks existing client (Sarah) to reschedule
- Sarah receives reschedule proposal in chat
- Shows: "Coach is asking to reschedule from Monday 3PM to..."
- Sarah can accept or decline
- **If Sarah accepts:**
  - Her session moves to new time
  - Mike's session confirmed at original time
- **If Sarah declines:**
  - Sarah's session stays
  - Mike's session rejected
  - Coach must find alternative

**OPTION 3: "Cancel Existing, Accept Proposed"**
- ⚠️ **Immediate cancellation**
- Sarah's session cancelled
- Mike's session confirmed
- Cancellation notification sent to Sarah
- Should be used sparingly (not ideal UX)

**System Tracking:**

**Pending Resolutions:**
- Coach dashboard shows "Pending Resolutions" badge
- Lists all sessions awaiting decisions
- Real-time updates when clients respond
- Notifications when resolution needed

**Resolution Notifications:**
- Coach gets alert when client accepts/rejects reschedule
- Can process resolution immediately
- System prevents double-booking

---

### **7. SESSION MANAGEMENT (COACH PERSPECTIVE)**

**Coach Calendar View:**

**Shows ALL upcoming sessions:**
- Color-coded by client
- Status indicators:
  - 🟢 Confirmed
  - 🟡 Pending Client Acceptance
  - 🟠 Pending Reschedule
  - 🔵 Proposed Alternative Time
  - 🔴 Conflict/Needs Resolution

**Session Card Details:**
- Client name
- Date and time
- Duration
- Meet link
- Status

**Coach Actions:**
- **Cancel Session** (with reason)
- **Reschedule** (proposes new time to client)
- **Join Call** (when session time arrives)
- **Mark Complete** (after session ends)

**Automated System Messages:**

When coach takes action, **automatic messages sent to client:**

**Session Scheduled:**
> "🎥 New Session Scheduled  
> Monday, Jan 20 at 3:00 PM  
> Duration: 1 hour  
> [Accept] [Propose Alternative] [Decline]"

**Session Cancelled:**
> "❌ Session Cancelled  
> Your session on Monday, Jan 20 has been cancelled.  
> Reason: Coach unavailable"

**Session Rescheduled:**
> "🔄 Reschedule Request  
> Coach is asking to move your session from Monday 3PM to Tuesday 2PM.  
> [Accept] [Decline]"

---

### **8. CLIENT PROGRESS MONITORING**

**Coach Dashboard Shows:**

**Per Client:**
- Challenge completion rates
- Weight progression graph
- Check-in frequency
- Meal logging consistency
- Session attendance

**Client Activity Feed:**
- Recent meals logged
- Challenges completed
- Check-ins submitted
- Messages sent

**Analytics:**
- Total active clients
- Average client engagement
- Most popular challenge types
- Session completion rates

---

## 🤖 AI-POWERED FEATURES

### **1. AI COACH BRAIN**

**Every coach gets a personalized AI personality:**

**Configuration:**
- **Tone**: Professional and motivating
- **Style**: Supportive and educational
- **Memory**: Stores coach's preferences and patterns

**AI learns from:**
- Challenge types coach creates
- Messaging style
- Client success patterns
- Scheduling preferences

### **2. AI Challenge Generation**

**Uses Google Gemini to:**
- Analyze client history
- Identify patterns
- Create progressive programs
- Avoid repetition
- Balance workout types
- Time recovery appropriately

**Memory System:**
- Tracks previously assigned challenges
- Doesn't repeat tasks within 4 weeks
- Adapts difficulty based on completion rates

### **3. AI Meal Analysis**

**Google Gemini Vision API:**
- Analyzes food photos
- Identifies ingredients
- Estimates portion sizes
- Calculates nutritional info
- Suggests healthier alternatives

### **4. AI Scheduling Assistant**

**Natural Language Processing:**
- Understands conversational requests
- "Schedule a strength session next Monday afternoon"
- AI interprets and suggests times
- Checks availability automatically

---

## 🔔 REAL-TIME FEATURES

### **1. Message Notifications**

**Tab Bar Badge System:**

**Client View:**
- Red badge on "Messages" tab
- Shows total unread count from coach
- Updates instantly when new message arrives

**Coach View:**
- Red badge on "Messages" tab
- Shows total unread across ALL clients
- Individual client cards show unread count

**Notification Toast:**
- Popup notification when message received
- Shows: Sender name, message preview
- Can be dismissed by swiping up
- Plays sound (if enabled)
- Only appears if user is NOT in that chat

### **2. Live Updates**

**Without Page Refresh:**

**Message List Updates:**
- New messages appear instantly
- Unread counts update live
- List re-sorts automatically
- Message previews update

**Challenge Progress:**
- Completion rates update real-time
- Progress bars animate smoothly
- Task checkmarks appear instantly

**Session Status:**
- Invitation status changes live
- "Coach has joined" shows immediately
- Reschedule proposals appear instantly

---

## 📊 DATA ARCHITECTURE

### **User Profiles**
- Full name, email, role
- Avatar URL
- Onboarding status
- Account creation date

### **Clients**
- Linked to user profile
- Physical stats (height, weight, DOB, gender)
- Goals and experience
- Health information
- Coach assignment

### **Coaches**
- Linked to user profile
- Activity status
- Client list
- AI brain configuration

### **Coach-Client Links**
- One coach → Many clients
- Status tracking (active, inactive)
- Assignment date

### **Messages**
- Thread between coach and client
- Read/unread status
- Message type (text, invite, meal, etc.)
- Timestamps
- Real-time sync

### **Sessions**
- Scheduled date and time
- Duration
- Meet link
- Status (scheduled, pending, completed, cancelled)
- Cancellation/reschedule tracking
- Conflict management

### **Challenges (Mother Challenges)**
- Container for multi-day program
- Client assignment
- Start and end dates
- Status tracking
- Created by (AI or Coach)

### **Sub-Challenges**
- Individual daily tasks
- Assigned date
- Focus type
- Intensity
- Completion status

### **Meals**
- Client who logged it
- Photo
- Name and ingredients
- Nutritional data
- Meal type and time
- AI processed or manual

### **Check-Ins**
- Weight entries
- Progress photos
- Client notes
- Submission date

---

## 🎨 USER EXPERIENCE FEATURES

### **Authentication Security**
- Email validation (format checking)
- Password requirements (6+ characters)
- Automatic email normalization (lowercase, trimmed)
- Session management
- Secure password storage

### **Onboarding Excellence**
- Progressive disclosure (one step at a time)
- Clear instructions
- Visual feedback
- Skip options where appropriate
- Cannot access app until onboarded

### **Visual Design**
- Modern, clean interfaces
- Consistent color scheme
- Icon-based navigation
- Smooth animations
- Loading states
- Empty states with helpful messages

### **Performance Optimizations**
- Optimistic UI updates (instant feedback)
- Background data sync
- Silent refreshes (no loading spinners)
- Efficient image loading
- Debounced API calls

### **Error Handling**
- User-friendly error messages
- Graceful degradation
- Retry mechanisms
- Offline detection
- Clear feedback on actions

---

## 🛠️ TECHNICAL CAPABILITIES

### **Real-Time Architecture**
- Supabase real-time subscriptions
- WebSocket connections
- Event-driven updates
- Channel-based messaging
- Automatic reconnection

### **Database Features**
- Row-Level Security (RLS)
- Database triggers
- Stored procedures (RPC functions)
- Foreign key relationships
- Cascade operations

### **File Storage**
- Supabase Storage for images
- Automatic thumbnail generation
- Secure file uploads
- Public URL generation

### **Authentication**
- Supabase Auth
- Email/password login
- Session tokens
- Automatic token refresh
- Role-based access control

### **AI Integration**
- Google Gemini API
- Vision processing
- Natural language understanding
- Context-aware responses
- Error handling and fallbacks

---

## 🚧 CURRENT LIMITATIONS & SCOPE

### **What's NOT Included (Yet):**
- Payment processing
- Multi-coach support per client
- Group challenges
- Social features (client-to-client)
- Video recording/replay
- Nutrition database integration
- Wearable device syncing
- Push notifications (desktop)
- Coach-to-coach messaging
- Admin panel features (incomplete)

### **Known Edge Cases:**
- Maximum session duration: 1 hour
- Challenge duration: 3-14 days only
- Single coach per client
- No timezone handling
- English language only

---

## 📈 VERSION 1.0 COMPLETE FEATURE SET

**✅ What's Fully Functional:**

1. ✅ Complete user authentication
2. ✅ Role-based access (Client/Coach/Admin)
3. ✅ Client onboarding flow
4. ✅ Real-time messaging system
5. ✅ Session scheduling with AI
6. ✅ Conflict resolution system
7. ✅ Manual challenge creation
8. ✅ AI-powered challenge generation
9. ✅ Challenge progress tracking
10. ✅ Meal logging with AI vision
11. ✅ Check-in system
12. ✅ Client activity monitoring
13. ✅ Live notifications
14. ✅ Video call integration
15. ✅ Unread message tracking
16. ✅ Optimistic UI updates
17. ✅ Safe area handling (iOS)
18. ✅ Email validation
19. ✅ Error handling
20. ✅ Real-time list updates

---

## 📝 DOCUMENT METADATA

**Created:** January 5, 2026  
**Version:** 1.0  
**Status:** Complete & Production Ready  
**Last Updated:** January 5, 2026 at 19:09 UTC+2  

---

This is **VERSION 1.0** - A fully functional AI-enhanced coaching platform ready for real-world use! 🎉🚀
