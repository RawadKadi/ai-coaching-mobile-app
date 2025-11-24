/*
  # Activity Tracking Tables

  ## Overview
  Tables for tracking client activities: check-ins, meals, workouts, habits

  ## 1. New Tables

  ### `check_ins`
  Daily client check-ins with metrics
  - `id` (uuid, PK)
  - `client_id` (uuid, FK to clients)
  - `date` (date)
  - `weight_kg` (numeric)
  - `sleep_hours` (numeric)
  - `energy_level` (integer 1-10)
  - `stress_level` (integer 1-10)
  - `hunger_level` (integer 1-10)
  - `mood` (text)
  - `notes` (text)
  - `photo_urls` (jsonb)
  - `ai_analysis` (text)
  - `created_at` (timestamptz)

  ### `meals`
  Individual meal logs
  - `id` (uuid, PK)
  - `client_id` (uuid, FK to clients)
  - `date` (date)
  - `meal_type` (text: breakfast, lunch, dinner, snack)
  - `name` (text)
  - `description` (text)
  - `calories` (numeric)
  - `protein_g` (numeric)
  - `carbs_g` (numeric)
  - `fat_g` (numeric)
  - `photo_url` (text)
  - `created_at` (timestamptz)

  ### `meal_plans`
  AI-generated meal plans
  - `id` (uuid, PK)
  - `client_id` (uuid, FK to clients)
  - `coach_id` (uuid, FK to coaches)
  - `start_date` (date)
  - `end_date` (date)
  - `daily_calories` (numeric)
  - `meals_data` (jsonb) - structured meal plan
  - `shopping_list` (jsonb)
  - `restrictions` (jsonb)
  - `preferences` (jsonb)
  - `status` (text: draft, approved, active)
  - `ai_generated` (boolean)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### `workouts`
  Individual workout logs
  - `id` (uuid, PK)
  - `client_id` (uuid, FK to clients)
  - `date` (date)
  - `workout_plan_id` (uuid, FK to workout_plans, nullable)
  - `name` (text)
  - `duration_minutes` (integer)
  - `exercises` (jsonb) - array of exercises with sets/reps
  - `notes` (text)
  - `completed` (boolean)
  - `created_at` (timestamptz)

  ### `workout_plans`
  AI-generated workout programs
  - `id` (uuid, PK)
  - `client_id` (uuid, FK to clients)
  - `coach_id` (uuid, FK to coaches)
  - `name` (text)
  - `start_date` (date)
  - `end_date` (date)
  - `goal` (text)
  - `experience_level` (text)
  - `equipment` (jsonb)
  - `weekly_schedule` (jsonb) - structured workout plan
  - `status` (text: draft, approved, active)
  - `ai_generated` (boolean)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### `habits`
  Habit definitions
  - `id` (uuid, PK)
  - `client_id` (uuid, FK to clients)
  - `name` (text)
  - `description` (text)
  - `target_value` (numeric)
  - `unit` (text)
  - `frequency` (text: daily, weekly)
  - `is_active` (boolean)
  - `created_at` (timestamptz)

  ### `habit_logs`
  Daily habit tracking
  - `id` (uuid, PK)
  - `habit_id` (uuid, FK to habits)
  - `client_id` (uuid, FK to clients)
  - `date` (date)
  - `value` (numeric)
  - `completed` (boolean)
  - `notes` (text)
  - `created_at` (timestamptz)

  ## 2. Security
  - Enable RLS on all tables
  - Clients can manage their own data
  - Coaches can view their clients' data
  - AI-generated content requires coach approval

  ## 3. Indexes
  - Fast lookups by client_id and date
  - Status filtering for plans
*/

-- Create enums
DO $$ BEGIN
  CREATE TYPE meal_type AS ENUM ('breakfast', 'lunch', 'dinner', 'snack');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE plan_status AS ENUM ('draft', 'approved', 'active', 'completed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Check-ins table
CREATE TABLE IF NOT EXISTS check_ins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  date date NOT NULL,
  weight_kg numeric,
  sleep_hours numeric,
  energy_level integer CHECK (energy_level >= 1 AND energy_level <= 10),
  stress_level integer CHECK (stress_level >= 1 AND stress_level <= 10),
  hunger_level integer CHECK (hunger_level >= 1 AND hunger_level <= 10),
  mood text,
  notes text,
  photo_urls jsonb DEFAULT '[]'::jsonb,
  ai_analysis text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(client_id, date)
);

-- Meals table
CREATE TABLE IF NOT EXISTS meals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  meal_type meal_type NOT NULL,
  name text NOT NULL,
  description text,
  calories numeric,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
  photo_url text,
  created_at timestamptz DEFAULT now()
);

-- Meal plans table
CREATE TABLE IF NOT EXISTS meal_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  coach_id uuid REFERENCES coaches(id) ON DELETE SET NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  daily_calories numeric,
  meals_data jsonb DEFAULT '{}'::jsonb,
  shopping_list jsonb DEFAULT '[]'::jsonb,
  restrictions jsonb DEFAULT '[]'::jsonb,
  preferences jsonb DEFAULT '[]'::jsonb,
  status plan_status DEFAULT 'draft',
  ai_generated boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Workout plans table (create before workouts due to FK)
CREATE TABLE IF NOT EXISTS workout_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  coach_id uuid REFERENCES coaches(id) ON DELETE SET NULL,
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  goal text,
  experience_level text,
  equipment jsonb DEFAULT '[]'::jsonb,
  weekly_schedule jsonb DEFAULT '{}'::jsonb,
  status plan_status DEFAULT 'draft',
  ai_generated boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Workouts table
