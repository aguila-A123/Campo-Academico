import {test} from 'node:test';
import assert from 'node:assert/strict';
import {serviceStatus,messageStatus} from './dragonStatus.js';
const now=Date.parse('2026-10-29T12:00:00Z');
test('a Chrome window is not a heartbeat; expired or missing service stops the spinner',()=>{
 assert.equal(serviceStatus({checked:true,row:null},now),'offline');
 assert.equal(serviceStatus({checked:true,row:{updated_at:'2026-10-29T11:58:00Z',status:'online'}},now),'offline');
 assert.equal(messageStatus({estado:'pendiente'},'offline',now).waiting,false);
});
test('live, reconnecting and unknown service are distinct',()=>{
 assert.equal(serviceStatus({checked:true,row:{updated_at:'2026-10-29T11:59:50Z',status:'online'}},now),'online');
 assert.equal(serviceStatus({checked:true,row:{updated_at:'2026-10-29T11:59:50Z',status:'reconnecting'}},now),'reconnecting');
 assert.equal(serviceStatus({checked:true,error:true},now),'unknown');
 assert.equal(messageStatus({estado:'procesando'},'reconnecting',now).waiting,false);
});
test('abandoned jobs do not spin forever even if a new worker is online',()=>{
 const message={estado:'procesando',iniciado_en:'2026-10-29T11:40:00Z'};
 assert.equal(messageStatus(message,'online',now).waiting,false);
 assert.match(messageStatus(message,'online',now).text,/antes de reenviarla/);
 assert.equal(messageStatus({...message,iniciado_en:'2026-10-29T11:59:00Z'},'online',now).waiting,true);
 assert.equal(messageStatus({estado:'completado'},'offline',now).waiting,false);
});
