MESHPLUS_DEFAULT_USER = {
  id: "default_stagiaire",
  username: "Stagiaire",
  alternatives: ["stagiaire", "GRETA\\Stagiaire"],
  password: ""
};

let meshPlusSettings = {
  baseUrl: "https://mesh.greta73-74.fr/",
  users: [MESHPLUS_DEFAULT_USER],
  selectedUserId: MESHPLUS_DEFAULT_USER.id
};

let meshPlusPickerCleanup = null;

async function loadMeshPlusSettings() {
  meshPlusSettings = await browser.storage.local.get({
    baseUrl: "https://mesh.greta73-74.fr/",
    users: [MESHPLUS_DEFAULT_USER],
    selectedUserId: MESHPLUS_DEFAULT_USER.id
  });

  if (!Array.isArray(meshPlusSettings.users) || meshPlusSettings.users.length === 0) {
    meshPlusSettings.users = [MESHPLUS_DEFAULT_USER];
    meshPlusSettings.selectedUserId = MESHPLUS_DEFAULT_USER.id;
    await browser.storage.local.set({ users: meshPlusSettings.users, selectedUserId: meshPlusSettings.selectedUserId });
  }
}

browser.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.baseUrl) meshPlusSettings.baseUrl = changes.baseUrl.newValue;
  if (changes.users) meshPlusSettings.users = changes.users.newValue;
  if (changes.selectedUserId) meshPlusSettings.selectedUserId = changes.selectedUserId.newValue;
});

if (browser.runtime && browser.runtime.onMessage) {
  browser.runtime.onMessage.addListener((message) => {
    if (!message || message.type !== "MESHPLUS_PICK_XPATH") return;
    return startXPathPicker(message.key);
  });
}

function getElementXPath(element) {
  if (!element || element.nodeType !== Node.ELEMENT_NODE) return "";

  if (element.id) {
    return `//*[@id=${toXPathLiteral(element.id)}]`;
  }

  const parts = [];
  let current = element;

  while (current && current.nodeType === Node.ELEMENT_NODE) {
    let index = 1;
    let sibling = current.previousElementSibling;

    while (sibling) {
      if (sibling.localName === current.localName) index += 1;
      sibling = sibling.previousElementSibling;
    }

    parts.unshift(`${current.localName}[${index}]`);
    current = current.parentElement;
  }

  return "/" + parts.join("/");
}

function toXPathLiteral(value) {
  if (!value.includes('"')) return `"${value}"`;
  if (!value.includes("'")) return `'${value}'`;

  return "concat(" + value
    .split('"')
    .map(part => `"${part}"`)
    .join(', \'"\', ') + ")";
}

function startXPathPicker(key) {
  if (meshPlusPickerCleanup) {
    meshPlusPickerCleanup();
    meshPlusPickerCleanup = null;
  }

  return new Promise(resolve => {
    const overlay = document.createElement("div");
    overlay.id = "meshplusXPathPickerOverlay";
    overlay.textContent = "Mesh+ : cliquez un élément, Échap pour annuler";
    overlay.style.position = "fixed";
    overlay.style.left = "12px";
    overlay.style.bottom = "12px";
    overlay.style.zIndex = "2147483647";
    overlay.style.padding = "8px 10px";
    overlay.style.borderRadius = "6px";
    overlay.style.background = "#111827";
    overlay.style.color = "#ffffff";
    overlay.style.font = "12px Arial, sans-serif";
    overlay.style.boxShadow = "0 8px 24px rgba(0, 0, 0, 0.35)";
    overlay.style.pointerEvents = "none";

    const highlight = document.createElement("div");
    highlight.id = "meshplusXPathPickerHighlight";
    highlight.style.position = "fixed";
    highlight.style.zIndex = "2147483646";
    highlight.style.border = "2px solid #2563eb";
    highlight.style.background = "rgba(37, 99, 235, 0.16)";
    highlight.style.pointerEvents = "none";
    highlight.style.display = "none";

    document.documentElement.appendChild(highlight);
    document.documentElement.appendChild(overlay);

    function cleanup(result) {
      document.removeEventListener("mouseover", onMouseOver, true);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKeyDown, true);
      highlight.remove();
      overlay.remove();
      meshPlusPickerCleanup = null;
      resolve(result || { cancelled: true });
    }

    function onMouseOver(event) {
      const target = event.target;

      if (!target || target === overlay || target === highlight) return;

      const rect = target.getBoundingClientRect();
      highlight.style.display = "block";
      highlight.style.left = `${rect.left}px`;
      highlight.style.top = `${rect.top}px`;
      highlight.style.width = `${rect.width}px`;
      highlight.style.height = `${rect.height}px`;
    }

    async function onClick(event) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const target = event.target;
      const xpath = getElementXPath(target);

      try {
        const settings = await browser.storage.local.get({ selectors: {} });
        const selectors = { ...(settings.selectors || {}), [key]: xpath };
        await browser.storage.local.set({ selectors });
      } catch (error) {
        console.warn("[Mesh+] Impossible d'enregistrer le XPath:", error);
      }

      cleanup({ xpath });
    }

    function onKeyDown(event) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      cleanup({ cancelled: true });
    }

    meshPlusPickerCleanup = () => cleanup({ cancelled: true });

    document.addEventListener("mouseover", onMouseOver, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKeyDown, true);
  });
}

