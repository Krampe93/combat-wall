# Gemeinsamer Placeholder-Patch

Basis: Krampe93/combat-wall (1.1.2) und Krampe93/foundryvtt-gm-combat-workspace (0.16.1), jeweils aktueller main beim Abruf am 20.11.2026.
Updates: Combat Wall 1.1.3 und GM Combat Workspace 0.16.2. Die zugehörigen GitHub-Releases sind Combat Wall v1.1.3 und GM Combat Workspace v0.16.2.

## Änderungen

- GM-Dashboard: Actorlose sowie durch GM Workspace, Monk's Combat Details oder Combat Wall gekennzeichnete Spieler-Placeholder sind Zustandsquellen mit stabiler Combatant-ID und werden als im Encounter angezeigt.
- Ein zugeordneter Character-Actor wird über seine ID oder einen eindeutig übereinstimmenden Namen erkannt. Dadurch erscheint beispielsweise Orsik nicht zusätzlich als außerhalb des Encounters. Bei mehrdeutigen Namen wird kein Actor geraten.
- Ohne Character-Actor speichert das Dashboard Zustände am Placeholder-Kampfeintrag. Diese Zustände sind reine Anzeigen und verändern keine Actor-Spielwerte. Sie bleiben am gespeicherten Encounter erhalten; beim Löschen des Kampfeintrags wird auch dessen Status gelöscht.
- Mit vorhandenem Character-Actor werden weiterhin dessen native Zustände bearbeitet. Gegnerzustände speichern die Identität einer Placeholder-Quelle ebenfalls vollständig; beide Seiten der Beziehung erscheinen in der Combat Wall.
- Das untere Spielerfenster war bereits der Editor für Spielerzustände und deren Quellen, kein zweiter Kampftracker. Es heißt jetzt „Spieler & Placeholder · Zustände“, erklärt die Bedienung und zeigt Encounter-Zugehörigkeit, Placeholder-Kennzeichnung, Zustände und ausgehende Beziehungen. Klick öffnet den Zustandseditor.
- Combat Wall: eigenes Namensfeld unter dem Fokusbild, vollständiges Bild mit contain; kleine Bilder bleiben cover. Auch der vergrößerte aktive Eintrag der Zugleiste hat eine passende Bildspalte, sodass sein Name nicht ins Bild ragt.
- Ziggs heißt in der öffentlichen Combat Wall Ray. Der Foundry-Eintrag bleibt erhalten; bestehende Bildzuordnungen unter Ziggs funktionieren weiter.
- GM- und Monk's-Placeholder mit NPC-Actor werden ausdrücklich als Placeholder behandelt. Spieler bleiben in Zugleiste/Fokus und erscheinen nicht als Gegnergruppe. Die bestehenden neueren Funktionen bleiben erhalten; kein Rückbau auf 0.2.

## Installation zum Test

1. Foundry-Welt schließen und die bisherigen beiden Modulordner sichern.
2. Die ZIPs entpacken und die enthaltenen Ordner `combat-wall` und `gm-combat-workspace` in Foundrys `Data/modules` ersetzen. Die jeweilige module.json muss direkt im Modulordner liegen.
3. Foundry starten, beide Module aktivieren, Welt und beide Dashboard-Fenster neu öffnen. Versionen 1.1.3 / 0.16.2 prüfen. Nach Veröffentlichung beider Releases können die Updates auch über Foundrys Modulverwaltung installiert werden.

## Kurzer Praxistest

1. Encounter mit Nova, Orsik, Ziggs/Ray, Lichtwölkchen und Zane als Placeholder sowie zwei gleichen Gegnern vorbereiten. Auch einen Placeholder ohne Actor verwenden.
2. Unten im GM-Dashboard müssen diese Spieler als im Encounter erscheinen. Orsik darf nicht zusätzlich als außerhalb erscheinen.
3. Bei einem Gegner den Zustandseditor öffnen. Unter „Verursacht durch“ müssen alle Placeholder auswählbar sein. „Gepackt“ durch einen Placeholder setzen: Gegner zeigt „Gepackt von …“, Quelle zeigt „Packt gerade …“; Quelle wechseln und Zustand entfernen.
4. Einen actorlosen Placeholder unten anklicken, „Vergiftet“ durch einen anderen Placeholder setzen. Fenster neu öffnen: Zustand und Quelle müssen erhalten sein. In der Combat Wall müssen sie im Spielerfokus erscheinen. Entfernen muss beide Anzeigen aktualisieren.
5. Combat Wall vor Kampfbeginn öffnen, danach Kampf starten und alle Spielerzüge durchgehen: Ray statt Ziggs, richtige Bilder, vollständiges Fokusbild, Name darunter, Spieler niemals als Gegnerkachel. Gegnerwechsel und Gruppenanzeige ebenfalls prüfen.
6. Bei 1920×1080 und 1366×768 prüfen: kein vertikales Seitenscrollen, Namen überlagern keine Portraits. Vorhandene Einstellungen und individuelle Bilder prüfen.

## Ausgeführte Prüfungen

- GM-Dashboard: 184 automatisierte Tests bestanden, einschließlich neuem actorlosen Placeholder-/Orsik-/Persistenz-/Beziehungstest; Modulvalidierung bestanden.
- Combat Wall: 28 aktuelle Portrait-, Sichtbarkeits- und Placeholder-Tests bestanden, einschließlich Ray-Alias, NPC-gestützter Placeholder und Zustandsentfernung.
- Browserprüfung mit produktiven Dateien, echtem lokalen HTTP-Server und zwei über BroadcastChannel verbundenen Seiten: sechs Spielerbilder, Vorschau → Kampf → Vorschau, Ray, Zustände und fehlendes Ersatzbild geprüft; keine unbehandelten Browserfehler.
- Gemeinsame Browserprüfung: echter GM-Zustandsdialog listet sechs actorlose Placeholder als Encounter-Quellen; Zustand durch Orsik setzen, in der Combat Wall live anzeigen und wieder entfernen erfolgreich.
- Layoutmessung bei 1920×1080 und 1366×768: contain, Namensfeld außerhalb des Fokusbilds und kein Seitenscrollen bestätigt; Screenshots geprüft.
- Historische Combat-Wall-Gesamttests sind teilweise auf alte aktive Manifestversionen und Aufrufpfade festgelegt. Für diesen Patch wurden die aktuelle Suite und der Browsertest ausgeführt; kein pauschaler Erfolg aller historischen Versionstests wird behauptet.
- Kein Test in deiner laufenden Foundry-Welt: Der obige Praxistest prüft die tatsächlichen Foundry-/Monk's-Dokumente und Modulwechselwirkungen.

## Dateien für die Weiterentwicklung

Die beiden `.patch`-Dateien enthalten die Änderungen einschließlich neuer Dateien und Tests gegen die beim Abruf aktuellen Repositories. Im jeweiligen Repository mit `git apply DATEI.patch` anwendbar. Die Testpakete enthalten ebenfalls die neuen Tests. Die Änderungen gehören zu den Releases v1.1.3 beziehungsweise v0.16.2 der beiden Repositories.
