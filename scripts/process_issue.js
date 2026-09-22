// Processes a "sauna-entry" GitHub Issue (created from .github/ISSUE_TEMPLATE/new-sauna.yml)
// into a new record appended to data.json, geocoding it via Nominatim (OpenStreetMap)
// and anonymizing the poster name against poster-map.json.
//
// Env vars expected (set by the workflow):
//   ISSUE_BODY, ISSUE_NUMBER
//
// Exits with a JSON result on stdout: { ok: true, name, pref } or { ok: false, reason }

const fs = require("fs");

const LABELS = {
  name: "施設名",
  pref: "都道府県",
  region: "地域(市区町村や俗称)",
  url: "施設URL",
  good: "良かった点",
  bad: "気になった点",
  rating: "またイキタイ度",
  poster: "お名前",
};

function parseIssueBody(body) {
  const fields = {};
  const re = /###\s*(.+?)\s*\n+([\s\S]*?)(?=\n###\s|\s*$)/g;
  let m;
  while ((m = re.exec(body))) {
    const label = m[1].trim();
    let value = m[2].trim();
    if (value === "_No response_") value = "";
    fields[label] = value;
  }
  return fields;
}

function splitLines(text) {
  if (!text) return [];
  return text.split("\n").map((l) => l.replace(/^[-・\s]+/, "").trim()).filter(Boolean);
}

async function geocode(name, pref, region) {
  const query = [name, region, pref, "日本"].filter(Boolean).join(" ");
  const url = "https://nominatim.openstreetmap.org/search?format=json&countrycodes=jp&limit=1&q=" + encodeURIComponent(query);
  try {
    const res = await fetch(url, { headers: { "User-Agent": "sauna-map-site-issue-bot/1.0" } });
    if (!res.ok) return null;
    const json = await res.json();
    if (!json.length) return null;
    return { lat: Number(json[0].lat), lng: Number(json[0].lon) };
  } catch (e) {
    return null;
  }
}

function anonymize(rawPoster) {
  const key = (rawPoster || "").replace(/[\s　]+/g, "");
  if (!key) return "";
  const mapPath = "poster-map.json";
  const map = fs.existsSync(mapPath) ? JSON.parse(fs.readFileSync(mapPath, "utf8")) : {};
  if (!map[key]) {
    const used = new Set(Object.values(map));
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let letter = letters.split("").find((l) => !used.has(l));
    if (!letter) letter = "X" + Object.keys(map).length;
    map[key] = letter;
    fs.writeFileSync(mapPath, JSON.stringify(map, null, 2));
  }
  return "部員" + map[key];
}

function todayISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
}

async function main() {
  const body = process.env.ISSUE_BODY || "";
  const fields = parseIssueBody(body);

  const name = (fields[LABELS.name] || "").trim();
  const pref = (fields[LABELS.pref] || "").trim();
  if (!name || !pref) {
    console.log(JSON.stringify({ ok: false, reason: "施設名と都道府県は必須です。" }));
    return;
  }

  const region = (fields[LABELS.region] || "").trim();
  const geo = await geocode(name, pref, region);

  const data = JSON.parse(fs.readFileSync("data.json", "utf8"));
  const nextId = data.reduce((max, s) => Math.max(max, s.id), 0) + 1;

  const record = {
    id: nextId,
    name,
    pref,
    region,
    url: (fields[LABELS.url] || "").trim(),
    good: splitLines(fields[LABELS.good]),
    bad: splitLines(fields[LABELS.bad]),
    rating: Number(fields[LABELS.rating]) || 0,
    poster: anonymize(fields[LABELS.poster]),
    date: todayISO(),
    lat: geo ? geo.lat : null,
    lng: geo ? geo.lng : null,
  };

  data.push(record);
  fs.writeFileSync("data.json", JSON.stringify(data));

  console.log(JSON.stringify({ ok: true, name, pref, geocoded: !!geo }));
}

main();
