# Combat Wall 0.2.2

Leichtes externes Kampfdashboard für Foundry VTT 14 und D&D5e 5.3.2.

## Änderung in Version 0.2.2

Foundry beziehungsweise der Browser konnte nach einem Update weiterhin die alte `scripts/main.js` aus dem Cache ausführen, obwohl die Modulverwaltung bereits Version 0.2.1 anzeigte. Version 0.2.2 verwendet deshalb den neuen Dateinamen:

```text
scripts/main-0.2.2.js
```

Damit muss der Browser den aktuellen Code laden.

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
