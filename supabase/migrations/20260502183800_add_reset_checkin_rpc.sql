
-- Function to reset today's check-in for the calling user
CREATE OR REPLACE FUNCTION reset_today_checkin()
RETURNS void AS $$
BEGIN
    DELETE FROM public.check_ins
    WHERE client_id = auth.uid()
    AND date = CURRENT_DATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
