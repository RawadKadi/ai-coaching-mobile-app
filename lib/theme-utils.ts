/**
 * Theme Utility Functions
 * Helper functions for brand theme manipulation, color generation, and styling
 */

/**
 * Convert hex color to RGB components
 */
export function hexToRGB(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
        ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16),
        }
        : { r: 59, g: 130, b: 246 }; // Default blue
}

/**
 * Convert RGB components to hex color
 */
export function rgbToHex(r: number, g: number, b: number): string {
    return '#' + [r, g, b].map(x => {
        const hex = Math.round(x).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }).join('');
}

/**
 * Calculate relative luminance of a color (for contrast calculations)
 */
function getLuminance(r: number, g: number, b: number): number {
    const [rs, gs, bs] = [r, g, b].map(c => {
        const sRGB = c / 255;
        return sRGB <= 0.03928 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calculate contrast ratio between two colors
 */
export function getContrastRatio(color1: string, color2: string): number {
    const rgb1 = hexToRGB(color1);
    const rgb2 = hexToRGB(color2);

    const lum1 = getLuminance(rgb1.r, rgb1.g, rgb1.b);
    const lum2 = getLuminance(rgb2.r, rgb2.g, rgb2.b);

    const lighter = Math.max(lum1, lum2);
    const darker = Math.min(lum1, lum2);

    return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Get contrasting text color (white or black) for a given background color
 * Ensures WCAG AA compliance (contrast ratio >= 4.5:1)
 */
export function getContrastColor(backgroundColor: string): string {
    const whiteContrast = getContrastRatio(backgroundColor, '#FFFFFF');
    const blackContrast = getContrastRatio(backgroundColor, '#000000');

    // Return color with better contrast
    return whiteContrast > blackContrast ? '#FFFFFF' : '#000000';
}

/**
 * Lighten a color by a percentage
 */
export function lightenColor(color: string, percent: number): string {
    const { r, g, b } = hexToRGB(color);

    const newR = Math.min(255, r + (255 - r) * percent);
    const newG = Math.min(255, g + (255 - g) * percent);
    const newB = Math.min(255, b + (255 - b) * percent);

    return rgbToHex(newR, newG, newB);
}

/**
 * Darken a color by a percentage
 */
export function darkenColor(color: string, percent: number): string {
    const { r, g, b } = hexToRGB(color);

    const newR = Math.max(0, r * (1 - percent));
    const newG = Math.max(0, g * (1 - percent));
    const newB = Math.max(0, b * (1 - percent));

    return rgbToHex(newR, newG, newB);
}

/**
 * Generate hover state color (slightly lighter/darker based on brightness)
 */
export function generateHoverColor(color: string, isDark: boolean = false): string {
    const { r, g, b } = hexToRGB(color);
    const brightness = (r + g + b) / 3;

    // For dark backgrounds, lighten. For light backgrounds, darken
    if (isDark || brightness < 128) {
        return lightenColor(color, 0.1);
    } else {
        return darkenColor(color, 0.1);
    }
}

/**
 * Generate pressed/active state color (more pronounced than hover)
 */
export function generatePressedColor(color: string, isDark: boolean = false): string {
    const { r, g, b } = hexToRGB(color);
    const brightness = (r + g + b) / 3;

    if (isDark || brightness < 128) {
        return lightenColor(color, 0.2);
    } else {
        return darkenColor(color, 0.2);
    }
}

/**
 * Generate disabled state color (desaturated and lighter)
 */
export function generateDisabledColor(color: string): string {
    const { r, g, b } = hexToRGB(color);

    // Convert to grayscale and lighten
    const gray = (r + g + b) / 3;
    const lightGray = Math.min(255, gray + 80);

    return rgbToHex(lightGray, lightGray, lightGray);
}

/**
 * Auto-generate dark theme colors from light theme
 */
export function generateDarkTheme(lightColors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
}): {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
} {
    // For dark mode, we generally want to:
    // 1. Lighten the primary/secondary colors slightly for better contrast on dark backgrounds
    // 2. Use a dark background
    // 3. Adjust accent color if needed

    return {
        primary: lightenColor(lightColors.primary, 0.15),
        secondary: lightenColor(lightColors.secondary, 0.15),
        accent: lightenColor(lightColors.accent, 0.1),
        background: '#1F2937', // Default dark background
    };
}

/**
 * Get shadow style object based on shadow size
 */
export function getShadowStyle(size: 'none' | 'small' | 'medium' | 'large'): object {
    const shadows = {
        none: {},
        small: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.05,
            shadowRadius: 2,
            elevation: 1,
        },
        medium: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 3,
        },
        large: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 8,
            elevation: 6,
        },
    };

    return shadows[size] || shadows.medium;
}

/**
 * Get border radius value based on button shape
 */
export function getBorderRadiusFromShape(shape: 'rounded' | 'pill' | 'square'): number {
    const radii = {
        rounded: 12,
        pill: 999,
        square: 4,
    };

    return radii[shape] || radii.rounded;
}

/**
 * Apply border radius scale to a base radius
 */
export function scaleBorderRadius(baseRadius: number, scale: number): number {
    return baseRadius * scale;
}

/**
 * Apply spacing scale to a base spacing value
 */
export function scaleSpacing(baseSpacing: number, scale: number): number {
    return baseSpacing * scale;
}

/**
 * Generate typography sizes based on scale
 */
export function generateTypographySizes(scale: number): {
    xs: number;
    sm: number;
    base: number;
    lg: number;
    xl: number;
    xxl: number;
} {
    const baseSize = 16;

    return {
        xs: Math.round(12 * scale),
        sm: Math.round(14 * scale),
        base: Math.round(baseSize * scale),
        lg: Math.round(18 * scale),
        xl: Math.round(24 * scale),
        xxl: Math.round(32 * scale),
    };
}

/**
 * Get initials from a name for avatar
 */
export function getInitials(name: string): string {
    if (!name) return '?';

    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }

    return name.substring(0, 2).toUpperCase();
}

/**
 * Validate hex color format
 */
export function isValidHexColor(color: string): boolean {
    return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
}

/**
 * Ensure color is valid, return default if not
 */
export function ensureValidColor(color: string | null | undefined, defaultColor: string): string {
    if (!color || !isValidHexColor(color)) {
        return defaultColor;
    }
    return color;
}

/**
 * Generate gradient CSS/style for buttons
 */
export function generateGradientStyle(startColor: string, endColor: string, direction: 'horizontal' | 'vertical' = 'horizontal'): string {
    const deg = direction === 'horizontal' ? '90deg' : '180deg';
    return `linear-gradient(${deg}, ${startColor}, ${endColor})`;
}

/**
 * Check if color is considered "dark"
 */
export function isDarkColor(color: string): boolean {
    const { r, g, b } = hexToRGB(color);
    const brightness = (r + g + b) / 3;
    return brightness < 128;
}

/**
 * Blend two colors together
 */
export function blendColors(color1: string, color2: string, ratio: number = 0.5): string {
    const rgb1 = hexToRGB(color1);
    const rgb2 = hexToRGB(color2);

    const r = Math.round(rgb1.r * (1 - ratio) + rgb2.r * ratio);
    const g = Math.round(rgb1.g * (1 - ratio) + rgb2.g * ratio);
    const b = Math.round(rgb1.b * (1 - ratio) + rgb2.b * ratio);

    return rgbToHex(r, g, b);
}
