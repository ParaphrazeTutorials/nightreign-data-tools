// Global Chrome (Navigation + Footer)
// Single source of truth to prevent drift across pages.
//
// This is a pure client-side renderer for GitHub Pages / static hosting.
// It writes into:
//   <nav id="globalNav" class="tool-nav"></nav>
//   <footer id="globalFooter" class="site-footer"></footer>
//
// It also computes correct relative hrefs when running from subfolders (e.g. /Reliquary/).

function inFolder(folderName) {
  const p = (window.location.pathname || "").toLowerCase();
  const f = `/${String(folderName || "").toLowerCase()}/`;
  return p.includes(f);
}

function buildNavHrefs() {
  const inReliquary = inFolder("Reliquary");
  const inLexicon = inFolder("Lexicon");

  // Base routing: root, /Reliquary/, /Lexicon/
  const isRoot = !inReliquary && !inLexicon;

  const home = isRoot ? "./index.html" : "../index.html";
  const reliquary = inReliquary ? "./index.html" : (isRoot ? "./Reliquary/index.html" : "../Reliquary/index.html");
  const lexicon = inLexicon ? "./index.html" : (isRoot ? "./Lexicon/index.html" : "../Lexicon/index.html");

  return {
    home,
    reliquary,
    lexicon,
    // placeholders
    menagerie: "#",
    armory: "#",
    grimoire: "#",
    activeKey: inReliquary ? "reliquary" : (inLexicon ? "lexicon" : "home")
  };
}

function renderNav() {
  const el = document.getElementById("globalNav");
  if (!el) return;

  const hrefs = buildNavHrefs();

  el.innerHTML = `
    <ul>
      <li><a class="${hrefs.activeKey === "home" ? "active" : ""}" href="${hrefs.home}">Home</a></li>
      <li><a class="${hrefs.activeKey === "reliquary" ? "active" : ""}" href="${hrefs.reliquary}">Reliquary</a></li>
      <li><a class="${hrefs.activeKey === "lexicon" ? "active" : ""}" href="${hrefs.lexicon}">The Lexicon</a></li>
      <li><a href="${hrefs.menagerie}" aria-disabled="true" tabindex="-1">Menagerie</a></li>
      <li><a href="${hrefs.armory}" aria-disabled="true" tabindex="-1">Armory</a></li>
      <li><a href="${hrefs.grimoire}" aria-disabled="true" tabindex="-1">Grimoire</a></li>
    </ul>
  `;
}

function renderFooter() {
  const el = document.getElementById("globalFooter");
  if (!el) return;

  el.innerHTML = `
    <div class="footer-inner">
      <p class="footer-disclaimer">
        Unofficial community tools for Elden Ring: Nightreign. This project does not modify your game, connect to your account, or guarantee online safety. You are responsible for how you use the information provided.
      </p>
      <p class="footer-credits">
        Created by <strong>Paraphraze</strong> — with assistance from <strong>gazer500</strong> and <strong>Acarii</strong>.
      </p>
    </div>
  `;
}

renderNav();
renderFooter();
