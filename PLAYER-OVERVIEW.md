# Combat Wall 1.1.4 – Spielerübersicht rechts oben

Stand: 23.11.2026. Aufbauend auf Combat Wall 1.1.3 und dem bereits veröffentlichten GM Combat Workspace 0.16.2.

## Neu

Rechts oben steht dauerhaft „Spieler & Zustände“. Die Übersicht zeigt alle sichtbaren Spieler und Placeholder des aktuellen Encounters, auch wenn sie gerade nicht am Zug sind oder in der verkürzten Zugleiste nicht zu sehen sind. Jede Zeile enthält das Portrait, den Namen und die Zustände; ohne Zustand steht dort „Keine Zustände“. Der aktive Spieler wird hervorgehoben. Zustandsquellen und Gegenanzeigen erscheinen mit den bisherigen Verknüpfungen, ohne doppelte Texte.

Die Anzeige funktioniert vor Kampfbeginn und während Gegnerzügen. Verborgene Spieler bleiben ausgeblendet. Besiegte Spieler bleiben in der Übersicht. Bei größeren Gruppen oder vielen Zuständen scrollt nur das Spielerfenster; die Seite behält ihr Vollbildlayout.

Alle Korrekturen aus 1.1.3 bleiben enthalten: Ziggs heißt in der Combat Wall Ray, bisherige Bildzuordnungen bleiben gültig, Fokusbilder werden vollständig mit contain angezeigt, Namen stehen außerhalb der Portraits, und Spieler werden niemals zu Gegnerkacheln.

GM Combat Workspace 0.16.2 benötigt dafür keine weitere Änderung. Zustände werden weiterhin dort bearbeitet; die Combat Wall ist die öffentliche Anzeige.

## Installation

In Foundrys Modulverwaltung Combat Wall auf 1.1.4 aktualisieren. GM Combat Workspace sollte mindestens auf dem bereits veröffentlichten Stand 0.16.2 sein. Anschließend das Foundry-Hauptfenster neu laden und das Combat-Wall-Fenster schließen und neu öffnen.

Alternativ die Release-ZIP installieren: module.json, scripts, dashboard, styles und assets gehören direkt in Data/modules/combat-wall. Bestehende Modulordner vor manuellem Ersetzen sichern. Die Welt muss dabei geschlossen sein.

## Kurzer Test in Foundry

1. Einen Encounter mit Nova, Orsik, Ziggs/Ray, Lichtwölkchen und Zane als Placeholder vorbereiten. Rechts oben müssen alle sichtbaren Spieler mit Bild und Status erscheinen.
2. Während eines Gegnerzugs im GM-Dashboard einen Zustand bei einem anderen Spieler setzen, die Quelle ändern und den Zustand entfernen. Die Übersicht muss alle Änderungen ohne Zugwechsel anzeigen.
3. Ray muss als Ray angezeigt werden, auch wenn der Foundry-Eintrag weiterhin Ziggs heißt. Eigene Bilder sollen erhalten bleiben.
4. Einen Spieler verbergen und wieder einblenden. Er muss aus der öffentlichen Übersicht verschwinden und wieder erscheinen. Einen besiegten Spieler weiterhin anzeigen.
5. Combat Wall neu öffnen sowie Encounter beenden/wechseln: keine veralteten Spieler oder Zustände anzeigen. Ohne Encounter steht „Keine Spieler im Encounter“.

## Geprüft

- 35 aktuelle Placeholder-/Portrait-/Übersichtstests und 10 Zustandsintegrationstests bestanden; Syntax-, Versions- und Gegnerdarstellungsprüfungen erfolgreich.
- Gemeinsamer Browsertest mit produktiven Combat-Wall-Dateien und GM Combat Workspace 0.16.2 über zwei verbundene Fenster: sechs Spieler, Quellenwechsel, Zustandsentfernung, aktiver Gegner bei gleichzeitig sichtbaren Spielerzuständen, Ray, Ausblenden/Wiedereinblenden und leerer Encounter erfolgreich.
- 1920×1080 und 1366×768: Übersicht ganz rechts oben, sechs Standardspieler gleichzeitig sichtbar, vollständiges Fokusbild und keine vertikale Seitenscrollleiste. Bei 18 Spielern bleibt die ganze Liste über das intern scrollbare Fenster erreichbar.
- Die direkte Gegenprobe in der laufenden Foundry-Welt steht noch aus.
