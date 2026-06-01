import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "./supabase.js";

const DEFAULT_STATUSES = ["Нов","В преговори","Активна","На изчакване","Отказана","Завършена"];
const ARCHIVE_STATUSES = ["Отказана","Завършена"];
const PRIORITIES = ["Висок","Среден","Нисък"];
const COLLAB_TYPES = ["Афилиейт","Спонсорство","Бартер","Платена реклама","Амбасадор","Съдържание","Друго"];
const TEAM = ["Дери","Миша","Вени","Криси"];
const INV_STATUSES = ["Изчакваща","Изпратена","Платена","Просрочена"];
const DEF_ST_COLORS = {"Нов":"#6366f1","В преговори":"#eab308","Активна":"#22c55e","На изчакване":"#f59e0b","Отказана":"#ef4444","Завършена":"#94a3b8"};
const INV_ST_C = {"Изчакваща":{bg:"#f1f5f9",text:"#475569",dot:"#94a3b8"},"Изпратена":{bg:"#fef9c3",text:"#854d0e",dot:"#eab308"},"Платена":{bg:"#dcfce7",text:"#166534",dot:"#22c55e"},"Просрочена":{bg:"#fee2e2",text:"#991b1b",dot:"#ef4444"}};
const PC = {"Висок":"#ef4444","Среден":"#f59e0b","Нисък":"#94a3b8"};
const AVC = ["#02a576","#00383f","#0891b2","#7c3aed","#db2777","#ea580c"];
const CC = ["#02a576","#00383f","#0891b2","#f59e0b","#ef4444","#94a3b8","#7c3aed","#db2777"];

const toRow = i => ({
  id:i.id, brand:i.brand, category:i.category||"", contact:i.contact||"", phone:i.phone||"",
  email:i.email||"", contact_birthday:i.contactBirthday||"", contact_notes:i.contactNotes||"",
  they_offer:i.theyOffer||"", we_offer:i.weOffer||"", collab_type:i.collabType||"",
  status:i.status||"Нов", priority:i.priority||"Среден", value:Number(i.value)||0,
  deadline:i.deadline||"", assignee:i.assignee||"", notes:i.notes||"",
  links:i.links||"", tags:i.tags||"", next_step:i.nextStep||"",
  next_step_date:i.nextStepDate||"", rating:Number(i.rating)||0,
  file_name:i.fileName||null, file_data:i.fileData||null, archived:!!i.archived,
  history:i.history||[], comments:i.comments||[], invoices:i.invoices||[],
  date_added:i.dateAdded||new Date().toISOString().slice(0,10),
});

const fromRow = r => ({
  id:r.id, brand:r.brand, category:r.category, contact:r.contact, phone:r.phone,
  email:r.email, contactBirthday:r.contact_birthday, contactNotes:r.contact_notes,
  theyOffer:r.they_offer, weOffer:r.we_offer, collabType:r.collab_type,
  status:r.status, priority:r.priority, value:r.value, deadline:r.deadline,
  assignee:r.assignee, notes:r.notes, links:r.links, tags:r.tags,
  nextStep:r.next_step, nextStepDate:r.next_step_date, rating:r.rating,
  fileName:r.file_name, fileData:r.file_data, archived:r.archived,
  history:r.history||[], comments:r.comments||[], invoices:r.invoices||[],
  dateAdded:r.date_added,
});

const EMPTY = {brand:"",category:"",contact:"",phone:"",email:"",contactBirthday:"",contactNotes:"",theyOffer:"",weOffer:"",collabType:"",status:"Нов",priority:"Среден",value:"",deadline:"",assignee:"",notes:"",links:"",tags:"",nextStep:"",nextStepDate:"",rating:0,fileName:null,fileData:null,archived:false};
const EMPTY_INV = {number:"",amount:"",issueDate:"",dueDate:"",status:"Изпратена",notes:"",paidDate:""};
const IS = {width:"100%",padding:"8px 11px",borderRadius:8,border:"1.5px solid #d1fae5",fontSize:13,color:"#00383f",background:"#f8fffe",outline:"none",fontFamily:"inherit",boxSizing:"border-box"};

function dl(iso){if(!iso) return null; return Math.ceil((new Date(iso)-new Date())/86400000);}
function fmt(iso){if(!iso) return "—"; return new Date(iso).toLocaleDateString("bg-BG");}
function nowStr(){return new Date().toLocaleString("bg-BG");}
function getMonth(iso){if(!iso) return null; const d=new Date(iso); return d.toLocaleDateString("bg-BG",{month:"long",year:"numeric"});}
function getQuarter(iso){if(!iso) return null; const d=new Date(iso); return `Q${Math.ceil((d.getMonth()+1)/3)} ${d.getFullYear()}`;}

