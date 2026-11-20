# Kurazh — плейбук службы поддержки

Внутренний документ для команды поддержки, Trust & Safety (T&S) и дежурных инженеров. Отражает, как работает продукт: роли Caller и Taker, заморозки на карте, бесплатные пропуски и плата за отказ, Courage score, KYC и раздел 18+. Публичный справочный центр для пользователей: `kurazh/support.html`.

> Статус: черновик v1 для запуска. Суммы указаны в долларах, как в `CUR` в `index.html`. Для гривны пересчитайте пороги по `unit`.

---

## 1. Как устроен продукт: что важно знать агенту

| Тема | Как работает |
| --- | --- |
| Роли | **Caller** пишет задание, подкрепляет его заморозкой на карте и голосует. **Taker** выходит в эфир, берёт задания и получает деньги. Один аккаунт может переключаться между ролями. |
| Заморозка (hold) | Это авторизация, а не списание. Списание (capture) происходит, только если ≥60% проголосовавших сказали, что задание засчитано. В остальных случаях заморозка снимается полностью. Частичного списания нет. |
| Лимит | $500 заморозок в день на аккаунт. |
| Доход Taker | Банк задания минус 20% комиссии зачисляется на Stream earnings. Вывод на карту от $20, только после KYC. |
| Настройки Taker | Минимальная ставка («Dares from $X»), минимальный возраст зрителя (18+ или 21+), до 3 тем, категории, типы заданий, число бесплатных пропусков за эфир (по умолчанию 3). |
| Отказ «Unsafe / against the rules» | Всегда бесплатно, пропуск не тратится, задание уходит в модерацию. В Courage score не учитывается. |
| Отказ «Pass» | Тратит бесплатный пропуск. Когда пропуски кончились, каждый следующий стоит 10% банка задания (минимум $1, максимум $20). Эта сумма делится между бэкерами задания пропорционально вкладам и приходит им как **decline bonus**. Их заморозки снимаются. |
| Тоже считается пропуском | Give up, истечение таймера, игнорирование задания дольше 2 минут. Во время режима Driving таймеры стоят. |
| Courage score | Публичный процент принятых заданий: принятые ÷ (принятые + пропуски). Отказы Unsafe и задания, снятые модерацией, не учитываются. |
| Аккаунт | Вход через Google или email + пароль. Подтверждение email 6-значным кодом, затем телефон и SMS-код при каждом входе. 5 неверных попыток подряд дают временную блокировку. |
| KYC | Документ (паспорт, ID-карта, права) с обеих сторон, если нужно, селфи-проверка «живой человек», сверка имени и даты рождения. Без KYC можно только смотреть и писать в чат. |
| 18+ | Отдельный раздел, вход после KYC и принятия правил. Жёсткие запреты: несовершеннолетние, встречи офлайн, обмен контактами, публичные места. Жалобы отсюда приоритетные. |
| Транспорт | Темы Road trip, Cars, Racing: задания на паузе, пока машина едет. Гонки только на закрытой трассе. |

**Демо-версия.** Сейчас приложение — демо: деньги учебные, коды показываются на экране, тикеты хранятся в `localStorage` (`kurazh.support.tickets`). Плейбук написан для рабочей версии.

---

## 2. Модель поддержки

### 2.1. Уровни (tiers)

| Уровень | Кто | Что делает | Полномочия |
| --- | --- | --- | --- |
| **T0 — самообслуживание** | Справочный центр, подсказки в приложении | Статьи (44+), поиск, статус сервисов, подсказки на экранах Hold и Wallet | — |
| **T1 — агенты первой линии** | Генералисты, смены 24/7 после запуска | Входящие тикеты, макросы, вопросы по заморозкам, входу, KYC, эфиру | Просмотр истории заморозок и платежей, повторная отправка кодов, снятие временной блокировки, выдача ссылок на статьи. **Без возвратов.** |
| **T2 — специалисты** | Платежи, аккаунты и KYC, Taker success | Споры по голосованию, decline bonus, задержки выплат, неудачный KYC, восстановление доступа | Возврат до $100 на один случай, ручное снятие зависшей заморозки, исключение технических таймаутов из Courage score, повторный KYC |
| **T3 — экспертные команды** | T&S, Payments ops, Legal, Engineering | Опасные ситуации, несовершеннолетние, чарджбэки, правовые запросы, инциденты | Остановка эфира, бан, заморозка выплат, ответ банку по чарджбэку, ответы на запросы полиции |

