-- Drop and recreate the trigger function with duplicate handling
DROP FUNCTION IF EXISTS auto_link_client_to_coach() CASCADE;

CREATE OR REPLACE FUNCTION auto_link_client_to_coach()
RETURNS TRIGGER AS $$
DECLARE
    v_coach_id uuid;
    v_coach_user_id uuid;
    v_link_exists boolean;
BEGIN
    -- Check if this client is already linked to ANY coach
    SELECT EXISTS(
        SELECT 1 FROM coach_client_links 
        WHERE client_id = NEW.id
    ) INTO v_link_exists;

    -- If already linked, skip
    IF v_link_exists THEN
        RAISE NOTICE 'Client % already linked to a coach, skipping', NEW.id;
        RETURN NEW;
    END IF;

    -- Find the first active coach
    SELECT id, user_id INTO v_coach_id, v_coach_user_id
    FROM coaches
    WHERE is_active = true
    ORDER BY created_at ASC
    LIMIT 1;

    -- If we found a coach, create the link
    IF v_coach_id IS NOT NULL THEN
        -- Use ON CONFLICT DO NOTHING to handle race conditions
        INSERT INTO coach_client_links (coach_id, client_id, status, started_at)
        VALUES (v_coach_id, NEW.id, 'active', NOW())
        ON CONFLICT (coach_id, client_id) DO NOTHING;

        -- Insert a notification for the coach
        INSERT INTO notifications (user_id, title, message, type, read)
        VALUES (
            v_coach_user_id,
            'New Client!',
            'A new client has signed up and been assigned to you. Set up their sessions now.',
            'new_client',
            false
        );
        
        RAISE NOTICE 'Client % linked to coach %', NEW.id, v_coach_id;
    ELSE
        RAISE WARNING 'No active coaches found to link client %', NEW.id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
DROP TRIGGER IF EXISTS trigger_auto_link_client ON clients;
CREATE TRIGGER trigger_auto_link_client
    AFTER INSERT ON clients
    FOR EACH ROW
    EXECUTE FUNCTION auto_link_client_to_coach();