CREATE TABLE IF NOT EXISTS workouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  workout_plan_id uuid REFERENCES workout_plans(id) ON DELETE SET NULL,
  name text NOT NULL,
  duration_minutes integer,
  exercises jsonb DEFAULT '[]'::jsonb,
  notes text,
  completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Habits table
CREATE TABLE IF NOT EXISTS habits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  target_value numeric,
  unit text,
  frequency text DEFAULT 'daily',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Habit logs table
CREATE TABLE IF NOT EXISTS habit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id uuid NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  date date NOT NULL,
  value numeric,
  completed boolean DEFAULT false,
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(habit_id, date)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_check_ins_client_date ON check_ins(client_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_meals_client_date ON meals(client_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_meal_plans_client_status ON meal_plans(client_id, status);
CREATE INDEX IF NOT EXISTS idx_workouts_client_date ON workouts(client_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_workout_plans_client_status ON workout_plans(client_id, status);
CREATE INDEX IF NOT EXISTS idx_habits_client_active ON habits(client_id, is_active);
CREATE INDEX IF NOT EXISTS idx_habit_logs_habit_date ON habit_logs(habit_id, date DESC);

-- Enable RLS
ALTER TABLE check_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE habit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for check_ins
CREATE POLICY "Clients can manage their own check-ins"
  ON check_ins FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = check_ins.client_id
      AND clients.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = check_ins.client_id
      AND clients.user_id = auth.uid()
    )
  );

CREATE POLICY "Coaches can view their clients check-ins"
  ON check_ins FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM coach_client_links ccl
      JOIN coaches co ON co.id = ccl.coach_id
      WHERE ccl.client_id = check_ins.client_id
      AND co.user_id = auth.uid()
      AND ccl.status = 'active'
    )
  );

-- RLS Policies for meals
CREATE POLICY "Clients can manage their own meals"
  ON meals FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = meals.client_id
      AND clients.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = meals.client_id
      AND clients.user_id = auth.uid()
    )
  );

CREATE POLICY "Coaches can view their clients meals"
  ON meals FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM coach_client_links ccl
      JOIN coaches co ON co.id = ccl.coach_id
      WHERE ccl.client_id = meals.client_id
      AND co.user_id = auth.uid()
      AND ccl.status = 'active'
    )
  );

-- RLS Policies for meal_plans
CREATE POLICY "Clients can view their meal plans"
  ON meal_plans FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = meal_plans.client_id
      AND clients.user_id = auth.uid()
    )
  );

CREATE POLICY "Coaches can manage meal plans for their clients"
  ON meal_plans FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM coach_client_links ccl
      JOIN coaches co ON co.id = ccl.coach_id
      WHERE ccl.client_id = meal_plans.client_id
      AND co.user_id = auth.uid()
      AND ccl.status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM coach_client_links ccl
      JOIN coaches co ON co.id = ccl.coach_id
      WHERE ccl.client_id = meal_plans.client_id
      AND co.user_id = auth.uid()
      AND ccl.status = 'active'
    )
  );

-- RLS Policies for workouts
CREATE POLICY "Clients can manage their own workouts"
  ON workouts FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = workouts.client_id
      AND clients.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = workouts.client_id
      AND clients.user_id = auth.uid()
    )
  );

CREATE POLICY "Coaches can view their clients workouts"
  ON workouts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM coach_client_links ccl
      JOIN coaches co ON co.id = ccl.coach_id
      WHERE ccl.client_id = workouts.client_id
      AND co.user_id = auth.uid()
      AND ccl.status = 'active'
    )
  );

-- RLS Policies for workout_plans
CREATE POLICY "Clients can view their workout plans"
  ON workout_plans FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = workout_plans.client_id
      AND clients.user_id = auth.uid()
    )
  );

CREATE POLICY "Coaches can manage workout plans for their clients"
  ON workout_plans FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM coach_client_links ccl
      JOIN coaches co ON co.id = ccl.coach_id
      WHERE ccl.client_id = workout_plans.client_id
      AND co.user_id = auth.uid()
      AND ccl.status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM coach_client_links ccl
      JOIN coaches co ON co.id = ccl.coach_id
      WHERE ccl.client_id = workout_plans.client_id
      AND co.user_id = auth.uid()
      AND ccl.status = 'active'
    )
  );

-- RLS Policies for habits
CREATE POLICY "Clients can manage their own habits"
  ON habits FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = habits.client_id
      AND clients.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = habits.client_id
      AND clients.user_id = auth.uid()
    )
  );

CREATE POLICY "Coaches can view their clients habits"
  ON habits FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM coach_client_links ccl
      JOIN coaches co ON co.id = ccl.coach_id
      WHERE ccl.client_id = habits.client_id
      AND co.user_id = auth.uid()
      AND ccl.status = 'active'
    )
  );

-- RLS Policies for habit_logs
CREATE POLICY "Clients can manage their own habit logs"
  ON habit_logs FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = habit_logs.client_id
      AND clients.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = habit_logs.client_id
      AND clients.user_id = auth.uid()
    )
  );

CREATE POLICY "Coaches can view their clients habit logs"
  ON habit_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM coach_client_links ccl
      JOIN coaches co ON co.id = ccl.coach_id
      WHERE ccl.client_id = habit_logs.client_id
      AND co.user_id = auth.uid()
      AND ccl.status = 'active'
    )
  );

-- Triggers for updated_at
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_meal_plans_updated_at') THEN
    DROP TRIGGER update_meal_plans_updated_at ON meal_plans;
  END IF;
END $$;

CREATE TRIGGER update_meal_plans_updated_at BEFORE UPDATE ON meal_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_workout_plans_updated_at') THEN
    DROP TRIGGER update_workout_plans_updated_at ON workout_plans;
  END IF;
END $$;

CREATE TRIGGER update_workout_plans_updated_at BEFORE UPDATE ON workout_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();