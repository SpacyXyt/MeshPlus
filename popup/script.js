let data = {
  selectors: {}
};

const DEFAULT_SELECTORS = {
  connectButton: "",
  lockIndicator: "",
  desktop: "",
  desktopControl: "",
  typeTextInput: "",
  dialogOkButton: "",
  clipboardButton: ""
};

const SELECTOR_DEFINITIONS = [
  {
    key: "connectButton",
    label: "Bouton se connecter",
    help: "Bouton MeshCentral qui démarre la connexion VNC."
  },
  {
    key: "lockIndicator",
    label: "Élément de connexion / clé",
    help: "Icône ou élément qui indique que la session est verrouillée."
  },
  {
    key: "desktop",
    label: "Zone bureau",
    help: "Élément principal du bureau distant."
  },
  {
    key: "desktopControl",
    label: "Contrôle bureau",
    help: "Case ou bouton qui active le contrôle du bureau."
  },
  {
    key: "typeTextInput",
    label: "Champ de saisie",
    help: "Champ utilisé par la fenêtre de saisie texte MeshCentral."
  },
  {
    key: "dialogOkButton",
    label: "Bouton OK saisie",
    help: "Bouton qui valide la fenêtre de saisie texte."
  },
  {
    key: "clipboardButton",
    label: "Presse-papier",
    help: "Bouton ou élément de presse-papier, disponible pour les futures actions."
  }
];

function markUnsaved() {
  const status = document.getElementById("status");
  status.classList.add("unsaved");
  status.classList.remove("saved");
}

function markSaved() {
  const status = document.getElementById("status");
  status.classList.remove("unsaved");
  status.classList.add("saved");
}

function ensureDevlynxBrand() {
  const main = document.getElementById("main");
  if (!main) return;

  const currentBrand = document.getElementById("devlynxBrand");
  const currentLogo = currentBrand?.querySelector("img");
  const currentText = currentBrand?.querySelector("span");

  if (
    currentBrand?.parentElement === main &&
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

  if (brand.parentElement !== main) {
    main.appendChild(brand);
  }
}

function protectDevlynxBrand() {
  ensureDevlynxBrand();

  const observer = new MutationObserver(ensureDevlynxBrand);
  observer.observe(document.body, { childList: true, subtree: true });
}

async function loadSettings() {
  // La popup ne conserve que la configuration rapide des sélecteurs.
  // Les réglages généraux et utilisateurs vivent dans la page Paramètres.
  data = await browser.storage.local.get({
    selectors: DEFAULT_SELECTORS
  });

  data.selectors = { ...DEFAULT_SELECTORS, ...(data.selectors || {}) };

  renderSelectors();
  markSaved();
}

async function saveSettings() {
  await browser.storage.local.set({
    selectors: data.selectors
  });

  markSaved();

  console.log("[Mesh+] Données sauvegardées:", data);
}

function renderSelectors() {
  const selectorList = document.getElementById("selectorList");
  if (!selectorList) return;

  selectorList.innerHTML = "";

  for (const definition of SELECTOR_DEFINITIONS) {
    const item = document.createElement("div");
    item.className = "selectorItem";

    const title = document.createElement("div");
    title.className = "selectorTitle";

    const label = document.createElement("strong");
    label.textContent = definition.label;

    const help = document.createElement("small");
    help.textContent = definition.help;

    const input = document.createElement("input");
    input.className = "input selectorInput";
    input.type = "text";
    input.id = `selector-${definition.key}`;
    input.value = data.selectors[definition.key] || "";
    input.placeholder = "XPath auto ou manuel";

    const actions = document.createElement("div");
    actions.className = "selectorActions";

    const pickBtn = document.createElement("button");
    pickBtn.className = "btn";
    pickBtn.type = "button";
    pickBtn.textContent = "Sélectionner";
    pickBtn.addEventListener("click", () => startElementSelection(definition.key));

    const clearBtn = document.createElement("button");
    clearBtn.className = "btn secondary";
    clearBtn.type = "button";
    clearBtn.textContent = "Effacer";
    clearBtn.addEventListener("click", () => {
      data.selectors[definition.key] = "";
      input.value = "";
      markUnsaved();
    });

    input.addEventListener("input", () => {
      data.selectors[definition.key] = input.value.trim();
      markUnsaved();
    });

    title.appendChild(label);
    title.appendChild(help);
    actions.appendChild(pickBtn);
    actions.appendChild(clearBtn);
    item.appendChild(title);
    item.appendChild(input);
    item.appendChild(actions);
    selectorList.appendChild(item);
  }
}

function setSelectorStatus(message) {
  const status = document.getElementById("selectorStatus");
  if (status) status.textContent = message || "";
}

async function startElementSelection(key) {
  const definition = SELECTOR_DEFINITIONS.find(item => item.key === key);

  try {
    setSelectorStatus(`Cliquez l'élément: ${definition ? definition.label : key}`);

    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];

    if (!tab || !tab.id) {
      setSelectorStatus("Aucun onglet actif.");
      return;
    }

    const response = await browser.tabs.sendMessage(tab.id, {
      type: "MESHPLUS_PICK_XPATH",
      key
    });

    if (!response || !response.xpath) {
      setSelectorStatus("Sélection annulée.");
      return;
    }

    data.selectors[key] = response.xpath;
    const input = document.getElementById(`selector-${key}`);
    if (input) input.value = response.xpath;

    markSaved();
    setSelectorStatus("XPath sélectionné et sauvegardé.");
  } catch (error) {
    console.warn("[Mesh+] Sélection XPath impossible:", error);
    setSelectorStatus("Impossible de sélectionner sur cet onglet.");
  }
}

function show(pageId, backBtn) {
  const pages = document.getElementsByClassName("tab");

  for (const page of pages) {
    page.classList.toggle("visible", page.id === pageId);
  }

  document.getElementById("backBtn").classList.toggle("visible", backBtn);
  document.getElementById("save").classList.toggle("visible", pageId === "selectors");
}

async function openSettings() {
  await browser.tabs.create({ url: browser.runtime.getURL("options/users.html#general") });
  window.close();
}

document.addEventListener("DOMContentLoaded", async () => {
  const saveBtn = document.getElementById("save");

  protectDevlynxBrand();
  await loadSettings();

  document.getElementById("settingsBtn").addEventListener("click", openSettings);
  document.getElementById("selectorsBtn").addEventListener("click", () => show("selectors", true));
  document.getElementById("backBtn").addEventListener("click", () => show("main", false));

  saveBtn.addEventListener("click", saveSettings);
});
