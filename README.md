# Combat Wall 0.9.0

## Positionsmarker und neue Initiative in Version 0.9.1

Patch 0.9.1 blendet redundante `1/1 aktiv`-Angaben bei Einzelgegnern aus
und entfernt die sichtbaren Segment-Hilfslinien. Gruppenanzeigen,
Positionsmarker, Fokusmodus und aktive Hervorhebungen bleiben unverändert.

- Die separate Kachel „Aktuell am Zug“ wurde entfernt. Die Initiative nutzt die
  gesamte Kopfbreite; der aktive öffentliche Eintrag steht zuerst und ist größer.
- Der permanente Fokusmodus bleibt erhalten.
- Farbige Punkte ersetzen die bisherigen Richtungspfeile. Ihre Lage auf dem
  Gegnerbild entspricht der normalisierten Tokenposition innerhalb der
  tatsächlichen Szenengrenzen.
- Alle sichtbaren Mitglieder einer Gegnergruppe bleiben gleichzeitig markiert.
  Der aktive Punkt erhält einen zusätzlichen Ring; besiegte Punkte werden gedimmt.
- Farben werden über die stabile Encounter-Reihenfolge reproduzierbar an
  Combatants gebunden.

### Marker-API

Externe GM-Makros können dieselben Farben und Positionen sicher abfragen:

```js
CombatWall.getMarkerData(combatantId);      // Markerobjekt oder null
CombatWall.getGroupMarkerData(groupId);     // stabiles Array oder []
CombatWall.inspectMarkers();                // Diagnose als console.table()
```

Spieler und verborgene oder ungültige Gegner erhalten keine öffentlichen
Positionsmarker. Das GM-Combat-Dashboard selbst wird erst in einem späteren
Schritt an diese API angebunden.

## Permanenter Fokusmodus in Version 0.8.0

- Der untere Hauptbereich verwendet bei jedem Zug dasselbe Fokuslayout: Gegner links, aktiver Teilnehmer groß in der Mitte, Gegner rechts.
- Beim Gegnerzug zeigt die Mitte den konkreten Combatant samt Gruppenfortschritt, Status und individuellem Richtungspfeil.
- Beim Spielerzug erscheint ausschließlich der aktive Spieler in der Mitte. Andere Spieler werden unten nicht dargestellt; Spieler erhalten weder Richtungspfeil noch Gegnerstatus.
- Rechtsklick auf den verschiebbaren Combat-Wall-Button öffnet die kompakte Spielerbild-Zuweisung. Umschalt + Rechtsklick setzt die Buttonposition zurück.
- Bildpriorität: Combatant-Flag `flags.combat-wall.focusImage`, gespeicherte Zuordnung nach normalisiertem Spielernamen, vorhandenes Token-/Actorbild, Modul-Fallback.
- Der aktive Gegner wird nicht zusätzlich auf einer Seite dupliziert. Bei zu vielen Gegnergruppen erscheint `+N weitere`.
- `CombatWall.inspectPlayerImages()` zeigt die gespeicherten Spielerbilder.

Bekannte Grenze: Gleichnamige Spieler-Placeholder teilen absichtlich dieselbe persistente Bildzuordnung.

## Bugfixes in Version 0.7.2

- Der Übersichtsmodus verwendet wieder ein echtes zweidimensionales Mosaic-Raster statt einer einzelnen proportionalen Balkenzeile.
- Kreaturengrößen werden in diskrete Rasterflächen übersetzt: große Gegner belegen mehrere Zellen, kleine Gegner mindestens eine vollständig lesbare Zelle.
- Mindestbreite und Mindesthöhe haben Vorrang vor einer mathematisch exakten Gewichtsverteilung.
- `CombatWallDashboard.inspectLayout()` zeigt Rasterzeile, Spalte, Spans, zugewiesene Maße und Packing-Strategie.
- Der Combat-Wall-Button liegt standardmäßig oberhalb der FPS-/Latenzanzeige, lässt sich innerhalb des Fensters verschieben und speichert seine Position lokal.
- Ein Rechtsklick auf den Button setzt ihn auf die sichere Standardposition zurück.

