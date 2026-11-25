# Combat Wall 1.1.8 – eigene Farbe für jeden Gegner

Jeder einzelne Gegner erhält jetzt eine eigene Farbe für den gesamten Encounter. Die Farbauswahl beginnt nicht mehr bei jeder Gruppe von vorn: Drache 1 und Drache 2 haben unterschiedliche Farben, und die übrigen Gegner erhalten ebenfalls jeweils eine andere Farbe.

Die Zuordnung gehört zum Kampfteilnehmer und wird am Encounter gespeichert. Sie bleibt bei Zugwechseln, geänderter Initiative, Bewegung, Umgruppierung, Sichtbarkeitsänderungen und beim Hinzufügen oder Entfernen anderer Gegner erhalten. Auch bei mehr als acht Gegnern werden die ersten acht Farben nicht einfach wiederholt. Verborgene und besiegte Gegner behalten ihren Farbplatz.

GM Combat Workspace 0.16.5 übernimmt diese Zuordnung bereits über die bestehende Schnittstelle. Dadurch stimmen Spieleranzeige, GM-Minimap und Kartenmarkierungen für denselben Gegner weiter überein. Für den GM-Workspace ist kein neues Release erforderlich.

Die bestehenden Spieler-Platzhalter, deutschen Zustände, fehlenden Zustandssymbole, Farbdarstellung von Orsik, Fokusbilder und Übersicht ohne Scrollbalken bleiben enthalten.

## Installation und kurzer Test

1. Combat Wall auf 1.1.8 aktualisieren. GM Combat Workspace 0.16.5 verwenden.
2. Foundry-Hauptfenster neu laden und die beiden Dashboard-Fenster schließen und neu öffnen.
3. Einen Encounter mit zwei Drachen und mehreren anderen Gegnern verwenden: jeder einzelne Gegner muss eine andere Farbe haben. Den jeweiligen Marker in der Wall mit seinem Punkt auf der GM-Minimap vergleichen.
4. Initiative/Zug wechseln, Gegner bewegen oder umgruppieren und einen weiteren Gegner hinzufügen: die vorhandenen Farben müssen unverändert bleiben.
5. Foundry neu laden: dieselben Kampfteilnehmer müssen dieselben gespeicherten Farben behalten.

## Prüfung

63 automatisierte Zustands-, Spieler- und Farbtests sowie Syntax-, Versions- und Gegnerdarstellungsprüfungen bestanden. Die Farbprüfung umfasst mehrere Gruppen, zwei gleiche Gegner, 40 und 64 Gegner, stabile Zuordnung und Speicherung über einen neuen Laufzeitkontext hinweg. Der gemeinsame Browsertest vergleicht echte Minimap-Pixel mit den Markerfarben der Combat Wall und prüft, dass alle Farben innerhalb des Encounters unterschiedlich sind. Die direkte Gegenprobe in der laufenden Foundry-Welt steht noch aus.
