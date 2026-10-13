import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity, AlertCircle, AlertTriangle, ArrowDownRight, ArrowUpRight, BadgeCheck, Banknote,
  Bell, Bot, BriefcaseBusiness, Check, CheckCircle2, ChevronDown, ChevronRight, CircleDollarSign,
  Clock3, Command, CreditCard, FileCheck2, FileClock, Filter, Gauge, HandCoins, LayoutDashboard,
  LifeBuoy, ListChecks, LockKeyhole, Menu, MessageSquareText, MoreHorizontal, Plus, RefreshCw,
  Search, Send, ShieldAlert, ShieldCheck, Sparkles, Target, TrendingUp, Wallet, X, Zap
} from 'lucide-react';
import {
  Area, AreaChart, CartesianGrid, Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis
} from 'recharts';
import './styles.css';

const API = 'http://127.0.0.1:8000/api';
const currency = (n) => new Intl.NumberFormat('en-US', {style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(n||0));
const compact = (n) => { const v=Number(n||0); return v>=1e6?`$${(v/1e6).toFixed(1)}m`:v>=1e3?`$${(v/1e3).toFixed(0)}k`:currency(v); };
const dateLabel = (d) => d ? new Date(`${d}T12:00:00`).toLocaleDateString('en-US',{month:'short',day:'numeric'}) : '—';
const severityClass = (s='') => s.toLowerCase();
const navItems = [
  {id:'overview',label:'Command center',icon:LayoutDashboard,section:'WORKSPACE'},
  {id:'exceptions',label:'Exception workbench',icon:ShieldAlert,section:'WORKSPACE',pill:'Queue'},
  {id:'receivables',label:'Cash & receivables',icon:Wallet,section:'FINANCE'},
  {id:'settlements',label:'Carrier settlements',icon:Banknote,section:'FINANCE'},
  {id:'commissions',label:'Commissions',icon:HandCoins,section:'FINANCE'},
  {id:'policies',label:'Policies & premiums',icon:FileCheck2,section:'FINANCE'},
  {id:'pipeline',label:'Proposal pipeline',icon:BriefcaseBusiness,section:'FINANCE'},
  {id:'copilot',label:'Finance copilot',icon:Sparkles,section:'INTELLIGENCE'},
  {id:'audit',label:'Audit trail',icon:LockKeyhole,section:'GOVERNANCE'}
];

function App(){
  const [page,setPage]=useState('overview');
  const [dash,setDash]=useState(null);
  const [exceptions,setExceptions]=useState([]);
  const [alerts,setAlerts]=useState([]);
  const [audit,setAudit]=useState([]);
  const [records,setRecords]=useState([]);
  const [toast,setToast]=useState(null);
  const [busy,setBusy]=useState(false);
  const [query,setQuery]=useState('');
  const [filter,setFilter]=useState('All');
  const [question,setQuestion]=useState('');
  const [copilot,setCopilot]=useState(null);
  const [health,setHealth]=useState('checking');
  const [showNew,setShowNew]=useState(false);
  const [newTxn,setNewTxn]=useState({kind:'Receipt',external_ref:'',entity:'',amount:'',status:'Unapplied',due_date:'2026-10-20',owner:'Finance Ops',agency:'Demo Agency',description:''});
  const [duplicateCheck,setDuplicateCheck]=useState(null);
  const [showAlerts,setShowAlerts]=useState(false);

  const notify=(message,type='success')=>{setToast({message,type});setTimeout(()=>setToast(null),4000)};
  async function api(path, options={}){
    const res=await fetch(`${API}${path}`,{headers:{'Content-Type':'application/json',...(options.headers||{})},...options});
    const data=await res.json().catch(()=>({}));
    if(!res.ok){const detail=data.detail;throw new Error(typeof detail==='string'?detail:detail?.message||data.message||`Request failed (${res.status})`)}
    return data;
  }
  async function refreshAll(){
    try{
      setBusy(true);
      const [h,d,e,a,au]=await Promise.all([api('/health'),api('/dashboard'),api('/exceptions'),api('/alerts'),api('/audit')]);
      setHealth(h.ok?'online':'offline');setDash(d);setExceptions(e);setAlerts(a);setAudit(au);
      if(['receivables','settlements','commissions','policies','pipeline'].includes(page)){
        const map={receivables:'receivables',settlements:'settlements',commissions:'commissions',policies:'policies',pipeline:'pipeline'};
        setRecords(await api(`/records/${map[page]}`));
      }
    }catch(err){setHealth('offline');notify(`Cannot connect to API: ${err.message}. Start the backend terminal.`, 'error')}
    finally{setBusy(false)}
  }
  useEffect(()=>{refreshAll()},[]);
  useEffect(()=>{if(['receivables','settlements','commissions','policies','pipeline'].includes(page)){api(`/records/${page==='receivables'?'receivables':page}`).then(setRecords).catch(()=>{})}},[page]);
  const openExceptions=exceptions.filter(e=>!['Resolved','Closed'].includes(e.status));
  const activeAlerts=alerts.filter(a=>a.status==='Active');
  const currentNav=navItems.find(n=>n.id===page)?.label||'Command center';
  const filteredExceptions=useMemo(()=>openExceptions.filter(e=>(filter==='All'||e.severity===filter||e.status===filter)&&`${e.title} ${e.category} ${e.owner} ${e.status}`.toLowerCase().includes(query.toLowerCase())),[openExceptions,filter,query]);
  const recordTitles={receivables:'Cash & receivables',settlements:'Carrier settlements',commissions:'Producer commissions',policies:'Policies & premiums',pipeline:'Proposal pipeline'};
  const recordMeta={
    receivables:{desc:'Trace cash received, unapplied funds and overdue receivables.',icon:Wallet,accent:'blue'},
    settlements:{desc:'Track statement approval, settlement cut-offs and carrier exposure.',icon:Banknote,accent:'violet'},
    commissions:{desc:'Review producer compensation and protect commission margin.',icon:HandCoins,accent:'rose'},
    policies:{desc:'Monitor premium due dates and cancellation-risk exposure.',icon:FileCheck2,accent:'amber'},
    pipeline:{desc:'See quoted opportunities and expected commission value.',icon:Target,accent:'blue'}
  };
  async function action(path, successText){
    try{const r=await api(path,{method:'POST'});notify(r.message||successText);await refreshAll();if(page!=='overview'&&['receivables','settlements','commissions','policies','pipeline'].includes(page))setRecords(await api(`/records/${page}`))}
    catch(e){notify(e.message,'error')}
  }
  async function askCopilot(q=question){
    if(!q.trim())return;
    setQuestion(q);
    try{const result=await api('/copilot',{method:'POST',body:JSON.stringify({question:q})});setCopilot(result)}
    catch(e){notify(e.message,'error')}
  }
  async function checkDuplicate(){
    if(!newTxn.external_ref||!newTxn.entity||newTxn.amount===''){notify('Enter reference, entity and amount to check duplicates.','error');return}
    try{
      const params=new URLSearchParams({external_ref:newTxn.external_ref,kind:newTxn.kind,entity:newTxn.entity,amount:newTxn.amount,due_date:newTxn.due_date||''});
      setDuplicateCheck(await api(`/duplicates/check?${params.toString()}`));
    }catch(e){notify(e.message,'error')}
  }
  async function addTransaction(e){
    e.preventDefault();
    try{
      const result=await api('/transactions',{method:'POST',body:JSON.stringify({...newTxn,amount:Number(newTxn.amount)})});
      notify(result.message);setShowNew(false);setDuplicateCheck(null);setNewTxn({...newTxn,external_ref:'',entity:'',amount:'',description:''});await refreshAll();
    }catch(err){notify(err.message,'error')}
  }

  if(!dash && health==='checking') return <div className="loading"><div className="brand-mark"><Command size={24}/></div><div className="loading-title">AI_HUB</div><p>Connecting to finance workspace…</p></div>;

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Command size={21}/></div><div><div className="brand-name">AI<span>_</span>HUB</div><div className="brand-sub">FINANCE INTELLIGENCE</div></div></div>
      <div className="workspace-switch"><div className="workspace-avatar">M</div><div className="workspace-text"><strong>Meridian Brokerage</strong><span>Finance workspace</span></div><ChevronDown size={15}/></div>
      {['WORKSPACE','FINANCE','INTELLIGENCE','GOVERNANCE'].map(section=><div className="nav-section" key={section}><div className="nav-caption">{section}</div>{navItems.filter(n=>n.section===section).map(n=><button key={n.id} className={`nav-item ${page===n.id?'active':''}`} onClick={()=>setPage(n.id)}><n.icon size={18}/><span>{n.label}</span>{n.id==='exceptions'&&openExceptions.length>0?<span className="nav-count">{openExceptions.length}</span>:n.id==='copilot'?<span className="nav-spark"><Sparkles size={12}/></span>:null}</button>)}</div>)}
      <div className="sidebar-bottom"><div className="control-card"><div className="control-icon"><ShieldCheck size={17}/></div><div><strong>Controls active</strong><span>Approval guardrails enabled</span></div><span className="green-dot"/></div><div className="profile-row"><div className="profile-avatar">FO</div><div className="profile-info"><strong>Finance Operations</strong><span>Demo administrator</span></div><MoreHorizontal size={18}/></div></div>
    </aside>

    <main className="main">
      <header className="topbar"><div className="breadcrumb"><span>Meridian</span><ChevronRight size={14}/><strong>{currentNav}</strong></div><div className="top-actions"><div className={`connection ${health}`}><span className="pulse-dot"/>{health==='online'?'Database connected':'API offline'}</div><button className="icon-button" title="Alerts" onClick={()=>setShowAlerts(!showAlerts)}><Bell size={18}/>{activeAlerts.length>0&&<i className="alert-dot"/>}</button><button className="icon-button" title="Refresh data" onClick={refreshAll}><RefreshCw size={17} className={busy?'spin':''}/></button><div className="top-avatar">FO</div></div></header>

      {showAlerts&&<div className="alert-popover"><div className="popover-head"><div><strong>Alert center</strong><span>{activeAlerts.length} active items</span></div><button className="plain-icon" onClick={()=>setShowAlerts(false)}><X size={17}/></button></div>{alerts.length===0?<div className="empty-state">No alerts right now.</div>:alerts.slice(0,5).map(a=><div className="alert-pop-item" key={a.id}><span className={`severity-dot ${severityClass(a.severity)}`}/><div className="alert-pop-copy"><strong>{a.title}</strong><span>{a.message}</span></div>{a.status==='Active'&&<button className="mini-action" onClick={()=>action(`/alerts/${a.id}/acknowledge`,'Alert acknowledged')}>Ack</button>}</div>)}</div>}

      <div className="content">
        {health==='offline'&&<div className="offline-banner"><AlertCircle size={18}/><div><strong>Backend connection unavailable</strong><span>Start the FastAPI server in the backend terminal, then press refresh. Charts and actions use live SQLite data.</span></div><button className="button button-dark small" onClick={refreshAll}>Retry connection</button></div>}

        {page==='overview'&&dash&&<Overview dash={dash} onGo={setPage} onAction={action} onAlerts={()=>setShowAlerts(true)}/>}
        {page==='exceptions'&&<section>
          <PageHeading eyebrow="CONTROL & RESOLUTION" title="Exception workbench" subtitle="Prioritise material finance risk, assign ownership and move issues through a controlled resolution path." right={<button className="button button-primary" onClick={()=>setShowNew(true)}><Plus size={16}/> Add transaction</button>}/>
          <div className="stat-strip"><MiniStat label="Open queue" value={openExceptions.length} icon={ListChecks}/><MiniStat label="Critical exposure" value={currency(openExceptions.filter(x=>x.severity==='Critical').reduce((a,b)=>a+b.amount,0))} icon={ShieldAlert}/><MiniStat label="Escalated" value={openExceptions.filter(x=>x.status==='Escalated').length} icon={ArrowUpRight}/><MiniStat label="Active alerts" value={activeAlerts.length} icon={Bell}/></div>
          <div className="toolbar"><div className="search-box"><Search size={16}/><input placeholder="Search exceptions, owners, categories…" value={query} onChange={e=>setQuery(e.target.value)}/></div><select value={filter} onChange={e=>setFilter(e.target.value)}><option>All</option><option>Critical</option><option>High</option><option>Medium</option><option>Low</option><option>Escalated</option><option>Open</option></select><span className="result-count">{filteredExceptions.length} items</span></div>
          <div className="exception-list">{filteredExceptions.map(e=><ExceptionCard key={e.id} item={e} onEscalate={()=>action(`/exceptions/${e.id}/escalate`)} onResolve={()=>action(`/exceptions/${e.id}/resolve`)}/>)}
            {filteredExceptions.length===0&&<div className="empty-state large"><CheckCircle2 size={30}/><strong>No matching open exceptions</strong><span>Change the filters or add a transaction for the demo.</span></div>}</div>
        </section>}

        {recordTitles[page]&&<RecordPage page={page} records={records} meta={recordMeta[page]} title={recordTitles[page]} onAdd={()=>setShowNew(true)} query={query} setQuery={setQuery}/>}
        {page==='copilot'&&<Copilot question={question} setQuestion={setQuestion} result={copilot} onAsk={askCopilot} dash={dash}/>}
        {page==='audit'&&<section><PageHeading eyebrow="GOVERNANCE & TRACEABILITY" title="Audit trail" subtitle="Every workflow action and copilot request leaves a timestamped trace for review." right={<span className="soft-pill"><LockKeyhole size={14}/> Append-only demo log</span>}/><div className="panel audit-panel"><div className="panel-heading"><div><h3>Recent activity</h3><p>Latest 100 recorded events from SQLite</p></div><span className="count-pill">{audit.length} events</span></div><div className="table-wrap"><table><thead><tr><th>Event</th><th>Target</th><th>Actor</th><th>Details</th><th>Timestamp</th></tr></thead><tbody>{audit.map(a=><tr key={a.id}><td><span className="event-chip">{a.action.replaceAll('_',' ')}</span></td><td className="mono">{a.target}</td><td>{a.actor}</td><td className="detail-cell">{a.detail}</td><td className="date-cell">{new Date(a.created_at).toLocaleString()}</td></tr>)}</tbody></table></div>{audit.length===0&&<div className="empty-state">No audit activity yet.</div>}</div></section>}
      </div>
      <footer className="footer"><span><span className="footer-dot"/> AI_HUB Finance Intelligence</span><span>Demo environment · Synthetic data only · Human approval required for money movement</span></footer>
    </main>

    {toast&&<div className={`toast ${toast.type}`}><span>{toast.type==='error'?<AlertCircle size={18}/>:<CheckCircle2 size={18}/>}</span>{toast.message}<button onClick={()=>setToast(null)}><X size={15}/></button></div>}
    {showNew&&<div className="modal-backdrop" onClick={()=>setShowNew(false)}><div className="modal" onClick={e=>e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">DATA QUALITY CONTROL</span><h2>Add finance transaction</h2><p>Duplicate references and matching fingerprints are blocked before insert.</p></div><button className="plain-icon" onClick={()=>setShowNew(false)}><X size={19}/></button></div>
      <form onSubmit={addTransaction} className="txn-form">
        <label>Transaction type<select value={newTxn.kind} onChange={e=>setNewTxn({...newTxn,kind:e.target.value})}><option>Receipt</option><option>Carrier payable</option><option>Commission</option><option>Receivable</option><option>Policy premium</option><option>Proposal</option></select></label>
        <label>External reference<input required value={newTxn.external_ref} onChange={e=>{setNewTxn({...newTxn,external_ref:e.target.value});setDuplicateCheck(null)}} placeholder="e.g. RCPT-10485"/></label>
        <label>Entity / counterparty<input required value={newTxn.entity} onChange={e=>setNewTxn({...newTxn,entity:e.target.value})} placeholder="Company, carrier or producer"/></label>
        <div className="form-grid"><label>Amount (USD)<input required type="number" min="0" step="0.01" value={newTxn.amount} onChange={e=>setNewTxn({...newTxn,amount:e.target.value})} placeholder="0.00"/></label><label>Due date<input type="date" value={newTxn.due_date} onChange={e=>setNewTxn({...newTxn,due_date:e.target.value})}/></label></div>
        <div className="form-grid"><label>Status<select value={newTxn.status} onChange={e=>setNewTxn({...newTxn,status:e.target.value})}><option>Unapplied</option><option>Open</option><option>Pending approval</option><option>At risk</option><option>Approved</option><option>Quoted</option><option>Settled</option></select></label><label>Owner<input value={newTxn.owner} onChange={e=>setNewTxn({...newTxn,owner:e.target.value})}/></label></div>
        <label>Description<input value={newTxn.description} onChange={e=>setNewTxn({...newTxn,description:e.target.value})} placeholder="Optional context"/></label>
        {duplicateCheck&&<div className={`duplicate-result ${duplicateCheck.duplicate?'blocked':'clear'}`}>{duplicateCheck.duplicate?<><AlertTriangle size={18}/><div><strong>Possible duplicate found — insertion will be blocked</strong><span>Existing ref: {duplicateCheck.existing?.external_ref} · {duplicateCheck.existing?.entity} · {currency(duplicateCheck.existing?.amount)}</span></div></>:<><CheckCircle2 size={18}/><div><strong>No duplicate found</strong><span>Current candidate can be submitted.</span></div></>}</div>}
        <div className="modal-actions"><button type="button" className="button button-ghost" onClick={checkDuplicate}><Search size={15}/> Check duplicate</button><button type="submit" className="button button-primary" disabled={!!duplicateCheck?.duplicate}><Plus size={16}/> Add to database</button></div>
        <p className="form-footnote"><LockKeyhole size={13}/> Duplicate protection also runs server-side at submission; no duplicate record will be inserted.</p>
      </form>
    </div></div>}
  </div>
}

function PageHeading({eyebrow,title,subtitle,right}){return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{subtitle}</p></div>{right&&<div className="heading-right">{right}</div>}</div>}
function MiniStat({label,value,icon:Icon}){return <div className="mini-stat"><div className="mini-stat-icon"><Icon size={17}/></div><div><span>{label}</span><strong>{value}</strong></div></div>}
function MetricCard({item,icon:Icon,change}){return <div className={`metric-card ${item.tone}`}><div className="metric-top"><div className="metric-icon"><Icon size={18}/></div><span className="metric-period">MONTH TO DATE</span></div><div className="metric-value">{currency(item.value)}</div><div className="metric-label">{item.label}</div><div className="metric-bottom"><span>{item.detail}</span>{change&&<span className="trend-up"><ArrowUpRight size={13}/>{change}</span>}</div></div>}
function Overview({dash,onGo,onAction,onAlerts}){
  const k=dash.kpis||[];
  const icons=[Wallet,HandCoins,Banknote,CircleDollarSign];
  const colors=['#4b83f3','#e6a23c','#9571f5','#ec7391'];
  const pie=(dash.journeys||[]).map((x,i)=>({...x,fill:colors[i%colors.length]}));
  const bar=(dash.journeys||[]).map(x=>({name:x.name.replace('Carrier payable','Carrier payables').replace('Policy premium','Premiums'),amount:x.amount}));
  return <section>
    <PageHeading eyebrow="TUESDAY, OCTOBER 13 · CFO OVERVIEW" title="Good evening, Finance team." subtitle="Your finance operations at a glance. Here is where cash, commission and settlement risk need attention." right={<div className="date-chip"><Activity size={15}/><span>Live finance snapshot</span><span className="live-pulse"/></div>}/>
    <div className="hero-banner"><div className="hero-orb orb-one"/><div className="hero-orb orb-two"/><div className="hero-content"><div className="hero-tag"><Sparkles size={14}/> CFO INTELLIGENCE BRIEF</div><h2>Protect cash. Preserve margin.<br/><span>Close with confidence.</span></h2><p>{dash.risk.critical} critical exceptions and {dash.risk.active_alerts} active alerts are competing for attention. Start with the items nearest their financial cut-off.</p><button className="button button-white" onClick={()=>onGo('exceptions')}>Review priority queue <ChevronRight size={16}/></button></div><div className="hero-visual"><div className="orbit orbit-a"/><div className="orbit orbit-b"/><div className="hero-core"><Gauge size={34}/></div><div className="float-card float-card-a"><span className="float-dot orange"/><div><small>Exposure watch</small><strong>{currency(dash.risk.overdue_exposure)}</strong></div></div><div className="float-card float-card-b"><span className="float-dot green"/><div><small>Records monitored</small><strong>{dash.record_count} transactions</strong></div></div></div></div>
    <div className="metric-grid">{k.map((item,i)=><MetricCard key={item.label} item={item} icon={icons[i]||CircleDollarSign} change={i===0?'+8.4%':null}/>)}</div>
    <div className="section-row"><div><h2>Finance performance</h2><p>All metrics are calculated from the shared SQLite records.</p></div><span className="updated"><span className="green-dot"/> Updated just now</span></div>
    <div className="chart-grid">
      <div className="panel chart-panel wide-chart"><div className="panel-heading"><div><h3>Operating trend</h3><p>Illustrative six-month movement · based on current demo portfolio</p></div><span className="legend-chip"><i className="legend-blue"/> Cash received <i className="legend-purple"/> Carrier payables</span></div><div className="chart-box"><ResponsiveContainer width="100%" height="100%"><AreaChart data={dash.trend} margin={{top:10,right:8,left:0,bottom:0}}><defs><linearGradient id="cashFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4b83f3" stopOpacity={0.2}/><stop offset="95%" stopColor="#4b83f3" stopOpacity={0}/></linearGradient><linearGradient id="payFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a78bfa" stopOpacity={0.2}/><stop offset="95%" stopColor="#a78bfa" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 4" vertical={false} stroke="#edf0f5"/><XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill:'#8a93a5',fontSize:12}} dy={8}/><YAxis axisLine={false} tickLine={false} tickFormatter={compact} tick={{fill:'#8a93a5',fontSize:11}} width={58}/><Tooltip formatter={(v)=>currency(v)} contentStyle={{border:'1px solid #e8edf5',borderRadius:12,boxShadow:'0 8px 28px #14213d12'}}/><Area type="monotone" dataKey="cash" name="Cash received" stroke="#4b83f3" strokeWidth={2.6} fill="url(#cashFill)"/><Area type="monotone" dataKey="payables" name="Carrier payables" stroke="#9b87f5" strokeWidth={2.6} fill="url(#payFill)"/></AreaChart></ResponsiveContainer></div></div>
      <div className="panel chart-panel"><div className="panel-heading"><div><h3>Exposure by journey</h3><p>Recorded amount by transaction type</p></div><button className="plain-icon" onClick={()=>onGo('receivables')}><ChevronRight size={17}/></button></div><div className="donut-wrap"><div className="donut-chart"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={pie} dataKey="amount" nameKey="name" innerRadius={65} outerRadius={91} paddingAngle={3} stroke="none">{pie.map((p,i)=><Cell key={p.name} fill={p.fill}/>)}</Pie><Tooltip formatter={v=>currency(v)}/></PieChart></ResponsiveContainer><div className="donut-center"><span>Total records</span><strong>{dash.record_count}</strong><small>transactions</small></div></div><div className="donut-legend">{pie.map(p=><div key={p.name}><i style={{background:p.fill}}/><span>{p.name}</span><strong>{compact(p.amount)}</strong></div>)}</div></div></div>
    </div>
    <div className="lower-grid">
      <div className="panel"><div className="panel-heading"><div><h3>Priority exceptions</h3><p>Highest severity and nearest due date</p></div><button className="text-action" onClick={()=>onGo('exceptions')}>View workbench <ChevronRight size={14}/></button></div><div className="priority-list">{(dash.exceptions||[]).slice(0,4).map(e=><div className="priority-item" key={e.id}><div className={`priority-symbol ${severityClass(e.severity)}`}>{e.severity==='Critical'?<AlertTriangle size={16}/>:<AlertCircle size={16}/>}</div><div className="priority-copy"><strong>{e.title}</strong><span>{e.owner} · Due {dateLabel(e.due_date)}</span></div><div className="priority-amount">{e.amount?currency(e.amount):'—'}<span className={`status-text ${severityClass(e.severity)}`}>{e.severity}</span></div><button className="row-arrow" onClick={()=>onGo('exceptions')}><ChevronRight size={16}/></button></div>)}</div></div>
      <div className="panel alert-panel"><div className="panel-heading"><div><h3>Needs attention</h3><p>Live operational alerts</p></div><button className="count-pill" onClick={onAlerts}>{dash.risk.active_alerts} active</button></div><div className="alert-list">{(dash.alerts||[]).slice(0,4).map(a=><div className="alert-item" key={a.id}><div className={`alert-icon ${severityClass(a.severity)}`}>{a.severity==='Critical'?<AlertTriangle size={16}/>:<Bell size={16}/>}</div><div className="alert-copy"><strong>{a.title}</strong><span>{a.message}</span><small>{a.source}</small></div></div>)}</div><button className="button button-ghost full-width" onClick={onAlerts}>Open alert center <ChevronRight size={15}/></button></div>
    </div>
    <div className="guardrail-note"><div><ShieldCheck size={18}/></div><p><strong>Control-first by design.</strong> AI_HUB recommends and records workflow actions; payments, ledger postings and policy-impacting decisions remain subject to human approval.</p><span>CONTROL STATUS: ON</span></div>
  </section>
}
function ExceptionCard({item,onEscalate,onResolve}){
  return <div className={`exception-card ${severityClass(item.severity)}`}><div className="exception-main"><div className={`exception-icon ${severityClass(item.severity)}`}>{item.severity==='Critical'?<AlertTriangle size={19}/>:<ShieldAlert size={19}/>}</div><div className="exception-copy"><div className="exception-title-row"><h3>{item.title}</h3><span className={`badge ${severityClass(item.severity)}`}>{item.severity}</span><span className={`badge status-badge ${severityClass(item.status)}`}>{item.status}</span></div><p>{item.description}</p><div className="exception-meta"><span><BriefcaseBusiness size={13}/>{item.category}</span><span><LifeBuoy size={13}/>{item.owner}</span><span><Clock3 size={13}/>Due {dateLabel(item.due_date)}</span><button className="evidence-link" onClick={()=>alert(item.evidence)}><FileCheck2 size={13}/> View evidence</button></div></div><div className="exception-finance"><span>Exposure</span><strong>{currency(item.amount)}</strong><small>USD equivalent</small></div></div><div className="exception-footer"><span className="exception-id">EXC-{String(item.id).padStart(4,'0')} <span>·</span> Updated {new Date(item.updated_at).toLocaleDateString()}</span><div className="exception-actions">{item.status!=='Escalated'&&<button className="button button-ghost small" onClick={onEscalate}><ArrowUpRight size={14}/> Escalate</button>}<button className="button button-primary small" onClick={onResolve}><Check size={14}/> Mark resolved</button></div></div></div>
}
function RecordPage({page,records,meta,title,onAdd,query,setQuery}){
  const Icon=meta.icon;
  const filtered=records.filter(r=>`${r.external_ref} ${r.entity} ${r.status} ${r.owner} ${r.agency} ${r.description}`.toLowerCase().includes(query.toLowerCase()));
  const amount=filtered.reduce((s,r)=>s+Number(r.amount||0),0);
  const statusCounts={};filtered.forEach(r=>statusCounts[r.status]=(statusCounts[r.status]||0)+1);
  return <section><PageHeading eyebrow="FINANCE JOURNEYS" title={title} subtitle={meta.desc} right={<button className="button button-primary" onClick={onAdd}><Plus size={16}/> Add record</button>}/>
    <div className="stat-strip"><MiniStat label="Records shown" value={filtered.length} icon={Icon}/><MiniStat label="Total value" value={currency(amount)} icon={CircleDollarSign}/><MiniStat label="Status categories" value={Object.keys(statusCounts).length} icon={Activity}/><MiniStat label="Data source" value="SQLite" icon={LockKeyhole}/></div>
    <div className="panel record-panel"><div className="panel-heading"><div><h3>Operational ledger</h3><p>Updates and additions flow into dashboard calculations automatically.</p></div><span className="count-pill">{filtered.length} records</span></div><div className="toolbar inside"><div className="search-box"><Search size={16}/><input placeholder="Search reference, entity, owner…" value={query} onChange={e=>setQuery(e.target.value)}/></div><button className="button button-ghost small" onClick={()=>setQuery('')}><Filter size={14}/> Clear filter</button></div><div className="table-wrap"><table><thead><tr><th>Reference / Entity</th><th>Agency</th><th>Amount</th><th>Status</th><th>Due date</th><th>Owner</th></tr></thead><tbody>{filtered.map(r=><tr key={r.id}><td><div className="entity-cell"><strong>{r.external_ref}</strong><span>{r.entity}</span><small>{r.description}</small></div></td><td>{r.agency||'—'}</td><td className="amount-cell">{currency(r.amount)}</td><td><span className={`table-status ${severityClass(r.status)}`}>{r.status}</span></td><td>{dateLabel(r.due_date)}</td><td><span className="owner-chip">{r.owner}</span></td></tr>)}</tbody></table></div>{filtered.length===0&&<div className="empty-state">No records match your search.</div>}<div className="table-footer"><span>Showing {filtered.length} record(s)</span><span><LockKeyhole size={13}/> Single database · dedupe enabled</span></div></div>
  </section>
}
function Copilot({question,setQuestion,result,onAsk,dash}){
  const prompts=['Which financial exceptions need attention first?','How much cash is currently unapplied?','Which carrier settlements are at risk?','What commission items need review?'];
  return <section><PageHeading eyebrow="GROUNDED FINANCE INTELLIGENCE" title="Finance copilot" subtitle="Ask business questions in plain language. Answers cite current records and recommend controlled next steps." right={<span className="soft-pill"><span className="green-dot"/> Evidence-linked</span>}/>
    <div className="copilot-layout"><div className="copilot-main"><div className="copilot-welcome"><div className="copilot-logo"><Bot size={27}/><span className="spark-dot"/></div><div><h2>Your finance analyst, on demand.</h2><p>Ask about cash, carrier settlements, commission leakage or priority risks. Responses are grounded in the live demo database.</p></div></div><div className="prompt-grid">{prompts.map(p=><button key={p} className="prompt-card" onClick={()=>onAsk(p)}><Sparkles size={15}/><span>{p}</span><ChevronRight size={15}/></button>)}</div>{result&&<div className="copilot-answer"><div className="answer-head"><div className="answer-avatar"><Bot size={17}/></div><div><strong>AI_HUB Finance Analyst</strong><span>Database-grounded response · Just now</span></div><span className="grounded-pill"><BadgeCheck size={13}/> Evidence linked</span></div><p className="answer-text">{result.answer}</p><div className="evidence-box"><div className="evidence-heading"><FileCheck2 size={15}/> Supporting evidence <span>{result.evidence.length} items</span></div>{result.evidence.map((e,i)=><div className="evidence-row" key={i}><span>{String(i+1).padStart(2,'0')}</span>{e}</div>)}</div><div className="answer-disclaimer"><ShieldCheck size={14}/>{result.disclaimer}</div></div>}<form className="copilot-input" onSubmit={e=>{e.preventDefault();onAsk(question)}}><div className="input-spark"><Sparkles size={17}/></div><input value={question} onChange={e=>setQuestion(e.target.value)} placeholder="Ask a question about your finance operations…" /><button type="submit" disabled={!question.trim()}><Send size={16}/></button></form><div className="copilot-footnote"><LockKeyhole size={13}/> Uses synthetic demo records. No external payment or ledger actions.</div></div><aside className="copilot-side"><div className="panel"><div className="panel-heading"><div><h3>Finance snapshot</h3><p>Current data points</p></div><Activity size={17}/></div>{(dash?.kpis||[]).map(k=><div className="snapshot-row" key={k.label}><span>{k.label}</span><strong>{currency(k.value)}</strong></div>)}<div className="snapshot-alert"><AlertTriangle size={16}/><div><strong>{dash?.risk?.critical||0} critical issues</strong><span>Prioritise high-impact items with imminent due dates.</span></div></div></div><div className="responsible-card"><ShieldCheck size={20}/><h3>Responsible AI guardrails</h3><ul><li>Answers use the current demo database</li><li>Evidence is shown for review</li><li>Recommendations do not execute money movement</li><li>Human approval remains mandatory</li></ul></div></aside></div>
  </section>
}
createRoot(document.getElementById('root')).render(<App/>);
