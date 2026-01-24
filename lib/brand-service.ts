import { supabase } from '@/lib/supabase';

/**
 * Creates a default brand for a coach when they first set up whitelabel
 */
export async function createDefaultBrand(
    coachId: string,
    brandName: string
): Promise<{ success: boolean; brandId?: string; error?: string }> {
    try {
        console.log('[BrandService] Creating default brand for coach:', coachId);

        // Create brand using RPC
        const { data: brandId, error: brandError } = await supabase.rpc('create_brand', {
            p_name: brandName,
            p_logo_url: null,
            p_primary_color: '#3B82F6',
            p_secondary_color: '#10B981',
        });

        if (brandError) {
            console.error('[BrandService] Error creating brand:', brandError);
            return { success: false, error: brandError.message };
        }

        console.log('[BrandService] Brand created:', brandId);

        // Update coach with brand_id and permissions
        const { error: coachUpdateError } = await supabase
            .from('coaches')
            .update({
                brand_id: brandId,
                is_parent_coach: true,
                can_manage_brand: true,
            })
            .eq('id', coachId);

        if (coachUpdateError) {
            console.error('[BrandService] Error updating coach:', coachUpdateError);
            return { success: false, error: coachUpdateError.message };
        }

        console.log('[BrandService] Coach updated with brand');

        return { success: true, brandId };
    } catch (error: any) {
        console.error('[BrandService] Unexpected error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Generates a unique invite code for a coach
 */
export async function generateInviteCode(
    coachId: string,
    maxUses: number = 1,
    expiresAt?: string
): Promise<{ success: boolean; code?: string; error?: string }> {
    try {
        console.log('[BrandService] Generating invite code for coach:', coachId);

        const { data: code, error } = await supabase.rpc('generate_invite_code', {
            p_coach_id: coachId,
            p_max_uses: maxUses,
            p_expires_at: expiresAt || null,
        });

        if (error) {
            console.error('[BrandService] Error generating invite:', error);
            return { success: false, error: error.message };
        }

        console.log('[BrandService] Invite code generated:', code);

        return { success: true, code };
    } catch (error: any) {
        console.error('[BrandService] Unexpected error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Validates an invite code
 */
export async function validateInviteCode(
    code: string
): Promise<{ valid: boolean; brandId?: string; coachId?: string; reason?: string }> {
    try {
        const { data, error } = await supabase.rpc('validate_invite_code', {
            p_code: code,
        });

        if (error) {
            console.error('[BrandService] Error validating invite:', error);
            return { valid: false, reason: 'validation_error' };
        }

        return data;
    } catch (error: any) {
        console.error('[BrandService] Unexpected error:', error);
        return { valid: false, reason: 'unexpected_error' };
    }
}