function Av({name,size=32}){const bg=AVC[(name||"?").charCodeAt(0)%AVC.length]; return <div style={{width:size,height:size,borderRadius:"50%",background:bg,color:"#fff",fontWeight:700,fontSize:size*.36,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{(name||"?").slice(0,2).toUpperCase()}</div>;}
function Badge({status,color}){const dot=color||DEF_ST_COLORS[status]||"#94a3b8"; return <span style={{background:dot+"22",color:dot,borderRadius:20,padding:"3px 9px",fontSize:11,fontWeight:600,display:"inline-flex",alignItems:"center",gap:4,whiteSpace:"nowrap"}}><span style={{width:6,height:6,borderRadius:"50%",background:dot,flexShrink:0}}/>{status}</span>;}
function InvBadge({status}){const c=INV_ST_C[status]||INV_ST_C["Изчакваща"]; return <span style={{background:c.bg,color:c.text,borderRadius:20,padding:"2px 8px",fontSize:11,fontWeight:600,display:"inline-flex",alignItems:"center",gap:4,whiteSpace:"nowrap"}}><span style={{width:5,height:5,borderRadius:"50%",background:c.dot,flexShrink:0}}/>{status}</span>;}
function Stars({value,onChange}){return <div style={{display:"flex",gap:3}}>{[1,2,3,4,5].map(n=><span key={n} onClick={()=>onChange&&onChange(n)} style={{fontSize:18,cursor:onChange?"pointer":"default",color:n<=value?"#f59e0b":"#d1d5db",userSelect:"none"}}>★</span>)}</div>;}
function Modal({onClose,children,wide}){useEffect(()=>{const h=e=>e.key==="Escape"&&onClose(); window.addEventListener("keydown",h); return()=>window.removeEventListener("keydown",h);},[onClose]); return <div style={{position:"fixed",inset:0,background:"rgba(0,56,63,.45)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16,backdropFilter:"blur(4px)"}} onClick={onClose}><div onClick={e=>e.stopPropagation()} style={{background:"#fff",borderRadius:16,maxWidth:wide?900:660,width:"100%",maxHeight:"93vh",overflowY:"auto",boxShadow:"0 24px 60px rgba(0,56,63,.25)"}}>{children}</div></div>;}
function FF({label,children}){return <div style={{marginBottom:12}}><label style={{display:"block",fontSize:10,fontWeight:700,color:"#02a576",textTransform:"uppercase",letterSpacing:".07em",marginBottom:4}}>{label}</label>{children}</div>;}
function Toast({msg,onDone}){useEffect(()=>{const t=setTimeout(onDone,2800); return()=>clearTimeout(t);},[onDone]); return <div style={{position:"fixed",bottom:24,right:24,background:"#00383f",color:"#fff",padding:"12px 20px",borderRadius:12,fontSize:13,fontWeight:600,zIndex:2000,boxShadow:"0 8px 28px rgba(0,56,63,.35)"}}>{msg}</div>;}
function CommentText({text}){const parts=text.split(/(@\w[\wА-Яа-я]*)/g); return <span>{parts.map((p,i)=>p.startsWith("@")?<span key={i} style={{background:"#e6f7f2",color:"#00383f",borderRadius:4,padding:"0 4px",fontWeight:700,fontSize:13}}>{p}</span>:<span key={i} style={{fontSize:13,color:"#334155"}}>{p}</span>)}</span>;}

function MentionInput({value,onChange,placeholder}){
  const [show,setShow]=useState(false); const [q,setQ]=useState(""); const ref=useRef();
  const handleChange=e=>{const v=e.target.value; onChange(v); const cursor=e.target.selectionStart; const before=v.slice(0,cursor); const match=before.match(/@(\w*)$/); if(match){setQ(match[1]);setShow(true);}else setShow(false);};
  const pick=name=>{const cursor=ref.current.selectionStart; const before=value.slice(0,cursor); const after=value.slice(cursor); const replaced=before.replace(/@\w*$/,"@"+name+" "); onChange(replaced+after); setShow(false); setTimeout(()=>{ref.current.focus(); ref.current.setSelectionRange(replaced.length,replaced.length);},0);};
  return <div style={{position:"relative",flex:1}}><textarea ref={ref} style={{...IS,resize:"none",height:54,width:"100%"}} placeholder={placeholder} value={value} onChange={handleChange} onKeyDown={e=>e.key==="Escape"&&setShow(false)}/>{show&&TEAM.filter(m=>m.toLowerCase().startsWith(q.toLowerCase())).length>0&&<div style={{position:"absolute",bottom:"100%",left:0,background:"#fff",border:"1.5px solid #d1fae5",borderRadius:8,boxShadow:"0 4px 16px rgba(0,56,63,.15)",zIndex:100,overflow:"hidden",marginBottom:4}}>{TEAM.filter(m=>m.toLowerCase().startsWith(q.toLowerCase())).map(m=><div key={m} onClick={()=>pick(m)} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",cursor:"pointer",fontSize:13,color:"#00383f"}} onMouseEnter={e=>e.currentTarget.style.background="#e6f7f2"} onMouseLeave={e=>e.currentTarget.style.background=""}><Av name={m} size={22}/>{m}</div>)}</div>}</div>;
}

function Donut({data}){const total=data.reduce((s,d)=>s+d.v,0)||1; let angle=0; const cx=65,cy=65,r=50,ri=30,r2d=Math.PI/180; const slices=data.map((d,i)=>{const sw=(d.v/total)*360,a1=angle,a2=angle+sw; angle+=sw; const x1=cx+r*Math.cos((a1-90)*r2d),y1=cy+r*Math.sin((a1-90)*r2d),x2=cx+r*Math.cos((a2-90)*r2d),y2=cy+r*Math.sin((a2-90)*r2d),x3=cx+ri*Math.cos((a2-90)*r2d),y3=cy+ri*Math.sin((a2-90)*r2d),x4=cx+ri*Math.cos((a1-90)*r2d),y4=cy+ri*Math.sin((a1-90)*r2d); return {path:`M${x1},${y1} A${r},${r} 0 ${sw>180?1:0} 1 ${x2},${y2} L${x3},${y3} A${ri},${ri} 0 ${sw>180?1:0} 0 ${x4},${y4} Z`,color:d.color||CC[i%CC.length],label:d.n,value:d.v};}); return <div style={{display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}><svg width={130} height={130} style={{flexShrink:0}}>{slices.map((s,i)=><path key={i} d={s.path} fill={s.color}/>)}<text x={cx} y={cy+5} textAnchor="middle" fontSize={17} fontWeight="800" fill="#00383f">{total}</text></svg><div style={{display:"flex",flexDirection:"column",gap:5}}>{slices.map((s,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:6,fontSize:11}}><span style={{width:8,height:8,borderRadius:"50%",background:s.color,flexShrink:0}}/><span style={{color:"#475569",maxWidth:110,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.label}</span><span style={{fontWeight:700,color:"#00383f",marginLeft:"auto"}}>{s.value}</span></div>)}</div></div>;}
function MiniBar({data}){const max=Math.max(...data.map(d=>d.v),1),H=90,pad=6,bw=Math.max(10,(240-data.length*pad)/data.length); return <svg width="100%" viewBox={`0 0 ${Math.max(200,data.length*(bw+pad)+pad)} ${H+24}`} style={{overflow:"visible"}}>{data.map((d,i)=>{const bh=Math.max(4,(d.v/max)*(H-8)),x=pad+i*(bw+pad); return <g key={i}><rect x={x} y={H-bh} width={bw} height={bh} rx={4} fill={CC[i%CC.length]} opacity={.9}/>{d.v>0&&<text x={x+bw/2} y={H-bh-4} textAnchor="middle" fontSize={9} fill="#00383f" fontWeight="700">{d.v}</text>}<text x={x+bw/2} y={H+15} textAnchor="middle" fontSize={8} fill="#64748b">{d.n.length>8?d.n.slice(0,7)+"…":d.n}</text></g>;})}</svg>;}
function Funnel({items}){return <div style={{display:"flex",flexDirection:"column",gap:6}}>{[["Нов","🆕"],["В преговори","🔄"],["Активна","✅"],["Завършена","🏁"]].map(([s,ic])=>{const n=items.filter(i=>i.status===s).length,pct=items.length?Math.round(n/items.length*100):0; return <div key={s}><div style={{display:"flex",justifyContent:"space-between",marginBottom:3,fontSize:12}}><span style={{color:"#00383f",fontWeight:600}}>{ic} {s}</span><span style={{color:"#02a576",fontWeight:700}}>{n} ({pct}%)</span></div><div style={{height:8,background:"#e6f7f2",borderRadius:6,overflow:"hidden"}}><div style={{width:`${pct}%`,height:"100%",background:"#02a576",borderRadius:6}}/></div></div>; })}</div>;}

function StatusSettings({statuses,onSave,onClose}){
  const [list,setList]=useState(statuses.map(s=>({...s})));
  return <div style={{padding:24}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18}}><h3 style={{margin:0,fontSize:17,fontWeight:800,color:"#00383f"}}>⚙️ Персонализирани статуси</h3><button onClick={onClose} style={{background:"none",border:"none",fontSize:20,cursor:"pointer",color:"#64748b"}}>×</button></div>
    {list.map((s,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
      <input type="color" value={s.color} onChange={e=>setList(p=>p.map((x,j)=>j===i?{...x,color:e.target.value}:x))} style={{width:32,height:32,border:"1.5px solid #d1fae5",borderRadius:6,cursor:"pointer",padding:2}}/>
      <input style={{...IS,flex:1}} value={s.name} onChange={e=>setList(p=>p.map((x,j)=>j===i?{...x,name:e.target.value}:x))}/>
      <label style={{display:"flex",alignItems:"center",gap:5,fontSize:12,color:"#64748b",whiteSpace:"nowrap"}}><input type="checkbox" checked={!!s.isArchive} onChange={e=>setList(p=>p.map((x,j)=>j===i?{...x,isArchive:e.target.checked}:x))}/> Архивира</label>
      <button onClick={()=>setList(p=>p.filter((_,j)=>j!==i))} style={{background:"none",border:"none",color:"#ef4444",cursor:"pointer",fontSize:16,flexShrink:0}}>🗑️</button>
    </div>)}
    <button onClick={()=>setList(p=>[...p,{name:"Нов статус",color:"#6366f1",isArchive:false}])} style={{padding:"7px 14px",borderRadius:8,border:"1.5px dashed #02a576",background:"#f8fffe",color:"#02a576",cursor:"pointer",fontSize:12,fontFamily:"inherit",marginBottom:16}}>+ Добави статус</button>
    <div style={{display:"flex",gap:9,justifyContent:"flex-end"}}>
      <button onClick={onClose} style={{padding:"8px 18px",borderRadius:8,border:"1.5px solid #d1fae5",background:"#fff",cursor:"pointer",fontSize:13,fontFamily:"inherit",color:"#64748b"}}>Отказ</button>
      <button onClick={()=>onSave(list)} style={{padding:"8px 22px",borderRadius:8,border:"none",background:"#02a576",color:"#fff",cursor:"pointer",fontSize:13,fontWeight:700,fontFamily:"inherit"}}>💾 Запази</button>
    </div>
  </div>;
}

function InvoiceTab({item,onUpdate,notify}){
  const [showForm,setShowForm]=useState(false); const [editInv,setEditInv]=useState(null); const [f,setF]=useState(EMPTY_INV);
  const invoices=item.invoices||[]; const total=invoices.reduce((s,i)=>s+(Number(i.amount)||0),0); const paid=invoices.filter(i=>i.status==="Платена").reduce((s,i)=>s+(Number(i.amount)||0),0);
  const save=()=>{if(!f.number||!f.amount) return; const next=editInv?invoices.map(i=>i.id===editInv?{...f,id:editInv}:i):[...invoices,{...f,id:"inv"+Date.now()}]; onUpdate(next);setShowForm(false);notify("💶 Фактурата е запазена");};
  return <div>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
      <div style={{display:"flex",gap:14}}>{[["Общо",total,"#00383f"],["Платено",paid,"#22c55e"],["Чакащо",total-paid,"#f59e0b"]].map(([l,v,c])=><div key={l}><div style={{fontSize:10,fontWeight:700,color:"#02a576",textTransform:"uppercase",letterSpacing:".07em"}}>{l}</div><div style={{fontSize:18,fontWeight:800,color:c}}>€{v}</div></div>)}</div>
      <button onClick={()=>{setF({...EMPTY_INV,number:`INV-${Date.now().toString().slice(-5)}`});setEditInv(null);setShowForm(true);}} style={{padding:"7px 14px",borderRadius:8,border:"none",background:"#02a576",color:"#fff",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"inherit"}}>+ Фактура</button>
    </div>
    {!invoices.length&&<div style={{color:"#94a3b8",fontSize:13,textAlign:"center",padding:"20px 0"}}>Няма фактури</div>}
    {invoices.map(inv=>{const overdue=inv.status!=="Платена"&&inv.dueDate&&dl(inv.dueDate)<0; return <div key={inv.id} style={{background:"#f8fffe",borderRadius:9,padding:"11px 13px",marginBottom:8,border:`1.5px solid ${overdue?"#fca5a5":"#d1fae5"}`}}>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:6}}><div><span style={{fontSize:13,fontWeight:700,color:"#00383f"}}>{inv.number}</span>{inv.notes&&<span style={{fontSize:11,color:"#64748b",marginLeft:8}}>{inv.notes}</span>}</div>
      <div style={{display:"flex",gap:6,alignItems:"center"}}><InvBadge status={overdue?"Просрочена":inv.status}/><button onClick={()=>{setF({...inv});setEditInv(inv.id);setShowForm(true);}} style={{background:"none",border:"none",cursor:"pointer",fontSize:13,padding:"0 2px"}}>✏️</button><button onClick={()=>onUpdate(invoices.filter(i=>i.id!==inv.id))} style={{background:"none",border:"none",cursor:"pointer",fontSize:13,color:"#ef4444",padding:"0 2px"}}>🗑️</button></div></div>
      <div style={{display:"flex",gap:20,flexWrap:"wrap"}}>
        <div><div style={{fontSize:9,fontWeight:700,color:"#02a576",textTransform:"uppercase",letterSpacing:".07em"}}>Сума</div><div style={{fontSize:15,fontWeight:800,color:"#00383f"}}>€{inv.amount}</div></div>
        <div><div style={{fontSize:9,fontWeight:700,color:"#02a576",textTransform:"uppercase",letterSpacing:".07em"}}>Издадена</div><div style={{fontSize:12,color:"#00383f"}}>{fmt(inv.issueDate)}</div></div>
        <div><div style={{fontSize:9,fontWeight:700,color:"#02a576",textTransform:"uppercase",letterSpacing:".07em"}}>Падеж</div><div style={{fontSize:12,color:overdue?"#ef4444":"#00383f",fontWeight:overdue?700:400}}>{fmt(inv.dueDate)}{overdue?" ⚠️":""}</div></div>
        {inv.status==="Платена"&&inv.paidDate&&<div><div style={{fontSize:9,fontWeight:700,color:"#02a576",textTransform:"uppercase",letterSpacing:".07em"}}>Платена на</div><div style={{fontSize:12,color:"#22c55e",fontWeight:600}}>{fmt(inv.paidDate)}</div></div>}
      </div>
    </div>;})}
    {showForm&&<div style={{background:"#f0fdf9",borderRadius:10,padding:14,border:"1.5px solid #d1fae5",marginTop:12}}>
      <div style={{fontSize:13,fontWeight:700,color:"#00383f",marginBottom:12}}>{editInv?"✏️ Редактирай":"➕ Нова фактура"}</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px"}}>
        <FF label="Номер"><input style={IS} value={f.number} onChange={e=>setF(p=>({...p,number:e.target.value}))} placeholder="INV-2026-001"/></FF>
        <FF label="Сума (€)"><input style={IS} type="number" value={f.amount} onChange={e=>setF(p=>({...p,amount:e.target.value}))} placeholder="0"/></FF>
        <FF label="Издадена на"><input style={IS} type="date" value={f.issueDate} onChange={e=>setF(p=>({...p,issueDate:e.target.value}))}/></FF>
        <FF label="Падеж"><input style={IS} type="date" value={f.dueDate} onChange={e=>setF(p=>({...p,dueDate:e.target.value}))}/></FF>
        <FF label="Статус"><select style={IS} value={f.status} onChange={e=>setF(p=>({...p,status:e.target.value}))}>{INV_STATUSES.map(s=><option key={s}>{s}</option>)}</select></FF>
        <FF label="Платена на"><input style={IS} type="date" value={f.paidDate} onChange={e=>setF(p=>({...p,paidDate:e.target.value}))}/></FF>
      </div>
      <FF label="Бележки"><input style={IS} value={f.notes} onChange={e=>setF(p=>({...p,notes:e.target.value}))} placeholder="Описание..."/></FF>
      <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:4}}>
        <button onClick={()=>setShowForm(false)} style={{padding:"7px 14px",borderRadius:8,border:"1.5px solid #d1fae5",background:"#fff",cursor:"pointer",fontSize:12,fontFamily:"inherit",color:"#64748b"}}>Отказ</button>
        <button onClick={save} style={{padding:"7px 16px",borderRadius:8,border:"none",background:"#02a576",color:"#fff",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"inherit"}}>💾 Запази</button>
      </div>
    </div>}
  </div>;
}

function ActivityFeed({items}){
  const events=useMemo(()=>{
    const all=[];
    items.forEach(item=>{
      (item.history||[]).forEach(h=>all.push({at:h.at,icon:"📝",text:`${h.user||"Екипът"} ${h.action}`,brand:item.brand,type:"history"}));
      (item.comments||[]).forEach(c=>all.push({at:c.at,icon:"💬",text:`${c.author} коментира${c.mentions?.length?` и спомена ${c.mentions.join(", ")}`:""}: "${c.text.slice(0,60)}${c.text.length>60?"…":""}"`,brand:item.brand,type:"comment",mentions:c.mentions||[]}));
      (item.invoices||[]).forEach(inv=>{if(inv.status==="Платена"&&inv.paidDate) all.push({at:inv.paidDate,icon:"💶",text:`Фактура ${inv.number} — платена €${inv.amount}`,brand:item.brand,type:"invoice"});});
    });
    all.sort((a,b)=>{try{return new Date(b.at.split(".").reverse().join("-"))-new Date(a.at.split(".").reverse().join("-"));}catch{return 0;}});
    return all.slice(0,80);
  },[items]);
  const typeColors={history:"#e6f7f2",comment:"#eff6ff",invoice:"#fef9c3"};
  if(!events.length) return <div style={{color:"#94a3b8",fontSize:13,textAlign:"center",padding:32}}>Няма активност</div>;
  return <div>{events.map((ev,i)=><div key={i} style={{display:"flex",gap:12,padding:"11px 16px",borderBottom:"1px solid #f0fdf9",alignItems:"flex-start"}} onMouseEnter={e=>e.currentTarget.style.background="#f8fffe"} onMouseLeave={e=>e.currentTarget.style.background=""}><div style={{width:30,height:30,borderRadius:"50%",background:typeColors[ev.type]||"#e6f7f2",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0}}>{ev.icon}</div><div style={{flex:1,minWidth:0}}><div style={{fontSize:13,color:"#0f172a",lineHeight:1.4}}><CommentText text={ev.text}/></div><div style={{fontSize:11,color:"#02a576",fontWeight:600,marginTop:2}}>{ev.brand}</div></div><div style={{fontSize:10,color:"#94a3b8",whiteSpace:"nowrap",flexShrink:0}}>{ev.at}</div></div>)}</div>;
}

function MonthlySummary({items}){
  const months=useMemo(()=>{const map={}; items.forEach(item=>{const m=getMonth(item.dateAdded); if(!m) return; if(!map[m]) map[m]={month:m,dateKey:item.dateAdded,new:0,activated:0,invoiced:0,paid:0,negotiations:0}; map[m].new++; if(item.status==="Активна") map[m].activated++; if(item.status==="В преговори") map[m].negotiations++; (item.invoices||[]).forEach(inv=>{map[m].invoiced+=(Number(inv.amount)||0); if(inv.status==="Платена") map[m].paid+=(Number(inv.amount)||0);}); }); return Object.values(map).sort((a,b)=>new Date(b.dateKey)-new Date(a.dateKey));},[items]);
  if(!months.length) return <div style={{color:"#94a3b8",fontSize:13,textAlign:"center",padding:32}}>Няма данни</div>;
  return <div style={{display:"flex",flexDirection:"column",gap:12}}>{months.map(m=><div key={m.month} style={{background:"#f8fffe",borderRadius:12,padding:"16px 18px",border:"1.5px solid #d1fae5"}}><div style={{fontSize:14,fontWeight:800,color:"#00383f",marginBottom:12,textTransform:"capitalize"}}>{m.month}</div><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(100px,1fr))",gap:10}}>{[["🆕 Нови",m.new,"#6366f1"],["✅ Активирани",m.activated,"#22c55e"],["🔄 Преговори",m.negotiations,"#eab308"],["🧾 Фактурирано",`€${m.invoiced}`,"#02a576"],["💶 Получено",`€${m.paid}`,"#00383f"]].map(([l,v,c])=><div key={l} style={{background:"#fff",borderRadius:8,padding:"10px 12px",border:"1.5px solid #e6f7f2"}}><div style={{fontSize:10,color:"#64748b",marginBottom:3}}>{l}</div><div style={{fontSize:18,fontWeight:800,color:c}}>{v}</div></div>)}</div></div>)}</div>;
}

function QuarterlyComparison({items}){
  const quarters=useMemo(()=>{const map={}; items.forEach(item=>{const q=getQuarter(item.dateAdded); if(!q) return; if(!map[q]) map[q]={q,dateKey:item.dateAdded,total:0,active:0,value:0,invoiced:0,paid:0}; map[q].total++; if(item.status==="Активна"){map[q].active++; map[q].value+=(Number(item.value)||0);} (item.invoices||[]).forEach(inv=>{map[q].invoiced+=(Number(inv.amount)||0); if(inv.status==="Платена") map[q].paid+=(Number(inv.amount)||0);}); }); return Object.values(map).sort((a,b)=>new Date(a.dateKey)-new Date(b.dateKey));},[items]);
  if(!quarters.length) return <div style={{color:"#94a3b8",fontSize:13,textAlign:"center",padding:32}}>Няма достатъчно данни</div>;
  const maxVal=Math.max(...quarters.map(q=>q.invoiced),1);
  return <div>
    <div style={{display:"grid",gridTemplateColumns:`repeat(${Math.min(quarters.length,4)},1fr)`,gap:12,marginBottom:20}}>{quarters.map((q,i)=>{const prev=quarters[i-1]; const diff=prev?Math.round(((q.invoiced-prev.invoiced)/Math.max(prev.invoiced,1))*100):null; return <div key={q.q} style={{background:"#fff",borderRadius:12,padding:"14px 16px",border:"1.5px solid #d1fae5"}}><div style={{fontSize:12,fontWeight:800,color:"#00383f",marginBottom:10}}>{q.q}</div><div style={{height:6,background:"#e6f7f2",borderRadius:4,marginBottom:10}}><div style={{width:`${(q.invoiced/maxVal)*100}%`,height:"100%",background:"#02a576",borderRadius:4}}/></div>{[["Общо",q.total],["Активни",q.active],["Стойност",`€${q.value}/мес`],["Фактурирано",`€${q.invoiced}`],["Получено",`€${q.paid}`]].map(([l,v])=><div key={l} style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4}}><span style={{color:"#64748b"}}>{l}</span><span style={{fontWeight:700,color:"#00383f"}}>{v}</span></div>)}{diff!==null&&<div style={{marginTop:8,fontSize:11,fontWeight:700,color:diff>=0?"#22c55e":"#ef4444",textAlign:"right"}}>{diff>=0?"↑":"↓"} {Math.abs(diff)}% vs {prev.q}</div>}</div>; })}</div>
    {quarters.length>=2&&<div style={{background:"#f8fffe",borderRadius:10,padding:"12px 16px",border:"1.5px solid #d1fae5",fontSize:12,color:"#00383f"}}><b>Последни 2:</b> {quarters[quarters.length-2].q} → {quarters[quarters.length-1].q} | Фактурирано: €{quarters[quarters.length-2].invoiced} → €{quarters[quarters.length-1].invoiced} | Колаборации: {quarters[quarters.length-2].total} → {quarters[quarters.length-1].total}</div>}
  </div>;
}

function Dashboard({items,statuses}){
  const active=items.filter(i=>!i.archived);
  const bySt=statuses.map(s=>({n:s.name,v:active.filter(i=>i.status===s.name).length,color:s.color})).filter(x=>x.v>0);
  const cats=[...new Set(active.map(i=>i.category).filter(Boolean))];
  const byCat=cats.map(c=>({n:c,v:active.filter(i=>i.category===c).length}));
  const byMem=TEAM.map(m=>({n:m,v:active.filter(i=>i.assignee===m).length,rev:active.filter(i=>i.assignee===m&&i.status==="Активна").reduce((s,i)=>s+(Number(i.value)||0),0)})).filter(x=>x.v>0);
  const totalRev=active.filter(i=>i.status==="Активна").reduce((s,i)=>s+(Number(i.value)||0),0);
  const soon=[...active].filter(i=>{const d=dl(i.deadline); return d!==null&&d>=0&&d<=30&&!statuses.find(s=>s.name===i.status)?.isArchive;}).sort((a,b)=>new Date(a.deadline)-new Date(b.deadline)).slice(0,6);
  const topCat=cats.map(c=>({n:c,v:active.filter(i=>i.category===c&&i.status==="Активна").reduce((s,i)=>s+(Number(i.value)||0),0)})).filter(x=>x.v>0).sort((a,b)=>b.v-a.v).slice(0,5);
  const totalInv=items.flatMap(i=>i.invoices||[]).reduce((s,i)=>s+(Number(i.amount)||0),0);
  const paidInv=items.flatMap(i=>i.invoices||[]).filter(i=>i.status==="Платена").reduce((s,i)=>s+(Number(i.amount)||0),0);
  return <div style={{display:"flex",flexDirection:"column",gap:16}}>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:10}}>{[["🤝","Общо",active.length],["✅","Активни",active.filter(i=>i.status==="Активна").length],["🔄","В преговори",active.filter(i=>i.status==="В преговори").length],["💶","Приходи/мес",`€${totalRev}`],["🧾","Фактурирано",`€${totalInv}`],["✔️","Получено",`€${paidInv}`]].map(([ic,l,v])=><div key={l} style={{background:"#fff",borderRadius:12,padding:"13px 15px",border:"1.5px solid #d1fae5"}}><div style={{fontSize:18,marginBottom:3}}>{ic}</div><div style={{fontSize:10,color:"#02a576",fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",marginBottom:2}}>{l}</div><div style={{fontSize:19,fontWeight:800,color:"#00383f"}}>{v}</div></div>)}</div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
      <div style={{background:"#fff",borderRadius:12,padding:18,border:"1.5px solid #d1fae5"}}><div style={{fontSize:13,fontWeight:700,color:"#00383f",marginBottom:14}}>По статус</div><Donut data={bySt}/></div>
      <div style={{background:"#fff",borderRadius:12,padding:18,border:"1.5px solid #d1fae5"}}><div style={{fontSize:13,fontWeight:700,color:"#00383f",marginBottom:14}}>Конверсия</div><Funnel items={active}/></div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
      <div style={{background:"#fff",borderRadius:12,padding:18,border:"1.5px solid #d1fae5"}}><div style={{fontSize:13,fontWeight:700,color:"#00383f",marginBottom:14}}>По категория</div>{byCat.length?<MiniBar data={byCat}/>:<div style={{color:"#94a3b8",fontSize:12}}>Няма данни</div>}</div>
      <div style={{background:"#fff",borderRadius:12,padding:18,border:"1.5px solid #d1fae5"}}><div style={{fontSize:13,fontWeight:700,color:"#00383f",marginBottom:14}}>Топ приходи</div>{topCat.length?topCat.map(c=><div key={c.n} style={{display:"flex",alignItems:"center",gap:8,marginBottom:9}}><div style={{flex:1}}><div style={{fontSize:12,fontWeight:600,color:"#00383f",marginBottom:2}}>{c.n}</div><div style={{height:6,background:"#e6f7f2",borderRadius:4}}><div style={{width:`${(c.v/topCat[0].v)*100}%`,height:"100%",background:"#02a576",borderRadius:4}}/></div></div><span style={{fontSize:13,fontWeight:700,color:"#02a576",minWidth:50,textAlign:"right"}}>€{c.v}</span></div>):<div style={{color:"#94a3b8",fontSize:12}}>Няма активни</div>}</div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
      <div style={{background:"#fff",borderRadius:12,padding:18,border:"1.5px solid #d1fae5"}}><div style={{fontSize:13,fontWeight:700,color:"#00383f",marginBottom:14}}>Екип</div>{byMem.map(m=><div key={m.n} style={{display:"flex",alignItems:"center",gap:9,marginBottom:11}}><Av name={m.n} size={30}/><div style={{flex:1}}><div style={{fontSize:12,fontWeight:600,color:"#00383f"}}>{m.n}</div><div style={{fontSize:10,color:"#64748b"}}>{m.v} колаб. · €{m.rev}/мес</div></div><span style={{background:"#e6f7f2",color:"#00383f",borderRadius:8,padding:"2px 8px",fontSize:12,fontWeight:700}}>{m.v}</span></div>)}</div>
      <div style={{background:"#fff",borderRadius:12,padding:18,border:"1.5px solid #d1fae5"}}><div style={{fontSize:13,fontWeight:700,color:"#00383f",marginBottom:14}}>Предстоящи deadlines</div>{!soon.length&&<div style={{color:"#94a3b8",fontSize:12}}>Няма</div>}{soon.map(i=>{const d=dl(i.deadline); return <div key={i.id} style={{display:"flex",alignItems:"center",gap:9,marginBottom:9}}><Av name={i.brand} size={26}/><div style={{flex:1}}><div style={{fontSize:12,fontWeight:600,color:"#00383f"}}>{i.brand}</div><div style={{fontSize:10,color:d<7?"#ef4444":d<14?"#f59e0b":"#64748b"}}>{fmt(i.deadline)} · {d===0?"днес!":d===1?"утре":`${d} дни`}</div></div><Badge status={i.status} color={DEF_ST_COLORS[i.status]}/></div>; })}</div>
    </div>
  </div>;
}

function Kanban({items,statuses,onOpen,onStatusChange}){
  const [dragging,setDragging]=useState(null); const [over,setOver]=useState(null);
  const [sortK,setSortK]=useState("brand"); const [sortD,setSortD]=useState("asc");
  const activeCols=statuses.filter(s=>!s.isArchive).map(s=>s.name);
  const sortedItems=col=>[...items.filter(i=>i.status===col&&!i.archived)].sort((a,b)=>{let va=a[sortK]??"",vb=b[sortK]??""; if(sortK==="value"||sortK==="rating"){va=Number(va);vb=Number(vb);} const c=va<vb?-1:va>vb?1:0; return sortD==="asc"?c:-c;});
  return <div>
    <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:12,flexWrap:"wrap"}}><span style={{fontSize:12,color:"#64748b",fontWeight:600}}>Сортирай по:</span>{[["brand","Бранд"],["priority","Приоритет"],["value","Стойност"],["deadline","Deadline"]].map(([k,l])=><button key={k} onClick={()=>{if(sortK===k) setSortD(d=>d==="asc"?"desc":"asc"); else{setSortK(k);setSortD("asc");}}} style={{padding:"5px 10px",borderRadius:7,border:"1.5px solid",borderColor:sortK===k?"#02a576":"#d1fae5",background:sortK===k?"#e6f7f2":"#fff",color:sortK===k?"#00383f":"#64748b",cursor:"pointer",fontSize:11,fontFamily:"inherit",fontWeight:sortK===k?700:400}}>{l}{sortK===k?(sortD==="asc"?" ↑":" ↓"):""}</button>)}</div>
    <div style={{display:"flex",gap:12,overflowX:"auto",paddingBottom:14,alignItems:"flex-start"}}>{activeCols.map(col=>{const ci=sortedItems(col); const s=statuses.find(x=>x.name===col)||{}; const isOver=over===col; return <div key={col} onDragOver={e=>{e.preventDefault();setOver(col);}} onDrop={e=>{e.preventDefault();if(dragging&&col!==items.find(i=>i.id===dragging)?.status) onStatusChange(dragging,col);setDragging(null);setOver(null);}} onDragLeave={()=>setOver(null)} style={{minWidth:210,flex:"0 0 210px",background:isOver?"#e6f7f2":"#f8fffe",borderRadius:12,padding:"12px 10px",border:`2px ${isOver?"solid #02a576":"dashed #d1fae5"}`,transition:"all .15s",minHeight:120}}>
      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:12,paddingBottom:8,borderBottom:"1.5px solid #d1fae5"}}><span style={{width:8,height:8,borderRadius:"50%",background:s.color||"#94a3b8",flexShrink:0}}/><span style={{fontSize:12,fontWeight:700,color:"#00383f"}}>{col}</span><span style={{marginLeft:"auto",background:"#e6f7f2",borderRadius:10,padding:"1px 7px",fontSize:11,color:"#02a576",fontWeight:700}}>{ci.length}</span></div>
      {ci.map(item=>{const isDrag=dragging===item.id; return <div key={item.id} draggable onDragStart={e=>{setDragging(item.id);e.dataTransfer.effectAllowed="move";}} onDragEnd={()=>{setDragging(null);setOver(null);}} onClick={()=>!dragging&&onOpen(item)} style={{background:"#fff",borderRadius:10,padding:"11px 12px",border:`1.5px solid ${isDrag?"#02a576":"#d1fae5"}`,cursor:"grab",boxShadow:isDrag?"0 8px 20px rgba(2,165,118,.2)":"0 1px 3px rgba(0,56,63,.07)",transform:isDrag?"rotate(2deg) scale(1.02)":"none",opacity:isDrag?.7:1,marginBottom:8,transition:"transform .1s,box-shadow .1s",userSelect:"none"}}>
        <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:5}}><Av name={item.brand} size={24}/><span style={{fontSize:12,fontWeight:700,color:"#00383f",lineHeight:1.3}}>{item.brand}</span></div>
        {item.category&&<div style={{fontSize:10,color:"#64748b",marginBottom:4}}>{item.category}</div>}
        {item.value>0&&<div style={{fontSize:11,fontWeight:700,color:"#02a576",marginBottom:3}}>€{item.value}/мес</div>}
        {item.nextStep&&<div style={{fontSize:10,color:"#00383f",background:"#e6f7f2",borderRadius:6,padding:"3px 7px",marginBottom:5}}>→ {item.nextStep.slice(0,36)}{item.nextStep.length>36?"…":""}</div>}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:4}}>
          <span style={{fontSize:10,color:"#94a3b8"}}><span style={{width:6,height:6,borderRadius:"50%",background:PC[item.priority],display:"inline-block",marginRight:3}}/>{item.priority}</span>
          <div style={{display:"flex",gap:5}}>{item.invoices?.length>0&&<span style={{fontSize:10,color:"#02a576"}}>🧾{item.invoices.length}</span>}{item.comments?.length>0&&<span style={{fontSize:10,color:"#64748b"}}>💬{item.comments.length}</span>}{item.rating>0&&<span style={{fontSize:10,color:"#f59e0b"}}>{"★".repeat(item.rating)}</span>}</div>
        </div>
      </div>;})}
      {isOver&&<div style={{height:56,border:"2px dashed #02a576",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:"#02a576",background:"#f0fdf9"}}>Пусни тук</div>}
    </div>; })}</div>
  </div>;
}

