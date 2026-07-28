# Combat Wall 0.5.1

Leichtes externes Kampfdashboard für Foundry VTT 14 und D&D5e 5.3.2.

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
```

Im Dashboard:

```js
CombatWallDashboard.inspectLayout()
```

Die Dashboard-Diagnose zeigt Layoutmodus, gemessene Breite, Kartenbreite, Gap, sichtbare Initiativekarten, aktiven Combatant und Gegnergruppen.

## Installation und Aktualisierung

Manifest-Adresse:

```text
https://raw.githubusercontent.com/Krampe93/combat-wall/main/module.json
```

Nach dem Update die Welt vollständig neu laden und das Dashboard neu öffnen.