**Живая модерация** (T&S Live) — отдельная круглосуточная смена, которая смотрит очередь жалоб на эфиры. Она может остановить эфир сразу, не дожидаясь тикета.

### 2.2. Каналы

| Канал | Когда | Комментарий |
| --- | --- | --- |
| **В приложении** (Help → Contact support, кнопка Report на эфире) | С запуска, основной канал | Тикет сразу содержит аккаунт, устройство, ссылку на эфир и категорию. Путь «Urgent safety issue» идёт прямо в очередь T&S Live. |
| **Email** (support@…) | С запуска | Для тех, кто не может войти: потерян телефон, блокировка. Автоответ с номером тикета. Перед любыми действиями с аккаунтом — проверка личности. |
| **Telegram-бот** | Фаза 2, после 10k MAU | Статус тикета, FAQ, создание тикета. Без операций с деньгами и без запроса документов в чате. |
| Соцсети, сторы | Мониторинг | Публично отвечаем только «напишите нам в приложении». Никаких деталей аккаунта публично. |

Телефонной линии нет. Для опасных ситуаций всегда направляем в экстренные службы (112 в Украине и ЕС).

---

## 3. SLA по степени важности

| Уровень | Примеры | Первая реакция | Решение или план | Кто |
| --- | --- | --- | --- | --- |
| **S0 — жизнь и безопасность** | Опасное задание выполняется в эфире, подозрение на несовершеннолетнего в кадре, угрозы, самоповреждение | **≤ 2 мин** (действие модератора), ответ пользователю ≤ 15 мин | Остановить эфир ≤ 5 мин | T&S Live |
| **S1 — деньги, массовые сбои** | Списали, а задание не выполнено; двойное списание; выплата не пришла больше 3 рабочих дней; захват аккаунта; падение платежей или эфиров у многих | **≤ 1 ч** | ≤ 4 ч, споры ≤ 3 рабочих дней | T2 Payments, дежурный инженер |
| **S2 — функциональность** | Не идёт эфир на iPhone, не приходит SMS, KYC отклонён, decline bonus не пришёл | **≤ 4 ч** | ≤ 24 ч | T1 → T2 |
| **S3 — общие вопросы** | Как работает, предложения, Courage score, настройки | **≤ 24 ч** | ≤ 72 ч | T1 |

- SLA считается 24/7 для S0 и S1, для S2 и S3 — с учётом рабочих часов на этапе до 50k MAU.
- Ответ «мы проверяем» без сути не останавливает таймер решения.
- Тикеты категорий Payments, Payouts и Safety автоматически получают как минимум S2 (в демо — `priority: high`).

---

## 4. Штат в зависимости от числа пользователей

Исходные допущения: 3–5% MAU пишут в поддержку за месяц, 1 тикет требует 8 минут работы T1, около 20% эскалируются на T2. Живая модерация считается отдельно, по часам эфира.

| MAU | Тикетов в месяц | T1 | T2 | T&S Live (смены 24/7) | Прочее |
| --- | --- | --- | --- | --- | --- |
| до 5k (бета) | ~200 | 1 (основатели и ротация) | — | 1 дежурный на звонке плюс автоматический фильтр | Тимлид совмещает |
| 25k | ~1 000 | 2 | 1 | 5 FTE (1 модератор на смену) | Тимлид поддержки |
| 100k | ~4 000 | 6 | 2 (платежи, аккаунты) | 10 FTE (2 на смену) | QA 0,5, тимлид T&S |
| 500k | ~18 000 | 20 (по часовым поясам) | 6 | 30+ FTE, ML-предмодерация | QA 2, WFM 1, Knowledge manager 1 |

Правила: 1 T1 на ~800 тикетов в месяц; 1 модератор на ~150 одновременных эфиров при ML-предфильтре; T2 = 25–30% от T1. Языки: английский и украинский с запуска, остальные по данным о трафике.

---

## 5. Матрица эскалации

