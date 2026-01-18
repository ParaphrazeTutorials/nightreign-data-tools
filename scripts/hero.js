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
const GLOBAL_BUILD_VERSION = "v0.0.0";  // app version (update as needed)
const GLOBAL_GAME_VERSION = "1.03.1.0029"; // game version (sourced from Reliquary baseline)



function toBool(v) {
  const s = String(v ?? "").trim().toLowerCase();
  return s === "true" || s === "1" || s === "yes";
}

function renderHero() {
  const el = document.getElementById("globalHero");
  if (!el) return;

  const imgSrc = el.getAttribute("data-hero-image") || "";
  const h1 = el.getAttribute("data-hero-h1") || "The Round Table Codex";
  const h2 = el.getAttribute("data-hero-h2") || "";
  const showBuild = toBool(el.getAttribute("data-hero-build"));

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

    <div class="hero-content">
      <h1>${h1}</h1>
      ${h2 ? `<h2>${h2}</h2>` : ""}
    </div>

    ${showBuild ? (() => {
      const status = String(GLOBAL_BUILD_STATUS || "BETA").trim().toUpperCase();
      const version = String(GLOBAL_BUILD_VERSION || "").trim();
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
  `;
}

renderHero();
