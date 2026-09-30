import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {subjectAt,timetableSlots} from './timetable.js';
const schedule=JSON.parse(readFileSync(new URL('../../../public/horario.json',import.meta.url)));
test('every day has six class slots with the original subject totals',()=>{
 for(const day of schedule.days){
  const subjects=timetableSlots.filter(s=>!s.recess).map(s=>subjectAt(day,s));
  assert.equal(subjects.length,6);assert.ok(subjects.every(Boolean));
  for(const block of day.blocks) assert.equal(subjects.filter(s=>s===block.subject).length,block.teachingPeriods);
 }
});
test('breaks remain visible inside merged three-period blocks',()=>{
 const breaks=timetableSlots.filter(s=>s.recess);
 assert.deepEqual(breaks.map(s=>s.start),['16:25','18:20']);
 for(const day of schedule.days)for(const slot of breaks)assert.equal(subjectAt(day,slot),null);
 assert.equal(subjectAt(schedule.days[1],timetableSlots[3]),'BD');
});