Der 0.7.1-Algorithmus optimierte gewichtete Pixelbreiten innerhalb variabler Zeilen. Bei sechs Gruppen gewann dadurch eine einzelne horizontale Reihe mit sehr schmalen leichten Gruppen. 0.7.2 packt Gewichte stattdessen als Rasterspannen in ein zweidimensionales Mosaic.

## Bugfixes in Version 0.7.1

- D&D5e-Kurzwerte `sm`, `med`, `lg` und `grg` werden korrekt normalisiert.
- Größenquelle und roher Actor-Wert erscheinen in der Layoutdiagnose.
- Das gewichtete Layout verteilt die Kachelfläche tatsächlich nach Kreaturengröße.
- Seitenkacheln im Fokusmodus verwenden Kreaturengewichte auch für ihre Höhe.
- Der Gruppenfortschritt folgt strikt der sortierten Foundry-Turn-Reihenfolge.

Leichtes externes Kampfdashboard für Foundry VTT 14 und D&D5e 5.3.2.

## Größenabhängiges Layout in Version 0.7.0

- Combat Wall liest `system.traits.size` für NPCs aus und überträgt `creatureSize`, `sizeSource` und `layoutWeight`.
- Ausgangsgewichte: Tiny `0.65`, Small `0.8`, Medium `1.0`, Large `1.4`, Huge `1.8`, Gargantuan `2.3`.
- Fehlende oder unbekannte Größen fallen auf Medium zurück und werden mit `sizeSource: fallback` diagnostiziert.
- Im Übersichtsmodus verteilt ein gewichteter Pack-Algorithmus die Gegnerfläche. Mindestbreiten schützen Namen, Zähler, Pfeile und Status; bei mehreren Gruppen wird eine normale Kachel auf ungefähr 56 Prozent der Breite begrenzt.
- Die äußere Kachelgröße hängt von der Kreaturengröße ab. Die Mitgliederzahl steuert ausschließlich das innere Segmentraster.
- Im Fokusmodus bleibt der aktive konkrete Gegner groß in der Mitte; die übrigen Gruppen werden gewichtet auf beide Seiten verteilt.
- Reine Tokenbewegungen ändern nur die betreffenden Segmente. Neu gepackt wird bei Struktur-, Modus- und Größenänderungen.
- Übergänge dauern 300–450 ms und `prefers-reduced-motion` wird respektiert.

Bekannte Grenze: Bei sehr kleinen Fenstern und außergewöhnlich vielen Gruppen priorisiert Combat Wall kompakte Lesbarkeit. Optimiert ist das Layout für den vorgesehenen 16:9-Vollbildbetrieb.

## Gruppeninitiative in Version 0.6.1

- NPCs mit demselben Actor beziehungsweise Statblock bilden in Foundry einen zusammenhängenden, nativen `CombatantGroup`-Block.
- Alle Mitglieder des Blocks erhalten kontrolliert dieselbe Initiative; ihre bestehende Foundry-Reihenfolge bleibt erhalten.
- Die Synchronisierung läuft beim Kampfstart sowie bei Änderungen an Kampf, Combatants und Initiative. Modulinterne Updates sind markiert, damit keine Update-Schleifen entstehen.
- Öffentlich erscheint jede Gegnergruppe nur einmal. Spieler-Placeholder bleiben einzelne Einträge.
- Der GM klickt weiterhin jeden einzelnen Foundry-Combatant normal durch; Combat Wall führt keine zweite Initiative.
- Der Fokus folgt immer `activeCombatantId` und zeigt den Fortschritt nur unter den aktuell handlungsfähigen Mitgliedern, etwa `Skelett 2 von 2`.
- Besiegte Mitglieder zählen weiter zum Gesamtzustand der Kachel (`2/4 aktiv`), aber nicht zum aktiven Gruppenfortschritt.
- Verborgene oder für die aktuelle Szene ungültige Gegner werden nicht öffentlich übertragen.

