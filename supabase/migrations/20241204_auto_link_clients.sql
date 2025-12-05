-- Auto-link new clients to coaches and notify
-- This trigger fires when a new client is created

CREATE OR REPLACE FUNCTION auto_link_client_to_coach()
RETURNS TRIGGER AS $$
DECLARE
    v_coach_id uuid;
    v_coach_user_id uuid;
BEGIN
    -- Find the first active coach
    SELECT id, user_id INTO v_coach_id, v_coach_user_id
    FROM coaches
    WHERE is_active = true
    ORDER BY created_at ASC
    LIMIT 1;

    -- If we found a coach, create the link
    IF v_coach_id IS NOT NULL THEN
        INSERT INTO coach_client_links (coach_id, client_id, status, started_at)
        VALUES (v_coach_id, NEW.id, 'active', NOW());

        -- Insert a notification for the coach
        INSERT INTO notifications (user_id, title, message, type, read)
        VALUES (
            v_coach_user_id,
            'New Client!',
            'A new client has signed up and been assigned to you. Set up their sessions now.',
            'new_client',
            false
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS trigger_auto_link_client ON clients;
CREATE TRIGGER trigger_auto_link_client
    AFTER INSERT ON clients
    FOR EACH ROW
    EXECUTE FUNCTION auto_link_client_to_coach();
