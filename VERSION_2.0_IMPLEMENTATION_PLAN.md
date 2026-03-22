# 🚀 AI COACHING APP - VERSION 2.0 IMPLEMENTATION PLAN

## 📋 OVERVIEW

**Version 2.0** introduces **full whitelabel capabilities** and **B2B multi-coach management** while preserving **100% of Version 1.0 functionality**.

**Core Principle:** ⚠️ **DO NOT BREAK ANYTHING FROM V1.0** ⚠️

---

## ✅ V1.0 FEATURES PRESERVATION CHECKLIST

**These features MUST remain exactly as they are:**

- ✅ User authentication (email/password, role-based access)
- ✅ Client onboarding flow
- ✅ Real-time messaging
- ✅ Session scheduling with AI
- ✅ Conflict resolution system
- ✅ Challenge creation (manual + AI)
- ✅ Challenge progress tracking
- ✅ Meal logging (manual + AI Vision)
- ✅ Check-in system
- ✅ Client activity monitoring
- ✅ Live notifications
- ✅ Video call integration
- ✅ Optimistic UI updates
- ✅ All existing UI/UX patterns

---

## 🎯 VERSION 2.0 NEW FEATURES

### **1. WHITELABEL BRANDING SYSTEM**
- Coach brand name
- Custom logo upload
- Theme color customization (primary + secondary)
- Branding applied across entire app
- Sub-coaches inherit parent branding

### **2. MULTI-COACH HIERARCHY**
- Parent Coach (Mother/Father Coach)
- Sub-Coaches under parent
- Brand-wide analytics
- Client assignment and transfer
- Permission-based access control

### **3. INVITE-ONLY CLIENT ONBOARDING**
- Unique invite links/codes
- Deep linking support
- Automatic coach assignment
- Branding pre-applied
- Invite expiration and usage limits

### **4. ANALYTICS DASHBOARDS**
- Brand-wide KPIs
- Coach-level metrics
- Client-level insights
- Exportable reports (PDF/CSV)
- Engagement and retention tracking

### **5. CLIENT TRANSFER SYSTEM**
- Transfer clients between sub-coaches
- Maintain brand association
- Notification system
- History tracking

---

## 🗄️ DATABASE SCHEMA CHANGES

### **NEW TABLES**

#### **1. `brands` Table**
```sql
CREATE TABLE brands (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#3B82F6',
  secondary_color TEXT DEFAULT '#10B981',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### **2. `coach_invites` Table**
```sql
CREATE TABLE coach_invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  coach_id UUID REFERENCES coaches(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
  max_uses INTEGER DEFAULT 1,
  current_uses INTEGER DEFAULT 0,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);
```

#### **3. `coach_hierarchy` Table**
```sql
CREATE TABLE coach_hierarchy (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_coach_id UUID REFERENCES coaches(id) ON DELETE CASCADE,
  child_coach_id UUID REFERENCES coaches(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(parent_coach_id, child_coach_id)
);
```

#### **4. `client_transfers` Table (History)**
```sql
CREATE TABLE client_transfers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  from_coach_id UUID REFERENCES coaches(id),
  to_coach_id UUID REFERENCES coaches(id),
  transferred_by UUID REFERENCES coaches(id),
  transfer_date TIMESTAMP DEFAULT NOW(),
  reason TEXT
);
```

#### **5. `analytics_events` Table**
```sql
CREATE TABLE analytics_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id UUID REFERENCES brands(id),
  coach_id UUID REFERENCES coaches(id),
  client_id UUID REFERENCES clients(id),
  event_type TEXT NOT NULL, -- 'login', 'challenge_complete', 'session_attend', 'meal_log', 'check_in'
  event_data JSONB,
  occurred_at TIMESTAMP DEFAULT NOW()
);
```

### **MODIFIED TABLES**

#### **Update `coaches` Table**
```sql
ALTER TABLE coaches
ADD COLUMN brand_id UUID REFERENCES brands(id),
ADD COLUMN is_parent_coach BOOLEAN DEFAULT FALSE,
ADD COLUMN can_manage_brand BOOLEAN DEFAULT FALSE;
```

#### **Update `clients` Table**
```sql
ALTER TABLE clients
ADD COLUMN brand_id UUID REFERENCES brands(id),
ADD COLUMN invited_by UUID REFERENCES coaches(id),
ADD COLUMN invite_code TEXT;
```

#### **Update `coach_client_links` Table**
```sql
ALTER TABLE coach_client_links
ADD COLUMN assigned_by UUID REFERENCES coaches(id),
ADD COLUMN assigned_at TIMESTAMP DEFAULT NOW();
```

---

## 📐 IMPLEMENTATION PHASES

### **PHASE 1: DATABASE & BACKEND FOUNDATION** (Week 1)

**Tasks:**
1. ✅ Create new database tables
2. ✅ Update existing tables with new columns
3. ✅ Create migration scripts
4. ✅ Write RPC functions for:
   - Brand CRUD operations
   - Coach hierarchy management
   - Invite generation and validation
   - Client transfer logic
   - Analytics data aggregation

**RPC Functions to Create:**

```sql
-- Create brand
CREATE FUNCTION create_brand(
  p_name TEXT,
  p_logo_url TEXT,
  p_primary_color TEXT,
  p_secondary_color TEXT
) RETURNS UUID;

