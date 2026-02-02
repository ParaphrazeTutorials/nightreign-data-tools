import { breakpoints, mqAtMost } from "./breakpoints.js";

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
  const inAcknowledgements = !inReliquary && !inLexicon && (window.location.pathname || "").toLowerCase().includes("acknowledgements");

  // Base routing: root, /Reliquary/, /Lexicon/
  const isRoot = !inReliquary && !inLexicon;

  const home = isRoot ? "./index.html" : "../index.html";
  const reliquary = inReliquary ? "./index.html" : (isRoot ? "./Reliquary/index.html" : "../Reliquary/index.html");
  const lexicon = inLexicon ? "./index.html" : (isRoot ? "./Lexicon/index.html" : "../Lexicon/index.html");
  const acknowledgements = isRoot ? "./acknowledgements.html" : "../acknowledgements.html";

  return {
    home,
    reliquary,
    lexicon,
    acknowledgements,
    // placeholders
    menagerie: "#",
    armory: "#",
    grimoire: "#",
    activeKey: inReliquary ? "reliquary" : (inLexicon ? "lexicon" : (inAcknowledgements ? "acknowledgements" : "home"))
  };
}

function renderNav() {
  const el = document.getElementById("globalNav");
  if (!el) return;

  const hrefs = buildNavHrefs();

  el.innerHTML = `
    <div class="tool-nav__inner">
      <button type="button" class="nav-toggle" aria-expanded="false" aria-controls="globalNavList">
        <span class="nav-toggle__bars" aria-hidden="true">
          <span class="nav-toggle__bar"></span>
          <span class="nav-toggle__bar"></span>
          <span class="nav-toggle__bar"></span>
        </span>
        <span class="nav-toggle__label">Menu</span>
      </button>

      <ul id="globalNavList" class="nav-list">
        <li><a class="${hrefs.activeKey === "home" ? "active" : ""}" href="${hrefs.home}">Home</a></li>
        <li><a class="${hrefs.activeKey === "reliquary" ? "active" : ""}" href="${hrefs.reliquary}">Reliquary</a></li>
        <li><a class="${hrefs.activeKey === "lexicon" ? "active" : ""}" href="${hrefs.lexicon}">The Lexicon</a></li>
        <li><a href="${hrefs.menagerie}" aria-disabled="true" tabindex="-1">Menagerie</a></li>
        <li><a href="${hrefs.armory}" aria-disabled="true" tabindex="-1">Armory</a></li>
        <li><a href="${hrefs.grimoire}" aria-disabled="true" tabindex="-1">Grimoire</a></li>
      </ul>

      <div class="tool-nav__status" data-hero-build-slot></div>
    </div>
  `;

  const toggle = el.querySelector('.nav-toggle');
  const list = el.querySelector('.nav-list');
  const heroBuild = document.querySelector('.hero-build');
  const statusSlot = el.querySelector('[data-hero-build-slot]');
  const mq = mqAtMost(breakpoints.mdMax);

  if (toggle && list) {
    toggle.addEventListener('click', () => {
      const isOpen = el.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(isOpen));
      if (isOpen) {
        list.removeAttribute('data-collapsed');
      } else {
        list.setAttribute('data-collapsed', 'true');
      }
    });
  }

  // Move the hero build pill into the nav on small devices and restore otherwise.
  if (heroBuild && statusSlot) {
    heroBuild._originalParent = heroBuild.parentElement;
    heroBuild._originalNext = heroBuild.nextSibling;

    const syncHeroBuild = () => {
      if (mq.matches) {
        if (heroBuild.parentElement !== statusSlot) {
          statusSlot.appendChild(heroBuild);
          heroBuild.classList.add('hero-build--in-nav');
        }
      } else if (heroBuild._originalParent && heroBuild.parentElement !== heroBuild._originalParent) {
        const { _originalParent: parent, _originalNext: next } = heroBuild;
        if (next && next.parentNode === parent) {
          parent.insertBefore(heroBuild, next);
        } else {
          parent.appendChild(heroBuild);
        }
        heroBuild.classList.remove('hero-build--in-nav');
      }
    };

    syncHeroBuild();
    mq.addEventListener('change', syncHeroBuild);
  }
}

function renderFooter() {
  const el = document.getElementById("globalFooter");
  if (!el) return;

  const hrefs = buildNavHrefs();

  el.innerHTML = `
    <div class="footer-inner">
      <p class="footer-disclaimer">
        Unofficial community tools for Elden Ring: Nightreign. This project does not modify your game, connect to your account, or guarantee online safety. You are responsible for how you use the information provided.
      </p>
      <p class="footer-credits">
        <a href="${hrefs.acknowledgements}">Acknowledgements</a>
      </p>
    </div>
  `;
}

renderNav();
renderFooter();
