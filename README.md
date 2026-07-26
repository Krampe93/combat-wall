# Combat Wall 0.1.0

Leichtes externes Kampfdashboard für Foundry VTT 14 und D&D5e 5.3.2.

## Was diese erste Testversion kann

- eigenständige HTML-Anzeige ohne zweiten vollständigen Foundry-Client
- aktuelle Runde und aktiven Combatant anzeigen
- Spieler einzeln und NPCs nach Actor gruppiert in der öffentlichen Zugreihenfolge darstellen
- einzelne NPCs innerhalb einer Gruppe als Bildsegmente anzeigen
- Segmente anhand ihrer Tokenposition grob von oben links nach unten rechts anordnen
- aktive, besiegte und mit Foundry-Status versehene Gegner markieren
- Änderungen an Initiative, Tokens, Trefferpunkten und Active Effects live übertragen

## Bewusste Grenzen von Version 0.1

- Das Modul verändert die Foundry-Initiative noch nicht. Es gruppiert nur die Spieleranzeige.
- Eine eigene Gruppenzuordnung in Foundry gibt es noch nicht als Bedienoberfläche.
- Die Segmentposition wird nach Tokenkoordinaten neu berechnet und ist noch nicht dauerhaft fixierbar.
- Bosslayout, Kampfziele und endgültiges Grafikdesign folgen später.

## Benutzung nach der Installation

1. Modul in der Welt aktivieren.
2. Als Spielleiter die Welt öffnen.
3. Unten links auf **Combat Wall** klicken.
4. Das neue Fenster auf den 70-Zoll-Bildschirm verschieben.
5. Dort **Vollbild** anklicken oder F11 verwenden.
6. Einen Kampf starten und die Initiative durchschalten.

## Technischer Test

In der Browserkonsole der Foundry-Spielleiteransicht stehen zusätzlich diese Befehle bereit:

```js
CombatWall.getState()
CombatWall.broadcast()
CombatWall.openDashboard()
CombatWall.getDashboardUrl()
```

## Installation über Manifest

In Foundry unter **Add-on Modules → Install Module** diese Manifest-Adresse einfügen:

```text
https://raw.githubusercontent.com/Krampe93/combat-wall/main/module.json
```

Foundry lädt anschließend das passende ZIP-Paket automatisch.

## Datenschutz im Kampf

Combatants, die im Foundry-Initiativtracker als verborgen markiert sind, werden nicht an das Spieler-Dashboard übertragen.
