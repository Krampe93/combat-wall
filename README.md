# Combat Wall 0.2.0

Leichtes externes Kampfdashboard für Foundry VTT 14 und D&D5e 5.3.2.

## Neu in Version 0.2

- Actor- und tokenlose Combatants werden als **Spieler-Placeholder** erkannt.
- Spieler-Placeholder bleiben in der öffentlichen Zugreihenfolge.
- Spieler-Placeholder erscheinen bei ihrem Zug weiterhin groß im Bereich **Aktuell am Zug**.
- Spieler und Spieler-Placeholder werden nicht mehr als Gegnerkacheln im Hauptbereich dargestellt.
- Die öffentliche Initiative zeigt bei Spielern keine irreführenden Angaben wie `0/1` mehr.
- Gegnerkacheln werden dynamisch über die verfügbare Bildschirmfläche verteilt.
- Bei vier Gegnergruppen entsteht beispielsweise eine Reihe aus vier Kacheln.
- Das Dashboard benötigt im normalen 16:9-Vollbild kein vertikales Scrollen mehr.
- Die Debug-Ausgabe ist standardmäßig verborgen. Sie kann mit `&debug=1` an die Dashboard-Adresse angehängt werden.

## Bewusste Grenzen

- Version 0.2 verändert die Foundry-Initiative noch nicht. Gegner werden nur auf dem Dashboard optisch gruppiert.
- Eigene Gruppennamen und Gruppenzuordnungen besitzen noch keine Bedienoberfläche.
- Verbündete Beschwörungen ohne Spielerbesitz gelten derzeit weiterhin als NPC-Gruppe.
- Die Segmentposition wird weiterhin aus den Tokenkoordinaten berechnet.

## Installation und Aktualisierung

Manifest-Adresse:

```text
https://raw.githubusercontent.com/Krampe93/combat-wall/main/module.json
```

Nach einem Update die Welt neu laden.

## Benutzung

1. Modul in der Welt aktivieren.
2. Als Spielleiter die Welt öffnen.
3. Unten links auf **Combat Wall** klicken.
4. Das Dashboard auf den 70-Zoll-Bildschirm verschieben.
5. **Vollbild** anklicken oder F11 verwenden.
6. Encounter starten und die Initiative durchschalten.

## Technische Testbefehle

```js
CombatWall.getState()
CombatWall.broadcast()
CombatWall.openDashboard()
CombatWall.getDashboardUrl()
```
