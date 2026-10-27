import React from 'react';
import { StyleSheet } from 'react-native';
import { getFontFamily } from '@/hooks/useAppFonts';

/**
 * Predicts the optimal font file name and cleans conflicting weights.
 *
 * CRITICAL REACT NATIVE / IOS BEHAVIOR:
 * When using Expo Google Fonts (e.g. Outfit_700Bold or Raleway_700Bold),
 * if `fontWeight: '700'` or `'bold'` is kept in the style object,
 * iOS CoreText attempts to find a bold sub-variant of that font file.
 * Because no bold sub-variant exists for `Outfit_700Bold`, CoreText fails
 * and falls back to system regular or the thinnest font.
 *
 * Setting `fontWeight: undefined` ensures iOS directly renders the exact
 * bold font file at full weight without synthesis conflict.
 */
export function getFontFamilyAndWeight(
  fontDisplayName: string,
  styleWeight?: string | number,
  fontSize?: number
): { fontFamily: string; fontWeight?: any } {
  if (!fontDisplayName || fontDisplayName === 'System') {
    return {
      fontFamily: 'System',
      fontWeight: styleWeight ? String(styleWeight) : undefined,
    };
  }

  const weightStr =
    styleWeight !== undefined && styleWeight !== null ? String(styleWeight).toLowerCase() : '';

  const isBold =
    weightStr === 'bold' ||
    weightStr === '700' ||
    weightStr === '800' ||
    weightStr === '900' ||
    (Boolean(fontSize && fontSize >= 18) &&
      weightStr !== '400' &&
      weightStr !== '300' &&
      weightStr !== 'normal');

  const isSemiBold = weightStr === '600';
  const isMedium = weightStr === '500';

  let resolvedWeight: '400' | '500' | '600' | '700' | '900';
  if (isBold) {
    resolvedWeight =
      fontDisplayName === 'Lato' && (weightStr === '800' || weightStr === '900') ? '900' : '700';
  } else if (isSemiBold) {
    resolvedWeight = '600';
  } else if (isMedium) {
    resolvedWeight = '500';
  } else {
    // For Raleway, Outfit, and Montserrat where 400 regular can appear thin,
    // default regular/body text to 500 Medium for solid, crisp readability.
    if (
      fontDisplayName === 'Raleway' ||
      fontDisplayName === 'Outfit' ||
      fontDisplayName === 'Montserrat' ||
      fontDisplayName === 'Poppins'
    ) {
      resolvedWeight = '500';
    } else {
      resolvedWeight = '400';
    }
  }

  const resolvedFontName = getFontFamily(fontDisplayName, resolvedWeight);

  return {
    fontFamily: resolvedFontName,
    fontWeight: undefined,
  };
}

export function isIconFont(fontFamily?: string): boolean {
  if (!fontFamily) return false;
  const lower = fontFamily.toLowerCase();
  return (
    lower.includes('icon') ||
    lower.includes('awesome') ||
    lower.includes('feather') ||
    lower.includes('glyph') ||
    lower.includes('material') ||
    lower.includes('entypo') ||
    lower.includes('antdesign')
  );
}

let patcherInstalled = false;

