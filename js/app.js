import { initializeApp }                                       from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, onSnapshot }      from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCe9zNmLpJj3oPUpNCpSTuHqZFHUvfVpiU",
  authDomain: "family-chores-960cd.firebaseapp.com",
  projectId: "family-chores-960cd",
  storageBucket: "family-chores-960cd.firebasestorage.app",
  messagingSenderId: "271324049535",
  appId: "1:271324049535:web:c002dc4e0c1772d95a0f4a"
};
const fbApp = initializeApp(firebaseConfig);
const db    = getFirestore(fbApp);
const REF   = doc(db, 'family', 'chores');

// ── DATE ────────────────────────────────────────────────────────────────────
const DAYS_OF_WEEK = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
document.getElementById('sidebar-date').textContent =
  new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' });

// ── NAV ──────────────────────────────────────────────────────────────────────
window.showPage = function(name) {
  ['chores','meals','calendar'].forEach(p => {
    document.getElementById('page-' + p).classList.toggle('active', p === name);
    document.getElementById('nav-' + p).classList.toggle('active', p === name);
  });
  if (name === 'meals') { renderMealPlan(); renderGrocery(); }
  if (name === 'calendar') renderCalendar();
};

// ── CHORE THEME ──────────────────────────────────────────────────────────────
const THEME = {
  Amelia: { color:'var(--amelia)', light:'var(--amelia-light)', border:'var(--amelia-border)' },
  Lucas:  { color:'var(--lucas)',  light:'var(--lucas-light)',  border:'var(--lucas-border)'  },
  Taylor: { color:'var(--taylor)', light:'var(--taylor-light)', border:'var(--taylor-border)' },
  Kara:   { color:'var(--kara)',   light:'var(--kara-light)',   border:'var(--kara-border)'   },
  Shared: { color:'var(--shared)', light:'var(--shared-light)', border:'var(--shared-border)' },
  Open:   { color:'var(--open)',   light:'var(--open-light)',   border:'var(--open-border)'   },
};
const BOTH_KIDS = ['Amelia','Lucas'];

const CHORE_DEFAULTS = {
  daily: [
    { id:'fd', name:'Feed & let dogs out',       who:'Both', doneBy:[] },
    { id:'ed', name:'Empty dishwasher',          who:'Both', doneBy:[] },
    { id:'sk', name:'Sweep under kitchen table', who:'Both', doneBy:[] },
    { id:'tr', name:'Tidy room',                 who:'Both', doneBy:[] },
    { id:'wt', name:'Wipe off table',            who:'Both', doneBy:[] },
  ],
  weekly: [
    { id:'wl', name:'Laundry',              who:'Both',   doneBy:[] },
    { id:'wd', name:'Dishes',               who:'Both',   doneBy:[] },
    { id:'wp', name:'Pick up sticks/weeds', who:'Both',   doneBy:[] },
    { id:'wv', name:'Vacuum upstairs',      who:'Both',   doneBy:[] },
    { id:'wb', name:'Clean bathroom',       who:'Both',   doneBy:[] },
    { id:'wc', name:'Clean out car',        who:'Both',   doneBy:[] },
    { id:'tt', name:'Take out trash',       who:'Taylor', done:false },
    { id:'kb', name:'Clean our bathroom',   who:'Shared', done:false },
  ],
  paid: [
    { id:'pv', name:'Vacuum main level',          who:'Open', pay:'$1',           done:false },
    { id:'pb', name:'Book report',                who:'Open', pay:'$5',           done:false },
    { id:'pw', name:'Clean windows - main level', who:'Open', pay:'$2 per kid',   done:false },
    { id:'pm', name:'Mop main level',             who:'Open', pay:'$2',           done:false },
    { id:'pd', name:'Dusting',                    who:'Open', pay:'$1 per level', done:false },
    { id:'ps', name:'Swiffer main level',         who:'Open', pay:'$1',           done:false },
    { id:'pg', name:'Wash the dogs',              who:'Open', pay:'$2 per dog',   done:false },
  ],
};

let CS = { chores: JSON.parse(JSON.stringify(CHORE_DEFAULTS)), pin:'1234', lastDailyReset:'', lastWeeklyReset:'' };
let pinBuf = '', delTarget = null, addCol = null, _ignoreNext = false;

function todayStr()     { return new Date().toISOString().slice(0,10); }
function lastSundayStr(){ const n=new Date(),s=new Date(n); s.setDate(n.getDate()-n.getDay()); return s.toISOString().slice(0,10); }

function clearChores(types) {
  types.forEach(t => CS.chores[t] && CS.chores[t].forEach(c => {
    if (c.who==='Both') c.doneBy=[];
    else c.done=false;
  }));
}
function checkAutoReset() {
  let dirty=false;
  if (CS.lastDailyReset !== todayStr())     { clearChores(['daily']);           CS.lastDailyReset=todayStr();     dirty=true; }
  if (CS.lastWeeklyReset !== lastSundayStr()){ clearChores(['weekly','paid']); CS.lastWeeklyReset=lastSundayStr(); dirty=true; }
  return dirty;
}
async function saveChores() {
  _ignoreNext=true;
  try { await setDoc(REF, JSON.parse(JSON.stringify(CS))); } catch(e){ console.error(e); }
}

// Boot Firebase
(async () => {
  try {
    const snap = await getDoc(REF);
    if (snap.exists()) {
      CS = snap.data();
      ['daily','weekly','paid'].forEach(t => { if (!CS.chores[t]) CS.chores[t]=[]; });
    } else {
      CS = { chores: JSON.parse(JSON.stringify(CHORE_DEFAULTS)), pin:'1234', lastDailyReset: todayStr(), lastWeeklyReset: lastSundayStr() };
      await saveChores();
    }
    if (checkAutoReset()) await saveChores();
    renderChores();
    onSnapshot(REF, snap => {
      if (_ignoreNext) { _ignoreNext=false; return; }
      if (snap.exists()) { CS=snap.data(); renderChores(); }
    });
  } catch(e) { console.error(e); checkAutoReset(); renderChores(); }
})();

