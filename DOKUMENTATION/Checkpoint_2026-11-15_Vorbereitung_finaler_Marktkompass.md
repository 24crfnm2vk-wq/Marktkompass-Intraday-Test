# Marktkompass – Meilenstein-Checkpoint 15.11.2026
## Vorbereitung des finalen Marktkompass-Projekts

**Dokumentstatus:** Verbindlicher Vorbereitungs- und Wiedereinstiegsstand  
**Stichtag:** 15.11.2026  
**Projekt:** Marktkompass / isolierter Intraday-VIX-Test  
**Produktivversion:** V25.1.0 – unverändert und geschützt  
**Freigabestatus:** Noch keine Freigabe zur Integration

---

## 1. Bedeutung dieses Meilensteins

Der am 15.11.2026 erreichte Stand wird als Vorbereitung des späteren finalen Marktkompass-Projekts festgehalten. Die technische Testphase hat einen wichtigen Reifegrad erreicht: Die getrennte Testseite wurde vom Nutzer sowohl auf iOS als auch auf einem Windows-PC erfolgreich geprüft.

Diese Bestätigung ist ein positives praktisches Testergebnis. Sie ist noch keine abschließende Integrationsfreigabe. Vor einer möglichen Übernahme in den produktiven Marktkompass folgen:
1. eine weitere Beobachtungsphase von zwei bis drei Tagen,
2. eine abschließende gemeinsame Beurteilung der Stabilität und Darstellung,
3. eine gesonderte gemeinsame Diskussion und Bewertung der Sicherheitsaspekte,
4. erst danach eine ausdrückliche Entscheidung über eine mögliche Integration.

**Bis zu dieser Entscheidung bleibt die produktive Marktkompass-Version unangetastet.**

## 2. Am 15.11.2026 praktisch bestätigter Stand

Der Nutzer hat die öffentliche isolierte Testseite am 15.11.2026 auf zwei unterschiedlichen Plattformen geprüft:
- iOS
- Windows-PC

Nach seiner Rückmeldung liefen beide Tests ausnahmslos erfolgreich.

Der vorgelegte Screenshot dokumentiert folgende Anzeige:
- Marktstatus: NORMAL
- Version: V25.1.0
- Datenstand: 2026-11-12
- MSCI ACWI: 1116.27 Punkte
- SMA200: 1096.35 Punkte
- Abstand zur SMA200: +1.82 %
- VIX regulär: 18.70 Punkte
- VIX-Tagesveränderung: +6.92 %
- Intraday-VIX: 19.30 Punkte
- Abweichung zum letzten VIX-Schlusskurs: +3.21 %
- Anbieter-Zeitstempel: 15.11.2026, 14:45

Die Trendgrafik zeigt die letzten 50 gemeinsamen Handelstage. ACWI und SMA200 verwenden dieselbe Skala; der reguläre VIX und der zusätzliche Intraday-VIX werden auf der eigenen VIX-Skala dargestellt. Der Intraday-Messpunkt ist durch eine vertikale violette Markierung, einen hervorgehobenen Punkt und eine Beschriftung deutlich erkennbar.

Die sichtbare Erläuterung stellt klar, dass ACWI und SMA200 dieselbe Linie/Skala verwenden und der VIX eine eigene rechte Skala besitzt.

**Einordnung:** Der Screenshot und die Rückmeldung des Nutzers belegen die erfolgreiche Bedien- und Darstellungsprüfung auf iOS und Windows. Eine unabhängige Live-Prüfung der Worker-Laufzeit durch externe Werkzeuge ist damit nicht gleichzusetzen und wird hier nicht behauptet.

## 3. Verbindliche fachliche Festlegung zum Intraday-VIX

Der Intraday-VIX bleibt ausschließlich eine ergänzende, vorläufige Beobachtungsinformation zwischen regulären Handelstagen.

- Die Marktkompass-Berechnungen beruhen ausschließlich auf regulären Schlusskursen von ACWI und VIX.
- Der Intraday-VIX verändert weder ACWI noch SMA200.
- Er erzeugt keinen zusätzlichen historischen Handelstag.
- Er ist kein Kauf- oder Verkaufssignal.
- Er wird nicht in die reguläre Stress- oder Referenzberechnung übernommen.
- Es wird keine Intraday-Historie aufgebaut.
- Es erfolgt keine gesonderte dauerhafte Erfassung oder Protokollierung von Intraday-Messungen.
- Der vorhandene technische Kurzzeit-Cache der isolierten Testumgebung bleibt davon unberührt; er ist keine fachliche Intraday-Historie.

