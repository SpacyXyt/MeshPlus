let meshPlusUser = null;
let meshPlusStarted = false;
let meshPlusFullscreen = false;
let meshPlusSelectors = {
  connectButton: "",
  lockIndicator: "",
  desktop: "",
  desktopControl: "",
  typeTextInput: "",
  dialogOkButton: "",
  clipboardButton: ""
};

console.log("[Mesh+] injected.js chargé dans la page");

function readFullscreenFromUrl() {
  const url = new URL(window.location.href);
  return url.searchParams.get("f") === "1";
}

meshPlusFullscreen = readFullscreenFromUrl();

window.addEventListener("message", (event) => {
  if (event.source !== window) return;

  const data = event.data;

  if (!data || data.source !== "meshplus-extension") return;

  if (data.type === "MESHPLUS_USER") {
    meshPlusUser = data.user;
    meshPlusSelectors = { ...meshPlusSelectors, ...(data.selectors || {}) };

    if (typeof data.fullscreen === "boolean") {
      meshPlusFullscreen = data.fullscreen;
    }

    console.log("[Mesh+] Utilisateur reçu:", meshPlusUser);
    console.log("[Mesh+] Sélecteurs reçus:", meshPlusSelectors);
    console.log("[Mesh+] Plein écran:", meshPlusFullscreen);

    if (!meshPlusStarted) {
      meshPlusStarted = true;
      initExtension().catch(error => console.warn("[Mesh+]", error.message));
    }
  }
});

function getXPathElement(xpath) {
  if (!xpath) return null;

  try {
    return document.evaluate(
      xpath,
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    ).singleNodeValue;
  } catch (error) {
    console.warn("[Mesh+] XPath invalide:", xpath, error);
    return null;
  }
}

function getConfiguredElement(key, fallbackSelector) {
  const xpathElement = getXPathElement(meshPlusSelectors[key]);
  if (xpathElement) return xpathElement;
  if (!fallbackSelector) return null;
  return document.querySelector(fallbackSelector);
}

async function applyFullScreenIfNeeded() {
  if (!meshPlusFullscreen) return;

  await sleep(500);

  try {
    if (typeof deskToggleFull === "function") {
      deskToggleFull();
      console.log("[Mesh+] Plein écran activé");
    } else {
      console.warn("[Mesh+] deskToggleFull indisponible");
    }
  } catch (e) {
    console.warn("[Mesh+] Impossible d'activer le plein écran:", e);
  }
}

function waitForElm(selector, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(selector);
    if (existing) return resolve(existing);

    const observer = new MutationObserver(() => {
      const element = document.querySelector(selector);

      if (element) {
        observer.disconnect();
        resolve(element);
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Element introuvable: ${selector}`));
    }, timeout);
  });
}

function waitForConfiguredElement(key, fallbackSelector, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const existing = getConfiguredElement(key, fallbackSelector);
    if (existing) return resolve(existing);

    const observer = new MutationObserver(() => {
      const element = getConfiguredElement(key, fallbackSelector);

      if (element) {
        observer.disconnect();
        resolve(element);
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Element introuvable: ${key}`));
    }, timeout);
  });
}

function waitUntilClickable(selector, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();

    const check = () => {
      const element = document.querySelector(selector);

      if (element && !element.disabled && element.offsetParent !== null) {
        resolve(element);
        return;
      }

      if (Date.now() - start > timeout) {
        reject(new Error(`Element non cliquable: ${selector}`));
        return;
      }

      requestAnimationFrame(check);
    };

    check();
  });
}

function waitUntilConfiguredClickable(key, fallbackSelector, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();

    const check = () => {
      const element = getConfiguredElement(key, fallbackSelector);

      if (element && !element.disabled && element.offsetParent !== null) {
        resolve(element);
        return;
      }

      if (Date.now() - start > timeout) {
        reject(new Error(`Element non cliquable: ${key}`));
        return;
      }

      requestAnimationFrame(check);
    };

    check();
  });
}

