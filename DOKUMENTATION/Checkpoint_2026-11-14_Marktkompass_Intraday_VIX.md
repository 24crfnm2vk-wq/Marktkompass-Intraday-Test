# Marktkompass – Projekt-Checkpoint 14.11.2026
## Intraday-VIX-Test und App-Stand seit 11.11.2026

**Dokumentstatus:** Verbindlicher Wiedereinstiegs- und Arbeitsstand  
**Stichtag:** 14.11.2026  
**Projekt:** Marktkompass / isolierter Intraday-VIX-Test  
**Produktivversion:** V25.1.0 – unverändert und geschützt

---

## 1. Zweck und Ziel des Intraday-VIX-Tests

Der Intraday-VIX-Test ist ein zeitlich begrenzter technischer Beobachtungstest. Er soll untersuchen, ob Intraday-VIX-Messungen an Wochenenden und Feiertagen zusätzliche Informationen über Marktbewegungen liefern können, wenn keine neuen regulären gemeinsamen ACWI-/VIX-Schlusskurse vorliegen.

Der Test ist **keine neue Marktstrategie**, erzeugt keine Kauf- oder Verkaufssignale und führt keine automatisierten Handelsaktionen aus. Erst nach einer ausreichenden Beobachtungsphase wird gemeinsam entschieden, ob und in welcher Form eine Integration in den Marktkompass sinnvoll ist.

Die bewährte Marktkompass-Berechnungslogik V25.1.0 ist ausdrücklich nicht Gegenstand dieses Tests.

## 2. Verbindliche Systemtrennung und Schutzregeln

- Der Intraday-Test läuft ausschließlich in einer getrennten Testumgebung.
- Produktiver Cloudflare Worker `bitter-mountain-11f4` bleibt unangetastet.
- Der separate Test-Worker heißt `marktkompass-intraday-test`.
- Der Test-Worker verwendet das eigene KV-Namespace `marktkompass-intraday-cache`, Binding `INTRADAY_CACHE`.
- Testrepository: `24crfnm2vk-wq/Marktkompass-Intraday-Test`, Branch `main`.
- Produktiv-Repositories und deren `main`-Branches werden durch den Test nicht verändert.
- Die Testseite liest den veröffentlichten Marktstatus und die historischen Daten; sie verändert keine produktiven Marktkompass-Daten.
- Einzige vorgesehene Schreiboperation des Test-Workers ist der 15-Minuten-Cache im separaten Test-KV.
- Die reguläre gemeinsame ACWI-/VIX-Schlusskursveröffentlichung hat immer Vorrang.

## 3. Datenquelle und Intraday-Prüfregeln

**Datenquelle:** `https://feargreedchart.com/api/?action=all`  
**VIX-Feld:** `market["^VIX"].price`  
**Zeitstempel:** `ts` in Millisekunden; dies ist der Antwort-/Serverzeitstempel der API und keine garantierte exakte Kurszeit.

Prüfregeln:
- VIX-Wert muss numerisch, endlich und größer als null sein.
- Anbieter-Zeitstempel darf höchstens 30 Minuten alt sein.
- Ein Zeitstempel maximal zwei Minuten in der Zukunft wird toleriert; größere Abweichungen werden abgewiesen.
- Der Messpunkt wird mit dem letzten veröffentlichten regulären ACWI-Datenstand verbunden.
- Der Intraday-Messpunkt erzeugt keinen zusätzlichen historischen Handelstag.
- ACWI-Schlusskurs und SMA200 bleiben beim letzten regulären ACWI-Punkt.
- Eine neuere Intraday-Messung ersetzt die vorherige provisorische Messung.
- Ein neuer regulärer gemeinsamer ACWI-/VIX-Schlusskurs ersetzt die Intraday-Ergänzung.
- Pro Messung werden VIX-Wert, Anbieter-Zeitstempel und ACWI-Referenz protokolliert.
- Identische Messpunkte sollen nicht mehrfach gespeichert werden.
- Zentrale Abfragebegrenzung: 15-Minuten-Cooldown. Neue reguläre ACWI-Daten können eine erneute Abfrage ermöglichen.
- Die Intraday-Abfrage wird beim Öffnen der Testseite ausgelöst; es gibt keinen festen Abrufzeitplan.
- Das fünfsekündige Polling der öffentlichen Testseite aktualisiert nur die Anzeige von `status.json`; es löst selbst keine Worker-Abfrage oder Neuberechnung aus.