| Ситуация | Куда | Как быстро | Канал | Что приложить |
| --- | --- | --- | --- | --- |
| Опасное задание в эфире, угроза жизни, самоповреждение | **T&S Live** | Сразу | Кнопка «Escalate S0» в хелпдеске плюс пейджер | Ссылка на эфир, время, ID Taker и Caller |
| Подозрение на несовершеннолетнего | **T&S Live → T&S Lead → Legal** | Сразу | Пейджер | Только ссылки. Не скачивать и не пересылать материалы. |
| Домогательства, угрозы вне платформы, доксинг | **T&S** | ≤ 1 ч | Очередь T&S | Скриншоты от пользователя, ID |
| Спор по голосованию, «списали — не выполнено» | **T2 Payments** | ≤ 1 ч | Очередь Payments | ID задания, лог голосования, история HELD/CHARGED |
| Чарджбэк, подозрение на украденную карту | **Payments ops** | ≤ 4 ч | Очередь Payments, уведомление от провайдера | Ответ провайдера, история задания, запись голосования |
| Выплата задержана, KYC не совпадает с картой | **Payments ops** | ≤ 4 ч | Очередь Payments | ID выплаты, статус KYC |
| Запрос полиции, суда, регулятора; требование удалить данные (GDPR) | **Legal** | ≤ 1 рабочий день | legal@ | Оригинал запроса. Агент ничего не отвечает по существу. |
| Угроза иском, жалоба СМИ | **Legal + PR** | ≤ 4 ч | legal@ | Переписка |
| Массовый сбой (эфиры, коды, заморозки), рост однотипных тикетов больше 10 за 15 мин | **Engineering on-call** | ≤ 15 мин | Пейджер, канал #incidents | Примеры ID, устройства, время |
| Баг без массового эффекта | **Engineering** | Следующий спринт или по приоритету | Трекер | Шаги, устройство, iOS-версия, скриншот |

**Правило двух ключей:** возвраты свыше $100, баны Taker с доходом и разблокировка после захвата аккаунта подтверждает второй сотрудник T2 или T3.

---

## 6. Политика возвратов и споров

1. **Заморозка — не списание.** Если в истории RELEASED, денег мы не держим. Помогаем ссылкой на референс операции для банка. Возврат не делаем: возвращать нечего.
2. **Спор по голосованию** принимается в течение **7 дней** после списания. Проверяем лог голосования (аномалии: волна новых аккаунтов, голоса с одного устройства, голосование бэкеров против очевидного), запись эфира и жалобы. Возврат полный, если:
   - задание не соответствовало собственной формулировке;
   - доказаны накрутка или сговор;
   - задание нарушало правила и должно было быть снято.
   Если задание явно выполнено и голосование чистое, возврата нет, объясняем вежливо.
3. **Taker при возврате.** Возврат по спору списывается из Stream earnings Taker. При сговоре или накрутке Taker получает предупреждение или бан.
4. **Плата за отказ (decline fee)** не возвращается, если пропуск был осознанным. Возвращается, если:
   - таймаут или игнорирование вызваны подтверждённым сбоем (падение эфира на нашей стороне);
   - отказ Unsafe был ошибочно засчитан как Pass.
   В таком случае также исправляем Courage score. Decline bonus, уже выплаченный бэкерам, не отзываем, компенсируем из бюджета поддержки.
5. **Злоупотребление Unsafe**, чтобы не платить за отказ: после повторной проверки T&S плата может быть применена задним числом. Это указано в статье справки.
6. **Чарджбэк.** Сначала предлагаем внутренний спор. Пока чарджбэк открыт, заморозки на аккаунте инициатора приостановлены. Если банк встал на сторону пользователя, сумма удерживается из дохода Taker. Тот может прислать доказательства. Два и более необоснованных чарджбэка — закрытие аккаунта.
7. **Жесты доброй воли** (goodwill): T2 до $20 без согласования, только в виде кредита или возврата на карту. Не чаще 1 раза в 90 дней на пользователя.
8. Возвраты всегда идут **на исходную карту**. На другую карту или реквизиты — никогда.

---

## 7. Макросы ответов (английский и украинский)

Плейсхолдеры: `{name}`, `{amount}`, `{dare}`, `{date}`, `{ticket}`, `{ref}`, `{link}`. Подпись: «— {agent}, Kurazh Support». Тон: спокойный, на «вы», без канцелярита, первым предложением — суть. Никогда не просим пароль, коды из SMS или полный номер карты.

### M01. Заморозка всё ещё «в обработке» у банка

**EN:** Hi {name}, thanks for checking. The {amount} you see is a hold, not a charge. We released it on {date} (reference {ref}), so Kurazh no longer holds this money. Your bank removes the pending line on its own schedule, usually within a few days and occasionally up to 7 business days. If it's still there after that, you can show your bank the reference above, or reply here and we'll contact our payment provider.

