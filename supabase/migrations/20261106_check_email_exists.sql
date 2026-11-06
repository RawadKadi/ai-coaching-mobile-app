-- ============================================
-- Check Email Exists RPC
-- ============================================
-- Checks if an email is already registered in auth.users
-- Callable by anon and authenticated

CREATE OR REPLACE FUNCTION check_email_exists(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM auth.users WHERE LOWER(email) = LOWER(p_email)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION check_email_exists(TEXT) TO anon, authenticated;
