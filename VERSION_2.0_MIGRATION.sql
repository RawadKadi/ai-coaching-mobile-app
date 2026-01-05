-- ============================================
-- AI COACHING APP - VERSION 2.0 MIGRATION (FIXED)
-- ============================================
-- This migration adds whitelabel branding, multi-coach hierarchy,
-- invite system, analytics, and client transfer capabilities
-- while preserving ALL Version 1.0 functionality.
--
-- FIX: Removed login tracking trigger (will be handled in app code)
-- ============================================

BEGIN;

-- ============================================
-- PART 1: CREATE NEW TABLES
-- ============================================

-- 1. BRANDS TABLE
CREATE TABLE IF NOT EXISTS brands (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#3B82F6',
  secondary_color TEXT DEFAULT '#10B981',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brands_created_at ON brands(created_at);

COMMENT ON TABLE brands IS 'Whitelabel branding configuration for coaches and gyms';

-- ============================================

-- 2. COACH INVITES TABLE
CREATE TABLE IF NOT EXISTS coach_invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  coach_id UUID REFERENCES coaches(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
  max_uses INTEGER DEFAULT 1,
  current_uses INTEGER DEFAULT 0,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,
  
  CONSTRAINT valid_uses CHECK (current_uses <= max_uses),
  CONSTRAINT positive_max_uses CHECK (max_uses > 0)
);

CREATE INDEX IF NOT EXISTS idx_coach_invites_code ON coach_invites(code);
CREATE INDEX IF NOT EXISTS idx_coach_invites_coach_id ON coach_invites(coach_id);
CREATE INDEX IF NOT EXISTS idx_coach_invites_brand_id ON coach_invites(brand_id);
CREATE INDEX IF NOT EXISTS idx_coach_invites_active ON coach_invites(is_active) WHERE is_active = TRUE;

COMMENT ON TABLE coach_invites IS 'Invite codes for client onboarding with tracking';

-- ============================================

-- 3. COACH HIERARCHY TABLE
CREATE TABLE IF NOT EXISTS coach_hierarchy (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_coach_id UUID NOT NULL REFERENCES coaches(id) ON DELETE CASCADE,
  child_coach_id UUID NOT NULL REFERENCES coaches(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT no_self_parent CHECK (parent_coach_id != child_coach_id),
  CONSTRAINT unique_hierarchy UNIQUE(parent_coach_id, child_coach_id)
);

CREATE INDEX IF NOT EXISTS idx_coach_hierarchy_parent ON coach_hierarchy(parent_coach_id);
CREATE INDEX IF NOT EXISTS idx_coach_hierarchy_child ON coach_hierarchy(child_coach_id);

COMMENT ON TABLE coach_hierarchy IS 'Parent-child coach relationships for B2B structure';

-- ============================================

-- 4. CLIENT TRANSFERS TABLE
CREATE TABLE IF NOT EXISTS client_transfers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  from_coach_id UUID REFERENCES coaches(id) ON DELETE SET NULL,
  to_coach_id UUID NOT NULL REFERENCES coaches(id) ON DELETE CASCADE,
  transferred_by UUID REFERENCES coaches(id) ON DELETE SET NULL,
  transfer_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reason TEXT,
  notes TEXT,
  
  CONSTRAINT different_coaches CHECK (from_coach_id != to_coach_id)
);

CREATE INDEX IF NOT EXISTS idx_client_transfers_client ON client_transfers(client_id);
CREATE INDEX IF NOT EXISTS idx_client_transfers_from_coach ON client_transfers(from_coach_id);
CREATE INDEX IF NOT EXISTS idx_client_transfers_to_coach ON client_transfers(to_coach_id);
CREATE INDEX IF NOT EXISTS idx_client_transfers_date ON client_transfers(transfer_date DESC);

COMMENT ON TABLE client_transfers IS 'Audit trail of client transfers between coaches';

-- ============================================

-- 5. ANALYTICS EVENTS TABLE
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
  coach_id UUID REFERENCES coaches(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_data JSONB DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT valid_event_type CHECK (
    event_type IN (
      'login',
      'challenge_complete',
      'session_attend',
      'meal_log',
      'check_in',
      'message_sent',
      'invite_used',
      'client_transferred'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_brand ON analytics_events(brand_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_coach ON analytics_events(coach_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_client ON analytics_events(client_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_occurred ON analytics_events(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_brand_date ON analytics_events(brand_id, occurred_at DESC);

COMMENT ON TABLE analytics_events IS 'User activity tracking for analytics and insights';

-- ============================================

-- 6. COACH PERMISSIONS TABLE
CREATE TABLE IF NOT EXISTS coach_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  coach_id UUID NOT NULL REFERENCES coaches(id) ON DELETE CASCADE,
  permission_type TEXT NOT NULL,
  granted_by UUID REFERENCES coaches(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT valid_permission_type CHECK (
    permission_type IN (
      'view_brand_analytics',
      'manage_all_clients',
      'transfer_clients',
      'manage_sub_coaches',
      'export_reports'
    )
  ),
  CONSTRAINT unique_coach_permission UNIQUE(coach_id, permission_type)
);

CREATE INDEX IF NOT EXISTS idx_coach_permissions_coach ON coach_permissions(coach_id);
CREATE INDEX IF NOT EXISTS idx_coach_permissions_type ON coach_permissions(permission_type);

COMMENT ON TABLE coach_permissions IS 'Granular permissions for sub-coaches';

-- ============================================
-- PART 2: UPDATE EXISTING TABLES
-- ============================================

-- Update COACHES table
ALTER TABLE coaches
ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_parent_coach BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS can_manage_brand BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_coaches_brand_id ON coaches(brand_id);
CREATE INDEX IF NOT EXISTS idx_coaches_parent ON coaches(is_parent_coach) WHERE is_parent_coach = TRUE;

COMMENT ON COLUMN coaches.brand_id IS 'Associated brand for whitelabel coaching';
COMMENT ON COLUMN coaches.is_parent_coach IS 'TRUE if this coach manages sub-coaches';
COMMENT ON COLUMN coaches.can_manage_brand IS 'TRUE if this coach can edit brand settings';

-- ============================================

-- Update CLIENTS table
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES coaches(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS invite_code TEXT;

CREATE INDEX IF NOT EXISTS idx_clients_brand_id ON clients(brand_id);
CREATE INDEX IF NOT EXISTS idx_clients_invited_by ON clients(invited_by);
CREATE INDEX IF NOT EXISTS idx_clients_invite_code ON clients(invite_code);

COMMENT ON COLUMN clients.brand_id IS 'Brand this client belongs to';
COMMENT ON COLUMN clients.invited_by IS 'Coach who invited this client';
COMMENT ON COLUMN clients.invite_code IS 'Invite code used during signup';

-- ============================================

-- Update COACH_CLIENT_LINKS table
ALTER TABLE coach_client_links
ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES coaches(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_coach_client_links_assigned_by ON coach_client_links(assigned_by);

COMMENT ON COLUMN coach_client_links.assigned_by IS 'Parent coach who created this assignment';
COMMENT ON COLUMN coach_client_links.assigned_at IS 'When this client was assigned to this coach';

-- ============================================
-- PART 3: CREATE RPC FUNCTIONS
-- ============================================

-- 1. CREATE BRAND
CREATE OR REPLACE FUNCTION create_brand(
  p_name TEXT,
  p_logo_url TEXT DEFAULT NULL,
  p_primary_color TEXT DEFAULT '#3B82F6',
  p_secondary_color TEXT DEFAULT '#10B981'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_brand_id UUID;
BEGIN
  INSERT INTO brands (name, logo_url, primary_color, secondary_color)
  VALUES (p_name, p_logo_url, p_primary_color, p_secondary_color)
  RETURNING id INTO v_brand_id;
  
  RETURN v_brand_id;
END;
$$;

-- ============================================

-- 2. UPDATE BRAND
CREATE OR REPLACE FUNCTION update_brand(
  p_brand_id UUID,
  p_name TEXT DEFAULT NULL,
  p_logo_url TEXT DEFAULT NULL,
  p_primary_color TEXT DEFAULT NULL,
  p_secondary_color TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE brands
  SET
    name = COALESCE(p_name, name),
    logo_url = COALESCE(p_logo_url, logo_url),
    primary_color = COALESCE(p_primary_color, primary_color),
    secondary_color = COALESCE(p_secondary_color, secondary_color),
    updated_at = NOW()
  WHERE id = p_brand_id;
  
  RETURN FOUND;
END;
$$;

-- ============================================

-- 3. ADD SUB-COACH
CREATE OR REPLACE FUNCTION add_sub_coach(
  p_parent_coach_id UUID,
  p_child_coach_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_parent_brand_id UUID;
BEGIN
  SELECT brand_id INTO v_parent_brand_id
  FROM coaches
  WHERE id = p_parent_coach_id;
  
  INSERT INTO coach_hierarchy (parent_coach_id, child_coach_id)
  VALUES (p_parent_coach_id, p_child_coach_id)
  ON CONFLICT (parent_coach_id, child_coach_id) DO NOTHING;
  
  UPDATE coaches
  SET brand_id = v_parent_brand_id
  WHERE id = p_child_coach_id;
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;

-- ============================================

-- 4. GENERATE INVITE CODE
CREATE OR REPLACE FUNCTION generate_invite_code(
  p_coach_id UUID,
  p_max_uses INTEGER DEFAULT 1,
  p_expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_code TEXT;
  v_brand_id UUID;
BEGIN
  SELECT brand_id INTO v_brand_id
  FROM coaches
  WHERE id = p_coach_id;
  
  v_code := encode(gen_random_bytes(12), 'base64');
  v_code := replace(v_code, '/', '');
  v_code := replace(v_code, '+', '');
  v_code := replace(v_code, '=', '');
  v_code := lower(v_code);
  
  INSERT INTO coach_invites (code, coach_id, brand_id, max_uses, expires_at)
  VALUES (v_code, p_coach_id, v_brand_id, p_max_uses, p_expires_at);
  
  RETURN v_code;
END;
$$;

-- ============================================

-- 5. VALIDATE INVITE CODE
CREATE OR REPLACE FUNCTION validate_invite_code(
  p_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invite RECORD;
  v_result JSONB;
BEGIN
  SELECT * INTO v_invite
  FROM coach_invites
  WHERE code = p_code
  AND is_active = TRUE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'invalid_code');
  END IF;
  
  IF v_invite.expires_at IS NOT NULL AND v_invite.expires_at < NOW() THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'expired');
  END IF;
  
  IF v_invite.current_uses >= v_invite.max_uses THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'max_uses_reached');
  END IF;
  
  v_result := jsonb_build_object(
    'valid', true,
    'coach_id', v_invite.coach_id,
    'brand_id', v_invite.brand_id,
    'invite_id', v_invite.id
  );
  
  RETURN v_result;
END;
$$;

-- ============================================

-- 6. USE INVITE CODE
CREATE OR REPLACE FUNCTION use_invite_code(
  p_code TEXT,
  p_client_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invite_id UUID;
BEGIN
  UPDATE coach_invites
  SET current_uses = current_uses + 1
  WHERE code = p_code
  AND is_active = TRUE
  AND current_uses < max_uses
  AND (expires_at IS NULL OR expires_at > NOW())
  RETURNING id INTO v_invite_id;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  INSERT INTO analytics_events (event_type, client_id, event_data)
  VALUES ('invite_used', p_client_id, jsonb_build_object('invite_code', p_code));
  
  RETURN TRUE;
END;
$$;

-- ============================================

-- 7. TRANSFER CLIENT
CREATE OR REPLACE FUNCTION transfer_client(
  p_client_id UUID,
  p_from_coach_id UUID,
  p_to_coach_id UUID,
  p_transferred_by UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE coach_client_links
  SET status = 'transferred'
  WHERE client_id = p_client_id
  AND coach_id = p_from_coach_id
  AND status = 'active';
  
  INSERT INTO coach_client_links (coach_id, client_id, status, assigned_by)
  VALUES (p_to_coach_id, p_client_id, 'active', p_transferred_by)
  ON CONFLICT (coach_id, client_id) DO UPDATE
  SET status = 'active', assigned_by = p_transferred_by;
  
  INSERT INTO client_transfers (client_id, from_coach_id, to_coach_id, transferred_by, reason)
  VALUES (p_client_id, p_from_coach_id, p_to_coach_id, p_transferred_by, p_reason);
  
  INSERT INTO analytics_events (event_type, client_id, coach_id, event_data)
  VALUES ('client_transferred', p_client_id, p_to_coach_id, 
    jsonb_build_object('from_coach', p_from_coach_id, 'to_coach', p_to_coach_id));
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;

-- ============================================

-- 8. GET BRAND ANALYTICS
CREATE OR REPLACE FUNCTION get_brand_analytics(
  p_brand_id UUID,
  p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
  p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
  v_total_clients INTEGER;
  v_active_clients INTEGER;
  v_total_sessions INTEGER;
  v_completed_challenges INTEGER;
  v_meal_logs INTEGER;
  v_check_ins INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total_clients
  FROM clients
  WHERE brand_id = p_brand_id;
  
  SELECT COUNT(DISTINCT client_id) INTO v_active_clients
  FROM analytics_events
  WHERE brand_id = p_brand_id
  AND event_type = 'login'
  AND occurred_at BETWEEN p_start_date AND p_end_date;
  
  SELECT COUNT(*) INTO v_total_sessions
  FROM analytics_events
  WHERE brand_id = p_brand_id
  AND event_type = 'session_attend'
  AND occurred_at BETWEEN p_start_date AND p_end_date;
  
  SELECT COUNT(*) INTO v_completed_challenges
  FROM analytics_events
  WHERE brand_id = p_brand_id
  AND event_type = 'challenge_complete'
  AND occurred_at BETWEEN p_start_date AND p_end_date;
  
  SELECT COUNT(*) INTO v_meal_logs
  FROM analytics_events
  WHERE brand_id = p_brand_id
  AND event_type = 'meal_log'
  AND occurred_at BETWEEN p_start_date AND p_end_date;
  
  SELECT COUNT(*) INTO v_check_ins
  FROM analytics_events
  WHERE brand_id = p_brand_id
  AND event_type = 'check_in'
  AND occurred_at BETWEEN p_start_date AND p_end_date;
  
  v_result := jsonb_build_object(
    'total_clients', v_total_clients,
    'active_clients', v_active_clients,
    'total_sessions', v_total_sessions,
    'completed_challenges', v_completed_challenges,
    'meal_logs', v_meal_logs,
    'check_ins', v_check_ins,
    'engagement_rate', CASE WHEN v_total_clients > 0 
      THEN ROUND((v_active_clients::NUMERIC / v_total_clients::NUMERIC) * 100, 2)
      ELSE 0 END
  );
  
  RETURN v_result;
END;
$$;

-- ============================================

-- 9. GET COACH ANALYTICS
CREATE OR REPLACE FUNCTION get_coach_analytics(
  p_coach_id UUID,
  p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
  p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
  v_total_clients INTEGER;
  v_active_clients INTEGER;
  v_sessions INTEGER;
  v_challenges INTEGER;
BEGIN
  SELECT COUNT(DISTINCT client_id) INTO v_total_clients
  FROM coach_client_links
  WHERE coach_id = p_coach_id
  AND status = 'active';
  
  SELECT COUNT(DISTINCT client_id) INTO v_active_clients
  FROM analytics_events
  WHERE coach_id = p_coach_id
  AND event_type = 'login'
  AND occurred_at BETWEEN p_start_date AND p_end_date;
  
  SELECT COUNT(*) INTO v_sessions
  FROM analytics_events
  WHERE coach_id = p_coach_id
  AND event_type = 'session_attend'
  AND occurred_at BETWEEN p_start_date AND p_end_date;
  
  SELECT COUNT(*) INTO v_challenges
  FROM analytics_events
  WHERE coach_id = p_coach_id
  AND event_type = 'challenge_complete'
  AND occurred_at BETWEEN p_start_date AND p_end_date;
  
  v_result := jsonb_build_object(
    'total_clients', v_total_clients,
    'active_clients', v_active_clients,
    'sessions_this_period', v_sessions,
    'challenges_completed', v_challenges
  );
  
  RETURN v_result;
END;
$$;

-- ============================================

-- 10. GET SUB-COACHES
CREATE OR REPLACE FUNCTION get_sub_coaches(
  p_parent_coach_id UUID
)
RETURNS TABLE (
  coach_id UUID,
  full_name TEXT,
  email TEXT,
  client_count BIGINT,
  added_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    p.full_name,
    p.email,
    COUNT(DISTINCT ccl.client_id) as client_count,
    ch.created_at
  FROM coach_hierarchy ch
  JOIN coaches c ON c.id = ch.child_coach_id
  JOIN profiles p ON p.id = c.user_id
  LEFT JOIN coach_client_links ccl ON ccl.coach_id = c.id AND ccl.status = 'active'
  WHERE ch.parent_coach_id = p_parent_coach_id
  GROUP BY c.id, p.full_name, p.email, ch.created_at
  ORDER BY ch.created_at DESC;
END;
$$;

-- ============================================
-- PART 4: CREATE TRIGGERS
-- ============================================

-- 1. Auto-update brands.updated_at
CREATE OR REPLACE FUNCTION update_brands_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER brands_updated_at_trigger
BEFORE UPDATE ON brands
FOR EACH ROW
EXECUTE FUNCTION update_brands_updated_at();

-- ============================================

-- 2. Propagate brand updates to sub-coaches
CREATE OR REPLACE FUNCTION propagate_brand_to_sub_coaches()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE coaches
  SET brand_id = NEW.id
  WHERE id IN (
    SELECT child_coach_id
    FROM coach_hierarchy
    WHERE parent_coach_id IN (
      SELECT id FROM coaches WHERE brand_id = NEW.id
    )
  );
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER brand_propagation_trigger
AFTER UPDATE ON brands
FOR EACH ROW
EXECUTE FUNCTION propagate_brand_to_sub_coaches();

-- ============================================

-- 3. Challenge completion tracking
CREATE OR REPLACE FUNCTION log_challenge_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_client_id UUID;
  v_brand_id UUID;
BEGIN
  SELECT mc.client_id, c.brand_id INTO v_client_id, v_brand_id
  FROM mother_challenges mc
  JOIN clients c ON c.id = mc.client_id
  WHERE mc.id = NEW.mother_challenge_id;
  
  INSERT INTO analytics_events (event_type, client_id, brand_id, event_data)
  VALUES ('challenge_complete', v_client_id, v_brand_id, 
    jsonb_build_object('sub_challenge_id', NEW.id, 'mother_challenge_id', NEW.mother_challenge_id));
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER challenge_completion_analytics_trigger
AFTER UPDATE ON sub_challenges
FOR EACH ROW
WHEN (OLD.completed = FALSE AND NEW.completed = TRUE)
EXECUTE FUNCTION log_challenge_completion();

-- ============================================

-- 4. Meal logging tracking
CREATE OR REPLACE FUNCTION log_meal_event()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_brand_id UUID;
BEGIN
  SELECT brand_id INTO v_brand_id
  FROM clients
  WHERE id = NEW.client_id;
  
  INSERT INTO analytics_events (event_type, client_id, brand_id, event_data)
  VALUES ('meal_log', NEW.client_id, v_brand_id, jsonb_build_object('meal_id', NEW.id));
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER meal_log_analytics_trigger
AFTER INSERT ON meals
FOR EACH ROW
EXECUTE FUNCTION log_meal_event();

-- ============================================
-- PART 5: ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_hierarchy ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_permissions ENABLE ROW LEVEL SECURITY;

-- BRANDS
CREATE POLICY brands_select_policy ON brands
FOR SELECT USING (
  id IN (
    SELECT brand_id FROM coaches WHERE user_id = auth.uid()
  )
);

CREATE POLICY brands_update_policy ON brands
FOR UPDATE USING (
  id IN (
    SELECT brand_id FROM coaches 
    WHERE user_id = auth.uid() AND can_manage_brand = TRUE
  )
);

-- COACH INVITES
CREATE POLICY coach_invites_policy ON coach_invites
FOR ALL USING (
  coach_id IN (
    SELECT id FROM coaches WHERE user_id = auth.uid()
  )
);

-- COACH HIERARCHY
CREATE POLICY coach_hierarchy_policy ON coach_hierarchy
FOR ALL USING (
  parent_coach_id IN (
    SELECT id FROM coaches WHERE user_id = auth.uid()
  )
);

-- CLIENT TRANSFERS
CREATE POLICY client_transfers_policy ON client_transfers
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM coaches c
    JOIN clients cl ON cl.brand_id = c.brand_id
    WHERE c.user_id = auth.uid()
    AND cl.id = client_transfers.client_id
  )
);

-- ANALYTICS EVENTS
CREATE POLICY analytics_events_policy ON analytics_events
FOR SELECT USING (
  brand_id IN (
    SELECT brand_id FROM coaches WHERE user_id = auth.uid()
  )
);

-- ============================================
-- PART 6: GRANT PERMISSIONS
-- ============================================

GRANT EXECUTE ON FUNCTION create_brand TO authenticated;
GRANT EXECUTE ON FUNCTION update_brand TO authenticated;
GRANT EXECUTE ON FUNCTION add_sub_coach TO authenticated;
GRANT EXECUTE ON FUNCTION generate_invite_code TO authenticated;
GRANT EXECUTE ON FUNCTION validate_invite_code TO anon, authenticated;
GRANT EXECUTE ON FUNCTION use_invite_code TO authenticated;
GRANT EXECUTE ON FUNCTION transfer_client TO authenticated;
GRANT EXECUTE ON FUNCTION get_brand_analytics TO authenticated;
GRANT EXECUTE ON FUNCTION get_coach_analytics TO authenticated;
GRANT EXECUTE ON FUNCTION get_sub_coaches TO authenticated;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================

COMMIT;

-- ✅ SUCCESS! Run these to verify:
-- SELECT COUNT(*) FROM brands;
-- SELECT COUNT(*) FROM coach_invites;
-- SELECT COUNT(*) FROM coach_hierarchy;

-- NOTE: Login tracking will be implemented in the app code
-- (AuthContext) to avoid database trigger issues.