// ── RENDER CHORES ────────────────────────────────────────────────────────────
function renderChores() {
  renderChoreList('daily');
  renderChoreList('weekly');
  renderChoreList('paid');
  const total = CS.chores.daily.length + CS.chores.weekly.length + CS.chores.paid.length;
  const done  = CS.chores.daily.filter(isAllDone).length + CS.chores.weekly.filter(isAllDone).length + CS.chores.paid.filter(isAllDone).length;
  document.getElementById('chore-header-sub').textContent = `${done} of ${total} done today`;
}
function renderChoreList(type) {
  const el = document.getElementById('list-' + type);
  el.innerHTML = '';
  const list = CS.chores[type];
  if (!list||!list.length) { el.innerHTML='<div class="chore-empty">No chores yet</div>'; return; }
  list.forEach(c => el.appendChild(makeChoreRow(c, type)));
}
function isAllDone(c) {
  return c.who==='Both' ? BOTH_KIDS.every(k=>(c.doneBy||[]).includes(k)) : !!c.done;
}
function makeChoreRow(c, type) {
  const el = document.createElement('div');
  const allDone = isAllDone(c);
  el.className = 'chore-row' + (allDone?' all-done':'');
  const t = c.who==='Both' ? THEME.Open : (THEME[c.who]||THEME.Open);
  el.style.background = c.who==='Both' ? '#FAFAF8' : t.light;
  el.style.borderLeftColor = c.who==='Both' ? 'var(--border)' : t.border;

  let whoHTML='';
  if (c.who==='Both') {
    BOTH_KIDS.forEach(kid => {
      const kt=THEME[kid], done=(c.doneBy||[]).includes(kid);
      whoHTML+=`<span class="who-tag ${done?'done-tag':''}" style="color:${kt.color};background:${kt.light};border-color:${kt.border}" data-kid="${kid}">${kid}</span>`;
    });
  } else if (c.who==='Shared') {
    whoHTML=`<span class="who-tag ${allDone?'done-tag':''}" style="color:var(--shared);background:var(--shared-light);border-color:var(--shared-border)">Taylor & Kara</span>`;
  } else {
    const wt=THEME[c.who]||THEME.Open;
    whoHTML=`<span class="who-tag ${allDone?'done-tag':''}" style="color:${wt.color};background:${wt.light};border-color:${wt.border}">${c.who==='Open'?'Anyone':c.who}</span>`;
  }

  const badge = type==='paid' ? `<div class="pay-tag" style="color:${t.color};border-color:${t.border};background:${t.light}">${c.pay||'$?'}</div>` : '';
  el.innerHTML=`<div class="chore-body"><div class="chore-name">${c.name}</div><div class="cwho-row">${whoHTML}</div></div>${badge}`;

  if (c.who==='Both') {
    el.querySelectorAll('.who-tag').forEach(tag => {
      tag.addEventListener('click', e => { e.stopPropagation(); toggleKid(c.id, type, tag.dataset.kid); });
    });
  } else {
    el.addEventListener('click', () => toggleSingle(c.id, type));
  }
  let pt;
  el.addEventListener('touchstart', () => { pt=setTimeout(()=>openDel(c.id,type,c.name),600); }, {passive:true});
  el.addEventListener('touchend',   () => clearTimeout(pt));
  el.addEventListener('touchmove',  () => clearTimeout(pt));
  el.addEventListener('contextmenu', e => { e.preventDefault(); openDel(c.id,type,c.name); });
  return el;
}
async function toggleKid(id,type,kid) {
  const c=CS.chores[type].find(x=>x.id===id); if(!c)return;
  if(!c.doneBy)c.doneBy=[];
  if(c.doneBy.includes(kid)) c.doneBy=c.doneBy.filter(k=>k!==kid);
  else c.doneBy.push(kid);
  renderChores(); await saveChores();
}
async function toggleSingle(id,type) {
  const c=CS.chores[type].find(x=>x.id===id);
  if(c){ c.done=!c.done; renderChores(); await saveChores(); }
}

// ── CHORE MODALS ─────────────────────────────────────────────────────────────
window.openAdd = function(col) {
  addCol=col;
  const titles={daily:'Add daily chore',weekly:'Add weekly chore',paid:'Add paid chore'};
  const subs={daily:'Appears every day',weekly:'Resets every Sunday',paid:'Kids can earn money'};
  document.getElementById('add-h').textContent=titles[col];
  document.getElementById('add-p').textContent=subs[col];
  document.getElementById('add-name').value='';
  document.getElementById('add-pay').value='';
  document.getElementById('add-pay-w').style.display=col==='paid'?'':'none';
  document.getElementById('add-ov').style.display='flex';
};
window.closeAdd = () => document.getElementById('add-ov').style.display='none';
window.saveChore = async function() {
  const name=document.getElementById('add-name').value.trim(); if(!name)return;
  const who=document.getElementById('add-who').value;
  const base={id:'c'+Date.now(),name};
  if(addCol==='paid') base.pay=document.getElementById('add-pay').value||'$?';
  if(who==='Both'){base.who='Both';base.doneBy=[];}
  else{base.who=who;base.done=false;}
  CS.chores[addCol].push(base);
  renderChores(); closeAdd(); await saveChores();
};

function openDel(id,type,name) {
  delTarget={id,type};
  document.getElementById('del-lbl').textContent=`"${name}" will be permanently removed.`;
  document.getElementById('del-ov').style.display='flex';
}
window.closeDel = () => { document.getElementById('del-ov').style.display='none'; delTarget=null; };
window.confirmDel = async function() {
  if(!delTarget)return;
  CS.chores[delTarget.type]=CS.chores[delTarget.type].filter(c=>c.id!==delTarget.id);
  renderChores(); closeDel(); await saveChores();
};

window.openPin = function() {
  pinBuf=''; document.getElementById('perr').textContent=''; updateDots();
  document.getElementById('pin-ov').style.display='flex';
};
window.closePin = () => { document.getElementById('pin-ov').style.display='none'; pinBuf=''; };
window.pk = function(k) {
  if(k==='back'){pinBuf=pinBuf.slice(0,-1);updateDots();return;}
  if(pinBuf.length>=4)return;
  pinBuf+=k; updateDots();
  if(pinBuf.length===4){
    setTimeout(()=>{
      if(pinBuf===CS.pin){closePin();openSet();}
      else{document.getElementById('perr').textContent='Wrong PIN — try again';pinBuf='';updateDots();}
    },150);
  }
};
function updateDots(){for(let i=0;i<4;i++)document.getElementById('pd'+i).classList.toggle('on',i<pinBuf.length);}
function openSet(){document.getElementById('sc').value='';document.getElementById('sn').value='';document.getElementById('serr').textContent='';document.getElementById('set-ov').style.display='flex';}
window.closeSet = () => document.getElementById('set-ov').style.display='none';
window.savePin = async function(){
  const cur=document.getElementById('sc').value,nw=document.getElementById('sn').value;
  if(cur!==CS.pin){document.getElementById('serr').textContent='Current PIN is wrong';return;}
  if(!/^\d{4}$/.test(nw)){document.getElementById('serr').textContent='PIN must be exactly 4 digits';return;}
  CS.pin=nw; await saveChores(); document.getElementById('serr').textContent=''; closeSet();
};
window.resetAll = async function(){
  if(!confirm('Clear all completed chores?'))return;
  ['daily','weekly','paid'].forEach(t=>CS.chores[t].forEach(c=>{if(c.who==='Both')c.doneBy=[];else c.done=false;}));
  renderChores(); closeSet(); await saveChores();
};

