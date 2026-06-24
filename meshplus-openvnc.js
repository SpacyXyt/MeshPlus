MESHPLUS_DEFAULT_USER = {
  id: "default_user",
  username: "User",
  alternatives: ["user1"],
  password: ""
};

const MESHPLUS_DEFAULT_SELECTORS = {
  connectButton: "",
  lockIndicator: "",
  desktop: "",
  desktopControl: "",
  typeTextInput: "",
  dialogOkButton: "",
  clipboardButton: ""
};

function injectScriptWithUser(file, user, selectors) {
  const script = document.createElement("script");
  script.src = browser.runtime.getURL(file);
  script.onload = () => {
    script.remove();
    window.postMessage({ source: "meshplus-extension", type: "MESHPLUS_USER", user, selectors }, "*");
  };
  document.documentElement.appendChild(script);
}

async function getUserFromUrl() {
  const url = new URL(window.location.href);
  const userId = url.searchParams.get("mpuser");

  const settings = await browser.storage.local.get({
    users: [MESHPLUS_DEFAULT_USER],
    selectedUserId: MESHPLUS_DEFAULT_USER.id,
    selectors: MESHPLUS_DEFAULT_SELECTORS
  });

  const users = Array.isArray(settings.users) ? settings.users : [MESHPLUS_DEFAULT_USER];
  if (userId) {
    const user = users.find(u => u.id === userId);
    if (user) return { user, selectors: { ...MESHPLUS_DEFAULT_SELECTORS, ...(settings.selectors || {}) } };
  }

  return {
    user: users.find(u => u.id === settings.selectedUserId) || users[0] || null,
    selectors: { ...MESHPLUS_DEFAULT_SELECTORS, ...(settings.selectors || {}) }
  };
}

const url = new URL(window.location.href);

if (url.searchParams.get("viewmode") === "11" && url.searchParams.get("a") === "1") {
  getUserFromUrl()
    .then(({ user, selectors }) => {
      console.log("[Mesh+] Injection du script VNC avec utilisateur:", user ? user.username : null);
      injectScriptWithUser("injected.js", user, selectors);
    })
    .catch(console.error);
}
