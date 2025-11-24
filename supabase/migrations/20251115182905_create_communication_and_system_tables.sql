/*
  # Communication and System Tables

  ## Overview
  Tables for messaging, notifications, AI tracking, programs, and admin features

  ## 1. New Tables

  ### `messages`
  Coach-client messaging
  - `id` (uuid, PK)
  - `sender_id` (uuid, FK to profiles)
  - `recipient_id` (uuid, FK to profiles)
  - `content` (text)
  - `read` (boolean)
  - `ai_generated` (boolean)
  - `created_at` (timestamptz)

  ### `notifications`
  In-app notifications
  - `id` (uuid, PK)
  - `user_id` (uuid, FK to profiles)
  - `title` (text)
  - `message` (text)
  - `type` (text)
  - `read` (boolean)
  - `action_url` (text)
  - `created_at` (timestamptz)

  ### `programs`
  Multi-week training programs
  - `id` (uuid, PK)
  - `coach_id` (uuid, FK to coaches)
  - `name` (text)
  - `description` (text)
  - `duration_weeks` (integer)
  - `program_data` (jsonb) - structured weekly content
  - `is_template` (boolean)
  - `ai_generated` (boolean)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### `ai_requests`
  Log all AI API calls
  - `id` (uuid, PK)
  - `user_id` (uuid, FK to profiles)
  - `request_type` (text)
  - `prompt` (text)
  - `response` (text)
  - `tokens_used` (integer)
  - `cost` (numeric)
  - `status` (text)
  - `error_message` (text)
  - `created_at` (timestamptz)

  ### `system_logs`
  Admin system logs
  - `id` (uuid, PK)
  - `level` (text: info, warning, error)
  - `category` (text)
  - `message` (text)
  - `metadata` (jsonb)
  - `user_id` (uuid, FK to profiles, nullable)
  - `created_at` (timestamptz)

  ### `subscriptions`
  Coach subscription management
  - `id` (uuid, PK)
  - `coach_id` (uuid, FK to coaches)
  - `tier` (text)
  - `status` (text: active, canceled, expired)
  - `stripe_subscription_id` (text)
  - `current_period_start` (timestamptz)
  - `current_period_end` (timestamptz)
  - `cancel_at_period_end` (boolean)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### `payments`
  Payment history
  - `id` (uuid, PK)
  - `coach_id` (uuid, FK to coaches)
  - `amount` (numeric)
  - `currency` (text)
  - `status` (text)
  - `stripe_payment_id` (text)
  - `description` (text)
  - `created_at` (timestamptz)

  ## 2. Security
  - Enable RLS on all tables
  - Messages: only sender and recipient can access
  - Notifications: users see only their own
  - Programs: coaches manage their own
  - AI requests: coaches see their own, admins see all
  - System logs: admin only
  - Subscriptions/Payments: coach and admin access

  ## 3. Indexes
  - Message lookups by participants
  - Notification queries by user
  - AI request tracking by user and type
*/

-- Create enums
DO $$ BEGIN
  CREATE TYPE log_level AS ENUM ('info', 'warning', 'error');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE subscription_status AS ENUM ('active', 'canceled', 'expired', 'trialing');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('pending', 'succeeded', 'failed', 'refunded');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  read boolean DEFAULT false,
  ai_generated boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL,
  read boolean DEFAULT false,
  action_url text,
  created_at timestamptz DEFAULT now()
);

-- Programs table
CREATE TABLE IF NOT EXISTS programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES coaches(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  duration_weeks integer NOT NULL,
  program_data jsonb DEFAULT '{}'::jsonb,
  is_template boolean DEFAULT true,
  ai_generated boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- AI requests table
CREATE TABLE IF NOT EXISTS ai_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  request_type text NOT NULL,
  prompt text,
  response text,
  tokens_used integer,
  cost numeric(10, 4),
  status text DEFAULT 'pending',
  error_message text,
  created_at timestamptz DEFAULT now()
);

-- System logs table
CREATE TABLE IF NOT EXISTS system_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level log_level NOT NULL,
  category text NOT NULL,
  message text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid UNIQUE NOT NULL REFERENCES coaches(id) ON DELETE CASCADE,
  tier text NOT NULL DEFAULT 'free',
  status subscription_status DEFAULT 'active',
  stripe_subscription_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES coaches(id) ON DELETE CASCADE,
  amount numeric(10, 2) NOT NULL,
  currency text DEFAULT 'usd',
  status payment_status DEFAULT 'pending',
  stripe_payment_id text,
  description text,
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(sender_id, recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_programs_coach ON programs(coach_id);
CREATE INDEX IF NOT EXISTS idx_ai_requests_user ON ai_requests(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_requests_type ON ai_requests(request_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_level ON system_logs(level, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_category ON system_logs(category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscriptions_coach ON subscriptions(coach_id);
CREATE INDEX IF NOT EXISTS idx_payments_coach ON payments(coach_id, created_at DESC);

-- Enable RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for messages
CREATE POLICY "Users can view messages they sent"
  ON messages FOR SELECT
  TO authenticated
  USING (sender_id = auth.uid());

CREATE POLICY "Users can view messages they received"
  ON messages FOR SELECT
  TO authenticated
  USING (recipient_id = auth.uid());

CREATE POLICY "Users can send messages"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Users can update messages they received"
  ON messages FOR UPDATE
  TO authenticated
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

-- RLS Policies for notifications
CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- RLS Policies for programs
CREATE POLICY "Coaches can manage their own programs"
  ON programs FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM coaches
      WHERE coaches.id = programs.coach_id
      AND coaches.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM coaches
      WHERE coaches.id = programs.coach_id
      AND coaches.user_id = auth.uid()
    )
  );

CREATE POLICY "Clients can view programs from their coaches"
  ON programs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM coach_client_links ccl
      JOIN clients c ON c.id = ccl.client_id
      WHERE ccl.coach_id = programs.coach_id
      AND c.user_id = auth.uid()
      AND ccl.status = 'active'
    )
  );

-- RLS Policies for ai_requests
CREATE POLICY "Users can view their own AI requests"
  ON ai_requests FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all AI requests"
  ON ai_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- RLS Policies for system_logs
CREATE POLICY "Admins can view all system logs"
  ON system_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- RLS Policies for subscriptions
CREATE POLICY "Coaches can view their own subscription"
  ON subscriptions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM coaches
      WHERE coaches.id = subscriptions.coach_id
      AND coaches.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all subscriptions"
  ON subscriptions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- RLS Policies for payments
CREATE POLICY "Coaches can view their own payments"
  ON payments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM coaches
      WHERE coaches.id = payments.coach_id
      AND coaches.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all payments"
  ON payments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Triggers for updated_at
CREATE TRIGGER update_programs_updated_at BEFORE UPDATE ON programs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();