-- Update brand
CREATE FUNCTION update_brand(
  p_brand_id UUID,
  p_name TEXT,
  p_logo_url TEXT,
  p_primary_color TEXT,
  p_secondary_color TEXT
) RETURNS BOOLEAN;

-- Add sub-coach
CREATE FUNCTION add_sub_coach(
  p_parent_coach_id UUID,
  p_child_coach_id UUID
) RETURNS BOOLEAN;

-- Generate invite code
CREATE FUNCTION generate_invite_code(
  p_coach_id UUID,
  p_max_uses INTEGER,
  p_expires_at TIMESTAMP
) RETURNS TEXT;

-- Validate invite code
CREATE FUNCTION validate_invite_code(
  p_code TEXT
) RETURNS JSONB; -- Returns brand_id, coach_id, etc.

-- Transfer client
CREATE FUNCTION transfer_client(
  p_client_id UUID,
  p_from_coach_id UUID,
  p_to_coach_id UUID,
  p_transferred_by UUID,
  p_reason TEXT
) RETURNS BOOLEAN;

-- Get brand analytics
CREATE FUNCTION get_brand_analytics(
  p_brand_id UUID,
  p_start_date DATE,
  p_end_date DATE
) RETURNS JSONB;

-- Get coach analytics
CREATE FUNCTION get_coach_analytics(
  p_coach_id UUID,
  p_start_date DATE,
  p_end_date DATE
) RETURNS JSONB;
```

**Database Triggers:**
```sql
-- Auto-inherit brand from parent coach
CREATE TRIGGER inherit_brand_trigger
AFTER INSERT ON coach_hierarchy
FOR EACH ROW
EXECUTE FUNCTION sync_brand_to_child_coach();

-- Track analytics events
CREATE TRIGGER track_login_event
AFTER UPDATE ON profiles
FOR EACH ROW
WHEN (OLD.last_sign_in_at IS DISTINCT FROM NEW.last_sign_in_at)
EXECUTE FUNCTION log_analytics_event();
```

---

### **PHASE 2: BRANDING SYSTEM** (Week 2)

**Tasks:**

#### **2.1: Brand Management UI (Coach Side)**

**New Screen: `app/(coach)/settings/branding.tsx`**

**Features:**
- Brand name input
- Logo upload (Supabase Storage)
- Color picker for primary color
- Color picker for secondary color
- Live preview of branding
- Save button

**Implementation:**
```typescript
// Brand context for global access
// contexts/BrandContext.tsx
interface Brand {
  id: string;
  name: string;
  logo_url: string;
  primary_color: string;
  secondary_color: string;
}

