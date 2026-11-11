// Marktkompass – isolierter Intraday-VIX-Test-Worker
// Read-only gegenüber GitHub und Marktkompass-Daten.
// Einzige Schreiboperation: 15-Minuten-Cache im separaten Test-KV.

const GITHUB_API = "https://api.github.com";
const OWNER = "24crfnm2vk-wq";
const REPO = "H1-Pruefstand";
const APPROVED_PATH = "data/market-data/msci_acwi_approved_update.json";
const INTRADAY_CACHE_KEY = "marktkompass:intraday-vix:test:start-check:v1";
const INTRADAY_COOLDOWN_MS = 15 * 60 * 1000;
const INTRADAY_CACHE_TTL_SECONDS = 15 * 60;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);
    if (url.pathname === "/health") {
      return json({ ok: true, worker: "marktkompass-intraday-test", mode: "read-only" });
    }
    if (url.pathname !== "/intraday-candidate") return json({ error: "Not found" }, 404);
    try {
      const state = await getIntradayMarketState(env);
      if (state.blocked) {
        return json({
          version: "intraday-vix-test-candidate-v1",
          available: false,
          publicationPending: state.publicationPending,
          regularRefreshRequired: state.regularRefreshRequired,
          message: state.publicationPending
            ? "Der veröffentlichte ACWI-Datenstand ist noch nicht vollständig aktuell. Intraday bleibt ausgesetzt."
            : "Ein regulärer gemeinsamer ACWI-/VIX-Schlusspunkt hat Vorrang.",
          acwiDate: state.latestAcwiDate,
          acwiClose: state.latestAcwiClose,
          regularDate: state.latestCommonDate,
          regularVix: state.latestCommonVix
        });
      }
      const cache = await readIntradayStartCache(env);
      const now = Date.now();
      const cacheMatches =
        cache?.version === "intraday-vix-test-cache-v1" &&
        cache.latestAcwiDate === state.latestAcwiDate &&
        Number(cache.latestAcwiClose) === Number(state.latestAcwiClose) &&
        Number.isFinite(Number(cache.checkedAt)) &&
        now - Number(cache.checkedAt) >= 0 &&
        now - Number(cache.checkedAt) < INTRADAY_COOLDOWN_MS &&
        cache.candidate?.acwiDate === state.latestAcwiDate;
      let candidate;
      if (cacheMatches) {
        candidate = cache.candidate;
      } else {
        candidate = await fetchIntradayVixCandidate(state.latestAcwiDate);
        await writeIntradayStartCache(env, {
          version: "intraday-vix-test-cache-v1",
          checkedAt: now,
          latestAcwiDate: state.latestAcwiDate,
          latestAcwiClose: state.latestAcwiClose,
          candidate
        });
      }
      return json({
        version: "intraday-vix-test-candidate-v1",
        available: true,
        cooldownActive: cacheMatches,
        checkedAt: new Date(cacheMatches ? Number(cache.checkedAt) : now).toISOString(),
        nextCheckAt: new Date((cacheMatches ? Number(cache.checkedAt) : now) + INTRADAY_COOLDOWN_MS).toISOString(),
        id: candidate.id,
        vix: candidate.vix,
        timestamp: candidate.timestamp,
        acwiDate: candidate.acwiDate,
        acwiClose: state.latestAcwiClose,
        source: "FearGreedChart",
        mode: "read-only-test"
      });
    } catch (error) {
      console.error(error);
      return json({
        version: "intraday-vix-test-candidate-v1",
        available: false,
        error: error instanceof Error ? error.message : String(error)
      }, 500);
    }
  }
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "https://24crfnm2vk-wq.github.io",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}
function json(value, status = 200) {
  return new Response(JSON.stringify(value, null, 2), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders() }
  });
}
async function getIntradayMarketState(env) {
  const ACWI_MASTER_PATH = "data/market-data/msci_acwi_daily_clean.csv";
  const VIX_MASTER_PATH = "data/market-data/vix_daily_clean.csv";
  const PUBLIC_STATUS_URL = "https://24crfnm2vk-wq.github.io/Marktkompass/status.json";

  const [acwiFile, vixFile, approvedUpdates] = await Promise.all([
    githubGetFileWithSha(env, ACWI_MASTER_PATH),
    githubGetFileWithSha(env, VIX_MASTER_PATH),
    readApprovedAcwiUpdates(env)
  ]);

  if (!acwiFile || !vixFile) {
    throw new Error("Reguläre ACWI-/VIX-Masterdaten fehlen; Intraday bleibt gesperrt.");
  }

  const parseDates = (text, label) => {
    const lines = base64ToUtf8(text)
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean);

    if (lines.shift() !== "date;close") {
      throw new Error(`Ungültiges CSV-Format in ${label}.`);
    }

    const dates = new Map();
    let previousDate = null;

    for (const line of lines) {
      const parts = line.split(";");
      if (parts.length !== 2 || !isValidIsoDate(parts[0])) {
        throw new Error(`Ungültiger Datensatz in ${label}.`);
      }

      const date = parts[0];
      const close = Number(parts[1]);

      if (!Number.isFinite(close) || close <= 0) {
        throw new Error(`Ungültiger Schlusskurs in ${label}.`);
      }

      if (dates.has(date)) {
        throw new Error(`Doppeltes Datum in ${label}: ${date}`);
      }

      if (previousDate !== null && date <= previousDate) {
        throw new Error(`Daten in ${label} sind nicht streng chronologisch sortiert.`);
      }

      dates.set(date, close);
      previousDate = date;
    }

    return dates;
  };

  const acwiDates = parseDates(acwiFile.content, ACWI_MASTER_PATH);
  for (const row of approvedUpdates) {
    const existingClose = acwiDates.get(row.date);

    if (existingClose !== undefined && existingClose !== row.close) {
      throw new Error(`Konflikt zwischen ACWI-Master und freigegebenem Update am ${row.date}.`);
    }

    acwiDates.set(row.date, row.close);
  }

  const vixDates = parseDates(vixFile.content, VIX_MASTER_PATH);

  let latestCommonDate = null;
  for (const date of acwiDates.keys()) {
    if (vixDates.has(date) && (!latestCommonDate || date > latestCommonDate)) {
      latestCommonDate = date;
    }
  }

  if (!latestCommonDate) {
    throw new Error("Kein gemeinsamer regulärer ACWI-/VIX-Handelstag feststellbar; Intraday bleibt gesperrt.");
  }

  const latestAcwiDate = [...acwiDates.keys()].sort().at(-1);

  const statusResponse = await fetch(PUBLIC_STATUS_URL, { cache: "no-store" });
  if (!statusResponse.ok) {
    throw new Error("Der veröffentlichte Datenstand ist nicht abrufbar; Intraday bleibt gesperrt.");
  }

  const status = await statusResponse.json();
  if (!isValidIsoDate(status?.date)) {
    throw new Error("Der veröffentlichte Datenstand ist ungültig; Intraday bleibt gesperrt.");
  }

  // Auch ein regulärer Schlusskurs am selben ACWI-Tag hat Vorrang.
  // Ein reiner Vergleich mit status.date würde den Fall übersehen,
  // dass status.json bereits einen Intraday-Punkt desselben Tages enthält.
  const regularCloseAtLatestAcwi = latestCommonDate === latestAcwiDate;

  // Der Worker prüft die Veröffentlichung unabhängig vom Browser selbst.
  // Ein serverseitig gespeicherter ACWI-Stand darf erst dann für Intraday
  // verwendet werden, wenn status.json exakt Datum und Schlusswert enthält.
  const latestAcwiClose = acwiDates.get(latestAcwiDate);
  const publicationPending =
    status.date !== latestAcwiDate ||
    !Number.isFinite(Number(status.acwi)) ||
    Number(status.acwi) !== Number(latestAcwiClose);

  // Intraday wird gesperrt, solange der freigegebene ACWI-Stand noch nicht
  // veröffentlicht ist oder bereits ein regulärer gemeinsamer Schlusskurs
  // für genau diesen jüngsten ACWI-Datensatz vorliegt.
  const blocked = publicationPending || regularCloseAtLatestAcwi;
  const latestCommonVix = latestCommonDate
    ? vixDates.get(latestCommonDate)
    : null;
  const regularAlreadyPublished =
    status.date === latestCommonDate &&
    status.isIntraday !== true &&
    Number(status.vix) === Number(latestCommonVix) &&
    Number(status.acwi) === Number(acwiDates.get(latestCommonDate));

  return {
    blocked,
    publicationPending,
    regularRefreshRequired:
      !publicationPending && regularCloseAtLatestAcwi && !regularAlreadyPublished,
    latestAcwiDate,
    latestAcwiClose,
    latestCommonDate,
    latestCommonVix,
    status
  };
}

