import { visionModel } from './google-ai';

export interface ProposedSession {
    scheduled_at: string;
    duration_minutes: number;
    session_type: 'training' | 'nutrition' | 'check_in' | 'consultation' | 'other';
    notes: string;
    recurrence?: 'weekly' | 'once';
    day_of_week?: string;
}

export interface ScheduleRequest {
    coachInput: string;
    currentDate: string;
    clientContext: {
        name: string;
        timezone: string;
    };
    existingSessions?: any[];
    currentProposedSessions?: ProposedSession[];
}

export interface ScheduleResponse {
    sessions: ProposedSession[];
    missing_info: string[];
    clarification?: {
        type: 'recurrence_ambiguity' | 'duration_invalid' | 'general';
        message: string;
    };
}

export class RateLimitError extends Error {
    retryAfter: number;
    constructor(retryAfter: number) {
        super(`Rate limit exceeded. Please retry in ${Math.ceil(retryAfter)} seconds.`);
        this.retryAfter = retryAfter;
        this.name = 'RateLimitError';
    }
}

const MAX_RETRIES = 3;
const INITIAL_BACKOFF = 2000;

const callWithRetry = async <T>(
    fn: () => Promise<T>,
    retries = MAX_RETRIES,
    backoff = INITIAL_BACKOFF
): Promise<T> => {
    try {
        return await fn();
    } catch (error: any) {
        // Handle explicit retry delay from Gemini API
        if (error.message?.includes('429') || error.message?.includes('Resource exhausted')) {
            const match = error.message?.match(/Please retry in ([0-9.]+)s/);
            if (match) {
                const delaySeconds = parseFloat(match[1]);
                // If delay is significant (> 5s), let the UI handle it
                if (delaySeconds > 5) {
                    throw new RateLimitError(delaySeconds);
                }
                // Otherwise wait and retry
                await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000 + 500));
                return callWithRetry(fn, retries - 1, backoff);
            }
        }

        if (retries > 0 && (
            error.message?.includes('429') ||
            error.message?.includes('Resource exhausted') ||
            error.message?.includes('503')
        )) {
            await new Promise(resolve => setTimeout(resolve, backoff));
            return callWithRetry(fn, retries - 1, backoff * 2);
        }
        throw error;
    }
};

export const parseScheduleRequest = async (request: ScheduleRequest): Promise<ScheduleResponse> => {
    try {
        const prompt = `
You are an AI scheduling assistant for a personal coach.
Your task is to parse the coach's natural language input and generate or MODIFY a structured schedule.

CONTEXT:
- Current Date: ${request.currentDate}
- Client Name: ${request.clientContext.name}
- Client Timezone: ${request.clientContext.timezone}
- Input: "${request.coachInput}"
${request.currentProposedSessions && request.currentProposedSessions.length > 0 ? `- Current Proposed Schedule: ${JSON.stringify(request.currentProposedSessions)}` : ''}
${request.existingSessions && request.existingSessions.length > 0 ? `- Existing Sessions (for context): ${JSON.stringify(request.existingSessions.map(s => ({ start: s.scheduled_at, duration: s.duration_minutes, client_id: s.client_id })))}` : ''}

OBJECTIVE:
Turn the coach's input into a structured JSON response. Minimize friction by inferring context where safe, but ask for clarification when critical info is missing or ambiguous.

IMPORTANT: The input might be a combination of an "Original Request" and a "Clarification Answer". You MUST combine these to form the full context. Do not lose information from the Original Request (e.g., time) when processing the Answer (e.g., date).

RULES & LOGIC:

1. **DURATION**: Sessions are ALWAYS 60 minutes.
   - If user asks for > 60 mins, return "clarification": { "type": "duration_invalid", "message": "Sessions must be exactly 1 hour. Please adjust." }

2. **MISSING INFO HANDLING (Consolidated)**:
   - If multiple pieces of info are missing (Date, Time), ask for them together.
   - Example: "Schedule session" -> Ask "For which day and time?" (and recurrence if needed).

3. **RECURRENCE & AMBIGUITY (The "Smart" Part)**:
   - **Scenario A: Time Only Provided** (e.g., "Schedule at 2am")
     - **DO NOT ASSUME THE DATE**. Do not assume "today" or "next Sunday".
     - **Action**: Ask for the date.
     - Return "clarification": { "type": "general", "message": "For which day would you like to schedule this session at 2am?" }

   - **Scenario B: Explicit Date & Time** (e.g., "Schedule today at 2am", "Monday at 4pm")
     - The date and time are known.
     - **CRITICAL AMBIGUITY CHECK**: Unless the user explicitly said "Just this one" or "One time only", you **MUST** verify recurrence.
     - **Action**: Ask if it's for just this specific date or every week.
     - Return "clarification": { "type": "recurrence_ambiguity", "message": "Do you want to schedule this for just this specific date, or every week?" }

   - **Scenario C: Vague Change** (e.g., "Change time to 2am", "Move to 4pm")
     - If NO date is specified, it implies a modification to an existing or implied session.
     - **CRITICAL**: You MUST ask: "Apply this change to just this specific session, or every week?"
     - Return "clarification": { "type": "recurrence_ambiguity", "message": "Do you want to apply this change to just this date or every week?" }

   - **Scenario D: Explicit Recurrence** (e.g., "Every Monday", "Weekly", "All Tuesdays")
     - Set recurrence: "weekly". DO NOT ask for clarification.

4. **HANDLING CLARIFICATION RESPONSES (Loop Prevention)**:
   - If the input contains "Just this date", "This specific date only", "1", or "Only today":
     - UPDATE the session.
     - Set recurrence: "once".
     - **STOP ASKING**. Return the session.
   - If the input contains "Every week", "Every week on this weekday", "2", or "All days":
     - UPDATE the session.
     - Set recurrence: "weekly".
     - **STOP ASKING**. Return the session.

5. **TIMEZONE**: Input is in ${request.clientContext.timezone}. Convert to UTC for 'scheduled_at'.

RESPONSE FORMAT (JSON ONLY):
{
  "sessions": [
    {
      "scheduled_at": "ISO_STRING", // UTC
      "duration_minutes": 60,
      "session_type": "training",
      "notes": "Context from input",
      "recurrence": "weekly", // or "once"
      "day_of_week": "Monday" // Optional
    }
  ],
  "missing_info": [],
  "clarification": null // or { "type": "...", "message": "..." }
}
`;

        const result = await callWithRetry(() => visionModel.generateContent(prompt));
        const response = await result.response;
        const text = response.text();

        // Clean markdown if present
        let cleanedText = text.trim();
        if (cleanedText.startsWith('```json')) {
            cleanedText = cleanedText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
        } else if (cleanedText.startsWith('```')) {
            cleanedText = cleanedText.replace(/```\n?/g, '');
        }

        return JSON.parse(cleanedText);
    } catch (error) {
        console.error('Error parsing schedule:', error);
        throw new Error('Failed to parse schedule request');
    }
};