// ── MEAL PLANNER ─────────────────────────────────────────────────────────────
const MEAL_API = '8a4c13fcd0a74d8aaaf0fc67118b8740';
const CUISINES = ['Any','American','Italian','Mexican','Asian','Indian','Thai','Japanese'];
const MEAL_DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
let selectedCuisine='Any';
let mealPlan = JSON.parse(localStorage.getItem('mealplan')||'{}');
let groceryChecked = JSON.parse(localStorage.getItem('grocerychecked')||'[]');
let groceryItems = JSON.parse(localStorage.getItem('groceryitems')||'[]');
let favorites = JSON.parse(localStorage.getItem('mealfavorites')||'[]');

function saveMealPlan(){localStorage.setItem('mealplan',JSON.stringify(mealPlan));updateMealSub();}
function saveChecked(){localStorage.setItem('grocerychecked',JSON.stringify(groceryChecked));}
function saveFavorites(){localStorage.setItem('mealfavorites',JSON.stringify(favorites));}
function isFav(id){return favorites.some(f=>f.id===id);}
function toggleFav(meal){
  if(isFav(meal.id)){favorites=favorites.filter(f=>f.id!==meal.id);}
  else{favorites.push(meal);}
  saveFavorites();
}
function updateMealSub(){
  const total=(mealPlan.week||[]).length;
  document.getElementById('meal-header-sub').textContent=total===0?'Plan your week':`${total} meal${total!==1?'s':''} planned this week`;
}
updateMealSub();

// Build cuisine pills
const cr=document.getElementById('cuisine-row');
CUISINES.forEach(c=>{
  const btn=document.createElement('button');
  btn.className='c-pill'+(c==='Any'?' on':'');
  btn.textContent=c;
  btn.onclick=()=>{
    selectedCuisine=c;
    document.querySelectorAll('.c-pill').forEach(p=>p.classList.remove('on'));
    btn.classList.add('on');
  };
  cr.appendChild(btn);
});

window.showMealTab = function(name) {
  ['suggest','favorites','plan','grocery'].forEach(n=>{
    document.getElementById('meal-'+n).classList.toggle('active',n===name);
  });
  document.querySelectorAll('.meal-tab').forEach((t,i)=>{
    t.classList.toggle('active',['suggest','favorites','plan','grocery'][i]===name);
  });
  if(name==='plan') renderMealPlan();
  if(name==='grocery') renderGrocery();
  if(name==='favorites') renderFavorites();
};

// ── PANTRY / FRIDGE SUGGESTIONS ──────────────────────────────────────────────
let pantryIngredients = [];

window.addPantryTag = function(e) {
  if (e) e.preventDefault();
  const input = document.getElementById('pantry-input');
  const raw = input.value.trim().replace(/,+$/, '');
  if (!raw) return;
  const items = raw.split(',').map(s => s.trim()).filter(Boolean);
  items.forEach(item => {
    if (item && !pantryIngredients.includes(item.toLowerCase())) {
      pantryIngredients.push(item.toLowerCase());
    }
  });
  input.value = '';
  renderPantryTags();
};

function renderPantryTags() {
  const el = document.getElementById('pantry-tags');
  el.innerHTML = '';
  pantryIngredients.forEach((ing, i) => {
    const tag = document.createElement('div');
    tag.style.cssText = 'display:inline-flex;align-items:center;gap:5px;padding:5px 10px;border-radius:20px;background:var(--meal-green-l);border:1.5px solid var(--meal-green-b);font-size:12px;font-weight:700;color:var(--meal-green);';
    tag.innerHTML = `${ing} <span onclick="removePantryTag(${i})" style="cursor:pointer;font-size:14px;line-height:1;opacity:0.6;">×</span>`;
    el.appendChild(tag);
  });
  document.getElementById('pantry-suggest-btn').style.display = pantryIngredients.length > 0 ? 'block' : 'none';
}

window.removePantryTag = function(i) {
  pantryIngredients.splice(i, 1);
  renderPantryTags();
};

window.fetchPantrySuggestions = async function() {
  if (!pantryIngredients.length) return;
  const btn = document.getElementById('pantry-suggest-btn');
  const grid = document.getElementById('meal-grid');
  btn.disabled = true;
  btn.textContent = '🔍 Finding meals...';
  grid.innerHTML = '<div class="spinner-wrap"><div class="spinner"></div><br>Finding meals from your ingredients...</div>';
  try {
    const prompt = `I have these ingredients at home: ${pantryIngredients.join(', ')}.

Suggest 4 meals I can make. Respond ONLY with valid JSON, no extra text, no markdown:
[
  {
    "title": "Meal Name",
    "emoji": "🍗",
    "readyInMinutes": 30,
    "servings": 4,
    "usedIngredients": ["chicken", "garlic"],
    "missingIngredients": ["lemon", "herbs"],
    "description": "One sentence description of the dish."
  }
]`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const data = await res.json();
    const text = data.content[0].text.trim();
    const clean = text.replace(/```json|```/g, '').trim();
    const meals = JSON.parse(clean);
    renderPantryMealCards(meals);
  } catch(e) {
    grid.innerHTML = '<div class="spinner-wrap">Something went wrong. Try again!</div>';
  } finally {
    btn.disabled = false;
    btn.textContent = '🍽️ Suggest Meals from My Ingredients';
  }
};

