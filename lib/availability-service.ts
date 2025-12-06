import { supabase } from './supabase';

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday

export interface AvailabilitySlot {
    id?: string;
    day_of_week: DayOfWeek;
    start_time: string; // HH:MM:SS
    end_time: string;   // HH:MM:SS
    is_active: boolean;
}

export interface BlockedDate {
    id?: string;
    date: string; // YYYY-MM-DD
    reason?: string;
}

export const availabilityService = {
    /**
     * Fetch all availability slots for a coach
     */
    async getAvailability(coachId: string) {
        const { data, error } = await supabase
            .from('coach_availability')
            .select('*')
            .eq('coach_id', coachId)
            .order('day_of_week', { ascending: true })
            .order('start_time', { ascending: true });

        if (error) throw error;
        return data as AvailabilitySlot[];
    },

    /**
     * Update availability slots (replace existing for the day or add new)
     * For simplicity, this function can take a full list and sync it, 
     * or we can have specific add/remove functions.
     * Let's implement a "sync" approach for a specific day to keep it simple.
     */
    async updateDayAvailability(coachId: string, day: DayOfWeek, slots: Omit<AvailabilitySlot, 'id' | 'coach_id' | 'day_of_week'>[]) {
        // 1. Delete existing slots for this day
        const { error: deleteError } = await supabase
            .from('coach_availability')
            .delete()
            .eq('coach_id', coachId)
            .eq('day_of_week', day);

        if (deleteError) throw deleteError;

        if (slots.length === 0) return;

        // 2. Insert new slots
        const newSlots = slots.map(slot => ({
            coach_id: coachId,
            day_of_week: day,
            start_time: slot.start_time,
            end_time: slot.end_time,
            is_active: slot.is_active
        }));

        const { error: insertError } = await supabase
            .from('coach_availability')
            .insert(newSlots);

        if (insertError) throw insertError;
    },

    /**
     * Fetch blocked dates
     */
    async getBlockedDates(coachId: string) {
        const { data, error } = await supabase
            .from('coach_blocked_dates')
            .select('*')
            .eq('coach_id', coachId)
            .gte('date', new Date().toISOString().split('T')[0]) // Only future/today
            .order('date', { ascending: true });

        if (error) throw error;
        return data as BlockedDate[];
    },

    /**
     * Block a specific date
     */
    async blockDate(coachId: string, date: string, reason?: string) {
        const { data, error } = await supabase
            .from('coach_blocked_dates')
            .insert({
                coach_id: coachId,
                date,
                reason
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Unblock a date
     */
    async unblockDate(id: string) {
        const { error } = await supabase
            .from('coach_blocked_dates')
            .delete()
            .eq('id', id);

        if (error) throw error;
    },

    /**
     * Check if a coach is available at a specific time
     */
    async isAvailable(coachId: string, date: Date): Promise<boolean> {
        const dateStr = date.toISOString().split('T')[0];
        const timeStr = date.toTimeString().split(' ')[0]; // HH:MM:SS
        const dayOfWeek = date.getDay() as DayOfWeek;

        // 1. Check if date is blocked
        const { data: blocked } = await supabase
            .from('coach_blocked_dates')
            .select('id')
            .eq('coach_id', coachId)
            .eq('date', dateStr)
            .single();

        if (blocked) return false;

        // 2. Check if time falls within working hours
        const { data: slots } = await supabase
            .from('coach_availability')
            .select('*')
            .eq('coach_id', coachId)
            .eq('day_of_week', dayOfWeek)
            .eq('is_active', true)
            .lte('start_time', timeStr)
            .gte('end_time', timeStr); // Wait, logic is: start <= time <= end. 
        // But SQL time comparison is tricky. 
        // Better to fetch slots and check in JS or use proper range query.

        // Let's fetch all slots for the day and check in JS for precision
        const { data: daySlots } = await supabase
            .from('coach_availability')
            .select('*')
            .eq('coach_id', coachId)
            .eq('day_of_week', dayOfWeek)
            .eq('is_active', true);

        if (!daySlots || daySlots.length === 0) return false;

        return daySlots.some(slot => timeStr >= slot.start_time && timeStr <= slot.end_time);
    }
    ,

    /**
     * Get available slots for a specific date
     */
    async getAvailableSlotsForDate(coachId: string, date: Date, clientId?: string, currentSessionId?: string, originalSessionDate?: Date): Promise<string[]> {
        // Use local date components to avoid UTC shifts
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;

        const dayOfWeek = date.getDay() as DayOfWeek;

        // 1. Check if date is blocked
        const { data: blocked, error: blockedError } = await supabase
            .from('coach_blocked_dates')
            .select('id')
            .eq('coach_id', coachId)
            .eq('date', dateStr)
            .maybeSingle();

        if (blockedError) {
            console.error('Error checking blocked dates:', blockedError);
        }

        if (blocked) return [];

        // 2. Get working hours for this day
        const { data: workSlots } = await supabase
            .from('coach_availability')
            .select('*')
            .eq('coach_id', coachId)
            .eq('day_of_week', dayOfWeek)
            .eq('is_active', true)
            .order('start_time', { ascending: true });

        if (!workSlots || workSlots.length === 0) return [];

        // 3. Get existing sessions for this date to avoid conflicts
        // Note: We need to filter by status to ignore cancelled sessions
        const startOfDay = `${dateStr}T00:00:00`;
        const endOfDay = `${dateStr}T23:59:59`;

        const { data: existingSessions } = await supabase
            .from('sessions')
            .select('scheduled_at, duration_minutes, client_id, id')
            .eq('coach_id', coachId)
            .neq('status', 'cancelled')
            .gte('scheduled_at', startOfDay)
            .lte('scheduled_at', endOfDay);

        // 3b. Check if CLIENT has a session on this day (if clientId provided)
        // EXCEPTION: If checking the SAME DAY as the original session, allow it (Step 3: "Later Today").
        // We compare date strings to be safe.
        let isOriginalDay = false;
        if (originalSessionDate) {
            const origYear = originalSessionDate.getFullYear();
            const origMonth = String(originalSessionDate.getMonth() + 1).padStart(2, '0');
            const origDay = String(originalSessionDate.getDate()).padStart(2, '0');
            const origDateStr = `${origYear}-${origMonth}-${origDay}`;
            isOriginalDay = dateStr === origDateStr;
        }

        if (clientId && !isOriginalDay) {
            let query = supabase
                .from('sessions')
                .select('id')
                .eq('client_id', clientId)
                .neq('status', 'cancelled')
                .gte('scheduled_at', startOfDay)
                .lte('scheduled_at', endOfDay);

            // Exclude the current session from the check (since we are rescheduling it)
            if (currentSessionId) {
                query = query.neq('id', currentSessionId);
            }

            const { data: clientSessions } = await query;

            // If client already has OTHER sessions this day, return empty (one session per day rule)
            if (clientSessions && clientSessions.length > 0) {
                console.log(`[Availability] Client ${clientId} already has session on ${dateStr}. Blocking day.`);
                return [];
            }
        }

        // 4. Generate 30-minute slots within working hours
        const availableSlots: string[] = [];
        const now = new Date();
        const nowYear = now.getFullYear();
        const nowMonth = String(now.getMonth() + 1).padStart(2, '0');
        const nowDay = String(now.getDate()).padStart(2, '0');
        const nowDateStr = `${nowYear}-${nowMonth}-${nowDay}`;

        const isToday = dateStr === nowDateStr;

        console.log(`[Availability] Checking slots for ${dateStr}. CoachId: ${coachId}, ClientId: ${clientId}, CurrentSessionId: ${currentSessionId}`);
        console.log(`[Availability] Work slots found: ${workSlots.length}`);
        console.log(`[Availability] Existing sessions (count): ${existingSessions?.length}`);

        for (const workSlot of workSlots) {
            // Parse start and end times from HH:MM:SS
            const [startHour, startMinute] = workSlot.start_time.split(':').map(Number);
            const [endHour, endMinute] = workSlot.end_time.split(':').map(Number);

            // Construct dates using local components to ensure safety
            let currentTime = new Date(Number(year), Number(month) - 1, Number(day), startHour, startMinute);
            const endTime = new Date(Number(year), Number(month) - 1, Number(day), endHour, endMinute);

            while (currentTime < endTime) {
                // Skip past times if it's today
                if (isToday && currentTime <= now) {
                    // console.log(`[Availability] Skipping past time: ${currentTime.toLocaleTimeString()}`);
                    currentTime.setMinutes(currentTime.getMinutes() + 30);
                    continue;
                }

                // Check for conflicts with existing sessions
                const slotIso = currentTime.toISOString();
                const isConflict = existingSessions?.some(session => {
                    // Skip conflict check with self (though we filtered by coach, so this is just extra safety)
                    if (currentSessionId && session.id === currentSessionId) return false;

                    const sessionStart = new Date(session.scheduled_at);
                    const sessionEnd = new Date(sessionStart.getTime() + (session.duration_minutes || 60) * 60000);
                    const slotEnd = new Date(currentTime.getTime() + 30 * 60000); // Assuming 30 min slots for now

                    const conflict = (
                        (currentTime >= sessionStart && currentTime < sessionEnd) || // Slot starts inside session
                        (slotEnd > sessionStart && slotEnd <= sessionEnd) || // Slot ends inside session
                        (currentTime <= sessionStart && slotEnd >= sessionEnd) // Slot encompasses session
                    );

                    if (conflict) {
                        // console.log(`[Availability] Conflict found at ${slotIso} with session ${session.id}`);
                    }
                    return conflict;
                });

                if (!isConflict) {
                    availableSlots.push(currentTime.toISOString());
                }

                currentTime.setMinutes(currentTime.getMinutes() + 30);
            }
        }

        console.log(`[Availability] Found ${availableSlots.length} slots for ${dateStr}`);
        return availableSlots;
    },

    /**
     * Find the next N available slots starting from a given date
     */
    async findNextAvailableSlots(coachId: string, startDate: Date = new Date(), limit: number = 100, clientId?: string, currentSessionId?: string, originalSessionDate?: Date): Promise<string[]> {
        let foundSlots: string[] = [];
        let currentDate = new Date(startDate);

        // Calculate End of Next Week (Sunday)
        // 1. Find days until upcoming Sunday (0 = Sunday)
        // If today is Sunday (0), days until next Sunday is 7.
        // If today is Monday (1), days until next Sunday is 6.
        const dayOfWeek = currentDate.getDay();
        const daysUntilSunday = (7 - dayOfWeek) % 7;
        // End of THIS week (Sunday)
        const endOfThisWeek = new Date(currentDate);
        endOfThisWeek.setDate(currentDate.getDate() + daysUntilSunday);

        // End of NEXT week (Sunday) = End of This Week + 7 days
        const endOfNextWeek = new Date(endOfThisWeek);
        endOfNextWeek.setDate(endOfThisWeek.getDate() + 7);
        // Set to end of day
        endOfNextWeek.setHours(23, 59, 59, 999);

        console.log(`[Availability] Finding slots from ${startDate.toDateString()} until ${endOfNextWeek.toDateString()}`);

        // Loop until we pass the end of next week OR hit a very high safety limit (e.g. 100 slots or 30 days)
        let daysChecked = 0;
        while (currentDate <= endOfNextWeek && daysChecked < 21) {
            const slots = await this.getAvailableSlotsForDate(coachId, currentDate, clientId, currentSessionId, originalSessionDate);
            foundSlots = [...foundSlots, ...slots];

            // Only break if we hit the hard limit (user requested "all" slots, but we need some safety)
            if (foundSlots.length >= limit) break;

            currentDate.setDate(currentDate.getDate() + 1);
            daysChecked++;
        }

        console.log(`[Availability] Total slots found: ${foundSlots.length}`);
        return foundSlots;
    }
};
