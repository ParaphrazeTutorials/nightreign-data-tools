// Global Hero renderer (single source of truth for hero markup)
//
// Usage: put this placeholder in your page:
// <header id="globalHero" class="hero"
//   data-hero-image="..."
//   data-hero-h1="The Round Table Codex"
//   data-hero-h2="Home|Reliquary|..."
//   data-hero-build="true|false">
// </header>
//
// Styling is defined in /styles/site.css.

// ------------------------------------------------------------
// Global build status (single source of truth)
// ------------------------------------------------------------
function detectBuildStatus() {
  // Allow a query override (e.g., ?build=beta) for quick sanity checks.
  const query = (() => {
    try {
      return new URLSearchParams(window.location.search || "");
    } catch (_) {
      return new URLSearchParams();
    }
  })();

  const forced = String(query.get("build") || "").trim().toUpperCase();
  if (forced === "BETA" || forced === "LIVE") return forced;

  const host = String(window.location?.hostname || "").toLowerCase();
  const path = String(window.location?.pathname || "").toLowerCase();

  // Treat dev/pre-prod hosts and the dev pages repo path as BETA.
  const betaMarkers = [
    "localhost",
    "127.0.0.1",
    "nightreign-data-tools-dev",
    "-dev" // catch custom dev hosts
  ];

  const isBetaHost = betaMarkers.some((m) => host.includes(m));
  const isBetaPath = path.includes("nightreign-data-tools-dev") || path.includes("/dev/");

  return (isBetaHost || isBetaPath) ? "BETA" : "LIVE";
}

const GLOBAL_BUILD_STATUS = detectBuildStatus(); // "BETA" | "LIVE" (auto from host)
const GLOBAL_GAME_VERSION = "1.03.1.0029"; // game version (sourced from Reliquary baseline)
const ART_CREDIT_URL = "https://cl.pinterest.com/smile_409/"; // single source of truth for art credit link
const HERO_LOGO_RECT = new URL("../Assets/logo_square_plain.png", import.meta.url).href;
const HERO_LOGO_SQUARE = new URL("../Assets/logo_square_plain.png", import.meta.url).href;
const HERO_LOGO_SQUARE_COLOR = new URL("../Assets/logo_square.png", import.meta.url).href;



function toBool(v) {
  const s = String(v ?? "").trim().toLowerCase();
  return s === "true" || s === "1" || s === "yes";
}

function cssEscapeSafe(v) {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") return CSS.escape(v);
  return String(v || "").replace(/[^a-zA-Z0-9_-]/g, "");
}

function applyHeroFocus(el) {
  const id = el.id || "globalHero";
  const selector = `#${cssEscapeSafe(id)}`;
  const styleId = `${id}-hero-focus`;

  const base = {
    x: el.getAttribute("data-hero-x"),
    y: el.getAttribute("data-hero-y"),
    zoom: el.getAttribute("data-hero-zoom"),
  };

  Object.entries(base).forEach(([key, val]) => {
    if (!val) return;
    el.style.setProperty(`--hero-art-${key}`, val);
  });

  const slots = [
    { key: "xs", mq: "--bp-xs" },
    { key: "sm", mq: "--bp-sm-down" },
    { key: "md", mq: "--bp-md" },
    { key: "lg", mq: "--bp-lg" },
    { key: "xl", mq: "--bp-xl" },
    { key: "xxl", mq: "--bp-xxl" },
    { key: "ultra", mq: "--bp-ultra" },
  ];

  let css = "";
  for (const slot of slots) {
    const x = el.getAttribute(`data-hero-x-${slot.key}`);
    const y = el.getAttribute(`data-hero-y-${slot.key}`);
    const zoom = el.getAttribute(`data-hero-zoom-${slot.key}`);
    if (!x && !y && !zoom) continue;
    css += `@media (${slot.mq}) { ${selector} {`;
    if (x) css += ` --hero-art-x: ${x};`;
    if (y) css += ` --hero-art-y: ${y};`;
    if (zoom) css += ` --hero-art-zoom: ${zoom};`;
    css += " } }\n";
  }

  const prev = document.getElementById(styleId);
  if (prev?.parentNode) prev.parentNode.removeChild(prev);

  if (css.trim()) {
    const styleEl = document.createElement("style");
    styleEl.id = styleId;
    styleEl.textContent = css;
    document.head.appendChild(styleEl);
  }
}

function renderHero() {
  const el = document.getElementById("globalHero");
  if (!el) return;

  const imgSrc = el.getAttribute("data-hero-image") || "";
  const h1 = el.getAttribute("data-hero-h1") || "The Round Table Codex";
  const h2 = el.getAttribute("data-hero-h2") || "";
  const showBuild = toBool(el.getAttribute("data-hero-build"));
  const hideCredit = toBool(el.getAttribute("data-hero-credit-hide"));
  const creditLabel = el.getAttribute("data-hero-credit") || "Artwork by Smile";
  const creditUrl = el.getAttribute("data-hero-credit-url") || ART_CREDIT_URL;

  el.innerHTML = `
    ${imgSrc ? `
      <img
        class="hero-art"
        src="${imgSrc}"
        alt=""
        aria-hidden="true"
        loading="eager"
        decoding="async"
        onerror="this.remove()"
      />
    ` : ""}

    <div class="hero-content hero-badge">
      <div class="hero-logo" aria-hidden="true">
        <img
          class="hero-logo__img hero-logo__img--rectangle"
          src="${HERO_LOGO_RECT}"
          alt=""
          loading="eager"
          decoding="async"
        />
        <img
          class="hero-logo__img hero-logo__img--square"
          src="${HERO_LOGO_SQUARE}"
          alt=""
          loading="eager"
          decoding="async"
        />
        <img
          class="hero-logo__img hero-logo__img--square-colored"
          src="${HERO_LOGO_SQUARE_COLOR}"
          alt=""
          loading="eager"
          decoding="async"
        />
      </div>

      <div class="hero-text">
        <h1>${h1}</h1>
        ${h2 ? `<h2>${h2}</h2>` : ""}
      </div>
    </div>

    ${showBuild ? (() => {
      const status = String(GLOBAL_BUILD_STATUS || "BETA").trim().toUpperCase();
      const game = String(GLOBAL_GAME_VERSION || "").trim();
      const cls = status === "LIVE" ? "is-live" : "is-beta";
      return `
        <div id="heroBuild" class="hero-build ${cls}" aria-label="Release channel and game version">
                    <span class="hero-build__status">${status}</span>
          <span class="hero-build__sep"> | </span>
          <span class="hero-build__version">Game Version ${game}</span>

        </div>
      `;
    })() : ""}
    ${hideCredit ? "" : `<a class="hero-credit" href="${creditUrl}" target="_blank" rel="noopener" aria-label="Artwork credit link">${creditLabel}</a>`}
  `;

  applyHeroFocus(el);
}

function applyGlobalCreditLinks() {
  const href = ART_CREDIT_URL;
  document.querySelectorAll(".app-tile__credit").forEach((el) => {
    if (!(el instanceof HTMLAnchorElement)) return;
    el.href = href;
    el.target = "_blank";
    el.rel = "noopener";
  });
}

renderHero();
applyGlobalCreditLinks();