Diese Festlegung vom 15.11.2026 ergänzt und ersetzt insoweit ältere Formulierungen im Checkpoint vom 14.11.2026, die noch eine Protokollierung oder mehrwöchige systematische Erfassung von Intraday-Messungen vorsahen. Diese ältere Planung ist nicht mehr maßgeblich.

## 4. Systemtrennung und Schutzgrenzen

Bis zu einer ausdrücklichen Integrationsentscheidung gelten unverändert:
- Produktive Marktkompass-Berechnungslogik V25.1.0 bleibt unverändert.
- Historische Referenzlogik bleibt unverändert.
- Produktiver Cloudflare-Worker `bitter-mountain-11f4` bleibt unangetastet.
- Alle weiteren Beobachtungen und etwaigen Korrekturen erfolgen ausschließlich in der getrennten Testumgebung.
- Testrepository: `24crfnm2vk-wq/Marktkompass-Intraday-Test`.
- Test-Worker: `marktkompass-intraday-test`.
- Die Testumgebung darf keine produktiven Berechnungen oder Daten verändern.

## 5. Sicherheitsbewertung – ausdrücklich noch offen

Vor einer möglichen Integration wird der Sicherheitsaspekt gemeinsam und gesondert diskutiert. Die Diskussion ist ein notwendiger Entscheidungsschritt und wurde mit diesem Checkpoint noch nicht abgeschlossen.

Zu prüfen und gemeinsam zu entscheiden sind insbesondere:
- Welche Daten und Endpunkte werden zwischen Browser, Test-Worker und Datenquellen übertragen?
- Welche Zugriffsrechte benötigt der Worker tatsächlich?
- Wie werden GitHub-App-Schlüssel und sonstige Secrets geschützt und begrenzt?
- Welche Schreibrechte bestehen im Test-Worker und welche bleiben technisch ausgeschlossen?
- Wie werden Cache, Zeitstempel und veraltete Anbieterwerte behandelt?
- Welche Risiken entstehen bei Ausfall, Manipulation oder fehlerhaften Daten der externen Intraday-Quelle?
- Welche zusätzlichen Risiken entstünden durch eine spätere Integration in den produktiven Marktkompass?
- Welche Schutzmaßnahmen und Abnahmekriterien müssen vor einer Integration erfüllt sein?

Die Sicherheitsprüfung darf nicht als bereits bestanden oder abgeschlossen dargestellt werden. Es wird keine Integration vorgenommen, bevor die offenen Punkte gemeinsam bewertet und die erforderlichen Schutzmaßnahmen festgelegt wurden.

## 6. Nächster Ablauf und Freigabekriterien

### Phase A – Beobachtung (ab 15.11.2026)
Dauer: zunächst zwei bis drei Tage.

Ziel:
- Testseite bei Gelegenheit auf iOS und Windows erneut öffnen.
- Auf stabile Anzeige und nachvollziehbare Aktualität achten.
- Bei Auffälligkeiten Screenshot und Zeitpunkt festhalten.
- Keine unnötigen Änderungen oder Wiederholung bereits erfolgreicher technischer Prüfungen.

### Phase B – Abschließende Beurteilung
Nach der Beobachtungsphase wird gemeinsam beurteilt, ob der heutige positive Eindruck bestätigt wurde und ob noch konkrete technische Mängel bestehen.

### Phase C – Sicherheitsdiskussion
Vor jeder Integrationsentscheidung werden die Sicherheitsfragen aus Abschnitt 5 gemeinsam besprochen. Offene Risiken, erforderliche Schutzmaßnahmen und Verantwortlichkeiten werden dokumentiert.

### Phase D – Integrationsentscheidung
Eine Integration in den produktiven Marktkompass erfolgt nur, wenn:
1. die Beobachtungsphase positiv bewertet wurde,
2. die Sicherheitsprüfung gemeinsam abgeschlossen ist,
3. notwendige Schutzmaßnahmen festgelegt und umsetzbar sind,
4. der Nutzer die Integration ausdrücklich freigibt.

Bis dahin gilt: **Testbetrieb ja – Produktivintegration nein.**

## 7. Aufgaben und Verantwortlichkeiten

**ChatGPT übernimmt:**
- diesen Meilenstein dokumentieren,
- die spätere Abschlussbeurteilung anhand der Nutzer-Rückmeldungen und Screenshots unterstützen,
- die Sicherheitsfragen methodisch strukturieren,
- mögliche Änderungen vor einer Umsetzung auf Auswirkungen auf die Produktivversion prüfen.

**Der Nutzer übernimmt:**
- die Testseite in den nächsten zwei bis drei Tagen bei Gelegenheit erneut auf iOS und Windows prüfen,
- Auffälligkeiten oder Screenshots mitteilen,
- an der gemeinsamen Sicherheitsbewertung und der abschließenden Integrationsentscheidung mitwirken.