async function readApprovedAcwiUpdates(env) {
  const result = await githubGetFileWithSha(env, APPROVED_PATH);
  if (!result) return [];

  let payload;
  try {
    payload = JSON.parse(base64ToUtf8(result.content));
  } catch {
    throw new Error("Die gespeicherten ACWI-Freigabedaten sind kein gültiges JSON.");
  }

  if (
    payload?.version !== "acwi-approved-update-v1" ||
    !Array.isArray(payload.data)
  ) {
    throw new Error("Die gespeicherten ACWI-Freigabedaten haben ein ungültiges Format.");
  }

  const data = [];
  let previousDate = null;
  const seen = new Set();

  for (const row of payload.data) {
    const date = String(row?.date ?? "").trim();
    const close = Number(row?.close);

    if (
      !isValidIsoDate(date) ||
      !Number.isFinite(close) ||
      close <= 0 ||
      seen.has(date) ||
      (previousDate !== null && date <= previousDate)
    ) {
      throw new Error("Die gespeicherten ACWI-Freigabedaten sind ungültig oder nicht streng chronologisch sortiert.");
    }

    data.push({ date, close });
    seen.add(date);
    previousDate = date;
  }

  return data;
}

async function readIntradayStartCache(env) {
  const binding = env.INTRADAY_CACHE;
  if (!binding || typeof binding.get !== "function" || typeof binding.put !== "function") {
    throw new Error("Cloudflare-KV-Binding INTRADAY_CACHE fehlt oder ist unvollständig.");
  }

  const raw = await binding.get(INTRADAY_CACHE_KEY);
  if (!raw) return null;

  try {
    const value = JSON.parse(raw);
    return value && typeof value === "object" ? value : null;
  } catch {
    throw new Error("Der zentrale Intraday-Cache enthält ungültige JSON-Daten.");
  }
}