## 4. Darstellung der gemeinsamen Trendkurve

Die Kurve soll mindestens 30, vorzugsweise 50 gemeinsame historische ACWI-/VIX-Handelstage enthalten. Der neueste Punkt muss sichtbar sein.

Darstellungsregeln:
- ACWI und SMA200 verwenden dieselbe vertikale Werteskala.
- VIX verwendet eine eigene vertikale Werteskala.
- Alle Reihen teilen dieselbe Zeitachse.
- Es handelt sich um eine Trenddarstellung; absolute Werte unterschiedlicher Skalen werden nicht geometrisch miteinander gleichgesetzt.
- Ein Intraday-VIX-Punkt darf ergänzt werden.
- ACWI und SMA200 werden für diesen Intraday-Punkt nicht fortgeschrieben oder geschätzt.

## 5. Chronologie und App-Entwicklung seit 11.11.2026

### 11.11.2026 – Ausgangslage und getrennte Testumgebung
- Das separate Testrepository und die getrennte Testseite wurden vorbereitet bzw. weiterentwickelt.
- Der Intraday-Test-Worker war separat vorhanden.
- Die Testumgebung blieb von der produktiven V25.1.0 getrennt.
- Die Testseite zeigte den veröffentlichten Marktstatus und eine separate Intraday-VIX-Live-Abfrage.
- Die gemeinsame Trenddarstellung war zu diesem Zeitpunkt noch nicht erfolgreich in der sichtbaren Testseite verfügbar.

### 14.11.2026 – Worker- und Datenprüfung
- Der separate Test-Worker wurde geprüft und um den Endpunkt `/chart-history` ergänzt.
- Der Endpunkt liefert die letzten 50 gemeinsamen ACWI-/VIX-Handelstage einschließlich SMA200.
- Die JSON-Ausgabe bestätigte:
  - `available: true`
  - `count: 50`
  - `firstDate: 2026-09-03`
  - `latestDate: 2026-11-12`
- Der letzte reguläre Punkt vom 12.11.2026:
  - ACWI: 1116.270728
  - SMA200: 1096.35437783
  - VIX: 18.7
- Der SMA200-Wert stimmt mit dem veröffentlichten V25.1.0-Status überein.
- Der Indexbereich der JSON-Liste läuft von 0 bis 49. Das sind 50 Datensätze, nicht 49.

### 14.11.2026 – Ursache für fehlende Kurve und Korrektur
- Die veröffentlichte Testseite zeigte zunächst „Die gemeinsame Trenddarstellung ist derzeit nicht verfügbar“.
- Der direkte Aufruf des Worker-Endpunkts `/chart-history` ergab zunächst `Not found`.
- Ursache: Die aktuelle Worker-Datei im GitHub-Testrepository enthielt den neuen Endpunkt, die laufende Cloudflare-Test-Worker-Version jedoch noch nicht.
- Die GitHub-Actions-Prüfung für die Worker-Datei war erfolgreich; Syntaxprüfung und Read-only-Prüfung bestanden.
- Die vollständige Datei `worker-intraday-test.js` wurde aus GitHub über Raw kopiert und im bestehenden Cloudflare-Test-Worker eingesetzt.
- Im Cloudflare-Editor wurde `/chart-history` dreimal gefunden; der Editor zeigte null Fehler und null Warnungen.
- Die Version wurde gespeichert und anschließend bereitgestellt.
- Der direkte Aufruf von `/chart-history` lieferte danach wieder die 50 historischen Punkte. Damit war der Worker-Endpunkt aktualisiert und erreichbar.

### 14.11.2026 – Erfolgreicher sichtbarer App-Test
Die öffentliche Testseite wurde mit hartem Neuladen (`Strg + F5`) erneut geöffnet. Der abschließende Screenshot bestätigte:

