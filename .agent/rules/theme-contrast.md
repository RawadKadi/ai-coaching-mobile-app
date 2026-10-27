### Theme Contrast Rule

Always ensure text and foreground elements maintain proper contrast with their background:
- When the background is light, text and icons must be dark.
- When the background is dark, text and icons must be light.
- Always use `isDarkColor(colors.background)` or theme tokens (`textColor`, `textSecondaryColor`, `cardBg`, `cardBorder`) rather than hardcoded white text (`text-white`, `color="white"`).
- Dynamic inputs, cards, borders, and status bars must adapt their colors based on whether the background is light or dark.
