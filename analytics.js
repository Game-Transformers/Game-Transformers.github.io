(() => {
  "use strict";

  const measurementId = document.currentScript?.dataset.measurementId || "";
  if (!/^G-[A-Z0-9]+$/.test(measurementId) || window.__gameTransformersAnalyticsConsent) return;
  window.__gameTransformersAnalyticsConsent = true;

  const storageKey = "gameTransformers.analytics-consent.v1";
  const disableKey = `ga-disable-${measurementId}`;
  const productionHost = location.protocol === "https:" && ["game-transformers.github.io"].includes(location.hostname);
  const denied = {
    analytics_storage: "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  };
  const granted = { ...denied, analytics_storage: "granted" };
  let started = false;
  let mounted = false;
  let panel;
  let settings;

  function readChoice() {
    try {
      const value = localStorage.getItem(storageKey);
      return value === "accepted" || value === "declined" ? value : null;
    } catch {
      return null;
    }
  }

  let choice = readChoice();
  window[disableKey] = true;

  function startAnalytics() {
    // Local previews and GitHub preview hostnames never send production traffic.
    if (!productionHost) return;
    window[disableKey] = false;
    if (started) {
      window.gtag("consent", "update", granted);
      return;
    }
    started = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
    window.gtag("consent", "default", denied);
    window.gtag("set", {
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      ads_data_redaction: true,
      url_passthrough: false,
    });
    window.gtag("consent", "update", granted);
    window.gtag("js", new Date());
    let referrer = "";
    try { referrer = document.referrer ? new URL(document.referrer).origin : ""; } catch {}
    window.gtag("config", measurementId, {
      send_page_view: true,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      cookie_domain: "none",
      cookie_flags: "SameSite=Lax;Secure",
      page_location: location.origin + location.pathname,
      page_referrer: referrer,
      page_title: "Game Transformers",
    });
    const tag = document.createElement("script");
    tag.async = true;
    tag.referrerPolicy = "origin";
    tag.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    document.head.appendChild(tag);
  }

  function stopAnalytics() {
    // Set the opt-out flag before updating consent, including while gtag is loading.
    window[disableKey] = true;
    if (!started) return;
    window.gtag("consent", "update", denied);
    // This installation uses host-only cookies, scoped to the root path.
    for (const name of ["_ga", `_ga_${measurementId.slice(2)}`]) {
      try { document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax; Secure`; } catch {}
    }
  }

  function applyChoice() {
    if (!mounted) return;
    if (choice === "accepted") startAnalytics();
    else stopAnalytics();
    panel.hidden = choice !== null;
    settings.hidden = choice === null;
    settings.setAttribute("aria-expanded", String(!panel.hidden));
  }

  function choose(value) {
    choice = value;
    try { localStorage.removeItem(storageKey); } catch {}
    try { localStorage.setItem(storageKey, value); } catch {}
    applyChoice();
    settings.focus();
  }

  function mount() {
    if (mounted) return;
    mounted = true;
    const style = document.createElement("style");
    style.textContent = `
      #gt-analytics-consent,#gt-analytics-settings{box-sizing:border-box;position:fixed;z-index:10001;font:14px/1.5 system-ui,sans-serif;color:#e8f1f5;background:#0d1420;border:1px solid #536475;border-radius:12px;box-shadow:0 6px 28px #0005}
      #gt-analytics-consent{right:16px;bottom:16px;width:min(420px,calc(100vw - 32px));padding:20px}
      #gt-analytics-consent h2{font-size:17px;margin:0 0 8px;color:inherit}
      #gt-analytics-consent p{margin:0 0 14px}
      #gt-analytics-consent .gt-consent-actions{display:flex;gap:12px}
      #gt-analytics-consent button,#gt-analytics-settings{padding:10px 16px;font:inherit;cursor:pointer}
      #gt-analytics-consent button{flex:1;color:inherit;background:#17283a;border:1px solid #7993a8;border-radius:6px}
      #gt-analytics-settings{left:16px;bottom:16px}
      #gt-analytics-consent button:focus-visible,#gt-analytics-settings:focus-visible{outline:3px solid #4fd8e8;outline-offset:3px}
      #gt-analytics-consent[hidden],#gt-analytics-settings[hidden]{display:none}
    `;
    document.head.appendChild(style);
    panel = document.createElement("section");
    panel.id = "gt-analytics-consent";
    panel.setAttribute("aria-labelledby", "gt-analytics-title");
    const heading = document.createElement("h2");
    heading.id = "gt-analytics-title";
    heading.textContent = "Allow visit analytics?";
    const description = document.createElement("p");
    description.textContent = "With your permission, Google Analytics uses cookies to measure visits and device/browser information. Advertising features are off. We remember your choice in this browser when storage is available. You can change it using Analytics settings.";
    const actions = document.createElement("div");
    actions.className = "gt-consent-actions";
    for (const [label, value] of [["Accept", "accepted"], ["Decline", "declined"]]) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.addEventListener("click", () => choose(value));
      actions.appendChild(button);
    }
    panel.append(heading, description, actions);
    settings = document.createElement("button");
    settings.id = "gt-analytics-settings";
    settings.type = "button";
    settings.textContent = "Analytics settings";
    settings.setAttribute("aria-controls", panel.id);
    settings.addEventListener("click", () => {
      panel.hidden = false;
      settings.hidden = true;
      settings.setAttribute("aria-expanded", "true");
      panel.querySelector("button").focus();
    });
    document.body.append(panel, settings);
    applyChoice();
  }

  // The deferred loader mounts beside the existing page once the DOM is ready.
  if (document.readyState === "loading") window.addEventListener("DOMContentLoaded", mount, { once: true });
  else mount();
  window.addEventListener("storage", (event) => {
    if (event.key !== storageKey && event.key !== null) return;
    choice = readChoice();
    applyChoice();
  });
})();
