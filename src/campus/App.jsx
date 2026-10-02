import DragonIndicator from './components/DragonIndicator.jsx';
import './styles.css';
import { useState } from 'react';
import Sidebar from './components/Sidebar.jsx';
import ScheduleCard from './components/ScheduleCard.jsx';
import Moodle from './components/Moodle.jsx';
import Timetable from './components/Timetable.jsx';
import Exams from './components/Exams.jsx';

export default function App({onLogout, userId, logoutError}) {
  const [page, setPage] = useState('home');
  const [moodleVisit,setMoodleVisit]=useState(0);
  function navigate(next){if(next==='moodle')setMoodleVisit(n=>n+1);setPage(next);}
  return <div className="campus-shell">
    <Sidebar page={page} onNavigate={navigate} onLogout={onLogout} logoutError={logoutError} />
    <main aria-label="Pantalla principal"><Moodle key={userId} userId={userId} visible={page==='moodle'} resetKey={moodleVisit}/>{page==='horarios' && <Timetable/>}{page==='examenes' && <Exams userId={userId}/>}</main>
    <DragonIndicator key={userId} userId={userId}/>
    <ScheduleCard visible={['home','moodle','teams','yedra','examenes'].includes(page)} />
  </div>;
}
