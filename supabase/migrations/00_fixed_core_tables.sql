/*
  # Fixed Core Database Schema - No Infinite Recursion
  
  This is a corrected version that removes the circular RLS policies
  that were causing infinite recursion errors.
*/

-- Create enum for user roles
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('client', 'coach', 'admin');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create enum for coach client link status
DO $$ BEGIN
  CREATE TYPE link_status AS ENUM ('active', 'inactive', 'pending');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'client',
  full_name text NOT NULL,
  phone text,
  avatar_url text,
  timezone text DEFAULT 'UTC',
  onboarding_completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Coaches table
CREATE TABLE IF NOT EXISTS coaches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  business_name text,
  specialty text,
  bio text,
  brand_color text DEFAULT '#3B82F6',
  logo_url text,
  is_active boolean DEFAULT true,
  subscription_tier text DEFAULT 'free',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Clients table
CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date_of_birth date,
  gender text,
  height_cm numeric,
  goal text,
  experience_level text,
  dietary_restrictions jsonb DEFAULT '[]'::jsonb,
  medical_conditions jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Coach-Client Links (many-to-many)
CREATE TABLE IF NOT EXISTS coach_client_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES coaches(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  status link_status DEFAULT 'pending',
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(coach_id, client_id)
);

-- AI Coach Brains
CREATE TABLE IF NOT EXISTS ai_coach_brains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid UNIQUE NOT NULL REFERENCES coaches(id) ON DELETE CASCADE,
  tone text DEFAULT 'professional and motivating',
  style text DEFAULT 'supportive and educational',
  philosophy text,
  rules jsonb DEFAULT '[]'::jsonb,
  forbidden_advice jsonb DEFAULT '[]'::jsonb,
  specialty_focus text,
  system_prompt text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_coaches_user_id ON coaches(user_id);
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients(user_id);
CREATE INDEX IF NOT EXISTS idx_coach_client_links_coach ON coach_client_links(coach_id);
CREATE INDEX IF NOT EXISTS idx_coach_client_links_client ON coach_client_links(client_id);
CREATE INDEX IF NOT EXISTS idx_coach_client_links_status ON coach_client_links(status);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE coaches ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_client_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_coach_brains ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- RLS Policies for coaches - SIMPLE, NO RECURSION
CREATE POLICY "Coaches can view their own data"
  ON coaches FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Coaches can update their own data"
  ON coaches FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Coaches can insert their own data"
  ON coaches FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- RLS Policies for clients - SIMPLE, NO RECURSION
CREATE POLICY "Clients can view their own data"
  ON clients FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Clients can update their own data"
  ON clients FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Clients can insert their own data"
  ON clients FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- RLS Policies for coach_client_links - SIMPLE
CREATE POLICY "Users can view their own links"
  ON coach_client_links FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM coaches
      WHERE coaches.id = coach_client_links.coach_id
      AND coaches.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = coach_client_links.client_id
      AND clients.user_id = auth.uid()
    )
  );

CREATE POLICY "Coaches can manage their client links"
  ON coach_client_links FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM coaches
      WHERE coaches.id = coach_client_links.coach_id
      AND coaches.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM coaches
      WHERE coaches.id = coach_client_links.coach_id
      AND coaches.user_id = auth.uid()
    )
  );

-- RLS Policies for ai_coach_brains
CREATE POLICY "Coaches can view their AI brain"
  ON ai_coach_brains FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM coaches
      WHERE coaches.id = ai_coach_brains.coach_id
      AND coaches.user_id = auth.uid()
    )
  );

CREATE POLICY "Coaches can update their AI brain"
  ON ai_coach_brains FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM coaches
      WHERE coaches.id = ai_coach_brains.coach_id
      AND coaches.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM coaches
      WHERE coaches.id = ai_coach_brains.coach_id
      AND coaches.user_id = auth.uid()
    )
  );

CREATE POLICY "Coaches can insert their AI brain"
  ON ai_coach_brains FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM coaches
      WHERE coaches.id = ai_coach_brains.coach_id
      AND coaches.user_id = auth.uid()
    )
  );

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_coaches_updated_at BEFORE UPDATE ON coaches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_coach_brains_updated_at BEFORE UPDATE ON ai_coach_brains
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
