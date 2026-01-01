const handleSaveSessions = async (proposedSessions: ProposedSession[]) => {
  if (!coach || !client) return;

  try {
    console.log('[SaveSessions] Processing', proposedSessions.length, 'proposed sessions');
    
    const sessionsToInsert: any[] = [];
    const sessionsToUpdate: { id: string; data: any }[] = [];
    const WEEKS_TO_SCHEDULE = 4;

    for (const session of proposedSessions) {
      if (session.recurrence === 'weekly') {
        const startDate = new Date(session.scheduled_at);
        
        for (let i = 0; i < WEEKS_TO_SCHEDULE; i++) {
          const nextDate = new Date(startDate);
          nextDate.setDate(startDate.getDate() + (i * 7));
          
          // Check if THIS CLIENT already has a session on this exact day
          const existingOnSameDay = allCoachSessions.find(s => {
            if (s.client_id !== client.id) return false;
            if (s.status === 'cancelled') return false;
            
            const existingDate = new Date(s.scheduled_at);
            return (
              existingDate.getFullYear() === nextDate.getFullYear() &&
              existingDate.getMonth() === nextDate.getMonth() &&
              existingDate.getDate() === nextDate.getDate()
            );
          });

          // Check for conflicts with OTHER clients
          const instanceStart = nextDate.getTime();
          const instanceEnd = instanceStart + session.duration_minutes * 60000;
          const instanceConflict = allCoachSessions.some(s => {
              if (s.status === 'cancelled') return false;
              if (s.client_id === client.id) return false; // Ignore same client
              const start = new Date(s.scheduled_at).getTime();
              const end = start + s.duration_minutes * 60000;
              return (start < instanceEnd && end > instanceStart);
          });

          const sessionData = {
            coach_id: coach.id,
            client_id: client.id,
            scheduled_at: nextDate.toISOString(),
            duration_minutes: session.duration_minutes,
            session_type: session.session_type,
            notes: session.notes,
            status: instanceConflict ? 'pending_resolution' : 'scheduled',
            is_locked: true,
            ai_generated: true,
          };

          if (existingOnSameDay) {
            // UPDATE existing session
            console.log(`[SaveSessions] Updating existing session ${existingOnSameDay.id} on ${nextDate.toLocaleDateString()}`);
            sessionsToUpdate.push({ 
              id: existingOnSameDay.id, 
              data: { 
                ...sessionData, 
                meet_link: existingOnSameDay.meet_link // Keep existing meet link
              } 
            });
          } else {
            // INSERT new session
            console.log(`[SaveSessions] Creating new session on ${nextDate.toLocaleDateString()}`);
            sessionsToInsert.push({
              ...sessionData,
              meet_link: `https://meet.jit.si/${coach.id}-${client.id}-${Date.now()}-week${i}`,
            });
          }
        }
      } else {
        // Single session
        const proposedDate = new Date(session.scheduled_at);
        const existingOnSameDay = allCoachSessions.find(s => {
          if (s.client_id !== client.id) return false;
          if (s.status === 'cancelled') return false;
          
          const existingDate = new Date(s.scheduled_at);
          return (
            existingDate.getFullYear() === proposedDate.getFullYear() &&
            existingDate.getMonth() === proposedDate.getMonth() &&
            existingDate.getDate() === proposedDate.getDate()
          );
        });

        // Check for overlaps with OTHER clients
        const proposedStart = new Date(session.scheduled_at).getTime();
        const proposedEnd = proposedStart + session.duration_minutes * 60000;
        const hasConflict = allCoachSessions.some(s => {
            if (s.status === 'cancelled') return false;
            if (s.client_id === client.id) return false;
            const start = new Date(s.scheduled_at).getTime();
            const end = start + s.duration_minutes * 60000;
            return (start < proposedEnd && end > proposedStart);
        });

        const sessionData = {
          coach_id: coach.id,
          client_id: client.id,
          scheduled_at: session.scheduled_at,
          duration_minutes: session.duration_minutes,
          session_type: session.session_type,
          notes: session.notes,
          status: hasConflict ? 'pending_resolution' : 'scheduled',
          is_locked: true,
          ai_generated: true,
        };

        if (existingOnSameDay) {
          console.log(`[SaveSessions] Updating existing session ${existingOnSameDay.id} on ${proposedDate.toLocaleDateString()}`);
          sessionsToUpdate.push({ 
            id: existingOnSameDay.id, 
            data: { 
              ...sessionData, 
              meet_link: existingOnSameDay.meet_link 
            } 
          });
        } else {
          console.log(`[SaveSessions] Creating new session on ${proposedDate.toLocaleDateString()}`);
          sessionsToInsert.push({
            ...sessionData,
            meet_link: `https://meet.jit.si/${coach.id}-${client.id}-${Date.now()}`,
          });
        }
      }
    }

    // Perform updates first
    if (sessionsToUpdate.length > 0) {
      console.log('[SaveSessions] Updating', sessionsTo Update.length, 'sessions');
      for (const { id, data } of sessionsToUpdate) {
        const { error } = await supabase.from('sessions').update(data).eq('id', id);
        if (error) {
          console.error('[SaveSessions] Update error for session', id, ':', error);
          throw error;
        }
      }
    }

    // Then perform inserts
    if (sessionsToInsert.length > 0) {
      console.log('[SaveSessions] Inserting', sessionsToInsert.length, 'new sessions');
      const { error } = await supabase.from('sessions').insert(sessionsToInsert);
      if (error) {
        console.error('[SaveSessions] Insert error:', error);
        throw error;
      }
    }

    const total = sessionsToUpdate.length + sessionsToInsert.length;
    Alert.alert('Success', `${total} session(s) saved! (${sessionsToUpdate.length} updated, ${sessionsToInsert.length} created)`);
    await loadClientData(); // Reload to reflect changes
  } catch (error: any) {
    console.error('Error in handleSaveSessions:', error);
    Alert.alert('Error', error.message || 'Failed to save sessions');
  }
};
