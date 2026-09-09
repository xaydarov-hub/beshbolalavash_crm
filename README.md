# Besh Bola Lavash — CRM / HR boshqaruv tizimi

Bu loyiha React + Vite asosida yaratilgan ko'p-filliya, kafe va xizmat ko'rsatish biznesi uchun CRM/HR boshqaruv tizimidir. Loyiha boshqaruv, xodimlar, davomat, maosh, bonus-jarima, ta'til, hisobotlar va filiallar bo'yicha operatsiyalarni bitta dashboard ichida boshqarishni ta'minlaydi.

## Asosiy imkoniyatlar

- Boshliq uchun markaziy dashboard va avtomatik analitika
- Filial adminlari uchun mintaqaviy nusxa
- Xodimlar uchun shaxsiy maosh, davomat va ta'til ko'rinishi
- Davomatni kiritish / ko'rish / status belgilash
- Bonus va jarima tizimi
- Ta'til so'rovlarini ko'rish va tasdiqlash
- Xodimlarni boshqa filialga ko'chirish
- Ball baholash va sifat indeksi
- CSV / PNG hisobotlarni yuklab olish
- Firebase bilan cloud sinxronizatsiya uchun tayyor konfiguratsiya

## Texnologiyalar

- React 18
- Vite 8
- Firebase Auth / Firestore (ixtiyoriy)
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

3. `.env` ichidagi Firebase qiymatlarini haqiqiy Firebase loyihangizga moslashtiring.

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

## Demo login ma'lumotlari

| Rol | Telefon | Parol |
|---|---|---|
| 👑 Boshliq | 901234567 | 2018 |
| 👨‍💼 Admin — Chilonzor | 911112233 | 2021 |
| 👨‍💼 Admin — Yunusobod | 912223344 | 2022 |
| 👷 Xodim — Aziz Karimov | 933334455 | 2022 |
| 👷 Xodim — Nodira Tosheva | 934445566 | 2021 |
| 👷 Xodim — Javlon Mirzaev | 936667788 | 2020 |
| 👷 Xodim — Kamola Saidova | 937778899 | 2023 |

Xodim va adminlar birinchi kirishda yangi parol o'rnatishni talab qiladi. Agar Firebase ishlatilsa, u yerda auth va Firestore profilini ishlatadi.

## Firebase konfiguratsiyasi

Proyekt Firebase bilan ishlashini xohlasangiz, `.env` faylida quyidagi variabellarni to'ldiring:

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_DATABASE_URL=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_MEASUREMENT_ID=...
```

Agar konfiguratsiya to'liq bo'lmasa, loyiha avtomatik ravishda demo rejimiga o'tadi.

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

Bu loyiha real biznes uchun ishlab chiqiladigan asos bo'lib xizmat qiladi. Keyingi qadamlar:

- backend API va real database (PostgreSQL / Firebase Production)
- ro'yxatga kirish va huquqlarni server tomonida boshqarish
- Telegram/WhatsApp bildirishnomalar
- Excel export + PDF hisobotlar
- QR/GPS nedvizhiy davomat
- mobil ilova uchun responsiv UX

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
- Deploy the frontend AND backend together; /api/sales and revision checks require the updated backend. Back up server/db.json before deployment. Production requires JWT_SECRET with at least 32 characters. No production data is changed by the test suite.
- Validation: npm test and npm run build. Physical iPhone/Safari visual validation still needs a connected device/browser.

## Concurrent users and deployment

- The backend reads its JSON database once at startup. Only durable writes queue; login and state reads run independently. Password hashing uses asynchronous scrypt.
- PATCH /api/state sends changed records with their previous values. Independent edits merge; edits to the same record return 409. Failed disk writes never replace the visible state.
- Conditional state reads return 304 when the revision has not changed. Large JSON responses use gzip. Hidden tabs stop polling, requests have timeouts, and login cannot be submitted repeatedly while pending.
- Run `npm run test:load` for an isolated HTTP test with 15 simultaneous logins, 150 conditional reads, 15 sales writes and 15 attendance writes over 10,000 history records. It uses a temporary database and removes only that test directory.
- Run one backend process per JSON database. Set `DB_PATH` to an existing persistent disk path for production; copy the existing database there before changing the path. Multiple replicas require a shared transactional database rather than separate JSON files.
- Render and Netlify must deploy the same Git revision. `/api/health` exposes `apiVersion: 2` and the Render commit as `release` so deployment can be verified.
