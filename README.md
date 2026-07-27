# Combat Wall 0.4.0

Leichtes externes Kampfdashboard für Foundry VTT 14 und D&D5e 5.3.2.

## Änderungen in Version 0.4.0

- NPCs desselben Actors verwenden Foundrys native Gruppeninitiative und bleiben einzeln durchklickbar.
- Gegnersegmente werden beim ersten Aufbau nach Kartenposition sortiert und danach dauerhaft über die Combatant-ID zugeordnet.
- Sichtbare Segmentnummern wurden entfernt.
- Jedes Gegnersegment zeigt einen live aktualisierten Richtungspfeil von der Szenenmitte zum Token.
- Kreaturengrößen steuern das relative Layoutgewicht der Gegnerkacheln.
- `mainEnemy` und `layoutMultiplier` sind für ein späteres Hauptgegner-Layout im Datenmodell vorbereitet.
- Spieler-Placeholder, verborgene Combatants und die dynamische Initiativeleiste aus Version 0.3 bleiben unverändert unterstützt.

## Diagnose

Nach dem Update steht in der Foundry-Konsole zur Verfügung:

```js
CombatWall.inspectCombatants()
```

Der Befehl zeigt, wie Combat Wall die Initiativeeinträge erkennt.

## Installation und Aktualisierung

Manifest-Adresse:

```text
https://raw.githubusercontent.com/Krampe93/combat-wall/main/module.json
```

Nach dem Update die Welt vollständig neu laden und das Dashboard neu öffnen.