export const useBrand = () => {
  // Fetch brand based on coach's brand_id
  // Provide brand colors and logo to entire app
}
```

#### **2.2: Apply Branding Across App**

**Files to Update (Minimal Changes):**
- `app/_layout.tsx` → Wrap in BrandProvider
- All button components → Use `brand.primary_color`
- All headers → Show `brand.logo_url` if available
- Progress bars → Use `brand.primary_color`
- Tab bars → Use `brand.secondary_color`

**Strategy:** 
- Create a `ThemeContext` that reads from `BrandContext`
- Replace hardcoded colors with theme values
- **DO NOT change UI structure**, only colors

#### **2.3: Logo Display**

**Where to Show Logo:**
- Client dashboard header
- Coach dashboard header (if parent coach)
- Chat interface header
- App splash screen (conditional)
- Exported reports

**Implementation:**
```typescript
// components/BrandedHeader.tsx
export function BrandedHeader() {
  const { brand } = useBrand();
  
  return (
    <View style={styles.header}>
      {brand?.logo_url && (
        <Image source={{ uri: brand.logo_url }} style={styles.logo} />
      )}
      <Text style={[styles.title, { color: brand?.primary_color }]}>
        {brand?.name || 'Coaching App'}
      </Text>
    </View>
  );
}
```

---

### **PHASE 3: MULTI-COACH HIERARCHY** (Week 3)

**Tasks:**

#### **3.1: Parent Coach Dashboard**

**New Screen: `app/(coach)/team/index.tsx`**

**Features:**
- List of all sub-coaches
- Add sub-coach button
- Remove sub-coach option
- View sub-coach's clients (if permission granted)
- Brand-wide analytics overview

**Sub-Coach Card Shows:**
- Name and avatar
- Number of clients
- Active challenges count
- Last activity
- Status (active/inactive)

#### **3.2: Add Sub-Coach Flow**

**New Screen: `app/(coach)/team/add-coach.tsx`**

**Options:**
1. **Invite New Coach** → Generates invite link
2. **Link Existing Coach** → Search by email

**When Adding Sub-Coach:**
- Automatically assign parent's brand_id
- Create coach_hierarchy entry
- Grant default permissions
- Send notification to sub-coach

#### **3.3: Permission System**

**New Table: `coach_permissions`**
```sql
CREATE TABLE coach_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  coach_id UUID REFERENCES coaches(id),
  permission_type TEXT, -- 'view_brand_analytics', 'manage_clients', 'create_challenges'
  granted_by UUID REFERENCES coaches(id),
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Default Permissions for Sub-Coaches:**
- ✅ Manage own clients
- ✅ Create challenges for own clients
- ✅ Schedule sessions with own clients
- ❌ View brand-wide analytics (unless granted)
- ❌ Modify brand settings
- ❌ Transfer clients

#### **3.4: Brand-Wide Client View**

**New Screen: `app/(coach)/team/all-clients.tsx`**

**Accessible by:** Parent coach only

**Shows:**
- All clients across all sub-coaches
- Filterable by sub-coach
- Searchable by client name
- Color-coded by sub-coach
- Click to view client details
- Transfer client option

---

### **PHASE 4: INVITE-ONLY CLIENT ONBOARDING** (Week 4)

**Tasks:**

#### **4.1: Invite Generation UI**

**Add to Coach Dashboard:**

**Button:** "Invite Client" (prominent placement)

**Modal: `components/InviteClientModal.tsx`**

**Fields:**
- Max uses (default: 1, unlimited checkbox)
- Expiration date (optional)
- Assign to sub-coach (dropdown if parent coach)
- Generate button

**Output:**
- Unique invite link: `https://coaching.app/join/abc123xyz`
- Shareable via:
  - WhatsApp (pre-filled message)
  - SMS
  - Email
  - QR Code (generate and download)
  - Copy link

#### **4.2: Deep Linking Setup**

**Install Packages:**
```bash
npx expo install expo-linking
```

**Configure Deep Links:**

**`app.json` Update:**
```json
{
  "expo": {
    "scheme": "coachingapp",
    "android": {
      "intentFilters": [
        {
          "action": "VIEW",
          "data": [
            {
              "scheme": "https",
              "host": "coaching.app",
              "pathPrefix": "/join"
            }
          ]
        }
      ]
    },
    "ios": {
      "associatedDomains": ["applinks:coaching.app"]
    }
  }
}
```

**Handle Deep Link:**

**New Screen: `app/join/[code].tsx`**

