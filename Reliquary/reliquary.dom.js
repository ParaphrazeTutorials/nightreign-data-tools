export function getDom() {
  return {
    // Top controls
    selType: document.getElementById("relicType"),
    selColor: document.getElementById("relicColor"),

    showIllegalEl: document.getElementById("showIllegal"),
    showRawEl: document.getElementById("showRaw"),
    startOverBtn: document.getElementById("startOver"),

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
