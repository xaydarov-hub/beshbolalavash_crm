# Besh Bola Lavash — CRM / HR boshqaruv tizimi

Bu loyiha React + Vite asosida yaratilgan ko'p-filliya, kafe va xizmat ko'rsatish biznesi uchun CRM/HR boshqaruv tizimidir. Loyiha boshqaruv, xodimlar, davomat, maosh, bonus-jarima, ta'til, hisobotlar va filiallar bo'yicha operatsiyalarni bitta dashboard ichida boshqarishni ta'minlaydi.

## Asosiy imkoniyatlar

- Boshliq uchun markaziy dashboard va avtomatik analitika
- Filial adminlari uchun mintaqaviy nusxa
- Xodimlar uchun shaxsiy maosh, davomat va ta'til ko'rinishi
- Davomatni kiritish / ko'rish / status belgilash
- Bonus va jarima tizimi
- Avans (maosh oldindan olish) so'rovi, tasdiqlash va oylikdan avtomatik ayirish
- Ta'til so'rovlarini ko'rish va tasdiqlash
- Ishlaydigan bildirishnoma qo'ng'irog'i: yangi ta'til/avans so'rovi adminni va boshliqni ogohlantiradi, qaror xodimga qaytadi
- Xodimlarni boshqa filialga ko'chirish
- Ball baholash va sifat indeksi
- CSV / PNG hisobotlarni yuklab olish
- Telefonga "ilova sifatida" o'rnatish mumkin (PWA): iOS/Android'da to'liq ekranli, brauzer panellarisiz ishlaydi

## Texnologiyalar

- React 18
- Vite 8
- Node.js + Express backend (`server/`), JSON fayl bazasi (lowdb)
- CSS-modul yo'qligida maxsus komponent stili
- Vitest + Testing Library (sinovlar uchun)

## Loyiha ishga tushirish

1. Kerakli bog'lanmalarni o'rnating:

```bash
npm install
```

2. Muhit o'zgaruvchilarini sozlang:

```bash
cp .env.example .env
```

3. Lokal ishlatish uchun boshqa hech narsa sozlash shart emas — `npm run dev` backend va frontendni birga ishga tushiradi.

Netlify'da login ishlashi uchun backend serveringizning ommaviy HTTPS manzilini
Netlify Site configuration -> Environment variables bo'limida kiriting:

```env
VITE_API_URL=https://your-crm-backend.example.com
```

Netlify buildni qayta ishga tushirgandan keyin frontend telefonlardan ham shu backendga
ulanadi. `localhost:4000` faqat lokal kompyuter uchun ishlaydi.

4. Dev serverni ishga tushiring:

```bash
npm run dev
```

5. Brauzerda ko'rsatilgan localhost manzilini oching.

## Production build

```bash
npm run build
npm run preview
```

## Render backend deploy

Render Web Service sozlamalari:

- Build Command: `npm install`
- Start Command: `npm run server`
- Health Check Path: `/api/health`

Render server uchun `PORT` qiymatini o'zi beradi. Frontend Netlify'da bo'lsa,
Netlify Environment variables ichida `VITE_API_URL` ga Render service URL'ini kiriting.

## Test ishlatish

```bash
npm test
```

## Birinchi kirish (yangi baza)

Bazada hali hech qanday hisob bo'lmasa (`server/db.json` mavjud emas), server ishga tushganda boshliq hisobi uchun xavfsiz tasodifiy parol avtomatik yaratiladi va **faqat bir marta**, server terminalida/logida ko'rsatiladi:

```
Yangi CRM bazasi yaratildi. Boshliq hisobiga birinchi kirish:
  Login: beshbola.hr
  Boshlang'ich parol: <tasodifiy parol>
```

Shu login/parol bilan kirib, darhol shaxsiy parol o'rnating (birinchi kirishda tizim buni taklif qiladi). Boshliq keyin "Xodimlar" bo'limidan admin va xodimlarni o'zi qo'shadi — ularning boshlang'ich parolini shu yerda o'zi belgilaydi.

Demo/test uchun aniq login-parol jadvali endi yo'q: eski qattiq-kodlangan demo hisoblar (va ular ishlatgan filial nomlari) tizimdan butunlay olib tashlandi, chunki haqiqiy foydalanishda ular real ma'lumotlar bilan aralashib, eski demo yozuvlar doim qaytib kelaverar edi.

## Telegram bildirishnomalari (ixtiyoriy)

