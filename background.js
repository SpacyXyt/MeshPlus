browser.runtime.onInstalled.addListener(async details => {
  if (details.reason !== "install") return;

  await browser.storage.local.set({ onboardingDone: false });
  await browser.tabs.create({
    url: browser.runtime.getURL("options/onboarding.html")
  });
});
