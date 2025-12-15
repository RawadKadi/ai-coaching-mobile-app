interface ParsedScheduleInfo {
    time?: string;        // 24-hour format: "19:25", "14:00"
    dates?: string[];     // keywords: ["today", "monday"], etc.
    recurrence?: 'once' | 'weekly' | null;
    originalInput: string;
    hasTime: boolean;
    hasDate: boolean;
}

/**
 * Parses natural language scheduling input to extract time, date, and recurrence.
 * 
 * Examples:
 * - "Schedule at 7:25pm" -> { time: "19:25", hasTime: true, hasDate: false }
 * - "Schedule today at 2pm" -> { time: "14:00", dates: ["today"], hasTime: true, hasDate: true }
 * - "Every Monday at 9am" -> { time: "09:00", dates: ["monday"], recurrence: "weekly" }
 * - "today and monday" -> { dates: ["today", "monday"], hasTime: false, hasDate: true }
 */
export function parseSchedulingInput(input: string): ParsedScheduleInfo {
    const lowercaseInput = input.toLowerCase();

    const result: ParsedScheduleInfo = {
        originalInput: input,
        hasTime: false,
        hasDate: false,
        recurrence: null,
    };

    // ===== TIME PARSING =====
    // Match formats: "7:25pm", "7pm", "19:25", "2:00 am"
    const timeRegex = /(\d{1,2}):?(\d{2})?\s*(am|pm)?/gi;
    const timeMatches = lowercaseInput.match(timeRegex);

    if (timeMatches && timeMatches.length > 0) {
        const timeStr = timeMatches[0];
        const parsed = parseTimeString(timeStr);
        if (parsed) {
            result.time = parsed;
            result.hasTime = true;
        }
    }

    // ===== DATE PARSING =====
    const dateKeywords = ['today', 'tomorrow', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const foundDates: string[] = [];
    for (const keyword of dateKeywords) {
        if (lowercaseInput.includes(keyword)) {
            foundDates.push(keyword);
        }
    }

    if (foundDates.length > 0) {
        result.dates = foundDates;
        result.hasDate = true;
    }

    // ===== RECURRENCE PARSING =====
    const weeklyKeywords = ['every', 'weekly', 'all'];
    const onceKeywords = ['only', 'just', 'one time', 'single'];

    for (const keyword of weeklyKeywords) {
        if (lowercaseInput.includes(keyword)) {
            result.recurrence = 'weekly';
            break;
        }
    }

    if (!result.recurrence) {
        for (const keyword of onceKeywords) {
            if (lowercaseInput.includes(keyword)) {
                result.recurrence = 'once';
                break;
            }
        }
    }

    return result;
}

/**
 * Converts time string to 24-hour format (HH:mm)
 * Examples: "7pm" -> "19:00", "7:25am" -> "07:25", "14:30" -> "14:30"
 */
function parseTimeString(timeStr: string): string | null {
    const cleanStr = timeStr.trim().toLowerCase();

    // Match components
    const match = cleanStr.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/);
    if (!match) return null;

    let hours = parseInt(match[1]);
    const minutes = match[2] ? parseInt(match[2]) : 0;
    const meridiem = match[3];

    // Handle 12-hour format
    if (meridiem) {
        if (meridiem === 'pm' && hours !== 12) {
            hours += 12;
        } else if (meridiem === 'am' && hours === 12) {
            hours = 0;
        }
    }

    // Validate
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        return null;
    }

    // Format as HH:mm
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}
