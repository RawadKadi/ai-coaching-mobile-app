/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
    presets: [require("nativewind/preset")],
    theme: {
        extend: {
            colors: {
                brand: {
                    primary: "#3B82F6", // Blue-500
                    secondary: "#1E40AF", // Blue-800
                    accent: "#FBBF24", // Amber-400
                    surface: "#0F172A", // Slate-900
                    background: "#020617", // Slate-950
                },
            },
        },
    },
    plugins: [],
}
