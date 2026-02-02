// Centralized in-memory state for Reliquary
// ==================== State ====================

export const MODES = { INDIVIDUAL: "individual", CHALICE: "chalice" };
export const DETAILS_VIEW = { COLLAPSED: "collapsed", PARTIAL: "partial", FULL: "full" };

// Mode / UI flags
export let activeMode = MODES.INDIVIDUAL;
export let individualDetailsCollapsed = false;
export let chaliceDetailsView = DETAILS_VIEW.COLLAPSED;
export let relicTypeMenuOpen = false;
export let relicTypePopoverOpen = false;
export let classPortraitMenuOpen = false;
export let showIllegalActive = false;
export let autoSortEnabled = true;

// Color selection
export let currentRandomColor = "Red";
export let selectedColor = "Random";
export const COLOR_CHOICES = ["Random", "Red", "Blue", "Yellow", "Green"]; // COLORS imported where used

// Selections
export const selectedEffects = ["", "", ""];
export const selectedCats = ["", "", ""];
export const curseBySlot = [null, null, null];
export const curseCatBySlot = ["", "", ""];

// Chalice selections
export const chaliceSelections = {
  standard: Array(9).fill(""),
  depth: Array(9).fill("")
};
export const chaliceGroupOrder = {
  standard: [],
  depth: []
};
export const chaliceEffectDrag = { side: "", slot: -1 };
export const chaliceCurses = {
  standard: Array(9).fill(""),
  depth: Array(9).fill("")
};
export const chaliceCats = {
  standard: Array(9).fill(""),
  depth: Array(9).fill("")
};
export const chaliceColorCache = { standard: "#ffffff", depth: "#ffffff" };
export const chaliceColorListCache = { standard: [], depth: [] };

// Pending popover state
export let pendingRelicType = "";
export let pendingRelicColor = "Random";

// Data caches
export let rows = [];
export let byId = new Map();
export let rowsAll = [];
export let byIdAll = new Map();
export let curses = [];
export let chaliceData = [];
export let chalicesByCharacter = new Map();
export let effectStatsRows = [];
export let effectStatsByEffectId = new Map();
export let conditionalEffectState = new Map();
export let conditionalEffectStacks = new Map();

// Selection state
export let selectedClass = "";
export let selectedChaliceId = "";

// Last-known validation results
export let lastChaliceRollIssues = { standard: [], depth: [] };
export let lastChaliceIssues = { errors: [], warnings: [] };
export let lastChaliceIconOffsets = { warning: null, error: null };
export let lastChaliceIssueAssignments = { rail: { errors: [], warnings: [] }, perSlot: new Map() };

// State mutators
export function setActiveMode(next) { activeMode = next; }
export function setIndividualDetailsCollapsed(next) { individualDetailsCollapsed = !!next; }
export function setChaliceDetailsView(next) { chaliceDetailsView = next; }
export function setRelicTypeMenuOpen(next) { relicTypeMenuOpen = !!next; }
export function setRelicTypePopoverOpen(next) { relicTypePopoverOpen = !!next; }
export function setClassPortraitMenuOpen(next) { classPortraitMenuOpen = !!next; }
export function setShowIllegalActive(next) { showIllegalActive = !!next; }
export function setAutoSortEnabled(next) { autoSortEnabled = !!next; }
export function setPendingRelicType(next) { pendingRelicType = next; }
export function setPendingRelicColor(next) { pendingRelicColor = next; }
export function setSelectedColor(next) { selectedColor = next; }
export function setCurrentRandomColor(next) { currentRandomColor = next; }
export function setSelectedClass(next) { selectedClass = next; }
export function setSelectedChaliceId(next) { selectedChaliceId = next; }
export function setRows(next) { rows = next; }
export function setById(next) { byId = next; }
export function setRowsAll(next) { rowsAll = next; }
export function setByIdAll(next) { byIdAll = next; }
export function setCurses(next) { curses = next; }
export function setChaliceData(next) { chaliceData = next; }
export function setChalicesByCharacter(next) { chalicesByCharacter = next; }
export function setEffectStatsRows(next) { effectStatsRows = next; }
export function setEffectStatsByEffectId(next) { effectStatsByEffectId = next; }
export function setConditionalEffectState(next) { conditionalEffectState = next; }
export function setConditionalEffectStacks(next) { conditionalEffectStacks = next; }
export function setLastChaliceRollIssues(next) { lastChaliceRollIssues = next; }
export function setLastChaliceIssues(next) { lastChaliceIssues = next; }
export function setLastChaliceIconOffsets(next) { lastChaliceIconOffsets = next; }
export function setLastChaliceIssueAssignments(next) { lastChaliceIssueAssignments = next; }

// Convenience getters
export const getSelectedEffects = () => selectedEffects;
export const getSelectedCats = () => selectedCats;
export const getCurseBySlot = () => curseBySlot;
export const getCurseCatBySlot = () => curseCatBySlot;
export const getChaliceSelections = () => chaliceSelections;
export const getChaliceGroupOrder = () => chaliceGroupOrder;
export const getChaliceEffectDrag = () => chaliceEffectDrag;
export const getChaliceCurses = () => chaliceCurses;
export const getChaliceCats = () => chaliceCats;
export const getChaliceColorCache = () => chaliceColorCache;
export const getChaliceColorListCache = () => chaliceColorListCache;
export const getConditionalEffectState = () => conditionalEffectState;
export const getConditionalEffectStacks = () => conditionalEffectStacks;