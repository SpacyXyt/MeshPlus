const DEFAULT_USER = {
  id: "default_user",
  username: "User1",
  alternatives: ["user1", "user2"],
  password: "unepassword"
};

const DEFAULT_BASE_URL = "https://mesh.un-domain.fr/";
const FULLSCREEN_MODES = ["always", "never", "ask"];
const CONTRIBUTORS = [
  {
    id: "yuto",
    name: "Niels",
    role: "Développement",
    description: "Développeur du projet et CEO de Devlynx.",
    links: [
      { label: "GitHub", url: "https://github.com/SpacyXyt" },
      { label: "Site", url: "https://www.devlynx.fr" }
    ]
  }
];

let state = {
  baseUrl: DEFAULT_BASE_URL,
  fullscreenMode: "ask",
  users: [],
  selectedUserId: null,
  selectedContributorId: CONTRIBUTORS[0]?.id || null,
  dirty: false
};

function generateId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return "user_" + Date.now() + "_" + Math.random().toString(16).slice(2);
}

function parseAlternatives(value) {
  return value.split(",").map(item => item.trim()).filter(Boolean);
}

function normalizeBaseUrl(value) {
  let baseUrl = value.trim();
  if (!baseUrl) return "";
  if (!baseUrl.endsWith("/")) baseUrl += "/";
  return baseUrl;
}

function selectedUser() {
  return state.users.find(user => user.id === state.selectedUserId) || null;
}

function selectedContributor() {
  return CONTRIBUTORS.find(contributor => contributor.id === state.selectedContributorId) || CONTRIBUTORS[0] || null;
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("visible");
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => toast.classList.remove("visible"), 2200);
}

function setDirty(value) {
  state.dirty = value;
  document.getElementById("saveBtn").textContent = value ? "Sauvegarder *" : "Sauvegarder";
}

function ensureDevlynxBrand() {
  const brandContainer = document.querySelector(".brand > div");
  if (!brandContainer) return;

  const currentBrand = document.getElementById("devlynxBrand");
  const currentLogo = currentBrand?.querySelector("img");
  const currentText = currentBrand?.querySelector("span");

  if (
    currentBrand?.parentElement === brandContainer &&
    currentBrand.className === "madeBy" &&
    currentLogo?.getAttribute("src") === "../icons/logo-devlynx.png" &&
    currentText?.textContent === "Made by Devlynx"
  ) {
    return;
  }

  // Le bloc de marque est recréé si une modification du DOM le retire.
  const brand = currentBrand || document.createElement("div");
  brand.className = "madeBy";
  brand.id = "devlynxBrand";
  brand.textContent = "";

  const logo = document.createElement("img");
  logo.src = "../icons/logo-devlynx.png";
  logo.alt = "";

  const text = document.createElement("span");
  text.textContent = "Made by Devlynx";

  brand.appendChild(logo);
  brand.appendChild(text);

  if (brand.parentElement !== brandContainer) {
    brandContainer.appendChild(brand);
  }
}

function protectDevlynxBrand() {
  ensureDevlynxBrand();

  const observer = new MutationObserver(ensureDevlynxBrand);
  observer.observe(document.body, { childList: true, subtree: true });
}

function showView(viewName) {
  const nextView = ["general", "users", "credits"].includes(viewName) ? viewName : "general";

  // Le hash permet à la popup d'ouvrir directement le bon onglet.
  for (const button of document.querySelectorAll(".tabBtn")) {
    button.classList.toggle("active", button.dataset.view === nextView);
  }

  document.getElementById("generalView").classList.toggle("active", nextView === "general");
  document.getElementById("usersView").classList.toggle("active", nextView === "users");
  document.getElementById("creditsView").classList.toggle("active", nextView === "credits");

  if (location.hash !== `#${nextView}`) {
    history.replaceState(null, "", `#${nextView}`);
  }
}

function renderGeneral() {
  document.getElementById("baseUrl").value = state.baseUrl;
  document.getElementById("fullscreenMode").value = state.fullscreenMode;
}

function renderList() {
  const list = document.getElementById("userList");
  const count = document.getElementById("userCount");
  list.innerHTML = "";
  count.textContent = `${state.users.length} utilisateur${state.users.length > 1 ? "s" : ""}`;

  if (state.users.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "Aucun utilisateur. Ajoute un compte pour commencer.";
    list.appendChild(empty);
    return;
  }

  for (const user of state.users) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "userItem";
    if (user.id === state.selectedUserId) item.classList.add("selected");

    const title = document.createElement("strong");
    title.textContent = user.username || "Utilisateur sans nom";

    const meta = document.createElement("small");
    const alternatives = Array.isArray(user.alternatives) ? user.alternatives : [];
    meta.textContent = alternatives.length > 0
      ? `${alternatives.length} alias - ${user.id}`
      : `Aucun alias - ${user.id}`;

    item.appendChild(title);
    item.appendChild(meta);
    item.addEventListener("click", () => {
      state.selectedUserId = user.id;
      render();
    });
    list.appendChild(item);
  }
}

function renderCredits() {
  const list = document.getElementById("contributorsList");
  const details = document.getElementById("contributorDetails");
  if (!list || !details) return;

  list.innerHTML = "";

  for (const contributor of CONTRIBUTORS) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "contributorItem";
    item.classList.toggle("selected", contributor.id === state.selectedContributorId);

    const name = document.createElement("strong");
    name.textContent = contributor.name;

    const role = document.createElement("small");
    role.textContent = contributor.role;

    item.appendChild(name);
    item.appendChild(role);
    item.addEventListener("click", () => {
      state.selectedContributorId = contributor.id;
      renderCredits();
    });
    list.appendChild(item);
  }

  renderContributorDetails(details);
}

