export class TerminalProtocol {
  buffer='';
  constructor(send){this.send=send;}
  push(text){
    this.buffer+=text;
    while(this.buffer.length){
      const start=this.buffer.indexOf('\x1b[z');
      if(start<0){let cut=this.buffer.length; if(this.buffer.endsWith('\x1b['))cut-=2;else if(this.buffer.endsWith('\x1b'))cut--;if(cut){this.send({type:'output',text:this.buffer.slice(0,cut)});this.buffer=this.buffer.slice(cut);}break;}
      if(start){this.send({type:'output',text:this.buffer.slice(0,start)});this.buffer=this.buffer.slice(start);}
      if(this.buffer.length<4)break;
      const command=this.buffer[3];
      if(command==='l'||command==='k'){this.send({type:'input',mode:command==='l'?'line':'key'});this.buffer=this.buffer.slice(4);}
      else if(command==='t'){const end=this.buffer.indexOf('\n');if(end<0)break;this.buffer=this.buffer.slice(end+1);}
      else if(command==='p'||command==='e'){const end=this.buffer.indexOf(';');if(end<0)break;const [line]=this.buffer.slice(4,end).split(':').map(Number);this.send({type:command==='p'?'position':'error-position',line});this.buffer=this.buffer.slice(end+1);}
      else {this.buffer=this.buffer.slice(4);}
    }
  }
  flush(){if(this.buffer){this.send({type:'output',text:this.buffer});this.buffer='';}}
}