async function init() {
  await loadMeshPlusSettings();

  if (document.getElementById("OpenAllButton")) return;

  const groupAllBtn = document.createElement("input");
  groupAllBtn.type = "button";
  groupAllBtn.id = "OpenAllButton";
  groupAllBtn.value = "Ouvrir la sélection";
  groupAllBtn.disabled = true;

  const toolbar = document.getElementById("devListToolbar");
  if (!toolbar) {
    console.warn("[Mesh+] devListToolbar introuvable");
    return;
  }

  toolbar.appendChild(groupAllBtn);
  groupAllBtn.addEventListener("click", openGroup);

  await waitForElm(".DeviceCheckbox");
  bindCheckboxes();
  observeDeviceList();
  update();
}

function bindCheckboxes() {
  const ticks = document.getElementsByClassName("DeviceCheckbox");
  for (const tick of ticks) {
    if (tick.dataset.meshplusBound === "1") continue;
    tick.dataset.meshplusBound = "1";
    tick.addEventListener("change", update);
  }
}

function observeDeviceList() {
  const target = document.getElementById("xdevices") || document.documentElement;
  const observer = new MutationObserver(() => {
    bindCheckboxes();
    update();
  });
  observer.observe(target, { childList: true, subtree: true });
}

function update() {
  const button = document.getElementById("OpenAllButton");
  if (!button) return;
  button.disabled = document.querySelectorAll(".DeviceCheckbox:checked").length === 0;
}

async function openGroup() {
  const selected = Array.from(document.querySelectorAll(".DeviceCheckbox:checked"));
  if (selected.length === 0) return;

  const fullscreen = await askFullscreenChoice();

  for (const tick of selected) {
    const nodeId = getNodeIdFromCheckbox(tick);
    tick.click();
    if (!nodeId) continue;

    const { user, displayedUsername } = findUserForNode(nodeId);
    console.log("[Mesh+] Node:", nodeId);
    console.log("[Mesh+] Utilisateur affiché:", displayedUsername);
    console.log("[Mesh+] Utilisateur choisi:", user ? user.username : null);

    openDeviceInNewTab(nodeId, 11, user, fullscreen);
  }

  update();
}

function getNodeIdFromCheckbox(tick) {
  if (!tick.value) return null;
  if (tick.value.startsWith("devid_node//")) return tick.value.substring(12);
  return tick.value;
}

function normalizeBaseUrl(value) {
  let baseUrl = String(value || "").trim();
  if (!baseUrl) baseUrl = "https://mesh.greta73-74.fr/";
  if (!baseUrl.endsWith("/")) baseUrl += "/";
  return baseUrl;
}

function normalizeUsername(value) {
  return String(value || "").replace("(Verrouiller)", "").trim().toLowerCase();
}

