/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: "class",
    content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
    presets: [require("nativewind/preset")],
    theme: {
        extend: {
            colors: {
                brand: {
                    primary: "var(--color-primary)", 
                    secondary: "var(--color-secondary)", 
                    accent: "var(--color-accent)", 
                    surface: "var(--color-surface)", 
                    background: "var(--color-bg)", 
                },
                slate: {
                    950: "var(--color-bg)",
                    900: "var(--color-surface)",
                    800: "var(--color-border)",
                    600: "var(--color-text-muted)",
                    400: "var(--color-text-secondary)",
                    200: "var(--color-text-primary)",
                },
                blue: {
                    500: "var(--color-primary-text)",
                    600: "var(--color-primary)",
                }
            },
        },
    },
    plugins: [],
}