async function writeIntradayStartCache(env, value) {
  const binding = env.INTRADAY_CACHE;
  if (!binding || typeof binding.put !== "function") {
    throw new Error("Cloudflare-KV-Binding INTRADAY_CACHE fehlt oder ist unvollständig.");
  }

  await binding.put(INTRADAY_CACHE_KEY, JSON.stringify(value), {
    expirationTtl: INTRADAY_CACHE_TTL_SECONDS
  });
}

async function fetchIntradayVixCandidate(acwiDate) {
  if (!isValidIsoDate(acwiDate)) {
    throw new Error("Das aktuelle ACWI-Datum für die Intraday-Zuordnung ist ungültig.");
  }
  const response = await fetch("https://feargreedchart.com/api/?action=all", {
    headers: { "Accept": "application/json" }
  });

  if (!response.ok) {
    throw new Error(`Intraday-VIX-Datenquelle nicht erreichbar (${response.status}).`);
  }

  const payload = await response.json();
  const market = payload?.market || {};
  const quote = market["^VIX"];
  const vix = Number(quote?.price);
  const timestampMs = Number(payload?.ts);

  if (!Number.isFinite(vix) || vix <= 0) {
    throw new Error("Die Datenquelle hat keinen gültigen VIX-Wert geliefert.");
  }

  if (!Number.isFinite(timestampMs) || timestampMs <= 0) {
    throw new Error("Die Datenquelle hat keinen verwendbaren Anbieter-Zeitstempel geliefert.");
  }

  // Die API dokumentiert einen Server-Zeitstempel in Millisekunden
  // und einen serverseitigen Cache von 15 Minuten. Eine großzügige
  // 30-Minuten-Grenze toleriert den Cache, weist aber deutlich veraltete
  // Antworten sowie unplausible Zukunftszeitstempel zurück.
  const now = Date.now();
  const maxAgeMs = 30 * 60 * 1000;
  const maxFutureSkewMs = 2 * 60 * 1000;

  if (timestampMs > now + maxFutureSkewMs) {
    throw new Error("Der Anbieter-Zeitstempel liegt unplausibel in der Zukunft.");
  }

  const timestampAgeMs = now - timestampMs;
  if (timestampAgeMs > maxAgeMs) {
    throw new Error(
      "Die Intraday-VIX-Datenquelle liefert einen veralteten Server-Zeitstempel. Alter in Minuten: " +
      Math.round(timestampAgeMs / 60000)
    );
  }

  const timestamp = new Date(timestampMs).toISOString();
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${acwiDate}|${vix.toFixed(6)}|${timestamp}`)
  );
  const id = Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");

  return { id, vix, timestamp, acwiDate };
}

async function githubGetFileWithSha(env, path) {
  const response = await githubRequest(
    env,
    `/repos/${OWNER}/${REPO}/contents/${path}`,
    { method: "GET" }
  );

  if (response.status === 404) return null;

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub konnte ${path} nicht lesen (${response.status}): ${text.slice(0, 300)}`);
  }

  const value = await response.json();

  if (!value.content || !value.sha) {
    throw new Error(`GitHub-Antwort für ${path} ist unvollständig.`);
  }

  return {
    sha: value.sha,
    content: value.content.replace(/\n/g, "")
  };
}

