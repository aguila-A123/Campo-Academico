import schedule from '../../../public/horario.json';
import { subjectAt, timetableSlots } from '../lib/timetable.js';
import './Timetable.css';

const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
import {colors,SubjectIcon} from './SubjectStyle.jsx';

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


