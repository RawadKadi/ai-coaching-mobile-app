import { visionModel } from './google-ai';

export interface ProposedSession {
    scheduled_at: string;
    duration_minutes: number;
    session_type: 'training' | 'nutrition' | 'check_in' | 'consultation' | 'other';
    notes: string;
    recurrence?: 'weekly' | 'once';
    day_of_week?: string;
    status?: string;
    aiRecurrenceDetected?: boolean;
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
    summary_message?: string; // e.g., "I've drafted 3 sessions based on your request."
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

6. **SCENARIO-BASED INTENT RECOGNITION**:
   
   **Scenario A: The Multi-Day Standard**
   - Input: "Schedule Mon, Wed, Fri at 10am"
   - Action: Return 3 separate session objects.
   - Recurrence: Set to "weekly" by default.

   **Scenario B: The Global Override**
   - Input: "Schedule all sessions at 1pm, but Wednesday at 5pm"
   - Action: Identify relevant days (if unspecified, assume Mon-Fri). Create sessions for each day at 1pm, EXCEPT Wednesday which MUST be 5pm.
   - Recurrence: Set to "weekly" by default.

   **Scenario C: The Specific Date (One-Time)**
   - Input: "Let's meet this Friday at 9am" or "May 22nd at 2pm"
   - Action: Return 1 session object for that specific date.
   - Recurrence: Set to "once" by default.

   **Scenario D: The Vague/Lazy Input**
   - Input: "Monday 9am"
   - Action: Return 1 session object. 
   - Recurrence: Set to "once" by default, but flag aiRecurrenceDetected if it's a general weekday without a specific "this" or "next".

7. **DISTRIBUTIVE SCHEDULING**:
   - If the coach says "all sessions at [Time A] only [Day] at [Time B]", it means:
     - All relevant days (usually Mon-Fri or specified days) should be at [Time A].
     - EXCEPT the specific [Day] which should be at [Time B].
   - Example: "draft all sessions at 1pm only wed at 5pm"
     - RESULT: Mon @ 1pm, Tue @ 1pm, Wed @ 5pm, Thu @ 1pm, Fri @ 1pm.

RESPONSE FORMAT (JSON ONLY):
{
  "sessions": [
    {
      "scheduled_at": "ISO_STRING", // UTC
      "duration_minutes": 60,
      "session_type": "training",
      "notes": "Context from input",
      "recurrence": "weekly", // or "once"
      "day_of_week": "Monday",
      "aiRecurrenceDetected": true // if the intent for recurrence was clearly identified from prompt
    }
  ],
  "summary_message": "I've drafted 3 sessions based on your request.",
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
You are a scheduling intent extractor for a coaching app.
Your job: parse the coach's input and return EVERY individual session that should be scheduled, with its exact day and time.

Rules:
- Handle typos ("wednsday" -> "wednesday"), abbreviations ("wed" -> "wednesday", "mon" -> "monday").
- Resolve all day names to lowercase: monday, tuesday, wednesday, thursday, friday, saturday, sunday, today, tomorrow.
- "all days" or "all sessions" = monday, tuesday, wednesday, thursday, friday (Mon-Fri by default unless context says otherwise).
- Override pattern: "all at X only [day] at Y" means every standard day gets time X EXCEPT the specified day which gets time Y.
- Expand ALL implied days into explicit session entries. One entry per session.
- If a day is not specified at all, return a single session with date: null.
- If a time is not specified, return time: null.
- "every week", "weekly", "each" -> recurrence: "weekly". "once", "today", "this friday", specific date -> recurrence: "once". Default: "once".

Examples:
Input: "all days at 1pm only wednesday at 5pm"
Output sessions: monday@1pm, tuesday@1pm, wednesday@5pm, thursday@1pm, friday@1pm

Input: "schedule tuesday and thursday at 10am"
Output sessions: tuesday@10am, thursday@10am

Input: "schedule at 3pm"
Output sessions: [{ date: null, time: "3:00 PM" }]

Input: "${input}"

Return ONLY valid JSON, no markdown:
{
  "sessions": [
    { "date": "monday", "time": "1:00 PM" },
    { "date": "wednesday", "time": "5:00 PM" }
  ],
  "recurrence": "weekly",
  "missing_info": []
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

export interface AgendaContext {
    days: string[];
    times: string[]; // e.g. ["13:00", "14:00"]
}

const LOCAL_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export const extractAgendaContext = async (input: string): Promise<AgendaContext> => {
    const lowerInput = input.toLowerCase();
    
    // Optimization: Local Regex "Fast Pass" for simple day/time patterns
    const foundDays = LOCAL_DAYS.filter(day => lowerInput.includes(day));
    
    // Simple time regex (handles: 1pm, 13:00, 2:30 pm, 10 am)
    const timeRegex = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/g;
    const foundTimes: string[] = [];
    let match;
    
    while ((match = timeRegex.exec(lowerInput)) !== null) {
        let h = parseInt(match[1]);
        const m = match[2] ? parseInt(match[2]) : 0;
        const ampm = match[3];

        if (ampm === 'pm' && h < 12) h += 12;
        if (ampm === 'am' && h === 12) h = 0;
        
        if (h >= 0 && h < 24) {
            foundTimes.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
        }
    }

    // If we found specific days/times and it's not a complex request (no "all week", "next", etc.)
    // skip the AI and return local results to save API quota.
    const isComplex = lowerInput.includes('every') || lowerInput.includes('all') || lowerInput.includes('next') || lowerInput.includes('-');
    if (foundDays.length > 0 && !isComplex) {
        return { days: foundDays, times: foundTimes };
    }

    try {
        const prompt = `
Extract the specific days of the week and specific times mentioned in this coaching scheduling input.
Return a JSON object with:
- "days": array of lowercase day names (monday, tuesday, etc.)
- "times": array of 24h format strings (e.g. "13:00")

Handle ranges like "Mon-Fri" or "all week" (return all 5/7 days).
Handle vague times like "1pm" -> "13:00".

Input: "${input}"

Example: "Schedule Mon, Wed at 1pm" -> {"days": ["monday", "wednesday"], "times": ["13:00"]}
Example: "all sessions at 1pm and wednesday at 2pm" -> {"days": ["monday", "tuesday", "wednesday", "thursday", "friday"], "times": ["13:00", "14:00"]}

Return ONLY the JSON object.
`;

        const result = await callWithRetry(() => visionModel.generateContent(prompt));
        let text = (await result.response).text().trim();
        
        if (text.startsWith('```json')) {
            text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        } else if (text.startsWith('```')) {
            text = text.replace(/```[a-z]*\n?/g, '').replace(/```\n?/g, '').trim();
        }

        const parsed = JSON.parse(text);
        return {
            days: Array.isArray(parsed.days) ? parsed.days : [],
            times: Array.isArray(parsed.times) ? parsed.times : []
        };
    } catch (error) {
        console.error('Error extracting agenda context:', error);
        return { days: [], times: [] };
    }
};