function renderPantryMealCards(meals) {
  const grid = document.getElementById('meal-grid');
  grid.innerHTML = '';
  const header = document.createElement('div');
  header.style.cssText = 'font-size:12px;color:var(--muted);font-weight:700;margin-bottom:12px;padding:8px 12px;background:var(--meal-green-l);border-radius:8px;border:1px solid var(--meal-green-b);';
  header.textContent = `✅ Based on: ${pantryIngredients.join(', ')}`;
  grid.appendChild(header);
  meals.forEach(m => {
    const card = document.createElement('div');
    card.className = 'meal-card';
    const usedHtml = (m.usedIngredients||[]).map(i => `<span style="background:var(--meal-green-l);color:var(--meal-green);border:1px solid var(--meal-green-b);border-radius:6px;padding:2px 7px;font-size:11px;font-weight:700;">✓ ${i}</span>`).join('');
    const missingHtml = (m.missingIngredients||[]).length
      ? m.missingIngredients.map(i => `<span style="background:#FFF7ED;color:#EA580C;border:1px solid #FED7AA;border-radius:6px;padding:2px 7px;font-size:11px;font-weight:700;">+ ${i}</span>`).join('')
      : '';
    card.innerHTML = `
      <div class="meal-img-ph" style="font-size:52px;">${m.emoji||'🍽️'}</div>
      <div class="meal-body">
        <div class="meal-name">${m.title}</div>
        <div style="font-size:13px;color:var(--muted);margin-bottom:8px;line-height:1.4;">${m.description}</div>
        <div class="meal-meta">
          ${m.readyInMinutes?`<span>⏱ ${m.readyInMinutes} min</span>`:''}
          ${m.servings?`<span>👤 Serves ${m.servings}</span>`:''}
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px;">${usedHtml}${missingHtml}</div>
        <div class="meal-actions">
          <button class="btn-add" onclick="addPantryMealToPlan('${m.title.replace(/'/g,"\\'")}','${m.emoji||'🍽️'}')">+ Add to Plan</button>
        </div>
      </div>`;
    grid.appendChild(card);
  });
}

window.addPantryMealToPlan = function(title, emoji) {
  if (!mealPlan.week) mealPlan.week = [];
  const id = 'pantry_' + Date.now();
  if (!mealPlan.week.find(m => m.title === title)) {
    mealPlan.week.push({ id, title, image: '', emoji });
  }
  saveMealPlan();
  alert(`"${title}" added to your meal plan!`);
};

window.fetchSuggestions = async function() {
  const btn=document.getElementById('suggest-btn');
  const grid=document.getElementById('meal-grid');
  btn.disabled=true; btn.textContent='Finding meals...';
  grid.innerHTML='<div class="spinner-wrap"><div class="spinner"></div><br>Finding meal ideas...</div>';
  try {
    const cuisine=selectedCuisine==='Any'?'':`&cuisine=${selectedCuisine}`;
    const res=await fetch(`https://api.spoonacular.com/recipes/complexSearch?apiKey=${MEAL_API}&number=6${cuisine}&addRecipeInformation=true&sort=random`);
    const data=await res.json();
    if(!data.results||!data.results.length){grid.innerHTML='<div class="spinner-wrap">No results. Try a different cuisine!</div>';return;}
    renderMealCards(data.results);
  } catch(e){grid.innerHTML='<div class="spinner-wrap">Something went wrong. Try again.</div>';}
  finally{btn.disabled=false;btn.textContent='Find Meal Ideas';}
};

function renderMealCards(recipes){
  const grid=document.getElementById('meal-grid');
  grid.innerHTML='';
  recipes.forEach(r=>{
    const isAdded=(mealPlan.week||[]).some(m=>m.id===r.id);
    const favd=isFav(r.id);
    const meal={id:r.id,title:r.title,image:r.image||'',readyInMinutes:r.readyInMinutes,servings:r.servings};
    const card=document.createElement('div');
    card.className='meal-card';
    card.innerHTML=`
      ${r.image?`<img class="meal-img" src="${r.image}" alt="${r.title}" loading="lazy">`:`<div class="meal-img-ph">🍽️</div>`}
      <div class="meal-body">
        <div class="meal-name">${r.title}</div>
        <div class="meal-meta">
          ${r.readyInMinutes?`<span>⏱ ${r.readyInMinutes} min</span>`:''}
          ${r.servings?`<span>👤 Serves ${r.servings}</span>`:''}
          ${r.cuisines&&r.cuisines.length?`<span>🌍 ${r.cuisines[0]}</span>`:''}
        </div>
        <div class="meal-actions">
          <button class="btn-add ${isAdded?'added':''}" id="addbtn-${r.id}"
            onclick="addMealToPlan(${r.id},'${r.title.replace(/'/g,"\\'")}','${r.image||''}')">
            ${isAdded?'✓ Added':'+ Add to Plan'}
          </button>
          <button class="btn-recipe" onclick="openRecipe(${r.id})">Recipe</button>
          <button class="btn-fav ${favd?'faved':''}" id="favbtn-${r.id}" onclick="toggleFavBtn(${r.id},'${r.title.replace(/'/g,"\\'")}','${r.image||''}',${r.readyInMinutes||0},${r.servings||0})">${favd?'⭐':'☆'}</button>
        </div>
      </div>`;
    grid.appendChild(card);
  });
}

window.toggleFavBtn = function(id,title,image,readyInMinutes,servings){
  toggleFav({id,title,image,readyInMinutes,servings});
  const btn=document.getElementById('favbtn-'+id);
  if(btn){btn.textContent=isFav(id)?'⭐':'☆';btn.classList.toggle('faved',isFav(id));}
};

function renderFavorites(){
  const el=document.getElementById('favorites-list');
  el.innerHTML='';
  if(!favorites.length){
    el.innerHTML='<div class="empty-state">No favorites yet!<br>Tap ☆ on any meal to save it here.</div>';
    return;
  }
  favorites.forEach(f=>{
    const card=document.createElement('div');
    card.className='fav-card';
    card.innerHTML=`
      ${f.image?`<img class="fav-img" src="${f.image}" alt="${f.title}">`:`<div class="fav-img-ph">🍽️</div>`}
      <div class="fav-body">
        <div class="fav-name">${f.title}</div>
        <div class="fav-meta">${f.readyInMinutes?`⏱ ${f.readyInMinutes} min  `:''}${f.servings?`👤 Serves ${f.servings}`:''}</div>
        <div class="fav-actions">
          <button class="fav-btn-sm green" onclick="addMealToPlan(${f.id},'${f.title.replace(/'/g,"\\'")}','${f.image||''}')">+ Add to Plan</button>
          <button class="fav-btn-sm" onclick="openRecipe(${f.id})">Recipe</button>
          <button class="fav-btn-sm red" onclick="removeFav(${f.id})">Remove</button>
        </div>
      </div>`;
    el.appendChild(card);
  });
}

window.removeFav = function(id){
  favorites=favorites.filter(f=>f.id!==id);
  saveFavorites(); renderFavorites();
};

window.addMealToPlan = function(id,title,image){
  if(!mealPlan.week) mealPlan.week=[];
  if(!mealPlan.week.find(m=>m.id===id)) mealPlan.week.push({id,title,image});
  saveMealPlan();
  const btn=document.getElementById('addbtn-'+id);
  if(btn){btn.textContent='✓ Added';btn.classList.add('added');}
};

