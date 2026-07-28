# Combat Wall 0.6.1

Leichtes externes Kampfdashboard für Foundry VTT 14 und D&D5e 5.3.2.

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
```

Im Dashboard:

```js
CombatWallDashboard.inspectLayout()
```

Die Dashboard-Diagnose zeigt Layoutmodus, gemessene Breite, Kartenbreite, Gap, sichtbare Initiativekarten, aktiven Combatant und Gegnergruppen.

Das Dashboard meldet beim Laden eindeutig `Combat Wall Dashboard 0.6.1 geladen.`. JavaScript und CSS tragen versionsabhängige Dateinamen und Query-Parameter, damit ein Modulupdate keine alten Dashboard-Dateien aus dem Browsercache weiterverwendet.

## Installation und Aktualisierung

Manifest-Adresse:

```text
https://raw.githubusercontent.com/Krampe93/combat-wall/main/module.json
```

Nach dem Update die Welt vollständig neu laden und das Dashboard neu öffnen.
