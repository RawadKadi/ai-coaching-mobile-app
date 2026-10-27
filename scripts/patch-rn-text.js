const fs = require('fs');
const path = require('path');

const textFile = path.join(__dirname, '../node_modules/react-native/Libraries/Text/Text.js');

if (!fs.existsSync(textFile)) {
  console.log('[patch-rn-text] Text.js not found, skipping');
  process.exit(0);
}

let content = fs.readFileSync(textFile, 'utf8');

if (content.includes('currentBrandFontFamily')) {
  console.log('[patch-rn-text] Text.js already patched');
  process.exit(0);
}

const target = `    if (overrides != null) {
      // $FlowFixMe[incompatible-type]
      _style = [_style, overrides];
    }
  }`;

const replacement = `    if (overrides != null) {
      // $FlowFixMe[incompatible-type]
      _style = [_style, overrides];
    }

    const brandFont = typeof globalThis !== 'undefined' ? (globalThis: any).currentBrandFontFamily : null;
    if (brandFont && brandFont !== 'System') {
      const currentFontFam = processedStyle.fontFamily ? String(processedStyle.fontFamily).toLowerCase() : '';
      const isIcon = currentFontFam.includes('icon') || currentFontFam.includes('feather') || currentFontFam.includes('awesome') || currentFontFam.includes('glyph') || currentFontFam.includes('material');
      if (!isIcon) {
        const wStr = processedStyle.fontWeight ? String(processedStyle.fontWeight).toLowerCase() : '';
        const fSize = processedStyle.fontSize;
        const isBold = wStr === 'bold' || wStr === '700' || wStr === '800' || wStr === '900' || (Boolean(fSize && fSize >= 18) && wStr !== '400' && wStr !== '300' && wStr !== 'normal');
        const isSemiBold = wStr === '600';
        const isMedium = wStr === '500';
        let resWeight = '400';
        if (isBold) {
          resWeight = brandFont === 'Lato' && (wStr === '800' || wStr === '900') ? '900' : '700';
        } else if (isSemiBold) {
          resWeight = '600';
        } else if (isMedium) {
          resWeight = '500';
        } else {
          if (brandFont === 'Raleway' || brandFont === 'Outfit' || brandFont === 'Montserrat' || brandFont === 'Poppins') {
            resWeight = '500';
          } else {
            resWeight = '400';
          }
        }

        const wSuffix = resWeight === '500' ? '_500Medium' : resWeight === '600' ? '_600SemiBold' : resWeight === '700' ? '_700Bold' : '_400Regular';
        const fMap = {
          'Inter': 'Inter' + wSuffix,
          'Roboto': resWeight === '500' ? 'Roboto_500Medium' : (isBold || isSemiBold) ? 'Roboto_700Bold' : 'Roboto_400Regular',
          'Outfit': 'Outfit' + wSuffix,
          'Montserrat': 'Montserrat' + wSuffix,
          'Poppins': 'Poppins' + wSuffix,
          'Lato': (wStr === '800' || wStr === '900') ? 'Lato_900Black' : (isBold || isSemiBold) ? 'Lato_700Bold' : 'Lato_400Regular',
          'Open Sans': 'OpenSans' + wSuffix,
          'Raleway': 'Raleway' + wSuffix,
          'Nunito': 'Nunito' + wSuffix,
          'Playfair Display': 'PlayfairDisplay' + wSuffix,
        };

        const targetFont = fMap[brandFont] || brandFont;
        // $FlowFixMe[incompatible-type]
        _style = [_style, { fontFamily: targetFont, fontWeight: undefined }];
      }
    }
  } else {
    const brandFont = typeof globalThis !== 'undefined' ? (globalThis: any).currentBrandFontFamily : null;
    if (brandFont && brandFont !== 'System') {
      const wSuffix = (brandFont === 'Raleway' || brandFont === 'Outfit' || brandFont === 'Montserrat' || brandFont === 'Poppins') ? '_500Medium' : '_400Regular';
      const fMap = {
        'Inter': 'Inter' + wSuffix,
        'Roboto': 'Roboto' + wSuffix,
        'Outfit': 'Outfit' + wSuffix,
        'Montserrat': 'Montserrat' + wSuffix,
        'Poppins': 'Poppins' + wSuffix,
        'Lato': 'Lato_400Regular',
        'Open Sans': 'OpenSans' + wSuffix,
        'Raleway': 'Raleway' + wSuffix,
        'Nunito': 'Nunito' + wSuffix,
        'Playfair Display': 'PlayfairDisplay' + wSuffix,
      };
      const targetFont = fMap[brandFont] || brandFont;
      // $FlowFixMe[incompatible-type]
      _style = [{ fontFamily: targetFont }];
    }
  }`;

if (content.includes(target)) {
  content = content.replace(target, replacement);
  fs.writeFileSync(textFile, content, 'utf8');
  console.log('[patch-rn-text] Successfully patched Text.js');
} else {
  console.log('[patch-rn-text] Target snippet not found or already modified');
}
