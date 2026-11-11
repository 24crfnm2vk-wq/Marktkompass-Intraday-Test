(() => {
  const WORKER = "https://bitter-mountain-11f4.24crfnm2vk.workers.dev";
  const status = document.getElementById("intraday-preview-status");
  const data = document.getElementById("intraday-preview-data");

  async function check() {
    status.textContent = "Lese aktuellen Intraday-Kandidaten …";
    data.replaceChildren();
    try {
      const response = await fetch(`${WORKER}/intraday-candidate?t=${Date.now()}`, { cache: "no-store" });
      const candidate = await response.json().catch(() => null);
      if (!response.ok) throw new Error(candidate?.error || `HTTP ${response.status}`);
      if (candidate?.version !== "intraday-vix-candidate-v1") throw new Error("Unerwartetes Antwortformat.");
      if (candidate.available !== true) {
        status.textContent = candidate.message || "Derzeit ist kein Intraday-Kandidat verfügbar. Möglicherweise hat der reguläre Schlusskurs Vorrang.";
        return;
      }
      const rows = [
        ["Intraday-VIX", Number(candidate.vix).toFixed(2) + " Punkte"],
        ["Zeitstempel des Anbieters", candidate.timestamp || "–"],
        ["Zugehöriger ACWI-Datenstand", candidate.acwiDate || "–"],
        ["ACWI-Schlusswert", Number(candidate.acwiClose).toFixed(2) + " Punkte"],
        ["15-Minuten-Cooldown", candidate.cooldownActive ? "Aktiv" : "Nicht aktiv"]
      ];
      const table = document.createElement("dl");
      for (const [label, value] of rows) {
        const dt = document.createElement("dt"); dt.textContent = label;
        const dd = document.createElement("dd"); dd.textContent = value;
        table.append(dt, dd);
      }
      data.append(table);
      status.textContent = "Live-Abfrage erfolgreich. Dieser Wert wurde nur gelesen und NICHT berechnet oder veröffentlicht.";
    } catch (error) {
      status.textContent = "Live-Abfrage derzeit nicht möglich: " + (error instanceof Error ? error.message : String(error));
    } finally {
    }
  }
  check();
})();