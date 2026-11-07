export interface SubTaskItem {
  id?: string;
  exercise: string;
  sets?: number;
  notes?: string;
}

export interface ParsedChallengeDescription {
  isStructured: boolean;
  globalRule?: string;
  subTasks?: SubTaskItem[];
  plainText?: string;
}

export function parseChallengeDescription(
  raw?: string | null
): ParsedChallengeDescription {
  if (!raw || typeof raw !== 'string') {
    return { isStructured: false, plainText: '' };
  }

  const trimmed = raw.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return { isStructured: false, plainText: trimmed };
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object') {
      const subTasks = parsed.sub_tasks || parsed.exercises || parsed.tasks;
      if (Array.isArray(subTasks) && subTasks.length > 0) {
        return {
          isStructured: true,
          globalRule:
            parsed.global_rule ||
            parsed.rule ||
            parsed.note ||
            parsed.instructions ||
            undefined,
          subTasks: subTasks.map((item: any, idx: number) => ({
            id: item.id || `task_${idx}`,
            exercise: item.exercise || item.name || item.title || 'Exercise',
            sets: typeof item.sets === 'number' ? item.sets : undefined,
            notes: item.notes || item.note || item.description || undefined,
          })),
        };
      }

      if (Array.isArray(parsed) && parsed.length > 0) {
        return {
          isStructured: true,
          subTasks: parsed.map((item: any, idx: number) => ({
            id: item.id || `task_${idx}`,
            exercise:
              typeof item === 'string'
                ? item
                : item.exercise || item.name || item.title || 'Exercise',
            sets: typeof item?.sets === 'number' ? item.sets : undefined,
            notes: item?.notes || item?.note || undefined,
          })),
        };
      }

      if (parsed.global_rule && !subTasks) {
        return { isStructured: false, plainText: parsed.global_rule };
      }
      if (parsed.description && typeof parsed.description === 'string') {
        return { isStructured: false, plainText: parsed.description };
      }
    }
  } catch {
    // If JSON parsing fails, fall back gracefully to raw plain text
  }

  return { isStructured: false, plainText: trimmed };
}