**UK:** Вітаємо, {name}! Дякуємо, що звернулися. Сума {amount}, яку ви бачите, — це блокування, а не списання. Ми зняли його {date} (референс {ref}), тож Kurazh більше не утримує ці кошти. Банк прибирає запис «в обробці» за власним графіком: зазвичай за кілька днів, іноді до 7 робочих днів. Якщо він не зникне, покажіть банку цей референс або напишіть нам, і ми звернемося до платіжного провайдера.

### M02. Списали, но задание не выполнено

**EN:** Hi {name}, sorry about this. We only charge a hold when at least 60% of voters say the dare counts, so let's check what happened with "{dare}". I've opened a review of the vote log and the stream record. You'll have an answer within 3 business days. If the dare didn't match its own wording, or the vote was manipulated, we'll refund the full {amount} to your card.

**UK:** Вітаємо, {name}! Перепрошуємо за незручність. Ми списуємо кошти лише тоді, коли щонайменше 60% тих, хто голосував, визнали завдання виконаним. Тож перевіримо, що сталося із «{dare}». Я відкрив перевірку журналу голосування та запису ефіру. Відповідь буде протягом 3 робочих днів. Якщо завдання не відповідало своєму формулюванню або голосування було накручене, ми повернемо всі {amount} на вашу картку.

### M03. Оспорить результат голосования

