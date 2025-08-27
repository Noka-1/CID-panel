// Import Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, getDocs, collection, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// KONFIGURACJA FIREBASE
const firebaseConfig = {
  apiKey: "TWÓJ_API_KEY",
  authDomain: "TWÓJ_PROJEKT.firebaseapp.com",
  projectId: "TWÓJ_PROJEKT",
  storageBucket: "TWÓJ_PROJEKT.appspot.com",
  messagingSenderId: "ID",
  appId: "ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let selectedAgentId = null;

window.switchLogin = (mode) => {
  document.getElementById("login-uid").placeholder = mode === "admin" ? "Email admina" : "UID";
  document.getElementById("login-password").placeholder = "Hasło";
  document.getElementById("login-error").innerText = "";
  currentUser = mode;
};

window.login = async () => {
  const uid = document.getElementById("login-uid").value;
  const password = document.getElementById("login-password").value;
  try {
    let email;
    if (currentUser === "admin") {
      email = uid; // admin loguje się emailem
    } else {
      email = `${uid}@cid.division`; // agent loguje się UID+hasło
    }
    await signInWithEmailAndPassword(auth, email, password);
    document.getElementById("login-container").style.display = "none";
    document.getElementById("panel").style.display = "block";
    loadAgents();
  } catch (e) {
    document.getElementById("login-error").innerText = "Błąd: " + e.message;
  }
};

window.logout = async () => {
  await signOut(auth);
  location.reload();
};

window.addAgent = async () => {
  const imie = document.getElementById("imie").value;
  const nazwisko = document.getElementById("nazwisko").value;
  const ranga = document.getElementById("ranga").value;
  const stopien = document.getElementById("stopien").value;
  const uid = document.getElementById("uid").value;
  const haslo = document.getElementById("haslo").value;
  const zarzad = document.getElementById("zarzad").checked;

  try {
    const email = `${uid}@cid.division`;
    const cred = await createUserWithEmailAndPassword(auth, email, haslo);
    await setDoc(doc(db, "agents", cred.user.uid), {
      uid, imie, nazwisko, ranga, stopien, zarzad
    });
    alert("Agent dodany!");
    loadAgents();
  } catch (e) {
    alert("Błąd: " + e.message);
  }
};

window.loadAgents = async () => {
  const lista = document.getElementById("lista-agentow");
  lista.innerHTML = "";
  const querySnapshot = await getDocs(collection(db, "agents"));
  let agents = [];
  querySnapshot.forEach(docSnap => {
    agents.push({ id: docSnap.id, ...docSnap.data() });
  });

  // Sortowanie wg rangi
  const rankOrder = ["01","02","03","5","4","3","2","1"];
  agents.sort((a,b) => rankOrder.indexOf(a.ranga) - rankOrder.indexOf(b.ranga));

  agents.forEach(agent => {
    const div = document.createElement("div");
    div.className = "agent-item";
    div.innerText = `${agent.imie} ${agent.nazwisko} — Ranga: ${agent.ranga}`;
    div.onclick = () => openProfile(agent);
    lista.appendChild(div);
  });
};

window.openProfile = (agent) => {
  selectedAgentId = agent.id;
  document.getElementById("panel").style.display = "none";
  document.getElementById("profil-agenta").style.display = "block";

  document.getElementById("p-imie").innerText = agent.imie;
  document.getElementById("p-nazwisko").innerText = agent.nazwisko;
  document.getElementById("p-uid").innerText = agent.uid;
  document.getElementById("p-stopien").innerText = agent.stopien;
  document.getElementById("p-zarzad").innerText = agent.zarzad ? "Tak" : "Nie";
  document.getElementById("p-ranga").value = agent.ranga;
};

window.closeProfile = () => {
  document.getElementById("profil-agenta").style.display = "none";
  document.getElementById("panel").style.display = "block";
};

window.updateRanga = async () => {
  const newRanga = document.getElementById("p-ranga").value;
  await updateDoc(doc(db, "agents", selectedAgentId), { ranga: newRanga });
  alert("Ranga zaktualizowana!");
  closeProfile();
  loadAgents();
};
