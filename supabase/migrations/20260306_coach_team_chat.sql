-- Migration: get_team_coaches()
-- Returns all teammates of the calling coach (same team, excluding self).
-- SECURITY DEFINER bypasses RLS — same pattern as get_sub_coaches().

CREATE OR REPLACE FUNCTION get_team_coaches()
RETURNS TABLE (
  coach_id   UUID,
  user_id    UUID,
  full_name  TEXT,
  avatar_url TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_my_coach_id   UUID;
  v_root_coach_id UUID;
BEGIN
  -- Resolve caller's coach record
  SELECT c.id INTO v_my_coach_id
  FROM coaches c
  WHERE c.user_id = auth.uid()
  LIMIT 1;

  IF v_my_coach_id IS NULL THEN
    RETURN;
  END IF;

  -- Find team root (my parent if I'm a sub-coach, else I am the root)
  SELECT COALESCE(
    (
      SELECT ch.parent_coach_id
      FROM coach_hierarchy ch
      WHERE ch.child_coach_id = v_my_coach_id
        AND (ch.status IS NULL OR ch.status != 'terminated')
      LIMIT 1
    ),
    v_my_coach_id
  ) INTO v_root_coach_id;

  -- Use a CTE with internal aliases to avoid ambiguity with the OUT parameter 'user_id'
  RETURN QUERY
    WITH members AS (
      -- Root coach (when I am a sub-coach)
      SELECT c.id AS r_coach_id, c.user_id AS r_user_id, p.full_name AS r_full_name, p.avatar_url AS r_avatar_url
      FROM coaches c
      JOIN profiles p ON p.id = c.user_id
      WHERE c.id = v_root_coach_id
        AND c.id <> v_my_coach_id
        AND c.is_active = true

      UNION ALL

      -- All active sub-coaches under root (siblings when I am also a sub-coach)
      SELECT c.id, c.user_id, p.full_name, p.avatar_url
      FROM coach_hierarchy ch
      JOIN coaches c ON c.id = ch.child_coach_id
      JOIN profiles p ON p.id = c.user_id
      WHERE ch.parent_coach_id = v_root_coach_id
        AND (ch.status IS NULL OR ch.status != 'terminated')
        AND ch.child_coach_id IS NOT NULL
        AND c.id <> v_my_coach_id
        AND c.is_active = true
    )
    SELECT
      m.r_coach_id   AS coach_id,
      m.r_user_id    AS user_id,
      m.r_full_name  AS full_name,
      m.r_avatar_url AS avatar_url
    FROM members m;
END;
$$;

GRANT EXECUTE ON FUNCTION get_team_coaches() TO authenticated;
