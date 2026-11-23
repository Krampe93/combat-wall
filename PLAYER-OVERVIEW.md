# Combat Wall 1.1.7 und GM Combat Workspace 0.16.5

## Änderungen

- Alle nativen D&D5e-Zustände und Statusoptionen erscheinen deutsch in der Zustandsauswahl, Spielerübersicht, Fokusanzeige und den verknüpften Quellenanzeigen. Dazu gehören die bisher englischen Einträge Fallend, Halbe Deckung, Versteckt, Schwebend, Mangelernährt, Markiert, Verstummt, Schlafend, Stabil, Erstickend, Überrascht, Dreivierteldeckung, Volle Deckung und Verwandelt.
- Interne Zustands-IDs, Foundry-Mechanik und eigene gespeicherte Namen bleiben erhalten. Englische Namen von Actors und deren Aktionen sind Inhalte der Welt und werden nicht automatisch umbenannt.
- Weitere eigene Bedienbeschriftungen sind deutsch: Zug beenden, Werteblock, Platzhalter, Aufladen sowie die Rettungswurf-Kürzel ST, GE, KO, INT, WE und CHA.
- Fehlt ein Zustandsbild, bleibt die Anzeige textbasiert. Das goldene Portrait-Ersatzsymbol wird für Zustände nicht mehr verwendet. Generische Aura-/Mystery-Man-Symbole und das Combat-Wall-Ersatzbild werden verworfen. Kann ein angegebenes Zustandsbild nicht geladen werden, wird nur das Bild entfernt. Vorhandene echte Zustandsbilder bleiben nutzbar; Portraits behalten ihre bisherige Ersatzbildfunktion.
- Combat Wall ist jetzt die gemeinsame Quelle der Markerfarben. Die Minimap, Gegnerzeilen und Kartenmarkierungen des GM-Workspaces übernehmen denselben Farbwert für denselben Kampfteilnehmer. Der Wert folgt der stabilen Gruppenzuordnung, statt separat nach der GM-Listenreihenfolge berechnet zu werden. Die gleichen Farben können wie bisher in verschiedenen Gegnergruppen vorkommen.
- Farbänderungen werden vom Hauptfenster an das GM-Dashboard weitergegeben. Veraltete Farben aus einem anderen Encounter, einer anderen Szene oder einem entfernten Eintrag werden zurückgewiesen. Ohne aktive Combat Wall bleibt die bisherige GM-Farbzuordnung verfügbar.
- Vollständige Spieler-Vorgaben, Pyro, Ray-Alias, Orsik in Farbe, Fokusbilder und Übersicht ohne Scrollbalken bleiben erhalten.

## Kurzer Test in Foundry

1. Beide Module aktualisieren und Foundry-Hauptfenster sowie Dashboard-Fenster neu laden: Combat Wall 1.1.7, GM Combat Workspace 0.16.5.
2. Zustandseditor öffnen. Die zuvor englischen Optionen müssen deutsch erscheinen. „Fallend“ auf einem Spieler-Placeholder setzen: ohne echtes Bild darf kein goldenes Ersatzsymbol erscheinen.
3. Weitere Zustände mit und ohne Bild prüfen. Ein defekter Bildpfad darf keine kaputte Grafik oder Portrait-Ersatzgrafik hinterlassen. Quellenwechsel und Entfernen weiterhin live prüfen.
4. Zwei gleiche Gegner und einen weiteren Gegnertyp im Encounter verwenden. Für jeden Token den Punkt auf der GM-Minimap mit dem Marker auf seiner Combat-Wall-Kachel vergleichen: der Farbwert muss übereinstimmen.
5. Zug wechseln, Gegner hinzufügen/entfernen und die Gruppen-Zuordnung aktualisieren. Beide Anzeigen müssen dieselben aktuellen Farben verwenden. Nach Encounter-/Szenenwechsel dürfen keine alten Farben übernommen werden.

## Ausgeführte Prüfung

- 206 GM-Tests und Modulvalidierung erfolgreich, einschließlich aller nativen Statusnamen, ursprünglicher IDs, Aliasformen, Quellenanzeigen, optionaler Farbschnittstelle und Encounter-/Szenengrenzen.
- 54 aktuelle Combat-Wall-Tests plus Syntax-, Versions- und Gegnerdarstellungsprüfungen erfolgreich. Abgedeckt sind deutsche Statusnamen, camelCase-IDs, fehlende/generische Icons, echte Bildpfade, exakte gruppenbezogene Markerfarben, Reihenfolgewechsel, Sichtbarkeit und die bestehende Orsik-/Spielerlogik.
- Gemeinsamer Browsertest mit produktiven Dateien: „Fallend“, „Halbe Deckung“, „Brennend“, „Vergiftet“; kein Symbol bei fehlenden/generischen/defekten Bildern, funktionierendes echtes Bild bleibt. Portrait-Ersatzbild weiterhin geprüft.
- Minimap mit echter Zeichenroutine gerendert: Die gemessenen Punkt-Pixel stimmen mit den durch Combat Wall veröffentlichten Farben und den CSS-Markerfarben der Wall überein; mehrere Gegnergruppen und die absichtliche Farb-Wiederverwendung wurden geprüft.
- Vorherige gemeinsame Spieler-, Initiative-, Zustands-, Layout- und Live-Aktualisierungstests weiterhin erfolgreich. Die direkte Gegenprobe in der laufenden Foundry-Welt steht noch aus.

Die vollständige Liste nativer Status-IDs wurde gegen die [D&D5e-Konfiguration 5.3.2](https://github.com/foundryvtt/dnd5e/blob/release-5.3.2/module/config.mjs) geprüft.
