/**
 * Time Slot Finder - Recommends available time slots for scheduling
 */

import { TimeSlotRecommendation } from '@/types/conflict';

interface Session {
    scheduled_at: string;
    duration_minutes: number;
    client_id?: string;
}

interface FindSlotsOptions {
    proposedTime: string; // ISO string
    duration: number; // minutes
    existingSessions: Session[];
    targetClientId?: string;
}

/**
 * Find available time slots for a session
 * Returns recommendations ordered by priority
 */
export function findAvailableSlots({
    proposedTime,
    duration,
    existingSessions,
    targetClientId,
}: FindSlotsOptions): TimeSlotRecommendation[] {
    const recommendations: TimeSlotRecommendation[] = [];
    const proposedDate = new Date(proposedTime);

    // Helper: Check if time slot is available
    const isSlotAvailable = (time: Date): boolean => {
        const slotStart = time;
        const slotEnd = new Date(time.getTime() + duration * 60000);

        // Check coach availability (no overlaps on same day)
        const hasOverlap = existingSessions.some(session => {
            const sessionStart = new Date(session.scheduled_at);

            // Must be same day
            if (!isSameDay(slotStart, sessionStart)) return false;

            const sessionEnd = new Date(sessionStart.getTime() + session.duration_minutes * 60000);
            return slotStart < sessionEnd && slotEnd > sessionStart;
        });

        if (hasOverlap) return false;

        // Check client limit (one per day)
        if (targetClientId) {
            const clientHasSessionToday = existingSessions.some(session => {
                if (session.client_id !== targetClientId) return false;
                const sessionDate = new Date(session.scheduled_at);
                return isSameDay(slotStart, sessionDate);
            });

            if (clientHasSessionToday) return false;
        }

        return true;
    };

    // Helper: Check if two dates are the same day
    const isSameDay = (date1: Date, date2: Date): boolean => {
        return date1.getDate() === date2.getDate() &&
            date1.getMonth() === date2.getMonth() &&
            date1.getFullYear() === date2.getFullYear();
    };

    // INTENT LOCKING: Only search for slots on the SAME DAY as the proposed time
    // We do NOT look for "tomorrow" or "next week" unless explicitly asked (which would come in as a different proposedTime)

    // 1. Find available slots on the SAME DAY
    const sameDaySlots = findSlotsOnDay(proposedDate, duration, isSlotAvailable);

    sameDaySlots.forEach(slot => {
        // Calculate priority based on closeness to original time
        const diffMinutes = Math.abs(slot.getTime() - proposedDate.getTime()) / 60000;
        let priority: 'high' | 'medium' | 'low' = 'low';

        if (diffMinutes <= 60) priority = 'high';
        else if (diffMinutes <= 180) priority = 'medium';

        recommendations.push({
            time: slot.toISOString(),
            label: slot.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
            reason: getReasonText(diffMinutes),
            priority,
        });
    });

    // Sort chronologically (early to late)
    return recommendations.sort((a, b) => {
        return new Date(a.time).getTime() - new Date(b.time).getTime();
    }); // Return ALL slots, no limit
}

function getReasonText(diffMinutes: number): string {
    if (diffMinutes === 0) return 'Same time';
    if (diffMinutes <= 60) return 'Closest available time';
    return 'Available slot on same day';
}

/**
 * Find available slots on a specific day
 */
function findSlotsOnDay(
    targetDate: Date,
    duration: number,
    isAvailable: (time: Date) => boolean
): Date[] {
    const slots: Date[] = [];
    const workingHours = { start: 6, end: 22 }; // 6 AM to 10 PM

    // Start from the beginning of the working day
    let currentTime = new Date(targetDate);
    currentTime.setHours(workingHours.start, 0, 0, 0);

    const endOfDay = new Date(targetDate);
    endOfDay.setHours(workingHours.end, 0, 0, 0);

    while (currentTime < endOfDay) {
        if (isAvailable(currentTime)) {
            slots.push(new Date(currentTime));
        }
        // Increment by 30 minutes
        currentTime = new Date(currentTime.getTime() + 30 * 60000);
    }

    return slots;
}
