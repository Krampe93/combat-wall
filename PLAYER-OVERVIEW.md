# Combat Wall 1.1.5 und GM Combat Workspace 0.16.3

## Änderungen

- Die Übersicht „Spieler & Zustände“ erhält keinen Scrollbalken mehr. Der Kopfbereich passt seine Höhe an umgebrochene Zustandstexte an; bei größeren Gruppen wird die Darstellung kompakter. Namen und Zustandstexte bleiben erhalten.
- Pyro ist in der Encounter-Vorbereitung als teilnehmender Spieler vorgewählt, auch ohne Actor oder Token. Nach manueller Initiative-Eingabe und Bestätigung wird er als Placeholder angelegt. Das bloße Öffnen des Fensters verändert den Encounter nicht.
- Ein vorhandener Pyro wird wiederverwendet; seine Initiative und Flags bleiben erhalten. Eine ausdrücklich gespeicherte Abwahl wird respektiert.
- Pyro erscheint im Kampftracker, in der öffentlichen Spielerübersicht und als Zustandsquelle. Sein Portrait ist bereits enthalten. Er wird nicht als Gegnerkachel behandelt.
- Ray-Alias, vollständige Fokusbilder und bisherige Placeholder-Korrekturen bleiben enthalten.

## Nach dem Update

1. Beide Module aktualisieren: Combat Wall 1.1.5 und GM Combat Workspace 0.16.3.
2. Foundry-Hauptfenster neu laden, beide Dashboard-Fenster schließen und neu öffnen.
3. „Encounter vorbereiten“ öffnen. Pyro ist zusätzlich zu den bisherigen Spielern vorgewählt. Seine Initiative eintragen und bestätigen. Ein neu hinzugefügter Pyro besitzt vorher noch keinen Initiativewert.
4. Rechts oben müssen jetzt alle sechs Spieler sichtbar sein. Auch mit „Packt gerade Marilith · Packt gerade Skeleton“ bei Orsik und „Gepackt von Bodak“ bei Nova darf kein Scrollbalken entstehen und keine Zeile abgeschnitten werden.
5. Vorbereitung erneut öffnen: Pyro muss einmal vorhanden sein und seinen bisherigen Initiativewert anzeigen. Bei einem Zustand Pyro als Quelle wählen; Anzeige und Entfernen müssen sich live aktualisieren.

## Geprüft

- GM Combat Workspace: 188 Tests bestanden, Modulvalidierung erfolgreich. Neue Fälle prüfen Standard-Pyro, fehlende Initiative, Erstellung als actorloser Placeholder, Quellen-Erkennung, Wiederverwendung, gespeicherte Abwahl und vorhandene Monk-/Actor-/Token-Einträge.
- Combat Wall: 36 Placeholder-/Portrait-/Übersichtstests und 10 Zustandsintegrationstests bestanden; zusätzlich Syntax-, Versions- und Gegnerdarstellungsprüfungen.
- Gemeinsamer Browsertest mit produktiven Dateien: fünf vorhandene Spieler → echte Initiative-Abfrage mit vorgewähltem Pyro → Fehlermeldung ohne Initiative → Eingabe 13 → genau ein zusätzlicher Placeholder → sechs Spieler in der Combat Wall mit Pyros Portrait.
- Browser- und Layoutprüfung bei 1920×1080 und 1366×768 mit den längeren Texten aus dem Screenshot: alle sechs Spieler sichtbar, kein Scrollbalken, keine abgeschnittenen Zeilen. Auch eine 18-Spieler-Liste passt im Test ohne Scrollen. Live-Zustandsänderungen, Quellenwechsel, Entfernen und verborgene Spieler wurden mitgeprüft.
- Die direkte Gegenprobe in der laufenden Foundry-Welt steht noch aus.
