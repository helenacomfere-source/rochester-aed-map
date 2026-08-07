# Putting the site online

Right now the site only runs on your computer. `localhost` means "this machine,"
so that address will not work for anyone else. To share it, the files need to
live on a web server.

Everything here is plain HTML, CSS and JavaScript with no build step, so any
static host will serve it as-is. Two good options below.

---

## Option 1 — Netlify Drop (fastest, ~2 minutes, no account needed to start)

Best for showing someone quickly.

1. Go to **<https://app.netlify.com/drop>**
2. Drag **`rochester-aed-map.zip`** onto the page (or unzip it and drag the
   folder — either works).
3. Wait about twenty seconds. You get a live link like
   `https://cheerful-marigold-a1b2c3.netlify.app`
4. Share that link.

To keep the link permanently, make a free Netlify account when it offers — the
site stays at the same address and you can rename it to something like
`rochester-aed-map.netlify.app`.

**To update it later:** rebuild the zip and drag it on again, or connect it to
GitHub (Option 2) so it updates automatically.

---

## Option 2 — GitHub Pages (permanent, free, better long term)

Best once the site is real. It gives you version history, so a bad edit is
always undoable, and the site republishes itself whenever you change a file.

1. Make a free account at <https://github.com>
2. Create a new repository named `rochester-aed-map`, set to **Public**
3. Upload the site files (drag them into the browser — no command line needed)
4. Go to **Settings → Pages**, set Source to `main` branch, `/ (root)`, and Save
5. After a minute the site is live at
   `https://YOUR-USERNAME.github.io/rochester-aed-map/`

**To update it:** edit `data/aeds.json` on GitHub (or upload a new copy) and the
live site updates within a minute.

---

## Rebuilding the zip after changes

```bash
cd /Users/helenacomfere/Documents/helena_projects/aed_for_athletes
rm -f rochester-aed-map.zip
mkdir -p /tmp/rochester-aed-map
cp *.html /tmp/rochester-aed-map/
mkdir -p /tmp/rochester-aed-map/assets/{css,js,img} /tmp/rochester-aed-map/data
cp assets/css/styles.css /tmp/rochester-aed-map/assets/css/
cp assets/js/*.js       /tmp/rochester-aed-map/assets/js/
cp assets/img/logo.png  /tmp/rochester-aed-map/assets/img/
cp data/aeds.json       /tmp/rochester-aed-map/data/
(cd /tmp && zip -qr "$OLDPWD/rochester-aed-map.zip" rochester-aed-map)
```

The `tools/` folder is deliberately left out — those scripts are for you to run
locally and have no reason to sit on a public web server.

---

## Check these once it is live

- [ ] Map loads and both pins appear
- [ ] Search works (try `55901`)
- [ ] **Contact form actually sends** — submit a test and check the inbox
- [ ] **Add an AED form actually sends** — same
- [ ] Every page looks right on a phone

The two form checks matter most. They talk to FormSubmit from the live domain
rather than from `localhost`, so this is the first real test of that path.

---

## Before sharing it widely

- Confirm with AEDs for Athletes that they're happy with how the site describes
  the partnership and the organization.
- Add a few more verified AEDs. Two records is enough to demo, not enough to be
  useful to a stranger.
