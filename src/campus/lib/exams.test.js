import test from 'node:test';
import assert from 'node:assert/strict';
import {examInstant,examTone} from './exams.js';
test('countdown colors at 3 days, 24 hours and deadline',()=>{const now=1000000;assert.equal(examTone(now+259200001,now),'calm');assert.equal(examTone(now+259200000,now),'soon');assert.equal(examTone(now+86400001,now),'soon');assert.equal(examTone(now+86400000,now),'urgent');assert.equal(examTone(now,now),'past');});
test('Cantabria summer and winter convert to UTC',()=>{assert.equal(examInstant('2026-09-30T15:00'),'2026-09-30T13:00:00.000Z');assert.equal(examInstant('2026-12-01T15:00'),'2026-12-01T14:00:00.000Z');});
test('nonexistent spring clock-change time is rejected',()=>{assert.throws(()=>examInstant('2027-03-28T02:30'),/no existe/);});
