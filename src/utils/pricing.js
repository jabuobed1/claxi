export const LESSON_DURATION_OPTIONS = [10, 20, 30, 45, 60, 90];

export function getLessonPrice(minutes) {
  if (minutes <= 10) return 40;
  if (minutes <= 20) return 80;
  if (minutes <= 30) return 120;
  if (minutes <= 45) return 180;
  if (minutes <= 60) return 250;
  return 300;
}