- Marktstatus NORMAL, Version V25.1.0, Datenstand 12.11.2026.
- MSCI ACWI: 1116.27 Punkte.
- SMA200: 1096.35 Punkte.
- Abstand zur SMA200: +1.82 %.
- VIX regulär: 18.70 Punkte.
- VIX-Tagesveränderung: +6.92 %.
- Überschrift: „Marktverlauf – letzte 50 gemeinsame Handelstage“.
- Die gemeinsame ACWI-/SMA200-/VIX-Trendkurve wird sichtbar gerendert.
- Legende unterscheidet MSCI ACWI, SMA200, VIX regulär und VIX Intraday.
- Der Text unter der Grafik erläutert, dass ACWI und SMA200 unverändert am letzten regulären ACWI-Handelstag enden und der VIX eine eigene Skala verwendet.
- Die separate Intraday-VIX-Live-Abfrage ist weiterhin sichtbar und als nur lesend gekennzeichnet.
- Im Screenshot wurde ein Intraday-VIX von 19.30 Punkten mit Anbieter-Zeitstempel und ACWI-Bezugstag 12.11.2026 angezeigt.

**Ergebnis:** Die getrennte Testseite zeigt jetzt die gemeinsame historische Trendkurve und ergänzt den Intraday-VIX als vorläufigen Messpunkt. Der technische Hauptmeilenstein des Tages ist erreicht.

## 6. Technische Komponenten und bekannte Adressen

**Testseite:**  
`https://24crfnm2vk-wq.github.io/Marktkompass-Intraday-Test/`

**Test-Worker:**  
`https://marktkompass-intraday-test.24crfnm2vk.workers.dev`

**Worker-Endpunkte:**
- `/health` – Statusprüfung
- `/chart-history` – bis zu 50 gemeinsame historische ACWI-/VIX-Punkte einschließlich SMA200
- `/intraday-candidate` – separater Intraday-VIX-Kandidat

**Wichtige Dateien im Testrepository:**
- `app.js` – Darstellung und Abruf der Testdaten
- `worker-intraday-test.js` – separater Test-Worker
- `index.html` – Testseite
- `style.css` – Darstellung
- `status.json` – veröffentlichter V25.1.0-Status als Testseiten-Eingangsdaten
- `.github/workflows/deploy-pages.yml` – automatische Veröffentlichung der Testseite
- `.github/workflows/package-intraday-worker.yml` – Syntax-/Read-only-Prüfung und Paketbildung

## 7. Was ist abgeschlossen – was bleibt offen?

### Technisch abgeschlossen und nachgewiesen
- Getrennte Testumgebung.
- Separater Test-Worker und separates KV-Binding.
- Intraday-VIX-Live-Abfrage.
- 15-Minuten-Cooldown.
- Zuordnung des Intraday-VIX zum letzten regulären ACWI-Datenstand.
- Historischer Kurvendaten-Endpunkt mit 50 gemeinsamen Punkten.
- Korrekte ACWI-/SMA200-Berechnung im historischen Kurvendatensatz.
- Bereitstellung des aktualisierten Test-Workers.
- Sichtbare gemeinsame Trendkurve auf der öffentlichen Testseite.
- Sichtbare Trennung zwischen regulärem VIX und Intraday-VIX.
- Produktive V25.1.0 blieb unverändert.

### Noch offen – Beobachtungsphase
- Über mehrere Wochenenden und Feiertage beobachten, ob der Intraday-VIX zusätzliche Informationen liefert.
- Prüfen, wie oft und in welcher Größenordnung sich der Intraday-Wert verändert.
- Prüfen, ob der zusätzliche Messpunkt gegenüber dem letzten regulären Schlusskurs tatsächlich einen nachvollziehbaren Erkenntnisgewinn bietet.
- Stabilität der Abfrage, Zeitstempel und Cooldown im laufenden Test beobachten.
- Erst nach ausreichender Beobachtung gemeinsam entscheiden, ob eine Integration in Marktkompass sinnvoll ist.

Keine neue Berechnungslogik und keine produktive Integration vor dieser gemeinsamen Entscheidung.

## 8. Verbindliche Schutz- und Arbeitsregeln für die Fortsetzung

