# Combat Wall 0.3.0

Leichtes externes Kampfdashboard für Foundry VTT 14 und D&D5e 5.3.2.

## Änderungen in Version 0.3.0

- Der aktive Teilnehmer steht ausschließlich groß links.
- Rechts erscheinen nur die folgenden Teilnehmer, die in den verfügbaren Platz passen.
- Die Initiativeleiste besitzt keinen horizontalen Scrollbalken.
- Nach einem Zugwechsel rückt der neue aktive Teilnehmer nach links; die folgenden Züge werden zyklisch neu angeordnet.
- Spieler-Placeholder und Gegnergruppen aus Version 0.2.2 bleiben unverändert erhalten.

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
