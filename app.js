/* ===================================================
   CID • Panel FIB – Frontend (Firebase Auth + Firestore)
   Funkcje:
   - Logowanie admina (email) i agenta (UID@cid.division)
   - Dodawanie agenta (Auth + Firestore)
   - Lista agentów z sortowaniem wg ważności rangi
   - Drawer profilu: edycja rangi, przełącznik „Zarząd”
   - Szkolenia (dodaj/usuń)
   - Usuwanie agenta (z Firestore) + komunikat o Auth
=================================================== */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import {
  getFirestore, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc,
  collection, query
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

/* ======= KONFIG: wklej dane swojego projektu ======= */
const firebaseConfig = {
  apiKey: "TWOJE_API_KEY",
  authDomain: "TWOJ_PROJEKT.firebaseapp.com",
  projectId: "TWOJ_PROJEKT",
  storageBucket: "TWOJ_PROJEKT.appspot.com",
  messagingSenderId: "NUMER",
  appId: "APP_ID",
};
initializeApp(firebaseConfig);

const auth = getAuth();
const db   = getFirestore();

/* ===== DOM ===== */
const $  = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

const views = { auth:$("#auth"), admin:$("#admin"), agent:$("#agent") };
const tabs  = $$(".tab"), panels = $$(".tab-panel");

const adminUI = {
  email: $("#adminEmail"), pass: $("#adminPass"), err: $("#adminErr"),
  btnLogin: $("#btnAdminLogin"), btnLogout: $("#btnLogoutAdmin"),
  add: {
    imie: $("#aImie"), nazwisko: $("#aNazwisko"),
    ranga: $("#aRanga"), stopien: $("#aStopien"),
    uid: $("#aUID"), haslo: $("#aHaslo"), zarzad: $("#aZarzad"),
    btn: $("#btnAddAgent")
  },
  list: $("#agentsList"),
  search: $("#search"),
  drawer: {
    el: $("#drawer"), backdrop: $("#backdrop"),
    name: $("#pName"), uid: $("#pUID"),
    imie: $("#pImie"), nazwisko: $("#pNazwisko"),
    ranga: $("#pRanga"), stopien: $("#pStopien"),
    zarzad: $("#pZarzad"),
    trainings: $("#pTrainings"),
    tName: $("#tName"), tStatus: $("#tStatus"),
    btnAddTraining: $("#btnAddTraining"),
    btnSaveRank: $("#btnSaveRank"),
    btnDelete: $("#btnDeleteAgent"),
    btnClose: $("#btnCloseDrawer"),
  }
};

const agentUI = {
  btnLogout: $("#btnLogoutAgent"),
  imie: $("#mImie"), nazwisko: $("#mNazwisko"),
  ranga: $("#mRanga"), stopien: $("#mStopien"),
  uid: $("#mUID"), trainings: $("#mTrainings")
};

const agentLogin = { uid: $("#agentUID"), pass: $("#agentPass"), err: $("#agentErr"), btn: $("#btnAgentLogin") };

/* ===== helpers ===== */
function show(view){ Object.values(views).forEach(v=>v.classList.add("hidden")); views[view].classList.remove("hidden"); }
function toast(msg, ms=2200){ const t=$("#toast"); t.textContent=msg; t.classList.add("show"); setTimeout(()=>t.classList.remove("show"), ms); }
function rankWeight(r){ // 01,02,03 > 5..1
  const order = ["01","02","03","5","4","3","2","1"];
  const idx = order.indexOf(String(r));
  return idx < 0 ? 999 : idx; // mniejsze = wyżej
}

/* ===== zakładki logowania ===== */
tabs.forEach(btn=>{
  btn.addEventListener("click", ()=>{
    tabs.forEach(t=>t.classList.remove("active")); btn.classList.add("active");
    panels.forEach(p=>p.classList.remove("active"));
    (btn.dataset.tab==="admin" ? $("#panel-admin") : $("#panel-agent")).classList.add("active");
  });
});

/* ===== LOGOWANIE ===== */
adminUI.btnLogin.addEventListener("click", async ()=>{
  adminUI.err.textContent="";
  const email = adminUI.email.value.trim();
  const pass  = adminUI.pass.value.trim();
  if(!email || !pass){ adminUI.err.textContent="Uzupełnij e-mail i hasło."; return; }
  try{
    await signInWithEmailAndPassword(auth, email, pass);
    if(email !== "admin@cid.division"){ await signOut(auth); adminUI.err.textContent="To nie jest konto administratora."; return; }
    await renderAdmin();
    show("admin");
  }catch(e){ adminUI.err.textContent = pretty(e); }
});

agentLogin.btn.addEventListener("click", async ()=>{
  agentLogin.err.textContent="";
  const uid = agentLogin.uid.value.trim();
  const pass = agentLogin.pass.value.trim();
  if(!uid || !pass){ agentLogin.err.textContent="Podaj UID i hasło."; return; }
  try{
    const email = `${uid}@cid.division`;
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    await renderAgent(cred.user.uid);
    show("agent");
  }catch(e){ agentLogin.err.textContent = pretty(e); }
});

adminUI.btnLogout.addEventListener("click", async ()=>{ try{ await signOut(auth);}catch{} location.reload(); });
agentUI.btnLogout.addEventListener("click", async ()=>{ try{ await signOut(auth);}catch{} location.reload(); });

/* ===== ADMIN: DODAWANIE AGENA ===== */
adminUI.add.btn.addEventListener("click", addAgent);

async function addAgent(){
  const imie=adminUI.add.imie.value.trim();
  const nazwisko=adminUI.add.nazwisko.value.trim();
  const ranga=adminUI.add.ranga.value.trim();
  const stopien=adminUI.add.stopien.value.trim();
  const uid=adminUI.add.uid.value.trim();
  const haslo=adminUI.add.haslo.value;
  const zarzad=adminUI.add.zarzad.checked;

  if(!imie||!nazwisko||!ranga||!stopien||!uid||!haslo){ toast("Uzupełnij wszystkie pola."); return; }

  adminUI.add.btn.disabled = true; adminUI.add.btn.textContent="Dodawanie…";
  try{
    const email = `${uid}@cid.division`;
    const cred = await createUserWithEmailAndPassword(auth, email, haslo);
    await setDoc(doc(db, "agents", cred.user.uid), {
      uid, imie, nazwisko, ranga, stopien, zarzad, szkolenia:[]
    });
    adminUI.add.imie.value = adminUI.add.nazwisko.value = adminUI.add.ranga.value =
      adminUI.add.stopien.value = adminUI.add.uid.value = adminUI.add.haslo.value = "";
    adminUI.add.zarzad.checked = false;
    await renderAdmin();
    toast("✅ Dodano agenta");
  }catch(e){
    toast("❌ " + pretty(e), 2600);
  }finally{
    adminUI.add.btn.disabled=false; adminUI.add.btn.textContent="Dodaj agenta";
  }
}

/* ===== ADMIN: LISTA / PROFIL ===== */
adminUI.search.addEventListener("input", renderAdmin);

async function renderAdmin(){
  adminUI.list.innerHTML="";
  try{
    const q = query(collection(db,"agents"));
    const snaps = await getDocs(q);
    const term = (adminUI.search.value||"").toLowerCase();

    let agents = [];
    snaps.forEach(d=>{
      const a = d.data(); a._id = d.id;
      if([a.imie,a.nazwisko,a.uid].some(v=>String(v||"").toLowerCase().includes(term))) agents.push(a);
    });

    agents.sort((a,b)=> rankWeight(a.ranga) - rankWeight(b.ranga));

    agents.forEach(a=>{
      const card = document.createElement("div");
      card.className="agent-card";

      const head = document.createElement("div");
      head.className="agent-head";
      head.innerHTML="<span>PRACOWNIK</span><span>RANGA</span><span>STOPIEŃ</span>";

      const row = document.createElement("div");
      row.className="agent-row";
      row.innerHTML = `
        <div>
          <div class="agent-name" data-id="${a._id}">${a.imie} ${a.nazwisko}${a.zarzad?'<span class="badge">Zarząd</span>':''}</div>
          <div class="agent-uid">UID: ${a.uid}</div>
        </div>
        <div>${a.ranga}</div>
        <div>${a.stopien}</div>
      `;
      card.appendChild(head); card.appendChild(row);
      adminUI.list.appendChild(card);
    });

    $$(".agent-name").forEach(el=> el.addEventListener("click", ()=> openDrawer(el.dataset.id)));
  }catch(e){
    adminUI.list.innerHTML = `<div class="hint">Błąd ładowania listy: ${pretty(e)}</div>`;
  }
}

let selectedUID = null;

async function openDrawer(docId){
  try{
    const snap = await getDoc(doc(db,"agents",docId));
    if(!snap.exists()) return;
    const a = snap.data(); selectedUID = docId;

    adminUI.drawer.name.textContent = `${a.imie} ${a.nazwisko}${a.zarzad?' • Zarząd':''}`;
    adminUI.drawer.uid.textContent = `UID: ${a.uid}`;
    adminUI.drawer.imie.textContent = a.imie;
    adminUI.drawer.nazwisko.textContent = a.nazwisko;
    adminUI.drawer.ranga.value = String(a.ranga);
    adminUI.drawer.stopien.textContent = a.stopien;
    adminUI.drawer.zarzad.checked = !!a.zarzad;

    adminUI.drawer.trainings.innerHTML="";
    (a.szkolenia||[]).forEach((s,idx)=>{
      const li = document.createElement("li");
      li.innerHTML = `<span>${s.nazwa} — <b class="${s.zdane?'ok':'no'}">${s.zdane?'Zdane':'Nie zdane'}</b></span>
                      <button class="btn outline danger" data-del="${idx}">Usuń</button>`;
      adminUI.drawer.trainings.appendChild(li);
    });

    adminUI.drawer.el.classList.add("open");
    adminUI.drawer.backdrop.classList.add("show");

    // bind delete training
    adminUI.drawer.trainings.querySelectorAll("[data-del]").forEach(btn=>{
      btn.addEventListener("click", ()=> deleteTraining(parseInt(btn.dataset.del)));
    });
  }catch(e){ toast("Błąd profilu: " + pretty(e)); }
}

function closeDrawer(){
  adminUI.drawer.el.classList.remove("open");
  adminUI.drawer.backdrop.classList.remove("show");
  selectedUID=null;
}
adminUI.drawer.btnClose.addEventListener("click", closeDrawer);
adminUI.drawer.backdrop.addEventListener("click", closeDrawer);

adminUI.drawer.btnSaveRank.addEventListener("click", async ()=>{
  if(!selectedUID) return;
  try{
    await updateDoc(doc(db,"agents",selectedUID), {
      ranga: adminUI.drawer.ranga.value,
      zarzad: adminUI.drawer.zarzad.checked
    });
    toast("💾 Zapisano zmiany");
    await renderAdmin(); openDrawer(selectedUID);
  }catch(e){ toast("❌ " + pretty(e)); }
});

adminUI.drawer.btnAddTraining.addEventListener("click", addTrainingToSelected);

async function addTrainingToSelected(){
  if(!selectedUID) return;
  const nazwa = adminUI.drawer.tName.value.trim();
  const zdane = (adminUI.drawer.tStatus.value === "true");
  if(!nazwa){ toast("Podaj nazwę szkolenia."); return; }
  try{
    const ref = doc(db,"agents",selectedUID);
    const snap = await getDoc(ref);
    const a = snap.data();
    const szkolenia = Array.isArray(a.szkolenia)? a.szkolenia : [];
    szkolenia.push({nazwa, zdane});
    await updateDoc(ref,{szkolenia});
    adminUI.drawer.tName.value=""; adminUI.drawer.tStatus.value="true";
    openDrawer(selectedUID);
  }catch(e){ toast("❌ " + pretty(e)); }
}

async function deleteTraining(index){
  if(!selectedUID) return;
  try{
    const ref = doc(db,"agents",selectedUID);
    const snap = await getDoc(ref);
    const a = snap.data(); const arr = Array.isArray(a.szkolenia)? [...a.szkolenia] : [];
    arr.splice(index,1);
    await updateDoc(ref,{szkolenia:arr});
    openDrawer(selectedUID);
  }catch(e){ toast("❌ " + pretty(e)); }
}

adminUI.drawer.btnDelete.addEventListener("click", async ()=>{
  if(!selectedUID) return;
  if(!confirm("Na pewno usunąć tego agenta z bazy (Firestore)?")) return;
  try{
    await deleteDoc(doc(db,"agents",selectedUID));
    toast("🗑️ Usunięto z Firestore. Pamiętaj usunąć konto z AUTH w konsoli/Cloud Function.");
    closeDrawer(); renderAdmin();
  }catch(e){ toast("❌ " + pretty(e)); }
});

/* ===== AGENT: PROFIL ===== */
async function renderAgent(authUid){
  try{
    const snap = await getDoc(doc(db,"agents",authUid));
    if(!snap.exists()){ toast("Brak profilu w bazie."); return; }
    const a = snap.data();
    agentUI.imie.textContent = a.imie;
    agentUI.nazwisko.textContent = a.nazwisko;
    agentUI.ranga.textContent = a.ranga + (a.zarzad ? " • Zarząd" : "");
    agentUI.stopien.textContent = a.stopien;
    agentUI.uid.textContent = a.uid;

    agentUI.trainings.innerHTML="";
    (a.szkolenia||[]).forEach(s=>{
      const li=document.createElement("li");
      li.innerHTML = `<span>${s.nazwa}</span><b class="${s.zdane?'ok':'no'}">${s.zdane?'Zdane':'Nie zdane'}</b>`;
      agentUI.trainings.appendChild(li);
    });
  }catch(e){ toast("❌ " + pretty(e)); }
}

/* ===== UTILS ===== */
function pretty(e){
  const m = String(e?.message||e?.code||e||"");
  if(m.includes("permission")) return "Brak uprawnień (reguły Firestore).";
  if(m.includes("auth/invalid-email")) return "Błędny e-mail.";
  if(m.includes("auth/invalid-credential")||m.includes("wrong-password")) return "Błędne dane logowania.";
  if(m.includes("domain-not-allowed")) return "Dodaj domenę do Authorized domains (Authentication).";
  return m;
}

/* start */
show("auth");
