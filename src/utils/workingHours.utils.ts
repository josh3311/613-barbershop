import { DayOfWeek, WorkingHours } from '@/types/common.types';

/** JavaScript Sunday=0 … Saturday=6 → Firestore day keys */
export const JS_WEEKDAY_TO_KEY: Record<number, DayOfWeek> = {
  0: 'sunday',
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday',
  6: 'saturday',
};

export function dayKeyFromDate(d: Date): DayOfWeek {
  return JS_WEEKDAY_TO_KEY[d.getDay()];
}

export function parseHm(t: string): { hour: number; minute: number } {
  const m = t.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return { hour: 9, minute: 0 };
  return {
    hour: Math.min(23, Math.max(0, parseInt(m[1], 10))),
    minute: Math.min(59, Math.max(0, parseInt(m[2], 10))),
  };
}

/** Build next `horizonDays` calendar dates (from today) where the barber works. */
export function buildWorkingDates(wh: WorkingHours | null | undefined, horizonDays = 21): Date[] {
  const out: Date[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < horizonDays; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const key = dayKeyFromDate(d);
    const sch = wh?.[key];
    if (sch?.isWorking) out.push(d);
  }
  return out;
}

export interface SlotParts {
  key: string;
  label: string;
  hour: number;
  minute: number;
}

/** 30-minute slots from start–end (end exclusive for slot start: last slot begins at end−30m). */
export function buildHalfHourSlots(startTime: string, endTime: string): SlotParts[] {
  const start = parseHm(startTime);
  const end = parseHm(endTime);
  let cur = start.hour * 60 + start.minute;
  const endMin = end.hour * 60 + end.minute;
  const slots: SlotParts[] = [];
  while (cur + 30 <= endMin) {
    const h = Math.floor(cur / 60);
    const min = cur % 60;
    const padH = String(h).padStart(2, '0');
    const padM = min === 0 ? '00' : String(min);
    const key = `${padH}:${padM}`;
    const period = h < 12 ? 'AM' : 'PM';
    const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h;
    const displayM = min === 0 ? '00' : '30';
    slots.push({
      key,
      label: `${displayH}:${displayM} ${period}`,
      hour: h,
      minute: min,
    });
    cur += 30;
  }
  return slots;
}
