import { useState } from 'react';
import './Programs.css';

function PSeIntIcon(){return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5-6 7 6 7m8-14 6 7-6 7m-3-16-2 18"/></svg>;}

export default function Programs({visible=true}){
  const [open,setOpen]=useState(false);
  return <section hidden={!visible} className={`programs${open?' pseint-open':''}`}>
    <header className="programs-heading"><div><p>CAMPUS</p><h1>{open?'PSeInt':'Programas'}</h1></div>{open&&<button type="button" onClick={()=>setOpen(false)}>Volver a Programas</button>}</header>
    {!open?<button className="programs-launch" type="button" onClick={()=>setOpen(true)}><PSeIntIcon/><span>PSeInt</span></button>:<>
      <iframe className="pseint-frame" title="PSeInt Web: editor, diagrama y consola" src="/pseint/index.html"/>
    </>}
  </section>;
}
