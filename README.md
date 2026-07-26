# Combat Wall 0.2.1

Leichtes externes Kampfdashboard für Foundry VTT 14 und D&D5e 5.3.2.

## Korrektur in Version 0.2.1

Foundry V14 liefert bei manuell angelegten Initiative-Platzhaltern teilweise trotzdem ein leichtes Token-Objekt. Deshalb war die erste Erkennung in 0.2.0 zu streng und behandelte Orsik, Ziggs, Lichtwölkchen, Zane und Nova weiterhin als Gegnergruppen.

Version 0.2.1 wertet einen Eintrag nur dann als Gegner, wenn er auf einen echten Szenen-Token mit eigenem Actor verweist.

- Spieler-Placeholder bleiben in der Zugreihenfolge.
- Der aktive Placeholder erscheint weiterhin oben links.
- Placeholder erzeugen keine Gegnerkacheln.
- Nur echte Gegner-Tokens erscheinen im Hauptbereich.
- Spieler zeigen in der Zugleiste ihre Initiative statt `0/1`.
- Das Vollbildlayout aus 0.2.0 bleibt erhalten.

## Bewusste Grenzen

- Das Modul verändert die Foundry-Initiative noch nicht.
- NPCs, die absichtlich ohne echten Szenen-Token in den Kampf eingetragen werden, gelten zunächst ebenfalls als Placeholder.
- Eine manuelle Spieler-/Gegner-Umschaltung folgt später als Absicherung.

## Installation und Aktualisierung

Manifest-Adresse:

```text
https://raw.githubusercontent.com/Krampe93/combat-wall/main/module.json
```

Nach dem Update die Welt und das Dashboard neu laden.

## Technische Testbefehle

```js
CombatWall.getState()
CombatWall.broadcast()
CombatWall.openDashboard()
CombatWall.getDashboardUrl()
CombatWall.inspectCombatants()
```

`CombatWall.inspectCombatants()` gibt in der Browserkonsole eine Tabelle mit der erkannten Art jedes Initiativeeintrags aus.
