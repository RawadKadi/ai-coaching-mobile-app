import { useFonts as useInterFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { useFonts as useRobotoFonts, Roboto_400Regular, Roboto_500Medium, Roboto_700Bold } from '@expo-google-fonts/roboto';
import { useFonts as useOutfitFonts, Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold, Outfit_700Bold } from '@expo-google-fonts/outfit';
import { useFonts as useMontserratFonts, Montserrat_400Regular, Montserrat_500Medium, Montserrat_600SemiBold, Montserrat_700Bold } from '@expo-google-fonts/montserrat';
import { useFonts as usePoppinsFonts, Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold } from '@expo-google-fonts/poppins';
import { useFonts as useLatoFonts, Lato_400Regular, Lato_700Bold, Lato_900Black } from '@expo-google-fonts/lato';
import { useFonts as useOpenSansFonts, OpenSans_400Regular, OpenSans_500Medium, OpenSans_600SemiBold, OpenSans_700Bold } from '@expo-google-fonts/open-sans';
import { useFonts as useRalewayFonts, Raleway_400Regular, Raleway_500Medium, Raleway_600SemiBold, Raleway_700Bold } from '@expo-google-fonts/raleway';
import { useFonts as useNunitoFonts, Nunito_400Regular, Nunito_500Medium, Nunito_600SemiBold, Nunito_700Bold } from '@expo-google-fonts/nunito';
import { useFonts as usePlayfairDisplayFonts, PlayfairDisplay_400Regular, PlayfairDisplay_500Medium, PlayfairDisplay_600SemiBold, PlayfairDisplay_700Bold } from '@expo-google-fonts/playfair-display';

// Font configuration - maps display names to font family names
export const AVAILABLE_FONTS = [
    { name: 'System', fontFamily: 'System' },
    { name: 'Inter', fontFamily: 'Inter_400Regular' },
    { name: 'Roboto', fontFamily: 'Roboto_400Regular' },
    { name: 'Outfit', fontFamily: 'Outfit_400Regular' },
    { name: 'Montserrat', fontFamily: 'Montserrat_400Regular' },
    { name: 'Poppins', fontFamily: 'Poppins_400Regular' },
    { name: 'Lato', fontFamily: 'Lato_400Regular' },
    { name: 'Open Sans', fontFamily: 'OpenSans_400Regular' },
    { name: 'Raleway', fontFamily: 'Raleway_400Regular' },
    { name: 'Nunito', fontFamily: 'Nunito_400Regular' },
    { name: 'Playfair Display', fontFamily: 'PlayfairDisplay_400Regular' },
] as const;

// Get the font family name for a given display name (handles weight variants)
export function getFontFamily(displayName: string, weight?: string): string {
    if (displayName === 'System') return 'System';

    const weightSuffix = weight === '500' ? '_500Medium'
        : weight === '600' ? '_600SemiBold'
            : weight === '700' ? '_700Bold'
                : weight === '800' || weight === '900' ? '_700Bold'
                    : '_400Regular';

    const fontMap: Record<string, string> = {
        'Inter': `Inter${weightSuffix}`,
        'Roboto': weight === '500' ? 'Roboto_500Medium' : weight === '600' || weight === '700' ? 'Roboto_700Bold' : 'Roboto_400Regular',
        'Outfit': `Outfit${weightSuffix}`,
        'Montserrat': `Montserrat${weightSuffix}`,
        'Poppins': `Poppins${weightSuffix}`,
        'Lato': weight === '700' || weight === '600' ? 'Lato_700Bold' : weight === '800' || weight === '900' ? 'Lato_900Black' : 'Lato_400Regular',
        'Open Sans': `OpenSans${weightSuffix}`,
        'Raleway': `Raleway${weightSuffix}`,
        'Nunito': `Nunito${weightSuffix}`,
        'Playfair Display': `PlayfairDisplay${weightSuffix}`,
    };

    return fontMap[displayName] || 'System';
}

export function useAppFonts(): boolean {
    const [interLoaded] = useInterFonts({
        Inter_400Regular,
        Inter_500Medium,
        Inter_600SemiBold,
        Inter_700Bold,
    });

    const [robotoLoaded] = useRobotoFonts({
        Roboto_400Regular,
        Roboto_500Medium,
        Roboto_700Bold,
    });

    const [outfitLoaded] = useOutfitFonts({
        Outfit_400Regular,
        Outfit_500Medium,
        Outfit_600SemiBold,
        Outfit_700Bold,
    });

    const [montserratLoaded] = useMontserratFonts({
        Montserrat_400Regular,
        Montserrat_500Medium,
        Montserrat_600SemiBold,
        Montserrat_700Bold,
    });

    const [poppinsLoaded] = usePoppinsFonts({
        Poppins_400Regular,
        Poppins_500Medium,
        Poppins_600SemiBold,
        Poppins_700Bold,
    });

    const [latoLoaded] = useLatoFonts({
        Lato_400Regular,
        Lato_700Bold,
        Lato_900Black,
    });

    const [openSansLoaded] = useOpenSansFonts({
        OpenSans_400Regular,
        OpenSans_500Medium,
        OpenSans_600SemiBold,
        OpenSans_700Bold,
    });

    const [ralewayLoaded] = useRalewayFonts({
        Raleway_400Regular,
        Raleway_500Medium,
        Raleway_600SemiBold,
        Raleway_700Bold,
    });

    const [nunitoLoaded] = useNunitoFonts({
        Nunito_400Regular,
        Nunito_500Medium,
        Nunito_600SemiBold,
        Nunito_700Bold,
    });

    const [playfairLoaded] = usePlayfairDisplayFonts({
        PlayfairDisplay_400Regular,
        PlayfairDisplay_500Medium,
        PlayfairDisplay_600SemiBold,
        PlayfairDisplay_700Bold,
    });

    return interLoaded && robotoLoaded && outfitLoaded && montserratLoaded &&
        poppinsLoaded && latoLoaded && openSansLoaded && ralewayLoaded &&
        nunitoLoaded && playfairLoaded;
}
