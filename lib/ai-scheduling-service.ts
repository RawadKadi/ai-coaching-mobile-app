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

REQUIREMENTS:
1. Extract session details: date/day, time, duration, and type.
2. **DURATION CONSTRAINT**: Sessions MUST be exactly 60 minutes.
   - If the user requests a duration longer than 60 minutes (e.g., "4-7pm", "3 hours"), DO NOT schedule it.
   - Return "clarification": { "type": "duration_invalid", "message": "Sessions must be exactly 1 hour. Please adjust your request." }
3. Resolve relative dates (e.g., "next Tuesday" based on Current Date).
4. **RECURRENCE AMBIGUITY (CRITICAL)**:
   - **VAGUE REQUESTS**: If the user says "Change schedule to 4-5 PM", "Move time one hour later", "Shift the session", or "Make it 6 PM" WITHOUT explicitly mentioning a specific date (e.g., "March 12") or "every week"/"all Tuesdays", you **MUST** ask for clarification.
     - Return "clarification": { "type": "recurrence_ambiguity", "message": "Do you want to apply this change to just this date or every week?" }
   - **EXPLICIT REQUESTS**:
     - "Change all Tuesdays..." -> recurrence: "weekly"
     - "Change Tuesday 12 March..." -> recurrence: "once"
     - "This week only..." -> recurrence: "once"
5. TIMEZONE HANDLING: The input time is in **${request.clientContext.timezone}**. You MUST convert it to UTC for the "scheduled_at" field.
6. Default type is 'training' if not specified.
7. If CRITICAL info is missing (day/date or time), ask a clarifying question.
   - Return "clarification": { "type": "general", "message": "Please specify the day and time." }
8. Return dates in ISO 8601 format (UTC).

MODIFICATION RULES:
- If "Current Proposed Schedule" is provided:
  - If the user answers the clarifying question with "1" or "This date only", update ONLY the specific session (recurrence: "once").
  - If the user answers "2" or "Every week", update the session and set recurrence: "weekly".

RESPONSE FORMAT (JSON ONLY):
{
  "sessions": [
    {
      "scheduled_at": "ISO_STRING",
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