function getDisplayedUsernameFromNodeId(nodeId) {
  const row = document.getElementById("xv2node//" + nodeId);
  if (!row) {
    console.warn("[Mesh+] Ligne introuvable pour node:", nodeId);
    return null;
  }

  const cells = row.querySelectorAll("td");
  if (cells.length < 2) {
    console.warn("[Mesh+] Colonne utilisateur introuvable pour node:", nodeId);
    return null;
  }

  const userCell = cells[1];
  const span = userCell.querySelector("span");
  let username = "";

  if (span) {
    username = span.textContent.trim();
    const title = span.getAttribute("title");
    if (title && title.includes("\\")) username = title.split("\\").pop().replace("(Verrouiller)", "").trim();
  } else {
    username = userCell.textContent.trim();
  }

  return username || null;
}

function findUserForNode(nodeId) {
  const displayedUsername = getDisplayedUsernameFromNodeId(nodeId);
  const selectedUser = meshPlusSettings.users.find(u => u.id === meshPlusSettings.selectedUserId) || null;

  if (!displayedUsername) return { user: selectedUser, displayedUsername: null };

  const normalizedDisplayed = normalizeUsername(displayedUsername);
  const user = meshPlusSettings.users.find(user => {
    const names = [user.username, ...(Array.isArray(user.alternatives) ? user.alternatives : [])];
    return names.some(name => normalizeUsername(name) === normalizedDisplayed);
  });

  return { user: user || selectedUser, displayedUsername };
}

function openDeviceInNewTab(nodeId, viewmode = 11, user = null, fullscreen = false) {
  const baseUrl = normalizeBaseUrl(meshPlusSettings.baseUrl);
  const fullscreenValue = fullscreen ? 1 : 0;
  const userId = user ? user.id : "";

  const url = `${baseUrl}?gotonode=${nodeId}&viewmode=${viewmode}&hide=16&a=1&mpuser=${userId}&f=${fullscreenValue}`;

  window.open(url, "_blank", "noopener,noreferrer");
}

function askFullscreenChoice() {
  return new Promise(resolve => {
    if (document.getElementById("meshplusFullscreenPopup")) return;

    const overlay = document.createElement("div");
    overlay.id = "meshplusFullscreenPopup";
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.background = "rgba(0, 0, 0, 0.45)";
    overlay.style.zIndex = "999999";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";

    const box = document.createElement("div");
    box.style.background = "#ffffff";
    box.style.color = "#111111";
    box.style.padding = "22px";
    box.style.borderRadius = "10px";
    box.style.boxShadow = "0 8px 30px rgba(0, 0, 0, 0.25)";
    box.style.minWidth = "320px";
    box.style.textAlign = "center";
    box.style.fontFamily = "Arial, sans-serif";

    const title = document.createElement("div");
    title.textContent = "Voulez-vous ouvrir les onglets en plein écran ?";
    title.style.fontSize = "16px";
    title.style.fontWeight = "600";
    title.style.marginBottom = "18px";

    const actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.gap = "12px";
    actions.style.justifyContent = "center";

    const yesBtn = document.createElement("button");
    yesBtn.textContent = "Oui";
    yesBtn.style.padding = "8px 18px";
    yesBtn.style.cursor = "pointer";

    const noBtn = document.createElement("button");
    noBtn.textContent = "Non";
    noBtn.style.padding = "8px 18px";
    noBtn.style.cursor = "pointer";

    yesBtn.addEventListener("click", () => {
      overlay.remove();
      resolve(true);
    });

    noBtn.addEventListener("click", () => {
      overlay.remove();
      resolve(false);
    });

    actions.appendChild(yesBtn);
    actions.appendChild(noBtn);

    box.appendChild(title);
    box.appendChild(actions);
    overlay.appendChild(box);

    document.body.appendChild(overlay);
  });
}

function waitForElm(selector) {
  return new Promise(resolve => {
    const existing = document.querySelector(selector);
    if (existing) return resolve(existing);
    const observer = new MutationObserver(() => {
      const element = document.querySelector(selector);
      if (element) {
        observer.disconnect();
        resolve(element);
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  });
}

waitForElm("#devListToolbar").then(() => init().catch(console.error));