async function githubRequest(env, path, options = {}) {
  const jwt = await createGitHubAppJwt(env);
  const installation = await findInstallation(jwt);

  const tokenResponse = await fetch(
    `${GITHUB_API}/app/installations/${installation.id}/access_tokens`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${jwt}`,
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "Marktkompass-Bridge"
      }
    }
  );

  if (!tokenResponse.ok) {
    const text = await tokenResponse.text();
    throw new Error(`GitHub-Installationstoken konnte nicht erzeugt werden (${tokenResponse.status}): ${text.slice(0, 300)}`);
  }

  const token = (await tokenResponse.json()).token;

  return fetch(`${GITHUB_API}${path}`, {
    ...options,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "Marktkompass-Bridge",
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
}

async function findInstallation(jwt) {
  const response = await fetch(`${GITHUB_API}/app/installations`, {
    headers: {
      "Authorization": `Bearer ${jwt}`,
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "Marktkompass-Bridge"
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub-Installationen konnten nicht gelesen werden (${response.status}): ${text.slice(0, 300)}`);
  }

  const installations = await response.json();
  const match = installations.find(item => item.account?.login === OWNER);

  if (!match) {
    throw new Error(`Keine GitHub-App-Installation für ${OWNER} gefunden.`);
  }

  return match;
}

async function createGitHubAppJwt(env) {
  const appId = String(env.GITHUB_APP_ID || "").trim();
  const privateKeyPem = String(env.GITHUB_APP_PRIVATE_KEY || "").trim();

  if (!appId || !privateKeyPem) {
    throw new Error("Cloudflare-Secrets GITHUB_APP_ID / GITHUB_APP_PRIVATE_KEY fehlen.");
  }

  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64UrlEncode(JSON.stringify({ iat: now - 60, exp: now + 540, iss: appId }));
  const signingInput = `${header}.${payload}`;
  const key = await importGitHubPrivateKey(privateKeyPem);

  const signature = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    key,
    new TextEncoder().encode(signingInput)
  );

  return `${signingInput}.${base64UrlEncodeBytes(new Uint8Array(signature))}`;
}

async function importGitHubPrivateKey(pem) {
  const body = pem
    .replace(/-----BEGIN RSA PRIVATE KEY-----/g, "")
    .replace(/-----END RSA PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");

  const der = Uint8Array.from(atob(body), char => char.charCodeAt(0));
  const values = parsePkcs1RsaPrivateKey(der);

  const jwk = {
    kty: "RSA",
    n: base64UrlEncodeBytes(values.n),
    e: base64UrlEncodeBytes(values.e),
    d: base64UrlEncodeBytes(values.d),
    p: base64UrlEncodeBytes(values.p),
    q: base64UrlEncodeBytes(values.q),
    dp: base64UrlEncodeBytes(values.dp),
    dq: base64UrlEncodeBytes(values.dq),
    qi: base64UrlEncodeBytes(values.qi),
    alg: "RS256",
    ext: true,
    key_ops: ["sign"]
  };

  return crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

function parsePkcs1RsaPrivateKey(der) {
  let offset = 0;

  function readLength() {
    const first = der[offset++];
    if (first < 0x80) return first;

    const count = first & 0x7f;
    if (count === 0 || count > 4) {
      throw new Error("Ungültige DER-Länge im GitHub Private Key.");
    }

    let length = 0;
    for (let i = 0; i < count; i++) {
      length = (length << 8) | der[offset++];
    }
    return length;
  }

  function readInteger() {
    if (der[offset++] !== 0x02) {
      throw new Error("Ungültige RSA-Private-Key-Struktur.");
    }

    const length = readLength();
    const value = der.slice(offset, offset + length);
    offset += length;

    let start = 0;
    while (start < value.length - 1 && value[start] === 0) start++;
    return value.slice(start);
  }

  if (der[offset++] !== 0x30) {
    throw new Error("GitHub Private Key ist keine DER-Sequenz.");
  }

  readLength();

  const version = readInteger();
  if (version.length !== 1 || version[0] !== 0) {
    throw new Error("Nicht unterstützte RSA-Private-Key-Version.");
  }

  return {
    n: readInteger(),
    e: readInteger(),
    d: readInteger(),
    p: readInteger(),
    q: readInteger(),
    dp: readInteger(),
    dq: readInteger(),
    qi: readInteger()
  };
}

function base64UrlEncode(value) {
  return base64UrlEncodeBytes(new TextEncoder().encode(value));
}

function base64UrlEncodeBytes(bytes) {
  let binary = "";
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64ToUtf8(value) {
  const binary = atob(value);
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function isValidIsoDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value;
}
