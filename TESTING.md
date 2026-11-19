# Gemeinsamer Test: Combat Wall 1.1.2 und GM Combat Workspace 0.15.0

## Spielerbilder und unsichtbare Gegner in 1.1.2

- Einen vorbereiteten Kampf ohne aktiven Zug mit Orsik, Nova Schaltkreis, Ziggs und Lichtwölkchen öffnen. Initiative und gekennzeichnete Vorschau müssen die Porträts zeigen. Ziggs verwendet Ray; Flab verwendet Orsik.
- Kampf starten, Spielerzüge wechseln und wieder zur Vorbereitung zurückkehren. Name, Porträt und Zustände müssen mitwechseln; keine leere oder veraltete Spielerkarte darf stehen bleiben.
- Gegner-Token auf der Battlemap unsichtbar lassen. Mit aktivierter Moduleinstellung „Unsichtbare Gegner in Combat Wall anzeigen“ erscheinen sie trotzdem in Übersicht, Initiative und Fokus, mit Positionsmarkern und Zustandsbeziehungen. Die Einstellung ausschalten: Gegner und zugehörige Beziehungstexte verschwinden aus der Wall. Die Token bleiben in beiden Fällen auf der Battlemap unsichtbar.
- Eigene Spielerbilder behalten Vorrang; fehlende Dateien erhalten ein Ersatzbild. Verborgene Spieler bleiben auch bei eingeschalteter Gegneroption verborgen.

Automatisierte Zustands-, Porträt-, Sichtbarkeits- und Besiegt-Prüfungen laufen gegen die produktiven Dateien von 1.1.2. Ein lokaler Browsertest lädt die echten PNG-Dateien unter einem Foundry-URL-Präfix und prüft Vorschau, Spielerwechsel, Zustände und Ersatzbilder. Die Abnahme in der laufenden Foundry-Welt bleibt separat.

Beide Module aktualisieren, einmal das Foundry-Hauptfenster neu laden und Workspace sowie Combat Wall neu öffnen. Bestehende Testarena mit Zane, mindestens zwei Goblins/Skeletons und den bisherigen Spezialgegnern weiterverwenden.

1. Im Workspace unter den Reaktionen Zane anklicken. „Gepackt“ mit Goblin 1 als Verursacher speichern. **Einmal setzen** muss beide Anzeigen erzeugen: Zane „Gepackt von Goblin 1“, Goblin „Packt gerade Zane“. Auf der Combat Wall Spielerfokus/Initiative und Gegnerkachel prüfen.
2. Ohne Zugwechsel die Quelle auf Goblin 2 ändern. Die Gegenanzeige wechselt zum richtigen Token; Goblin 1 zeigt sie nicht mehr. Danach den Zustand auf Zane entfernen: beide Anzeigen verschwinden gemeinsam. „Ohne Quelle“ löst nur die Beziehung und behält den normalen Zustand.
3. Umgekehrte Richtung: Goblin „Gepackt“ durch Zane. Goblin zeigt „Gepackt von Zane“, Zane „Packt gerade Goblin …“. Beide Anzeigen müssen live aktualisieren. Wenn beide Richtungen separat gelten, darf das Entfernen einer davon die andere nicht löschen.
4. Zwischen Spieler- und Gegnerzug wechseln sowie Fenster erneut öffnen. Zustände erscheinen im jeweiligen Fokus; Dauer und normale Effekte bleiben erhalten. Gleiche Gegnernamen und Gruppen dürfen die konkrete Tokenzuordnung nicht vermischen.
5. Bei Spieler-Placeholdern nur eindeutige Charakternamen zuordnen. Verborgene Gegner bleiben verborgen; ihre Namen dürfen nicht über einen Zustand auf der Wall sichtbar werden. Fehlende oder mehrdeutige Endpunkte erzeugen keine Zuordnung zu einem falschen Teilnehmer.
6. Besiegte Mitglieder, vollständig besiegte Gruppen, Bloodied, farbige Positionsmarker, aktive Ringe und Gruppenreihenfolge gemäß den bisherigen Tests kurz gegenprüfen. Kleine Fenster: Spielername und Zustände überdecken sich nicht; die Seite bekommt keinen äußeren Scrollbalken.
7. Im Workspace bleiben alle noch offenen Recovery-, Reaktions-, Recharge-, legendären und Initiativprüfungen aus den früheren Testpaketen offen und werden in diesem gemeinsamen Durchlauf mitgenommen.

Lokale Prüfung: zehn gezielte automatisierte Beziehungstests; bestehende Regressionen für Besiegt/Bloodied/native Effekte in der aktuellen 1.1.0-Prüfung erfolgreich. Zwei Browserseiten mit echtem BroadcastChannel nutzen den produktiven Workspace-Zustandsservice, Combat-Wall-Serializer und das Dashboard: beide Anzeigen, Quellenwechsel ohne Zugwechsel, gemeinsame Entfernung, Gegenrichtung, Spielerfokus, Initiative, 1280×720 und verborgene Quelle geprüft. Der Live-Test in Tims Foundry-Welt ist noch offen.

## Spielerbilder in 1.1.1

Automatisch geprüft: alle sechs Standardbilder, der Alias Flab → Orsik, die Schreibweisen Lichtwölkchen/Lichtwoelkchen, vorhandene PNG-Dateien, Fokusdarstellung sowie Vorrang eigener Weltzuordnungen und Combatant-Flags. Die bisherigen Zustands- und Besiegt-Prüfungen laufen gegen 1.1.1.

In Foundry nach dem Update das Hauptfenster neu laden und Combat Wall erneut öffnen. Bei den sechs Spieler-Placeholdern ohne eigene Bildzuordnung jeweils den Zug aktivieren und das zugehörige Porträt prüfen. Ein bestehendes eigenes Fokusbild muss weiterhin angezeigt werden.