```typescript
import { useLocalSearchParams } from 'expo-router';

export default function JoinScreen() {
  const { code } = useLocalSearchParams();
  
  useEffect(() => {
    validateInviteCode(code);
  }, [code]);
  
  const validateInviteCode = async (inviteCode: string) => {
    // Call RPC: validate_invite_code
    // If valid:
    //   - Get brand_id, coach_id
    //   - Show signup form with branding pre-applied
    // If invalid/expired:
    //   - Show error screen
  };
}
```

#### **4.3: Branded Signup Screen**

**Update: `app/(auth)/signup.tsx`**

**Changes:**
- Accept `inviteCode` param
- Pre-fetch brand info
- Apply brand colors to signup UI
- Show brand logo at top
- Auto-link client to coach on signup
- Skip coach selection step (already determined by invite)

**Flow:**
1. Client clicks invite link
2. App opens → `/join/abc123`
3. Validate code → Get brand + coach
4. Show signup with branding
5. Client creates account
6. Auto-link to coach and brand
7. Redirect to onboarding with brand theme

#### **4.4: Post-Install Attribution**

**Challenge:** User clicks link but app not installed

**Solution:**
1. Link redirects to App Store/Play Store
2. After install, app checks clipboard for invite code
3. OR: Use Expo deep link handling (automatically passes params)

**Implementation:**
```typescript
// In app/_layout.tsx
useEffect(() => {
  const handleInitialURL = async () => {
    const url = await Linking.getInitialURL();
    if (url?.includes('/join/')) {
      const code = url.split('/join/')[1];
      router.push(`/join/${code}`);
    }
  };
  
  handleInitialURL();
}, []);
```

---

### **PHASE 5: CLIENT TRANSFER SYSTEM** (Week 5)

**Tasks:**

#### **5.1: Transfer Client UI**

**Add to Client Details Page:**

**New Button (Parent Coach Only):** "Transfer Client"

**Modal: `components/TransferClientModal.tsx`**

**Fields:**
- Current coach (display only)
- Target sub-coach (dropdown)
- Reason for transfer (optional text)
- Notify client checkbox
- Confirm button

**Confirmation Dialog:**
> "Are you sure you want to transfer [Client Name] from [Current Coach] to [New Coach]?  
> This action will update all future sessions and challenge assignments."

#### **5.2: Transfer Logic**

**RPC Function: `transfer_client`**

**Steps:**
1. Validate parent coach has permission
2. Update `coach_client_links`:
   - Deactivate old link (set status = 'transferred')
   - Create new link with new coach
3. Insert into `client_transfers` history table
4. Send notification to client (optional)
5. Send notification to both coaches
6. Re-assign pending sessions to new coach

#### **5.3: Transfer History**

**New Screen: `app/(coach)/team/transfer-history.tsx`**

**Shows:**
- All client transfers
- Filterable by date, coach, client
- Transfer reason
- Performed by (which parent coach)
- Timestamp

---

### **PHASE 6: ANALYTICS DASHBOARDS** (Week 6)

**Tasks:**

#### **6.1: Analytics Data Collection**

**Track Events Automatically:**

**Events to Track:**
- User login (timestamp)
- Challenge completed (client_id, challenge_id)
- Session attended (client_id, session_id)
- Meal logged (client_id, meal_id)
- Check-in submitted (client_id, checkin_id)
- Message sent (sender_id, recipient_id)

**Implementation:**
- Database triggers insert into `analytics_events`
- No manual tracking needed in frontend

**Example Trigger:**
```sql
CREATE TRIGGER log_challenge_completion
AFTER UPDATE ON sub_challenges
FOR EACH ROW
WHEN (OLD.completed = FALSE AND NEW.completed = TRUE)
EXECUTE FUNCTION log_analytics_event('challenge_complete', NEW.id);
```

#### **6.2: Brand Analytics Dashboard**

**New Screen: `app/(coach)/analytics/brand.tsx`**

**Accessible by:** Parent coach only

**KPIs Displayed:**

**Engagement Metrics:**
- Total active clients
- Average logins per week
- Challenge completion rate (%)
- Session attendance rate (%)
- Meal logging consistency (%)
- Check-in completion rate (%)

**Retention Metrics:**
- Week-over-week client retention
- Monthly active clients
- Client churn rate

**Growth Metrics:**
- New clients this month
- Total clients onboarded
- Invites sent vs. used

