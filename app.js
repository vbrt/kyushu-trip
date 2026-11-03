(function(){
"use strict";
const CFG = window.APP_CONFIG || {};
const DEMO = !CFG.supabaseUrl || !CFG.supabaseAnonKey;
const sb = window.SB || (!DEMO && window.supabase ? window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey) : null);
window.SB = sb;
const MODE = window.APP_MODE || "blog";
const ROOT_ID = window.APP_ROOT || "app";
const T = window.TRIP;
const STOPS = T.stops || [], PLACES = T.places || ["On the road"], STATUSES = T.statuses || [""], REACTIONS = T.reactions || ["❤️"], PLACEINFO = T.placeInfo || [], WXLOC = T.weather || [];
const PEOPLE = Object.fromEntries((T.people || []).map(p => [p.key, p]));
const FIRST = (T.people && T.people[0] && T.people[0].key) || "ich";
const NAMES = (a => a.length > 1 ? a.slice(0,-1).join(", ") + " & " + a[a.length-1] : a.join(""))((T.people || []).map(p => p.name));
const PLURAL = (T.people || []).length > 1;
const SITE = CFG.siteUrl || location.href.split("#")[0].split("?")[0];
const BUCKET = "media";

const S = { posts: [], reactions: {}, comments: {}, editor: false, session: null, wx: null, wxErr: false, lastShare: null, loading: true };

/* ---------- Helfer ---------- */
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const d0 = () => { const n = new Date(); return n.getFullYear()+"-"+String(n.getMonth()+1).padStart(2,"0")+"-"+String(n.getDate()).padStart(2,"0"); };
const fmtDate = ts => { const d = new Date(ts); return d.toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"long"}) + ", " + d.toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"}); };
const mediaUrl = path => DEMO ? path : sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
const store = { get(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }, set(k,v){ try{ localStorage.setItem(k,v); }catch(e){} } };
function stopIndex(){ const t = d0(); if(!STOPS.length || t < STOPS[0].from) return -1; return STOPS.findIndex(s => t >= s.from && t <= s.to); }

/* ---------- Laden ---------- */
async function loadAll(){
  if(DEMO){ demoData(); S.loading = false; return; }
  const [p, r, c] = await Promise.all([
    sb.from("posts").select("*").order("created_at", {ascending:false}).limit(200),
    sb.from("reactions").select("post_id,emoji"),
    sb.from("comments").select("id,post_id,name,body,created_at").order("created_at", {ascending:true})
  ]);
  if(p.error) console.error(p.error);
  S.posts = p.data || [];
  S.reactions = {}; (r.data || []).forEach(x => { const o = S.reactions[x.post_id] = S.reactions[x.post_id] || {}; o[x.emoji] = (o[x.emoji]||0) + 1; });
  S.comments = {}; (c.data || []).forEach(x => (S.comments[x.post_id] = S.comments[x.post_id] || []).push(x));
  S.loading = false;
}
async function checkEditor(){
  if(DEMO){ S.editor = new URLSearchParams(location.search).has("editor"); return; }
  const { data } = await sb.auth.getSession(); S.session = data.session;
  if(!S.session){ S.editor = false; return; }
  const { data: ok } = await sb.rpc("is_editor"); S.editor = !!ok;
}
async function loadWeather(){
  const L = WXLOC;
  const url = "https://api.open-meteo.com/v1/forecast?latitude=" + L.map(l => l.lat).join(",") + "&longitude=" + L.map(l => l.lon).join(",") +
    "&current=temperature_2m,weather_code,wind_speed_10m,wind_gusts_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_gusts_10m_max&timezone=auto&forecast_days=6";
  try{ const r = await fetch(url); if(!r.ok) throw 0; const j = await r.json(); S.wx = (Array.isArray(j) ? j : [j]).map((x,i) => ({...L[i], ...x})); S.wxErr = false; }
  catch(e){ S.wxErr = true; }
}
const WMO = {0:["☀️","Clear"],1:["🌤️","Mostly clear"],2:["⛅","Partly cloudy"],3:["☁️","Overcast"],45:["🌫️","Fog"],48:["🌫️","Freezing fog"],51:["🌦️","Light drizzle"],53:["🌦️","Drizzle"],55:["🌧️","Heavy drizzle"],56:["🌧️","Freezing drizzle"],57:["🌧️","Freezing drizzle"],61:["🌧️","Light rain"],63:["🌧️","Rain"],65:["🌧️","Heavy rain"],66:["🌧️","Freezing rain"],67:["🌧️","Freezing rain"],71:["🌨️","Light snow"],73:["🌨️","Snow"],75:["❄️","Heavy snow"],77:["🌨️","Snow grains"],80:["🌦️","Showers"],81:["🌧️","Showers"],82:["⛈️","Heavy showers"],85:["🌨️","Snow showers"],86:["❄️","Heavy snow showers"],95:["⛈️","Thunderstorm"],96:["⛈️","Thunderstorm with hail"],99:["⛈️","Thunderstorm with hail"]};