1. V25.1.0-Berechnungslogik und historische Referenzmethodik bleiben unverändert.
2. Produktiver Worker `bitter-mountain-11f4` bleibt unangetastet.
3. Änderungen erfolgen ausschließlich in der getrennten Intraday-Testumgebung.
4. ACWI-/SMA200-Werte werden nicht aus Intraday-VIX-Daten abgeleitet oder fortgeschrieben.
5. Intraday bleibt eine vorläufige Beobachtung, kein Handelssignal.
6. Keine automatische Übernahme des Intraday-Wertes in produktive Marktkompass-Berechnungen.
7. Vor jeder weiteren Änderung werden Ziel, betroffene Datei und Testumgebung eindeutig benannt.
8. Für jeden Schritt wird klar angegeben, was ChatGPT übernimmt und was der Nutzer wo ausführen muss.
9. Bereits erfolgreich abgeschlossene Prüfungen werden nicht ohne konkreten Anlass wiederholt.
10. Änderungen an Projektdateien werden möglichst als vollständiges Paket mit nachvollziehbarer Ordnerstruktur bereitgestellt.

## 9. Korrekte Wiedereinstiegsformulierung für einen neuen Chat

Den folgenden Text vollständig in einen neuen Chat kopieren:

> **Wiedereinstieg Marktkompass – Intraday-VIX-Test, Stand 14.11.2026**
>
> Bitte verwende den Projekt-Checkpoint „Marktkompass – Projekt-Checkpoint 14.11.2026“ als verbindliche Ausgangsbasis.
>
> Der technische Meilenstein ist erreicht: Die separate öffentliche Testseite zeigt die gemeinsame Trendkurve der letzten 50 ACWI-/SMA200-/VIX-Handelstage. Der separate Cloudflare-Test-Worker liefert den Endpunkt `/chart-history` erfolgreich. Zusätzlich wird ein Intraday-VIX-Kandidat als vorläufiger Messpunkt angezeigt und dem letzten regulären ACWI-Datenstand zugeordnet.
>
> Der Intraday-VIX-Test dient ausschließlich der Beobachtung, ob Intraday-Messungen an Wochenenden und Feiertagen einen zusätzlichen Erkenntnisgewinn gegenüber regulären gemeinsamen ACWI-/VIX-Schlusskursen liefern. Nach einer ausreichenden Beobachtungsphase entscheiden wir gemeinsam, ob eine Integration sinnvoll ist.
>
> **Unverhandelbare Grenzen:** Die produktive Marktkompass-Version V25.1.0 einschließlich Berechnungslogik und historischer Referenzmethodik bleibt unverändert. Der produktive Cloudflare-Worker `bitter-mountain-11f4` bleibt unangetastet. Alle weiteren Arbeiten erfolgen ausschließlich in der getrennten Testumgebung `Marktkompass-Intraday-Test` und im Worker `marktkompass-intraday-test`.
>
> Bitte beginne nicht mit einer Neuentwicklung und wiederhole keine bereits erfolgreich abgeschlossenen Prüfungen. Fahre mit der Beobachtungsphase und einer systematischen Dokumentation der Intraday-Messungen fort.
>
> Erkläre bei jedem notwendigen Schritt klar: Was übernimmst du, was muss ich tun und wo? Halte meine eigenen technischen Handgriffe möglichst gering. Bevorzuge vollständige, nachvollziehbar strukturierte Dateien bzw. ZIP-Pakete, wenn Änderungen erforderlich werden.
>
> Der aktuelle App-Stand ist durch den Screenshot vom 14.11.2026 belegt: Status NORMAL, V25.1.0-Datenstand 12.11.2026, sichtbare 50-Punkte-Trendkurve und separate Intraday-VIX-Live-Abfrage.

## 10. Abschlussvermerk

**Stichtag:** 14.11.2026  
**Erreichter App-Punkt:** Öffentliche, getrennte Intraday-Testseite mit funktionierender gemeinsamer 50-Punkte-Trenddarstellung und zusätzlichem Intraday-VIX-Messpunkt.  
**Produktivsystem:** Unverändert.  
**Nächster Arbeitsschwerpunkt:** Beobachtungsphase über Wochenenden/Feiertage, keine weitere Architektur- oder Strategieneuentwicklung.

Dieser Checkpoint ist die maßgebliche Fortsetzungsgrundlage, bis ein späterer datierter Checkpoint ihn ausdrücklich ergänzt oder ersetzt.
