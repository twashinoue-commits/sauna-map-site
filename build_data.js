// Rebuilds data.json from a Google Form CSV export.
// Usage: node build_data.js <path-to-csv>
//
// - Preserves previously-geocoded lat/lng for facilities already in data.json
//   (matched by exact facility name), so re-running this doesn't lose accuracy.
// - New facilities without known coordinates are left with lat/lng = null;
//   ask Claude to geocode them and re-run, or edit data.json by hand.
// - Poster names are anonymized to "部員A" / "部員B" / ... (never committed as
//   real names) — the mapping is NOT stable across runs beyond this file's
//   own pass, so re-running reassigns letters by first-appearance order.

const fs = require("fs");

const csvPath = process.argv[2];
if (!csvPath) {
  console.error("Usage: node build_data.js <path-to-csv>");
  process.exit(1);
}

const HEADERS = {
  ts: "タイムスタンプ", name: "施設名", pref: "都道府県", region: "都道府県の地域",
  url: "施設URL", good: "良かった点", bad: "悪かった点", rating: "またイキタイ度", poster: "投稿者"
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
  while (rows.length && rows[rows.length - 1].every((v) => v === "")) rows.pop();
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = r[i] !== undefined ? r[i] : ""; });
    return obj;
  });
}

function splitLines(text) {
  if (!text) return [];
  return text.split("\n").map((l) => l.replace(/^[・\s]+/, "").trim()).filter(Boolean);
}

const prevData = fs.existsSync("data.json") ? JSON.parse(fs.readFileSync("data.json", "utf8")) : [];
const coordLookup = {};
prevData.forEach((s) => { if (s.lat && s.lng && !coordLookup[s.name]) coordLookup[s.name] = { lat: s.lat, lng: s.lng }; });

const rows = parseCSV(fs.readFileSync(csvPath, "utf8"));

const posterLetters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const posterMap = new Map();
let posterCount = 0;
function anonymize(rawPoster) {
  const key = (rawPoster || "").replace(/[\s　]+/g, "");
  if (!key) return "";
  if (!posterMap.has(key)) { posterMap.set(key, posterLetters[posterCount] || "?" + posterCount); posterCount++; }
  return "部員" + posterMap.get(key);
}

const data = rows.map((r, i) => {
  const name = (r[HEADERS.name] || "").trim();
  const known = coordLookup[name];
  const ts = (r[HEADERS.ts] || "").trim();
  return {
    id: i + 1,
    name,
    pref: (r[HEADERS.pref] || "").trim(),
    region: (r[HEADERS.region] || "").trim(),
    url: (r[HEADERS.url] || "").trim(),
    good: splitLines(r[HEADERS.good]),
    bad: splitLines(r[HEADERS.bad]),
    rating: Number(r[HEADERS.rating]) || 0,
    poster: anonymize(r[HEADERS.poster]),
    date: ts ? ts.split(" ")[0].replace(/\//g, "-") : "",
    lat: known ? known.lat : null,
    lng: known ? known.lng : null,
  };
}).filter((s) => s.name && s.pref);

fs.writeFileSync("data.json", JSON.stringify(data));
const missing = data.filter((s) => !s.lat || !s.lng);
console.log("wrote data.json:", data.length, "records");
if (missing.length) {
  console.log("missing coordinates for:", missing.map((s) => s.name + "(" + s.pref + " " + s.region + ")").join(", "));
}