**EN:** Hi {name}, thanks for flagging this vote. To review it, please send the stream link (or the Taker's nickname), the dare text and roughly when the vote happened. We check vote patterns, the stream record and any reports, and we reply within 3 business days. Disputes are accepted up to 7 days after a charge.

**UK:** Вітаємо, {name}! Дякуємо, що повідомили про голосування. Щоб ми могли перевірити, надішліть посилання на ефір (або нікнейм Taker), текст завдання і приблизний час голосування. Ми перевіряємо розподіл голосів, запис ефіру та скарги й відповідаємо протягом 3 робочих днів. Оскарження приймаємо до 7 днів після списання.

### M04. Вопрос о плате за отказ (для Taker)

**EN:** Hi {name}, you get {free_passes} free passes per stream. Once they're used, each further pass costs 10% of that dare's pot (minimum $1, maximum $20). On {date}, your free passes were used up, so passing on "{dare}" (pot {pot}) cost {fee}. That money went to the dare's backers as a decline bonus. Give up, timeouts and dares ignored for more than 2 minutes count as passes too. Declining a dare as "Unsafe / against the rules" is always free. If a technical drop caused this, tell us and we'll check the logs.

**UK:** Вітаємо, {name}! У вас є {free_passes} безкоштовних пропусків на ефір. Коли їх використано, кожен наступний пропуск коштує 10% банку завдання (мінімум $1, максимум $20). {date} безкоштовні пропуски закінчилися, тож пропуск «{dare}» (банк {pot}) коштував {fee}. Ці кошти отримали бекери завдання як decline bonus. Give up, тайм-аут і завдання без відповіді понад 2 хвилини теж вважаються пропусками. Відмова з позначкою «Unsafe / against the rules» завжди безкоштовна. Якщо причиною був технічний збій, напишіть нам, і ми перевіримо логи.

### M05. Decline bonus не пришёл

**EN:** Hi {name}, thanks for your patience. A decline bonus is paid only when the Taker passes after using all their free passes. It isn't paid for free passes, "unsafe" declines or failed votes. For "{dare}", I can see {status}. Bonuses go to the card you backed with, and banks can take 3–5 business days to show them. If 5 business days have passed, reply here and we'll trace the payment.

**UK:** Вітаємо, {name}! Дякуємо за терпіння. Decline bonus нараховується лише тоді, коли Taker пропускає завдання після того, як використав усі безкоштовні пропуски. Його немає за безкоштовні пропуски, відмови «unsafe» та невдале голосування. Щодо «{dare}» я бачу: {status}. Бонус надходить на картку, з якої ви підтримали завдання. Банку може знадобитися 3–5 робочих днів. Якщо минуло 5 робочих днів, напишіть нам, і ми відстежимо платіж.

### M06. Выплата задерживается

**EN:** Hi {name}, sorry your payout is taking longer. Your {amount} withdrawal from {date} is {status}. Most payouts arrive within minutes, some banks take 1–3 business days, and security reviews can take up to 48 hours. {reason_line} We'll update you here as soon as it's sent.

**UK:** Вітаємо, {name}! Перепрошуємо, що виплата затримується. Ваше виведення {amount} від {date} зараз у статусі {status}. Більшість виплат надходить за кілька хвилин, деяким банкам потрібно 1–3 робочі дні, а перевірка безпеки може тривати до 48 годин. {reason_line} Ми повідомимо вас тут, щойно кошти буде відправлено.

### M07. KYC не пройден

**EN:** Hi {name}, your identity check didn't go through because {reason}. Most retries succeed with even light, no glare, the whole document in frame (both sides for ID cards and licences) and a clear selfie without a hat or glasses. Make sure your account name and date of birth match the document exactly. You can try again from Profile → Verify identity.

**UK:** Вітаємо, {name}! Перевірка особи не пройшла, тому що {reason}. Найчастіше повторна спроба вдається, якщо світло рівне, немає відблисків, документ видно повністю (для ID-картки та прав — з обох боків), а селфі чітке, без головного убору й окулярів. Переконайтеся, що ім'я та дата народження в акаунті точно збігаються з документом. Спробувати ще раз можна в Profile → Verify identity.

### M08. Аккаунт заблокирован

**EN:** Hi {name}, after 5 incorrect passwords or codes, sign-in is paused for a short time to protect your account, and the screen shows when you can try again. {if_restriction: Your account also has a restriction because {reason}. To lift it, we need {next_step}.} We'll never ask for your password or SMS codes.

**UK:** Вітаємо, {name}! Після 5 неправильних паролів або кодів вхід тимчасово призупиняється, щоб захистити акаунт. На екрані видно, коли можна спробувати знову. {if_restriction: Також на акаунті є обмеження, тому що {reason}. Щоб його зняти, нам потрібно {next_step}.} Ми ніколи не просимо ваш пароль або SMS-коди.

### M09. Taker подвергается преследованию

**EN:** Hi {name}, we're sorry this happened, and thank you for telling us. Our Trust & Safety team is reviewing {user} now and will act on the account. In the meantime, you can block them from their profile, and decline any abusive dare as "Unsafe / against the rules". That's always free and doesn't affect your Courage score. If you feel physically unsafe, contact local emergency services (112 in Ukraine and the EU).

**UK:** Вітаємо, {name}! Нам дуже шкода, що так сталося, і дякуємо, що розповіли. Команда Trust & Safety вже перевіряє {user} і вживе заходів щодо акаунта. Тим часом ви можете заблокувати цю людину в її профілі, а будь-яке образливе завдання відхиляти як «Unsafe / against the rules». Це завжди безкоштовно й не впливає на Courage score. Якщо відчуваєте фізичну загрозу, звертайтеся до екстрених служб (112 в Україні та ЄС).

### M10. Подозрение на несовершеннолетнего

**EN:** Hi {name}, thank you for reporting this. It's our highest priority. Our moderation team has been alerted and can stop the stream and suspend the account while we check. Please don't record or share the content. We can't share the outcome for privacy reasons, but we act on every report like this.

**UK:** Вітаємо, {name}! Дякуємо за повідомлення. Для нас це найвищий пріоритет. Команду модерації вже сповіщено, вона може зупинити ефір і призупинити акаунт на час перевірки. Будь ласка, не записуйте й не поширюйте цей контент. Через конфіденційність ми не можемо повідомити результат, але реагуємо на кожне таке повідомлення.

### M11. Опасное задание всё-таки было выполнено

**EN:** Hi {name}, thank you for reporting this. That dare should never have run. We've removed it, released every hold on it (nobody was charged), and opened a Trust & Safety review of the stream and the accounts involved. If anyone was hurt, please contact local emergency services first (112 in Ukraine and the EU). We'll also use this case to tighten our safety filter.

**UK:** Вітаємо, {name}! Дякуємо за повідомлення. Це завдання взагалі не мало потрапити в ефір. Ми його видалили, зняли всі блокування (коштів ні з кого не списано) і відкрили перевірку ефіру та причетних акаунтів командою Trust & Safety. Якщо хтось постраждав, спершу зверніться до екстрених служб (112 в Україні та ЄС). Ми також використаємо цей випадок, щоб посилити фільтр безпеки.

### M12. Просьба о возврате

**EN:** Hi {name}, thanks for reaching out. I've checked "{dare}". {outcome_line} Refunds always go back to the card used for the hold, and banks usually show them within 5–10 business days.
_outcome_line варианты:_ "The hold was released on {date}, so nothing was charged." / "We've refunded {amount} (reference {ref})." / "The dare was completed and {pct}% voted that it counted, so the charge stands. If you have details we missed, reply here."

**UK:** Вітаємо, {name}! Дякуємо за звернення. Я перевірив «{dare}». {outcome_line} Повернення завжди надходить на картку, з якої було блокування. Банки зазвичай показують його протягом 5–10 робочих днів.
_варіанти outcome_line:_ «Блокування знято {date}, тож коштів не списано.» / «Ми повернули {amount} (референс {ref}).» / «Завдання виконано, і {pct}% проголосували, що воно зараховане, тому списання залишається в силі. Якщо у вас є деталі, яких ми не врахували, напишіть нам.»

### M13. Уведомление о чарджбэке

**EN (Caller):** Hi {name}, we've been notified of a chargeback on {amount} from {date}. While it's open, backing dares is paused on your account. If this was a mistake or you didn't recognise the payment, reply here. We can often resolve it faster directly. If your card was used without your permission, tell us now and we'll secure your account.

**UK (Caller):** Вітаємо, {name}! Ми отримали повідомлення про чарджбек на {amount} від {date}. Поки він відкритий, підтримку завдань на вашому акаунті призупинено. Якщо це помилка або ви не впізнали платіж, напишіть нам: часто ми можемо вирішити питання швидше напряму. Якщо вашою карткою скористалися без дозволу, повідомте нам зараз, і ми захистимо акаунт.

**EN (Taker):** Hi {name}, a backer has filed a chargeback on "{dare}" ({amount}). We've sent the bank the vote record and hold history. If the bank sides with the backer, the amount will be deducted from your Stream earnings. If you have anything that helps, such as the stream recording, reply here within 5 days.

**UK (Taker):** Вітаємо, {name}! Бекер подав чарджбек щодо «{dare}» ({amount}). Ми надіслали банку запис голосування та історію блокувань. Якщо банк стане на бік бекера, суму буде утримано з ваших Stream earnings. Якщо маєте щось корисне, наприклад запис ефіру, надішліть протягом 5 днів.

### M14. Не получается выйти в эфир на iPhone

**EN:** Hi {name}, let's get you live. In Safari, tap the aA icon → Website Settings and set Camera and Microphone to Allow. Or go to Settings → Apps → Safari (Settings → Safari on older iOS). Close FaceTime or any other app using the camera, then reload Kurazh. Also check Screen Time → Content & Privacy Restrictions. If it still fails, reply with your iOS version and a screenshot.

**UK:** Вітаємо, {name}! Допоможемо вийти в ефір. У Safari натисніть значок aA → Website Settings і дозвольте Camera та Microphone (Allow). Або відкрийте Settings → Apps → Safari (на старіших iOS — Settings → Safari). Закрийте FaceTime та інші застосунки, що використовують камеру, і перезавантажте Kurazh. Також перевірте Screen Time → Content & Privacy Restrictions. Якщо не вийде, надішліть версію iOS і скриншот.

### M15. Не работает вход через Google

**EN:** Hi {name}, sorry for the trouble signing in with Google. Please make sure pop-ups aren't blocked and your date and time are set automatically. If you use Kurazh from your Home Screen, try signing in once in Safari, then reopen the app. If you originally signed up with email, a different Google address creates a new account. Sign in with your password and link Google in Profile → Security. If it still fails, send us the time you tried and the error text.

**UK:** Вітаємо, {name}! Перепрошуємо за проблеми зі входом через Google. Переконайтеся, що спливні вікна не заблоковані, а дата й час встановлюються автоматично. Якщо ви відкриваєте Kurazh з головного екрана, спробуйте один раз увійти в Safari, а потім знову відкрийте застосунок. Якщо ви реєструвалися через email, інша Google-адреса створить новий акаунт. Увійдіть паролем і прив'яжіть Google у Profile → Security. Якщо не допоможе, надішліть час спроби й текст помилки.

### M16. Спор о Courage score

**EN:** Hi {name}, your Courage score is your public acceptance rate: dares accepted out of dares answered. Passes, give ups, timeouts and dares ignored for more than 2 minutes count. "Unsafe" declines and dares removed by moderation don't. I checked your stream on {date}: {finding}. {if_fixed: We've removed {n} dares that timed out because of a connection drop, so your score is now {score}.}