Bekannte Grenze: Foundry entscheidet weiterhin, welcher Combatant als Nächstes aktiv wird. Combat Wall verändert nicht eigenständig den Zug und bietet in 0.6.1 keine freie Auswahl innerhalb einer Gruppe.

## Bugfixes in Version 0.5.2

- Der Richtungspfeil der großen Fokuskarte ist an deren sichtbaren Bildbereich gebunden und exakt zentriert.
- Zentrierung und Rotation verwenden getrennte DOM-Elemente, sodass die Rotation die Position nicht mehr überschreiben kann.
- Im Fokusmodus wird nur noch ein Richtungspfeil für den konkret aktiven Combatant dargestellt.

## Bugfixes in Version 0.5.1

- Spieler-Placeholder zeigen öffentlich nur noch `Spielerzug`.
- Der Fokusmodus verwendet den aktiven konkreten Combatant statt eines Gruppen-Fallbacks.
- Der individuelle Richtungspfeil liegt vollständig sichtbar mittig über der Fokuskarte und wechselt beim nächsten Gruppenmitglied live mit.
- Seitliche Gegnersegmente behalten ihre eigenen Pfeile, Status und Combatant-Zuordnungen.

## Änderungen in Version 0.5.0

- Identische Heartbeat-Daten lösen keine sichtbaren Re-Renders mehr aus. Initiative und Bilder flackern daher nicht regelmäßig.
- Die Initiativeleiste misst ihre reale Innenbreite und zeigt ausschließlich vollständige Karten sowie optional ein kompaktes `+N`.
- Der aktive Teilnehmer erscheint nur links; rechts folgen zyklisch die kommenden Initiativepositionen.
- Richtungspfeile liegen mittig über dem jeweiligen Gegnersegment.
- Bei Spielerzügen bleibt das größenabhängige Gegner-Raster als Übersichtsmodus sichtbar.
- Bei Gegnerzügen zeigt der Fokusmodus das aktive konkrete Gruppenmitglied groß in der Mitte. Andere Gegnergruppen bleiben kompakt links und rechts erkennbar.
- Kurze Übergänge respektieren `prefers-reduced-motion`.

## Bestehende Funktionen

- Spieler-Placeholder erscheinen in der Initiative und niemals als Gegnerkacheln.
- NPCs desselben Actors verwenden Foundrys native Gruppeninitiative und bleiben einzeln durchklickbar.
- Gegnersegmente bleiben über die Combatant-ID stabil zugeordnet.
- Status, Besiegt-Zustand und Richtungspfeile werden individuell dargestellt.
- Kreaturengrößen steuern im Übersichtsmodus das relative Layoutgewicht.
- Verborgene Combatants werden nicht öffentlich angezeigt.

## Diagnose

In der Foundry-Konsole:

```js
CombatWall.inspectCombatants()
CombatWall.inspectPublicInitiative()
CombatWall.inspectLayout()
```

Im Dashboard:

```js
CombatWallDashboard.inspectLayout()
```

Die Dashboard-Diagnose zeigt pro Gruppe Größe, Größenquelle, Gewicht, Mindest-/Maximalbreite, zugewiesene Fläche, Slot sowie angewendete Fallbacks oder Begrenzungen.

Das Dashboard meldet beim Laden eindeutig `Combat Wall Dashboard 0.7.2 geladen.`. JavaScript und CSS tragen versionsabhängige Dateinamen und Query-Parameter, damit ein Modulupdate keine alten Dashboard-Dateien aus dem Browsercache weiterverwendet.

## Installation und Aktualisierung

Manifest-Adresse:

```text
https://raw.githubusercontent.com/Krampe93/combat-wall/main/module.json
```

Nach dem Update die Welt vollständig neu laden und das Dashboard neu öffnen.