function waitForDesktopReady(timeout = 30000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();

    const timer = setInterval(() => {
      const hasDeskElement =
        getConfiguredElement("desktop", "#Desk") !== null &&
        getConfiguredElement("desktopControl", "#DeskControl") !== null;

      const hasDirectDesktop =
        typeof desktop !== "undefined" &&
        desktop !== null &&
        desktop.State === 3 &&
        desktop.m;

      const hasTextApi =
        typeof showDeskType === "function" ||
        typeof showDeskTypeEx === "function";

      console.log("[Mesh+] Desktop check:", {
        hasDeskElement,
        hasDirectDesktop,
        hasTextApi,
        state: typeof desktop !== "undefined" && desktop ? desktop.State : null
      });

      if (hasDeskElement && (hasDirectDesktop || hasTextApi)) {
        clearInterval(timer);

        const control = getConfiguredElement("desktopControl", "#DeskControl");

        if (control && !control.checked) {
          control.click();
        }

        resolve();
        return;
      }

      if (Date.now() - start > timeout) {
        clearInterval(timer);
        reject(new Error("Timeout: le bureau distant n'est pas prêt"));
      }
    }, 250);
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function pressKeyCode(keyCode) {
  if (
    typeof desktop !== "undefined" &&
    desktop &&
    desktop.State === 3 &&
    desktop.m &&
    typeof desktop.m.SendKeyMsgKC === "function"
  ) {
    desktop.m.SendKeyMsgKC([
      [desktop.m.KeyAction.DOWN, keyCode],
      [desktop.m.KeyAction.UP, keyCode]
    ]);

    return true;
  }

  return false;
}

function pressEnter() {
  if (pressKeyCode(13)) return;

  if (typeof showDeskTypeEx === "function") {
    showDeskTypeEx("\n");
    return;
  }

  const down = new KeyboardEvent("keydown", {
    key: "Enter",
    code: "Enter",
    keyCode: 13,
    which: 13,
    bubbles: true,
    cancelable: true
  });

  const up = new KeyboardEvent("keyup", {
    key: "Enter",
    code: "Enter",
    keyCode: 13,
    which: 13,
    bubbles: true,
    cancelable: true
  });

  document.dispatchEvent(down);
  document.dispatchEvent(up);
}

function typeText(text) {
  if (!text) return;

  if (typeof showDeskTypeEx === "function") {
    showDeskTypeEx(text);
    return;
  }

  if (typeof showDeskType === "function") {
    showDeskType();

    const input = getConfiguredElement("typeTextInput", "#d2typeText");

    if (input) {
      input.value = text;
    }

    const ok = getConfiguredElement("dialogOkButton", "#idx_dlgOkButton");

    if (ok) {
      ok.click();
    }

    return;
  }

  console.warn("[Mesh+] Aucune API de saisie texte MeshCentral disponible");
}

async function isDeviceLocked() {
  return currentNode.users.length == 0 || document.querySelectorAll('.svg-inline--fa.fa-key').length == 1;
}

async function initExtension() {
  await waitForConfiguredElement("connectButton", "#connectbutton1");

  await applyFullScreenIfNeeded();

  const button = await waitUntilConfiguredClickable("connectButton", "#connectbutton1");

  await sleep(300);

  button.click();

  const locked = await isDeviceLocked();

  console.log("[Mesh+] Bouton connectbutton1 cliqué");
  console.log("[Mesh+] Session verrouillée:", locked);

  if (locked) {
    await connectUser();
  }
}

async function connectUser() {
  await waitForDesktopReady();

  if (!meshPlusUser) {
    console.warn("[Mesh+] Aucun utilisateur reçu");
    return;
  }

  if (!meshPlusUser.password) {
    console.warn("[Mesh+] Aucun mot de passe configuré pour:", meshPlusUser.username);
    return;
  }

  console.log("[Mesh+] VNC prêt, login avec:", meshPlusUser.username);

  await sleep(700);
  deskSendKeys()

  await sleep(900);
  typeText(meshPlusUser.password);

  await sleep(400);
  pressEnter();

  console.log("[Mesh+] Séquence de connexion envoyée");
}
