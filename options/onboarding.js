function generateId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return "user_" + Date.now() + "_" + Math.random().toString(16).slice(2);
}

function normalizeBaseUrl(value) {
  let baseUrl = value.trim();
  if (!baseUrl) return "";
  if (!baseUrl.endsWith("/")) baseUrl += "/";
  return baseUrl;
}

function parseAlternatives(value) {
  return value.split(",").map(item => item.trim()).filter(Boolean);
}

function setMessage(message) {
  document.getElementById("message").textContent = message || "";
}

async function finish() {
  const baseUrl = normalizeBaseUrl(document.getElementById("baseUrl").value);
  const username = document.getElementById("username").value.trim();

  if (!baseUrl) {
    setMessage("Indique l'URL MeshCentral.");
    return;
  }

  if (!username) {
    setMessage("Indique un nom principal.");
    return;
  }

  const user = {
    id: generateId(),
    username,
    alternatives: parseAlternatives(document.getElementById("alternatives").value),
    password: document.getElementById("password").value
  };

  await browser.storage.local.set({
    baseUrl,
    users: [user],
    selectedUserId: user.id,
    fullscreenMode: document.getElementById("fullscreenMode").value,
    onboardingDone: true
  });

  window.location.href = browser.runtime.getURL("options/users.html");
}

async function skip() {
  await browser.storage.local.set({ onboardingDone: true });
  window.close();
}

document.addEventListener("DOMContentLoaded", async () => {
  const data = await browser.storage.local.get({
    baseUrl: "https://mesh.un-domain.fr/",
    fullscreenMode: "ask"
  });

  document.getElementById("baseUrl").value = data.baseUrl;
  document.getElementById("fullscreenMode").value = data.fullscreenMode;
  document.getElementById("finishBtn").addEventListener("click", finish);
  document.getElementById("skipBtn").addEventListener("click", skip);
});