function BrandGroupView({items,statuses,onOpen}){
  const [expanded,setExpanded]=useState({}); const [search,setSearch]=useState("");
  const groups=useMemo(()=>{const map={}; items.forEach(item=>{const key=item.brand.toLowerCase().trim(); if(!map[key]) map[key]={name:item.brand,items:[]}; map[key].items.push(item);}); return Object.values(map).filter(g=>!search||g.name.toLowerCase().includes(search.toLowerCase())).sort((a,b)=>a.name.localeCompare(b.name));},[items,search]);
  return <div>
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}><input style={{padding:"8px 12px",borderRadius:8,border:"1.5px solid #d1fae5",fontSize:13,color:"#00383f",background:"#f8fffe",outline:"none",fontFamily:"inherit",width:240}} placeholder="🔍 Търси бранд..." value={search} onChange={e=>setSearch(e.target.value)}/><span style={{fontSize:12,color:"#02a576",fontWeight:600}}>{groups.length} бранда · {items.length} колаборации</span></div>
    <div style={{display:"flex",flexDirection:"column",gap:10}}>{groups.map(g=>{const key=g.name.toLowerCase().trim(); const isOpen=expanded[key]; const totalVal=g.items.filter(i=>i.status==="Активна").reduce((s,i)=>s+(Number(i.value)||0),0); const totalInv=g.items.flatMap(i=>i.invoices||[]).reduce((s,i)=>s+(Number(i.amount)||0),0); const statCounts={}; g.items.forEach(i=>{statCounts[i.status]=(statCounts[i.status]||0)+1;});
      return <div key={key} style={{background:"#fff",borderRadius:12,border:"1.5px solid #d1fae5",overflow:"hidden"}}>
        <div onClick={()=>setExpanded(p=>({...p,[key]:!p[key]}))} style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",cursor:"pointer",userSelect:"none"}} onMouseEnter={e=>e.currentTarget.style.background="#f8fffe"} onMouseLeave={e=>e.currentTarget.style.background=""}>
          <Av name={g.name} size={38}/>
          <div style={{flex:1}}><div style={{fontSize:14,fontWeight:800,color:"#00383f",marginBottom:4}}>{g.name}</div><div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{Object.entries(statCounts).map(([st,n])=>{const c=statuses.find(s=>s.name===st)?.color||DEF_ST_COLORS[st]||"#94a3b8"; return <span key={st} style={{background:c+"22",color:c,borderRadius:10,padding:"1px 7px",fontSize:11,fontWeight:600}}>{st} {n}</span>;})}</div></div>
          <div style={{display:"flex",gap:16,alignItems:"center",flexShrink:0}}>
            {totalVal>0&&<div style={{textAlign:"right"}}><div style={{fontSize:9,color:"#02a576",fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>€/мес</div><div style={{fontSize:15,fontWeight:800,color:"#02a576"}}>€{totalVal}</div></div>}
            {totalInv>0&&<div style={{textAlign:"right"}}><div style={{fontSize:9,color:"#64748b",fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>Фактурирано</div><div style={{fontSize:15,fontWeight:700,color:"#00383f"}}>€{totalInv}</div></div>}
            <div style={{width:24,height:24,borderRadius:6,background:"#e6f7f2",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,color:"#02a576",transition:"transform .2s",transform:isOpen?"rotate(180deg)":"none"}}>▾</div>
          </div>
        </div>
        {isOpen&&<div style={{borderTop:"1.5px solid #e6f7f2"}}>{g.items.map((item,idx)=>{const d=dl(item.deadline); const stColor=statuses.find(s=>s.name===item.status)?.color||DEF_ST_COLORS[item.status]||"#94a3b8"; return <div key={item.id} onClick={()=>onOpen(item)} style={{display:"flex",alignItems:"center",gap:12,padding:"11px 16px",borderBottom:idx<g.items.length-1?"1px solid #f0fdf9":"none",cursor:"pointer",transition:"background .1s"}} onMouseEnter={e=>e.currentTarget.style.background="#f8fffe"} onMouseLeave={e=>e.currentTarget.style.background=""}><div style={{width:6,height:6,borderRadius:"50%",background:stColor,flexShrink:0}}/><div style={{flex:1,minWidth:0}}><div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}><span style={{fontSize:13,fontWeight:600,color:"#00383f"}}>{item.collabType||"Колаборация"}</span><Badge status={item.status} color={stColor}/>{item.archived&&<span style={{fontSize:9,background:"#f1f5f9",color:"#64748b",borderRadius:4,padding:"1px 5px"}}>архив</span>}</div><div style={{fontSize:11,color:"#64748b",marginTop:3}}>{item.theyOffer?.slice(0,70)}{item.theyOffer?.length>70?"…":""}</div></div><div style={{display:"flex",gap:14,alignItems:"center",flexShrink:0,fontSize:12}}>{item.value>0&&<span style={{fontWeight:700,color:"#02a576"}}>€{item.value}/мес</span>}{item.deadline&&<span style={{color:d!==null&&d<7&&d>=0?"#ef4444":"#64748b"}}>{new Date(item.deadline).toLocaleDateString("bg-BG")}</span>}{item.assignee&&<Av name={item.assignee} size={22}/>}</div></div>; })}</div>}
      </div>;
    })}{!groups.length&&<div style={{textAlign:"center",color:"#94a3b8",padding:40,fontSize:14,background:"#fff",borderRadius:12,border:"1.5px solid #d1fae5"}}>Няма намерени брандове</div>}
    </div>
  </div>;
}

function AttachmentsGallery({items,onOpen}){
  const [search,setSearch]=useState(""); const [preview,setPreview]=useState(null);
  const allFiles=useMemo(()=>{const files=[]; items.forEach(item=>{if(item.fileName&&item.fileData) files.push({id:item.id,name:item.fileName,data:item.fileData,brand:item.brand,item,type:item.fileName.split(".").pop().toLowerCase(),addedAt:item.dateAdded});}); return files.filter(f=>!search||f.name.toLowerCase().includes(search.toLowerCase())||f.brand.toLowerCase().includes(search.toLowerCase())).sort((a,b)=>new Date(b.addedAt)-new Date(a.addedAt));},[items,search]);
  const isImg=t=>["jpg","jpeg","png","gif","webp"].includes(t); const isPdf=t=>t==="pdf"; const icon=t=>isPdf(t)?"📄":isImg(t)?"🖼️":"📎";
  return <div>
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}><input style={{padding:"8px 12px",borderRadius:8,border:"1.5px solid #d1fae5",fontSize:13,color:"#00383f",background:"#f8fffe",outline:"none",fontFamily:"inherit",width:240}} placeholder="🔍 Търси файл или бранд..." value={search} onChange={e=>setSearch(e.target.value)}/><span style={{fontSize:12,color:"#02a576",fontWeight:600}}>{allFiles.length} файла</span></div>
    {!allFiles.length&&<div style={{textAlign:"center",color:"#94a3b8",padding:40,fontSize:14,background:"#fff",borderRadius:12,border:"1.5px solid #d1fae5"}}>Няма прикачени файлове</div>}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:12}}>{allFiles.map(f=><div key={f.id} style={{background:"#fff",borderRadius:12,border:"1.5px solid #d1fae5",overflow:"hidden",cursor:"pointer",transition:"all .15s",boxShadow:"0 1px 3px rgba(0,56,63,.06)"}} onMouseEnter={e=>{e.currentTarget.style.boxShadow="0 4px 12px rgba(2,165,118,.15)";e.currentTarget.style.transform="translateY(-2px)";}} onMouseLeave={e=>{e.currentTarget.style.boxShadow="0 1px 3px rgba(0,56,63,.06)";e.currentTarget.style.transform="";}}>
      <div onClick={()=>setPreview(f)} style={{height:110,background:"#f0fdf9",display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",borderBottom:"1.5px solid #e6f7f2"}}>{isImg(f.type)?<img src={f.data} alt={f.name} style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<div style={{fontSize:40,opacity:.6}}>{icon(f.type)}</div>}</div>
      <div style={{padding:"10px 12px"}}><div style={{fontSize:12,fontWeight:700,color:"#00383f",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginBottom:3}}>{f.name}</div><div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}><Av name={f.brand} size={18}/><span style={{fontSize:11,color:"#64748b",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.brand}</span></div><div style={{display:"flex",gap:6}}><a href={f.data} download={f.name} onClick={e=>e.stopPropagation()} style={{fontSize:11,color:"#02a576",fontWeight:600,textDecoration:"none",background:"#e6f7f2",borderRadius:6,padding:"3px 8px"}}>⬇️ Свали</a><button onClick={()=>onOpen(f.item)} style={{fontSize:11,color:"#00383f",fontWeight:600,background:"#f0fdf9",border:"none",borderRadius:6,padding:"3px 8px",cursor:"pointer",fontFamily:"inherit"}}>👁️ Виж</button></div></div>
    </div>)}</div>
    {preview&&<div style={{position:"fixed",inset:0,background:"rgba(0,56,63,.7)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:20,backdropFilter:"blur(6px)"}} onClick={()=>setPreview(null)}><div onClick={e=>e.stopPropagation()} style={{background:"#fff",borderRadius:16,maxWidth:800,width:"100%",maxHeight:"90vh",overflow:"hidden",boxShadow:"0 24px 60px rgba(0,0,0,.3)"}}><div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 18px",borderBottom:"1.5px solid #e6f7f2"}}><div><div style={{fontSize:14,fontWeight:700,color:"#00383f"}}>{preview.name}</div><div style={{fontSize:12,color:"#64748b"}}>{preview.brand}</div></div><div style={{display:"flex",gap:8}}><a href={preview.data} download={preview.name} style={{padding:"7px 14px",borderRadius:8,background:"#02a576",color:"#fff",fontSize:12,fontWeight:600,textDecoration:"none"}}>⬇️ Свали</a><button onClick={()=>setPreview(null)} style={{width:34,height:34,borderRadius:8,border:"1.5px solid #d1fae5",background:"#f8fffe",cursor:"pointer",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center"}}>×</button></div></div><div style={{display:"flex",alignItems:"center",justifyContent:"center",background:"#f0fdf9",minHeight:300,maxHeight:"70vh",overflow:"auto"}}>{isImg(preview.type)?<img src={preview.data} alt={preview.name} style={{maxWidth:"100%",maxHeight:"70vh",objectFit:"contain"}}/>:isPdf(preview.type)?<iframe src={preview.data} style={{width:"100%",height:"60vh",border:"none"}} title={preview.name}/>:<div style={{textAlign:"center",padding:40,color:"#64748b"}}><div style={{fontSize:60,marginBottom:12}}>{icon(preview.type)}</div><div style={{fontSize:14}}>Преглед не е наличен</div><a href={preview.data} download={preview.name} style={{display:"inline-block",marginTop:12,padding:"8px 18px",background:"#02a576",color:"#fff",borderRadius:8,fontSize:13,fontWeight:600,textDecoration:"none"}}>⬇️ Свали</a></div>}</div></div></div>}
  </div>;
}

function Detail({item,onClose,onEdit,onDelete,onComment,onDuplicate,onInvoiceUpdate,onArchive,notify,allItems,statuses}){
  const [tab,setTab]=useState("info"); const [txt,setTxt]=useState(""); const [who,setWho]=useState(TEAM[0]);
  const d=dl(item.deadline); const tags=(item.tags||"").split(",").map(t=>t.trim()).filter(Boolean);
  const stColor=statuses.find(s=>s.name===item.status)?.color||DEF_ST_COLORS[item.status]||"#94a3b8";
  const brandHistory=allItems.filter(i=>i.brand.toLowerCase()===item.brand.toLowerCase());
  const submitComment=()=>{if(!txt.trim()) return; const mentions=TEAM.filter(m=>txt.includes("@"+m)); onComment(item.id,{author:who,text:txt.trim(),at:nowStr(),mentions}); setTxt("");};
  return <div style={{padding:26}}>
    <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:18}}>
      <div style={{display:"flex",alignItems:"center",gap:11}}><Av name={item.brand} size={44}/><div><h2 style={{margin:"0 0 5px",fontSize:19,fontWeight:800,color:"#00383f"}}>{item.brand}</h2><div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}><Badge status={item.status} color={stColor}/>{item.archived&&<span style={{fontSize:11,background:"#f1f5f9",color:"#64748b",borderRadius:6,padding:"2px 8px"}}>📦 Архив</span>}{item.rating>0&&<Stars value={item.rating}/>}</div></div></div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
        <button onClick={onDuplicate} title="Дублирай" style={{width:32,height:32,borderRadius:8,border:"1.5px solid #d1fae5",background:"#f8fffe",cursor:"pointer",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center"}}>⧉</button>
        <button onClick={()=>onArchive(item.id,!item.archived)} title={item.archived?"Разархивирай":"Архивирай"} style={{width:32,height:32,borderRadius:8,border:"1.5px solid #d1fae5",background:"#f8fffe",cursor:"pointer",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center"}}>{item.archived?"📤":"📦"}</button>
        <button onClick={onEdit} style={{width:32,height:32,borderRadius:8,border:"1.5px solid #d1fae5",background:"#f8fffe",cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>✏️</button>
        <button onClick={onClose} style={{width:32,height:32,borderRadius:8,border:"1.5px solid #d1fae5",background:"#f8fffe",cursor:"pointer",fontSize:17,display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
      </div>
    </div>
    <div style={{display:"flex",gap:2,marginBottom:16,borderBottom:"2px solid #e6f7f2",overflowX:"auto"}}>{[["info","ℹ️ Детайли"],[`invoices`,`🧾 Фактури${item.invoices?.length?` (${item.invoices.length})`:""}`],[`comments`,`💬 Коментари${item.comments?.length?` (${item.comments.length})`:""}`],["history","📋 История"],["brandhistory","🔁 Бранд"]].map(([k,l])=><button key={k} onClick={()=>setTab(k)} style={{padding:"7px 11px",border:"none",borderRadius:"7px 7px 0 0",background:tab===k?"#e6f7f2":"transparent",color:tab===k?"#00383f":"#64748b",fontWeight:tab===k?700:500,cursor:"pointer",fontSize:11,fontFamily:"inherit",whiteSpace:"nowrap"}}>{l}</button>)}</div>
    {tab==="info"&&<>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"11px 22px",marginBottom:16}}>{[["КАТЕГОРИЯ",item.category],["КОНТАКТ",item.contact],["ИМЕЙЛ",item.email],["ТЕЛЕФОН",item.phone],["ПРИОРИТЕТ",<span style={{color:PC[item.priority],fontWeight:700}}>● {item.priority}</span>],["ОТГОВОРНИК",item.assignee],["СТОЙНОСТ",item.value?`€${item.value}/мес`:"—"],["ТИП",item.collabType],["DEADLINE",item.deadline?<span style={{color:d!==null&&d<7&&d>=0?"#ef4444":"#00383f"}}>{fmt(item.deadline)}{d!==null&&d>=0?` (${d} дни)`:d<0?" (изтекъл)":""}</span>:"—"],["ДОБАВЕНО",fmt(item.dateAdded)]].map(([l,v])=><div key={l}><div style={{fontSize:9,fontWeight:700,color:"#02a576",letterSpacing:".07em",textTransform:"uppercase",marginBottom:2}}>{l}</div><div style={{fontSize:13,color:"#00383f"}}>{v||"—"}</div></div>)}</div>
      {(item.contactBirthday||item.contactNotes)&&<div style={{background:"#f0fdf9",borderRadius:9,padding:"11px 13px",marginBottom:10}}><div style={{fontSize:9,fontWeight:700,color:"#02a576",textTransform:"uppercase",letterSpacing:".07em",marginBottom:6}}>БЕЛЕЖКИ ЗА КОНТАКТА</div>{item.contactBirthday&&<div style={{fontSize:12,color:"#00383f",marginBottom:4}}>🎂 Рожден ден: {fmt(item.contactBirthday)}</div>}{item.contactNotes&&<div style={{fontSize:13,color:"#475569"}}>{item.contactNotes}</div>}</div>}
      {item.nextStep&&<div style={{background:"#e6f7f2",borderRadius:9,padding:"11px 13px",marginBottom:10,display:"flex",gap:10}}><span style={{fontSize:16}}>→</span><div><div style={{fontSize:9,fontWeight:700,color:"#02a576",textTransform:"uppercase",letterSpacing:".07em",marginBottom:2}}>СЛЕДВАЩА СТЪПКА{item.nextStepDate?` · ${fmt(item.nextStepDate)}`:""}</div><div style={{fontSize:13,color:"#00383f",fontWeight:600}}>{item.nextStep}</div></div></div>}
      {item.theyOffer&&<div style={{background:"#f0fdf4",borderRadius:9,padding:"11px 13px",marginBottom:8}}><div style={{fontSize:9,fontWeight:700,color:"#16a34a",textTransform:"uppercase",letterSpacing:".07em",marginBottom:3}}>ТЕ ПРЕДЛАГАТ</div><div style={{fontSize:13,color:"#166534"}}>{item.theyOffer}</div></div>}
      {item.weOffer&&<div style={{background:"#eff6ff",borderRadius:9,padding:"11px 13px",marginBottom:8}}><div style={{fontSize:9,fontWeight:700,color:"#1d4ed8",textTransform:"uppercase",letterSpacing:".07em",marginBottom:3}}>НИЕ ПРЕДЛАГАМЕ</div><div style={{fontSize:13,color:"#1e40af"}}>{item.weOffer}</div></div>}
      {item.notes&&<div style={{background:"#fafafa",borderRadius:9,padding:"11px 13px",marginBottom:8}}><div style={{fontSize:9,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:".07em",marginBottom:3}}>БЕЛЕЖКИ</div><div style={{fontSize:13,color:"#475569"}}>{item.notes}</div></div>}
      {item.links&&<div style={{marginBottom:8}}><div style={{fontSize:9,fontWeight:700,color:"#02a576",textTransform:"uppercase",letterSpacing:".07em",marginBottom:3}}>ЛИНКОВЕ</div>{item.links.split(",").map(l=>l.trim()).filter(Boolean).map((l,i)=><a key={i} href={l} target="_blank" rel="noopener noreferrer" style={{display:"block",fontSize:13,color:"#02a576",textDecoration:"none",marginBottom:2}}>🔗 {l}</a>)}</div>}
      {tags.length>0&&<div style={{marginBottom:8}}><div style={{fontSize:9,fontWeight:700,color:"#02a576",textTransform:"uppercase",letterSpacing:".07em",marginBottom:5}}>ТАГОВЕ</div><div style={{display:"flex",gap:5,flexWrap:"wrap"}}>{tags.map(t=><span key={t} style={{background:"#e6f7f2",color:"#00383f",borderRadius:6,padding:"3px 9px",fontSize:11,fontWeight:600}}>{t}</span>)}</div></div>}
      {item.fileName&&<div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>📎 {item.fileData?<a href={item.fileData} download={item.fileName} style={{fontSize:13,color:"#02a576",fontWeight:600}}>{item.fileName}</a>:<span style={{fontSize:13,color:"#64748b"}}>{item.fileName}</span>}</div>}
      <div style={{display:"flex",justifyContent:"flex-end",marginTop:10}}><button onClick={()=>{if(window.confirm(`Изтрий "${item.brand}"?`)) onDelete(item.id);}} style={{padding:"7px 15px",borderRadius:8,border:"1.5px solid #fee2e2",background:"#fff5f5",color:"#ef4444",cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:"inherit"}}>🗑️ Изтрий</button></div>
    </>}
    {tab==="invoices"&&<InvoiceTab item={item} onUpdate={invs=>onInvoiceUpdate(item.id,invs)} notify={notify}/>}
    {tab==="comments"&&<div>
      {!(item.comments?.length)&&<div style={{color:"#94a3b8",fontSize:13,marginBottom:12}}>Няма коментари. Използвай @ за да споменеш колега.</div>}
      <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:14}}>{[...(item.comments||[])].reverse().map((c,i)=><div key={i} style={{background:"#f8fffe",borderRadius:9,padding:"9px 12px",border:`1.5px solid ${c.mentions?.length?"#d1fae5":"#f0fdf9"}`}}><div style={{display:"flex",alignItems:"center",gap:7,marginBottom:3}}><Av name={c.author} size={20}/><span style={{fontSize:12,fontWeight:700,color:"#00383f"}}>{c.author}</span>{c.mentions?.length>0&&<span style={{fontSize:10,background:"#e6f7f2",color:"#02a576",borderRadius:4,padding:"1px 5px",fontWeight:600}}>@ {c.mentions.join(", ")}</span>}<span style={{fontSize:10,color:"#94a3b8",marginLeft:"auto"}}>{c.at}</span></div><CommentText text={c.text}/></div>)}</div>
      <div style={{display:"flex",gap:7,alignItems:"flex-end"}}><select style={{...IS,width:110,flexShrink:0}} value={who} onChange={e=>setWho(e.target.value)}>{TEAM.map(m=><option key={m}>{m}</option>)}</select><MentionInput value={txt} onChange={setTxt} placeholder="Пиши @ за да споменеш някого..."/><button onClick={submitComment} style={{padding:"8px 14px",borderRadius:8,border:"none",background:"#02a576",color:"#fff",cursor:"pointer",fontFamily:"inherit",fontWeight:600,fontSize:12,height:54,flexShrink:0}}>Добави</button></div>
    </div>}
    {tab==="history"&&<div>{!(item.history?.length)&&<div style={{color:"#94a3b8",fontSize:13}}>Няма история</div>}{[...(item.history||[])].reverse().map((h,i)=><div key={i} style={{display:"flex",gap:10,padding:"8px 0",borderBottom:"1px solid #e6f7f2"}}><span style={{width:6,height:6,borderRadius:"50%",background:"#02a576",marginTop:5,flexShrink:0}}/><div><div style={{fontSize:13,color:"#00383f"}}>{h.user&&<b>{h.user} </b>}{h.action}{h.detail?`: ${h.detail}`:""}</div><div style={{fontSize:10,color:"#94a3b8",marginTop:1}}>{h.at}</div></div></div>)}</div>}
    {tab==="brandhistory"&&<div>
      {brandHistory.length<=1?<div style={{color:"#94a3b8",fontSize:13}}>Само една колаборация с този бранд</div>:brandHistory.map(i=>{const stC=statuses.find(s=>s.name===i.status)?.color||DEF_ST_COLORS[i.status]||"#94a3b8"; return <div key={i.id} style={{background:"#f8fffe",borderRadius:9,padding:"11px 14px",border:"1.5px solid #d1fae5",marginBottom:10}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{fontWeight:700,color:"#00383f",fontSize:13}}>{i.collabType||"Колаборация"}</span><Badge status={i.status} color={stC}/></div><div style={{fontSize:12,color:"#64748b"}}>Добавена: {fmt(i.dateAdded)} · {i.value?`€${i.value}/мес`:"бартер"} · {i.assignee||"—"}</div>{i.invoices?.length>0&&<div style={{fontSize:12,color:"#02a576",marginTop:3}}>🧾 {i.invoices.length} фактури · €{i.invoices.reduce((s,x)=>s+(Number(x.amount)||0),0)} общо</div>}</div>;})}
    </div>}
  </div>;
}

function Form({initial,onSave,onCancel,statuses}){
  const [f,setF]=useState(initial||EMPTY); const fileRef=useRef();
  const set=(k,v)=>setF(p=>({...p,[k]:v})); const ok=f.brand.trim()&&f.contact.trim()&&f.email.trim();
  return <div style={{padding:24}}>
    <h3 style={{margin:"0 0 16px",fontSize:17,fontWeight:800,color:"#00383f"}}>{initial?.id?"✏️ Редактирай":"➕ Нова колаборация"}</h3>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 14px"}}>
      <FF label="Бранд *"><input style={IS} value={f.brand} onChange={e=>set("brand",e.target.value)} placeholder="Фирма / Бранд"/></FF>
      <FF label="Категория"><input style={IS} value={f.category} onChange={e=>set("category",e.target.value)} placeholder="напр. Хранителни добавки"/></FF>
      <FF label="Контакт *"><input style={IS} value={f.contact} onChange={e=>set("contact",e.target.value)} placeholder="Иван Иванов"/></FF>
      <FF label="Телефон"><input style={IS} value={f.phone} onChange={e=>set("phone",e.target.value)} placeholder="+359 88..."/></FF>
      <FF label="Имейл *"><input style={IS} value={f.email} onChange={e=>set("email",e.target.value)} placeholder="ivan@brand.bg"/></FF>
      <FF label="Тип колаборация"><select style={IS} value={f.collabType} onChange={e=>set("collabType",e.target.value)}><option value="">— избери —</option>{COLLAB_TYPES.map(c=><option key={c}>{c}</option>)}</select></FF>
      <FF label="Рожден ден на контакта"><input style={IS} type="date" value={f.contactBirthday} onChange={e=>set("contactBirthday",e.target.value)}/></FF>
      <FF label="Бележки за контакта"><input style={IS} value={f.contactNotes} onChange={e=>set("contactNotes",e.target.value)} placeholder="Как се запознахте..."/></FF>
    </div>
    <FF label="Те предлагат"><textarea style={{...IS,resize:"vertical",minHeight:54}} value={f.theyOffer} onChange={e=>set("theyOffer",e.target.value)} placeholder="Продукти, пари, комисионна..."/></FF>
    <FF label="Ние предлагаме"><textarea style={{...IS,resize:"vertical",minHeight:54}} value={f.weOffer} onChange={e=>set("weOffer",e.target.value)} placeholder="Постове, Reels, Stories..."/></FF>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 14px"}}>
      <FF label="Следваща стъпка"><input style={IS} value={f.nextStep} onChange={e=>set("nextStep",e.target.value)} placeholder="Изпрати оферта..."/></FF>
      <FF label="До дата"><input style={IS} type="date" value={f.nextStepDate} onChange={e=>set("nextStepDate",e.target.value)}/></FF>
      <FF label="Линкове (разделени с ,)"><input style={IS} value={f.links} onChange={e=>set("links",e.target.value)} placeholder="https://brand.bg"/></FF>
      <FF label="Тагове (разделени с ,)"><input style={IS} value={f.tags} onChange={e=>set("tags",e.target.value)} placeholder="дългосрочен, сезонен"/></FF>
    </div>
    <FF label="Прикачи файл"><div style={{display:"flex",alignItems:"center",gap:9}}><button onClick={()=>fileRef.current.click()} style={{padding:"6px 14px",borderRadius:8,border:"1.5px dashed #02a576",background:"#f8fffe",cursor:"pointer",fontSize:12,color:"#02a576",fontFamily:"inherit"}}>📎 {f.fileName||"Избери файл"}</button>{f.fileName&&<button onClick={()=>{set("fileName",null);set("fileData",null);}} style={{background:"none",border:"none",cursor:"pointer",color:"#ef4444",fontSize:17}}>×</button>}</div><input ref={fileRef} type="file" style={{display:"none"}} onChange={e=>{const file=e.target.files[0]; if(!file) return; const r=new FileReader(); r.onload=ev=>{set("fileName",file.name);set("fileData",ev.target.result);}; r.readAsDataURL(file);}} accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg"/></FF>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:"0 14px"}}>
      <FF label="Статус"><select style={IS} value={f.status} onChange={e=>set("status",e.target.value)}>{statuses.map(s=><option key={s.name}>{s.name}</option>)}</select></FF>
      <FF label="Приоритет"><select style={IS} value={f.priority} onChange={e=>set("priority",e.target.value)}>{PRIORITIES.map(p=><option key={p}>{p}</option>)}</select></FF>
      <FF label="Стойност (€/мес)"><input style={IS} type="number" value={f.value} onChange={e=>set("value",e.target.value)} placeholder="0"/></FF>
      <FF label="Deadline"><input style={IS} type="date" value={f.deadline} onChange={e=>set("deadline",e.target.value)}/></FF>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 14px"}}>
      <FF label="Отговорник"><select style={IS} value={f.assignee} onChange={e=>set("assignee",e.target.value)}><option value="">— избери —</option>{TEAM.map(m=><option key={m}>{m}</option>)}</select></FF>
      <FF label="Рейтинг"><Stars value={f.rating} onChange={v=>set("rating",v)}/></FF>
    </div>
    <FF label="Бележки"><textarea style={{...IS,resize:"vertical",minHeight:54}} value={f.notes} onChange={e=>set("notes",e.target.value)} placeholder="Допълнителна информация..."/></FF>
    <div style={{display:"flex",gap:9,justifyContent:"flex-end",marginTop:6}}>
      <button onClick={onCancel} style={{padding:"8px 18px",borderRadius:8,border:"1.5px solid #d1fae5",background:"#fff",cursor:"pointer",fontSize:13,fontFamily:"inherit",color:"#64748b"}}>Отказ</button>
      <button disabled={!ok} onClick={()=>onSave(f)} style={{padding:"8px 22px",borderRadius:8,border:"none",background:ok?"#02a576":"#a7f3d0",color:"#fff",cursor:ok?"pointer":"not-allowed",fontSize:13,fontWeight:700,fontFamily:"inherit"}}>💾 Запази</button>
    </div>
  </div>;
}

function printReport(items,statuses){
  const totalRev=items.filter(i=>i.status==="Активна"&&!i.archived).reduce((s,i)=>s+(Number(i.value)||0),0);
  const totalInv=items.flatMap(i=>i.invoices||[]).reduce((s,i)=>s+(Number(i.amount)||0),0);
  const paidInv=items.flatMap(i=>i.invoices||[]).filter(i=>i.status==="Платена").reduce((s,i)=>s+(Number(i.amount)||0),0);
  const rows=items.filter(i=>!i.archived).map(i=>`<tr style="border-bottom:1px solid #e6f7f2"><td style="padding:8px 10px;font-weight:600;color:#00383f">${i.brand}</td><td style="padding:8px 10px;color:#475569">${i.category||"—"}</td><td style="padding:8px 10px"><span style="background:${(statuses.find(s=>s.name===i.status)?.color||"#94a3b8")}22;color:${statuses.find(s=>s.name===i.status)?.color||"#94a3b8"};padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600">${i.status}</span></td><td style="padding:8px 10px;color:#02a576;font-weight:700">${i.value?`€${i.value}/мес`:"—"}</td><td style="padding:8px 10px;color:#475569">${i.assignee||"—"}</td><td style="padding:8px 10px;color:#475569">${i.deadline?new Date(i.deadline).toLocaleDateString("bg-BG"):"—"}</td></tr>`).join("");
  const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>DietitianMED Partnerships</title><style>body{font-family:'Segoe UI',sans-serif;color:#00383f;padding:32px;max-width:900px;margin:0 auto}h1{font-size:24px;font-weight:800;color:#00383f;margin-bottom:4px}.sub{color:#64748b;margin-bottom:24px;font-size:14px}.stats{display:flex;gap:16px;margin-bottom:28px;flex-wrap:wrap}.stat{background:#f0fdf9;border:1.5px solid #d1fae5;border-radius:10px;padding:12px 18px;min-width:120px}.stat-l{font-size:10px;color:#02a576;font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px}.stat-v{font-size:22px;font-weight:800;color:#00383f}table{width:100%;border-collapse:collapse;font-size:13px}th{padding:10px;text-align:left;font-size:10px;font-weight:700;color:#02a576;text-transform:uppercase;letter-spacing:.06em;border-bottom:2px solid #d1fae5;background:#f8fffe}</style></head><body><h1>🤝 DietitianMED Partnerships</h1><div class="sub">Генериран: ${new Date().toLocaleDateString("bg-BG",{day:"numeric",month:"long",year:"numeric"})}</div><div class="stats"><div class="stat"><div class="stat-l">Общо</div><div class="stat-v">${items.filter(i=>!i.archived).length}</div></div><div class="stat"><div class="stat-l">Активни</div><div class="stat-v">${items.filter(i=>i.status==="Активна"&&!i.archived).length}</div></div><div class="stat"><div class="stat-l">Приходи/мес</div><div class="stat-v">€${totalRev}</div></div><div class="stat"><div class="stat-l">Фактурирано</div><div class="stat-v">€${totalInv}</div></div><div class="stat"><div class="stat-l">Получено</div><div class="stat-v">€${paidInv}</div></div></div><table><thead><tr><th>Бранд</th><th>Категория</th><th>Статус</th><th>Стойност</th><th>Отговорник</th><th>Deadline</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
  const w=window.open("","_blank"); w.document.write(html); w.document.close(); setTimeout(()=>w.print(),500);
}

function exportCSV(items){
  const cols=["Бранд","Категория","Контакт","Телефон","Имейл","Те предлагат","Ние предлагаме","Тип","Статус","Приоритет","€/мес","Deadline","Отговорник","Тагове","Рейтинг","Фактури","Фактурирано €","Получено €","Архивиран"];
  const rows=items.map(i=>{const invs=i.invoices||[],tot=invs.reduce((s,x)=>s+(Number(x.amount)||0),0),paid=invs.filter(x=>x.status==="Платена").reduce((s,x)=>s+(Number(x.amount)||0),0); return [i.brand,i.category,i.contact,i.phone,i.email,i.theyOffer,i.weOffer,i.collabType,i.status,i.priority,i.value,i.deadline,i.assignee,i.tags,i.rating,invs.length,tot,paid,i.archived?"Да":"Не"].map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(",");});
  const blob=new Blob(["\uFEFF"+[cols.join(","),...rows].join("\n")],{type:"text/csv;charset=utf-8"});
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="DietitianMED_Partnerships.csv"; a.click();
}

// ── Main App ─────────────────────────────────────────────────────────────────
export default function App(){
  const [items,setItems]=useState([]);
  const [statuses,setStatuses]=useState(DEFAULT_STATUSES.map(s=>({name:s,color:DEF_ST_COLORS[s]||"#94a3b8",isArchive:ARCHIVE_STATUSES.includes(s)})));
  const [view,setView]=useState("table");
  const [search,setSearch]=useState(""); const [fSt,setFSt]=useState("Всички"); const [fPr,setFPr]=useState("Всички"); const [fAs,setFAs]=useState("Всички");
  const [showArchive,setShowArchive]=useState(false);
  const [sortBy,setSortBy]=useState("dateAdded"); const [sortDir,setSortDir]=useState("desc");
  const [showForm,setShowForm]=useState(false); const [editItem,setEditItem]=useState(null);
  const [detailItem,setDetailItem]=useState(null);
  const [showStatusSettings,setShowStatusSettings]=useState(false);
  const [loading,setLoading]=useState(true); const [toast,setToast]=useState(null);
  const [dismissed,setDismissed]=useState([]); const [online,setOnline]=useState(true);

  const notify=msg=>setToast(msg);

  // ── Supabase load + realtime ─────────────────────────────────────────────
  useEffect(()=>{
    async function loadAll(){
      setLoading(true);
      try{
        const {data:rows,error}=await supabase.from("collaborations").select("*").order("created_at",{ascending:true});
        if(error) throw error;
        setItems((rows||[]).map(fromRow));
        const {data:stRow}=await supabase.from("settings").select("value").eq("key","statuses").single();
        if(stRow?.value) setStatuses(stRow.value);
        setOnline(true);
      }catch(err){
        console.error("Supabase грешка:", err);
        setOnline(false);
        notify("⚠️ Не може да се свърже с базата. Провери .env файла.");
      }
      setLoading(false);
    }
    loadAll();

    // Realtime subscriptions
    const ch=supabase.channel("dm_realtime")
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"collaborations"},payload=>{
        setItems(prev=>{if(prev.find(i=>i.id===payload.new.id)) return prev; return [...prev,fromRow(payload.new)];});
      })
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"collaborations"},payload=>{
        setItems(prev=>prev.map(i=>i.id===payload.new.id?fromRow(payload.new):i));
        setDetailItem(prev=>prev?.id===payload.new.id?fromRow(payload.new):prev);
      })
      .on("postgres_changes",{event:"DELETE",schema:"public",table:"collaborations"},payload=>{
        setItems(prev=>prev.filter(i=>i.id!==payload.old.id));
        setDetailItem(prev=>prev?.id===payload.old.id?null:prev);
      })
      .on("postgres_changes",{event:"*",schema:"public",table:"settings"},async()=>{
        const {data}=await supabase.from("settings").select("value").eq("key","statuses").single();
        if(data?.value) setStatuses(data.value);
      })
      .subscribe();

    return()=>supabase.removeChannel(ch);
  },[]);

  // ── CRUD ────────────────────────────────────────────────────────────────
  const handleSave=async form=>{
    const now=nowStr();
    if(form.id){
      const old=items.find(i=>i.id===form.id);
      const changes=[]; if(old.status!==form.status) changes.push(`статус → "${form.status}"`); if(old.priority!==form.priority) changes.push(`приоритет → "${form.priority}"`); if(old.assignee!==form.assignee) changes.push(`отговорник → "${form.assignee}"`);
      const hist=[...(old.history||[]),{user:form.assignee||"Екипът",action:"редактира",detail:changes.join(", ")||"обновен запис",at:now}];
      const updated={...form,history:hist,comments:old.comments||[],invoices:old.invoices||[]};
      setItems(prev=>prev.map(i=>i.id===form.id?updated:i));
      await supabase.from("collaborations").update(toRow(updated)).eq("id",form.id);
      notify("✅ Записано");
    } else {
      const newItem={...form,id:crypto.randomUUID(),dateAdded:new Date().toISOString().slice(0,10),history:[{user:form.assignee||"Екипът",action:"създаде записа",at:now}],comments:[],invoices:[],archived:false};
      setItems(prev=>[...prev,newItem]);
      await supabase.from("collaborations").insert(toRow(newItem));
      notify("✅ Добавено");
    }
    setShowForm(false); setEditItem(null);
  };

  const handleDelete=async id=>{
    setItems(prev=>prev.filter(i=>i.id!==id)); setDetailItem(null);
    await supabase.from("collaborations").delete().eq("id",id);
    notify("🗑️ Изтрито");
  };

  const handleArchive=async(id,arch)=>{
    const now=nowStr();
    setItems(prev=>prev.map(i=>{if(i.id!==id) return i; const u={...i,archived:arch,history:[...(i.history||[]),{user:"Екипът",action:arch?"архивиран":"разархивиран",at:now}]}; return u;}));
    const item=items.find(i=>i.id===id);
    if(item){const u={...item,archived:arch,history:[...(item.history||[]),{user:"Екипът",action:arch?"архивиран":"разархивиран",at:now}]}; await supabase.from("collaborations").update(toRow(u)).eq("id",id); if(detailItem?.id===id) setDetailItem(u);}
    notify(arch?"📦 Архивирано":"📤 Разархивирано");
  };

  const handleComment=async(id,comment)=>{
    const item=items.find(i=>i.id===id); if(!item) return;
    const updated={...item,comments:[...(item.comments||[]),comment],history:[...(item.history||[]),{user:comment.author,action:`коментира${comment.mentions?.length?` @${comment.mentions.join(", @")}`:""}: "${comment.text.slice(0,50)}"`,at:comment.at}]};
    setItems(prev=>prev.map(i=>i.id===id?updated:i));
    if(detailItem?.id===id) setDetailItem(updated);
    await supabase.from("collaborations").update(toRow(updated)).eq("id",id);
    notify("💬 Коментарът е добавен");
  };

  const handleStatusChange=async(id,newStatus)=>{
    const now=nowStr(); const item=items.find(i=>i.id===id); if(!item) return;
    const updated={...item,status:newStatus,history:[...(item.history||[]),{user:"Екипът",action:`преместен в "${newStatus}"`,at:now}]};
    setItems(prev=>prev.map(i=>i.id===id?updated:i));
    await supabase.from("collaborations").update(toRow(updated)).eq("id",id);
    notify(`🔄 ${newStatus}`);
  };

  const handleInvoiceUpdate=async(id,invs)=>{
    const item=items.find(i=>i.id===id); if(!item) return;
    const updated={...item,invoices:invs};
    setItems(prev=>prev.map(i=>i.id===id?updated:i));
    if(detailItem?.id===id) setDetailItem(updated);
    await supabase.from("collaborations").update(toRow(updated)).eq("id",id);
  };

  const handleDuplicate=async item=>{
    const now=nowStr(); const copy={...item,id:crypto.randomUUID(),brand:item.brand+" (копие)",status:"Нов",dateAdded:new Date().toISOString().slice(0,10),history:[{user:"Екипът",action:"дублиран от "+item.brand,at:now}],comments:[],invoices:[],archived:false};
    setItems(prev=>[...prev,copy]); setDetailItem(null);
    await supabase.from("collaborations").insert(toRow(copy));
    notify("⧉ Дублирано");
  };

  const handleSaveStatuses=async sts=>{
    setStatuses(sts); setShowStatusSettings(false);
    await supabase.from("settings").upsert({key:"statuses",value:sts,updated_at:new Date().toISOString()});
    notify("⚙️ Статусите са обновени");
  };

  const toggleSort=col=>{if(sortBy===col) setSortDir(d=>d==="asc"?"desc":"asc"); else{setSortBy(col);setSortDir("asc");}};

  const filtered=useMemo(()=>{
    let arr=items.filter(i=>{
      if(!showArchive&&i.archived) return false;
      if(showArchive&&!i.archived) return false;
      const q=search.toLowerCase();
      if(q&&!i.brand.toLowerCase().includes(q)&&!i.contact.toLowerCase().includes(q)&&!(i.tags||"").toLowerCase().includes(q)&&!(i.comments||[]).some(c=>c.text.toLowerCase().includes(q))) return false;
      if(fSt!=="Всички"&&i.status!==fSt) return false;
      if(fPr!=="Всички"&&i.priority!==fPr) return false;
      if(fAs!=="Всички"&&i.assignee!==fAs) return false;
      return true;
    });
    arr.sort((a,b)=>{let va=a[sortBy]??"",vb=b[sortBy]??""; if(sortBy==="value"||sortBy==="rating"){va=Number(va);vb=Number(vb);} const cmp=va<vb?-1:va>vb?1:0; return sortDir==="asc"?cmp:-cmp;});
    return arr;
  },[items,search,fSt,fPr,fAs,sortBy,sortDir,showArchive]);

  const activeItems=items.filter(i=>!i.archived);
  const archivedCount=items.filter(i=>i.archived).length;
  const bannerItems=activeItems.filter(i=>{const d=dl(i.deadline); return d!==null&&d>=0&&d<=7&&!statuses.find(s=>s.name===i.status)?.isArchive&&!dismissed.includes(i.id);});
  const totalRev=activeItems.filter(i=>i.status==="Активна").reduce((s,i)=>s+(Number(i.value)||0),0);
  const ss={...IS,width:"auto",fontSize:12,padding:"7px 10px"};
  const SH=({col,label})=>{const a=sortBy===col; return <th onClick={()=>toggleSort(col)} style={{padding:"10px 13px",textAlign:"left",fontSize:10,fontWeight:700,color:a?"#02a576":"#64748b",textTransform:"uppercase",letterSpacing:".06em",whiteSpace:"nowrap",cursor:"pointer",userSelect:"none"}}>{label}{a?(sortDir==="asc"?" ↑":" ↓"):""}</th>;};

  if(loading) return <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",fontFamily:"'DM Sans',sans-serif",flexDirection:"column",gap:12,color:"#02a576"}}><div style={{fontSize:32}}>🤝</div><div style={{fontWeight:700,fontSize:16}}>DietitianMED Partnerships</div><div style={{fontSize:13,color:"#64748b"}}>Свързване с базата данни...</div></div>;

  return <div style={{fontFamily:"'DM Sans','Segoe UI',sans-serif",background:"#f0fdf9",minHeight:"100vh",padding:20}}>
    {/* header */}
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:10}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <div style={{width:36,height:36,borderRadius:10,background:"#00383f",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>🤝</div>
        <div><span style={{fontSize:18,fontWeight:800,color:"#00383f",letterSpacing:"-.03em"}}>DietitianMED</span><span style={{fontSize:14,color:"#02a576",marginLeft:7,fontWeight:500}}>Partnerships</span></div>
        {!online&&<span style={{background:"#fee2e2",color:"#ef4444",borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:600}}>⚠️ Офлайн</span>}
        {online&&<span style={{background:"#dcfce7",color:"#166534",borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:600}}>🟢 Live</span>}
      </div>
      <div style={{display:"flex",gap:7,flexWrap:"wrap",alignItems:"center"}}>
        {[["dashboard","📊"],["table","⊞ Таблица"],["kanban","⊟ Kanban"],["brands","🏢 Брандове"],["attachments","📎 Файлове"],["activity","📡 Feed"],["monthly","📅 Месечен"],["quarterly","📈 Тримесечен"]].map(([v,l])=><button key={v} onClick={()=>setView(v)} style={{padding:"7px 12px",borderRadius:8,border:"1.5px solid",borderColor:view===v?"#02a576":"#d1fae5",background:view===v?"#00383f":"#fff",color:view===v?"#fff":"#00383f",cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:"inherit",transition:"all .15s"}}>{l}</button>)}
        <button onClick={()=>setShowStatusSettings(true)} title="Настройки" style={{padding:"7px 10px",borderRadius:8,border:"1.5px solid #d1fae5",background:"#fff",color:"#00383f",cursor:"pointer",fontSize:14}}>⚙️</button>
        <button onClick={()=>printReport(items,statuses)} style={{padding:"7px 12px",borderRadius:8,border:"1.5px solid #d1fae5",background:"#fff",color:"#00383f",cursor:"pointer",fontSize:12,fontFamily:"inherit"}}>🖨️ PDF</button>
        <button onClick={()=>exportCSV(filtered)} style={{padding:"7px 12px",borderRadius:8,border:"1.5px solid #d1fae5",background:"#fff",color:"#00383f",cursor:"pointer",fontSize:12,fontFamily:"inherit"}}>⬇️ CSV</button>
        <button onClick={()=>{setEditItem(null);setShowForm(true);}} style={{padding:"7px 16px",borderRadius:8,border:"none",background:"#02a576",color:"#fff",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"inherit",boxShadow:"0 2px 8px rgba(2,165,118,.35)"}}>+ Нова</button>
      </div>
    </div>

    {bannerItems.length>0&&<div style={{background:"#fff7ed",border:"1.5px solid #fed7aa",borderRadius:10,padding:"10px 14px",marginBottom:12}}><div style={{fontSize:12,fontWeight:700,color:"#c2410c",marginBottom:5}}>⏰ Изтичащи deadlines</div>{bannerItems.map(i=>{const d=dl(i.deadline); return <div key={i.id} style={{display:"flex",alignItems:"center",gap:8,fontSize:12,marginBottom:2}}><span style={{color:"#ea580c",fontWeight:600}}>{i.brand}</span><span style={{color:"#9a3412"}}>— {d===0?"днес!":d===1?"утре":`${d} дни`}</span><button onClick={()=>setDismissed(p=>[...p,i.id])} style={{marginLeft:"auto",background:"none",border:"none",cursor:"pointer",color:"#9a3412",fontSize:15,lineHeight:1}}>×</button></div>;})}
    </div>}

    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(110px,1fr))",gap:10,marginBottom:14}}>{[["Общо",activeItems.length],["Активни",activeItems.filter(i=>i.status==="Активна").length],["В преговори",activeItems.filter(i=>i.status==="В преговори").length],["Изтичат",activeItems.filter(i=>{const d=dl(i.deadline); return d!==null&&d>=0&&d<=14;}).length],["€/мес",`€${totalRev}`],["Архив",archivedCount]].map(([l,v])=><div key={l} style={{background:"#fff",borderRadius:10,padding:"11px 14px",border:"1.5px solid #d1fae5"}}><div style={{fontSize:10,color:"#02a576",fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",marginBottom:2}}>{l}</div><div style={{fontSize:19,fontWeight:800,color:"#00383f"}}>{v}</div></div>)}</div>

    {view!=="dashboard"&&view!=="activity"&&view!=="monthly"&&view!=="quarterly"&&view!=="brands"&&view!=="attachments"&&<div style={{background:"#fff",borderRadius:10,padding:"10px 13px",marginBottom:12,border:"1.5px solid #d1fae5",display:"flex",flexWrap:"wrap",gap:7,alignItems:"center"}}>
      <input style={{...ss,width:200}} placeholder="🔍 Търси бранд, контакт, таг, коментар..." value={search} onChange={e=>setSearch(e.target.value)}/>
      <select style={ss} value={fSt} onChange={e=>setFSt(e.target.value)}>{["Всички",...statuses.map(s=>s.name)].map(o=><option key={o}>{o}</option>)}</select>
      <select style={ss} value={fPr} onChange={e=>setFPr(e.target.value)}>{["Всички",...PRIORITIES].map(o=><option key={o}>{o}</option>)}</select>
      <select style={ss} value={fAs} onChange={e=>setFAs(e.target.value)}>{["Всички",...TEAM].map(o=><option key={o}>{o}</option>)}</select>
      <button onClick={()=>setShowArchive(a=>!a)} style={{...ss,background:showArchive?"#00383f":"#fff",color:showArchive?"#fff":"#00383f",border:"1.5px solid #d1fae5",cursor:"pointer"}}>📦 {showArchive?"Активни":"Архив"}</button>
      {(search||fSt!=="Всички"||fPr!=="Всички"||fAs!=="Всички")&&<button onClick={()=>{setSearch("");setFSt("Всички");setFPr("Всички");setFAs("Всички");}} style={{...ss,background:"#fff5f5",color:"#ef4444",border:"1.5px solid #fee2e2",cursor:"pointer"}}>× Изчисти</button>}
      <span style={{marginLeft:"auto",fontSize:11,color:"#02a576",fontWeight:600}}>{filtered.length} резултата</span>
    </div>}

    {view==="dashboard"&&<Dashboard items={items} statuses={statuses}/>}
    {view==="kanban"&&<Kanban items={filtered} statuses={statuses} onOpen={setDetailItem} onStatusChange={handleStatusChange}/>}
    {view==="brands"&&<BrandGroupView items={items} statuses={statuses} onOpen={setDetailItem}/>}
    {view==="attachments"&&<AttachmentsGallery items={items} onOpen={setDetailItem}/>}
    {view==="activity"&&<div style={{background:"#fff",borderRadius:12,border:"1.5px solid #d1fae5",overflow:"hidden"}}><div style={{padding:"14px 16px",borderBottom:"1.5px solid #e6f7f2",fontSize:14,fontWeight:700,color:"#00383f"}}>📡 Activity Feed</div><ActivityFeed items={items}/></div>}
    {view==="monthly"&&<div style={{background:"#fff",borderRadius:12,border:"1.5px solid #d1fae5",padding:20}}><div style={{fontSize:14,fontWeight:700,color:"#00383f",marginBottom:16}}>📅 Месечен отчет</div><MonthlySummary items={items}/></div>}
    {view==="quarterly"&&<div style={{background:"#fff",borderRadius:12,border:"1.5px solid #d1fae5",padding:20}}><div style={{fontSize:14,fontWeight:700,color:"#00383f",marginBottom:16}}>📈 Тримесечно сравнение</div><QuarterlyComparison items={items}/></div>}
    {view==="table"&&<div style={{background:"#fff",borderRadius:11,border:"1.5px solid #d1fae5",overflow:"hidden"}}>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
        <thead><tr style={{background:"#f0fdf9",borderBottom:"1.5px solid #d1fae5"}}>
          <SH col="brand" label="Бранд"/><SH col="status" label="Статус"/>
          <th style={{padding:"10px 13px",fontSize:10,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:".06em"}}>Пр.</th>
          <SH col="theyOffer" label="Те предлагат"/><SH col="weOffer" label="Ние предлагаме"/>
          <SH col="value" label="€/мес"/><SH col="deadline" label="Deadline"/>
          <SH col="assignee" label="Отг."/><SH col="rating" label="★"/>
          <th style={{padding:"10px 13px",fontSize:10,fontWeight:700,color:"#64748b",textTransform:"uppercase"}}>🧾</th>
          <th style={{padding:"10px 13px",fontSize:10,fontWeight:700,color:"#64748b",textTransform:"uppercase"}}>💬</th>
          <th/>
        </tr></thead>
        <tbody>
          {!filtered.length&&<tr><td colSpan={12} style={{padding:36,textAlign:"center",color:"#94a3b8"}}>Няма резултати</td></tr>}
          {filtered.map(item=>{
            const d=dl(item.deadline); const overdueInvs=(item.invoices||[]).filter(inv=>inv.status!=="Платена"&&inv.dueDate&&dl(inv.dueDate)<0).length;
            const stColor=statuses.find(s=>s.name===item.status)?.color||DEF_ST_COLORS[item.status]||"#94a3b8";
            return <tr key={item.id} style={{borderBottom:"1px solid #f0fdf9",cursor:"pointer",transition:"background .1s",opacity:item.archived?.6:1}} onMouseEnter={e=>e.currentTarget.style.background="#f8fffe"} onMouseLeave={e=>e.currentTarget.style.background=""} onClick={()=>setDetailItem(item)}>
              <td style={{padding:"10px 13px"}}><div style={{display:"flex",alignItems:"center",gap:8}}><Av name={item.brand} size={26}/><div><div style={{fontWeight:700,color:"#00383f"}}>{item.brand}{item.archived&&<span style={{fontSize:9,background:"#f1f5f9",color:"#64748b",borderRadius:4,padding:"1px 5px",marginLeft:5}}>архив</span>}</div>{item.category&&<div style={{fontSize:10,color:"#64748b"}}>{item.category}</div>}{(item.tags||"").split(",").filter(t=>t.trim()).slice(0,2).map(t=><span key={t} style={{fontSize:9,background:"#e6f7f2",color:"#00383f",borderRadius:4,padding:"1px 5px",marginRight:3}}>{t.trim()}</span>)}</div></div></td>
              <td style={{padding:"10px 13px"}}><Badge status={item.status} color={stColor}/></td>
              <td style={{padding:"10px 13px"}}><span style={{width:9,height:9,borderRadius:"50%",background:PC[item.priority],display:"inline-block"}} title={item.priority}/></td>
              <td style={{padding:"10px 13px",color:"#475569",maxWidth:130}}><div style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.theyOffer||"—"}</div></td>
              <td style={{padding:"10px 13px",color:"#475569",maxWidth:130}}><div style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.weOffer||"—"}</div></td>
              <td style={{padding:"10px 13px",fontWeight:700,color:"#02a576",whiteSpace:"nowrap"}}>{item.value?`€${item.value}`:"—"}</td>
              <td style={{padding:"10px 13px",whiteSpace:"nowrap",color:d!==null&&d<7&&d>=0?"#ef4444":"#00383f"}}>{item.deadline?new Date(item.deadline).toLocaleDateString("bg-BG"):"—"}{d!==null&&d>=0&&d<14&&<div style={{fontSize:9,color:d<7?"#ef4444":"#f59e0b"}}>{d} дни</div>}</td>
              <td style={{padding:"10px 13px"}}>{item.assignee?<div style={{display:"flex",alignItems:"center",gap:5}}><Av name={item.assignee} size={19}/><span style={{fontSize:11,color:"#00383f"}}>{item.assignee}</span></div>:"—"}</td>
              <td style={{padding:"10px 13px",color:"#f59e0b",fontSize:11}}>{item.rating>0?"★".repeat(item.rating):""}</td>
              <td style={{padding:"10px 13px",fontSize:11}}>{item.invoices?.length>0&&<span style={{color:overdueInvs>0?"#ef4444":"#02a576",fontWeight:600}}>{item.invoices.length}{overdueInvs>0&&" ⚠️"}</span>}</td>
              <td style={{padding:"10px 13px",color:"#64748b",fontSize:11}}>{item.comments?.length>0?item.comments.length:""}</td>
              <td style={{padding:"10px 13px"}}><button onClick={e=>{e.stopPropagation();setEditItem(item);setShowForm(true);}} style={{background:"none",border:"1.5px solid #d1fae5",borderRadius:6,width:26,height:26,cursor:"pointer",fontSize:12,display:"flex",alignItems:"center",justifyContent:"center"}}>✏️</button></td>
            </tr>;
          })}
        </tbody>
      </table>
    </div>}

    {showForm&&<Modal onClose={()=>{setShowForm(false);setEditItem(null);}}><Form initial={editItem} onSave={handleSave} onCancel={()=>{setShowForm(false);setEditItem(null);}} statuses={statuses}/></Modal>}
    {detailItem&&!showForm&&<Modal onClose={()=>setDetailItem(null)} wide><Detail item={detailItem} onClose={()=>setDetailItem(null)} onEdit={()=>{setEditItem(detailItem);setDetailItem(null);setShowForm(true);}} onDelete={handleDelete} onComment={handleComment} onDuplicate={()=>handleDuplicate(detailItem)} onInvoiceUpdate={handleInvoiceUpdate} onArchive={handleArchive} notify={notify} allItems={items} statuses={statuses}/></Modal>}
    {showStatusSettings&&<Modal onClose={()=>setShowStatusSettings(false)}><StatusSettings statuses={statuses} onSave={handleSaveStatuses} onClose={()=>setShowStatusSettings(false)}/></Modal>}
    {toast&&<Toast msg={toast} onDone={()=>setToast(null)}/>}
  </div>;
}