**Visualizations:**
- Line charts for trends over time
- Bar charts for coach comparisons
- Pie charts for event distribution

**Filter Options:**
- Date range picker
- Select specific sub-coach
- Select specific client

#### **6.3: Coach Analytics Dashboard**

**New Screen: `app/(coach)/analytics/my-stats.tsx`**

**Accessible by:** All coaches (shows only their data)

**Metrics:**
- My active clients
- My sessions this week
- My challenges created
- My client engagement rate
- My client retention rate

**Client List with Engagement Scores:**
- Client name
- Last active (timestamp)
- Challenge completion rate
- Session attendance rate
- Engagement score (calculated: weighted average)

**Color Coding:**
- 🟢 High engagement (80%+)
- 🟡 Medium engagement (50-79%)
- 🔴 Low engagement (<50%)

#### **6.4: Client Analytics View**

**Update: `app/(coach)/clients/[id].tsx`**

**Add Analytics Tab:**

**Shows:**
- Weight progression graph
- Challenge completion timeline
- Session attendance calendar
- Meal logging frequency
- Check-in consistency

**Exportable:** CSV and PDF

---

### **PHASE 7: REPORT GENERATION & EXPORT** (Week 7)

**Tasks:**

#### **7.1: PDF Report Generation**

**Install Package:**
```bash
npm install react-native-html-to-pdf
```

**Report Types:**
1. **Brand Report** (Parent Coach)
   - Brand-wide KPIs
   - Coach performance comparison
   - Client engagement summary
   - Includes brand logo and colors

2. **Coach Report** (All Coaches)
   - Personal KPIs
   - Client list with engagement
   - Sessions and challenges summary

3. **Client Report** (Coach → Client)
   - Progress summary
   - Weight change graph
   - Challenge completion
   - Session attendance

**Implementation:**
```typescript
// lib/report-generator.ts
export async function generateBrandReport(
  brandId: string,
  startDate: Date,
  endDate: Date
) {
  const analytics = await getBrandAnalytics(brandId, startDate, endDate);
  const brand = await getBrandInfo(brandId);
  
  const html = `
    <html>
      <head>
        <style>
          /* Brand colors applied */
          .header { background: ${brand.primary_color}; }
          .accent { color: ${brand.secondary_color}; }
        </style>
      </head>
      <body>
        <div class="header">
          <img src="${brand.logo_url}" />
          <h1>${brand.name} - Analytics Report</h1>
        </div>
        <!-- KPIs, charts, tables -->
      </body>
    </html>
  `;
  
  const file = await RNHTMLtoPDF.convert({ html, fileName: 'brand-report' });
  return file.filePath;
}
```

#### **7.2: CSV Export**

**For Data Tables:**
- Client lists
- Transfer history
- Analytics events
- Session logs

**Implementation:**
```typescript
// lib/csv-exporter.ts
export function exportToCSV(data: any[], filename: string) {
  const csv = Papa.unparse(data);
  const blob = new Blob([csv], { type: 'text/csv' });
  // Share or save file
}
```

#### **7.3: Export UI**

**Add Export Buttons:**
- Analytics dashboard → "Export PDF" / "Export CSV"
- Client details → "Export Client Report"
- Transfer history → "Export CSV"

---

### **PHASE 8: BRANDING ENFORCEMENT** (Week 8)

**Tasks:**

#### **8.1: Disable Brand Editing for Sub-Coaches**

**Logic:**
```typescript
// In branding settings screen
const { coach } = useAuth();
const { brand } = useBrand();

const canEditBrand = coach?.is_parent_coach && coach?.can_manage_brand;

if (!canEditBrand) {
  return (
    <View>
      <Text>Brand settings are managed by your parent coach.</Text>
      <BrandPreview brand={brand} />
    </View>
  );
}
```

#### **8.2: Auto-Apply Brand to New Clients**

**When Client Signs Up via Invite:**
```typescript
// In signup flow
const { data: inviteData } = await supabase.rpc('validate_invite_code', { p_code: code });

// Auto-assign brand
await supabase.from('clients').insert({
  user_id: newUser.id,
  brand_id: inviteData.brand_id,
  invited_by: inviteData.coach_id
});
```

#### **8.3: Brand Propagation Trigger**

