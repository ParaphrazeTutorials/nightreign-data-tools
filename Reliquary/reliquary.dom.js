export function getDom() {
  return {
    // Top controls
    selType: document.getElementById("relicType"),
    selClass: document.getElementById("classFilter"),

    // Mode switching
    modeBtnIndividual: document.getElementById("modeIndividualBtn"),
    modeBtnChalice: document.getElementById("modeChaliceBtn"),
    individualPanel: document.getElementById("individualMode"),
    chalicePanel: document.getElementById("chaliceMode"),
    utilityBar: document.getElementById("utilityBar"),
    modeTabs: document.getElementById("modeTabs"),
    modeTabsHomeSlot: document.getElementById("modeTabsHomeSlot"),
    modeTabsChaliceSlot: document.getElementById("modeTabsChaliceSlot"),
    modeSwitchGroup: document.getElementById("modeSwitchGroup"),

    classFilterControl: document.getElementById("classFilterControl"),
    classFilterSlotIndividual: document.getElementById("classFilterSlotIndividual"),
    classFilterSlotChalice: document.getElementById("classFilterSlotChalice"),

    chalicePickerControl: document.getElementById("chalicePickerControl"),
    chalicePickerSlot: document.getElementById("chalicePickerSlot"),

    startOverSlotIndividual: document.getElementById("startOverSlotIndividual"),
    startOverSlotChalice: document.getElementById("startOverSlotChalice"),

    showIllegalBtn: document.getElementById("showIllegalBtn"),
    illegalPill: document.getElementById("illegalPill"),
    startOverBtn: document.getElementById("startOver"),
    instructionsBtn: document.getElementById("instructionsBtn") || null,
    instructionsBtnChalice: document.getElementById("instructionsBtnChalice") || null,
    disclaimerBtn: document.getElementById("disclaimerBtn") || null,
    instructionsPopover: document.getElementById("instructionsPopover") || null,
    disclaimerPopover: document.getElementById("disclaimerPopover") || null,

    // Counts
    count1: document.getElementById("count1"),
    count2: document.getElementById("count2"),
    count3: document.getElementById("count3"),

    // Preview / Details
    relicImg: document.getElementById("relicImg"),
    relicProbability: document.getElementById("relicProbability"),
    relicProbabilityValue: document.getElementById("relicProbabilityValue"),
    relicColorControl: document.getElementById("relicColorControl"),
    relicColorChip: document.getElementById("relicColorChip"),
    relicColorMenu: document.getElementById("relicColorMenu"),
    chosenList: document.getElementById("chosenList"),
    detailsBody: document.getElementById("detailsBody"),

    // Optional (safe if missing)
    statusText: document.getElementById("statusText") || null,

    // Chalice builder
    chaliceSelect: document.getElementById("chaliceSelect"),
    chaliceStandardList: document.getElementById("chaliceStandardList"),
    chaliceDepthList: document.getElementById("chaliceDepthList"),
    chaliceStandardCount: document.getElementById("chaliceStandardCount"),
    chaliceDepthCount: document.getElementById("chaliceDepthCount"),
    chaliceAddStandard: document.getElementById("chaliceAddStandard"),
    chaliceAddDepth: document.getElementById("chaliceAddDepth"),
    chaliceFilterTotals: document.getElementById("chaliceFilterTotals"),
    chaliceResultsStandard: document.getElementById("chaliceResultsStandard"),
    chaliceResultsDepth: document.getElementById("chaliceResultsDepth"),
    chaliceStatus: document.getElementById("chaliceStatus"),
    chaliceStandardColors: document.getElementById("chaliceStandardColors"),
    chaliceDepthColors: document.getElementById("chaliceDepthColors")
  };
}