function renderMealPlan(){
  const el=document.getElementById('plan-list');
  el.innerHTML='';
  const meals=mealPlan.week||[];
  if(!meals.length){el.innerHTML='<div class="empty-state">No meals planned yet.<br>Go to Suggest to find meal ideas!</div>';return;}
  meals.forEach((m,i)=>{
    const row=document.createElement('div');
    row.className='plan-day';
    row.innerHTML=`
      <div class="plan-meal-row">
        ${m.image?`<img src="${m.image}" style="width:48px;height:48px;object-fit:cover;border-radius:8px;flex-shrink:0">`:''}
        <div class="plan-meal-name">${m.title}</div>
        <button class="btn-recipe" style="font-size:12px;padding:6px 10px" onclick="openRecipe(${m.id})">Recipe</button>
        <button class="btn-remove" onclick="removeMeal(${i})">Remove</button>
      </div>`;
    el.appendChild(row);
  });
  const gbtn=document.createElement('button');
  gbtn.className='suggest-btn';
  gbtn.style.marginTop='14px';
  gbtn.textContent='Build Grocery List';
  gbtn.onclick=async()=>{await buildGroceryList();showMealTab('grocery');};
  el.appendChild(gbtn);
}

window.removeMeal = function(idx){
  mealPlan.week.splice(idx,1);
  saveMealPlan(); renderMealPlan();
};

async function buildGroceryList(){
  const allIds=(mealPlan.week||[]).map(m=>m.id);
  if(!allIds.length)return;
  const ingredientMap={};
  for(const id of allIds){
    const res=await fetch(`https://api.spoonacular.com/recipes/${id}/information?apiKey=${MEAL_API}&includeNutrition=false`);
    const r=await res.json();
    (r.extendedIngredients||[]).forEach(ing=>{
      const key=ing.name.toLowerCase();
      if(ingredientMap[key])ingredientMap[key].amount+=ing.amount;
      else ingredientMap[key]={name:ing.name,amount:ing.amount,unit:ing.unit,aisle:ing.aisle||'Other'};
    });
  }
  groceryItems=Object.values(ingredientMap).map((ing,i)=>({
    id:i,name:ing.name,
    amount:ing.amount?`${Math.round(ing.amount*10)/10} ${ing.unit}`.trim():'',
    aisle:ing.aisle
  }));
  groceryChecked=[];
  localStorage.setItem('groceryitems',JSON.stringify(groceryItems));
  saveChecked();
}

function buildGroceryText(){
  const byAisle={};
  groceryItems.forEach(item=>{
    const a=item.aisle||'Other';
    if(!byAisle[a])byAisle[a]=[];
    byAisle[a].push(item);
  });
  let text='🛒 Team Thompson Grocery List\n\n';
  Object.keys(byAisle).sort().forEach(aisle=>{
    text+=`── ${aisle} ──\n`;
    byAisle[aisle].forEach(item=>{
      text+=`• ${item.name}${item.amount?' ('+item.amount+')':''}\n`;
    });
    text+='\n';
  });
  return text.trim();
}

function renderGrocery(){
  const el=document.getElementById('grocery-list');
  const prog=document.getElementById('grocery-progress');
  el.innerHTML='';
  if(!groceryItems.length){
    el.innerHTML='<div class="empty-state">No grocery list yet.<br>Go to This Week and tap "Build Grocery List"!</div>';
    prog.textContent=''; return;
  }
  prog.textContent=`${groceryChecked.length} of ${groceryItems.length} items checked off`;

  // Export buttons row
  const exportRow=document.createElement('div');
  exportRow.style.cssText='display:flex;gap:8px;margin-bottom:14px;';
  const copyBtn=document.createElement('button');
  copyBtn.style.cssText='flex:1;padding:10px;border-radius:10px;border:1.5px solid var(--border);background:var(--card);color:var(--muted);font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;transition:all .15s;';
  copyBtn.textContent='📋 Copy List';
  copyBtn.onclick=async()=>{
    await navigator.clipboard.writeText(buildGroceryText());
    copyBtn.textContent='✓ Copied!';
    setTimeout(()=>copyBtn.textContent='📋 Copy List',2000);
  };
  const shareBtn=document.createElement('button');
  shareBtn.style.cssText='flex:1;padding:10px;border-radius:10px;border:none;background:var(--meal-green);color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;';
  shareBtn.textContent='↑ Share List';
  shareBtn.onclick=async()=>{
    const text=buildGroceryText();
    if(navigator.share){
      try{ await navigator.share({title:'Grocery List',text}); }catch(e){}
    } else {
      await navigator.clipboard.writeText(text);
      shareBtn.textContent='✓ Copied!';
      setTimeout(()=>shareBtn.textContent='↑ Share List',2000);
    }
  };
  exportRow.appendChild(copyBtn);
  exportRow.appendChild(shareBtn);
  el.appendChild(exportRow);

  const byAisle={};
  groceryItems.forEach(item=>{
    const a=item.aisle||'Other';
    if(!byAisle[a])byAisle[a]=[];
    byAisle[a].push(item);
  });
  Object.keys(byAisle).sort().forEach(aisle=>{
    const sec=document.createElement('div');
    sec.innerHTML=`<div class="grocery-section-title">${aisle}</div>`;
    byAisle[aisle].forEach(item=>{
      const checked=groceryChecked.includes(item.id);
      const row=document.createElement('div');
      row.className='grocery-item'+(checked?' checked':'');
      row.innerHTML=`<div class="gi-check">${checked?'✓':''}</div><div class="gi-name">${item.name}</div><div class="gi-amount">${item.amount}</div>`;
      row.onclick=()=>{
        if(groceryChecked.includes(item.id))groceryChecked=groceryChecked.filter(i=>i!==item.id);
        else groceryChecked.push(item.id);
        saveChecked(); renderGrocery();
      };
      sec.appendChild(row);
    });
    el.appendChild(sec);
  });
  const clr=document.createElement('button');
  clr.className='clear-btn';
  clr.textContent='Clear grocery list';
  clr.onclick=()=>{if(confirm('Clear the grocery list?')){groceryItems=[];groceryChecked=[];localStorage.setItem('groceryitems','[]');saveChecked();renderGrocery();}};
  el.appendChild(clr);
}