Es sind derzeit keine Änderungen durch den Nutzer in GitHub, VS Code oder Cloudflare erforderlich.

## 8. Verbindliche Wiedereinstiegsformulierung

> **Wiedereinstieg Marktkompass – Vorbereitungsstand 15.11.2026**
>
> Bitte verwende den Checkpoint „Marktkompass – Meilenstein-Checkpoint 15.11.2026“ als verbindliche Ausgangsbasis.
>
> Die isolierte Intraday-VIX-Testseite wurde am 15.11.2026 vom Nutzer auf iOS und Windows-PC erfolgreich geprüft. Der Screenshot bestätigt die Darstellung des Status, der regulären ACWI-/SMA200-/VIX-Werte, der gemeinsamen 50-Handelstage-Trendgrafik und des hervorgehobenen zusätzlichen Intraday-VIX-Messpunkts.
>
> Der heutige Stand ist die Vorbereitung des finalen Marktkompass-Projekts, aber noch keine Integrationsfreigabe. Zunächst folgt eine Beobachtungsphase von zwei bis drei Tagen. Danach erfolgt eine gemeinsame Abschlussbeurteilung. Vor jeder möglichen Integration muss der Sicherheitsaspekt nochmals gemeinsam diskutiert und bewertet werden.
>
> Die produktive Marktkompass-Version V25.1.0 einschließlich Berechnungs- und historischer Referenzlogik bleibt unverändert. Der produktive Cloudflare-Worker `bitter-mountain-11f4` bleibt unangetastet. Alle Arbeiten verbleiben bis zur ausdrücklichen Freigabe in der getrennten Testumgebung.
>
> Es wird keine Intraday-Historie und keine dauerhafte Intraday-Messwertprotokollierung aufgebaut. Der Intraday-VIX bleibt eine temporäre ergänzende Beobachtungsinformation und verändert keine regulären Berechnungen.
>
> Bitte beginne mit der Beobachtungsphase. Keine vorgezogene Produktivintegration und keine unnötige Wiederholung erfolgreich abgeschlossener Tests.

## 9. Abschlussvermerk

**Stichtag:** 15.11.2026  
**Ergebnis:** Erfolgreiche Nutzerprüfung auf iOS und Windows-PC; sichtbarer App-Stand dokumentiert.  
**Projektphase:** Vorbereitung des finalen Marktkompass-Projekts.  
**Noch offen:** Zwei- bis dreitägige Beobachtung, gemeinsame Abschlussbeurteilung und Sicherheitsdiskussion.  
**Produktivsystem:** Unverändert und nicht zur Integration freigegeben.

Dieser Checkpoint ist ab dem 15.11.2026 die maßgebliche Fortsetzungsgrundlage. Er ergänzt den Checkpoint vom 14.11.2026 und hat bei abweichenden Aussagen Vorrang.


## 10. Ergänzende Nutzerentscheidung – Berechtigungsmodell (15.11.2026)

Der Nutzer hat das vorgeschlagene Nutzungskonzept ausdrücklich bestätigt:

- Der Marktkompass ist grundsätzlich ein persönliches System des Nutzers.
- Eine spätere, optionale Freigabe für höchstens zwei bis vier weitere Familienmitglieder soll technisch möglich sein.
- Familienmitglieder erhalten ausschließlich Lese- und Nutzungsrechte.
- Familienmitglieder erhalten keinerlei administrative Berechtigungen.
- Sie dürfen insbesondere keine Berechnungsregeln, Systemeinstellungen, Datenquellen, Programmdateien oder Veröffentlichungen verändern.
- Administrations- und Freigaberechte verbleiben ausschließlich beim Nutzer.
- Die Familienzugänge werden zum jetzigen Zeitpunkt noch nicht eingerichtet. Die Möglichkeit wird lediglich bei der Planung der Sicherheitsarchitektur berücksichtigt.
- Jeder mögliche Familienzugang soll später einzeln zuweisbar und bei Bedarf einzeln widerrufbar sein; gemeinsame Zugangsdaten für mehrere Personen sind nicht vorgesehen.

**Verbindliche Leitlinie:** Persönliche Nutzung durch den Eigentümer mit optionalen, individuell kontrollierten Nur-Lese-/Nutzungszugängen für maximal vier Familienmitglieder. Keine administrativen Rechte außerhalb des Eigentümerzugangs.

Diese Ergänzung dokumentiert eine Planungsentscheidung. Sie ist weder eine Freigabe zur technischen Umsetzung noch eine abgeschlossene Sicherheitsprüfung.
