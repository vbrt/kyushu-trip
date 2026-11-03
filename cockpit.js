(function(){
"use strict";
// Schutz gegen Einbetten in fremde Seiten (Clickjacking)
if(window.top !== window.self){ try{ window.top.location = window.location.href; }catch(e){ document.documentElement.innerHTML = ""; return; } }
/* ============ DATEN ============ */
const T = window.TRIP;
const TRIP_START = new Date(T.start);
const TRIP_DAY1 = new Date(T.start.slice(0,10) + "T00:00");
const TRIP_END = new Date(T.end);
const PEOPLE = T.people || [];
const PLURAL = PEOPLE.length > 1;
const NAMES = (a => a.length > 1 ? a.slice(0,-1).join(", ") + " & " + a[a.length-1] : a.join(""))(PEOPLE.map(p => p.name));
const BASE = T.baseCurrency || "EUR";
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const WDAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
// Private Reisedaten kommen aus der Datenbank (Dokument private/trip)
let DAYS = [], FLIGHTS = [], STAYS = [], TRANSFERS = [], TODOS = [], PACK = [], GUIDES = {}, QUICK = [], ALERTS = [], MONEY = [], EMERGENCY = [], FACTS = [], EMAILS = {};

/* ============ HELFER ============ */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const today0 = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); };
const fmtDue = iso => { const [y,m,d] = iso.split("-"); return `${+d} ${MONTHS[+m-1]}`; };
const daysUntil = iso => { const [y,m,d] = iso.split("-").map(Number); return Math.round((new Date(y,m-1,d) - today0())/864e5); };
const mapsUrl = q => "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(q);

const state = { db:null, assets:null, wx:null, costs:[], rates:{}, wishes:[], checks:{}, notes:{}, uploads:{}, packExtra:[], todoExtra:[], canWrite:true, names:{}, me:null, db:null, assets:null, user:null };

function personName(key){ const p = PEOPLE.find(x => x.key === key); return p ? p.name : key; }
function nameOf(id){ if(!id) return ""; const k = EMAILS[String(id).toLowerCase()]; return k ? personName(k) : (PLURAL ? "someone" : ""); }
async function resolveNames(){}

/* ============ HEADER ============ */
function tripDays(){ return Math.round((new Date(T.end.slice(0,10)+"T00:00") - TRIP_DAY1)/864e5) + 1; }
function renderCount(){
  const now = new Date(); let html;
  if(now < TRIP_START){
    const d = Math.ceil((TRIP_DAY1 - today0())/864e5);
    html = `<b>${d === 0 ? "Today" : d === 1 ? "Tomorrow" : "in " + d + " days"}</b><span class="eyebrow">${esc(T.departLabel || "")}</span>`;
  } else if(now <= TRIP_END){
    const n = Math.floor((today0() - TRIP_DAY1)/864e5) + 1;
    html = `<b>Day ${n} / ${tripDays()}</b><span class="eyebrow">${esc((dayFor(today0())||{}).title||"")}</span>`;
  } else html = `<b>Home</b><span class="eyebrow">What a trip</span>`;
  $("#count").innerHTML = html;
}

