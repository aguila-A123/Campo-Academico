import {useMemo} from 'react';

export default function Starfield(){
  const stars=useMemo(()=>Array.from({length:75},(_,id)=>({
    id,left:Math.random()*100,top:Math.random()*100,
    size:Math.random()*2.6+.7,duration:Math.random()*7+5,delay:-Math.random()*12,
  })),[]);
  return <div className="starfield" aria-hidden="true">{stars.map(star=><i key={star.id}
    className={star.id%3===0?'star gold-star':'star'}
    style={{left:`${star.left}%`,top:`${star.top}%`,width:star.size,height:star.size,animationDuration:`${star.duration}s`,animationDelay:`${star.delay}s`}}
    onAnimationIteration={e=>{e.currentTarget.style.left=`${Math.random()*100}%`;e.currentTarget.style.top=`${Math.random()*100}%`;}}/>)}</div>;
}
