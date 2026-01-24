-- =====================================================
-- BRAND THEMING SYSTEM - COMPREHENSIVE UPGRADE
-- Migration: 20260117_comprehensive_brand_theming.sql
-- Description: Adds comprehensive theming capabilities to brands table
-- =====================================================

-- Add new columns to brands table for full theming control
ALTER TABLE brands
-- Typography Settings
ADD COLUMN font_family TEXT DEFAULT 'System',
ADD COLUMN heading_font_weight TEXT DEFAULT '700',
ADD COLUMN body_font_weight TEXT DEFAULT '400',
ADD COLUMN font_scale NUMERIC DEFAULT 1.0 CHECK (font_scale >= 0.5 AND font_scale <= 2.0),

-- Extended Color Palette
ADD COLUMN accent_color TEXT DEFAULT '#F59E0B',
ADD COLUMN background_color TEXT DEFAULT '#F9FAFB',

-- Button Styling
ADD COLUMN button_shape TEXT DEFAULT 'rounded' CHECK (button_shape IN ('rounded', 'pill', 'square')),
ADD COLUMN button_style TEXT DEFAULT 'flat' CHECK (button_style IN ('flat', 'gradient', 'outlined')),
ADD COLUMN button_shadow_enabled BOOLEAN DEFAULT false,

-- Spacing & Elevation
ADD COLUMN spacing_scale NUMERIC DEFAULT 1.0 CHECK (spacing_scale >= 0.5 AND spacing_scale <= 2.0),
ADD COLUMN card_shadow TEXT DEFAULT 'medium' CHECK (card_shadow IN ('none', 'small', 'medium', 'large')),
ADD COLUMN border_radius_scale NUMERIC DEFAULT 1.0 CHECK (border_radius_scale >= 0.5 AND border_radius_scale <= 3.0),

-- Dark Mode Support
ADD COLUMN dark_mode_enabled BOOLEAN DEFAULT false,
ADD COLUMN dark_primary_color TEXT,
ADD COLUMN dark_secondary_color TEXT,
ADD COLUMN dark_accent_color TEXT,
ADD COLUMN dark_background_color TEXT;

-- =====================================================
-- UPDATE RPC FUNCTIONS
-- =====================================================

-- Drop existing functions first to avoid conflicts
-- Using CASCADE to drop all overloaded versions
DROP FUNCTION IF EXISTS update_brand CASCADE;
DROP FUNCTION IF EXISTS get_brand_theme CASCADE;

