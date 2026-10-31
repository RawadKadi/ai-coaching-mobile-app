import { Habit, HabitLog } from '@/types/database';

export interface UnifiedDailyTask {
  id: string;
  name: string;
  subtitle: string;
  category: string;
  isEssential: boolean;
  completed: boolean;
  type: 'check_in' | 'meal_log' | 'habit';
  habit?: Habit;
}

export function getUnifiedDailyTasks({
  habits = [],
  habitLogs = [],
  isCheckedIn = false,
  mealsCount = 0,
}: {
  habits?: Habit[];
  habitLogs?: HabitLog[];
  isCheckedIn?: boolean;
  mealsCount?: number;
}): UnifiedDailyTask[] {
  const essentials: UnifiedDailyTask[] = [
    {
      id: 'essential_check_in',
      name: 'Daily Check-in',
      subtitle: 'Coach Check-in',
      category: 'Daily Essential',
      isEssential: true,
      completed: isCheckedIn,
      type: 'check_in',
    },
    {
      id: 'essential_log_meal',
      name: 'Log a Meal',
      subtitle: 'At least 1 meal',
      category: 'Daily Essential',
      isEssential: true,
      completed: mealsCount > 0,
      type: 'meal_log',
    },
  ];

  const coachTasks: UnifiedDailyTask[] = habits.map((habit) => {
    const isCompleted = habitLogs.some(
      (l) => l.habit_id === habit.id && l.completed,
    );
    return {
      id: habit.id,
      name: habit.name,
      subtitle: habit.target_value
        ? `${habit.target_value} ${habit.unit || ''}`
        : habit.category || 'Daily Goal',
      category: habit.category || 'Daily Task',
      isEssential: false,
      completed: isCompleted,
      type: 'habit',
      habit,
    };
  });

  return [...essentials, ...coachTasks];
}
