import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  STATUS_ICON_PATHS,
  RELIC_COLORS,
  RELIC_SIZES,
  alertIconUrl,
  iconPath,
  relicDefaultPath,
  relicPath
} from "../Reliquary/reliquary.assets.js";

const workspaceRoot = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const iconDir = path.join(workspaceRoot, "Assets", "icons", "reliquary");
const relicDir = path.join(workspaceRoot, "Assets", "relics");
const data = JSON.parse(fs.readFileSync(path.join(workspaceRoot, "Data", "reliquary.json"), "utf8"));

const statusIconIds = Array.from(
  new Set(
    data
      .map(row => String(row.StatusIconID || "").trim())
      .filter(Boolean)
  )
);

function urlToFsPath(url) {
  const { pathname } = new URL(url);
  return path.join(workspaceRoot, pathname.replace(/^\/+/, ""));
}

describe("reliquary assets", () => {
  it("includes a file for every StatusIconID used in data", () => {
    statusIconIds.forEach(id => {
      expect(fs.existsSync(path.join(iconDir, `${id}.png`))).toBe(true);
    });
  });

  it("resolves alert icons and relays to existing files", () => {
    ["warning", "error"].forEach(kind => {
      const url = alertIconUrl(kind);
      expect(url).toContain("/Assets/icons/reliquary/chalice-");
      expect(fs.existsSync(urlToFsPath(url))).toBe(true);
    });
  });

  it("builds icon URLs that match the on-disk files", () => {
    const sampleId = statusIconIds[0];
    const url = iconPath(sampleId);
    expect(url).toContain(`/Assets/icons/reliquary/${sampleId}.png`);
    expect(fs.existsSync(urlToFsPath(url))).toBe(true);
  });

  it("keeps the explicit icon map in sync with the data set", () => {
    const manifestIds = new Set(Object.keys(STATUS_ICON_PATHS));
    statusIconIds.forEach(id => expect(manifestIds.has(id)).toBe(true));
  });

  it("contains default relic thumbnails for both types", () => {
    [
      { type: "Standard", file: "standard.png" },
      { type: "Depth Of Night", file: "depth_of_night.png" }
    ].forEach(({ type, file }) => {
      const url = relicDefaultPath(type);
      expect(url).toContain(`/Assets/relics/default/${file}`);
      expect(fs.existsSync(urlToFsPath(url))).toBe(true);
    });
  });

  it("contains colored relic variants for every size/color/type combo", () => {
    [
      { type: "Standard", folder: "standard" },
      { type: "Depth Of Night", folder: "depth_of_night" }
    ].forEach(({ type, folder }) => {
      RELIC_SIZES.forEach(size => {
        RELIC_COLORS.forEach(color => {
          const url = relicPath(type, color, size);
          expect(url).toContain(`/Assets/relics/${folder}/${size}/${color}.png`);
          expect(fs.existsSync(urlToFsPath(url))).toBe(true);
        });
      });
    });
  });
});
