// Rebuilds data.json from the Google Form response sheet.
//
// Input (one of):
//   ROWS_FILE=<path>        JSON array of rows (first row = headers), as sent by the Apps Script
//   node scripts/sync.js <csv-path>   CSV export of the sheet (manual fallback)
// Required env:
//   POSTER_SALT             secret salt for anonymizing poster names
//
// Side files (committed):
//   coords.json       facility name -> {lat, lng, approx?}. Edit by hand to fix a pin.
//   poster-map.json   salted hash of poster name -> letter ("部員A"). Never holds real names.

const fs = require("fs");
const crypto = require("crypto");

const HEADERS = {
  ts: "タイムスタンプ", name: "施設名", pref: "都道府県", region: "都道府県の地域",
  url: "施設URL", good: "良かった点", bad: "悪かった点", rating: "またイキタイ度", poster: "投稿者",
};

function parseCSV(text) {
  text = text.replace(/^﻿/, "");
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; } }
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\r") { /* skip */ }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function readRows() {
  if (process.env.ROWS_FILE) return JSON.parse(fs.readFileSync(process.env.ROWS_FILE, "utf8"));
  if (process.argv[2]) return parseCSV(fs.readFileSync(process.argv[2], "utf8"));
  throw new Error("Set ROWS_FILE or pass a CSV path");
}

function readJSON(path, fallback) {
  return fs.existsSync(path) ? JSON.parse(fs.readFileSync(path, "utf8")) : fallback;
}

function splitLines(text) {
  if (!text) return [];
  return String(text).split("\n").map((l) => l.replace(/^[・\s]+/, "").trim()).filter(Boolean);
}

function safeUrl(url) {
  const u = String(url || "").trim();
  return /^https?:\/\//i.test(u) ? u : "";
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function nominatim(query) {
  const url = "https://nominatim.openstreetmap.org/search?format=json&countrycodes=jp&limit=1&q=" + encodeURIComponent(query);
  const res = await fetch(url, { headers: { "User-Agent": "sauna-map-site-sync/1.0 (github.com/twashinoue-commits/sauna-map-site)" } });
  await sleep(1100); // Nominatim usage policy: max 1 request/second
  if (!res.ok) return null;
  const json = await res.json();
  return json.length ? { lat: Number(json[0].lat), lng: Number(json[0].lon) } : null;
}

async function geocode(name, pref, region) {
  const exact = await nominatim([name, region, pref].filter(Boolean).join(" "));
  if (exact) return exact;
  const byName = await nominatim(name);
  if (byName) return byName;
  const area = await nominatim([pref, region].filter(Boolean).join(" "));
  return area ? { lat: area.lat, lng: area.lng, approx: true } : null;
}

async function main() {
  const salt = process.env.POSTER_SALT;
  if (!salt) throw new Error("POSTER_SALT is not set");

  const rows = readRows();
  if (!rows.length) throw new Error("No rows");
  const headers = rows[0].map((h) => String(h).trim());
  const col = {};
  for (const [key, label] of Object.entries(HEADERS)) {
    col[key] = headers.indexOf(label);
    if (col[key] === -1) throw new Error("Missing column: " + label);
  }
  const cell = (r, key) => String(r[col[key]] ?? "").trim();

  const coords = readJSON("coords.json", {});
  const posterMap = readJSON("poster-map.json", {});
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  function anonymize(raw) {
    const normalized = String(raw || "").replace(/[\s　]+/g, "");
    if (!normalized) return "";
    const key = crypto.createHash("sha256").update(salt + normalized).digest("hex").slice(0, 16);
    if (!posterMap[key]) {
      const used = new Set(Object.values(posterMap));
      posterMap[key] = letters.split("").find((l) => !used.has(l)) || "X" + Object.keys(posterMap).length;
    }
    return "部員" + posterMap[key];
  }

  const data = [];
  for (const r of rows.slice(1)) {
    const name = cell(r, "name");
    const pref = cell(r, "pref");
    if (!name || !pref) continue;
    const region = cell(r, "region");

    if (!coords[name]) {
      const geo = await geocode(name, pref, region);
      if (geo) {
        coords[name] = geo;
        console.log("geocoded:", name, geo.approx ? "(approx)" : "");
      } else {
        console.log("geocode failed:", name);
      }
    }
    const c = coords[name];
    data.push({
      id: data.length + 1,
      name,
      pref,
      region,
      url: safeUrl(cell(r, "url")),
      good: splitLines(cell(r, "good")),
      bad: splitLines(cell(r, "bad")),
      rating: Number(cell(r, "rating")) || 0,
      poster: anonymize(cell(r, "poster")),
      date: cell(r, "ts").split(" ")[0].replace(/\//g, "-"),
      lat: c ? c.lat : null,
      lng: c ? c.lng : null,
      approx: !!(c && c.approx),
    });
  }

  fs.writeFileSync("data.json", JSON.stringify(data));
  fs.writeFileSync("coords.json", JSON.stringify(coords, null, 2) + "\n");
  fs.writeFileSync("poster-map.json", JSON.stringify(posterMap, null, 2) + "\n");
  console.log("wrote", data.length, "records");
}

main().catch((e) => { console.error(e.message); process.exit(1); });
