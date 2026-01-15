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
    showIllegalBtnChalice: document.getElementById("showIllegalBtnChalice"),
    showIllegalButtons: Array.from(document.querySelectorAll("[data-show-illegal]")),
    autoSortToggle: document.getElementById("autoSortToggle"),
    autoSortToggleChalice: document.getElementById("autoSortToggleChalice"),
    autoSortToggleButtons: Array.from(document.querySelectorAll("[data-auto-sort-toggle]")),
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
    statOverviewSection: document.getElementById("statOverviewSection"),
    statOverviewAttributes: document.getElementById("statOverviewAttributes"),
    statOverviewAttack: document.getElementById("statOverviewAttack"),
    statOverviewDefense: document.getElementById("statOverviewDefense"),
    statOverviewAttributesExtras: document.getElementById("statOverviewAttributesExtras"),
    statOverviewAttackExtras: document.getElementById("statOverviewAttackExtras"),
    statOverviewDefenseExtras: document.getElementById("statOverviewDefenseExtras"),
    statOverviewUtilityExtras: document.getElementById("statOverviewUtilityExtras"),
    statOverviewOther: document.getElementById("statOverviewOther"),
    statOverviewOtherSection: document.getElementById("statOverviewOtherSection"),
    statOverviewName: document.getElementById("statOverviewName"),
    statOverviewHP: document.getElementById("statOverviewHP"),
    statOverviewFP: document.getElementById("statOverviewFP"),
    statOverviewST: document.getElementById("statOverviewST"),
    statOverviewPortrait: document.getElementById("statOverviewPortrait"),
    chaliceStandardColors: document.getElementById("chaliceStandardColors"),
    chaliceDepthColors: document.getElementById("chaliceDepthColors"),

    // Results panel state
    chaliceLayout: document.getElementById("chaliceLayout"),
    chaliceResultsPane: document.getElementById("chaliceResultsPane"),
    chaliceResultsShell: document.getElementById("chaliceDetails"),
    detailsShell: document.getElementById("detailsShell"),
    chaliceDetailsExpandBtn: document.getElementById("chaliceDetailsExpandBtn"),
    chaliceResultsToggle: document.getElementById("chaliceResultsToggle"),
    chaliceResultsContent: document.getElementById("chaliceResultsContent"),
    chaliceDetailsCollapseBtnFull: document.getElementById("chaliceDetailsCollapseBtnFull"),
    chaliceResultsTakeoverNote: document.getElementById("chaliceResultsTakeoverNote"),
    chaliceAlertIconStack: document.getElementById("chaliceAlertIconStack"),
    chaliceAlertIconError: document.getElementById("chaliceAlertIconError"),
    chaliceAlertIconWarning: document.getElementById("chaliceAlertIconWarning"),
    chaliceAlertPanelWarning: document.getElementById("chaliceAlertPanelWarning"),
    chaliceAlertPanelTitleWarning: document.getElementById("chaliceAlertPanelTitleWarning"),
    chaliceAlertListWarning: document.getElementById("chaliceAlertListWarning"),
    chaliceAlertPanelError: document.getElementById("chaliceAlertPanelError"),
    chaliceAlertPanelTitleError: document.getElementById("chaliceAlertPanelTitleError"),
    chaliceAlertListError: document.getElementById("chaliceAlertListError"),
    chaliceDetailsCollapseBtn: document.getElementById("chaliceDetailsCollapseBtn"),
    chaliceAutoSortBtn: document.getElementById("chaliceAutoSortBtn"),
  };
}