/* ============ HEUTE ============ */
function isoOf(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function dayFor(date){ const iso = isoOf(date); return DAYS.find(d => d.date === iso); }
function slotList(){ return [...FLIGHTS, ...STAYS, ...TRANSFERS].filter(x => x.slot); }
function slotsDone(){
  const slots = slotList();
  const done = slots.filter(x => x.doc || (state.uploads[x.slot]?.files||[]).length || (state.notes["slot-"+x.slot]?.text||"").trim()).length;
  return {done, total: slots.length};
}
function openTodos(){
  const sd = slotsDone();
  const all = TODOS.map(t => ({...t, done: t.auto ? (sd.total > 0 && sd.done === sd.total) : !!(state.checks["todo-"+t.id]||{}).done}));
  const extra = state.todoExtra.map(x => ({id:x.id, t:x.text, sub:"", due:x.due || T.start.slice(0,10), prio:"norm", done: !!(state.checks["todo-"+x.id]||{}).done, extra:true}));
  return all.concat(extra);
}
function packStats(){
  let total=0, done=0;
  PACK.forEach(c => c.items.forEach((_,i) => { total++; if(state.checks[`pack-${slug(c.cat)}-${i}`]?.done) done++; }));
  state.packExtra.forEach(p => { total++; if(state.checks["pack-x-"+p.id]?.done) done++; });
  return {total,done};
}
function crewHtml(){
  return `<div class="crew">${PEOPLE.map(p => `<div class="mate"><img src="${esc(p.img)}" alt="${esc(p.name)}"><div>${p.nick ? `<span class="nick">${esc(p.nick)}</span>` : ""}<b>${esc(p.name)}</b>${p.bio ? `<span class="small muted">${esc(p.bio)}</span>` : ""}
    ${p.stats && p.stats.length ? `<ul class="fun">${p.stats.map(([k,v]) => `<li><span>${esc(k)}</span><b>${esc(v)}</b></li>`).join("")}</ul>` : ""}</div></div>`).join("")}</div>`;
}
function renderHeute(){
  const now = new Date();
  const v = $("#v-heute");
  const todos = openTodos();
  const open = todos.filter(t => !t.done).sort((a,b) => (a.due||"").localeCompare(b.due||""));
  const ps = packStats(), sd = slotsDone();
  let top = "";
  if(now < TRIP_START){
    const d = Math.ceil((TRIP_DAY1 - today0())/864e5);
    top = `<div class="card hl"><div class="eyebrow muted">Before the trip</div><h3 style="font-size:1.6rem;margin-top:2px">${d} ${d === 1 ? "day" : "days"} to go</h3>
      <p style="margin:6px 0 0">${esc(T.departLabel || "")}. Your next to-dos are below.</p></div>`;
  } else if(now <= TRIP_END){
    const day = dayFor(today0()), nxt = dayFor(new Date(today0().getTime() + 864e5));
    top = day ? `<div class="eyebrow muted">Today</div>${dayCard(day,true)}${nxt ? `<div class="eyebrow muted" style="margin-top:6px">Tomorrow</div>${dayCard(nxt,false)}` : ""}` : `<div class="card hl"><h3>On the road</h3><p style="margin:0">No plan for today yet.</p></div>`;
  } else {
    top = `<div class="card hl"><h3>Welcome home!</h3><p>The trip is over. The blog stays as a keepsake.</p></div>`;
  }
  const tdDone = todos.length - open.length;
  v.innerHTML = `${top}
   ${crewHtml()}
   ${wxCard()}
   <div class="stats">
     <div class="stat"><b>${tdDone}/${todos.length}</b><span>To-dos done</span><div class="bar"><i style="width:${Math.round(tdDone/Math.max(todos.length,1)*100)}%"></i></div></div>
     <div class="stat"><b>${ps.done}/${ps.total}</b><span>Packing list</span><div class="bar"><i style="width:${Math.round(ps.done/Math.max(ps.total,1)*100)}%"></i></div></div>
     ${sd.total ? `<div class="stat"><b>${sd.done}/${sd.total}</b><span>Confirmations uploaded</span><div class="bar"><i style="width:${Math.round(sd.done/sd.total*100)}%"></i></div></div>` : ""}
     <div class="stat"><b>${tripDays()}</b><span>Trip days</span><div class="bar"><i style="width:100%;background:var(--trail)"></i></div></div>
   </div>
   <div class="card">
     <div class="sechead"><h3>Up next</h3><a href="#orga" class="small">All to-dos</a></div>
     <div>${open.slice(0,5).map(t => todoRow(t)).join("") || '<p class="muted">All done.</p>'}</div>
   </div>
   ${ALERTS.length ? `<div class="grid2">${ALERTS.map(a => `<div class="card ${a.kind === "crit" ? "crit" : "warn"}"><h3>${esc(a.title)}</h3><p style="margin:0">${esc(a.text)}</p></div>`).join("")}</div>` : ""}`;
  bindChecks(v);
}

/* ============ WETTER ============ */
const WXLINK = Object.fromEntries((T.weather || []).map(w => [w.key, [w.lat, w.lon]]));
function wxCard(onlyKey){
  const W = state.wx; if(!W || !W.places) return "";
  const t = today0(); const iso = `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,"0")}-${String(t.getDate()).padStart(2,"0")}`;
  const fmt = d => { const [y,m,dd] = d.split("-"); return `${+dd}/${+m}`; };
  const pls = W.places.filter(p => !onlyKey || p.key === onlyKey);
  return `<div class="card"><div class="sechead"><h3>Weather</h3><span class="small muted">Updated ${esc(new Date(W.updated).toLocaleString("en-GB",{day:"numeric",month:"numeric",hour:"2-digit",minute:"2-digit"}))}</span></div>
   <div class="wxg">${pls.map(p => { const d = (p.days||[]).find(x => x.date >= iso) || (p.days||[])[0]; if(!d) return ""; const ll = WXLINK[p.key];
     return `<div class="wxc"><div class="sechead"><b>${esc(p.name)}</b><span class="wxt">${d.hi ?? "–"}°<small>/${d.lo ?? "–"}°</small></span></div>
       <div class="small muted">${esc([d.text, d.wind ? d.wind : ""].filter(Boolean).join(" · "))}</div>
       <div class="chips" style="margin-top:6px">${(p.days||[]).filter(x => x.date > d.date).slice(0,4).map(x => `<span class="chip grey">${fmt(x.date)} ${x.hi ?? "–"}°/${x.lo ?? "–"}°</span>`).join("")}</div>
       ${ll ? `<a class="small" href="https://www.windy.com/${ll[0]}/${ll[1]}?${ll[0]},${ll[1]},9" target="_blank" rel="noopener">Live on Windy</a>` : ""}</div>`; }).join("")}</div></div>`;
}

/* ============ PLAN ============ */
let planFilter = "all";
function dayCard(day, big){
  const date = new Date(day.date + "T00:00");
  const t = today0().getTime();
  const cls = date.getTime() === t ? "today" : (date.getTime() < t ? "past" : "");
  const n = Math.round((date - TRIP_DAY1)/864e5) + 1;
  return `<article class="day ${big ? "" : cls}" id="tag-${n}">
    <div class="datecol"><div class="d">${date.getDate()}</div><div class="m">${WDAYS[date.getDay()]} · ${MONTHS[date.getMonth()]}</div>${/^Day \d/.test(day.title || "") ? "" : `<div class="n">Day ${n}</div>`}</div>
    <div>
      ${(day.tags||[]).length ? `<div class="chips" style="margin-bottom:4px">${day.tags.map(([l,c]) => `<span class="chip ${esc(c||"")}">${esc(l)}</span>`).join("")}</div>` : ""}
      <h3>${esc(day.title)}</h3>
      ${day.where ? `<div class="where">${esc(day.where)}</div>` : ""}
      <ul class="steps">${(day.steps||[]).map(stepHtml).join("")}</ul>
      ${day.sleep ? `<div class="sleep"><span class="chip grey">Night</span> ${esc(day.sleep)}</div>` : ""}
    </div></article>`;
}
const mapLink = q => q ? ` <a class="maplink" href="${mapsUrl(q)}" target="_blank" rel="noopener">📍&nbsp;Map</a>` : "";
const claudeChip = c => c ? ' <span class="chip claude">✨ Claude</span>' : "";
function stepHtml(st){
  if(Array.isArray(st)) return `<li><span class="t">${esc(st[0])}</span><span>${esc(st[1])}</span></li>`;
  return `<li class="${st.c ? "tip" : ""}"><span class="t">${esc(st.t || "")}</span><span>${st.go ? `<span class="go">${esc(st.go)}</span>` : ""}<b>${esc(st.n || "")}</b>${mapLink(st.q)}${claudeChip(st.c)}${st.d ? `<span class="sd">${esc(st.d)}</span>` : ""}</span></li>`;
}
function renderPlan(){
  const S = T.stops || [], ti = isoOf(today0()), si = S.findIndex(s => ti >= s.from && ti <= s.to);
  const rm = $("#routeOverview");
  if(rm && window.routeMapSvg) rm.innerHTML = `<div class="card"><div class="sechead"><h3>Route</h3>${T.roadTrip ? `<span class="small muted">🚗 ≈ ${esc(T.roadTrip.km)} km by car</span>` : ""}</div>
    <div class="rmwrap">${window.routeMapSvg(si >= 0 ? S[si].key : "", S.slice(0, Math.max(si,0)).map(s => s.key))}</div>
    <h3 style="margin:14px 0 4px">Getting from A to B</h3><ol class="legs">${S.filter(s => (s.legs||[]).length).map(s => `<li><span class="small muted">${esc(s.dt)}</span>${window.legHtml ? window.legHtml(s.legs) : ""}</li>`).join("")}</ol></div>`;
  $("#days").innerHTML = DAYS.length ? DAYS.map(d => dayCard(d,false)).join("") : '<p class="muted">No itinerary yet.</p>';
}

/* ============ BUCHUNGEN ============ */
function noteBox(key, ph){
  const n = state.notes[key];
  const meta = n && n.text ? `last edit: ${esc(nameOf(n.by))}` : "";
  return `<textarea class="note" data-note="${esc(key)}" placeholder="${esc(ph)}" ${state.canWrite ? "" : "readonly"}>${esc(n?.text||"")}</textarea>
   <div class="notebar"><span>${PLURAL ? "Visible to the whole group" : "Only for you"}, saves automatically</span><span data-meta="${esc(key)}">${meta}</span></div>`;
}
function slotBox(slot, label, slotOwner, doc){
  const files = state.uploads[slot]?.files || [];
  const noteTxt = (state.notes["slot-"+slot]?.text||"").trim();
  const done = files.length || noteTxt;
  const thumbs = files.map(f => {
    const url = esc(blobUrl(f.id));
    const isImg = (f.type||"").startsWith("image/");
    return `<a href="${url}" target="_blank" rel="noopener" title="${esc(f.name)}">${isImg ? `<img src="${url}" alt="${esc(f.name)}" loading="lazy">` : `<span class="pdf">PDF</span>`}</a>`;
  }).join("");
  const canUp = !!state.assets;
  const upRow = `<div class="addrow" style="align-items:center">
      ${canUp ? `<label class="btn ghost">Upload screenshot or PDF<input type="file" accept="image/*,application/pdf" multiple data-upload="${esc(slot)}"></label>` : `<span class="small muted">Uploading works for everyone with edit access.</span>`}
      <span class="small muted" data-upstatus="${esc(slot)}"></span>
    </div>`;
  if(doc) return `<div class="slot done compact" data-slot="${esc(slot)}">
    <div class="chips"><span class="chip ok">✓ Confirmation on file</span><span class="small muted">${esc(doc)}</span></div>
    ${thumbs ? `<div class="thumbs">${thumbs}</div>` : ""}
    <details class="more"><summary>Add a file or note</summary>${upRow}<div style="margin-top:8px">${noteBox("slot-"+slot, "Anything else worth knowing …")}</div></details>
  </div>`;
  return `<div class="slot ${done ? "done" : ""}" data-slot="${esc(slot)}">
    <div class="chips" style="margin-bottom:6px">${done ? '<span class="chip ok">Uploaded</span>' : `<span class="chip trail">${esc(slotOwner ? slotOwner + " uploads" : "Missing")}</span>`}</div>
    <div class="small">${esc(label)}</div>
    ${thumbs ? `<div class="thumbs">${thumbs}</div>` : ""}
    <div class="addrow" style="align-items:center">
      ${canUp ? `<label class="btn ghost">Upload screenshot or PDF<input type="file" accept="image/*,application/pdf" multiple data-upload="${esc(slot)}"></label>` : `<span class="small muted">Uploading works for everyone with edit access.</span>`}
      <span class="small muted" data-upstatus="${esc(slot)}"></span>
    </div>
    <div style="margin-top:8px">${noteBox("slot-"+slot, "Or type it here: flight number, booking code, address …")}</div>
  </div>`;
}
function copyBtn(v){ return `<button class="copy" type="button" data-copy="${esc(v)}">Copy</button>`; }
function renderBuchungen(){
  const v = $("#v-buchungen");
  v.innerHTML = `<div class="sechead"><h2>Bookings</h2><span class="small muted">Tap a code to copy it</span></div>
  ${FLIGHTS.length ? `<h3 style="text-transform:uppercase;letter-spacing:.05em">Flights & trains</h3>` : ""}
  ${FLIGHTS.map(f => `<div class="card bk">
     <div class="head"><span class="eyebrow muted">${esc(f.date)}</span>${f.status ? `<span class="chip ${esc(f.status[1]||"")}">${esc(f.status[0])}</span>` : ""}</div>
     <div class="flight"><div><div class="ap">${esc(f.from)}</div><div class="tm">${esc(f.dep||"")}</div></div><div class="mid">${esc(f.dur||"")}</div><div class="r"><div class="ap">${esc(f.to)}</div><div class="tm">${esc(f.arr||"")}</div></div></div>
     <div class="small muted">${esc(f.carrier||"")}</div>
     ${f.code ? `<div><span class="code">${esc(f.code)} ${copyBtn(f.code)}</span></div>` : ""}
     ${f.info ? `<div class="small">${esc(f.info)}</div>` : ""}
     ${f.slot ? slotBox(f.slot, "Confirmation with flight number, booking code and baggage", f.slotBy, f.doc) : `<details class="more"><summary>Notes</summary>${noteBox("bk-"+f.id, "e.g. seats, baggage …")}</details>`}
   </div>`).join("")}
  ${STAYS.length ? `<h3 style="text-transform:uppercase;letter-spacing:.05em;margin-top:6px">Accommodation</h3>` : ""}
  ${STAYS.map(s => `<div class="card bk">
     <div class="head"><span class="eyebrow muted">${esc(s.when)}</span>${s.status ? `<span class="chip ${esc(s.status[1]||"")}">${esc(s.status[0])}</span>` : ""}</div>
     <h3 style="margin:0">${esc(s.name)} ${s.place ? `<span class="muted small">· ${esc(s.place)}</span>` : ""}</h3>
     ${s.addr ? `<div>${esc(s.addr)} · <a href="${mapsUrl(s.map || s.addr)}" target="_blank" rel="noopener">📍&nbsp;Map</a></div>` : s.map ? `<div>${mapLink(s.map)}</div>` : ""}
     ${(s.kv||[]).length ? `<dl class="kv">${s.kv.map(([k,val]) => `<dt>${esc(k)}</dt><dd>${esc(val)}</dd>`).join("")}</dl>` : ""}
     ${(s.copy||[]).map(([k,val]) => `<div><span class="code">${esc(k)}: ${esc(val)} ${copyBtn(val)}</span></div>`).join("")}
     ${s.tel ? `<div class="small"><a href="tel:${esc(s.tel.replace(/[^+0-9]/g,""))}">📞 ${esc(s.tel)}</a></div>` : ""}
     ${s.info ? `<div class="small" style="margin-top:4px">${esc(s.info)}</div>` : ""}
     ${s.slot ? slotBox(s.slot, "Booking confirmation with address, check-in/out and booking number", s.slotBy, s.doc) : `<details class="more"><summary>Notes</summary>${noteBox("bk-"+s.id,"e.g. door code, booking number …")}</details>`}
   </div>`).join("")}
  ${TRANSFERS.map((x,i) => `<div class="card bk">
     <div class="head"><span class="eyebrow muted">${esc(x.when||"")}</span>${x.status ? `<span class="chip ${esc(x.status[1]||"")}">${esc(x.status[0])}</span>` : ""}</div>
     <h3 style="margin:0">${esc(x.title)}</h3>
     ${(x.kv||[]).length ? `<dl class="kv">${x.kv.map(([k,val]) => `<dt>${esc(k)}</dt><dd>${esc(val)}</dd>`).join("")}</dl>` : ""}
     ${(x.copy||[]).map(([k,val]) => `<div><span class="code">${esc(k)}: ${esc(val)} ${copyBtn(val)}</span></div>`).join("")}
     ${x.slot ? slotBox(x.slot, "Confirmation", x.slotBy, x.doc) : `<details class="more"><summary>Notes</summary>${noteBox("bk-x"+(x.id||i),"Notes …")}</details>`}
  </div>`).join("")}
  ${!FLIGHTS.length && !STAYS.length && !TRANSFERS.length ? '<p class="muted">No bookings yet.</p>' : ""}`;
  bindNotes(v); bindUploads(v); bindCopy(v);
}

/* ============ ORTE ============ */
let place = null;
function renderOrte(){
  const v = $("#v-orte");
  const keys = Object.keys(GUIDES);
  if(!keys.length){ v.innerHTML = '<div class="sechead"><h2>Places & tips</h2></div><p class="muted">No place tips yet.</p>'; return; }
  if(!place || !GUIDES[place]) place = keys[0];
  const p = GUIDES[place];
  v.innerHTML = `<div class="sechead"><h2>Places & tips</h2><span class="chip claude">✨ Suggestions by Claude</span></div>
  <div class="placetabs" role="group" aria-label="Choose a place">${keys.map(k => `<button type="button" data-p="${esc(k)}" aria-pressed="${k===place}">${esc(GUIDES[k].name)}</button>`).join("")}</div>
  <div class="card place">${p.intro ? `<p style="margin:0 0 6px">${esc(p.intro)}</p>` : ""}
    ${(p.must||[]).length ? `<h3>Don't miss</h3><div class="tips">${p.must.map(([k,t,q],i) => `<div class="tip"><span class="k">${i+1}</span><div><b>${esc(k)}</b>${mapLink(q)} · ${esc(t)}</div></div>`).join("")}</div>` : ""}
  </div>
  <div class="grid2">
    ${(p.food||[]).length ? `<div class="card place"><h3>Food & drink</h3><div class="tips">${p.food.map(([k,t,q]) => `<div><b>${esc(k)}</b>${mapLink(q)}<div class="small">${esc(t)}</div></div>`).join("")}</div></div>` : ""}
    ${(p.practical||[]).length ? `<div class="card place"><h3>Practical</h3><ul class="dots">${p.practical.map(t => `<li>${esc(t)}</li>`).join("")}</ul></div>` : ""}
  </div>
  <div class="card"><h3>Ideas for ${esc(p.name)}</h3>${noteBox("ort-"+place, "Tips from friends, ideas, finds …")}</div>`;
  v.querySelector(".placetabs").addEventListener("click", e => { const b = e.target.closest("button"); if(!b) return; place = b.dataset.p; renderOrte(); });
  bindNotes(v);
}

/* ============ ORGA ============ */
let todoMode = "open";
function slug(s){ return s.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,""); }
function todoRow(t){
  const key = "todo-"+t.id, c = state.checks[key];
  const dl = daysUntil(t.due);
  let dueChip = dl < 0 ? `<span class="chip crit">overdue</span>` : dl <= 3 ? `<span class="chip warn">by ${fmtDue(t.due)}</span>` : `<span class="chip grey">by ${fmtDue(t.due)}</span>`;
  if(t.done) dueChip = c?.by ? `<span class="chip ok">${esc(nameOf(c.by))}</span>` : `<span class="chip ok">done</span>`;
  const prioDot = t.prio === "crit" ? '<span class="chip crit" style="margin-right:6px">important</span>' : "";
  return `<div class="todo ${t.done ? "done" : ""}">
    <input type="checkbox" class="chk" id="c-${esc(key)}" data-check="${esc(key)}" ${t.done ? "checked" : ""} ${(!state.canWrite || t.auto) ? "disabled" : ""} aria-label="${esc(t.t)} done">
    <label class="tt" for="c-${esc(key)}"><b>${prioDot}${esc(t.t)}</b>${claudeChip(t.c)}${t.sub ? `<div class="sub">${esc(t.sub)}</div>` : ""}${t.link && /^https:\/\//.test(t.link) ? `<div class="sub"><a href="${esc(t.link)}" target="_blank" rel="noopener">${esc(t.link.replace(/^https?:\/\//,""))}</a></div>` : ""}${t.auto ? '<div class="sub">Ticks itself once all confirmations are uploaded.</div>' : ""}</label>
    <span class="due">${dueChip}</span></div>`;
}
function renderOrga(){
  const v = $("#v-orga");
  const todos = openTodos().sort((a,b) => (a.done - b.done) || a.due.localeCompare(b.due));
  const shown = todoMode === "open" ? todos.filter(t => !t.done) : todos;
  const emergency = [...(T.emergency||[]), ...EMERGENCY], facts = [...(T.goodToKnow||[]), ...FACTS];
  const ps = packStats();
  v.innerHTML = `<div class="sechead"><h2>Prep</h2><span class="small muted">${PLURAL ? "Everyone in the group sees the ticks" : "Everything is saved"}</span></div>
  <div class="card">
    <div class="sechead"><h3>To-dos before the trip</h3>
      <div class="seg" role="group" aria-label="Filter"><button type="button" data-m="open" aria-pressed="${todoMode==="open"}">Open</button><button type="button" data-m="all" aria-pressed="${todoMode==="all"}">All</button></div></div>
    <div>${shown.map(todoRow).join("") || '<p class="muted">All done. Nice.</p>'}</div>
    ${state.canWrite ? `<form class="addrow" id="addTodo"><input id="todoText" placeholder="New to-do" maxlength="140" required><input id="todoDue" type="date" value="${esc(T.start.slice(0,10))}" aria-label="Due on"><button class="btn" type="submit">Add</button></form>` : ""}
  </div>
  <div class="card">
    <div class="sechead"><h3>Packing list</h3><span class="small muted">${ps.done} of ${ps.total} packed</span></div>
    <div class="bar" style="margin-bottom:12px"><i style="width:${Math.round(ps.done/Math.max(ps.total,1)*100)}%"></i></div>
    <div class="grid2">${PACK.map(c => {
      const extra = state.packExtra.filter(p => p.cat === c.cat);
      const ids = c.items.map((_,i) => `pack-${slug(c.cat)}-${i}`).concat(extra.map(p => "pack-x-"+p.id));
      const d = ids.filter(id => state.checks[id]?.done).length;
      return `<div class="packcat"><h3>${esc(c.cat)} <span class="small muted">${d}/${ids.length}</span></h3>
        ${c.items.map((it,i) => packRow(`pack-${slug(c.cat)}-${i}`, it)).join("")}
        ${extra.map(p => packRow("pack-x-"+p.id, p.text, p.id)).join("")}</div>`;
    }).join("")}</div>
    ${state.canWrite ? `<form class="addrow" id="addPack"><input id="packText" placeholder="Missing something? e.g. playing cards" maxlength="80" required><select id="packCat" aria-label="Category">${PACK.map(c => `<option>${esc(c.cat)}</option>`).join("")}</select><button class="btn" type="submit">Add</button></form>` : ""}
  </div>
  <div class="grid2">
    <div class="card hl"><h3>Money</h3>
      ${MONEY.length ? `<ul class="dots">${MONEY.map(m => `<li>${esc(m)}</li>`).join("")}</ul>` : ""}
      ${noteBox("geld","Exchange rates, cash withdrawn, notes …")}
    </div>
    <div class="card crit"><h3>Emergency</h3>
      ${emergency.length ? `<dl class="kv">${emergency.map(([k,val]) => `<dt>${esc(k)}</dt><dd>${esc(val)}</dd>`).join("")}</dl>` : ""}
      <p class="small muted" style="margin:8px 0 6px">Double-check embassy contacts shortly before departure.</p>
      ${noteBox("notfall","Insurance hotline, policy number, emergency contacts at home …")}
    </div>
  </div>
  ${facts.length ? `<div class="card"><h3>Good to know</h3><dl class="kv">${facts.map(([k,val]) => `<dt>${esc(k)}</dt><dd>${esc(val)}</dd>`).join("")}</dl></div>` : ""}`;
  bindChecks(v); bindNotes(v);
  v.querySelector(".seg").addEventListener("click", e => { const b = e.target.closest("button"); if(!b) return; todoMode = b.dataset.m; renderOrga(); });
  const ft = v.querySelector("#addTodo");
  if(ft) ft.addEventListener("submit", async e => { e.preventDefault(); const text = $("#todoText").value.trim(); if(!text) return;
    await safeWrite(() => state.db.collection("todoextra").add({text, due: $("#todoDue").value || T.start.slice(0,10), by: state.me, at: Date.now()})); });
  const fp = v.querySelector("#addPack");
  if(fp) fp.addEventListener("submit", async e => { e.preventDefault(); const text = $("#packText").value.trim(); if(!text) return;
    await safeWrite(() => state.db.collection("packextra").add({text, cat: $("#packCat").value, by: state.me, at: Date.now()})); });
}
function packRow(key, label, extraId){
  const c = state.checks[key];
  return `<div class="pk ${c?.done ? "done" : ""}">
    <input type="checkbox" class="chk" id="c-${esc(key)}" data-check="${esc(key)}" ${c?.done ? "checked" : ""} ${state.canWrite ? "" : "disabled"}>
    <label for="c-${esc(key)}"><span class="l">${esc(label)}</span></label>
    <span class="who">${c?.done && c.by ? esc(nameOf(c.by)) : ""}${extraId && state.canWrite ? ` <button class="copy" type="button" data-delpack="${esc(extraId)}" aria-label="Remove ${esc(label)}">remove</button>` : ""}</span></div>`;
}

/* ============ KOSTEN ============ */
const CURS = T.currencies && T.currencies.length ? T.currencies : [BASE];
const OTHER_CURS = CURS.filter(c => c !== BASE);
const CATS = T.costCategories || ["Other"];
const money = n => n.toLocaleString("en-GB",{style:"currency",currency:BASE});
function toBase(c){ if(c.cur === BASE) return c.amount; const r = Number(state.rates[c.cur]); return r > 0 ? c.amount / r : null; }
function sharers(c){ return (!c.split || c.split === "all" || c.split === "half") ? PEOPLE.map(p => p.key) : [c.split]; }
function costSummary(){
  const paid = {}, share = {}; PEOPLE.forEach(p => { paid[p.key] = 0; share[p.key] = 0; });
  let total = 0, missing = 0; const byCat = {};
  state.costs.forEach(c => { const e = toBase(c); if(e == null){ missing++; return; }
    total += e; paid[c.payer] = (paid[c.payer]||0) + e;
    const who = sharers(c); who.forEach(k => share[k] = (share[k]||0) + e/who.length);
    byCat[c.cat||"Other"] = (byCat[c.cat||"Other"]||0) + e; });
  // Ausgleich: wer zu wenig gezahlt hat, überweist an wen zu viel gezahlt hat
  const bal = PEOPLE.map(p => ({k:p.key, v:(paid[p.key]||0) - (share[p.key]||0)}));
  const debt = bal.filter(b => b.v < -0.5).map(b => ({...b, v:-b.v})).sort((a,b) => b.v-a.v);
  const cred = bal.filter(b => b.v > 0.5).sort((a,b) => b.v-a.v);
  const transfers = [];
  for(const d of debt){ for(const c of cred){ if(d.v < 0.5) break; if(c.v < 0.5) continue; const x = Math.min(d.v, c.v); transfers.push([d.k, c.k, x]); d.v -= x; c.v -= x; } }
  return {paid, share, total, missing, byCat, transfers};
}
let costPrefill = null;
function renderKosten(){
  const v = $("#v-kosten"); const S = costSummary(); const f = costPrefill || {};
  const settle = !PLURAL ? `<b>${money(S.total)}</b><span class="muted">Spent so far</span>`
    : S.transfers.length ? S.transfers.map(([a,b,x]) => `<b>${esc(personName(a))} → ${esc(personName(b))} ${money(x)}</b>`).join("") + `<span class="muted">How to settle up</span>`
    : `<b>All square</b><span class="muted">Nobody owes anybody anything</span>`;
  const maxCat = Math.max(1, ...Object.values(S.byCat));
  const fmtAmt = c => `${c.amount.toLocaleString("en-GB",{maximumFractionDigits:2})} ${c.cur}`;
  const splitLabel = c => sharers(c).length === PEOPLE.length && PLURAL ? "everyone" : "only " + personName(sharers(c)[0]);
  v.innerHTML = `<div class="sechead"><h2>Costs${PLURAL ? " &amp; settling up" : ""}</h2><span class="small muted">Everything converted to ${esc(BASE)}</span></div>
  <div class="card hl settle">${settle}${S.missing ? `<span class="chip warn" style="justify-self:center">${S.missing} expense(s) without exchange rate, add a rate below</span>` : ""}</div>
  ${PLURAL ? `<div class="stats"><div class="stat"><b class="money">${money(S.total)}</b><span>Total</span></div>
    ${PEOPLE.map(p => `<div class="stat"><b class="money">${money(S.paid[p.key]||0)}</b><span>paid by ${esc(p.name)} · share ${money(S.share[p.key]||0)}</span></div>`).join("")}</div>` : ""}
  ${state.canWrite && state.db ? `<div class="card"><h3>Add expense</h3>
    ${QUICK.length ? `<div class="quick" style="margin-bottom:10px"><span class="small muted">Quick: </span>${QUICK.map((q,i) => `<button type="button" data-quick="${i}">${esc(q.what)}</button>`).join("")}</div>` : ""}
    <form class="costform" id="costForm">
      <label class="wide">What for?<input id="cWhat" required maxlength="100" value="${esc(f.what||"")}" placeholder="e.g. dinner"></label>
      <label>Amount<input id="cAmt" type="number" step="0.01" min="0" required inputmode="decimal" value="${esc(f.amount ?? "")}"></label>
      <label>Currency<select id="cCur">${CURS.map(c => `<option ${c === (f.cur||BASE) ? "selected" : ""}>${esc(c)}</option>`).join("")}</select></label>
      <label ${PLURAL ? "" : "hidden"}>Paid by<select id="cPayer">${PEOPLE.map(p => `<option value="${esc(p.key)}">${esc(p.name)}</option>`).join("")}</select></label>
      <label ${PLURAL ? "" : "hidden"}>For whom?<select id="cSplit"><option value="all">split equally</option>${PEOPLE.map(p => `<option value="${esc(p.key)}">only ${esc(p.name)}</option>`).join("")}</select></label>
      <label>Category<select id="cCat">${CATS.map(c => `<option ${c === f.cat ? "selected" : ""}>${esc(c)}</option>`).join("")}</select></label>
      <label>Date<input id="cDate" type="date" value="${esc(f.date || new Date().toISOString().slice(0,10))}"></label>
      <div class="wide"><button class="btn" type="submit">Save</button> <span class="small muted" id="cMsg"></span></div>
    </form></div>` : ""}
  <div class="card"><div class="sechead"><h3>All expenses</h3><span class="small muted">${state.costs.length} entries</span></div>
    ${state.costs.length ? state.costs.map(c => { const e = toBase(c); return `<div class="costrow">
      <div><b>${esc(c.what)}</b><div class="meta">${esc(c.date ? fmtDue(c.date) : "")} · ${esc(c.cat||"")}${PLURAL ? ` · paid by ${esc(personName(c.payer))} · ${esc(splitLabel(c))}` : ""}</div></div>
      <div style="text-align:right"><b class="money">${e == null ? "?" : money(e)}</b>${c.cur !== BASE ? `<div class="meta money">${esc(fmtAmt(c))}</div>` : ""}${state.canWrite ? `<div><button class="copy" type="button" data-delcost="${esc(c.id)}">delete</button></div>` : ""}</div></div>`; }).join("")
      : '<p class="muted">No expenses yet.</p>'}
  </div>
  <div class="grid2">
    <div class="card"><h3>By category</h3><div class="catbars">${Object.entries(S.byCat).sort((a,b) => b[1]-a[1]).map(([k,val]) => `<div><span>${esc(k)}</span><i style="width:${Math.max(4,Math.round(val/maxCat*100))}%"></i><span class="money">${money(val)}</span></div>`).join("") || '<p class="muted small">Nothing yet.</p>'}</div></div>
    ${OTHER_CURS.length ? `<div class="card"><h3>Exchange rates</h3><p class="small muted" style="margin:0 0 8px">How much do you get for 1 ${esc(BASE)}? Enter the rate you actually got.</p>
      <form class="costform" id="rateForm">${OTHER_CURS.map(c => `<label>1 ${esc(BASE)} = … ${esc(c)}<input type="number" step="any" min="0" id="r-${esc(c)}" value="${esc(state.rates[c] ?? "")}" ${state.canWrite ? "" : "readonly"}></label>`).join("")}
      ${state.canWrite ? `<div class="wide"><button class="btn ghost" type="submit">Save rates</button></div>` : ""}</form></div>` : ""}
  </div>`;
  v.querySelectorAll("[data-quick]").forEach(b => b.addEventListener("click", () => { costPrefill = QUICK[+b.dataset.quick]; renderKosten(); $("#cAmt").focus(); }));
  const cf = v.querySelector("#costForm");
  if(cf) cf.addEventListener("submit", async e => { e.preventDefault();
    const amount = parseFloat($("#cAmt").value); if(!(amount >= 0)) return;
    const ok = await safeWrite(() => state.db.collection("kosten").add({what: $("#cWhat").value.trim(), amount, cur: $("#cCur").value, payer: $("#cPayer").value, split: $("#cSplit").value, cat: $("#cCat").value, date: $("#cDate").value, by: state.me, at: Date.now()}));
    if(ok){ costPrefill = null; cf.reset(); $("#cMsg").textContent = "Saved"; } });
  const rf = v.querySelector("#rateForm");
  if(rf) rf.addEventListener("submit", async e => { e.preventDefault();
    const o = {}; OTHER_CURS.forEach(c => { const n = parseFloat($("#r-"+c).value); if(n > 0) o[c] = n; });
    await safeWrite(() => state.db.doc("settings/rates").set({...o, by: state.me, at: Date.now()})); });
  v.querySelectorAll("[data-delcost]").forEach(b => b.addEventListener("click", async () => {
    if(b.dataset.armed !== "1"){ b.dataset.armed = "1"; b.textContent = "really delete?"; return; }
    await safeWrite(() => state.db.doc("kosten/" + b.dataset.delcost).delete()); }));
}

/* ============ CLAUDE ============ */
const CLAUDE_URL = T.claudeUrl || "";
function renderClaude(){
  const v = $("#v-claude"); const W = state.wishes || []; const open = W.filter(w => !w.done);
  v.innerHTML = `<div class="sechead"><h2>Wishes & ideas</h2></div>
  ${CLAUDE_URL ? `<div class="card hl"><h3>Chat with Claude</h3>
    <p style="margin:0 0 10px">Opens the conversation where this app is being built.</p>
    <a class="btn" href="${esc(CLAUDE_URL)}" target="_blank" rel="noopener" style="text-decoration:none">Open chat</a></div>` : ""}
  <div class="card"><div class="sechead"><h3>Wish list</h3><span class="small muted">${open.length} open</span></div>
    <p class="small muted" style="margin:0 0 8px">Collect ideas and bugs for the app, even offline. Victor passes them on.</p>
    ${state.canWrite ? `<form class="addrow" id="wishForm"><input id="wishText" maxlength="500" required placeholder="e.g. split the packing list by person"><button class="btn" type="submit">Add</button></form>` : ""}
    <div style="margin-top:8px">${W.map(w => `<div class="wish ${w.done ? "done" : ""}"><input type="checkbox" class="chk" data-wish="${esc(w.id)}" ${w.done ? "checked" : ""} aria-label="done"><div><div class="wt">${esc(w.text)}</div><div class="small muted">${nameOf(w.by) ? esc(nameOf(w.by)) + " · " : ""}${new Date(w.at).toLocaleDateString("en-GB",{day:"numeric",month:"short"})}</div></div><button class="copy" type="button" data-delwish="${esc(w.id)}">delete</button></div>`).join("") || '<p class="muted small">No wishes yet.</p>'}</div>
    ${open.length ? `<div style="margin-top:12px;display:grid;gap:6px"><button class="btn wa" type="button" id="wishSend" style="background:var(--accent);border-color:var(--accent)">Copy open wishes${CLAUDE_URL ? " & open chat" : ""}</button><span class="small muted" id="wishMsg">The text goes to your clipboard, ready to paste into a message.</span></div>` : ""}
  </div>
  <div class="card"><h3>Good to know</h3><ul class="dots"><li>No signal? Jot wishes down here and send them later.</li><li>App updates go live 1–2 minutes after they're made. Reopen the app once to see them.</li></ul></div>`;
  const f = $("#wishForm"); if(f) f.addEventListener("submit", async e => { e.preventDefault(); const t = $("#wishText").value.trim(); if(!t) return; await safeWrite(() => state.db.collection("wishes").add({text: t, done: false, at: Date.now()})); });
  v.querySelectorAll("[data-wish]").forEach(cb => cb.addEventListener("change", async () => { const w = W.find(x => x.id === cb.dataset.wish); if(!w) return; const { id, ...rest } = w; await safeWrite(() => state.db.doc("wishes/" + id).set({...rest, done: cb.checked})); }));
  v.querySelectorAll("[data-delwish]").forEach(b => b.addEventListener("click", async () => { if(b.dataset.armed !== "1"){ b.dataset.armed = "1"; b.textContent = "really?"; return; } await safeWrite(() => state.db.doc("wishes/" + b.dataset.delwish).delete()); }));
  const s = $("#wishSend"); if(s) s.addEventListener("click", async () => {
    const txt = "Wishes for the trip app \"" + T.title + " " + T.titleAccent + "\":\n" + open.map((w,i) => `${i+1}. ${w.text}${nameOf(w.by) ? " (" + nameOf(w.by) + ")" : ""}`).join("\n");
    try{ await navigator.clipboard.writeText(txt); $("#wishMsg").textContent = "Copied. Paste it into a message."; }catch(e){ $("#wishMsg").textContent = "Copying didn't work, please type the wishes out."; }
    if(CLAUDE_URL) window.open(CLAUDE_URL, "_blank", "noopener");
  });
}

/* ============ BINDINGS ============ */
async function safeWrite(fn){
  if(!state.db){ showBanner("Can't save right now: not connected. Please open the cockpit while logged in."); return false; }
  try{ await fn(); return true; }
  catch(e){
    if(e && e.code === "invalid_argument"){ state.canWrite = false; showBanner("You only have read access here."); renderAll(); }
    else if(e && e.code === "unavailable"){ await new Promise(r => setTimeout(r, 600 + Math.random()*800)); try{ await fn(); return true; }catch(_){ showBanner("Saving didn't work. Please try again in a moment."); } }
    else showBanner("Saving didn't work" + (e && e.message ? ": " + e.message : "") + ".");
    return false;
  }
}
function bindChecks(root){
  root.querySelectorAll("[data-check]").forEach(el => el.addEventListener("change", async () => {
    const key = el.dataset.check;
    await safeWrite(() => state.db.doc("checks/" + key).set({done: el.checked, by: state.me, at: Date.now()}));
  }));
  root.querySelectorAll("[data-delpack]").forEach(b => b.addEventListener("click", async () => {
    const id = b.dataset.delpack;
    await safeWrite(() => state.db.doc("packextra/" + id).delete());
  }));
}
const noteTimers = {};
function bindNotes(root){
  root.querySelectorAll("textarea[data-note]").forEach(t => {
    t.addEventListener("input", () => {
      const key = t.dataset.note;
      clearTimeout(noteTimers[key]);
      const meta = root.querySelector(`[data-meta="${CSS.escape(key)}"]`);
      if(meta) meta.textContent = "typing …";
      noteTimers[key] = setTimeout(async () => {
        const ok = await safeWrite(() => state.db.doc("notes/" + key).set({text: t.value.slice(0,4000), by: state.me, at: Date.now()}));
        if(meta) meta.textContent = ok ? "saved" : "not saved";
      }, 900);
    });
  });
}
function bindUploads(root){
  root.querySelectorAll("input[data-upload]").forEach(inp => inp.addEventListener("change", async () => {
    const slot = inp.dataset.upload;
    const st = root.querySelector(`[data-upstatus="${CSS.escape(slot)}"]`);
    const files = [...inp.files]; if(!files.length || !state.assets) return;
    const done = [...(state.uploads[slot]?.files || [])];
    for(const [i,f] of files.entries()){
      if(st) st.textContent = `Uploading ${i+1} of ${files.length} …`;
      try{
        const type = f.type || (f.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "");
        const r = await Promise.race([state.assets.upload(f, type ? {type} : undefined), new Promise((_, rej) => setTimeout(() => rej({code:"timeout"}), Math.max(60000, f.size / 15)))]);
        done.push({id: r.id, name: f.name.slice(0,120), type: r.contentType});
      }catch(e){
        console.warn(e);
        const msg = {too_large:"File too large (max. 20 MB)",unsupported_type:"Images or PDF only",rate_limited:"Too many uploads, wait a moment",quota_or_state:"Storage full",forbidden:"No permission to upload (log out and in again)",timeout:"Upload took too long. Check the connection and try again"}[e?.code] || ("Upload failed" + (e && e.message ? ": " + e.message : ""));
        if(st) st.textContent = msg; inp.value = ""; return;
      }
    }
    const ok = await safeWrite(() => state.db.doc("uploads/" + slot).set({files: done, by: state.me, at: Date.now()}));
    if(st) st.textContent = ok ? "Done" : "Uploaded, but not saved";
    inp.value = "";
  }));
}
function bindCopy(root){
  root.querySelectorAll("[data-copy]").forEach(b => b.addEventListener("click", async () => {
    try{ await navigator.clipboard.writeText(b.dataset.copy); b.textContent = "Copied"; setTimeout(() => b.textContent = "Copy", 1400); }
    catch(e){ b.textContent = "Please select"; }
  }));
}
function showBanner(t){ const b = $("#banner"); b.textContent = t; b.hidden = false; }

/* ============ ROUTING ============ */
const VIEWS = ["heute","plan","buchungen","orte","posten","kosten","orga","claude"];
let current = "heute";
function route(){
  const h = location.hash.replace("#","");
  current = VIEWS.includes(h) ? h : "heute";
  VIEWS.forEach(v => $("#v-"+v).classList.toggle("on", v === current));
  document.querySelectorAll("nav.tabs a").forEach(a => a.toggleAttribute("aria-current", a.getAttribute("href") === "#"+current) || a.removeAttribute("aria-current"));
  document.querySelectorAll("nav.tabs a").forEach(a => { if(a.getAttribute("href") === "#"+current) a.setAttribute("aria-current","page"); else a.removeAttribute("aria-current"); });
  renderCurrent();
}
function renderCurrent(){
  const active = document.activeElement;
  // Nicht neu zeichnen, während jemand in ein Notizfeld schreibt
  if(active && active.matches && active.matches("textarea[data-note], .addrow input, .addrow select, .costform input, .costform select")) return;
  ({heute:renderHeute,plan:renderPlan,buchungen:renderBuchungen,orte:renderOrte,posten:()=>{},kosten:renderKosten,orga:renderOrga,claude:renderClaude})[current]();
}
function renderAll(){ renderCount(); renderCurrent(); }
window.addEventListener("hashchange", () => { route(); window.scrollTo(0,0); });

/* ============ START: Supabase-Anbindung (offline-fähig) ============ */
const CACHE_KEY = "cockpit-cache-" + T.id, OPS_KEY = "cockpit-ops-" + T.id;
const ls = { get(k){ try{ return JSON.parse(localStorage.getItem(k)); }catch(e){ return null; } }, set(k,v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }, del(k){ try{ localStorage.removeItem(k); }catch(e){} } };
const SBC = window.SB;
let ROWS = {};      // coll -> id -> data
let OPS = ls.get(OPS_KEY) || [];
let signed = {};    // Pfad -> signierte URL
let signedAt = Date.now();
function applyTrip(t){
  if(!t) return;
  DAYS = (t.days || []).slice().sort((a,b) => (a.date||"").localeCompare(b.date||"")); FLIGHTS = t.flights || []; STAYS = t.stays || []; TRANSFERS = t.transfers || [];
  TODOS = t.todos || []; PACK = t.pack || []; GUIDES = t.guides || {}; QUICK = t.quick || []; ALERTS = t.alerts || [];
  MONEY = t.money || []; EMERGENCY = t.emergency || []; FACTS = t.facts || [];
  EMAILS = Object.fromEntries(Object.entries(t.emails || {}).map(([e,k]) => [e.toLowerCase(), k]));
}
function rowsToState(){
  const c = n => ROWS[n] || {};
  const list = n => Object.entries(c(n)).map(([id,d]) => ({id, ...d}));
  applyTrip(c("private").trip);
  state.checks = c("checks"); state.notes = c("notes"); state.uploads = c("uploads");
  state.packExtra = list("packextra"); state.todoExtra = list("todoextra");
  state.costs = list("kosten").sort((a,b) => (b.date||"").localeCompare(a.date||"") || (b.at||0)-(a.at||0));
  state.rates = c("settings").rates || {};
  state.wishes = list("wishes").sort((a,b) => (a.done - b.done) || (b.at||0)-(a.at||0));
}
function localApply(op){
  ROWS[op.coll] = ROWS[op.coll] || {};
  if(op.op === "set") ROWS[op.coll][op.id] = op.data; else delete ROWS[op.coll][op.id];
}
const uid = () => (crypto.randomUUID && crypto.randomUUID()) || ("x" + Date.now() + Math.random().toString(36).slice(2));
let flushing = false;
async function flushOps(){
  if(flushing || !OPS.length || navigator.onLine === false) { updateSync(); return; }
  flushing = true;
  while(OPS.length){
    const op = OPS[0];
    try{
      const q = op.op === "set"
        ? SBC.from("cockpit_items").upsert({ coll: op.coll, id: op.id, data: op.data })
        : SBC.from("cockpit_items").delete().eq("coll", op.coll).eq("id", op.id);
      const { error } = await q; if(error) throw error;
      OPS.shift(); ls.set(OPS_KEY, OPS);
    }catch(e){ console.warn(e); break; }
  }
  flushing = false; updateSync();
}
function enqueue(op){ localApply(op); OPS.push(op); ls.set(OPS_KEY, OPS); ls.set(CACHE_KEY, ROWS); rowsToState(); queueRender(); flushOps(); }
// Adapter mit derselben Schnittstelle wie zuvor (doc/collection)
const dbAdapter = {
  doc(path){ const [coll, id] = path.split("/"); return {
    set: async data => { enqueue({ op:"set", coll: coll === "settings" ? "settings" : coll, id, data: { ...data, by: state.me } }); },
    delete: async () => { enqueue({ op:"del", coll, id }); } }; },
  collection(coll){ return { add: async data => { const id = uid(); enqueue({ op:"set", coll, id, data: { ...data, by: state.me } }); return { id }; } }; }
};
// Datei-Ablage für Belege: privater Speicher, nur für die Redaktion
const assetsAdapter = {
  async upload(file, opt){
    const type = (opt && opt.type) || file.type || "application/octet-stream";
    const path = `belege/${uid()}-${(file.name || "datei").replace(/[^a-zA-Z0-9._-]/g,"_").slice(0,60)}`;
    const { error } = await SBC.storage.from("private").upload(path, file, { contentType: type, upsert: false });
    if(error){ const m = error.message || ""; throw { code: /size|too large|exceed/i.test(m) ? "too_large" : /mime|type/i.test(m) ? "unsupported_type" : /security|policy|unauthor|forbidden|403/i.test(m) ? "forbidden" : "upstream_error", message: m }; }
    await signPaths([path]);
    return { id: path, url: signed[path], contentType: type };
  }
};
async function signPaths(paths){
  const need = paths.filter(p => p && !signed[p]); if(!need.length) return;
  try{ const { data } = await SBC.storage.from("private").createSignedUrls(need, 60*60*2); (data||[]).forEach(x => { if(x.signedUrl) signed[x.path] = x.signedUrl; }); }catch(e){}
}
function blobUrl(id){ return signed[id] || "#"; }
function updateSync(){
  const off = navigator.onLine === false;
  $("#offline").hidden = !off;
  $("#sync").textContent = off ? "Offline · last loaded version" : OPS.length ? `${OPS.length} change(s) waiting for signal …` : (PLURAL ? "Connected · others see changes next time they load" : "Connected");
}
async function pull(){
  if(navigator.onLine === false) return;
  const { data, error } = await SBC.from("cockpit_items").select("coll,id,data").limit(5000);
  if(error){ console.warn(error); return; }
  const fresh = {}; (data||[]).forEach(r => { (fresh[r.coll] = fresh[r.coll] || {})[r.id] = r.data; });
  ROWS = fresh; OPS.forEach(localApply);   // eigene, noch nicht gesendete Änderungen behalten
  ls.set(CACHE_KEY, ROWS);
  if(Date.now() - signedAt > 90*60*1000){ signed = {}; signedAt = Date.now(); }
  const paths = Object.values(ROWS.uploads || {}).flatMap(u => (u.files||[]).map(f => f.id));
  await signPaths(paths);
  rowsToState(); queueRender();
}
async function loadWeatherOM(){
  if(navigator.onLine === false) return;
  const L = T.weather || []; if(!L.length) return;
  const url = "https://api.open-meteo.com/v1/forecast?latitude=" + L.map(l => l.lat).join(",") + "&longitude=" + L.map(l => l.lon).join(",") + "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_gusts_10m_max&timezone=auto&forecast_days=7";
  try{
    const r = await fetch(url); const j = await r.json(); const arr = Array.isArray(j) ? j : [j];
    const TXT = {0:"Clear",1:"Mostly clear",2:"Partly cloudy",3:"Overcast",45:"Fog",48:"Fog",51:"Drizzle",53:"Drizzle",55:"Drizzle",61:"Light rain",63:"Rain",65:"Heavy rain",71:"Light snow",73:"Snow",75:"Heavy snow",80:"Showers",81:"Showers",82:"Heavy showers",85:"Snow showers",86:"Snow showers",95:"Thunderstorm",96:"Thunderstorm",99:"Thunderstorm"};
    state.wx = { updated: new Date().toISOString(), places: arr.map((x,i) => ({ key: L[i].key, name: L[i].name, days: (x.daily.time||[]).map((d,k) => ({ date: d, hi: Math.round(x.daily.temperature_2m_max[k]), lo: Math.round(x.daily.temperature_2m_min[k]), text: [TXT[x.daily.weather_code[k]] || "", x.daily.precipitation_probability_max[k] ? x.daily.precipitation_probability_max[k] + "% rain" : ""].filter(Boolean).join(", "), wind: "gusts " + Math.round(x.daily.wind_gusts_10m_max[k]) + " km/h" })) })) };
    ls.set("cockpit-wx", state.wx); queueRender();
  }catch(e){ state.wx = ls.get("cockpit-wx"); }
}
function showGate(msg, email){
  document.querySelector("nav.tabs").hidden = true;
  document.querySelector("main").innerHTML = `<div class="gate card"><h2>Cockpit</h2><p class="muted" style="margin:0">Only for ${esc(NAMES)}.</p>
    ${msg ? `<p class="banner" style="margin:0">${esc(msg)}</p>` : ""}
    ${email ? `<button class="btn ghost" type="button" id="cOut">Log out (${esc(email)})</button>` : `<form class="login" id="cLogin"><label class="small" for="cEmail">Your email address</label><input type="email" id="cEmail" required autocomplete="email" inputmode="email" placeholder="name@example.com">
      <label class="small" for="cPw">Password</label><input type="password" id="cPw" autocomplete="current-password" placeholder="Leave empty for a login link">
      <button class="btn" type="submit">Log in</button><div class="msg" id="cMsg" aria-live="polite"></div></form>`}
    <a href="index.html" class="small">Go to the public blog</a></div>`;
  const out = $("#cOut"); if(out) out.addEventListener("click", async () => { await SBC.auth.signOut(); location.reload(); });
  const f = $("#cLogin"); if(f) f.addEventListener("submit", async e => { e.preventDefault();
    const email = $("#cEmail").value.trim(), pw = $("#cPw").value;
    $("#cMsg").textContent = "Logging in …";
    try{
    if(pw){ const { error } = await SBC.auth.signInWithPassword({ email, password: pw }); if(error){ console.warn(error); $("#cMsg").textContent = /invalid/i.test(error.message||"") ? "Wrong email or password." : "Login failed: " + error.message; } else location.reload(); return; }
    const { error } = await SBC.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: location.origin + location.pathname } });
    if(error) console.warn(error); $("#cMsg").textContent = error ? (window.loginErrorText ? window.loginErrorText(error) : error.message) : "Link sent. Open the email on this device and tap it.";
    }catch(err){ console.error(err); $("#cMsg").textContent = "Login failed: " + (err && err.message || err); } });
}

