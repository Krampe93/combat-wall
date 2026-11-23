# Combat Wall 1.1.6 und GM Combat Workspace 0.16.4

## Korrekturen

Die Encounter-Vorbereitung enthält direkt die vollständige Gruppe: Orsik, Nova Schaltkreis, Ray, Lichtwölkchen, Zane und Pyro. Dafür sind keine PC-Actors und keine vorher von Hand ergänzten Zeilen nötig. Bestehende Teilnehmer und gespeicherte Namen werden wiederverwendet, auch bei den bekannten Aliasnamen Nova, Ziggs oder Flab. Initiativewerte, Flags und ausdrücklich gespeicherte Abwahlen bleiben erhalten.

Orsik wurde als vorhandener Character-Actor erkannt; deshalb erschien er bereits vor den anderen als vorgegebener Eintrag. Die übrigen Gruppenmitglieder waren bisher nur verfügbar, wenn sie schon im Encounter oder in der gespeicherten Auswahl standen. Die feste Gruppe ergänzt jetzt alle fehlenden Namen. Das bloße Öffnen des Dialogs bleibt ohne Änderungen am Encounter; erst nach manueller Initiative-Eingabe und Bestätigung werden fehlende Placeholder angelegt.

Die Combat Wall leitete den Besiegt-Status auch bei Spielern aus den Actor-Trefferpunkten ab. Bei Papiercharakteren/Placeholdern sind diese Werte unbenutzt und können 0 sein. Automatisches Besiegt durch 0 HP gilt jetzt nur noch für Gegner. Spielerportraits bleiben in Spielerübersicht, Zugleiste und Fokus farbig. Ein bewusst gesetzter Besiegt-Status kann weiterhin als Text angezeigt werden. Gegner behalten ihre bisherige Besiegt-Darstellung.

Die Übersicht ohne Scrollbalken, der Ray-Alias, vollständige Fokusbilder und die Trennung von Spielern und Gegnerkacheln bleiben erhalten.

## Nach dem Update

1. Beide Module aktualisieren: Combat Wall 1.1.6 und GM Combat Workspace 0.16.4. Foundry-Hauptfenster neu laden und beide Dashboard-Fenster neu öffnen.
2. „Encounter vorbereiten“ öffnen: alle sechs Namen müssen direkt stehen. Keine zusätzlichen Zeilen von Hand anlegen. Für die teilnehmenden Spieler Initiative eintragen und bestätigen.
3. Vorbereitung erneut öffnen: keine doppelten Spieler; bisherige Initiativewerte müssen vorbelegt sein. Vorhandenes „Nova“ oder „Ziggs“ wird wiederverwendet; in der Combat Wall erscheint Ziggs weiterhin als Ray.
4. Orsik in Spielerübersicht, Zugleiste und Fokus prüfen: Portrait farbig, auch wenn sein hinterlegter Actor 0 Trefferpunkte hat.
5. Spielerzustände setzen/entfernen und einen Gegner mit 0 HP prüfen: Zustände aktualisieren sich live, die Gegnerdarstellung funktioniert weiterhin.

## Prüfung

- GM Combat Workspace: 193 Tests und Modulvalidierung erfolgreich; neue Fälle für die vollständige Standardgruppe, vorhandenen Orsik-Actor, Aliasnamen, bereits eingegebene Spieler und Wiederverwendung.
- Combat Wall: 39 Placeholder-/Portrait-Tests und 10 Zustandsintegrationstests sowie Syntax-, Versions- und Gegnerdarstellungsprüfungen erfolgreich. Native und als Placeholder gekennzeichnete Orsik-Einträge mit 0 HP werden geprüft; Gegner mit 0 HP bleiben besiegt.
- Gemeinsamer Browsertest mit produktiven Dateien: nur Orsik-Actor plus leerer Encounter und leere gespeicherte Liste → echte Initiative-Abfrage enthält alle sechs Namen, alle vorgewählt. Bestehender Fünfer-Encounter → Pyro ergänzen und korrekt übernehmen ebenfalls erfolgreich.
- Farbdarstellung bei Orsik mit 0 HP und zusätzlicher manueller Besiegt-Markierung in Übersicht, Zugleiste und Fokus geprüft. Darstellung bei 1920×1080 und 1366×768, Zustandstexte ohne Scrollbalken und bisherige Live-Zustandsabläufe erfolgreich.
- Die direkte Gegenprobe in der laufenden Foundry-Welt steht noch aus.
