// @vitest-environment jsdom
import {useState} from 'react';
import {afterEach,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,act,cleanup} from '@testing-library/react';
import {EmergencyChat} from './EmergencyIndicator.jsx';
afterEach(()=>{cleanup();vi.restoreAllMocks();});
const contacts=[{id:7,remitente:'Martin',activo:false},{id:8,remitente:'Sully',activo:true}];
function Harness({send=async()=>true,remove=async()=>false}){
 const [selectedChat,setSelectedChat]=useState(null);
 const chat={selectedChat,setSelectedChat,prefs:{valor:100},messages:[],loading:false,
  fixedChats:contacts,activeChats:[],alertIds:new Set(),acknowledgeChat:()=>{},
  setPrefs:()=>{},closeChat:async()=>true,deleteChat:remove,send,sending:false};
 return <EmergencyChat chat={chat} onClose={()=>{}}/>;
}
it('keeps drafts per conversation when an old send completes after switching',async()=>{
 let finish;const pending=new Promise(resolve=>{finish=resolve;});
 render(<Harness send={()=>pending}/>);
 fireEvent.click(screen.getByRole('button',{name:/Martin/}));
 fireEvent.change(screen.getByPlaceholderText('Escribe un mensaje...'),{target:{value:'mensaje A'}});
 fireEvent.click(screen.getByRole('button',{name:'Enviar'}));
 fireEvent.click(screen.getByRole('button',{name:'Volver a chats'}));
 fireEvent.click(screen.getByRole('button',{name:/Sully/}));
 expect(screen.getByPlaceholderText('Escribe un mensaje...').value).toBe('');
 fireEvent.change(screen.getByPlaceholderText('Escribe un mensaje...'),{target:{value:'borrador B'}});
 await act(async()=>{finish(true);await pending;});
 expect(screen.getByPlaceholderText('Escribe un mensaje...').value).toBe('borrador B');
 fireEvent.click(screen.getByRole('button',{name:'Volver a chats'}));
 fireEvent.click(screen.getByRole('button',{name:/Martin/}));
 expect(screen.getByPlaceholderText('Escribe un mensaje...').value).toBe('');
});
it('keeps the chat open when deletion fails instead of navigating away',async()=>{
 vi.spyOn(window,'confirm').mockReturnValue(true);
 render(<Harness/>);
 fireEvent.click(screen.getByRole('button',{name:/Martin/}));
 await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Borrar chat'}));});
 expect(screen.getByRole('button',{name:'Volver a chats'})).toBeTruthy();
 expect(screen.getByRole('heading',{name:/Martin/})).toBeTruthy();
});
