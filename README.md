# Marktkompass – isolierte Intraday-Testseite

Dieses Repository ist ausschließlich für eine getrennte Online-Testseite vorgesehen.

- Keine produktiven Marktkompass-Berechnungen und keine Änderung an V25.1.0.
- Der veröffentlichte Marktstatus wird separat angezeigt.
- Der Test-Worker liefert bis zu 50 gemeinsame ACWI-/VIX-Handelstage einschließlich neu berechneter SMA200-Reihe ausschließlich lesend für die Trenddarstellung.
- Ein aktueller Intraday-VIX-Kandidat wird separat abgefragt und als vorläufiger VIX-Messpunkt in derselben Zeitachse ergänzt.
- Intraday verändert weder historische Tagesreihen noch ACWI- oder SMA200-Werte.
- Der Worker schreibt ausschließlich in den separaten 15-Minuten-Test-KV-Cache.
- Die Testseite bestätigt, speichert oder berechnet keinen Intraday-Kandidaten in V25.1 neu.

Die Testseite ist keine Produktivversion und kein Kauf- oder Verkaufssignal.
