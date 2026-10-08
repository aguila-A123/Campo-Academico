import {useMemo,useEffect} from 'react';
import {ReactFlow,Background,Controls,Handle,Position,useReactFlow,ReactFlowProvider,MarkerType} from '@xyflow/react';
import dagre from '@dagrejs/dagre';
import {formatOperators} from './formatOperators.js';
import '@xyflow/react/dist/style.css';
function Statement({data}) {
  const {kind,label,line}=data; const decision=kind==='decision', terminal=kind==='terminal', io=kind==='io';
  const w=decision?260:240,h=decision?112:76;
  return <div className={`statement ${kind}`} style={{width:w,height:h}}>
    <Handle type="target" position={Position.Top}/><Handle type="source" position={Position.Bottom}/>
    <Handle type="source" position={Position.Left} id="back-out"/><Handle type="target" position={Position.Right} id="back-in"/>
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      {decision?<polygon points={`130,2 258,56 130,110 2,56`}/>:io?<polygon points="25,2 238,2 215,74 2,74"/>:<rect x="2" y="2" width={w-4} height={h-4} rx={terminal?36:8}/>}
      {kind==='call'&&<><path d="M 12,2 V 74"/><path d="M 228,2 V 74"/></>}
    </svg>
    <span className="statement-label" title={label}>{formatOperators(label)}</span><span className="statement-line">{line}</span>
  </div>;
}
const nodeTypes={statement:Statement};
function Canvas({diagram,onLine}) {
  const flow=useReactFlow();
  const graph=useMemo(()=>{
    if(!diagram)return {nodes:[],edges:[]};
    const g=new dagre.graphlib.Graph();g.setGraph({rankdir:'TB',ranksep:65,nodesep:70,marginx:30,marginy:30});g.setDefaultEdgeLabel(()=>({}));
    diagram.nodes.forEach(n=>g.setNode(n.id,{width:n.data.kind==='decision'?260:240,height:n.data.kind==='decision'?112:76}));
    diagram.edges.filter(e=>!e.data.back).forEach(e=>g.setEdge(e.source,e.target));dagre.layout(g);
    return {nodes:diagram.nodes.map(n=>{const p=g.node(n.id);return {...n,position:{x:p.x-p.width/2,y:p.y-p.height/2},draggable:false};}),edges:diagram.edges.map(e=>({...e,type:'smoothstep',sourceHandle:e.data.back?'back-out':undefined,targetHandle:e.data.back?'back-in':undefined,markerEnd:{type:MarkerType.ArrowClosed,width:16,height:16,color:e.data.back?'#a7adb5':'#baa472'},style:{stroke:e.data.back?'#a7adb5':'#baa472',strokeWidth:1.5},labelStyle:{fill:'#d5c7a6',fontSize:13},labelBgStyle:{fill:'#0c0c0e',fillOpacity:1},labelBgPadding:[7,4]}))};
  },[diagram]);
  useEffect(()=>{const timer=setTimeout(()=>flow.fitView({padding:.2,maxZoom:1,duration:180}),50);return()=>clearTimeout(timer);},[graph,flow]);
  return <ReactFlow nodes={graph.nodes} edges={graph.edges} nodeTypes={nodeTypes} fitView minZoom={.12} maxZoom={2} nodesConnectable={false} elementsSelectable={false} onNodeClick={(_,n)=>onLine(n.data.line)} colorMode="dark" proOptions={{hideAttribution:false}}><Background gap={22} size={1} color="#29261e"/><Controls showInteractive={false}/></ReactFlow>;
}
export default function Diagram(props){return <ReactFlowProvider><Canvas {...props}/></ReactFlowProvider>;}
