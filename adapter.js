/* FA COCKPIT: Supabase-koppeling + pincode-login.
   De anon/publishable key is publiek bedoeld; toegang wordt geregeld door Row Level Security in Supabase. */
const SB_URL="https://xcouykrxuihszhleobcw.supabase.co";
const SB_KEY="sb_publishable_IfL47J2WQwmSsALSjEVWJg_UmgAowNL";
const TEAM=["Stijn","Timo","Jeroen","Kevin","Lars","Cacharel","Puck"];
const sb=window.supabase.createClient(SB_URL,SB_KEY,{auth:{persistSession:true,autoRefreshToken:true,storageKey:"fa-cockpit-auth"}});
const emailOf=n=>n.toLowerCase()+"@cockpit.fitnessaannemer.nl";
const pwOf=p=>"fa-pin-"+p;

function makeDb(){
  const cache={},listeners={};
  const rid=()=>Array.from(crypto.getRandomValues(new Uint8Array(10)),b=>"abcdefghijklmnopqrstuvwxyz0123456789"[b%36]).join("");
  const emitAll=col=>(listeners[col]||[]).forEach(l=>l.cb(view(col,l.q)));
  function view(col,q){let rows=[...(cache[col]||new Map()).entries()].map(([id,d])=>({id,d}));
    if(q&&q.order){const f=q.order.f,dir=q.order.dir==="desc"?-1:1;rows.sort((a,b)=>String(a.d[f]??"").localeCompare(String(b.d[f]??""))*dir)}
    if(q&&q.limit)rows=rows.slice(0,q.limit);
    return {docs:rows.map(r=>({id:r.id,data:()=>r.d}))}}
  const loading={};
  function ensure(col,onErr){if(cache[col]||loading[col])return;loading[col]=1;cache[col]=new Map();
    sb.from("docs").select("id,data").eq("collection",col).then(({data,error})=>{loading[col]=0;if(error){onErr&&onErr(error);return}data.forEach(r=>cache[col].set(r.id,r.data));emitAll(col)})}
  sb.channel("docs-live").on("postgres_changes",{event:"*",schema:"public",table:"docs"},p=>{
    const r=(p.new&&p.new.collection)?p.new:p.old;if(!r||!cache[r.collection])return;
    if(p.eventType==="DELETE")cache[r.collection].delete(r.id);else cache[r.collection].set(r.id,p.new.data);emitAll(r.collection)}).subscribe();
  const err=e=>{const x=new Error(e.message||"fout");x.code=(e.code==="42501"||/row-level security/i.test(e.message||""))?"not_granted":"failed";return x};
  function docRef(col,id){return {
    async set(data){const {error}=await sb.from("docs").upsert({collection:col,id,data});if(error)throw err(error);(cache[col]=cache[col]||new Map()).set(id,data);emitAll(col)},
    async delete(){const {error}=await sb.from("docs").delete().eq("collection",col).eq("id",id);if(error)throw err(error);cache[col]&&cache[col].delete(id);emitAll(col)}}}
  function query(col,q){return {
    orderBy(f,dir){return query(col,{...q,order:{f,dir}})},limit(n){return query(col,{...q,limit:n})},
    onSnapshot(cb,onErr){(listeners[col]=listeners[col]||[]).push({cb,q});if(cache[col]&&!loading[col])cb(view(col,q));ensure(col,onErr);return()=>{}},
    doc(id){return docRef(col,id||rid())}}}
  return {collection:col=>query(col,{}),doc:path=>{const i=path.lastIndexOf("/");return docRef(path.slice(0,i),path.slice(i+1))}};
}
function initials(n){const c=(n||"?")[0];return "data:image/svg+xml,"+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" rx="32" fill="#279FDA"/><text x="32" y="42" font-family="Arial" font-size="28" font-weight="700" fill="#fff" text-anchor="middle">${c}</text></svg>`)}
async function makeUser(){
  const {data:{user}}=await sb.auth.getUser();
  const {data:t}=await sb.from("team").select("naam,rol,admin").eq("user_id",user.id).maybeSingle();
  const me={id:user.id,name:t?t.naam:"",canEdit:!!(t&&t.admin),isOwner:!!(t&&t.admin),avatarUrl:initials(t&&t.naam),rol:t?t.rol:""};
  return {me:async()=>me,can:async()=>true};
}
let DB=null,USER=null;
window.claude={use:async n=>n==="db"?DB:n==="user"?USER:null};

/* ---- Pincode-scherm ---- */
function lockUI(){
  const L=document.getElementById("lock");let naam=null;let pin="";
  try{naam=localStorage.getItem("fa-last-user")}catch(e){}
  const names=document.getElementById("lk-names"),dots=document.getElementById("lk-dots"),msg=document.getElementById("lk-msg");
  names.innerHTML=TEAM.map(n=>`<button type="button" data-n="${n}" aria-pressed="${n===naam}">${n}</button>`).join("");
  const draw=()=>{dots.innerHTML=[0,1,2,3,4,5].map(i=>`<i class="${i<pin.length?"on":""}"></i>`).join("");names.querySelectorAll("button").forEach(b=>b.setAttribute("aria-pressed",b.dataset.n===naam))};
  names.onclick=e=>{const b=e.target.closest("button");if(!b)return;naam=b.dataset.n;pin="";msg.textContent="";draw()};
  async function tryLogin(){if(!naam){msg.textContent="Kies eerst je naam.";pin="";draw();return}
    msg.textContent="Even checken…";
    const {error}=await sb.auth.signInWithPassword({email:emailOf(naam),password:pwOf(pin)});
    if(error){msg.textContent=/rate|many/i.test(error.message)?"Te vaak geprobeerd. Wacht een paar minuten.":"Pincode klopt niet.";pin="";draw();L.querySelector(".lk-card").classList.remove("shake2");void L.offsetWidth;L.querySelector(".lk-card").classList.add("shake2");return}
    try{localStorage.setItem("fa-last-user",naam)}catch(e){}
    L.hidden=true;await start()}
  const press=k=>{if(k==="del"){pin=pin.slice(0,-1)}else if(pin.length<6){pin+=k}draw();if(pin.length===6)tryLogin()};
  document.getElementById("lk-pad").onclick=e=>{const b=e.target.closest("button");if(b)press(b.dataset.k)};
  document.addEventListener("keydown",e=>{if(L.hidden)return;if(/^\d$/.test(e.key))press(e.key);else if(e.key==="Backspace")press("del")});
  draw();L.hidden=false;
}
async function start(){DB=makeDb();USER=await makeUser();boot()}
async function logout(){await sb.auth.signOut();location.reload()}
async function changePin(p){if(!/^\d{6}$/.test(p))throw new Error("Kies 6 cijfers.");const {error}=await sb.auth.updateUser({password:pwOf(p)});if(error)throw error}
(async()=>{const {data:{session}}=await sb.auth.getSession();if(session)start();else lockUI()})();
