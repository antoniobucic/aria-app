# 🗓 ARIA Terminassistent – Installations-Anleitung

## Schritt 1 – API Key eintragen
1. Gehe auf https://console.anthropic.com
2. Erstelle einen Account (kostenlos)
3. Gehe zu "API Keys" und erstelle einen neuen Key
4. Öffne die Datei `src/App.jsx`
5. Ersetze in Zeile 8 `DEIN_API_KEY_HIER` mit deinem echten Key

## Schritt 2 – GitHub Account erstellen
1. Gehe auf https://github.com
2. Klicke auf "Sign up" und erstelle einen Account

## Schritt 3 – Projekt auf GitHub hochladen
1. Gehe auf https://github.com/new
2. Repository Name: `aria-app`
3. Klicke auf "Create repository"
4. Lade alle Dateien dieses Ordners hoch (Drag & Drop funktioniert)

## Schritt 4 – Auf Netlify veröffentlichen
1. Gehe auf https://netlify.com
2. Klicke auf "Sign up" → "Sign up with GitHub"
3. Klicke auf "Add new site" → "Import an existing project"
4. Wähle GitHub → wähle `aria-app`
5. Build settings:
   - Build command: `npm run build`
   - Publish directory: `dist`
6. Klicke auf "Deploy site"
7. Nach 2-3 Minuten bekommst du eine URL wie: `https://aria-app-xyz.netlify.app`

## Schritt 5 – App auf iPhone installieren
1. Öffne die Netlify-URL in **Safari** auf deinem iPhone
2. Tippe unten auf das **Teilen-Symbol** (Quadrat mit Pfeil nach oben)
3. Scrolle und tippe auf **"Zum Home-Bildschirm"**
4. Tippe auf **"Hinzufügen"**
5. ✅ ARIA erscheint jetzt als App auf deinem Homescreen!

## ⚠️ Hinweise
- Die App braucht eine Internetverbindung für den KI-Chat
- Termine werden lokal auf deinem Gerät gespeichert
- Benachrichtigungen funktionieren nur wenn Safari/die App geöffnet ist
