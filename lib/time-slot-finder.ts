/**
 * Time Slot Finder - Recommends available time slots for scheduling
 */

import { TimeSlotRecommendation } from '@/types/conflict';

interface Session {
    id: string;
    scheduled_at: string;
    duration_minutes: number;
    client_id?: string;
    status?: string;
}

interface FindSlotsOptions {
    proposedTime: string; // ISO string
    duration: number; // minutes
    existingSessions: Session[];
    targetClientId?: string;
    recurrence?: 'weekly' | 'once';
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
    ignoreSessionId,
    recurrence,
}: FindSlotsOptions & { ignoreSessionId?: string }): TimeSlotRecommendation[] {
    const recommendations: TimeSlotRecommendation[] = [];
    const proposedDate = new Date(proposedTime);
    const now = new Date();

    // console.log(`[SlotFinder] Searching for slots on ${proposedDate.toLocaleDateString()} for Client ${targetClientId}`);

    // Helper: Check if time slot is available
    const isSlotAvailable = (time: Date): boolean => {
        // 1. Filter Past Slots (with 5-minute buffer to account for processing time)
        const nowWithBuffer = new Date(now.getTime() - 5 * 60000);
        if (time < nowWithBuffer) {
            console.log(`[SlotFinder] ${time.toLocaleTimeString()} - PAST (skipped)`);
            return false;
        }

        const slotStart = time;
        const slotEnd = new Date(time.getTime() + duration * 60000);

        // Check coach availability (no overlaps on same day)
        const hasOverlap = existingSessions.some(session => {
            if (session.id === ignoreSessionId) return false;
            if (session.status === 'cancelled') return false;
            // DO NOT exclude 'pending_resolution' or 'proposed' - they are REAL sessions that block time!

            const sessionStart = new Date(session.scheduled_at);

            // Must be same day
            if (!isSameDay(slotStart, sessionStart)) {
                return false;
            }

            const sessionDuration = session.duration_minutes || 60;
            const sessionEnd = new Date(sessionStart.getTime() + sessionDuration * 60000);
            const overlaps = slotStart < sessionEnd && slotEnd > sessionStart;

            if (overlaps) {
                console.log(`[SlotFinder] ${time.toLocaleTimeString()} - OVERLAP with session at ${sessionStart.toLocaleTimeString()} (client: ${session.client_id}, status: ${session.status})`);
            }

            return overlaps;
        });

        if (hasOverlap) {
            return false;
        }

        // Check client limit (one per day)
        if (targetClientId) {
            const clientSessionsToday = existingSessions.filter(session => {
                if (session.id === ignoreSessionId) return false;
                if (session.status === 'cancelled') return false;
                // DO NOT exclude pending_resolution - client still has a session that day!
                if (session.client_id !== targetClientId) return false;

                const sessionDate = new Date(session.scheduled_at);
                return isSameDay(slotStart, sessionDate);
            });

            if (clientSessionsToday.length > 0) {
                console.log(`[SlotFinder] ${time.toLocaleTimeString()} - CLIENT LIMIT (client ${targetClientId} already has session today)`);
                return false;
            }
        }

        console.log(`[SlotFinder] ${time.toLocaleTimeString()} - AVAILABLE ✓`);
        return true;
    };

    // Helper: Check if two dates are the same day
    const isSameDay = (date1: Date, date2: Date): boolean => {
        const d1 = new Date(date1);
        const d2 = new Date(date2);
        return d1.getFullYear() === d2.getFullYear() &&
            d1.getMonth() === d2.getMonth() &&
            d1.getDate() === d2.getDate();
    };

    // INTENT LOCKING: Only search for slots on the SAME DAY as the proposed time
    // We do NOT look for "tomorrow" or "next week" unless explicitly asked (which would come in as a different proposedTime)

    // 1. Find available slots on the SAME DAY
    let availableSlots = findSlotsOnDay(proposedDate, duration, isSlotAvailable);

    // 2. If fewer than 3 slots found, search future occurrences
    if (availableSlots.length < 3) {
        const searchLimit = recurrence === 'weekly' ? 14 : 3; // Search up to 3 days for 'once' if day is full

        for (let i = 1; i <= searchLimit; i++) {
            const nextDate = new Date(proposedDate);
            if (recurrence === 'weekly') {
                nextDate.setDate(proposedDate.getDate() + (i * 7));
            } else {
                nextDate.setDate(proposedDate.getDate() + i);
            }

            const nextDaySlots = findSlotsOnDay(nextDate, duration, isSlotAvailable);
            availableSlots = [...availableSlots, ...nextDaySlots];

            if (availableSlots.length >= 10) break;
        }
    }

    availableSlots.forEach(slot => {
        // Calculate priority based on closeness to original time
        const diffMinutes = Math.abs(slot.getTime() - proposedDate.getTime()) / 60000;
        let priority: 'high' | 'medium' | 'low' = 'low';

        if (diffMinutes <= 60) priority = 'high';
        else if (diffMinutes <= 180) priority = 'medium';

        // Check if it's a different day
        const isDifferentDay = !isSameDay(slot, proposedDate);
        const label = isDifferentDay
            ? slot.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
            : slot.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

        recommendations.push({
            time: slot.toISOString(),
            label: label,
            reason: isDifferentDay ? 'Alternative day' : getReasonText(diffMinutes),
            priority,
        });
    });

    // Sort chronologically (early to late)
    return recommendations.sort((a, b) => {
        return new Date(a.time).getTime() - new Date(b.time).getTime();
    });
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