export function installGlobalFontPatcher() {
  if (patcherInstalled) return;
  patcherInstalled = true;

  try {
    const RN = require('react-native');
    const RNTextModule = require('react-native/Libraries/Text/Text');
    const OriginalTextImpl = RNTextModule.default;

    if (OriginalTextImpl && !(OriginalTextImpl as any).__brandPatched) {
      const PatchedText = React.forwardRef((props: any, ref: any) => {
        const brandFont = (globalThis as any).currentBrandFontFamily;

        if (!brandFont || brandFont === 'System') {
          return React.createElement(OriginalTextImpl, { ...props, ref });
        }

        let resolvedStyle = props.style;
        if (props.style) {
          const flat = StyleSheet.flatten(props.style);
          if (flat && !isIconFont(flat.fontFamily)) {
            const { fontFamily, fontWeight } = getFontFamilyAndWeight(
              brandFont,
              flat.fontWeight,
              flat.fontSize
            );
            resolvedStyle = [props.style, { fontFamily, fontWeight }];
          }
        } else {
          const { fontFamily, fontWeight } = getFontFamilyAndWeight(
            brandFont,
            undefined,
            undefined
          );
          resolvedStyle = { fontFamily, fontWeight };
        }

        return React.createElement(OriginalTextImpl, {
          ...props,
          ref,
          style: resolvedStyle,
        });
      });

      Object.assign(PatchedText, OriginalTextImpl);
      PatchedText.displayName = 'Text';
      (PatchedText as any).__brandPatched = true;
      RNTextModule.default = PatchedText;

      try {
        Object.defineProperty(RN, 'Text', {
          get: () => PatchedText,
          configurable: true,
          enumerable: true,
        });
      } catch (_) {}
    }

    // Also patch TextInput so form fields use the brand font
    const RNTextInputModule = require('react-native/Libraries/Components/TextInput/TextInput');
    const OriginalTextInput = RNTextInputModule.default;
    if (OriginalTextInput && !(OriginalTextInput as any).__brandPatched) {
      const PatchedTextInput = React.forwardRef((props: any, ref: any) => {
        const brandFont = (globalThis as any).currentBrandFontFamily;
        if (!brandFont || brandFont === 'System') {
          return React.createElement(OriginalTextInput, { ...props, ref });
        }
        const flat = StyleSheet.flatten(props.style) || {};
        if (!isIconFont(flat.fontFamily)) {
          const { fontFamily, fontWeight } = getFontFamilyAndWeight(
            brandFont,
            flat.fontWeight,
            flat.fontSize
          );
          return React.createElement(OriginalTextInput, {
            ...props,
            ref,
            style: [props.style, { fontFamily, fontWeight }],
          });
        }
        return React.createElement(OriginalTextInput, { ...props, ref });
      });
      Object.assign(PatchedTextInput, OriginalTextInput);
      PatchedTextInput.displayName = 'TextInput';
      (PatchedTextInput as any).__brandPatched = true;
      RNTextInputModule.default = PatchedTextInput;

      try {
        Object.defineProperty(RN, 'TextInput', {
          get: () => PatchedTextInput,
          configurable: true,
          enumerable: true,
        });
      } catch (_) {}
    }

    // Patch JSX runtimes to catch all nativewind and standard JSX invocations
    try {
      const jsxRuntime = require('react/jsx-runtime');
      const jsxDevRuntime = require('react/jsx-dev-runtime');

      const wrapJsx = (origJsx: any) => {
        if (!origJsx || origJsx.__brandPatched) return origJsx;
        const patched = function (this: any, type: any, props: any, ...rest: any[]) {
          const brandFont = (globalThis as any).currentBrandFontFamily;
          if (
            brandFont &&
            brandFont !== 'System' &&
            props &&
            (type?.displayName === 'Text' ||
              type?.name === 'Text' ||
              type?.name === 'TextImpl' ||
              type === OriginalTextImpl)
          ) {
            const flat = StyleSheet.flatten(props.style);
            if (flat && !isIconFont(flat.fontFamily)) {
              const { fontFamily, fontWeight } = getFontFamilyAndWeight(
                brandFont,
                flat.fontWeight,
                flat.fontSize
              );
              props = {
                ...props,
                style: [props.style, { fontFamily, fontWeight }],
              };
            } else if (!props.style) {
              const { fontFamily, fontWeight } = getFontFamilyAndWeight(
                brandFont,
                undefined,
                undefined
              );
              props = {
                ...props,
                style: { fontFamily, fontWeight },
              };
            }
          }
          return origJsx.apply(this, [type, props, ...rest]);
        };
        patched.__brandPatched = true;
        return patched;
      };

      if (jsxRuntime.jsx) jsxRuntime.jsx = wrapJsx(jsxRuntime.jsx);
      if (jsxRuntime.jsxs) jsxRuntime.jsxs = wrapJsx(jsxRuntime.jsxs);
      if (jsxDevRuntime.jsxDEV) jsxDevRuntime.jsxDEV = wrapJsx(jsxDevRuntime.jsxDEV);
    } catch (_) {}
  } catch (error) {
    console.warn('[FontPatcher] Installation warning:', error);
  }
}

// Auto-run install immediately on module load
installGlobalFontPatcher();