**UK:** Вітаємо, {name}! Courage score — це ваш публічний відсоток прийнятих завдань: прийняті з усіх, на які ви відповіли. Враховуються пропуски, give up, тайм-аути та завдання без відповіді понад 2 хвилини. Відмови «Unsafe» і завдання, зняті модерацією, не враховуються. Я перевірив ваш ефір {date}: {finding}. {if_fixed: Ми прибрали {n} завдань, що завершилися тайм-аутом через збій з'єднання, тож тепер ваш показник — {score}.}

### M17. Заблокирован Taker

**EN:** Hi {name}, a Taker can block anyone from their streams. It's a personal choice, so we can't reverse it. Any holds you had on their dares were released in full. You can keep calling dares on every other stream. If you believe the block is part of harassment or fraud, reply with details and our Trust & Safety team will look into it.

**UK:** Вітаємо, {name}! Taker може заблокувати будь-кого у своїх ефірах. Це особисте рішення, тому скасувати його ми не можемо. Усі ваші блокування коштів на його завданнях знято повністю. Ви й надалі можете пропонувати завдання в будь-яких інших ефірах. Якщо вважаєте, що блокування пов'язане з переслідуванням чи шахрайством, надішліть деталі, і команда Trust & Safety перевірить.

### M18. Возрастной барьер (18+, 21+, раздел 18+)

**EN:** Hi {name}, everyone on Kurazh must be 18 or older, and some Takers limit their streams to 21+. We use the date of birth from your verified ID, so we can't change it by hand. The 18+ section is separate: it needs a verified identity and acceptance of its rules, and you turn it on in Profile → 18+ section. If your verified date of birth is wrong, reply here and we'll restart verification.

**UK:** Вітаємо, {name}! Усі користувачі Kurazh мають бути старші 18 років, а деякі Taker обмежують ефіри до 21+. Ми використовуємо дату народження з вашого підтвердженого документа, тож змінити її вручну не можемо. Розділ 18+ окремий: потрібні підтверджена особа та згода з правилами, а вмикається він у Profile → 18+ section. Якщо дата народження визначилася неправильно, напишіть нам, і ми перезапустимо перевірку.

### M19. SMS-код не приходит (дополнительно)

**EN:** Hi {name}, sorry the code isn't arriving. Please wait 60 seconds and tap Resend, check that your number includes the country code, and make sure your phone has signal and isn't filtering unknown senders. Always use the newest code. If nothing arrives after 3 tries, reply here and we'll verify you another way.

**UK:** Вітаємо, {name}! Перепрошуємо, що код не надходить. Зачекайте 60 секунд і натисніть Resend, перевірте, що номер вказано з кодом країни, а телефон має зв'язок і не фільтрує невідомих відправників. Завжди використовуйте найновіший код. Якщо після 3 спроб нічого не прийде, напишіть нам, і ми підтвердимо вас іншим способом.

### M20. Вождение во время эфира (дополнительно)

**EN:** Hi {name}, on Road trip, Cars and Racing streams, dares pause while the vehicle is moving. Switch to Driving and timers stop, so nothing counts as ignored. Racing dares are allowed only on a closed track. Please never handle your phone while driving: mount it, or let a passenger run the stream.

**UK:** Вітаємо, {name}! В ефірах з темами Road trip, Cars і Racing завдання ставляться на паузу, поки авто рухається. Увімкніть режим Driving, і таймери зупиняться, тож жодне завдання не вважатиметься проігнорованим. Гоночні завдання дозволені лише на закритій трасі. Будь ласка, ніколи не тримайте телефон у руках за кермом: закріпіть його або доручіть ефір пасажиру.

---

## 8. Метрики качества

| Метрика | Определение | Цель на запуске | Цель через 6 мес. |
| --- | --- | --- | --- |
| **FRT** (first response time), медиана | От создания тикета до первого ответа человека | S0 ≤ 2 мин (действие), S1 ≤ 1 ч, S2 ≤ 4 ч, S3 ≤ 12 ч | S3 ≤ 4 ч |
| Доля тикетов в SLA | % тикетов с FRT в рамках SLA | ≥ 90% | ≥ 95% |
| **Время решения**, медиана | До статуса Resolved | ≤ 24 ч | ≤ 12 ч |
| **FCR** (first contact resolution) | Решено одним ответом | ≥ 60% | ≥ 70% |
| **CSAT** | Опрос после закрытия, 1–5, доля 4–5 | ≥ 85% | ≥ 90% |
| Reopen rate | Тикеты, открытые заново за 7 дней | ≤ 8% | ≤ 5% |
| Доля самообслуживания | Просмотры статей без последующего тикета за 24 ч | ≥ 70% | ≥ 80% |
| Контакты на 1 000 MAU | Тикеты ÷ MAU × 1000 | ≤ 40 | ≤ 25 |
| QA score | Аудит 5% тикетов по чек-листу: точность, тон, политика, безопасность | ≥ 90% | ≥ 92% |
| S0 time-to-action | От жалобы до остановки эфира или снятия задания | ≤ 5 мин (p95) | ≤ 2 мин (p95) |
| Доля возвратов по спорам | Удовлетворённые споры ÷ все списания | Мониторинг, сигнал при > 2% | — |

Еженедельно: топ-10 причин обращений, отчёт для продукта (что исправить, чтобы тикетов не было), обновление статей справки. Ежемесячно: калибровка QA между агентами.

**Чек-лист QA для одного тикета:** верно ли объяснена разница hold и charge; правильные ли цифры (60%, 20%, $1–$20, 10%, $20 минимум вывода, $500 в день); не запрошены ли пароль, коды или номер карты; предложены ли шаги безопасности; правильно ли выставлены уровень и эскалация.

---

## 9. Инструменты

| Задача | Рекомендация | Почему |
| --- | --- | --- |
| Хелпдеск | **Zendesk** или **Intercom** (на старте — Help Scout как бюджетный вариант) | Тикеты из приложения через SDK или API, макросы, SLA-политики, CSAT, многоязычность |
| База знаний | Свой `support.html` с контентом из CMS хелпдеска (Zendesk Guide или Intercom Articles) | Единый источник статей, поиск, аналитика просмотров |
| Контекст пользователя в тикете | Боковая панель (app sidebar) с аккаунтом, статусом KYC, историей HELD/CHARGED/RELEASED, Stream earnings, страйками | Агент не переключается между системами |
| Модерация | Очередь жалоб в админке плюс ML-предмодерация текста и видео (Hive, AWS Rekognition или аналоги) и PhotoDNA/хеш-матчинг для CSAM | Скорость S0, требования законодательства |
| Пейджинг | PagerDuty или Opsgenie | S0 и инциденты 24/7 |
| Статус-страница | Statuspage или Instatus, встроенный блок в `support.html` | Меньше тикетов во время сбоев |
| Платежи | Дашборд провайдера (Stripe, Adyen, Checkout.com), API для референсов заморозок и чарджбэков | Ответы M01, M02, M13 с точными референсами |
| KYC | Дашборд провайдера (Sumsub, Onfido, Veriff) | Причина отказа для M07 |
| Telegram (фаза 2) | Бот через интеграцию хелпдеска (Intercom или Zendesk Messaging) | Один инбокс для всех каналов |
| Аналитика | События `support_open`, `support_search`, `support_ticket_created`, `support_feedback` (через `KurazhAnalytics`) плюс отчёты хелпдеска | Самообслуживание, поисковые запросы без результатов |
| Внутренняя коммуникация | Каналы #support-escalations, #incidents, #tns-live | Быстрая эскалация |

**Безопасность данных:** доступ к документам KYC только у T2 KYC и T&S, с журналом; маскирование номеров карт; удаление вложений через 90 дней; двухфакторная аутентификация для всех агентов; без доступа к рабочим инструментам с личных устройств.

---

## 10. Приложение: быстрые ответы на частые вопросы для агента

- **«Сколько получит Taker?»** Банк × 0,8. Пример: $50 → $40.
- **«Сколько стоит отказ?»** Бесплатные пропуски (по умолчанию 3 на эфир). Дальше 10% банка, минимум $1, максимум $20. Примеры: $6 → $1; $45 → $4,50; $350 → $20. Отказ Unsafe всегда $0.
- **«Почему меня списали частично?»** Так не бывает: заморозка списывается целиком или снимается целиком. Ищите две разные операции.
- **«Когда пропадёт pending?»** Мы снимаем сразу. Банк — обычно до 7 рабочих дней, редко до 30.
