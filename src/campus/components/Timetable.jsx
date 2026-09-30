import schedule from '../../../public/horario.json';
import { subjectAt, timetableSlots } from '../lib/timetable.js';
import './Timetable.css';

const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
const colors = { ED: '#c8a5ff', BD: '#78b9ff', IPE1: '#f4a3c8', Prg: '#67ddd1', SI: '#f6ba73', LMSGI: '#a7b5ff', INGPR: '#f0d66f', SOS: '#9cd47d' };
const paths = {
  ED: <><path d="m14 6 4-4 4 4-4 4M10 18l-4 4-4-4 4-4M8 16l8-8"/></>,
  BD: <><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0"/></>,
  IPE1: <><rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V3h8v4M3 12c6 4 12 4 18 0M12 12v4"/></>,
  Prg: <><path d="m7 6-6 6 6 6m10-12 6 6-6 6M14 3l-4 18"/></>,
  SI: <><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 22h8M12 17v5M6 7h4M6 11h8"/></>,
  LMSGI: <><path d="M14 2H5v20h14V7ZM14 2v6h5M9 12l-2 3 2 3m6-6 2 3-2 3"/></>,
  INGPR: <><circle cx="12" cy="12" r="10"/><ellipse cx="12" cy="12" rx="4" ry="10"/><path d="M2 12h20M4 6h16M4 18h16"/></>,
  SOS: <><path d="M20 3C8 1 2 8 5 16c8 7 17-2 15-13ZM3 22 16 9M8 17v-6m0 6h6"/></>,
};
function SubjectIcon({ subject }) { return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[subject] ?? <path d="M4 4h16v16H4Z"/>}</svg>; }

export default function Timetable() {
  return <section className="timetable" aria-labelledby="timetable-title">
    <header className="timetable-heading"><div><span className="timetable-eyebrow">CAMPUS · PLANIFICACIÓN</span><h1 id="timetable-title">Horario semanal</h1><p>De lunes a viernes <span aria-hidden="true">·</span> 14:45–20:15</p></div></header>
    <>
      <div className="timetable-scroll" tabIndex={0} role="region" aria-label="Horario de lunes a viernes; desplaza horizontalmente para ver todos los días">
        <table className="timetable-table"><caption className="timetable-caption">Seis periodos de 50 minutos al día, con dos recreos de 15 minutos.</caption>
          <thead><tr><th scope="col">Hora</th>{days.map(day => <th scope="col" key={day}>{day}</th>)}</tr></thead>
          <tbody>{timetableSlots.map(slot => <tr key={slot.start} className={slot.recess ? 'timetable-recess' : ''}>
            <th scope="row"><time>{slot.start}</time><span>{slot.end}</span></th>
            {slot.recess ? <td colSpan={5}><div><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h12v7a6 6 0 0 1-12 0ZM16 8h2a3 3 0 0 1 0 6h-2M3 22h15M7 2v3M12 2v3"/></svg><strong>Receso</strong><span>15 min</span></div></td> : days.map((day, i) => {
              const code = subjectAt(schedule.days.find(d => d.weekday === i + 1), slot);
              const subject = schedule.subjects[code];
              return <td key={day}>{subject ? <div className="timetable-subject" style={{ '--subject-color': colors[code] ?? '#d4af57' }}><div className="timetable-subject-top"><SubjectIcon subject={code}/><span>{code}</span></div><strong>{subject.name}</strong></div> : <span className="timetable-free">Sin clase</span>}</td>;
            })}
          </tr>)}</tbody>
        </table>
      </div>
      <section className="timetable-legend" aria-label="Asignaturas y docentes">{Object.entries(schedule.subjects).map(([code, subject]) => <div className="timetable-legend-item" key={code} style={{ '--subject-color': colors[code] ?? '#d4af57' }}><SubjectIcon subject={code}/><div><strong>{subject.name}</strong><span>{subject.teacher}</span></div></div>)}</section>
      
    </>
  </section>;
}


