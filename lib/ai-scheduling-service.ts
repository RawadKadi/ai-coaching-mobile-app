import { visionModel } from './google-ai';

export interface ProposedSession {
    scheduled_at: string;
    duration_minutes: number;
    session_type: 'training' | 'nutrition' | 'check_in' | 'consultation' | 'other';
    notes: string;
    recurrence?: 'weekly' | 'once';
    day_of_week?: string;
    status?: string;
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

export interface IntentExtractionResponse {
    sessions: {
        date: string | null;
        time: string | null;
    }[];
    recurrence: 'weekly' | 'once' | null;
    missing_info: string[];
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

IMPORTANT - DATE RESOLUTION:
When the coach says a weekday name (Monday, Tuesday, Wednesday, etc.):
1. Calculate from the Current Date provided above
2. If the weekday is today, use today's date
3. If the weekday is in the future this week, use that date
4. If the weekday has already passed this week, use NEXT week's occurrence
5. ALWAYS return dates in ISO 8601 format in UTC timezone
6. Example: If today is Monday Dec 23, 2025 and coach says "Wednesday", that means Wednesday Dec 25, 2025 (in 2 days)

*** PRIMARY DIRECTIVE: MERGE CONTEXT ***
The input will often look like this:
Original Request: "Schedule at 7:11pm"
Clarification Answer: "Today"
OR merged as: "Schedule at 7:11pm for Today"

YOU MUST MERGE THESE.
- Time comes from "Original Request" (7:11pm).
- Date comes from "Clarification Answer" (Today).
- RESULT: Schedule for Today at 7:11pm.
- **DO NOT ASK FOR TIME AGAIN.** You already have it.

RULES & LOGIC:

1. **DURATION**: Sessions are ALWAYS 60 minutes.

2. **SCENARIO: COMBINED INPUT (Original + Answer)**:
   - **Scenario E: Clarification Answer Provided** (Input contains "Original Request:" and "Clarification Answer:")
     - **MANDATORY**: You MUST combine the info.
     - If Original Request has TIME ("at 6:59pm") and Answer has DATE ("Today"), then you HAVE both.
     - **DO NOT ASK FOR TIME AGAIN**.
     - Proceed to schedule. Check recurrence if ambiguous (unless Answer says "Today only" -> recurrence: once).

   - **Scenario F: Merged Input** (e.g., "Schedule at 7:19pm for Today")
     - You HAVE both Date (Today) and Time (7:19pm).
     - **DO NOT ASK FOR TIME AGAIN**.
     - Proceed to schedule. Check recurrence if ambiguous.
       - **STOP ASKING**. Return the session.
     - **IF Answer says just "Today" or a date**:
       - You have Date + Time.
       - Check recurrence ambiguity: "Just this date or every week?" (unless explicitly "once").
       - Return "clarification": { "type": "recurrence_ambiguity", "message": "Do you want to schedule this for just this specific date, or every week?" }

3. **SCENARIO: TIME ONLY (Single input)**:
   - Input: "Schedule at 7:11pm"
   - **Action**: Ask for date.
   - Return "clarification": { "type": "general", "message": "For which day would you like to schedule this session at 7:11pm?" }

4. **SCENARIO: EXPLICIT DATE & TIME**:
   - Input: "Schedule today at 7:11pm"
   - **Action**: Ask recurrence (unless "only" is used).
   - Return "clarification": { "type": "recurrence_ambiguity", "message": "Do you want to schedule this for just this specific date, or every week?" }

5. **LOOP PREVENTION**:
   - If input contains "Just this date", "Every week", "1", "2": APPLY IT AND RETURN.

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

export const extractSchedulingIntent = async (input: string): Promise<IntentExtractionResponse> => {
    try {
        const prompt = `
Extract scheduling intent from this coach input. 
Handle typos (e.g., "Wednsday" -> "wednesday"), abbreviations (e.g., "wed" -> "wednesday").
IMPORTANT: Resolve all dates to their standard lowercase names (monday, tuesday, wednesday, thursday, friday, saturday, sunday, today, tomorrow).

Input: "${input}"

Return ONLY a valid JSON object matching this schema. Do not include markdown formatting or backticks.
{
    "sessions": [
        {
            "date": "string or null", // e.g. "friday", "today", or null if not mentioned
            "time": "string or null" // e.g. "10:30 PM", "14:00", or null if not mentioned
        }
    ],
    "recurrence": "once" | "weekly" | null,
    "missing_info": ["time", "dates", "recurrence"] // List fields that were not specified
}
`;

        const result = await callWithRetry(() => visionModel.generateContent(prompt));
        let text = (await result.response).text().trim();

        // Clean markdown if present
        if (text.startsWith('```json')) {
            text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        } else if (text.startsWith('```')) {
            text = text.replace(/```[a-z]*\n?/g, '').replace(/```\n?/g, '').trim();
        }

        let parsed;
        try {
            parsed = JSON.parse(text);
        } catch (e) {
            console.error('Failed to parse JSON from AI intent:', text);
            throw new Error('Invalid JSON format from AI');
        }

        const response: IntentExtractionResponse = {
            sessions: [],
            recurrence: parsed.recurrence === 'weekly' || parsed.recurrence === 'once' ? parsed.recurrence : null,
            missing_info: Array.isArray(parsed.missing_info) ? parsed.missing_info : []
        };

        if (Array.isArray(parsed.sessions)) {
            for (const s of parsed.sessions) {
                if (s.date || s.time) {
                    response.sessions.push({
                        date: typeof s.date === 'string' && s.date.toLowerCase() !== 'null' ? s.date.toLowerCase() : null,
                        time: typeof s.time === 'string' && s.time.toLowerCase() !== 'null' ? s.time : null
                    });
                }
            }
        }

        return response;
    } catch (error) {
        console.error('Error extracting intent:', error);
        return {
            sessions: [],
            recurrence: null,
            missing_info: ['time', 'dates']
        };
    }
};
