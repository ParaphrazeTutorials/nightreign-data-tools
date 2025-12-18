// One place to grab all DOM elements

export function getDom() {
  return {
    selType: document.getElementById("relicType"),
    selColor: document.getElementById("relicColor"),

    showIllegalEl: document.getElementById("showIllegal"),
    showRawEl: document.getElementById("showRaw"),

    startOverBtn: document.getElementById("startOver"),

    cat1: document.getElementById("cat1"),
    cat2: document.getElementById("cat2"),
    cat3: document.getElementById("cat3"),

    sel1: document.getElementById("effect1"),
    sel2: document.getElementById("effect2"),
    sel3: document.getElementById("effect3"),

    count1: document.getElementById("count1"),
    count2: document.getElementById("count2"),
    count3: document.getElementById("count3"),

    relicImg: document.getElementById("relicImg"),
    statusText: document.getElementById("statusText"),
    detailsList: document.getElementById("detailsList"),
    chosenList: document.getElementById("chosenList"),
  };
}
