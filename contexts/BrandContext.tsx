import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthContext';

// Brand interface
export interface Brand {
  id: string;
  name: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  created_at: string;
  updated_at: string;
}

// Brand Context interface
interface BrandContextType {
  brand: Brand | null;
  loading: boolean;
  refreshBrand: () => Promise<void>;
  updateBrandSettings: (updates: Partial<Brand>) => Promise<boolean>;
  canManageBrand: boolean;
}

// Create context
const BrandContext = createContext<BrandContextType>({
  brand: null,
  loading: true,
  refreshBrand: async () => {},
  updateBrandSettings: async () => false,
  canManageBrand: false,
});

// Provider component
export function BrandProvider({ children }: { children: React.ReactNode }) {
  const { coach } = useAuth();
  const [brand, setBrand] = useState<Brand | null>(null);
  const [loading, setLoading] = useState(true);
  const [canManageBrand, setCanManageBrand] = useState(false);

  // Load brand data
  const loadBrand = async () => {
    if (!coach?.brand_id) {
      setLoading(false);
      return;
    }

    try {
      console.log('[BrandContext] Loading brand:', coach.brand_id);
      
      const { data, error } = await supabase
        .from('brands')
        .select('*')
        .eq('id', coach.brand_id)
        .single();

      if (error) {
        console.error('[BrandContext] Error loading brand:', error);
        throw error;
      }

      console.log('[BrandContext] Brand loaded:', data);
      setBrand(data);
      setCanManageBrand(coach.can_manage_brand || false);
    } catch (error) {
      console.error('[BrandContext] Failed to load brand:', error);
    } finally {
      setLoading(false);
    }
  };

  // Refresh brand (exposed to components)
  const refreshBrand = async () => {
    setLoading(true);
    await loadBrand();
  };

  // Update brand settings
  const updateBrandSettings = async (updates: Partial<Brand>): Promise<boolean> => {
    if (!brand || !canManageBrand) {
      console.error('[BrandContext] Cannot update brand - no permission');
      return false;
    }

    try {
      console.log('[BrandContext] Updating brand:', updates);
      
      const { data, error } = await supabase.rpc('update_brand', {
        p_brand_id: brand.id,
        p_name: updates.name || null,
        p_logo_url: updates.logo_url || null,
        p_primary_color: updates.primary_color || null,
        p_secondary_color: updates.secondary_color || null,
      });

      if (error) {
        console.error('[BrandContext] Error updating brand:', error);
        throw error;
      }

      console.log('[BrandContext] Brand updated successfully');
      
      // Refresh brand data
      await refreshBrand();
      return true;
    } catch (error) {
      console.error('[BrandContext] Failed to update brand:', error);
      return false;
    }
  };

  // Load brand when coach changes
  useEffect(() => {
    if (coach) {
      loadBrand();
    } else {
      setBrand(null);
      setLoading(false);
    }
  }, [coach?.brand_id]);

  return (
    <BrandContext.Provider
      value={{
        brand,
        loading,
        refreshBrand,
        updateBrandSettings,
        canManageBrand,
      }}
    >
      {children}
    </BrandContext.Provider>
  );
}

// Hook to use brand context
export function useBrand() {
  const context = useContext(BrandContext);
  if (!context) {
    throw new Error('useBrand must be used within a BrandProvider');
  }
  return context;
}

// Helper hook to get brand colors (with fallbacks)
export function useBrandColors() {
  const { brand } = useBrand();
  
  return {
    primary: brand?.primary_color || '#3B82F6',
    secondary: brand?.secondary_color || '#10B981',
    primaryRGB: hexToRGB(brand?.primary_color || '#3B82F6'),
    secondaryRGB: hexToRGB(brand?.secondary_color || '#10B981'),
  };
}

// Helper function to convert hex to RGB
function hexToRGB(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 59, g: 130, b: 246 }; // Default blue
}