let renderQueued = false;
function queueRender(){ if(renderQueued) return; renderQueued = true; requestAnimationFrame(() => { renderQueued = false; renderAll(); }); }

function applyHeader(){
  document.title = (T.cockpitTitle || ["Trip","Cockpit"]).join(" ");
  const h1 = document.querySelector(".top h1"); if(h1) h1.innerHTML = `${esc((T.cockpitTitle||["Trip"])[0])} <span>${esc((T.cockpitTitle||["","Cockpit"])[1] || "Cockpit")}</span>`;
  const eb = document.querySelector(".top .eyebrow"); if(eb) eb.textContent = `${NAMES} · ${T.dateLabel || ""}`;
  const rl = document.querySelector(".top .route"); if(rl) rl.textContent = T.routeLine || "";
  const hero = document.querySelector(".heroimg"); if(hero && T.cockpitHero) hero.style.backgroundImage = `url("${T.cockpitHero}")`;
  if(!(T.features||{}).costs){ const a = document.querySelector('nav.tabs a[href="#kosten"]'); if(a) a.remove(); }
  if(!(T.features||{}).blog){ document.querySelectorAll('nav.tabs a[href="#posten"], nav.tabs a[href="index.html"]').forEach(a => a.remove()); }
  if((T.features||{}).wishes === false){ const a = document.querySelector('nav.tabs a[href="#claude"]'); if(a) a.remove(); }
}
applyHeader();

