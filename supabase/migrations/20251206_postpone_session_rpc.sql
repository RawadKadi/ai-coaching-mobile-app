-- Function to handle session postponement by a client
-- This function runs with SECURITY DEFINER to bypass RLS for:
-- 1. Cancelling the old session (owned by coach)
-- 2. Creating a new session (owned by coach)
-- 3. Updating the old invite message (sent by coach)
-- 4. Sending a new invite message (sent by coach)

CREATE OR REPLACE FUNCTION postpone_session(
    p_old_session_id uuid,
    p_old_message_id uuid,
    p_new_scheduled_at timestamptz,
    p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_client_id uuid;
    v_coach_id uuid;
    v_coach_user_id uuid;
    v_new_session_id uuid;
    v_old_message_content jsonb;
    v_new_message_content jsonb;
    v_new_session_link text;
BEGIN
    -- 1. Verify ownership and get details
    SELECT client_id, coach_id, meet_link
    INTO v_client_id, v_coach_id, v_new_session_link
    FROM sessions
    WHERE id = p_old_session_id;

    IF v_client_id IS NULL THEN
        RAISE EXCEPTION 'Session not found';
    END IF;

    -- Verify the caller is the client
    -- Note: auth.uid() returns the user_id (auth.users), but sessions.client_id is the public.clients.id
    -- We need to check if the authenticated user corresponds to this client_id
    IF NOT EXISTS (
        SELECT 1 FROM clients 
        WHERE id = v_client_id 
        AND user_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Not authorized to postpone this session';
    END IF;

    -- Get Coach User ID for message sender
    SELECT user_id INTO v_coach_user_id
    FROM coaches
    WHERE id = v_coach_id;

    -- 2. Cancel the OLD session
    UPDATE sessions
    SET status = 'cancelled',
        cancellation_reason = '' || p_reason,
        updated_at = now()
    WHERE id = p_old_session_id;

    -- 3. Create NEW session
    INSERT INTO sessions (
        coach_id,
        client_id,
        scheduled_at,
        duration_minutes,
        meet_link,
        status
    ) VALUES (
        v_coach_id,
        v_client_id,
        p_new_scheduled_at,
        60, -- Default duration
        v_new_session_link, -- Preserve link? Or generate new? Preserving for now.
        'scheduled'
    )
    RETURNING id INTO v_new_session_id;

    -- 4. Update OLD Message (Yellow UI)
    -- Fetch current content to preserve other fields
    SELECT content::jsonb INTO v_old_message_content
    FROM messages
    WHERE id = p_old_message_id;

    -- Update status and add reason
    v_old_message_content := v_old_message_content || jsonb_build_object(
        'status', 'cancelled',
        'cancellationReason', '' || p_reason,
        'postponedTo', p_new_scheduled_at,
        'postponedAt', now()
    );

    UPDATE messages
    SET content = v_old_message_content
    WHERE id = p_old_message_id;

    -- 5. Insert NEW Invite Message (From Coach) - REMOVED per user request
    -- The session is created, but the message will be sent later (e.g. by a scheduled job)
    -- when it is time for the session.

    RETURN jsonb_build_object('success', true, 'new_session_id', v_new_session_id);
END;
$$;
