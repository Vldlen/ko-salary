import { useState } from "react";

const B = { 50:"#F2F7FF",100:"#DEE7F5",200:"#B8CDE8",300:"#7BA3D4",400:"#004AFF",500:"#0020DD",600:"#33058D",900:"#242424" };
const A = "#FF6D2E";
const fmt = n => new Intl.NumberFormat("ru-RU").format(n) + " \u20BD";
const sLabel = s => ({prospect:"Перспектива",negotiation:"Переговоры",waiting_payment:"Ждём оплату",paid:"Оплачено",cancelled:"Отменено"})[s]||s;
const sColor = s => ({prospect:{bg:"#f3f4f6",c:"#374151"},negotiation:{bg:"#fef9c3",c:"#854d0e"},waiting_payment:{bg:"#ffedd5",c:"#c2410c"},paid:{bg:"#dcfce7",c:"#166534"},cancelled:{bg:"#fee2e2",c:"#991b1b"}})[s]||{bg:"#f3f4f6",c:"#374151"};

const Bar = ({label,value,max,pct,f}) => {
  const p = Math.min(pct,100);
  const col = pct>=100?"#16a34a":pct>=70?B[400]:A;
  return (
    <div style={{marginBottom:12}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
        <span style={{fontSize:12,color:"#6b7280"}}>{label}</span>
        <span style={{fontSize:12,fontWeight:600,color:B[900]}}>
          {f?f(value):value} / {f?f(max):max}
          <span style={{background:pct>=100?"#dcfce7":pct>=70?"#dbeafe":"#ffedd5",color:col,fontSize:10,fontWeight:600,padding:"1px 6px",borderRadius:99,marginLeft:6}}>{pct}%</span>
        </span>
      </div>
      <div style={{height:6,borderRadius:3,background:B[100]}}>
        <div style={{height:6,borderRadius:3,background:col,width:`${p}%`}}/>
      </div>
    </div>
  );
};

const SC = ({title,value,sub,variant,trend}) => {
  const bg = variant==="accent"?"#FFF7ED":variant==="success"?"#F0FDF4":"#fff";
  const vc = variant==="accent"?A:variant==="success"?"#16a34a":B[900];
  return (
    <div style={{background:bg,borderRadius:16,border:`1px solid ${B[100]}`,padding:"16px 20px",flex:1,minWidth:140}}>
      <div style={{fontSize:11,color:"#9ca3af",marginBottom:4}}>{title}</div>
      <div style={{fontSize:22,fontWeight:700,color:vc}}>{value}</div>
      {sub && <div style={{fontSize:11,color:"#9ca3af",marginTop:2}}>{sub}</div>}
      {trend && <div style={{fontSize:11,color:"#16a34a",marginTop:2}}>{trend}</div>}
    </div>
  );
};

const Dashboard = () => {
  const sal = {base:80000,kpiQ:14400,kpiN:7300,margin:7849,total:114549,fc:142000};
  const rv = {fact:1454716,fc:1715856,plan:660000,pct:220,fpct:260};
  const un = {f:11,p:15,pct:73}, mt = {f:24,p:25,pct:96};
  const deals = [
    {client:"U Coffee",rev:851676,status:"paid",units:16},
    {client:"Bonjour Elephant",rev:406000,status:"waiting_payment",units:7},
    {client:"Udon Noodle Bar",rev:194200,status:"paid",units:8},
    {client:"Vaffel",rev:187300,status:"paid",units:60},
    {client:"\u0422\u0430\u0442\u0430\u0440\u0434\u0430\u043D",rev:32000,status:"waiting_payment",units:3},
  ];
  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
        <div>
          <h1 style={{fontSize:22,fontWeight:700,color:B[900],margin:0}}>Март 2026</h1>
          <p style={{color:"#9ca3af",margin:"4px 0 0",fontSize:13}}>Мой прогресс</p>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:6,background:"#fff",borderRadius:12,padding:"6px 14px",border:`1px solid ${B[100]}`}}>
          <div style={{width:6,height:6,borderRadius:"50%",background:"#4ade80"}}/>
          <span style={{fontSize:12,color:"#6b7280"}}>Период активен</span>
        </div>
      </div>
      <div style={{display:"flex",gap:12,marginBottom:24,flexWrap:"wrap"}}>
        <SC title="Текущая ЗП" value={fmt(sal.total)}/>
        <SC title="Прогноз ЗП" value={fmt(sal.fc)} variant="accent" trend={`+${fmt(sal.fc-sal.total)}`}/>
        <SC title="Сделки" value="16" sub={`${un.f} точек подключено`}/>
        <SC title="Встречи" value={`${mt.f} / ${mt.p}`} sub={`${mt.pct}% плана`} variant="success"/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:24}}>
        <div style={{background:"#fff",borderRadius:16,border:`1px solid ${B[100]}`,padding:20}}>
          <h2 style={{fontSize:15,fontWeight:600,color:B[900],margin:"0 0 16px"}}>Выполнение плана</h2>
          <Bar label="Выручка (факт)" value={rv.fact} max={rv.plan} pct={rv.pct} f={fmt}/>
          <Bar label="Выручка (прогноз)" value={rv.fc} max={rv.plan} pct={rv.fpct} f={fmt}/>
          <Bar label="Точки" value={un.f} max={un.p} pct={un.pct}/>
          <Bar label="Встречи" value={mt.f} max={mt.p} pct={mt.pct}/>
        </div>
        <div style={{background:"#fff",borderRadius:16,border:`1px solid ${B[100]}`,padding:20}}>
          <h2 style={{fontSize:15,fontWeight:600,color:B[900],margin:"0 0 16px"}}>Расчёт ЗП</h2>
          {[["Оклад",sal.base],["KPI качественный",sal.kpiQ],["KPI количественный",sal.kpiN],["Маржа с оборудования",sal.margin]].map(([l,v])=>(
            <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${B[50]}`}}>
              <span style={{fontSize:13,color:"#6b7280"}}>{l}</span>
              <span style={{fontSize:13,fontWeight:600,color:B[900]}}>{fmt(v)}</span>
            </div>
          ))}
          <div style={{display:"flex",justifyContent:"space-between",padding:"10px 0",borderTop:`2px solid ${B[100]}`,marginTop:4}}>
            <span style={{fontWeight:600,color:B[900]}}>Итого</span>
            <span style={{fontSize:18,fontWeight:700,color:B[400]}}>{fmt(sal.total)}</span>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",background:"#FFF7ED",borderRadius:12,padding:"10px 14px",marginTop:8}}>
            <span style={{fontSize:13,fontWeight:500,color:"#c2410c"}}>Прогноз</span>
            <span style={{fontSize:16,fontWeight:700,color:A}}>{fmt(sal.fc)}</span>
          </div>
        </div>
      </div>
      <div style={{background:"#fff",borderRadius:16,border:`1px solid ${B[100]}`,padding:20}}>
        <h2 style={{fontSize:15,fontWeight:600,color:B[900],margin:"0 0 12px"}}>Последние сделки</h2>
        {deals.map((d,i)=>{const sc=sColor(d.status);return(
          <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 12px",borderRadius:12}}>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <div style={{width:36,height:36,borderRadius:10,background:B[50],display:"flex",alignItems:"center",justifyContent:"center",color:B[400],fontWeight:700,fontSize:13}}>{d.client[0]}</div>
              <div><div style={{fontSize:13,fontWeight:500,color:B[900]}}>{d.client}</div><div style={{fontSize:11,color:"#9ca3af"}}>{d.units} точек</div></div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <span style={{fontSize:11,fontWeight:500,padding:"2px 10px",borderRadius:99,background:sc.bg,color:sc.c}}>{sLabel(d.status)}</span>
              <span style={{fontSize:13,fontWeight:600,color:B[900],width:100,textAlign:"right"}}>{fmt(d.rev)}</span>
            </div>
          </div>
        );})}
      </div>
    </div>
  );
};

const Deals = () => {
  const [filter,setFilter] = useState("all");
  const deals = [
    {client:"U Coffee",rev:851676,mrr:42000,units:16,margin:45000,status:"paid",fc:851676,date:"05.03"},
    {client:"Bonjour Elephant",rev:406000,mrr:28000,units:7,margin:18000,status:"waiting_payment",fc:406000,date:"08.03"},
    {client:"Udon Noodle Bar",rev:194200,mrr:15000,units:8,margin:12500,status:"paid",fc:194200,date:"12.03"},
    {client:"Vaffel",rev:187300,mrr:11000,units:60,margin:8000,status:"paid",fc:187300,date:"15.03"},
    {client:"\u0422\u0430\u0442\u0430\u0440\u0434\u0430\u043D",rev:32000,mrr:5000,units:3,margin:0,status:"waiting_payment",fc:32000,date:"18.03"},
    {client:"\u041A\u043E\u0444\u0435 \u0425\u0430\u0443\u0437",rev:0,mrr:0,units:5,margin:0,status:"negotiation",fc:280000,date:"20.03"},
    {client:"\u0422\u0435\u0440\u0435\u043C\u043E\u043A",rev:0,mrr:0,units:12,margin:0,status:"prospect",fc:520000,date:"22.03"},
  ];
  const fd = filter==="all"?deals:deals.filter(d=>d.status===filter);
  const fs = [["all","Все"],["paid","Оплачено"],["waiting_payment","Ждём оплату"],["negotiation","Переговоры"],["prospect","Перспектива"]];
  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <h1 style={{fontSize:22,fontWeight:700,color:B[900],margin:0}}>Сделки</h1>
        <button style={{background:B[400],color:"#fff",border:"none",borderRadius:10,padding:"8px 18px",fontWeight:600,fontSize:13,cursor:"pointer"}}>+ Новая сделка</button>
      </div>
      <div style={{display:"flex",gap:6,marginBottom:20,flexWrap:"wrap"}}>
        {fs.map(([k,l])=>(
          <button key={k} onClick={()=>setFilter(k)} style={{padding:"6px 14px",borderRadius:8,border:`1px solid ${filter===k?B[400]:B[100]}`,background:filter===k?B[400]:"#fff",color:filter===k?"#fff":"#6b7280",fontSize:12,fontWeight:500,cursor:"pointer"}}>{l}</button>
        ))}
      </div>
      <div style={{background:"#fff",borderRadius:16,border:`1px solid ${B[100]}`,overflow:"hidden"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
          <thead><tr style={{background:B[50]}}>
            {["Клиент","Выручка","MRR","Точки","Маржа","Статус","Прогноз","Дата"].map(h=>(
              <th key={h} style={{padding:"10px 14px",textAlign:"left",fontWeight:500,color:"#6b7280",fontSize:11,borderBottom:`1px solid ${B[100]}`}}>{h}</th>
            ))}
          </tr></thead>
          <tbody>{fd.map((d,i)=>{const sc=sColor(d.status);return(
            <tr key={i} style={{borderBottom:`1px solid ${B[50]}`}}>
              <td style={{padding:"10px 14px"}}><div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:30,height:30,borderRadius:8,background:B[50],display:"flex",alignItems:"center",justifyContent:"center",color:B[400],fontWeight:700,fontSize:12,flexShrink:0}}>{d.client[0]}</div><span style={{fontWeight:500,color:B[900]}}>{d.client}</span></div></td>
              <td style={{padding:"10px 14px",fontWeight:600,color:B[900]}}>{d.rev>0?fmt(d.rev):"\u2014"}</td>
              <td style={{padding:"10px 14px",color:"#6b7280"}}>{d.mrr>0?fmt(d.mrr):"\u2014"}</td>
              <td style={{padding:"10px 14px",color:"#6b7280"}}>{d.units}</td>
              <td style={{padding:"10px 14px",color:"#6b7280"}}>{d.margin>0?fmt(d.margin):"\u2014"}</td>
              <td style={{padding:"10px 14px"}}><span style={{fontSize:11,fontWeight:500,padding:"2px 10px",borderRadius:99,background:sc.bg,color:sc.c}}>{sLabel(d.status)}</span></td>
              <td style={{padding:"10px 14px",color:d.rev===0?A:"#6b7280",fontWeight:d.rev===0?600:400}}>{fmt(d.fc)}</td>
              <td style={{padding:"10px 14px",color:"#9ca3af"}}>{d.date}</td>
            </tr>
          );})}</tbody>
        </table>
      </div>
    </div>
  );
};

const Salary = () => {
  const s = {base:80000,kpiQ:14400,kpiN:7300,margin:7849,bonus:5000,ded:0,total:114549,fc:142000};
  const items = [
    {label:"Оклад",value:s.base,max:80000},
    {label:"KPI качественный (встречи)",value:s.kpiQ,max:15000,note:"96% плана"},
    {label:"KPI количественный (точки)",value:s.kpiN,max:10000,note:"73% плана"},
    {label:"Маржа с оборудования",value:s.margin,max:15000,note:"83 500 \u00D7 9.4%"},
    {label:"Разовый бонус",value:s.bonus,max:5000},
  ];
  return (
    <div>
      <h1 style={{fontSize:22,fontWeight:700,color:B[900],margin:"0 0 20px"}}>Расчёт зарплаты</h1>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:24}}>
        <div style={{background:"#fff",borderRadius:16,border:`1px solid ${B[100]}`,padding:24,display:"flex",flexDirection:"column",justifyContent:"center",alignItems:"center"}}>
          <div style={{fontSize:12,color:"#9ca3af",marginBottom:4}}>Текущая зарплата</div>
          <div style={{fontSize:36,fontWeight:700,color:B[400]}}>{fmt(s.total)}</div>
        </div>
        <div style={{background:"#FFF7ED",borderRadius:16,border:"1px solid #fed7aa",padding:24,display:"flex",flexDirection:"column",justifyContent:"center",alignItems:"center"}}>
          <div style={{fontSize:12,color:"#c2410c",marginBottom:4}}>Прогноз</div>
          <div style={{fontSize:36,fontWeight:700,color:A}}>{fmt(s.fc)}</div>
          <div style={{fontSize:13,color:"#16a34a",marginTop:4}}>+{fmt(s.fc-s.total)} ({Math.round((s.fc-s.total)/s.total*100)}%)</div>
        </div>
      </div>
      <div style={{background:"#fff",borderRadius:16,border:`1px solid ${B[100]}`,padding:24,marginBottom:24}}>
        <h2 style={{fontSize:15,fontWeight:600,color:B[900],margin:"0 0 16px"}}>Детализация</h2>
        {items.map(item=>(
          <div key={item.label} style={{marginBottom:14}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
              <span style={{fontSize:13,color:"#6b7280"}}>{item.label} {item.note&&<span style={{fontSize:11,color:"#9ca3af"}}>({item.note})</span>}</span>
              <span style={{fontSize:13,fontWeight:600,color:B[900]}}>{fmt(item.value)}</span>
            </div>
            {item.max>0&&<div style={{height:5,borderRadius:3,background:B[100]}}><div style={{height:5,borderRadius:3,background:B[400],width:`${Math.min(100,(item.value/item.max)*100)}%`}}/></div>}
          </div>
        ))}
        <div style={{display:"flex",justifyContent:"space-between",padding:"12px 0",borderTop:`2px solid ${B[100]}`,marginTop:8}}>
          <span style={{fontWeight:700,fontSize:15,color:B[900]}}>Итого к выплате</span>
          <span style={{fontWeight:700,fontSize:22,color:B[400]}}>{fmt(s.total)}</span>
        </div>
      </div>
      <div style={{background:"#fff",borderRadius:16,border:`1px solid ${B[100]}`,padding:24}}>
        <h2 style={{fontSize:15,fontWeight:600,color:B[900],margin:"0 0 12px"}}>История</h2>
        <div style={{display:"flex",gap:12}}>
          {[{m:"Январь",v:92000},{m:"Февраль",v:105000}].map(h=>(
            <div key={h.m} style={{flex:1,background:B[50],borderRadius:12,padding:"12px 16px",textAlign:"center"}}>
              <div style={{fontSize:11,color:"#9ca3af"}}>{h.m}</div>
              <div style={{fontSize:18,fontWeight:700,color:B[900],marginTop:4}}>{fmt(h.v)}</div>
            </div>
          ))}
          <div style={{flex:1,background:"#FFF7ED",borderRadius:12,padding:"12px 16px",textAlign:"center"}}>
            <div style={{fontSize:11,color:"#c2410c"}}>Март (текущий)</div>
            <div style={{fontSize:18,fontWeight:700,color:A,marginTop:4}}>{fmt(s.total)}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Team = () => {
  const mgrs = [
    {name:"Субботин Иван",pos:"Менеджер ОП",rev:1454716,plan:660000,units:11,up:15,meet:24,mp:25,sal:114549,fc:142000},
    {name:"Тимофеева Алёна",pos:"Менеджер ОП",rev:890000,plan:660000,units:9,up:15,meet:20,mp:25,sal:98000,fc:115000},
    {name:"Козлов Дмитрий",pos:"Мл. менеджер ОП",rev:320000,plan:440000,units:5,up:10,meet:15,mp:20,sal:65000,fc:78000},
    {name:"Новикова Мария",pos:"Мл. менеджер ОП",rev:180000,plan:440000,units:3,up:10,meet:12,mp:20,sal:55000,fc:62000},
  ];
  const totalRev = mgrs.reduce((s,m)=>s+m.rev,0);
  const avgSal = Math.round(mgrs.reduce((s,m)=>s+m.sal,0)/mgrs.length);
  return (
    <div>
      <h1 style={{fontSize:22,fontWeight:700,color:B[900],margin:"0 0 20px"}}>Команда</h1>
      <div style={{display:"flex",gap:12,marginBottom:24,flexWrap:"wrap"}}>
        <SC title="Выручка команды" value={fmt(totalRev)}/>
        <SC title="Средняя ЗП" value={fmt(avgSal)}/>
        <SC title="Лучший результат" value="Субботин И." sub="220% плана" variant="success"/>
        <SC title="Сотрудников" value="4"/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        {mgrs.map(m=>{
          const pct=Math.round((m.rev/m.plan)*100);
          const st=pct>=100?{l:"По плану",bg:"#dcfce7",c:"#166534"}:pct>=60?{l:"Отстаёт",bg:"#fef9c3",c:"#854d0e"}:{l:"Риск",bg:"#fee2e2",c:"#991b1b"};
          return(
            <div key={m.name} style={{background:"#fff",borderRadius:16,border:`1px solid ${B[100]}`,padding:20}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"start",marginBottom:14}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div style={{width:38,height:38,borderRadius:"50%",background:`linear-gradient(135deg,${B[400]},${B[600]})`,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:700,fontSize:14}}>{m.name[0]}</div>
                  <div><div style={{fontSize:14,fontWeight:600,color:B[900]}}>{m.name}</div><div style={{fontSize:11,color:"#9ca3af"}}>{m.pos}</div></div>
                </div>
                <span style={{fontSize:10,fontWeight:600,padding:"2px 8px",borderRadius:99,background:st.bg,color:st.c}}>{st.l}</span>
              </div>
              <Bar label="Выручка" value={m.rev} max={m.plan} pct={pct} f={fmt}/>
              <div style={{display:"flex",gap:16,marginBottom:12}}>
                <div style={{flex:1}}><div style={{fontSize:11,color:"#9ca3af"}}>Точки</div><div style={{fontSize:14,fontWeight:600,color:B[900]}}>{m.units} / {m.up}</div></div>
                <div style={{flex:1}}><div style={{fontSize:11,color:"#9ca3af"}}>Встречи</div><div style={{fontSize:14,fontWeight:600,color:B[900]}}>{m.meet} / {m.mp}</div></div>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",padding:"8px 12px",background:B[50],borderRadius:10}}>
                <div><div style={{fontSize:10,color:"#9ca3af"}}>ЗП</div><div style={{fontSize:15,fontWeight:700,color:B[400]}}>{fmt(m.sal)}</div></div>
                <div style={{textAlign:"right"}}><div style={{fontSize:10,color:"#c2410c"}}>Прогноз</div><div style={{fontSize:15,fontWeight:700,color:A}}>{fmt(m.fc)}</div></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const navLinks = [
  {id:"dashboard",label:"Дашборд",icon:"\uD83D\uDCCA",ok:true},
  {id:"deals",label:"Сделки",icon:"\uD83E\uDD1D",ok:true},
  {id:"meetings",label:"Встречи",icon:"\uD83D\uDCC5",ok:false},
  {id:"salary",label:"Моя ЗП",icon:"\uD83D\uDCB0",ok:true},
  {id:"forecast",label:"Прогноз",icon:"\uD83D\uDCC8",ok:false},
  {id:"team",label:"Команда",icon:"\uD83D\uDC65",ok:true},
];

export default function App() {
  const [page, setPage] = useState("dashboard");
  const isTeam = page === "team";
  const userName = isTeam ? "Петров Владлен" : "Субботин Иван";
  const userRole = isTeam ? "РОП" : "Менеджер";
  return (
    <div style={{display:"flex",minHeight:"100vh",background:B[50],fontFamily:"Inter,-apple-system,sans-serif"}}>
      <div style={{width:220,background:"#fff",borderRight:`1px solid ${B[100]}`,display:"flex",flexDirection:"column",minHeight:"100%"}}>
        <div style={{padding:"20px 16px",borderBottom:`1px solid ${B[100]}`,display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:32,height:32,borderRadius:8,background:`linear-gradient(135deg,${B[400]},${B[600]})`,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:700,fontSize:12}}>КО</div>
          <div><div style={{fontWeight:700,fontSize:16,color:B[900]}}>Salary</div><div style={{fontSize:9,color:B[300],textTransform:"uppercase",letterSpacing:1.5}}>ИННО</div></div>
        </div>
        <nav style={{flex:1,padding:"12px 8px"}}>
          {navLinks.map(n=>(
            <div key={n.id} onClick={()=>n.ok&&setPage(n.id)} style={{padding:"8px 12px",borderRadius:8,marginBottom:2,cursor:n.ok?"pointer":"default",background:page===n.id?B[50]:"transparent",color:page===n.id?B[400]:"#6b7280",fontSize:13,fontWeight:500,display:"flex",alignItems:"center",gap:8,opacity:n.ok?1:0.4}}>
              <span style={{fontSize:16}}>{n.icon}</span>{n.label}
            </div>
          ))}
        </nav>
        <div style={{padding:"12px 16px",borderTop:`1px solid ${B[100]}`,display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:32,height:32,borderRadius:"50%",background:`linear-gradient(135deg,${B[400]},${A})`,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:700,fontSize:12}}>{userName[0]}</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:12,fontWeight:500,color:B[900],overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{userName}</div>
            <div style={{fontSize:10,color:"#9ca3af"}}>{userRole}</div>
          </div>
        </div>
      </div>
      <main style={{flex:1,padding:28,maxWidth:960,overflow:"auto"}}>
        {page==="dashboard"&&<Dashboard/>}
        {page==="deals"&&<Deals/>}
        {page==="salary"&&<Salary/>}
        {page==="team"&&<Team/>}
      </main>
    </div>
  );
}