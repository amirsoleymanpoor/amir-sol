# سامانه هوشمند بازرسی و تشخیص عیوب قطعات

## ⚡ راهنمای سریع ساخت APK

### پیش‌نیازها
- **Node.js** (نسخه ۱۸ یا بالاتر)
- **Android Studio** (برای کامپایل نهایی)
- **JDK ۱۷** یا بالاتر
- **کلید API Gemini** ([دریافت از Google AI Studio](https://aistudio.google.com/app/apikey))

---

## 📱 مراحل ساخت APK (قدم به قدم)

### ۱. نصب وابستگی‌ها
```bash
npm install
```

### ۲. تنظیم کلید API
```bash
cp .env.example .env.local
# فایل .env.local را باز کنید و کلید GEMINI_API_KEY خود را وارد کنید
```

### ۳. ساخت فایل‌های استاتیک
```bash
npm run build
```

### ۴. راه‌اندازی Capacitor (فقط بار اول)
```bash
npx cap init component-qc-inspector com.example.componentinspector --web-dir dist
npx cap add android
```

### ۵. همگام‌سازی با Android
```bash
npx cap sync
```

### ۶. باز کردن در Android Studio
```bash
npx cap open android
```

### ۷. ساخت APK
در Android Studio:
1. منوی **Build** → **Build Bundle(s) / APK(s)** → **Build APK(s)**
2. یا برای نسخه امضا شده: **Build** → **Generate Signed Bundle / APK**

فایل APK در این مسیر ساخته می‌شود:
```
android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 🚀 اجرای سرور بک‌اند

برای تست لوکال:
```bash
npm run dev
```

سرور روی `http://localhost:3000` اجرا می‌شود.

---

## 🔧 مشکلات رایج و راه‌حل

| مشکل | راه‌حل |
|------|--------|
| `dotenv` نصب نمی‌شود | نسخه ۱۶.۴.۷ در `package.json` تنظیم شده، از `npm install` استفاده کنید |
| خطای Gradle | در Android Studio منوی File → Sync Project with Gradle Files بزنید |
| خطای JAVA_HOME | متغیر محیطی JAVA_HOME را به مسیر JDK ۱۷ تنظیم کنید |
| دوربین کار نمی‌کند | مجوز Camera را در تنظیمات اندروید اپ فعال کنید |
| CORS Error | مطمئن شوید سرور بک‌اند در حال اجراست و `VITE_API_URL` درست تنظیم شده |

---

## 📁 ساختار پروژه

```
component-qc-inspector/
├── android/              ← پروژه Android (با Capacitor ساخته می‌شود)
├── public/               ← فایل‌های استاتیک (manifest, service worker)
├── src/
│   ├── components/       ← کامپوننت‌های React
│   ├── hooks/            ← هوک‌های سفارشی
│   ├── services/         ← ارتباط با API
│   ├── types/            ← تایپ‌های TypeScript
│   ├── App.tsx           ← کامپوننت اصلی
│   ├── main.tsx          ← نقطه ورود
│   └── index.css         ← استایل‌ها
├── server.ts             ← سرور Express + Gemini API
├── capacitor.config.ts   ← تنظیمات Capacitor
├── package.json          ← وابستگی‌ها
└── vite.config.ts        ← تنظیمات Vite
```

---

## ✅ تغییرات اعمال شده نسبت به نسخه اولیه

1. **رفع نسخه اشتباه `dotenv`** (۱۷.۲.۳ → ۱۶.۴.۷)
2. **رفع نام مدل نامعتبر** (`gemini-3.6-flash` → `gemini-2.0-flash`)
3. **اضافه شدن CORS** برای جلوگیری از بلاک شدن درخواست‌ها
4. **اضافه شدن Rate Limiting** (۳۰ درخواست در ۱۵ دقیقه)
5. **اعتبارسنجی Base64** ورودی تصویر
6. **هندلینگ بهتر خطاها** با پیام‌های فارسی
7. **اضافه شدن Capacitor** برای خروجی APK
8. **پیکربندی Android** با مجوز دوربین و FileProvider
9. **ساخت کامل UI** با React + Tailwind (دوربین، تنظیمات، نتایج، تاریخچه)
10. **PWA کامل** با Service Worker و Manifest

---

## 🔐 نکات امنیتی

- هرگز `GEMINI_API_KEY` را در کد سورس یا Git قرار ندهید
- در نسخه Production، Rate Limiting را روی سرور اصلی فعال نگه دارید
- برای انتشار عمومی، از `HTTPS` استفاده کنید

---

## 📞 پشتیبانی

در صورت بروز هرگونه خطا، لاگ کنسول مرورگر (`chrome://inspect`) و خروجی Android Studio (`Logcat`) را بررسی کنید.
