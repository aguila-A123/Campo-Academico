import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {getClassState} from './schedule.js';
const schedule=JSON.parse(readFileSync(new URL('../../../public/horario.json',import.meta.url)));
test('Monday demo and next class',()=>{const s=getClassState(schedule,new Date('2026-09-28T15:00:00+02:00'));assert.equal(s.active.subject,'ED');assert.equal(s.remaining,5100);assert.equal(s.next.subject,'BD');assert.equal(s.next.teachingPeriods,2);});
test('Merged class spans internal break',()=>{const s=getClassState(schedule,new Date('2026-09-29T16:30:00+02:00'));assert.equal(s.active.subject,'BD');assert.equal(s.active.end,'17:30');});
test('Break between subjects waits for next class',()=>{const s=getClassState(schedule,new Date('2026-09-28T16:30:00+02:00'));assert.equal(s.active,undefined);assert.equal(s.next.subject,'BD');assert.equal(s.remaining,600);});
test('End of week rolls forward to Monday',()=>{const s=getClassState(schedule,new Date('2026-10-02T20:15:00+02:00'));assert.equal(s.active,undefined);assert.equal(s.next.weekday,1);});
test('Cantabria winter timezone',()=>{const s=getClassState(schedule,new Date('2026-12-07T13:45:00Z'));assert.equal(s.active.subject,'ED');assert.equal(s.progress,0);});

