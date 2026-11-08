import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

const status = value => ({ available: 'Ready', on_call: 'On call', not_available: 'Unavailable' })[value] || 'Offline';
const Button = ({ label, onPress, disabled }) => <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[s.button, disabled && { opacity: .5 }]}><Text style={s.buttonText}>{label}</Text></Pressable>;
export function TechCoordination({ baseUrl, accessCode, enabled }) {
  const [open,setOpen]=useState(false),[team,setTeam]=useState(null),[notes,setNotes]=useState([]),[message,setMessage]=useState(''),[draft,setDraft]=useState(''),[busy,setBusy]=useState(false);
  const generation=useRef(0);
  const api=useCallback(async(path,body)=>{
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
    try{const result=await fetch(`${baseUrl}/api/tech-workflow${path}`,{method:body?'POST':'GET',headers:{'X-Staff-Code':accessCode,...(body?{'Content-Type':'application/json'}:{})},signal:controller.signal,...(body?{body:JSON.stringify(body)}:{})});
    const data=await result.json();if(!result.ok)throw Error(data.error||'Coordination unavailable.');return data;}finally{clearTimeout(timer);}
  },[baseUrl,accessCode]);
  const refresh=useCallback(async()=>{const version=generation.current;try{const [roster,inbox]=await Promise.all([api('/team'),api('/inbox')]);if(version!==generation.current)return;setTeam(roster);setNotes(inbox.notes||[]);setMessage('');}catch(error){if(version===generation.current)setMessage(error.message);}},[api]);
  useEffect(()=>{generation.current++;setTeam(null);setNotes([]);setOpen(false);setDraft('');setMessage('');setBusy(false);return()=>{generation.current++;};},[baseUrl,accessCode,enabled]);
  useEffect(()=>{if(!open||!enabled)return;void refresh();const timer=setInterval(()=>{if(AppState.currentState==='active')void refresh();},10000);return()=>clearInterval(timer);},[open,enabled,refresh]);
  if(!enabled)return null;
  const update=async(path,body)=>{if(busy)return;const version=generation.current;setBusy(true);try{await api(path,body);if(version!==generation.current)return;if(path==='/inbox')setDraft('');await refresh();if(version===generation.current)setMessage('Saved to the shared technician inbox.');}catch(error){if(version===generation.current)setMessage(error.message);}finally{if(version===generation.current)setBusy(false);}};
  return <View style={s.section}>
    <Pressable accessibilityRole="button" accessibilityState={{expanded:open}} onPress={()=>setOpen(v=>!v)} style={s.row}><Text style={s.title}>Team & dispatch notes</Text><Text style={s.link}>{open?'Close':'Open'}</Text></Pressable>
    {open&&<>
      <Text style={s.meta}>Internal technician coordination · not customer texts</Text>
      {!!message&&<Text accessibilityLiveRegion="polite" style={s.meta}>{message}</Text>}
      <View style={s.row}><Button label="Refresh" onPress={refresh} disabled={busy}/><Button label="Open Tech Assist" onPress={()=>Linking.openURL('dddtechassist://team').catch(()=>setMessage('Open DDD Tech Assist from your phone to use its map and job tools.'))}/></View>
      {!team&&!message&&<Text style={s.meta}>Loading team...</Text>}
      {(team?.technicians||[]).map(tech=><View style={s.roster} key={tech.id}><Text style={s.text}>{tech.name} · {status(tech.availability)}</Text>{tech.id!==team.current_tech_id&&<Button label="Ping" disabled={busy} onPress={()=>update('/inbox',{type:'tech_ping',target_tech_id:tech.id,message:'Please check DDD Dispatch or Tech Assist. A teammate needs help.'})}/>}</View>)}
      <TextInput accessibilityLabel="Internal technician note" value={draft} onChangeText={setDraft} editable={!busy} maxLength={2000} multiline placeholder="Note or request for backup" placeholderTextColor="#64748b" style={s.input}/>
      <View style={s.row}><Button label="Save note" disabled={busy||!draft.trim()} onPress={()=>update('/inbox',{message:draft,type:'dispatch_note'})}/><Button label="Ping team" disabled={busy||!draft.trim()} onPress={()=>update('/inbox',{message:draft,type:'tech_ping'})}/></View>
      {notes.slice(0,15).map(note=><View key={note.id} style={s.note}><Text style={s.text}>{note.sender_name||'Technician'}{note.job_id?` · ${note.job_id}`:''}</Text><Text style={s.text}>{note.message}</Text>{note.responses?.length>0&&<Text style={s.meta}>{note.responses.map(r=>`${r.name}: ${r.action==='accept'?'Can help':'Cannot help'}`).join(' · ')}</Text>}<View style={s.row}>{!note.read&&<Button label="Mark read" disabled={busy} onPress={()=>update(`/inbox/${encodeURIComponent(note.id)}/response`,{action:'read'})}/>} {note.type==='tech_ping'&&!note.response&&note.sender_tech_id!==team?.current_tech_id&&['accept','decline'].map(action=><Button key={action} label={action==='accept'?'Can help':'Cannot help'} disabled={busy} onPress={()=>update(`/inbox/${encodeURIComponent(note.id)}/response`,{action})}/>)}</View>{!!note.response&&<Text style={s.meta}>{note.response==='accept'?'You can help':'You cannot help'}</Text>}</View>)}
      {team&&!notes.length&&<Text style={s.meta}>No internal notes yet.</Text>}
    </>}
  </View>;
}
const s=StyleSheet.create({section:{gap:12,borderTopWidth:2,borderColor:'#46b8bb',paddingVertical:16,marginBottom:12},row:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',gap:8,justifyContent:'space-between'},roster:{flexDirection:'row',alignItems:'center',gap:10,justifyContent:'space-between',paddingVertical:6,borderBottomWidth:1,borderColor:'#bed0db'},title:{fontSize:18,fontWeight:'700',color:'#152f44',flexShrink:1},text:{color:'#203b50',fontSize:14,lineHeight:21,flexShrink:1},meta:{color:'#425c70',fontSize:13,lineHeight:20},link:{color:'#076e81',fontWeight:'700',padding:8},button:{minHeight:44,paddingHorizontal:12,paddingVertical:10,borderRadius:6,backgroundColor:'#dcecf4',justifyContent:'center'},buttonText:{color:'#10283c',fontWeight:'700'},input:{minHeight:70,borderWidth:1,borderColor:'#819baa',borderRadius:6,padding:12,color:'#142c40',backgroundColor:'#fff',fontSize:15},note:{gap:7,paddingVertical:12,borderBottomWidth:1,borderColor:'#bed0db'}});
