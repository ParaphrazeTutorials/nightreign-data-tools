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

    ${showBuild ? `<div id="heroBuild" class="hero-build" aria-label="Release channel and game version"></div>` : ""}
  `;
}

renderHero();
