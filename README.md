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
