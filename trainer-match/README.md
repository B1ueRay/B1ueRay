# FitMatch

Застосунок для підбору персональних тренерів і клієнтів. Клієнт фільтрує тренерів за районом, залом, спеціалізацією та ціною; тренер переглядає клієнтів і сам може запросити когось на тренування. Обидві сторони працюють через заявки: одна сторона надсилає заявку, інша приймає або відхиляє.

## Можливості

- Реєстрація / вхід (JWT)
- Перемикач ролей "Я клієнт" / "Я тренер" в одному акаунті
- Профіль клієнта: ціль тренувань, бажані райони та зали
- Профіль тренера: спеціалізація, досвід, ціна, зали, де тренує
- Пошук з фільтрами (район, зал, спеціалізація, ціна)
- Заявки в обидва боки: клієнт → тренеру, тренер → клієнту, з прийняттям/відхиленням/скасуванням
- Інтерфейс українською, російською та англійською (перемикач мови)

## Технології

Node.js + Express, дані зберігаються у `data.json` (простий файловий стор без зовнішньої БД — достатньо для демо/невеликого навантаження). Фронтенд — vanilla HTML/CSS/JS без збірки, віддається статикою тим самим сервером.

## Запуск

```bash
cd trainer-match
npm install
npm start
```

Відкрити http://localhost:3000. При першому старті довідники районів і залів заповнюються автоматично (`src/seed.js`). Дані користувачів/профілів/заявок зберігаються у `data.json` у корені `trainer-match/` (у git не потрапляє).

## Структура API

- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- `GET /api/meta/districts`, `GET /api/meta/gyms?districtId=`
- `GET/PUT /api/profile/client`, `GET/PUT /api/profile/trainer`
- `GET /api/trainers?districtId=&gymId=&specialization=&maxPrice=`
- `GET /api/clients?districtId=&gymId=`
- `POST /api/applications/client-to-trainer`, `POST /api/applications/trainer-to-client`
- `GET /api/applications?as=client|trainer`
- `PATCH /api/applications/:id` `{ action: 'accept'|'decline'|'cancel' }`