-- Update the update_brand RPC function to handle all new fields
CREATE OR REPLACE FUNCTION update_brand(
  p_brand_id UUID,
  p_name TEXT DEFAULT NULL,
  p_logo_url TEXT DEFAULT NULL,
  p_primary_color TEXT DEFAULT NULL,
  p_secondary_color TEXT DEFAULT NULL,
  p_accent_color TEXT DEFAULT NULL,
  p_background_color TEXT DEFAULT NULL,
  p_font_family TEXT DEFAULT NULL,
  p_heading_font_weight TEXT DEFAULT NULL,
  p_body_font_weight TEXT DEFAULT NULL,
  p_font_scale NUMERIC DEFAULT NULL,
  p_button_shape TEXT DEFAULT NULL,
  p_button_style TEXT DEFAULT NULL,
  p_button_shadow_enabled BOOLEAN DEFAULT NULL,
  p_spacing_scale NUMERIC DEFAULT NULL,
  p_card_shadow TEXT DEFAULT NULL,
  p_border_radius_scale NUMERIC DEFAULT NULL,
  p_dark_mode_enabled BOOLEAN DEFAULT NULL,
  p_dark_primary_color TEXT DEFAULT NULL,
  p_dark_secondary_color TEXT DEFAULT NULL,
  p_dark_accent_color TEXT DEFAULT NULL,
  p_dark_background_color TEXT DEFAULT NULL
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_coach_id UUID;
  v_can_manage BOOLEAN;
BEGIN
  -- Get current user's coach ID
  SELECT id, can_manage_brand INTO v_coach_id, v_can_manage
  FROM coaches
  WHERE user_id = auth.uid();

  -- Check if user has permission to manage this brand
  IF NOT v_can_manage THEN
    RAISE EXCEPTION 'User does not have permission to manage brand';
  END IF;

  -- Verify the brand belongs to this coach
  IF NOT EXISTS (
    SELECT 1 FROM coaches
    WHERE id = v_coach_id AND brand_id = p_brand_id
  ) THEN
    RAISE EXCEPTION 'Brand does not belong to this coach';
  END IF;

  -- Update brand with provided values (only update non-null parameters)
  UPDATE brands
  SET
    name = COALESCE(p_name, name),
    logo_url = COALESCE(p_logo_url, logo_url),
    primary_color = COALESCE(p_primary_color, primary_color),
    secondary_color = COALESCE(p_secondary_color, secondary_color),
    accent_color = COALESCE(p_accent_color, accent_color),
    background_color = COALESCE(p_background_color, background_color),
    font_family = COALESCE(p_font_family, font_family),
    heading_font_weight = COALESCE(p_heading_font_weight, heading_font_weight),
    body_font_weight = COALESCE(p_body_font_weight, body_font_weight),
    font_scale = COALESCE(p_font_scale, font_scale),
    button_shape = COALESCE(p_button_shape, button_shape),
    button_style = COALESCE(p_button_style, button_style),
    button_shadow_enabled = COALESCE(p_button_shadow_enabled, button_shadow_enabled),
    spacing_scale = COALESCE(p_spacing_scale, spacing_scale),
    card_shadow = COALESCE(p_card_shadow, card_shadow),
    border_radius_scale = COALESCE(p_border_radius_scale, border_radius_scale),
    dark_mode_enabled = COALESCE(p_dark_mode_enabled, dark_mode_enabled),
    dark_primary_color = COALESCE(p_dark_primary_color, dark_primary_color),
    dark_secondary_color = COALESCE(p_dark_secondary_color, dark_secondary_color),
    dark_accent_color = COALESCE(p_dark_accent_color, dark_accent_color),
    dark_background_color = COALESCE(p_dark_background_color, dark_background_color),
    updated_at = NOW()
  WHERE id = p_brand_id;

  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to update brand: %', SQLERRM;
    RETURN FALSE;
END;
$$;

-- =====================================================
-- CREATE RPC FUNCTION: get_brand_theme
-- =====================================================

CREATE OR REPLACE FUNCTION get_brand_theme(
  p_brand_id UUID
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_brand brands;
  v_theme JSON;
BEGIN
  -- Get brand record
  SELECT * INTO v_brand FROM brands WHERE id = p_brand_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Build complete theme object
  v_theme := json_build_object(
    'id', v_brand.id,
    'name', v_brand.name,
    'logo_url', v_brand.logo_url,
    'colors', json_build_object(
      'primary', v_brand.primary_color,
      'secondary', v_brand.secondary_color,
      'accent', v_brand.accent_color,
      'background', v_brand.background_color
    ),
    'typography', json_build_object(
      'fontFamily', v_brand.font_family,
      'headingWeight', v_brand.heading_font_weight,
      'bodyWeight', v_brand.body_font_weight,
      'scale', v_brand.font_scale
    ),
    'button', json_build_object(
      'shape', v_brand.button_shape,
      'style', v_brand.button_style,
      'shadowEnabled', v_brand.button_shadow_enabled
    ),
    'spacing', json_build_object(
      'scale', v_brand.spacing_scale,
      'cardShadow', v_brand.card_shadow,
      'borderRadiusScale', v_brand.border_radius_scale
    ),
    'darkMode', json_build_object(
      'enabled', v_brand.dark_mode_enabled,
      'colors', json_build_object(
        'primary', v_brand.dark_primary_color,
        'secondary', v_brand.dark_secondary_color,
        'accent', v_brand.dark_accent_color,
        'background', v_brand.dark_background_color
      )
    )
  );

  RETURN v_theme;
END;
$$;

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

GRANT EXECUTE ON FUNCTION update_brand TO authenticated;
GRANT EXECUTE ON FUNCTION get_brand_theme TO authenticated;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON COLUMN brands.font_family IS 'Font family for brand typography (e.g., System, Inter, Roboto)';
COMMENT ON COLUMN brands.heading_font_weight IS 'Font weight for headings (e.g., 400-900)';
COMMENT ON COLUMN brands.body_font_weight IS 'Font weight for body text (e.g., 400-700)';
COMMENT ON COLUMN brands.font_scale IS 'Typography scale multiplier (0.5-2.0)';
COMMENT ON COLUMN brands.accent_color IS 'Accent color for highlights, badges, and links';
COMMENT ON COLUMN brands.background_color IS 'Background color for app surfaces';
COMMENT ON COLUMN brands.button_shape IS 'Button border radius style (rounded, pill, square)';
COMMENT ON COLUMN brands.button_style IS 'Button appearance style (flat, gradient, outlined)';
COMMENT ON COLUMN brands.button_shadow_enabled IS 'Whether buttons have drop shadows';
COMMENT ON COLUMN brands.spacing_scale IS 'Spacing scale multiplier (0.5-2.0)';
COMMENT ON COLUMN brands.card_shadow IS 'Shadow size for cards (none, small, medium, large)';
COMMENT ON COLUMN brands.border_radius_scale IS 'Border radius scale multiplier (0.5-3.0)';
COMMENT ON COLUMN brands.dark_mode_enabled IS 'Whether dark mode is available for this brand';
COMMENT ON COLUMN brands.dark_primary_color IS 'Primary color for dark mode (auto-generated if null)';
COMMENT ON COLUMN brands.dark_secondary_color IS 'Secondary color for dark mode (auto-generated if null)';
COMMENT ON COLUMN brands.dark_accent_color IS 'Accent color for dark mode (auto-generated if null)';
COMMENT ON COLUMN brands.dark_background_color IS 'Background color for dark mode (auto-generated if null)';