function loginErrorText(error){
  const m = (error && (error.message || error.msg || "")) + "";
  if(/rate limit|too many|seconds/i.test(m)) return "Too many login emails in a short time. Please try again later or log in with your password.";
  if(/signups? not allowed|not found|user not/i.test(m)) return "This email address has no account yet.";
  if(/redirect/i.test(m)) return "The redirect address is not allowed in Supabase (URL Configuration → Redirect URLs).";
  return "Login failed: " + m;
}
window.loginErrorText = loginErrorText;
/* ---------- Render ---------- */
function render(){
  if(MODE === "studio") return renderStudioOnly();
  const si = stopIndex();
  const lastStatus = S.posts.find(p => p.status);
  const daysTo = Math.ceil((new Date(T.start.slice(0,10)+"T00:00") - new Date(new Date().toDateString()))/864e5);
  let statusHtml = "";
  if(lastStatus) statusHtml = `<div class="card status"><span class="dot" aria-hidden="true"></span><div><span class="small muted">Latest update · ${esc(fmtDate(lastStatus.created_at))} · ${esc(lastStatus.place)}</span><b>${esc(lastStatus.status)}</b></div></div>`;
  else if(daysTo > 0) statusHtml = `<div class="card status"><span class="dot" aria-hidden="true"></span><div><span class="small muted">${daysTo} ${daysTo === 1 ? "day" : "days"} to go</span><b>${PLURAL ? "Bags are being packed" : "Packing the bag"}</b></div></div>`;
  $(ROOT_ID).innerHTML = `
  ${DEMO ? '<div class="demo">Preview without database: posts are examples. This note disappears after setup.</div>' : ""}
  <header class="hero"><div class="col">
    <div class="eyebrow">${esc(T.dateLabel)}</div>
    <h1>${esc(T.title)} <span>${esc(T.titleAccent)}</span></h1>
    <p>${esc(T.intro)}</p>
  </div></header>
  <main class="col">
    ${S.editor ? studioHtml() : ""}
    ${statusHtml}
    <section class="card" aria-labelledby="h-route"><h2 id="h-route">${PLURAL ? "Where are we now?" : "Where am I now?"}</h2>
      ${window.routeMapSvg ? `<div class="rmwrap">${window.routeMapSvg(si >= 0 ? STOPS[si].key : "", STOPS.slice(0, Math.max(si,0)).map(s => s.key))}</div>` : ""}
      ${T.roadTrip ? `<p class="small muted" style="margin:4px 0 10px">🚗 Road trip: ≈ ${esc(T.roadTrip.km)} km · ${esc(T.roadTrip.note || "")}</p>` : ""}
      <ol class="route">${STOPS.map((s,i) => `<li class="${i < si ? "done" : i === si ? "now" : ""}"><span class="pin" aria-hidden="true"></span><div><div class="nm">${esc(s.nm)}${i === si ? '<span class="tag">We are here</span>' : ""}${s.tag && i !== si ? `<span class="tag">${esc(s.tag)}</span>` : ""}</div><div class="ds">${esc(s.ds)}</div>${legHtml(s.legs, s.from)}</div><span class="dt">${s.dt}</span></li>`).join("")}</ol>
      ${T.noSignalNote ? `<p class="small muted" style="margin:4px 0 0">${esc(T.noSignalNote)}</p>` : ""}
    </section>
    <section aria-labelledby="h-feed" style="display:grid;gap:16px"><h2 id="h-feed">News from the road</h2>
      ${S.loading ? '<p class="muted">Loading …</p>' : S.posts.length ? S.posts.map(postHtml).join("") : `<div class="card empty"><h3 style="font-size:1.5rem">Coming soon</h3><p class="muted" style="margin:6px 0 0">The first photos are on their way.</p></div>`}
    </section>
    ${wxHtml(si)}
    ${PLACEINFO.length ? `<section aria-labelledby="h-places" style="display:grid;gap:12px"><h2 id="h-places">Places on the route</h2>
      <div class="places">${PLACEINFO.map(pl => `<article class="card place"><h3>${esc(pl.nm)} <a class="maplink" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pl.q || pl.nm + ", Japan")}" target="_blank" rel="noopener">📍&nbsp;Map</a></h3><div class="when">${esc(pl.when)}</div><p>${esc(pl.p)}</p>${pl.f ? `<div class="fact"><b>Did you know?</b> ${esc(pl.f)}</div>` : ""}</article>`).join("")}</div></section>` : ""}
    <section aria-labelledby="h-crew" style="display:grid;gap:12px"><h2 id="h-crew">${PLURAL ? "The crew" : "About me"}</h2>
      <div class="crew">${(T.people||[]).map(p => p.key).map(k => `<div class="card mate"><img src="${PEOPLE[k].img}" alt="${PEOPLE[k].name}"><div><span class="nick">${esc(PEOPLE[k].nick)}</span><b>${PEOPLE[k].name}</b><span class="small muted">${esc(PEOPLE[k].bio)}</span></div></div>`).join("")}</div></section>
  </main>
  <footer class="col">${esc(T.footer || "")} · ${esc(NAMES)}
    <div class="team">${S.editor ? `<div class="small" style="text-align:center">Logged in as ${esc(S.session?.user?.email || "editor")}</div><a class="teambtn" href="cockpit.html" style="text-decoration:none">Open cockpit</a>${pwFormHtml()}<button class="teambtn" type="button" id="logout">Log out</button>`
      : `<button class="teambtn" type="button" id="loginToggle" aria-expanded="false" aria-controls="loginForm">Login for ${esc(NAMES)}</button>
         <form class="login" id="loginForm" hidden><label class="small" for="loginEmail">Your email address</label><input type="email" id="loginEmail" required placeholder="name@example.com" autocomplete="email" inputmode="email"><label class="small" for="loginPw">Password</label><input type="password" id="loginPw" autocomplete="current-password" placeholder="Leave empty for a login link"><button class="btn" type="submit">Log in</button><div class="msg" id="loginMsg" aria-live="polite"></div></form>`}</div>
  </footer>`;
  bind();
}
const LEGICON = { car:"🚗", ferry:"⛴️", train:"🚄", plane:"✈️", bus:"🚌" };
const fmtMin = m => m >= 60 ? Math.floor(m/60) + " h" + (m % 60 ? " " + (m % 60) + " min" : "") : m + " min";
function legHtml(legs, day){
  const L = Array.isArray(legs) ? legs : legs ? [legs] : [];
  return L.map(l => {
    const dd = l.date || day; const dl = dd ? (d => d.getDate() + " " + d.toLocaleString("en-GB",{month:"short"}))(new Date(dd + "T12:00:00")) + " · " : "";
    const meta = [l.min ? "≈ " + fmtMin(l.min) : "", l.km ? "≈ " + l.km + " km" : ""].filter(Boolean).join(" · ");
    const pct = l.min ? Math.max(8, Math.round(l.min / 330 * 100)) : 0;
    return `<div class="leg leg-${esc(l.mode)}"><span class="leg-ic" aria-hidden="true">${LEGICON[l.mode] || "•"}</span>
      <div class="leg-b"><div class="leg-t"><b><span class="leg-d">${esc(dl)}</span>${esc(l.from || "")} → ${esc(l.to || "")}</b>${meta ? `<span class="leg-m">${esc(meta)}</span>` : ""}</div>
      ${pct ? `<div class="leg-bar"><i style="width:${Math.min(100,pct)}%"></i></div>` : ""}
      ${l.who || l.text ? `<div class="leg-n">${l.who ? `<b>${esc(l.who)}:</b> ` : ""}${esc(l.text || "")}</div>` : ""}</div></div>`;
  }).join("");
}
window.legHtml = legHtml;
function pwFormHtml(){
  return `<details class="card" style="margin-top:12px"><summary><b>Change password</b> <span class="small muted">· pick your own, at least 10 characters</span></summary>
    <form class="login" id="pwForm" style="margin-top:10px"><input type="password" id="pwNew" minlength="10" required autocomplete="new-password" placeholder="New password, min. 10 characters"><button class="btn" type="submit">Save</button><div class="msg" id="pwMsg" aria-live="polite"></div></form></details>`;
}
function renderStudioOnly(){
  const root = $(ROOT_ID); if(!root) return;
  root.innerHTML = S.editor ? studioHtml() + `<h2 id="h-feed" style="margin-top:8px">Latest posts</h2>` + (S.posts.length ? S.posts.slice(0,15).map(postHtml).join("") : '<p class="muted">No posts yet.</p>')
    : '<div class="card"><p>Please log in first.</p></div>';
  if(S.editor) root.insertAdjacentHTML("beforeend", pwFormHtml());
  bind();
}
function postHtml(p){
  const who = PEOPLE[p.author] || PEOPLE[FIRST];
  const media = p.media || [];
  const n = media.length, cls = n === 1 ? "n1" : n === 3 ? "n3" : "";
  const rx = S.reactions[p.id] || {};
  const cms = S.comments[p.id] || [];
  return `<article class="card post" id="post-${esc(p.id)}">
    <div class="by"><img src="${who.img}" alt=""><div><b>${who.name}</b><span class="small muted">${esc(p.place)} · ${esc(fmtDate(p.created_at))}</span></div>
      ${S.editor ? `<button class="btn danger" type="button" data-del="${esc(p.id)}" style="margin-left:auto">Delete</button>` : ""}</div>
    ${p.status ? `<div class="st">● ${esc(p.status)}</div>` : ""}
    ${p.body ? `<p class="txt">${esc(p.body)}</p>` : ""}
    ${n ? `<div class="media ${cls}">${media.map((m,i) => m.type && m.type.startsWith("video/")
        ? `<video src="${esc(mediaUrl(m.path))}" controls playsinline preload="none"></video>`
        : `<button type="button" data-lb="${esc(mediaUrl(m.path))}" aria-label="Show photo ${i+1} full size"><img src="${esc(mediaUrl(m.thumb || m.path))}" alt="Photo by ${who.name}, ${esc(p.place)}" loading="lazy"></button>`).join("")}</div>` : ""}
    <div class="react" role="group" aria-label="Reactions">${REACTIONS.map(e => { const mine = store.get("rx:"+p.id+":"+e); return `<button type="button" class="${mine ? "mine" : ""}" data-rx="${esc(p.id)}" data-emoji="${e}" aria-label="${e} reaction">${e} ${rx[e] ? rx[e] : ""}</button>`; }).join("")}
      ${S.editor ? `<button type="button" class="btn wa small" data-share="${esc(p.id)}" style="margin-left:auto">Share on WhatsApp</button>` : ""}</div>
    <div class="comments">
      ${cms.map(c => `<div class="cm"><b>${esc(c.name)}</b> ${esc(c.body)} <span class="muted">${esc(new Date(c.created_at).toLocaleDateString("en-GB",{day:"numeric",month:"short"}))}</span>${S.editor ? ` <button class="btn danger" type="button" data-delc="${c.id}" style="padding:0 6px">×</button>` : ""}</div>`).join("")}
      <form class="cform" data-cform="${esc(p.id)}"><input name="name" placeholder="Your name" maxlength="40" required value="${esc(store.get("cname") || "")}" aria-label="Your name"><input name="body" placeholder="Leave a nice message …" maxlength="500" required aria-label="Comment"><input name="website" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px"><button class="btn small" type="submit">Send</button></form>
    </div>
  </article>`;
}
function studioHtml(){
  const saver = store.get("saver") !== "0";
  return `<section class="card studio" aria-labelledby="h-studio"><h2 id="h-studio">New post</h2>
    <p class="small muted" style="margin:4px 0 0">Only visible to you. Posts upload in the background and retry automatically on a bad connection, even after closing the page.</p>
    <div id="outbox"></div>
    <form id="postForm">
      <div class="row2">
        <label ${PLURAL ? "" : "hidden"}>Who is posting?<select id="pAuthor">${(T.people||[]).map(p => `<option value="${esc(p.key)}" ${store.get("author") === p.key ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></label>
        <label>Where?<select id="pPlace">${PLACES.map(p => `<option ${p === store.get("place") ? "selected" : ""}>${esc(p)}</option>`).join("")}</select></label>
      </div>
      <div class="quick pingrow"><span class="small muted">Quick status update (tiny upload):</span>
        <button type="button" class="btn ghost small" data-ping="${esc(STATUSES[1] || "All good")}">All good</button>
        <button type="button" class="btn ghost small" data-ping="No signal for the next few days">No signal</button>
        <button type="button" class="btn ghost small" data-ping="Tired but happy">Tired & happy</button></div>
      <label>Status<select id="pStatus">${STATUSES.map(s => `<option value="${esc(s)}">${s ? esc(s) : "(none)"}</option>`).join("")}</select></label>
      <label>Text<textarea id="pText" maxlength="4000" placeholder="What happened today?"></textarea></label>
      <label>Photos or videos (up to 8)<input id="pMedia" type="file" accept="image/*,video/*" multiple></label>
      <label class="chk"><input type="checkbox" id="pSaver" ${saver ? "checked" : ""}> Data saver: smaller photos, ideal on a weak connection</label>
      <div class="previews" id="pPrev"></div>
      <div><button class="btn" type="submit" id="pSubmit">Publish</button></div>
      <div class="msg" id="pMsg" aria-live="polite"></div>
    </form></section>`;
}
function wxHtml(si){
  const cur = si >= 0 ? STOPS[si].key : "";
  if(S.wxErr) return `<section class="card"><h2>Weather</h2><p class="muted small">Weather can't be loaded right now.</p></section>`;
  if(!S.wx) return "";
  const fmt = d => { const [y,m,dd] = d.split("-"); return `${+dd}/${+m}`; };
  return `<section class="card" aria-labelledby="h-wx"><h2 id="h-wx">Weather</h2><p class="small muted" style="margin:2px 0 4px">Live forecast, local time</p>
    ${S.wx.map(p => { const c = p.current || {}; const dl = p.daily || {}; const w = WMO[c.weather_code] || ["🌡️",""];
      return `<div class="wxrow ${p.key === cur ? "cur" : ""}"><span class="ic" aria-hidden="true">${w[0]}</span>
        <div><b>${esc(p.name)}</b>${p.key === cur ? '<span class="tag">They\'re here</span>' : ""}<div class="small muted">${esc(w[1])}${c.wind_gusts_10m != null ? ` · gusts ${Math.round(c.wind_gusts_10m)} km/h` : ""}${dl.precipitation_probability_max ? ` · rain ${dl.precipitation_probability_max[0]}%` : ""}</div></div>
        <div class="t">${c.temperature_2m != null ? Math.round(c.temperature_2m) : "–"}°<small> ${dl.temperature_2m_max ? Math.round(dl.temperature_2m_max[0]) + "/" + Math.round(dl.temperature_2m_min[0]) + "°" : ""}</small></div>
        <div class="days">${(dl.time || []).slice(1,6).map((t,i) => `<span>${fmt(t)} ${(WMO[dl.weather_code[i+1]]||["",""])[0]} ${Math.round(dl.temperature_2m_max[i+1])}°/${Math.round(dl.temperature_2m_min[i+1])}°</span>`).join("")}</div></div>`; }).join("")}
    <p class="small muted" style="margin:6px 0 0">Weather data: <a href="https://open-meteo.com" target="_blank" rel="noopener">Open-Meteo</a></p></section>`;
}
/* ---------- Medien, Warteschlange & Teilen ---------- */
let pending = [];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fmtKB = n => n > 1048576 ? (n/1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n/1024)) + " KB";
function scaleImage(file, max, q){
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file); const img = new Image();
    img.onload = () => { let w = img.naturalWidth, h = img.naturalHeight; const r = Math.min(1, max/Math.max(w,h)); w = Math.round(w*r); h = Math.round(h*r);
      const c = document.createElement("canvas"); c.width = w; c.height = h; c.getContext("2d").drawImage(img,0,0,w,h); URL.revokeObjectURL(url);
      c.toBlob(b => b ? res(b) : rej(new Error("Bild")), "image/jpeg", q); };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("Image not readable")); };
    img.src = url;
  });
}
async function prepareFile(f, saver){
  if(f.type.startsWith("video/")) return { name: f.name, type: f.type || "video/mp4", full: f, thumb: null };
  const full = await scaleImage(f, saver ? 1280 : 1800, saver ? 0.62 : 0.76);
  const thumb = await scaleImage(f, 640, 0.6);
  return { name: (f.name.replace(/\.[^.]+$/,"") || "foto") + ".jpg", type: "image/jpeg", full, thumb };
}
/* IndexedDB: Posts überleben Funklöcher und das Schließen der Seite */
const IDB = {
  db: null,
  open(){ return this.db || (this.db = new Promise((res, rej) => { const r = indexedDB.open("reise-" + T.id, 1); r.onupgradeneeded = () => r.result.createObjectStore("outbox", {keyPath:"id"}); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); })); },
  async tx(mode, fn){ const db = await this.open(); return new Promise((res, rej) => { const t = db.transaction("outbox", mode); const s = t.objectStore("outbox"); const out = fn(s); t.oncomplete = () => res(out && out.result); t.onerror = () => rej(t.error); }); },
  all(){ return this.tx("readonly", s => s.getAll()); },
  put(item){ return this.tx("readwrite", s => s.put(item)); },
  del(id){ return this.tx("readwrite", s => s.delete(id)); }
};
let outbox = [], outboxBusy = false, outboxNote = "";
async function loadOutbox(){ try{ outbox = await IDB.all() || []; }catch(e){ outbox = []; } }
function withTimeout(promise, ms){ return Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new Error("Timeout")), ms))]); }
async function uploadOnce(path, blob, type){
  if(DEMO){ await sleep(300); return; }
  const r = await withTimeout(sb.storage.from(BUCKET).upload(path, blob, { contentType: type, upsert: false, cacheControl: "31536000" }), Math.max(45000, blob.size / 12));
  if(r.error && !/exist|duplicate/i.test(r.error.message || "")) throw r.error;
}
async function processOutbox(){
  if(outboxBusy || !outbox.length || !S.editor) return;
  if(navigator.onLine === false){ outboxNote = "No signal. Upload continues automatically once you're back online."; renderOutbox(); return; }
  outboxBusy = true;
  for(const item of [...outbox]){
    try{
      for(const [i,f] of item.files.entries()){
        if(f.thumb && !f.thumbPath){ outboxNote = `Preview ${i+1}/${item.files.length} …`; renderOutbox(); const tp = `${item.id}/${i+1}-t.jpg`; await uploadOnce(tp, f.thumb, "image/jpeg"); f.thumbPath = tp; await IDB.put(item); }
        if(!f.path){ outboxNote = `File ${i+1}/${item.files.length} (${fmtKB(f.full.size)}) …`; renderOutbox(); const ext = (f.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g,"") || "bin"; const pth = `${item.id}/${i+1}.${ext}`; await uploadOnce(pth, f.full, f.type); f.path = pth; await IDB.put(item); }
      }
      outboxNote = "Saving post …"; renderOutbox();
      const post = { id: item.id, author: item.author, place: item.place, status: item.status, body: item.body, media: item.files.map(f => ({ path: DEMO ? URL.createObjectURL(f.full) : f.path, thumb: DEMO ? (f.thumb ? URL.createObjectURL(f.thumb) : null) : (f.thumbPath || null), type: f.type })) };
      let saved = { ...post, created_at: new Date().toISOString() };
      if(!DEMO){ const { data, error } = await withTimeout(sb.from("posts").upsert(post, { onConflict: "id" }).select().single(), 30000); if(error) throw error; saved = data; }
      await IDB.del(item.id); outbox = outbox.filter(x => x.id !== item.id);
      if(!S.posts.some(x => x.id === saved.id)) S.posts.unshift(saved);
      S.lastShare = { files: item.files.map((f,i) => new File([f.full], `photo-${i+1}.${(f.type.split("/")[1]||"jpg").replace("quicktime","mov")}`, { type: f.type })), text: shareText(post) };
      outboxNote = "";
      const form = $("postForm"); const busy = form && ($("pText").value || pending.length);
      if(busy){ renderOutbox(); refreshFeed(); } else render();
    }catch(err){
      console.warn(err); item.tries = (item.tries || 0) + 1; await IDB.put(item).catch(() => {});
      outboxNote = "Connection too weak, retrying shortly …"; renderOutbox();
      outboxBusy = false; setTimeout(processOutbox, Math.min(120000, 10000 * item.tries)); return;
    }
  }
  outboxBusy = false; renderOutbox();
}
function renderOutbox(){
  const el = $("outbox"); if(!el) return;
  const ls = S.lastShare;
  el.innerHTML = `${outbox.map(it => { const done = it.files.filter(f => f.path).length; const size = it.files.reduce((n,f) => n + (f.path ? 0 : f.full.size) + (f.thumb && !f.thumbPath ? f.thumb.size : 0), 0);
      return `<div class="sharebox" style="margin-top:10px;background:var(--bg);border-color:var(--trail)"><b>Uploading: ${esc(it.place)}${it.body ? " · " + esc(it.body.slice(0,40)) : ""}</b>
        <span class="small">${it.files.length ? `${done} of ${it.files.length} files done · ${fmtKB(size)} left` : "text only"}${it.tries ? ` · attempt ${it.tries + 1}` : ""}</span>
        <span class="small muted">${esc(outboxNote)}</span>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn small" data-retry>Retry now</button><button type="button" class="btn danger" data-drop="${esc(it.id)}">Discard</button></div></div>`; }).join("")}
    ${ls ? `<div class="sharebox" style="margin-top:10px"><b>Published! Now send it to your WhatsApp broadcast list:</b>
      <button type="button" class="btn wa" id="shareLast">Share on WhatsApp</button>
      <span class="small muted">Pick WhatsApp, then the broadcast list. The text is also on your clipboard. On a weak connection, WhatsApp sends it by itself once you're back online.</span></div>` : ""}`;
  el.querySelectorAll("[data-retry]").forEach(b => b.addEventListener("click", () => { outboxBusy = false; processOutbox(); }));
  el.querySelectorAll("[data-drop]").forEach(b => b.addEventListener("click", async () => { if(b.dataset.armed !== "1"){ b.dataset.armed = "1"; b.textContent = "Really discard?"; return; } await IDB.del(b.dataset.drop).catch(() => {}); outbox = outbox.filter(x => x.id !== b.dataset.drop); renderOutbox(); }));
  const sl = $("shareLast"); if(sl) sl.addEventListener("click", () => doShare(S.lastShare.files, S.lastShare.text, $("pMsg")));
}
function refreshFeed(){ if(MODE === "studio"){ const f = $("pText"); const keep = f ? f.value : ""; renderStudioOnly(); if($("pText")) $("pText").value = keep; return; } const f = $("h-feed"); if(!f) return; const sec = f.parentElement; sec.innerHTML = `<h2 id="h-feed">News from the road</h2>` + S.posts.map(postHtml).join(""); bind(); }
async function queuePost(item){
  outbox.push(item);
  try{ await IDB.put(item); }catch(e){ outboxNote = "Note: can't store the post on this phone, keep the page open until it's done."; }
  renderOutbox(); processOutbox();
}
function shareText(p){
  const who = (PEOPLE[p.author] || PEOPLE[FIRST]).name;
  return [`${who} in ${p.place}${p.status ? " · " + p.status : ""}`, p.body || "", `More photos and our route: ${SITE}`].filter(Boolean).join("\n\n");
}
async function doShare(files, text, msgEl){
  try{ await navigator.clipboard.writeText(text); }catch(e){}
  const data = files.length ? {files, text} : {text};
  if(navigator.share && (!files.length || (navigator.canShare && navigator.canShare({files})))){
    try{ await navigator.share(data); return; }catch(e){ if(e && e.name === "AbortError") return; }
  }
  if(msgEl) msgEl.textContent = "This device can't share photos directly. WhatsApp opens with the text, please attach the photo there.";
  location.href = "https://wa.me/?text=" + encodeURIComponent(text);
}
async function filesForPost(p){
  const out = [];
  for(const [i,m] of (p.media||[]).entries()){
    try{ const r = await fetch(mediaUrl(m.path)); const b = await r.blob(); const ext = (m.type||"").split("/")[1] || "jpg"; out.push(new File([b], `photo-${i+1}.${ext}`, {type: m.type || b.type})); }catch(e){}
  }
  return out;
}

/* ---------- Aktionen ---------- */
function bind(){
  document.querySelectorAll("[data-lb]").forEach(b => b.addEventListener("click", () => { $("lbImg").src = b.dataset.lb; $("lb").classList.add("on"); $("lbClose").focus(); }));
  document.querySelectorAll("[data-rx]").forEach(b => b.addEventListener("click", async () => {
    const id = b.dataset.rx, e = b.dataset.emoji, k = "rx:"+id+":"+e;
    if(store.get(k)) return;
    store.set(k, "1"); const o = S.reactions[id] = S.reactions[id] || {}; o[e] = (o[e]||0) + 1; render();
    if(!DEMO){ const { error } = await sb.from("reactions").insert({post_id:id, emoji:e}); if(error) console.error(error); }
  }));
  document.querySelectorAll("[data-cform]").forEach(f => f.addEventListener("submit", async ev => {
    ev.preventDefault(); const id = f.dataset.cform; const name = f.name.value.trim().slice(0,40), body = f.body.value.trim().slice(0,500);
    if(!name || !body || f.website.value) return; store.set("cname", name);
    const btn = f.querySelector("button"); btn.disabled = true;
    const row = {post_id:id, name, body, created_at:new Date().toISOString()};
    if(!DEMO){ const { data, error } = await sb.from("comments").insert({post_id:id, name, body}).select().single(); if(error){ btn.disabled = false; alertMsg(f, /Too many|Zu viele/.test(error.message||"") ? "Lots of comments right now. Please try again in a few minutes." : "That didn't work, please try again."); return; } row.id = data.id; row.created_at = data.created_at; }
    (S.comments[id] = S.comments[id] || []).push(row); render();
  }));
  const lt = $("loginToggle"); if(lt) lt.addEventListener("click", () => { const f = $("loginForm"); f.hidden = !f.hidden; lt.setAttribute("aria-expanded", String(!f.hidden)); if(!f.hidden){ $("loginEmail").focus(); f.scrollIntoView({behavior:"smooth", block:"center"}); } });
  const lf = $("loginForm");
  if(lf) lf.addEventListener("submit", async e => { e.preventDefault(); const m = $("loginMsg");
    if(DEMO){ m.textContent = "No login in preview mode."; return; }
    const email = $("loginEmail").value.trim(), pw = $("loginPw").value;
    m.textContent = "Logging in …";
    try{
    if(pw){ const { error } = await sb.auth.signInWithPassword({ email, password: pw }); if(error) console.warn(error); m.textContent = error ? (/invalid/i.test(error.message||"") ? "Wrong email or password." : "Login failed: " + error.message) : "Logged in."; if(!error){ await checkEditor(); render(); } return; }
    const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser:false, emailRedirectTo: location.origin + location.pathname } });
    if(error) console.warn(error); m.textContent = error ? loginErrorText(error) : "Link sent. Open the email and tap it on your phone.";
    }catch(err){ console.error(err); m.textContent = "Login failed: " + (err && err.message || err); } });
  const pf = $("pwForm"); if(pf) pf.addEventListener("submit", async e => { e.preventDefault(); const m = $("pwMsg");
    if(DEMO){ m.textContent = "Not available in preview mode."; return; }
    const { error } = await sb.auth.updateUser({ password: $("pwNew").value }); m.textContent = error ? "That didn't work: " + error.message : "Saved. From now on, log in with email and your new password."; if(!error) $("pwNew").value = ""; });
  const lo = $("logout"); if(lo) lo.addEventListener("click", async () => { if(sb) await sb.auth.signOut(); S.editor = false; S.lastShare = null; render(); });
  if(!S.editor) return;

  document.querySelectorAll("[data-del]").forEach(b => b.addEventListener("click", async () => {
    if(b.dataset.armed !== "1"){ b.dataset.armed = "1"; b.textContent = "Really delete?"; return; }
    const p = S.posts.find(x => x.id === b.dataset.del); if(!p) return; b.disabled = true;
    if(!DEMO){ const paths = (p.media||[]).map(m => m.path); if(paths.length) await sb.storage.from(BUCKET).remove(paths); const { error } = await sb.from("posts").delete().eq("id", p.id); if(error){ b.textContent = "Error"; return; } }
    S.posts = S.posts.filter(x => x.id !== p.id); render();
  }));
  document.querySelectorAll("[data-delc]").forEach(b => b.addEventListener("click", async () => {
    const id = +b.dataset.delc; if(!DEMO) await sb.from("comments").delete().eq("id", id);
    Object.keys(S.comments).forEach(k => S.comments[k] = S.comments[k].filter(c => c.id !== id)); render();
  }));
  document.querySelectorAll("[data-share]").forEach(b => b.addEventListener("click", async () => {
    const p = S.posts.find(x => x.id === b.dataset.share); if(!p) return; b.disabled = true; b.textContent = "Preparing …";
    const files = await filesForPost(p); b.disabled = false; b.textContent = "Share on WhatsApp";
    await doShare(files, shareText(p), null);
  }));
  renderOutbox();
  $("pAuthor").addEventListener("change", e => store.set("author", e.target.value));
  $("pPlace").addEventListener("change", e => store.set("place", e.target.value));
  $("pSaver").addEventListener("change", e => store.set("saver", e.target.checked ? "1" : "0"));
  const inp = $("pMedia"), prev = $("pPrev"), msg = $("pMsg");
  const newId = () => (crypto.randomUUID && crypto.randomUUID()) || ("p" + Date.now() + Math.random().toString(36).slice(2));
  document.querySelectorAll("[data-ping]").forEach(b => b.addEventListener("click", () => {
    queuePost({ id: newId(), author: $("pAuthor").value, place: $("pPlace").value, status: b.dataset.ping, body: "", files: [], created: Date.now() });
    msg.textContent = "Sending status update.";
  }));
  inp.addEventListener("change", async () => {
    pending = []; prev.innerHTML = ""; const files = [...inp.files].slice(0,8); const saver = $("pSaver").checked;
    $("pSubmit").disabled = true;
    for(const [i,f] of files.entries()){
      msg.textContent = `Preparing ${i+1} of ${files.length} …`;
      if(f.type.startsWith("video/") && f.size > 50*1024*1024){ msg.textContent = `"${f.name}" is larger than 50 MB and will be skipped.`; continue; }
      try{ const pf = await prepareFile(f, saver); pending.push(pf);
        prev.insertAdjacentHTML("beforeend", pf.type.startsWith("video/") ? `<video src="${URL.createObjectURL(pf.full)}" muted></video>` : `<img src="${URL.createObjectURL(pf.thumb)}" alt="">`); }
      catch(e){ msg.textContent = "A photo couldn't be read."; }
    }
    $("pSubmit").disabled = false;
    const total = pending.reduce((n,f) => n + f.full.size + (f.thumb ? f.thumb.size : 0), 0);
    const hasVideo = pending.some(f => f.type.startsWith("video/"));
    if(pending.length) msg.textContent = `${pending.length} file(s), ${fmtKB(total)} to upload.` + (hasVideo ? " Videos aren't compressed, prefer photos on a weak connection." : "");
  });
  $("postForm").addEventListener("submit", e => {
    e.preventDefault();
    const body = $("pText").value.trim(), status = $("pStatus").value;
    if(!body && !pending.length && !status){ msg.textContent = "Write something, pick a status or add a photo."; return; }
    queuePost({ id: newId(), author: $("pAuthor").value, place: $("pPlace").value, status, body, files: pending, created: Date.now() });
    pending = []; $("pText").value = ""; $("pStatus").value = ""; inp.value = ""; prev.innerHTML = "";
    msg.textContent = "Queued. You can keep going or close the page, the upload continues next time you open it.";
  });
}
function alertMsg(el, t){ let m = el.querySelector(".msg"); if(!m){ m = document.createElement("div"); m.className = "msg"; el.after(m); } m.textContent = t; }
$("lb").addEventListener("click", e => { if(e.target.id === "lb" || e.target.id === "lbClose") $("lb").classList.remove("on"); });
document.addEventListener("keydown", e => { if(e.key === "Escape") $("lb").classList.remove("on"); });

/* ---------- Demo ---------- */
function demoData(){
  const t = Date.now();
  S.posts = [{id:"d1", author:FIRST, place:PLACES[1] || PLACES[0], status:STATUSES[1] || "", body:"Example post: this is what a post looks like. It disappears after setup.", media:[{path:T.heroImage, type:"image/jpeg"}], created_at:new Date(t-3600e3).toISOString()}];
  S.reactions = {d1:{[REACTIONS[0]]:3}};
  S.comments = {d1:[{id:1, post_id:"d1", name:"Grandma", body:"Take good care of yourselves!", created_at:new Date(t-1800e3).toISOString()}]};
}

/* ---------- Start ---------- */
(async () => {
  await checkEditor(); await loadOutbox(); await loadAll(); render(); processOutbox();
  window.addEventListener("online", () => { outboxBusy = false; processOutbox(); });
  document.addEventListener("visibilitychange", () => { if(document.visibilityState === "visible") processOutbox(); });
  if("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
  loadWeather().then(render);
  // Never await Supabase calls inside this callback: supabase-js holds its auth lock while it runs, and a nested call deadlocks
  // every later request (uploads hang forever). Defer the work instead.
  if(sb) sb.auth.onAuthStateChange((ev) => { if(ev === "SIGNED_IN" || ev === "SIGNED_OUT"){ setTimeout(async () => { const was = S.editor; await checkEditor(); if(was !== S.editor || ev === "SIGNED_OUT") render(); processOutbox(); }, 0); } });
  setInterval(async () => { if(document.visibilityState !== "visible") return; const a = document.activeElement; if(a && a.matches("input,textarea,select")) return; if(pending.length || ($("pText") && $("pText").value)) return; await loadAll(); render(); }, 90000);
})();
})();
