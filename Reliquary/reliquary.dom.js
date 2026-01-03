export function getDom() {
  return {
    // Top controls
    selType: document.getElementById("relicType"),

    showIllegalBtn: document.getElementById("showIllegalBtn"),
    illegalPill: document.getElementById("illegalPill"),
    startOverBtn: document.getElementById("startOver"),
    instructionsBtn: document.getElementById("instructionsBtn") || null,
    disclaimerBtn: document.getElementById("disclaimerBtn") || null,
    instructionsPopover: document.getElementById("instructionsPopover") || null,
    disclaimerPopover: document.getElementById("disclaimerPopover") || null,

    // Counts
    count1: document.getElementById("count1"),
    count2: document.getElementById("count2"),
    count3: document.getElementById("count3"),

    // Preview / Details
    relicImg: document.getElementById("relicImg"),
    relicColorControl: document.getElementById("relicColorControl"),
    relicColorChip: document.getElementById("relicColorChip"),
    relicColorMenu: document.getElementById("relicColorMenu"),
    chosenList: document.getElementById("chosenList"),
    detailsBody: document.getElementById("detailsBody"),

    // Optional (safe if missing)
    statusText: document.getElementById("statusText") || null
  };
}