(async function start(){
  if(!SBC){ showGate("The database isn't set up yet."); return; }
  const cache = ls.get(CACHE_KEY);
  const { data: { session } } = await SBC.auth.getSession();
  if(!session){ ls.del(CACHE_KEY); ls.del(OPS_KEY); showGate("You're not logged in on this browser yet."); return; }
  state.me = (session.user.email || "").toLowerCase();
  state.db = dbAdapter; state.assets = assetsAdapter; state.canWrite = true;
  if(cache){ ROWS = cache; OPS.forEach(localApply); rowsToState(); }
  state.wx = ls.get("cockpit-wx");
  renderCount(); route(); updateSync();
  if(navigator.onLine !== false){
    const { data: ok } = await SBC.rpc("is_editor");
    if(!ok){ showGate("Logged in, but this address isn't on the editor list or isn't confirmed yet.", state.me); return; }
  }
  await flushOps(); await pull(); loadWeatherOM();
  window.addEventListener("online", async () => { updateSync(); await flushOps(); await pull(); });
  window.addEventListener("offline", updateSync);
  document.addEventListener("visibilitychange", async () => { if(document.visibilityState === "visible"){ await flushOps(); await pull(); } });
  setInterval(async () => { if(document.visibilityState !== "visible") return; const a = document.activeElement; if(a && a.matches("input,textarea,select")) return; await flushOps(); await pull(); }, 30000);
  SBC.auth.onAuthStateChange(ev => { if(ev === "SIGNED_OUT"){ ls.del(CACHE_KEY); ls.del(OPS_KEY); location.reload(); } });
})();

})();
