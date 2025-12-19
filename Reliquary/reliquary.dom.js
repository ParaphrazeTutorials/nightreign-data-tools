export function getDom() {
  return {
    // Top controls
    selType: document.getElementById("relicType"),
    selColor: document.getElementById("relicColor"),

    showIllegalEl: document.getElementById("showIllegal"),
    showRawEl: document.getElementById("showRaw"),
    startOverBtn: document.getElementById("startOver"),

    // Categories + Effects
    cat1: document.getElementById("cat1"),
    cat2: document.getElementById("cat2"),
    cat3: document.getElementById("cat3"),

    sel1: document.getElementById("effect1"),
    sel2: document.getElementById("effect2"),
    sel3: document.getElementById("effect3"),

    // Counts
    count1: document.getElementById("count1"),
    count2: document.getElementById("count2"),
    count3: document.getElementById("count3"),

    // Preview / Details
    relicImg: document.getElementById("relicImg"),
    chosenList: document.getElementById("chosenList"),
    detailsBody: document.getElementById("detailsBody"),

    // Optional (safe if missing)
    statusText: document.getElementById("statusText") || null
  };
}
