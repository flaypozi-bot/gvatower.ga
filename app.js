/* app_fixed.js - version corrigée pour éviter boucle de reload
   Important: replace FLOW_* placeholders by your actual Flow URLs if not already.
*/

const FLOW_LOGIN_URL = "FLOW_LOGIN_URL";
const FLOW_SIGNUP_URL = "FLOW_SIGNUP_URL";
const FLOW_CREATE_DEMANDE_URL = "FLOW_CREATE_DEMANDE_URL";

// Prevent double initialization
if (!window._RT_appInitialized) {
  window._RT_appInitialized = true;
} else {
  console.warn('[RT] app already initialized, aborting second init.');
  // stop further execution
  throw new Error('App already initialized');
}

// Simple reload-loop protection
if (!window._RT_reloadCount) window._RT_reloadCount = 0;
window.addEventListener('beforeunload', function(){ window._RT_reloadCount = (window._RT_reloadCount||0) + 1; });
if (window._RT_reloadCount > 3) {
  console.error('[RT] Reload loop detected (>3). Stopping further reloads.');
  // block further location changes by redefining location.href setter (best-effort)
  try {
    Object.defineProperty(window.location, 'href', { writable: false });
  } catch(e){ /* ignore if not allowed */ }
}

// helpers
function qs(sel){ return document.querySelector(sel); }
function toast(msg, target='#msg'){ const el=document.querySelector(target); if(el) el.innerText=msg; console.log('[RT]',msg); }
async function postJSON(url, body){
  try {
    const res = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
    return res;
  } catch(err){
    console.error('[RT] fetch error', err);
    throw err;
  }
}
function base64FromFile(file){
  return new Promise((resolve,reject)=>{
    if(!file) return resolve('');
    const r = new FileReader();
    r.onload = ()=> resolve(r.result.split(',')[1]);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

// --- Signup ---
async function initSignup(){
  const form = qs('#signupForm');
  if(!form) return;
  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const email = qs('#email')?.value.trim();
    const nom = qs('#nom')?.value.trim();
    const role = qs('#role')?.value || 'Technicien';
    if(!email || !nom){ toast('Veuillez renseigner nom et email','#message'); return; }
    toast('Envoi inscription...','#message');
    console.log('[RT] signup payload', {email, nom, role});
    try {
      const r = await postJSON(FLOW_SIGNUP_URL, { email, nom, role });
      if(r.ok){ toast('Inscription reçue — admin validera.','#message'); form.reset(); }
      else { const t = await r.text(); toast('Erreur inscription: ' + (t||r.status),'#message'); console.warn('[RT] signup response not ok', r.status, t); }
    } catch(err){ toast('Erreur réseau: '+ err.message, '#message'); }
  });
}

// --- Login ---
async function initLogin(){
  const form = qs('#loginForm');
  if(!form) return;
  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const email = qs('#loginEmail')?.value.trim();
    const password = qs('#loginPassword')?.value || '';
    if(!email || !password){ toast('Email et mot de passe requis','#loginMsg'); return; }
    toast('Connexion...','#loginMsg');
    console.log('[RT] login attempt', {email});
    try {
      const r = await postJSON(FLOW_LOGIN_URL, { email, password });
      const data = await r.json().catch(()=>({status:'error', text:'invalid json'}));
      console.log('[RT] login response', data);
      if(data.status === 'ok'){
        localStorage.setItem('user', JSON.stringify({ email:data.email, nom:data.nom }));
        // IMPORTANT: use relative URLs to avoid absolute-root redirect loops
        const target = 'interface.html';
        console.log('[RT] redirect to', target);
        window.location.href = target;
      } else if (data.status === 'notfound'){
        toast('Utilisateur non trouvé','#loginMsg');
      } else if (data.status === 'inactive'){
        toast('Compte non activé. Contactez un administrateur.','#loginMsg');
      } else {
        toast('Email ou mot de passe incorrect','#loginMsg');
      }
    } catch(err){ toast('Erreur réseau: ' + err.message, '#loginMsg'); console.error(err); }
  });
}

// --- Interface (create demande + dashboard) ---
async function initInterface(){
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  if(!user){ 
    console.log('[RT] no user in localStorage, redirecting to index.html');
    // Use relative path
    window.location.href = 'index.html';
    return;
  }
  qs('#userNom') && (qs('#userNom').innerText = user.nom || user.email);
  qs('#logoutBtn') && qs('#logoutBtn').addEventListener('click', ()=>{
    localStorage.removeItem('user');
    window.location.href = 'index.html';
  });

  qs('#demForm')?.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const title = qs('#title')?.value.trim() || 'Remont terrain';
    const typeEquip = qs('#typeEquip')?.value || '';
    const service = qs('#service')?.value || '';
    const priorite = qs('#prio')?.value || 'Moyenne';
    const commentaire = qs('#comment')?.value || '';
    const coordGPS = qs('#coordGPS')?.value || '';
    const file = qs('#photo')?.files[0] || null;
    qs('#demMsg') && (qs('#demMsg').innerText = 'Envoi en cours...');
    try {
      const base64 = await base64FromFile(file);
      const payload = {
        email: user.email,
        nom: user.nom || user.email,
        title,
        typeEquipement: typeEquip,
        coordGPS,
        commentaire,
        service,
        priorite,
        image_name: file ? Date.now() + '_' + file.name : '',
        image_base64: base64
      };
      console.log('[RT] create demande payload', {email: payload.email, title: payload.title});
      const r = await postJSON(FLOW_CREATE_DEMANDE_URL, payload);
      if(r.ok){ qs('#demMsg') && (qs('#demMsg').innerText = 'Demande enregistrée.'); qs('#demForm').reset(); }
      else { const t = await r.text(); qs('#demMsg') && (qs('#demMsg').innerText = 'Erreur: ' + (t||r.status)); console.warn('[RT] create demande error', r.status, t); }
    } catch(err){ qs('#demMsg') && (qs('#demMsg').innerText = 'Erreur réseau: ' + err.message); console.error(err); }
  });

  // loadCounts: you can implement a FLOW_GET_COUNTS if needed. For now placeholders:
  (function loadCounts(){
    qs('#countTotal') && (qs('#countTotal').innerText = '-');
    qs('#countInProgress') && (qs('#countInProgress').innerText = '-');
    qs('#countClosed') && (qs('#countClosed').innerText = '-');
  })();
}

// Auto init according to page DOM
document.addEventListener('DOMContentLoaded', ()=>{
  console.log('[RT] DOMContentLoaded - initializing app');
  initSignup();
  initLogin();
  initInterface();
});