**SQL Trigger:**
```sql
CREATE OR REPLACE FUNCTION propagate_brand_updates()
RETURNS TRIGGER AS $$
BEGIN
  -- When parent coach updates brand, update all sub-coaches
  UPDATE coaches
  SET brand_id = NEW.id
  WHERE id IN (
    SELECT child_coach_id
    FROM coach_hierarchy
    WHERE parent_coach_id = NEW.id
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER brand_update_propagation
AFTER UPDATE ON brands
FOR EACH ROW
EXECUTE FUNCTION propagate_brand_updates();
```

---

### **PHASE 9: TESTING & REFINEMENT** (Week 9)

**Tasks:**

#### **9.1: Feature Testing**

**Test Scenarios:**

1. **Branding:**
   - ✅ Upload logo → Appears in all locations
   - ✅ Change colors → All UI updates
   - ✅ Sub-coach cannot edit brand

2. **Hierarchy:**
   - ✅ Add sub-coach → Inherits brand
   - ✅ Remove sub-coach → Links preserved
   - ✅ Parent coach sees all clients

3. **Invites:**
   - ✅ Generate invite → Unique code created
   - ✅ Client clicks link → App opens correctly
   - ✅ Expired invite → Shows error
   - ✅ Max uses exceeded → Shows error

4. **Client Transfer:**
   - ✅ Transfer client → Links updated
   - ✅ Client notified → Message received
   - ✅ Sessions reassigned → New coach owns them

5. **Analytics:**
   - ✅ Events tracked → Data in database
   - ✅ Dashboard loads → KPIs accurate
   - ✅ Export PDF → Includes branding

#### **9.2: V1 Regression Testing**

**Ensure Nothing Broke:**

- ✅ Client onboarding → Still works
- ✅ Messaging → Still real-time
- ✅ Session scheduling → Still functional
- ✅ Conflict resolution → Still works
- ✅ Challenges → Creation and tracking OK
- ✅ Meal logging → AI still functional
- ✅ Check-ins → Submission works

#### **9.3: Performance Testing**

**Load Testing:**
- 100+ clients under one brand
- 10+ sub-coaches
- Real-time sync with many users
- Analytics queries with large datasets

**Optimize:**
- Database indexes for analytics queries
- Cache brand info in memory
- Debounce real-time updates if needed

---

### **PHASE 10: DEPLOYMENT & DOCUMENTATION** (Week 10)

**Tasks:**

#### **10.1: Database Migration**

**Migration Script:**
```sql
-- VERSION_2.0_MIGRATION.sql

BEGIN;

-- Create new tables
-- (All from Phase 1)

-- Update existing tables
-- (All ALTER TABLE statements)

-- Create RPC functions
-- (All FUNCTION definitions)

-- Create triggers
-- (All TRIGGER definitions)

COMMIT;
```

**Run Migration:**
1. Backup production database
2. Test migration on staging
3. Run on production during low-traffic window
4. Verify data integrity

#### **10.2: Update Documentation**

**Create: `VERSION_2.0_DOCUMENTATION.md`**

**Sections:**
- What's new in V2
- Whitelabel setup guide
- Multi-coach management guide
- Invite system user guide
- Analytics dashboard guide
- Migration guide for existing users

**Update: `README.md`**
- Add V2 features list
- Update architecture diagram
- Add API documentation for new RPCs

#### **10.3: App Store Submission**

**Update:**
- App version to 2.0.0
- Release notes highlighting new features
- Screenshots showing branding capabilities
- Privacy policy (if needed)

**Submit to:**
- Apple App Store
- Google Play Store

---

## 🔐 SECURITY CONSIDERATIONS

### **Brand Data Access**
- Sub-coaches CANNOT read brand settings
- Only parent coach with `can_manage_brand = TRUE`
- RLS policies enforce this at database level

### **Client Data Privacy**
- Sub-coaches see ONLY their clients
- Parent coach can see all clients within brand
- RLS based on `brand_id` and coach hierarchy

### **Invite Code Security**
- Codes are cryptographically random
- Expiration checked on every use
- Usage count incremented atomically
- Invalid codes return no information (security through obscurity)

### **Analytics Data**
- Aggregated only (no PII exposed unnecessarily)
- Coach can only query their brand's data
- RLS enforces brand_id matching

