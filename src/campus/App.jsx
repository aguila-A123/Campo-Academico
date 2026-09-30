import './styles.css';
import { useState } from 'react';
import Sidebar from './components/Sidebar.jsx';
import ScheduleCard from './components/ScheduleCard.jsx';
import Moodle from './components/Moodle.jsx';
import Timetable from './components/Timetable.jsx';
import Exams from './components/Exams.jsx';

export default function App({onLogout, userId, logoutError}) {
  const [page, setPage] = useState('home');
  return <div className="campus-shell">
    <Sidebar page={page} onNavigate={setPage} onLogout={onLogout} logoutError={logoutError} />
    <main aria-label="Pantalla principal"><Moodle key={userId} userId={userId} visible={page==='moodle'}/>{page==='horarios' && <Timetable/>}{page==='examenes' && <Exams userId={userId}/>}</main>
    <ScheduleCard visible={['home','moodle','teams','yedra','examenes'].includes(page)} />
  </div>;
}
