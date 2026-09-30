import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {getClassState} from './schedule.js';
const schedule=JSON.parse(readFileSync(new URL('../../../public/horario.json',import.meta.url)));
const state=(time,date='2026-09-28')=>getClassState(schedule,new Date(`${date}T${time}+02:00`));

test('Monday class and next subject',()=>{const s=state('15:00:00');assert.equal(s.active.subject,'ED');assert.equal(s.remaining,5100);assert.equal(s.next.subject,'BD');assert.equal(s.next.teachingPeriods,2);assert.equal(s.showNext,true);});
test('Both recesses override merged subjects every weekday',()=>{
 for(const date of ['2026-09-28','2026-09-29','2026-09-30','2026-10-01','2026-10-02']) {
  for(const [start,end] of [['16:25:00','16:40:00'],['18:20:00','18:35:00']]) {
   const s=state(start,date);assert.equal(s.active,undefined);assert.ok(s.recess);assert.equal(s.remaining,900);assert.equal(s.progress,0);assert.equal(s.showNext,true);
   const resumed=state(end,date);assert.ok(resumed.active);assert.equal(resumed.recess,undefined);assert.equal(resumed.progress,0);
  }
 }
});
test('Recess within a merged class resumes same subject',()=>{const s=state('16:30:00','2026-09-29');assert.equal(s.active,undefined);assert.equal(s.next.subject,'BD');assert.equal(s.next.start,'16:40');assert.equal(s.remaining,600);assert.equal(s.progress,1/3);});
test('Recess between subjects',()=>{const s=state('16:30:00');assert.equal(s.next.subject,'BD');assert.equal(s.remaining,600);assert.ok(s.recess);});
test('Waiting hides next until exactly twenty minutes before first class',()=>{
 assert.equal(state('14:24:59').showNext,false);
 assert.equal(state('14:25:00').showNext,true);
 assert.equal(state('14:25:00').remaining,1200);
 assert.equal(state('00:01:00').showNext,false);
});
test('End of day and weekends never display next',()=>{
 for(const date of ['2026-09-28','2026-10-02','2026-10-03','2026-10-04']){
  const s=state('20:15:00',date);assert.equal(s.active,undefined);assert.equal(s.recess,undefined);assert.equal(s.showNext,false);
 }
 assert.equal(state('16:30:00','2026-10-03').recess,undefined);
 assert.equal(state('20:14:59').active.subject,'IPE1');
});
test('Cantabria winter timezone',()=>{const s=getClassState(schedule,new Date('2026-12-07T13:45:00Z'));assert.equal(s.active.subject,'ED');assert.equal(s.progress,0);});

test('Overnight countdown points to next class, without revealing next label early',()=>{
 const s=state('20:15:00');assert.equal(s.remaining,18.5*3600);assert.equal(s.next.subject,'BD');assert.equal(s.showNext,false);
});
test('Weekend countdown includes the winter DST change',()=>{
 const s=getClassState(schedule,new Date('2026-10-23T20:15:00+02:00'));
 assert.equal(s.remaining,67.5*3600);assert.equal(s.next.weekday,1);assert.equal(s.showNext,false);
});
