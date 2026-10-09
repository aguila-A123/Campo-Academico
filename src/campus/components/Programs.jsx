import { useState } from 'react';
import './Programs.css';

function CodeIcon(){return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5-6 7 6 7m8-14 6 7-6 7m-3-16-2 18"/></svg>;}
function NetBeansIcon(){return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 9 5v10l-9 5-9-5V7Zm0 10 9-5M12 12 3 7m9 5v10"/></svg>;}

export default function Programs({visible=true}){
  const [view,setView]=useState('programs');
  const [pseintLoaded,setPseintLoaded]=useState(false);
  const [javaLoaded,setJavaLoaded]=useState(false);
  const editorOpen=['pseint','netbeans'].includes(view);
  const titles={programs:'Programas',programming:'Programación',pseint:'PSeInt',netbeans:'NetBeans'};
  return <section hidden={!visible} className={`programs${editorOpen?' pseint-open':''}`}>
    <header className="programs-heading"><div><p>CAMPUS</p><h1>{titles[view]}</h1></div>{view!=='programs'&&<button type="button" onClick={()=>setView(editorOpen?'programming':'programs')}>Volver a {editorOpen?'Programación':'Programas'}</button>}</header>
    {view==='programs'&&<button className="programs-launch" type="button" onClick={()=>setView('programming')}><CodeIcon/><span>Programación</span></button>}
    {view==='programming'&&<div className="programming-options">
      <button className="programs-launch" type="button" onClick={()=>{setPseintLoaded(true);setView('pseint');}}><CodeIcon/><span>PSeInt</span></button>
      <button className="programs-launch" type="button" onClick={()=>{setJavaLoaded(true);setView('netbeans');}}><NetBeansIcon/><span>NetBeans</span></button>
    </div>}
    {pseintLoaded&&<iframe hidden={view!=='pseint'} className="pseint-frame" title="PSeInt Web: editor, diagrama y consola" src="/pseint/index.html"/>}
    {javaLoaded&&<iframe hidden={view!=='netbeans'} className="pseint-frame" title="NetBeans: Java Noir" src="/netbeans/index.html"/>}
  </section>;
}
