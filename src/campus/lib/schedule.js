export /* Weekly wall-clock schedule, evaluated in Cantabria's timezone including DST. */
function getClassState(schedule, now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: schedule.timezone, weekday:'short', hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23'
  }).formatToParts(now).map(p => [p.type,p.value]));
  const day = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].indexOf(parts.weekday)+1;
  const seconds = Number(parts.hour)*3600+Number(parts.minute)*60+Number(parts.second);
  const at = time => { const [h,m]=time.split(':').map(Number); return h*3600+m*60; };
  const today = schedule.days.find(d=>d.weekday===day)?.blocks || [];
  const active = today.find(b=>seconds>=at(b.start)&&seconds<at(b.end));
  let next;
  for(let offset=0; offset<=7 && !next; offset++) {
    const weekday=(day-1+offset)%7+1;
    const block=(schedule.days.find(d=>d.weekday===weekday)?.blocks || []).find(b=>offset>0 || at(b.start)>seconds);
    if(block) next={...block,weekday,daysAway:offset,secondsUntil:offset*86400+at(block.start)-seconds};
  }
  return {active,next,remaining:active?at(active.end)-seconds:next?.secondsUntil,
    progress:active?(seconds-at(active.start))/(at(active.end)-at(active.start)):0};
}

