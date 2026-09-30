export const timetableSlots = [
  { start: '14:45', end: '15:35' },
  { start: '15:35', end: '16:25' },
  { start: '16:25', end: '16:40', recess: true },
  { start: '16:40', end: '17:30' },
  { start: '17:30', end: '18:20' },
  { start: '18:20', end: '18:35', recess: true },
  { start: '18:35', end: '19:25' },
  { start: '19:25', end: '20:15' },
];

export function subjectAt(day, slot) {
  if (slot.recess) return null;
  return day?.blocks.find(block => block.start <= slot.start && block.end >= slot.end)?.subject ?? null;
}
