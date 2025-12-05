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
    clarifying_question?: string;
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

REQUIREMENTS:
1. Extract session details: date/day, time, duration, and type.
2. Resolve relative dates (e.g., "next Tuesday" based on Current Date).
3. Detect RECURRENCE: If input says "every Monday" or "weekly", set "recurrence" to "weekly".
4. TIMEZONE HANDLING: The input time is in **${request.clientContext.timezone}**. You MUST convert it to UTC for the "scheduled_at" field.
   - Example: If timezone is "Europe/Beirut" (UTC+2) and input is 20:00, output 18:00Z.
   - Example: If timezone is "America/New_York" (UTC-5) and input is 10:00, output 15:00Z.
5. Default duration is 60 minutes if not specified.
6. Default type is 'training' if not specified.
7. If CRITICAL info is missing (specifically: day/date or time), ask a clarifying question.
8. Return dates in ISO 8601 format (UTC).

MODIFICATION RULES:
- If "Current Proposed Schedule" is provided:
  - "Change Monday to Tuesday" -> Update the recurring session.
  - "Change THIS Friday to 8pm" -> If it's a recurring session, this might imply a one-time exception. However, for simplicity, if the user specifies a specific date, treat it as a one-time session (recurrence: "once") replacing the recurring instance for that week? 
  - BETTER RULE: If the user says "Change [Day] to [Time]", assume it updates the RECURRING rule if the original was recurring.
  - If the user says "Just for this week" or "Only this Friday", set "recurrence" to "once" for that specific session.
- If the input adds new sessions, append them to the list.
- If the input is a completely new request that contradicts the old one, replace the list.

RESPONSE FORMAT (JSON ONLY):
{
  "sessions": [
    {
      "scheduled_at": "ISO_STRING", // Next occurrence
      "duration_minutes": 60,
      "session_type": "training",
      "notes": "Context from input",
      "recurrence": "weekly", // or "once"
      "day_of_week": "Monday" // Optional, for display
    }
  ],
  "missing_info": [],
  "clarifying_question": null
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