// ── RECIPE ───────────────────────────────────────────────────────────────────
window.openRecipe = async function(id){
  document.getElementById('recipe-ov').style.display='flex';
  document.getElementById('recipe-sheet').innerHTML='<div class="spinner-wrap"><div class="spinner"></div><br>Loading recipe...</div>';
  try{
    const res=await fetch(`https://api.spoonacular.com/recipes/${id}/information?apiKey=${MEAL_API}&includeNutrition=false`);
    const r=await res.json();
    const ings=(r.extendedIngredients||[]).map(i=>`<div class="recipe-ing">${i.original}</div>`).join('');
    const steps=(r.analyzedInstructions?.[0]?.steps||[]).map((s,i)=>`<div class="recipe-step"><div class="step-num">${i+1}</div><div class="step-txt">${s.step}</div></div>`).join('');
    document.getElementById('recipe-sheet').innerHTML=`
      ${r.image?`<img src="${r.image}" style="width:100%;border-radius:12px;margin-bottom:14px;object-fit:cover;height:190px">`:''}
      <h2>${r.title}</h2>
      <div class="recipe-meta">
        ${r.readyInMinutes?`<span>⏱ ${r.readyInMinutes} min</span>`:''}
        ${r.servings?`<span>👤 Serves ${r.servings}</span>`:''}
        ${r.cuisines?.length?`<span>🌍 ${r.cuisines[0]}</span>`:''}
      </div>
      <div class="recipe-section-title">Ingredients</div>
      ${ings||'<p style="color:var(--muted);font-size:14px">No ingredients listed</p>'}
      <div class="recipe-section-title">Instructions</div>
      ${steps||`<p style="font-size:14px;color:var(--muted)">See full recipe at <a href="${r.sourceUrl}" target="_blank" style="color:var(--meal-green)">${r.sourceName||'source'}</a></p>`}
      <button class="close-btn" onclick="closeRecipe()">Close</button>`;
  }catch(e){
    document.getElementById('recipe-sheet').innerHTML='<div class="spinner-wrap">Could not load recipe.</div><button class="close-btn" onclick="closeRecipe()">Close</button>';
  }
};
window.closeRecipe = () => document.getElementById('recipe-ov').style.display='none';

// ── CALENDAR ─────────────────────────────────────────────────────────────────
const CAL_REF = doc(db, 'family', 'calendar');
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const CAT_COLORS = { school:'#1D4ED8', birthday:'#BE185D', appointment:'#065F46', bill:'#92400E', holiday:'#5B21B6', activity:'#9A3412', other:'#475569' };
const CAT_BG    = { school:'#DBEAFE', birthday:'#FCE7F3', appointment:'#D1FAE5', bill:'#FEF3C7', holiday:'#EDE9FE', activity:'#FFEDD5', other:'#F1F5F9' };

let calEvents = {};   // keyed by 'YYYY-MM-DD' -> array of events
let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth();
let calDaySelected = null;
let editingEventId = null;
let _calIgnore = false;

async function saveCalEvents() {
  _calIgnore = true;
  try { await setDoc(CAL_REF, { events: calEvents }); } catch(e){ console.error(e); }
}

// Boot calendar from Firebase
(async () => {
  try {
    const snap = await getDoc(CAL_REF);
    if (snap.exists()) calEvents = snap.data().events || {};
    renderCalendar();
    onSnapshot(CAL_REF, snap => {
      if (_calIgnore) { _calIgnore=false; return; }
      if (snap.exists()) { calEvents = snap.data().events || {}; renderCalendar(); }
    });
  } catch(e) { console.error(e); renderCalendar(); }
})();

function renderCalendar() {
  const label = document.getElementById('cal-month-label');
  if (label) label.textContent = `${MONTHS[calMonth]} ${calYear}`;
  renderCalGrid();
  renderUpcoming();

}

// Helper: get all events visible on a given dateStr, including recurring ones
function getEventsForDate(dateStr) {
  const deletedIds = (calEvents['__deleted__'] || []);
  const result = [];
  const target = new Date(dateStr + 'T00:00:00');

  // Direct events on this date
  (calEvents[dateStr] || []).forEach(ev => {
    if (!deletedIds.includes(ev.id)) result.push({ ...ev, _virtual: false });
  });

  // Check all stored events for recurring matches
  Object.keys(calEvents).forEach(storedDate => {
    if (storedDate.startsWith('__')) return;
    (calEvents[storedDate] || []).forEach(ev => {
      if (!ev.repeat || deletedIds.includes(ev.id)) return;
      if (storedDate === dateStr) return; // already added above
      const origin = new Date(storedDate + 'T00:00:00');
      if (target <= origin) return;
      // Check repeat end
      if (ev.repeatEnd && target > new Date(ev.repeatEnd + 'T00:00:00')) return;
      // Check if this date matches the repeat rule
      let matches = false;
      const diffDays = Math.round((target - origin) / 86400000);
      if (ev.repeat === 'daily') matches = diffDays > 0;
      else if (ev.repeat === 'weekly') matches = diffDays % 7 === 0;
      else if (ev.repeat === 'biweekly') matches = diffDays % 14 === 0;
      else if (ev.repeat === 'monthly') {
        matches = target.getDate() === origin.getDate() &&
          (target.getFullYear() > origin.getFullYear() || target.getMonth() > origin.getMonth());
      }
      else if (ev.repeat === 'yearly') {
        matches = target.getDate() === origin.getDate() &&
          target.getMonth() === origin.getMonth() &&
          target.getFullYear() > origin.getFullYear();
      }
      if (matches) {
        // Check if this specific date was skipped
        const skipped = ev.skipped || [];
        if (!skipped.includes(dateStr)) {
          result.push({ ...ev, _virtual: true, _originDate: storedDate });
        }
      }
    });
  });

  return result;
}

