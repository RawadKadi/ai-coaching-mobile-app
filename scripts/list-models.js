const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const path = require("path");

async function main() {
    try {
        // Read .env file
        const envPath = path.resolve(__dirname, "../.env");
        const envContent = fs.readFileSync(envPath, "utf8");

        // Extract API Key
        const match = envContent.match(/EXPO_PUBLIC_GOOGLE_AI_API_KEY=(.*)/);
        if (!match) {
            console.error("Could not find EXPO_PUBLIC_GOOGLE_AI_API_KEY in .env");
            process.exit(1);
        }

        const apiKey = match[1].trim();

        const genAI = new GoogleGenerativeAI(apiKey);

        console.log("Fetching available models...");
        const modelResponse = await genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // Just to initialize? No, need listModels on the client or similar.

        // The SDK doesn't have a direct listModels method on the client instance in some versions, 
        // but usually it's on the GoogleGenerativeAI instance or via a manager.
        // Let's check the SDK docs or try to use the model directly to see if it works, 
        // but the error said "Call ListModels".

        // Actually, looking at the SDK, there isn't a simple listModels method exposed in the main class in all versions.
        // However, the error message from the API suggests the endpoint exists.
        // Let's try to use the `makeRequest` or similar if available, or just fetch directly.

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await response.json();

        if (data.models) {
            console.log("Available Models:");
            data.models.forEach(m => {
                console.log(`- ${m.name} (${m.supportedGenerationMethods.join(", ")})`);
            });
        } else {
            console.error("Failed to list models:", data);
        }

    } catch (error) {
        console.error("Error:", error);
    }
}

main();