function renderContributorDetails(details) {
  const contributor = selectedContributor();
  details.innerHTML = "";

  if (!contributor) {
    details.textContent = "Aucun contributeur sélectionné.";
    return;
  }

  const title = document.createElement("h3");
  title.textContent = contributor.name;

  const role = document.createElement("span");
  role.className = "contributorRole";
  role.textContent = contributor.role;

  const description = document.createElement("p");
  description.textContent = contributor.description;

  const links = document.createElement("div");
  links.className = "contributorLinks";

  for (const link of contributor.links || []) {
    const anchor = document.createElement("a");
    anchor.href = link.url;
    anchor.target = "_blank";
    anchor.rel = "noreferrer";
    anchor.textContent = link.label;
    links.appendChild(anchor);
  }

  details.appendChild(title);
  details.appendChild(role);
  details.appendChild(description);
  details.appendChild(links);
}

function renderForm() {
  const user = selectedUser();
  const fields = ["userId", "username", "alternatives", "password"].map(id => document.getElementById(id));
  document.getElementById("deleteBtn").disabled = !user;

  if (!user) {
    document.getElementById("editState").textContent = "Sélectionne un utilisateur.";
    for (const field of fields) {
      field.value = "";
      field.disabled = true;
    }
    return;
  }

  document.getElementById("editState").textContent = "Les changements seront enregistrés avec Sauvegarder.";
  for (const field of fields) field.disabled = false;

  document.getElementById("userId").value = user.id;
  document.getElementById("username").value = user.username || "";
  document.getElementById("alternatives").value = Array.isArray(user.alternatives) ? user.alternatives.join(", ") : "";
  document.getElementById("password").value = user.password || "";
}

function render() {
  renderGeneral();
  renderList();
  renderForm();
  renderCredits();
}

function updateGeneralFromForm() {
  state.baseUrl = document.getElementById("baseUrl").value;
  state.fullscreenMode = document.getElementById("fullscreenMode").value;
  setDirty(true);
}

function updateFromForm() {
  const user = selectedUser();
  if (!user) return;

  const nextId = document.getElementById("userId").value.trim();
  const duplicate = state.users.some(item => item.id === nextId && item.id !== user.id);

  if (nextId && !duplicate) {
    user.id = nextId;
    state.selectedUserId = nextId;
  }

  user.username = document.getElementById("username").value.trim();
  user.alternatives = parseAlternatives(document.getElementById("alternatives").value);
  user.password = document.getElementById("password").value;
  renderList();
  setDirty(true);
}

function addUser() {
  const id = generateId();
  const user = {
    id,
    username: "Nouvel utilisateur",
    alternatives: [],
    password: ""
  };

  state.users.push(user);
  state.selectedUserId = id;
  render();
  setDirty(true);
}

function deleteUser() {
  const user = selectedUser();
  if (!user) return;

  state.users = state.users.filter(item => item.id !== user.id);
  state.selectedUserId = state.users[0]?.id || null;
  render();
  setDirty(true);
}

async function load() {
  const data = await browser.storage.local.get({
    baseUrl: DEFAULT_BASE_URL,
    fullscreenMode: "ask",
    users: [DEFAULT_USER],
    selectedUserId: DEFAULT_USER.id
  });

  state.baseUrl = normalizeBaseUrl(data.baseUrl || DEFAULT_BASE_URL);
  state.fullscreenMode = FULLSCREEN_MODES.includes(data.fullscreenMode) ? data.fullscreenMode : "ask";
  state.users = Array.isArray(data.users) ? data.users : [DEFAULT_USER];
  state.selectedUserId = data.selectedUserId || state.users[0]?.id || null;
  render();
  setDirty(false);
}

async function save() {
  const baseUrl = normalizeBaseUrl(state.baseUrl);
  if (!baseUrl) {
    showToast("Mesh URL obligatoire.");
    showView("general");
    return;
  }

  state.baseUrl = baseUrl;
  state.fullscreenMode = FULLSCREEN_MODES.includes(state.fullscreenMode) ? state.fullscreenMode : "ask";

  // On écarte les comptes incomplets avant stockage pour garder une configuration exploitable.
  const validUsers = state.users.filter(user => user.id && user.username);

  if (validUsers.length !== state.users.length) {
    state.users = validUsers;
    state.selectedUserId = validUsers.find(user => user.id === state.selectedUserId)?.id || validUsers[0]?.id || null;
    render();
  }

  await browser.storage.local.set({
    baseUrl: state.baseUrl,
    fullscreenMode: state.fullscreenMode,
    users: state.users,
    selectedUserId: state.selectedUserId
  });

  renderGeneral();
  setDirty(false);
  showToast("Paramètres sauvegardés.");
}

document.addEventListener("DOMContentLoaded", async () => {
  protectDevlynxBrand();
  await load();
  showView(location.hash.replace("#", ""));

  document.getElementById("backBtn").addEventListener("click", () => {
    if (history.length > 1) {
      history.back();
      return;
    }

    window.close();
  });

  for (const button of document.querySelectorAll(".tabBtn")) {
    button.addEventListener("click", () => showView(button.dataset.view));
  }

  document.getElementById("saveBtn").addEventListener("click", save);
  document.getElementById("addBtn").addEventListener("click", addUser);
  document.getElementById("deleteBtn").addEventListener("click", deleteUser);

  document.getElementById("baseUrl").addEventListener("input", updateGeneralFromForm);
  document.getElementById("fullscreenMode").addEventListener("change", updateGeneralFromForm);

  document.getElementById("userId").addEventListener("input", updateFromForm);
  document.getElementById("username").addEventListener("input", updateFromForm);
  document.getElementById("alternatives").addEventListener("input", updateFromForm);
  document.getElementById("password").addEventListener("input", updateFromForm);
});
