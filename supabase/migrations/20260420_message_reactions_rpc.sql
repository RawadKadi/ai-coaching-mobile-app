-- ────────────────────────────────────────────────────────────────────────────
-- Fix 1: REPLICA IDENTITY FULL on messages table
-- Without this, Supabase Realtime UPDATE payloads only carry the primary key
-- in p.old. More importantly, the subscriber-side RLS check on UPDATE events
-- can silently drop the event when the payload is incomplete. FULL ensures
-- every column (including `content`) is present in BOTH p.new and p.old.
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE messages REPLICA IDENTITY FULL;

-- ────────────────────────────────────────────────────────────────────────────
-- Fix 2: toggle_message_reaction RPC
--
-- Allows ANY conversation participant (sender OR recipient) to toggle an emoji
-- reaction on a message, regardless of who originally sent it.
--
-- Uses SECURITY DEFINER so it bypasses the RLS UPDATE policy that would
-- otherwise block the coach from updating a message sent by the client.
-- The function performs its own authorization check (participant guard).
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION toggle_message_reaction(
  p_message_id UUID,
  p_emoji      TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  msg               RECORD;
  current_content   JSONB;
  current_reactions JSONB;
  caller_id         UUID;
  has_reaction      BOOLEAN;
  updated_reactions JSONB;
  updated_content   TEXT;
BEGIN
  caller_id := auth.uid();

  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Fetch the target message
  SELECT * INTO msg FROM messages WHERE id = p_message_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Message not found';
  END IF;

  -- Participant guard: only sender or recipient may react
  IF msg.sender_id != caller_id AND msg.recipient_id != caller_id THEN
    RAISE EXCEPTION 'Not authorized to react to this message';
  END IF;

  -- Parse content as JSONB (fall back gracefully for plain-text messages)
  BEGIN
    current_content := msg.content::JSONB;
  EXCEPTION WHEN others THEN
    current_content := jsonb_build_object('text', msg.content, 'type', 'text');
  END;

  -- Extract existing reactions array
  current_reactions := COALESCE(current_content -> 'reactions', '[]'::JSONB);

  -- Determine if this is a toggle-off or a new reaction
  has_reaction := EXISTS (
    SELECT 1
    FROM   jsonb_array_elements(current_reactions) AS r
    WHERE  (r ->> 'user_id') = caller_id::TEXT
    AND    (r ->> 'emoji')   = p_emoji
  );

  IF has_reaction THEN
    -- Remove the matching reaction
    SELECT COALESCE(jsonb_agg(r), '[]'::JSONB)
    INTO   updated_reactions
    FROM   jsonb_array_elements(current_reactions) AS r
    WHERE  NOT (
      (r ->> 'user_id') = caller_id::TEXT
      AND (r ->> 'emoji') = p_emoji
    );
  ELSE
    -- Append the new reaction
    updated_reactions := current_reactions || jsonb_build_array(
      jsonb_build_object('emoji', p_emoji, 'user_id', caller_id::TEXT)
    );
  END IF;

  -- Merge updated reactions back into content
  updated_content := (
    current_content || jsonb_build_object('reactions', updated_reactions)
  )::TEXT;

  -- Persist — triggers Supabase Realtime UPDATE event with full payload
  UPDATE messages SET content = updated_content WHERE id = p_message_id;

  RETURN updated_content;
END;
$$;

-- Grant execution rights to authenticated users
GRANT EXECUTE ON FUNCTION toggle_message_reaction(UUID, TEXT) TO authenticated;
