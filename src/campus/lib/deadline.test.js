import test from 'node:test';
import assert from 'node:assert/strict';
import {deadlineTime,countdown} from './deadline.js';
test('Cantabria summer and winter wall times',()=>{assert.equal(deadlineTime('2026-09-23 19:30:00'),Date.parse('2026-09-23T17:30:00Z'));assert.equal(deadlineTime('2026-12-23 19:30:00'),Date.parse('2026-12-23T18:30:00Z'));});
test('explicit timezone preserved',()=>{assert.equal(deadlineTime('2026-09-23T17:30:00+00:00'),Date.parse('2026-09-23T17:30:00Z'));});
test('countdown decrements and finishes',()=>{const end=Date.parse('2026-09-23T17:30:00Z');assert.equal(countdown(end,end-90061000),'1 d · 01:01:01');assert.equal(countdown(end,end-1000),'00:00:01');assert.equal(countdown(end,end),'Finalizada');assert.equal(countdown(end,end+1000),'Finalizada');assert.equal(countdown(NaN,end),null);});