function renderCalGrid() {
  const grid = document.getElementById('cal-grid');
  if (!grid) return;
  grid.innerHTML = '';
  const dows = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  dows.forEach(d => {
    const h = document.createElement('div');
    h.className = 'cal-dow';
    h.textContent = d;
    grid.appendChild(h);
  });

  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth+1, 0).getDate();
  const daysInPrev  = new Date(calYear, calMonth, 0).getDate();
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

  // prev month filler
  for (let i = firstDay-1; i >= 0; i--) {
    const cell = document.createElement('div');
    cell.className = 'cal-cell other-month';
    const n = document.createElement('div');
    n.className = 'cal-day-num';
    n.textContent = daysInPrev - i;
    cell.appendChild(n);
    grid.appendChild(cell);
  }

  // current month
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const cell = document.createElement('div');
    cell.className = 'cal-cell' + (dateStr === todayStr ? ' today' : '');
    cell.onclick = () => openCalDay(dateStr);

    const n = document.createElement('div');
    n.className = 'cal-day-num';
    n.textContent = d;
    cell.appendChild(n);

    const dayEvents = getEventsForDate(dateStr);
    const maxShow = 3;
    dayEvents.slice(0, maxShow).forEach(ev => {
      const tag = document.createElement('div');
      tag.className = `cal-event cat-${ev.cat||'other'}`;
      const repeatIcon = ev.repeat ? ' 🔁' : '';
      tag.textContent = (ev.time ? ev.time+' ' : '') + ev.name + repeatIcon;
      const originDate = ev._virtual ? ev._originDate : dateStr;
      tag.onclick = e => { e.stopPropagation(); openCalEditVirtual(dateStr, ev.id, originDate); };
      cell.appendChild(tag);
    });
    if (dayEvents.length > maxShow) {
      const more = document.createElement('div');
      more.className = 'cal-more';
      more.textContent = `+${dayEvents.length - maxShow} more`;
      cell.appendChild(more);
    }
    grid.appendChild(cell);
  }

  // next month filler
  const total = firstDay + daysInMonth;
  const remaining = total % 7 === 0 ? 0 : 7 - (total % 7);
  for (let d = 1; d <= remaining; d++) {
    const cell = document.createElement('div');
    cell.className = 'cal-cell other-month';
    const n = document.createElement('div');
    n.className = 'cal-day-num';
    n.textContent = d;
    cell.appendChild(n);
    grid.appendChild(cell);
  }
}

// Opens edit modal for an event — virtual means it's a recurring instance shown on a different date than its origin
window.openCalEditVirtual = function(displayDateStr, id, originDateStr) {
  // For virtual occurrences, we load the origin event but track the display date for skip/delete logic
  const ev = (calEvents[originDateStr]||[]).find(e=>e.id===id);
  if (!ev) return;
  editingEventId = { dateStr: originDateStr, id, virtualDate: displayDateStr };
  document.getElementById('cal-modal-title').textContent = 'Edit Event';
  document.getElementById('cal-modal-sub').textContent = ev.repeat ? `Repeating · ${repeatLabel(ev.repeat)}` : '';
  document.getElementById('cal-name').value = ev.name;
  document.getElementById('cal-date').value = originDateStr;
  document.getElementById('cal-time').value = ev.time||'';
  document.getElementById('cal-cat').value = ev.cat||'other';
  document.getElementById('cal-who').value = ev.who||'Family';
  document.getElementById('cal-repeat').value = ev.repeat||'none';
  document.getElementById('cal-repeat-end').value = ev.repeatEnd||'';
  document.getElementById('cal-repeat-end-row').style.display = (ev.repeat && ev.repeat !== 'none') ? 'block' : 'none';
  const delRow = document.getElementById('cal-del-row');
  delRow.style.display = 'block';
  if (ev.repeat && ev.repeat !== 'none') {
    delRow.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:6px;margin-top:10px">
        <button class="mbtn mbtn-del" onclick="deleteCalEvent(false)">Delete just this occurrence</button>
        <button class="mbtn mbtn-del" style="opacity:0.75" onclick="deleteCalEvent(true)">Delete all occurrences</button>
      </div>`;
  } else {
    delRow.innerHTML = `<button class="mbtn mbtn-del" style="width:100%" onclick="deleteCalEvent(false)">Delete Event</button>`;
  }
  document.getElementById('cal-add-ov').style.display = 'flex';
  closeCalDay();
};

function repeatLabel(r) {
  return { daily:'Daily', weekly:'Weekly', biweekly:'Every 2 weeks', monthly:'Monthly', yearly:'Yearly' }[r] || r;
}

function renderUpcoming() {
  const el = document.getElementById('upcoming-list');
  if (!el) return;
  const today = new Date();
  today.setHours(0,0,0,0);
  const upcoming = [];
  const deletedIds = calEvents['__deleted__'] || [];

  // Gather a window of the next 14 days
  for (let offset = 0; offset <= 14; offset++) {
    const d = new Date(today);
    d.setDate(today.getDate() + offset);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    getEventsForDate(dateStr).forEach(ev => upcoming.push({ dateStr, ev, d: new Date(d) }));
  }

  // Deduplicate by id+dateStr
  const seen = new Set();
  const deduped = upcoming.filter(x => {
    const key = x.ev.id + '|' + x.dateStr;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  deduped.sort((a,b)=>a.d-b.d);
  const next14 = deduped.slice(0, 10);

  if (!next14.length) {
    el.innerHTML = '<div class="upcoming-empty">No upcoming events in the next 2 weeks</div>';
    return;
  }
  el.innerHTML = '';
  next14.forEach(({ dateStr, ev }) => {
    const d = new Date(dateStr + 'T00:00:00');
    const label = d.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' });
    const row = document.createElement('div');
    row.className = 'upcoming-event';
    row.style.cursor = 'pointer';
    const originDate = ev._virtual ? ev._originDate : dateStr;
    row.onclick = () => openCalEditVirtual(dateStr, ev.id, originDate);
    const repeatBadge = ev.repeat ? `<span style="font-size:10px;margin-left:4px">🔁</span>` : '';
    row.innerHTML = `
      <div class="upcoming-dot" style="background:${CAT_COLORS[ev.cat||'other']}"></div>
      <div class="upcoming-info">
        <div class="upcoming-name">${ev.name}${repeatBadge}</div>
        <div class="upcoming-date">${label}${ev.time?' · '+ev.time:''} · ${ev.who||'Family'}</div>
      </div>`;
    el.appendChild(row);
  });
}

window.calNav = function(dir) {
  if (dir === 0) { calYear = new Date().getFullYear(); calMonth = new Date().getMonth(); }
  else { calMonth += dir; if (calMonth > 11){ calMonth=0; calYear++; } if (calMonth < 0){ calMonth=11; calYear--; } }
  renderCalendar();
};

// Add event
window.openCalAdd = function(dateStr) {
  editingEventId = null;
  document.getElementById('cal-modal-title').textContent = 'Add Event';
  document.getElementById('cal-modal-sub').textContent = '';
  document.getElementById('cal-name').value = '';
  document.getElementById('cal-date').value = dateStr || '';
  document.getElementById('cal-time').value = '';
  document.getElementById('cal-cat').value = 'other';
  document.getElementById('cal-who').value = 'Family';
  document.getElementById('cal-repeat').value = 'none';
  document.getElementById('cal-repeat-end').value = '';
  document.getElementById('cal-repeat-end-row').style.display = 'none';
  document.getElementById('cal-del-row').style.display = 'none';
  document.getElementById('cal-add-ov').style.display = 'flex';
};

// Show/hide the repeat-end field based on repeat selection
document.getElementById('cal-repeat').addEventListener('change', function() {
  document.getElementById('cal-repeat-end-row').style.display = this.value === 'none' ? 'none' : 'block';
});

window.openCalEdit = function(dateStr, id) {
  const ev = (calEvents[dateStr]||[]).find(e=>e.id===id);
  if (!ev) return;
  editingEventId = { dateStr, id };
  document.getElementById('cal-modal-title').textContent = 'Edit Event';
  document.getElementById('cal-modal-sub').textContent = '';
  document.getElementById('cal-name').value = ev.name;
  document.getElementById('cal-date').value = dateStr;
  document.getElementById('cal-time').value = ev.time||'';
  document.getElementById('cal-cat').value = ev.cat||'other';
  document.getElementById('cal-who').value = ev.who||'Family';
  document.getElementById('cal-repeat').value = ev.repeat||'none';
  document.getElementById('cal-repeat-end').value = ev.repeatEnd||'';
  document.getElementById('cal-repeat-end-row').style.display = (ev.repeat && ev.repeat !== 'none') ? 'block' : 'none';
  const delRow = document.getElementById('cal-del-row');
  delRow.style.display = 'block';
  if (ev.repeat && ev.repeat !== 'none') {
    delRow.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:6px;margin-top:10px">
        <button class="mbtn mbtn-del" onclick="deleteCalEvent(false)">Delete just this occurrence</button>
        <button class="mbtn mbtn-del" style="opacity:0.75" onclick="deleteCalEvent(true)">Delete all occurrences</button>
      </div>`;
  } else {
    delRow.innerHTML = `<button class="mbtn mbtn-del" style="width:100%" onclick="deleteCalEvent(false)">Delete Event</button>`;
  }
  document.getElementById('cal-add-ov').style.display = 'flex';
  closeCalDay();
};