---

## 🎨 UI/UX GUIDELINES FOR V2

### **Minimal Changes to Existing UI**

**DO:**
- ✅ Replace hardcoded colors with theme variables
- ✅ Add logo to headers where space allows
- ✅ Add new screens for V2 features (team, analytics, branding)
- ✅ Enhance existing screens with new actions (transfer, export)

**DON'T:**
- ❌ Redesign existing layouts
- ❌ Change navigation structure
- ❌ Alter V1 user flows
- ❌ Remove existing features

### **Branding Application**

**Colors:**
- Primary: Buttons, headers, active tabs, progress bars
- Secondary: Accents, badges, secondary buttons

**Logo:**
- Header (30-40px height)
- Splash screen (100px height)
- Reports (50px height)

**Consistency:**
- Theme applies to entire app
- No per-screen overrides
- Material Design / iOS HIG compliance

---

## 📊 SUCCESS METRICS FOR V2

### **Adoption Metrics**
- % of coaches who set up branding
- % of coaches who add sub-coaches
- % of invites sent vs. used
- Average clients per brand

### **Engagement Metrics**
- Parent coach login frequency
- Analytics dashboard views
- Reports exported
- Brand updates made

### **Technical Metrics**
- Deep link success rate
- Invite code validation time
- Analytics query performance
- Real-time sync latency

---

## 🚧 KNOWN LIMITATIONS & FUTURE WORK

### **V2 Limitations**
- Single brand per coach hierarchy
- No timezone support yet
- English language only
- Manual invite sharing (no automated emails)
- Analytics limited to 90 days retention

### **Future V3 Considerations**
- Multi-brand support (one coach manages multiple brands)
- Automated email/SMS invite sending
- White-label mobile app builds (separate app per brand)
- Advanced analytics (predictive, AI-driven insights)
- Group challenges across brands
- Marketplace for coaches to share challenge templates

---

## 📅 TIMELINE SUMMARY

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| 1. Database & Backend | Week 1 | Schema, RPCs, Triggers |
| 2. Branding System | Week 2 | Brand settings, Theme application |
| 3. Multi-Coach Hierarchy | Week 3 | Team management, Permissions |
| 4. Invite-Only Onboarding | Week 4 | Deep links, Branded signup |
| 5. Client Transfer | Week 5 | Transfer UI and logic |
| 6. Analytics Dashboards | Week 6 | KPI dashboards, Visualizations |
| 7. Report Export | Week 7 | PDF/CSV generation |
| 8. Branding Enforcement | Week 8 | Inheritance, Propagation |
| 9. Testing & Refinement | Week 9 | QA, Bug fixes |
| 10. Deployment | Week 10 | Migration, Documentation, Release |

**Total: 10 weeks (~2.5 months)**

---

## ✅ PRE-LAUNCH CHECKLIST

**Backend:**
- [ ] All new tables created
- [ ] All RPC functions deployed
- [ ] All triggers active
- [ ] RLS policies tested
- [ ] Database indexes optimized

**Frontend:**
- [ ] Brand settings UI complete
- [ ] Team management UI complete
- [ ] Invite generation UI complete
- [ ] Deep linking configured
- [ ] Analytics dashboards tested
- [ ] Export functionality working

**Testing:**
- [ ] All V1 features still functional
- [ ] All V2 features tested
- [ ] Performance benchmarks met
- [ ] Security audit passed
- [ ] User acceptance testing complete

**Documentation:**
- [ ] V2 documentation written
- [ ] API docs updated
- [ ] User guides created
- [ ] Migration guide available

**Deployment:**
- [ ] Staging deployment successful
- [ ] Production backup created
- [ ] Migration script ready
- [ ] Rollback plan documented
- [ ] App store submissions prepared

---

## 📝 DOCUMENT METADATA

**Created:** January 5, 2026  
**Version:** 2.0 Implementation Plan  
**Status:** Ready for Development  
**Estimated Completion:** March 2026  
**Last Updated:** January 5, 2026 at 19:56 UTC+2  

---

**VERSION 2.0** will transform the app into a **fully whitelabel B2B platform** while preserving 100% of VERSION 1.0's functionality. 🚀🎨