Har bir kirish va chiqishda Telegram guruhiga xabar yuborilishi mumkin. Bu server tomonida ishlaydi (token brauzer kodiga hech qachon tushmaydi). Yoqish uchun serverning muhit o'zgaruvchilariga (Render bo'lsa — Environment bo'limiga, lokal bo'lsa `.env` fayliga) qo'shing:

```env
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
```

Ikkalasi ham bo'sh qolsa, bildirishnoma jim o'chirilgan holatda qoladi (xatolik chiqmaydi).

## Strukturasi

```text
src/
  App.jsx
  main.jsx
  index.css
  components/
  lib/
```

## Keyingi bosqichlar

Bajarilgan: backend API va server tomonidagi huquqlar, mobilga moslashgan interfeys, ilova sifatida o'rnatish (PWA).

Hali qilinishi mumkin bo'lgan qadamlar:

- Render'da pullik tarifga o'tish (bepul tarifda server 15 daqiqadan keyin "uxlab qoladi", birinchi so'rov sekin bo'ladi)
- Excel export + PDF hisobotlar (hozir CSV va PNG bor)
- Xodimlar uchun smena jadvalini oldindan rejalashtirish
- QR/GPS orqali davomat belgilash

## Muallif

Besh Bola Lavash CRM / HR boshqaruv platformasi.

# beshbolalavash_crm


## 2026-09: Daily sales, payroll and mobile update

- Boss: Xodimlar -> employee profile -> Foizli -> percentage (for example 7).
- Boss/admin: Kunlik savdo -> date -> daily sales total -> save. 10,000,000 at 7% credits 700,000. Editing replaces that day's total; revisions retain the previous amount, author and rate. Existing records retain their rate when the employee's rate changes.
- Daily commission is included in monthly payroll and exports. Historical monthly sales remain as an additional legacy balance, shown on the sales card: do not enter those same sales again as daily records.
- Employee history combines sales, attendance, evaluations, adjustments, transfers, leave and saved payroll, with month/all-history filters. Admin sees their branch, employees see only their own financial records. Open screens refresh every 30 seconds and on window focus.
- All twelve evaluation criteria use 0-5. The overall score is their arithmetic mean out of 5. Server startup migrates historical weighted scores proportionally once and retains original scores as legacyScores.
- Mobile tables stack into labelled cards, forms use 16px text to avoid iOS focus zoom, controls have 44px touch targets, and time fields use native pickers. Local development proxies /api so phones do not call their own localhost.
- Deploy the frontend AND backend together; /api/sales and revision checks require the updated backend. Back up server/db.json before deployment. Production uses a configured strong JWT_SECRET or generates and saves a secure signing key automatically. No production data is changed by the test suite.
- Validation: npm test and npm run build. Physical iPhone/Safari visual validation still needs a connected device/browser.

## Concurrent users and deployment

- The backend reads its JSON database once at startup. Only durable writes queue; login and state reads run independently. Password hashing uses asynchronous scrypt.
- PATCH /api/state sends changed records with their previous values. Independent edits merge; edits to the same record return 409. Failed disk writes never replace the visible state.
- Conditional state reads return 304 when the revision has not changed. Large JSON responses use gzip. Hidden tabs stop polling, requests have timeouts, and login cannot be submitted repeatedly while pending.
- Run `npm run test:load` for an isolated HTTP test with 15 simultaneous logins, 150 conditional reads, 15 sales writes and 15 attendance writes over 10,000 history records. It uses a temporary database and removes only that test directory.
- Run one backend process per JSON database. Set `DB_PATH` to an existing persistent disk path for production; copy the existing database there before changing the path. Multiple replicas require a shared transactional database rather than separate JSON files.
- Render and Netlify must deploy the same Git revision. `/api/health` exposes `apiVersion: 2` and the Render commit as `release` so deployment can be verified.

### Render startup and signing keys

JWT_SECRET is optional. A configured value with at least 32 non-whitespace characters is preserved. If missing or too short, the server creates a cryptographically random 256-bit key in .jwt-secret next to DB_PATH (or at JWT_SECRET_FILE). The file has owner-only permissions on Linux, is published atomically without overwriting another process's key, and is ignored by Git. A corrupt existing key is never silently replaced. Authentication and token signature verification remain required.

Keep the database and generated key on persistent storage for sessions to survive instance replacement. Render's ephemeral filesystem can discard the generated key on redeploy, requiring users to sign in again. A strong configured JWT_SECRET avoids that session reset. Never put this key in a VITE_ variable or public assets.

The server binds to 0.0.0.0 and uses Render's PORT. After deployment, verify /api/health contains apiVersion 2 and the current release commit. npm run test:load starts production mode with an empty JWT_SECRET and verifies concurrent login and writes against an isolated temporary database.