window.closeCalAdd = () => { document.getElementById('cal-add-ov').style.display='none'; editingEventId=null; };

window.saveCalEvent = async function() {
  const name = document.getElementById('cal-name').value.trim();
  const dateStr = document.getElementById('cal-date').value;
  if (!name || !dateStr) return;
  const repeat = document.getElementById('cal-repeat').value;
  const repeatEnd = document.getElementById('cal-repeat-end').value;
  const ev = {
    id: editingEventId ? editingEventId.id : 'e'+Date.now(),
    name,
    time: document.getElementById('cal-time').value,
    cat:  document.getElementById('cal-cat').value,
    who:  document.getElementById('cal-who').value,
    repeat: repeat !== 'none' ? repeat : undefined,
    repeatEnd: (repeat !== 'none' && repeatEnd) ? repeatEnd : undefined,
  };
  // strip undefined keys
  Object.keys(ev).forEach(k => ev[k] === undefined && delete ev[k]);
  // if editing and date changed, remove from old date
  if (editingEventId && editingEventId.dateStr !== dateStr) {
    calEvents[editingEventId.dateStr] = (calEvents[editingEventId.dateStr]||[]).filter(e=>e.id!==ev.id);
  }
  if (editingEventId && editingEventId.dateStr === dateStr) {
    calEvents[dateStr] = (calEvents[dateStr]||[]).map(e=>e.id===ev.id?ev:e);
  } else {
    if (!calEvents[dateStr]) calEvents[dateStr] = [];
    calEvents[dateStr].push(ev);
  }
  closeCalAdd();
  renderCalendar();
  await saveCalEvents();
};

window.deleteCalEvent = async function(deleteAll) {
  if (!editingEventId) return;
  if (!confirm(deleteAll ? 'Delete ALL occurrences of this event?' : 'Delete this event?')) return;
  if (deleteAll) {
    // Remove the base event from all stored dates
    Object.keys(calEvents).forEach(dateStr => {
      if (dateStr.startsWith('__')) return;
      calEvents[dateStr] = (calEvents[dateStr]||[]).filter(e => e.id !== editingEventId.id);
    });
    // Track as fully deleted so virtual occurrences are suppressed
    if (!calEvents['__deleted__']) calEvents['__deleted__'] = [];
    if (!calEvents['__deleted__'].includes(editingEventId.id)) {
      calEvents['__deleted__'].push(editingEventId.id);
    }
  } else {
    const ev = (calEvents[editingEventId.dateStr]||[]).find(e=>e.id===editingEventId.id);
    if (ev && ev.repeat) {
      // Skip just this specific occurrence (virtual date or origin date)
      const skipDate = editingEventId.virtualDate || editingEventId.dateStr;
      if (!ev.skipped) ev.skipped = [];
      if (!ev.skipped.includes(skipDate)) ev.skipped.push(skipDate);
      calEvents[editingEventId.dateStr] = (calEvents[editingEventId.dateStr]||[]).map(e=>e.id===editingEventId.id?ev:e);
    } else {
      calEvents[editingEventId.dateStr] = (calEvents[editingEventId.dateStr]||[]).filter(e=>e.id!==editingEventId.id);
    }
  }
  closeCalAdd();
  renderCalendar();
  await saveCalEvents();
};

// Day detail modal
window.openCalDay = function(dateStr) {
  calDaySelected = dateStr;
  const d = new Date(dateStr+'T00:00:00');
  document.getElementById('cal-day-title').textContent = d.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'});
  const el = document.getElementById('cal-day-events');
  const events = getEventsForDate(dateStr);
  if (!events.length) {
    el.innerHTML = '<div style="color:var(--muted);font-size:14px;font-weight:600;padding:10px 0">No events this day</div>';
  } else {
    el.innerHTML = events.map(ev=>{
      const originDate = ev._virtual ? ev._originDate : dateStr;
      const repeatBadge = ev.repeat ? ' 🔁' : '';
      return `
      <div onclick="openCalEditVirtual('${dateStr}','${ev.id}','${originDate}')" style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);cursor:pointer">
        <div style="width:10px;height:10px;border-radius:50%;background:${CAT_COLORS[ev.cat||'other']};flex-shrink:0"></div>
        <div style="flex:1">
          <div style="font-size:14px;font-weight:700">${ev.name}${repeatBadge}</div>
          <div style="font-size:12px;color:var(--muted);font-weight:600">${ev.time?ev.time+' · ':''}${ev.who||'Family'}</div>
        </div>
      </div>`;
    }).join('');
  }
  document.getElementById('cal-day-ov').style.display='flex';
};
window.closeCalDay = () => document.getElementById('cal-day-ov').style.display='none';

document.addEventListener('keydown', e=>{
  if(e.key==='Escape'){closeAdd&&closeAdd();closeDel&&closeDel();closePin&&closePin();closeSet&&closeSet();closeRecipe&&closeRecipe();closeCalAdd&&closeCalAdd();closeCalDay&&closeCalDay();}
});
