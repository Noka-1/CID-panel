/* ===================================================
   CID • Panel FIB – HTML+CSS+JS + Firebase (Auth/Firestore)
   - Admin: Firebase Auth (email: admin@cid.division)
   - Agenci: logowanie UID + hasło (w Firestore, pole "haslo")
=================================================== */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import {
  getFirestore, doc, setDoc, getDoc, getDocs, updateDoc, collection, query
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

/* ======= UZUPEŁNIJ TYM DANYMI Z KONFIGU WEB-APP ======= */
const firebaseConfig = {
  apiKey: "AIzaSyA2y8LrRjna_aALAb2M3EvWXxQ31O1YmxI",
  authDomain: "cid-panel.firebaseapp.com",
  projectId: "cid-panel",
  storageBucket: "cid-panel.firebasestorage.app",
  messagingSenderId: "1082261416682",
  appId: "1:1082261416682:web:b3ed74f583119884860593",
  measurementId: "G-0BB6Z67KKG"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

/* ======= DOM helpers ======= */
const $  = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

const views = { auth:$("#auth"), admin:$("#admin"), agent:$("#agent") };
function show(view){ Object.values(views).forEach(v=>v.classList.add("hidden")); views[view].classList.remove("hidden"); }

/* ======= Tabs logowania ======= */
const tabs=$$(".tab"), panels=$$(".tab-panel");
tabs.forEach(btn=>{
  btn.addEventListener("click", ()=>{
    tabs.forEach(t=>t.classList.remove("active"));
    btn.classList.add("active");
    panels.forEach(p=>p.classList.remove("active"));
    const id = btn.dataset.tab === "admin" ? "#panel-admin" : "#panel-agent";
    document.querySelector(id).classList.add("active");
  });
});

/* ======= Ekran logowania ======= */
const adminEmail=$("#adminEmail");
const adminPass =$("#adminPass");
const adminErr  =$("#adminErr");
const agentUID  =$("#agentUID");
const agentPass =$("#agentPass");
const agentErr  =$("#agentErr");

$("#btnAdminLogin").addEventListener("click", onAdminLogin);
$("#btnAgentLogin").addEventListener("click", onAgentLogin);
$("#btnLogoutAdmin").addEventListener("click", ()=>logout());
$("#btnLogoutAgent").addEventListener("click", ()=>logout());

/* ======= Admin: dodawanie agenta ======= */
const aImie=$("#aImie"), aNazwisko=$("#aNazwisko"),
      aRanga=$("#aRanga"), aStopien=$("#aStopien"),
      aUID=$("#aUID"), aHaslo=$("#aHaslo");
const btnAddAgent=$("#btnAddAgent");
btnAddAgent.addEventListener("click", addAgent);

/* ======= Lista + wyszukiwarka ======= */
const agentsList=$("#agentsList"), search=$("#search");
search.addEventListener("input", renderAdmin);

/* ======= Drawer (profil) ======= */
const drawer=$("#drawer"), backdrop=$("#backdrop");
$("#btnCloseDrawer").addEventListener("click", closeDrawer);
backdrop.addEventListener("click", closeDrawer);
const pName=$("#pName"), pUID=$("#pUID"), pImie=$("#pImie"), pNazwisko=$("#pNazwisko"),
      pRanga=$("#pRanga"), pStopien=$("#pStopien"), pTrainings=$("#pTrainings");
const tName=$("#tName"), tStatus=$("#tStatus");
$("#btnAddTraining").addEventListener("click", addTrainingToSelected);
let selectedUID=null;

/* ======= Agent panel ======= */
const mImie=$("#mImie"), mNazwisko=$("#mNazwisko"), mRanga=$("#mRanga"),
      mStopien=$("#mStopien"), mUID=$("#mUID"), mTrainings=$("#mTrainings");

/* ======= Sesja ======= */
let session={role:null, uid:null};

/* ======= Auth observer (na przyszłość) ======= */
onAuthStateChanged(auth, (_user)=>{ /* tu można rozbudować utrzymanie sesji admina */ });

/* =========================
   LOGOWANIE
========================= */
async function onAdminLogin(){
  adminErr.textContent="";
  const email = adminEmail.value.trim();
  const pass  = adminPass.value;
  if(!email || !pass){ adminErr.textContent="Uzupełnij e-mail i hasło."; return; }

  try{
    await signInWithEmailAndPassword(auth, email, pass);
    if(email !== "admin@cid.division"){
      adminErr.textContent="To nie jest konto administratora.";
      await signOut(auth);
      return;
    }
    session={role:"admin", uid:null};
    await renderAdmin();
    show("admin");
  }catch(e){
    console.error("Admin login error:", e);
    adminErr.textContent=prettyFirebaseError(e);
  }
}

async function onAgentLogin(){
  agentErr.textContent="";
  const uid = agentUID.value.trim();
  const pass= agentPass.value;
  if(!uid || !pass){ agentErr.textContent="Podaj UID i hasło."; return; }

  try{
    const ref  = doc(db, "agents", uid);
    const snap = await getDoc(ref);
    if(!snap.exists()){ agentErr.textContent="Nie znaleziono agenta o podanym UID."; return; }
    const a = snap.data();
    if(a.haslo !== pass){ agentErr.textContent="Błędne hasło."; return; }

    session={role:"agent", uid};
    await renderAgent(uid);
    show("agent");
  }catch(e){
    console.error("Agent login error:", e);
    agentErr.textContent=prettyFirebaseError(e);
  }
}

async function logout(){
  try{ await signOut(auth); }catch(_){}
  session={role:null, uid:null};
  show("auth");
}

/* =========================
   ADMIN: DODAWANIE AGENTA
========================= */
async function addAgent(){
  if(session.role!=="admin"){ alert("Musisz być zalogowany jako admin."); return; }

  const imie=aImie.value.trim(), nazwisko=aNazwisko.value.trim(),
        ranga=aRanga.value.trim(), stopien=aStopien.value.trim(),
        uid=aUID.value.trim(), haslo=aHaslo.value;

  if(!imie||!nazwisko||!ranga||!stopien||!uid||!haslo){
    alert("Uzupełnij wszystkie pola agenta.");
    return;
  }

  // Prosta walidacja formatu Rangi: 1–5 lub 01–03 (zarząd)
  const okRanga = /^([1-5]|0[1-3])$/.test(ranga) || /^[1-5]$/.test(ranga) || /^0[1-3]$/.test(ranga) || /^[0-3][0-9]$/.test(ranga) || /^[0-9]+$/.test(ranga);
  if(!okRanga){
    // Nie twardo blokujemy – tylko info
    console.warn("Nietypowy format rangi:", ranga);
  }

  btnAddAgent.disabled = true;
  btnAddAgent.textContent = "Dodawanie…";

  try{
    const ref = doc(db, "agents", uid);
    const exists = await getDoc(ref);
    if(exists.exists()){
      alert("Agent z takim UID już istnieje.");
      return;
    }

    await setDoc(ref, {
      uid, haslo,
      imie, nazwisko,
      ranga, stopien,
      szkolenia: []
    });

    aImie.value=aNazwisko.value=aRanga.value=aStopien.value=aUID.value=aHaslo.value="";
    await renderAdmin();
    alert("✅ Dodano agenta.");
  }catch(e){
    console.error("Add agent error:", e);
    alert("❌ Nie udało się dodać agenta: " + prettyFirebaseError(e));
  }finally{
    btnAddAgent.disabled = false;
    btnAddAgent.textContent = "Dodaj agenta";
  }
}

/* =========================
   ADMIN: LISTA I PROFIL
========================= */
async function renderAdmin(){
  agentsList.innerHTML = "";
  try{
    const q = query(collection(db, "agents"));
    const snaps = await getDocs(q);
    const term = (search.value||"").toLowerCase();

    snaps.forEach(d=>{
      const a = d.data();
      if(![a.imie,a.nazwisko,a.uid].some(v=>String(v||"").toLowerCase().includes(term))) return;

      const card = document.createElement("div");
      card.className="agent-card";

      const head = document.createElement("div");
      head.className="agent-head";
      head.innerHTML="<span>PRACOWNIK</span><span>RANGA</span><span>STOPIEŃ</span>";

      const row = document.createElement("div");
      row.className="agent-row";
      row.innerHTML = `
        <div>
          <div class="agent-name" data-uid="${a.uid}">${a.imie} ${a.nazwisko}</div>
          <div class="agent-uid">UID: ${a.uid}</div>
        </div>
        <div>${a.ranga}</div>
        <div>${a.stopien}</div>
      `;

      card.appendChild(head);
      card.appendChild(row);
      agentsList.appendChild(card);
    });

    $$(".agent-name").forEach(el=> el.addEventListener("click", ()=> openDrawer(el.dataset.uid)));
  }catch(e){
    console.error("Render list error:", e);
    agentsList.innerHTML = `<div class="hint err">Błąd ładowania listy: ${prettyFirebaseError(e)}</div>`;
  }
}

async function openDrawer(uid){
  try{
    const snap = await getDoc(doc(db, "agents", uid));
    if(!snap.exists()) return;
    const a = snap.data();

    selectedUID = uid;
    pName.textContent = `${a.imie} ${a.nazwisko}`;
    pUID.textContent  = `UID: ${a.uid}`;
    pImie.textContent = a.imie;
    pNazwisko.textContent = a.nazwisko;
    pRanga.textContent = a.ranga;
    pStopien.textContent = a.stopien;

    pTrainings.innerHTML="";
    (a.szkolenia||[]).forEach(s=>{
      const li = document.createElement("li");
      li.innerHTML = `${s.nazwa} — <span class="${s.zdane?'ok':'no'}">${s.zdane?'Zdane':'Nie zdane'}</span>`;
      pTrainings.appendChild(li);
    });

    drawer.classList.add("open");
    backdrop.classList.add("show");
  }catch(e){
    console.error("Open drawer error:", e);
    alert("Błąd wczytywania profilu: " + prettyFirebaseError(e));
  }
}

function closeDrawer(){
  drawer.classList.remove("open");
  backdrop.classList.remove("show");
  selectedUID=null;
}

async function addTrainingToSelected(){
  if(!selectedUID) return;
  const nazwa = tName.value.trim();
  const zdane = (tStatus.value === "true");
  if(!nazwa){ alert("Podaj nazwę szkolenia."); return; }

  try{
    const ref = doc(db, "agents", selectedUID);
    const snap = await getDoc(ref);
    if(!snap.exists()) return;
    const a = snap.data();
    const szkolenia = Array.isArray(a.szkolenia) ? a.szkolenia : [];
    szkolenia.push({nazwa, zdane});
    await updateDoc(ref, { szkolenia });

    tName.value=""; tStatus.value="false";
    openDrawer(selectedUID);
  }catch(e){
    console.error("Add training error:", e);
    alert("Nie udało się dodać szkolenia: " + prettyFirebaseError(e));
  }
}

/* =========================
   AGENT: PROFIL
========================= */
async function renderAgent(uid){
  try{
    const snap = await getDoc(doc(db, "agents", uid));
    if(!snap.exists()) return;
    const a = snap.data();

    mImie.textContent=a.imie;
    mNazwisko.textContent=a.nazwisko;
    mRanga.textContent=a.ranga;
    mStopien.textContent=a.stopien;
    mUID.textContent=a.uid;

    mTrainings.innerHTML="";
    (a.szkolenia||[]).forEach(s=>{
      const li=document.createElement("li");
      li.innerHTML = `${s.nazwa} — <span class="${s.zdane?'ok':'no'}">${s.zdane?'Zdane':'Nie zdane'}</span>`;
      mTrainings.appendChild(li);
    });
  }catch(e){
    console.error("Render agent error:", e);
  }
}

/* ======= Pomocnicze: ładniejsze błędy ======= */
function prettyFirebaseError(e){
  const msg = String(e && (e.message || e.code || e)) || "unknown";
  if(msg.includes("permission-denied")) return "Brak uprawnień (sprawdź reguły Firestore).";
  if(msg.includes("Missing or insufficient permissions")) return "Brak uprawnień (reguły Firestore).";
  if(msg.includes("Failed to get document")) return "Nie udało się pobrać dokumentu.";
  if(msg.includes("auth/invalid-email")) return "Błędny e-mail.";
  if(msg.includes("auth/invalid-credential") || msg.includes("auth/wrong-password")) return "Błędne dane logowania.";
  if(msg.includes("auth/domain-not-allowed")) return "Dodaj domenę do Authorized domains w Authentication.";
  return msg;
}

/* Start */
show("auth");
