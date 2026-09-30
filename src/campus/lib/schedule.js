import { timetableSlots } from './timetable.js';

const at = time => { const [h, m] = time.split(':').map(Number); return h * 3600 + m * 60; };
// Split merged subjects at recesses, including when the same subject resumes afterwards.
function sessions(blocks) {
  return blocks.flatMap(block => {
    let start = block.start;
    const result = [];
    for (const recess of timetableSlots.filter(slot => slot.recess)) {
      if (recess.start >= start && recess.end <= block.end) {
        if (start < recess.start) result.push({ ...block, start, end: recess.start });
        start = recess.end;
      }
    }
    if (start < block.end) result.push({ ...block, start });
    return result.map(session => ({ ...session, teachingPeriods: (at(session.end) - at(session.start)) / 3000 }));
  });
}

export function getClassState(schedule, now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: schedule.timezone, weekday: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).formatToParts(now).map(p => [p.type, p.value]));
  const day = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(parts.weekday) + 1;
  const seconds = Number(parts.hour) * 3600 + Number(parts.minute) * 60 + Number(parts.second);
  const today = sessions(schedule.days.find(d => d.weekday === day)?.blocks || []);
  const active = today.find(b => seconds >= at(b.start) && seconds < at(b.end));
  const recess = today.length ? timetableSlots.find(slot => slot.recess && seconds >= at(slot.start) && seconds < at(slot.end)) : undefined;
  const nextBlock = today.find(b => at(b.start) > seconds);
  const next = nextBlock ? { ...nextBlock, weekday: day, daysAway: 0, secondsUntil: at(nextBlock.start) - seconds } : undefined;
  const interval = recess || active;
  const showNext = Boolean(next && (interval || next.secondsUntil <= 20 * 60));
  return {
    active, recess, next, showNext,
    remaining: interval ? at(interval.end) - seconds : next?.secondsUntil,
    progress: interval ? (seconds - at(interval.start)) / (at(interval.end) - at(interval.start)) : 0
  };
}
