CREATE OR REPLACE FUNCTION create_meal_entry(
    p_client_id UUID,
    p_meal_date DATE,
    p_meal_time TIME,
    p_meal_type TEXT,
    p_meal_name TEXT,
    p_description TEXT,
    p_calories NUMERIC,
    p_protein_g NUMERIC,
    p_carbs_g NUMERIC,
    p_fat_g NUMERIC,
    p_photo_url TEXT,
    p_ai_analyzed BOOLEAN,
    p_shared_with_coach BOOLEAN
)
RETURNS SETOF meals
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with owner privileges
AS $$
BEGIN
    -- Verify ownership: the authenticated user must be the owner of the client record
    IF NOT EXISTS (
        SELECT 1 FROM clients 
        WHERE id = p_client_id 
        AND user_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Client ID % does not belong to the authenticated user %', p_client_id, auth.uid();
    END IF;

    RETURN QUERY
    INSERT INTO meals (
        client_id,
        meal_date,
        meal_time,
        meal_type,
        meal_name,
        description,
        calories,
        protein_g,
        carbs_g,
        fat_g,
        photo_url,
        ai_analyzed,
        shared_with_coach
    )
    VALUES (
        p_client_id,
        p_meal_date,
        p_meal_time,
        p_meal_type::meal_type, -- Explicit cast to the enum type
        p_meal_name,
        p_description,
        p_calories,
        p_protein_g,
        p_carbs_g,
        p_fat_g,
        p_photo_url,
        p_ai_analyzed,
        p_shared_with_coach
    )
    RETURNING *;
END;
$$;
