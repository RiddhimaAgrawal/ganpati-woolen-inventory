# Putting the app on your family's phones

## The short answer

| | Your computer must stay on? | Works away from home Wi-Fi? | Cost |
|---|---|---|---|
| **A. Your own computer** | **Yes** | No (same Wi-Fi only) | Free |
| **B. Cloud, free** (Aiven database + Render app) | **No** | Yes, any phone, any network | Free (but the first open after a quiet period is slow) |
| **C. Cloud, paid** (Railway, or Render's paid plan) | **No** | Yes | roughly $5–10 per month |

For 3–4 family phones I recommend **B**, and moving to **C** only if the slow first open annoys your dad.
Prices and free plans change, so check them on the provider's site before you sign up (checked October 2026).

Whichever you choose, the app now needs a **login**, so strangers who find the address cannot see your
data. You, your dad and your brother each get your own username and password.

---

## B. Free cloud (Aiven MySQL + Render) — step by step

Button names on these sites change now and then. If a screen looks different, tell me what you see.

### 1. Put the project on GitHub (private)
1. Create a free account at github.com and make a **new private repository** (for example `ganpati-app`).
2. Upload the contents of this folder (`package.json`, `ganpati-backend`, `ganpati-frontend`, …).
   **Do not upload** a file named `.env` or any `node_modules` folder (the included `.gitignore` already skips them
   if you use GitHub Desktop or `git`).

### 2. Create the free database (Aiven)
1. Sign up at aiven.io and create a **free MySQL** service (choose the **Free** plan; no card is needed at the time of writing).
2. When it is running, open the service and copy the **Service URI**. It looks like
   `mysql://avnadmin:PASSWORD@something.aivencloud.com:12345/defaultdb?ssl-mode=REQUIRED`
3. Keep this text private. It is the key to your data.

### 3. Run the app (Render)
1. Sign up at render.com → **New → Web Service** → connect your GitHub repository.
2. Fill in:
   - **Runtime:** Node
   - **Build Command:** `npm run build`
   - **Start Command:** `npm start`
   - **Instance type:** Free
3. Add these **Environment Variables**:

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | the Aiven Service URI from step 2 |
   | `JWT_SECRET` | any long random text (30+ characters) |
   | `ADMIN_USERNAME` | the username you want, e.g. `owner` |
   | `ADMIN_PASSWORD` | a password you will remember (6+ characters) |
   | `ADMIN_NAME` | your name |

4. Press **Create Web Service**. The first build takes a few minutes. When it says "Live", open the address Render gives you
   (like `https://ganpati-app.onrender.com`).
5. In the Render **Logs** you should see `✅ Database ready` and `👤 Created the first admin account`.

### 4. Add your dad and brother
Log in with the username/password from step 3 → **Account** tab → **Add a person**. Give each person their own
username and password, and tell them to change it under **Change my password**. Leave "admin" ticked only for people who
should be able to add or remove others.

### 5. Install it on the phones
- **Android (Chrome):** open the address → ⋮ menu → **Install app** / **Add to Home screen**.
- **iPhone (Safari):** open the address → **Share** button → **Add to Home Screen**.

It then opens full screen like a normal app, with its own icon, in English or हिंदी.

### 6. (Optional) Bring over the data you already entered on your computer
The app creates empty tables in the cloud database by itself, so you only copy the **data**. On your computer,
in Command Prompt or PowerShell (replace the capital words):

```
mysqldump -u root -p --no-create-info --skip-triggers --complete-insert --result-file=ganpati-data.sql ganpati_woolen customers raw_imports processing_batches sales
mysql -h HOST -P PORT -u USER -p --ssl-mode=REQUIRED DATABASENAME -e "source ganpati-data.sql"
```

`HOST`, `PORT`, `USER`, `DATABASENAME` are inside the Aiven Service URI
(`mysql://USER:PASSWORD@HOST:PORT/DATABASENAME`). Do this once, **before** you start entering new data in the cloud.

### Things to know about the free setup
- **Slow first open:** Render's free plan puts the app to sleep after about 15 minutes with no visitors. The next person to open it
  waits up to roughly a minute while it wakes (the app shows a "starting up" message). After that it is fast.
  Render's paid plan (about $7/month at the time of writing) removes this.
- **Free database:** Aiven can switch off a free database that nobody uses for a long time. Daily use avoids this.
- **Back up now and then:** run the `mysqldump` command from step 6 against the cloud database
  (swap in the cloud HOST/PORT/USER) and keep the file somewhere safe.

---

## C. Paid cloud, the simplest: Railway
1. Sign up at railway.com (needs a card; the small plan was about $5 per month at the time of writing).
2. **New Project → Deploy from GitHub repo** (your repository). Then **Add → Database → MySQL** in the same project.
3. Open the app service → **Variables** and add:
   `DATABASE_URL` = `${{MySQL.MYSQL_URL}}` (Railway fills this in for you), plus `JWT_SECRET`, `ADMIN_USERNAME`,
   `ADMIN_PASSWORD`, `ADMIN_NAME` as in the table above.
4. In **Settings** set Build Command `npm run build` and Start Command `npm start`, then **Generate Domain**.
5. Continue from "Add your dad and brother".

---

## A. Only your own computer (no cloud)
1. Set it up as in `README.md` (`ganpati-backend/.env`, `npm start`).
2. Find your computer's address on the Wi-Fi (`ipconfig` on Windows → "IPv4 Address", e.g. `192.168.1.20`).
3. Allow Node through the Windows firewall when it asks (choose **Private networks**).
4. On each phone (**same Wi-Fi**), open `http://192.168.1.20:5000`.
5. **Your computer must be on, with `npm start` running, whenever someone uses the app.** Away from that Wi-Fi it does not work.

---

## Forgot the admin password?
- On a computer: `npm run create-user -- newadmin NewPass123 "Name" --admin` inside `ganpati-backend`.
- On Render/Railway (no command line): set `ADMIN_USERNAME`, `ADMIN_PASSWORD` and `ADMIN_RESET_PASSWORD=true`,
  redeploy, log in, then **delete** `ADMIN_RESET_PASSWORD`.

## Troubleshooting
- **Red box / "Failed to …":** the Render **Logs** tab (or the terminal) says why in plain words, for example the database address is wrong.
- **"This database only accepts encrypted connections":** your `DATABASE_URL` must end with `?ssl-mode=REQUIRED`.
- **Everyone is logged out after each restart:** `JWT_SECRET` is missing.
