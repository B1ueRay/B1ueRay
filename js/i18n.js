'use strict';

const T = {
  uk: {
    nav: { home: 'Головна', gallery: 'Галерея', about: 'Про нас', contacts: 'Контакти' },
    cart_btn: 'Кошик',
    hero: {
      badge: '✦ Авторські роботи',
      title: 'Мистецтво, яке <em>живе</em> у вашому домі',
      desc: 'Колекція унікальних картин від українських художників. Кожна робота — це історія, емоція і частинка душі майстра.',
      btn_gallery: 'Дивитись галерею', btn_about: 'Про нас',
      stat_works: 'Робіт у колекції', stat_artists: 'Художників', stat_buyers: 'Задоволених покупців',
      tag_title: 'Захід над морем', tag_meta: 'Ігор Борщ · 2023 · Олія на полотні',
    },
    featured: { title: 'Вибрані роботи', subtitle: 'Свіжі надходження та найпопулярніші картини нашої галереї', btn_all: 'Дивитись усі роботи →' },
    how: {
      title: 'Як це працює', subtitle: 'Купити картину просто — від вибору до доставки за кілька кроків',
      s1t: 'Оберіть', s1d: 'Переглядайте колекцію, фільтруйте за стилем, ціною та технікою',
      s2t: 'Додайте до кошика', s2d: 'Натисніть «До кошика» та оформіть замовлення в один клік',
      s3t: 'Підтвердіть', s3d: 'Ми зв\'яжемося з вами для підтвердження та уточнення деталей',
      s4t: 'Отримайте', s4d: 'Доставка по всій Україні. Упаковка гарантує збереження',
    },
    banner: { title: 'Кожна картина — жива історія', desc: 'Ми співпрацюємо з українськими художниками, щоб донести їхню творчість до вашого дому. Всі роботи — оригінали з сертифікатом автентичності.', btn_gallery: 'Відкрити галерею', btn_contact: 'Зв\'язатися з нами' },
    gallery: {
      title: 'Галерея картин', subtitle: 'Унікальні авторські роботи українських художників',
      f_cat: 'Категорія', f_price: 'Максимальна ціна', f_tech: 'Техніка',
      s_default: 'За замовчуванням', s_new: 'Спочатку нові', s_asc: 'Ціна: зростання', s_desc: 'Ціна: спадання',
      found: 'Знайдено', works: 'робіт', empty_t: 'Нічого не знайдено', empty_d: 'Спробуйте змінити параметри пошуку',
    },
    cat: { all: 'Усі', landscape: 'Пейзаж', urban: 'Міський', abstract: 'Абстракція', portrait: 'Портрет', still_life: 'Натюрморт' },
    tech: { all: 'Усі', oil: 'Олія на полотні', acrylic: 'Акрил на полотні', watercolor: 'Акварель', mixed: 'Акрил, мікс-медіа' },
    cart: {
      title: 'Кошик', clear: 'Очистити кошик',
      w1: 'робота', w2: 'роботи', w5: 'робіт',
      subtotal: 'Сума', delivery: 'Доставка', total: 'Разом',
      checkout: 'Оформити замовлення', secure: '🔒 Безпечна оплата',
      note: 'Після оформлення замовлення ми зв\'яжемося з вами для підтвердження',
      empty_t: 'Кошик порожній', empty_d: 'Додайте картини, які вам сподобались, з галереї',
      btn_gallery: 'Перейти до галереї', confirm: 'Очистити кошик?',
      toast_empty: 'Кошик порожній', toast_ordered: 'Замовлення оформлено! Ми зв\'яжемося з вами найближчим часом.', free: 'Безкоштовно',
    },
    badge: { new: 'Новинка', sold: 'Продана', sale: 'Знижка' },
    card: { add: '+ До кошика', in_cart: '✓ У кошику', sold: 'Продана', details: 'Детальніше', buy: 'Купити' },
    modal: { close: 'Закрити', add: '🛒 До кошика', in_cart: '✓ У кошику', technique: 'Техніка', size: 'Розмір', category: 'Категорія', status: 'Статус', available: 'В наявності', sold: 'Продана' },
    toast_added: 'додано до кошика',
    footer: {
      tagline: 'Галерея авторських картин.\nМистецтво в кожен дім.',
      col_gallery: 'Галерея', all_works: 'Усі роботи', landscapes: 'Пейзажі', portraits: 'Портрети', abstract: 'Абстракція',
      col_info: 'Інформація', about: 'Про нас', delivery: 'Доставка', returns: 'Повернення', certs: 'Сертифікати',
      col_contacts: 'Контакти', write: 'Написати нам', instagram: 'Instagram',
      copy: '© 2024 ArtSpace. Всі права захищені.', made: 'Зроблено з ❤️ в Україні',
    },
    about: {
      hero_t: 'Про галерею <span style="color:var(--accent)">ArtSpace</span>',
      hero_d: 'Ми об\'єднуємо українських художників і цінителів мистецтва, щоб краса знаходила свій дім.',
      mission_label: 'Наша місія', mission_t: 'Мистецтво має бути доступним',
      mission_p1: 'ArtSpace — це онлайн-галерея, створена для того, щоб українські художники могли показати свої роботи всьому світу, а покупці могли знайти унікальні твори, які прикрасять їхній простір.',
      mission_p2: 'Кожна робота в нашій галереї — оригінал із сертифікатом автентичності. Ми ретельно відбираємо авторів і стежимо за якістю кожного твору.',
      stat_founded: '2020', stat_founded_l: 'Рік заснування', stat_artists: '8', stat_artists_l: 'Художників',
      stat_sold: '120+', stat_sold_l: 'Продано робіт', stat_buyers: '340+', stat_buyers_l: 'Покупців',
      artists_t: 'Наші художники', artists_d: 'Талановиті майстри, чиї роботи представлені в галереї',
      a1_name: 'Ігор Борщ', a1_spec: 'Пейзажист · Абстракціоніст', a1_bio: 'Випускник ДНУ. Працює у техніці олії та акрилу. Спеціалізується на морських пейзажах та абстрактних композиціях.',
      a2_name: 'Марія Степаненко', a2_spec: 'Натюрморт · Пейзаж', a2_bio: 'Майстер ніжних акварельних пейзажів і поетичних натюрмортів. Її роботи відрізняються особливою легкістю і повітряністю.',
      a3_name: 'Олексій Громов', a3_spec: 'Портрет · Міський пейзаж', a3_bio: 'Академічний художник з глибокими знаннями портретного живопису. Створює виразні міські сцени та тонкі психологічні портрети.',
      why_t: 'Чому обирають нас',
      w1t: 'Сертифікат автентичності', w1d: 'Кожна робота постачається з персональним сертифікатом художника',
      w2t: 'Професійна упаковка', w2d: 'Спеціальна упаковка захищає картину під час транспортування',
      w3t: 'Українські художники', w3d: 'Підтримуємо вітчизняне мистецтво та культуру',
      w4t: 'Особиста консультація', w4d: 'Допоможемо обрати картину, яка підійде саме вашому простору',
    },
    contact: {
      hero_t: 'Зв\'язатися з нами', hero_d: 'Відповімо на всі питання про картини, доставку та замовлення',
      info_t: 'Будемо раді допомогти',
      info_d: 'Якщо ви хочете дізнатися більше про картину, замовити особисту консультацію щодо вибору або домовитися про комісію — напишіть нам. Зазвичай відповідаємо протягом 24 годин.',
      hours_l: 'Години роботи', hours_v: 'Пн–Пт: 10:00 – 19:00',
      location_l: 'Місцезнаходження', location_v: 'Дніпро, Україна',
      form_t: 'Написати повідомлення',
      name_l: 'Ваше ім\'я', name_ph: 'Ім\'я',
      email_l: 'Email', email_ph: 'email@example.com',
      subject_l: 'Тема', subject_ph: 'Про що хочете написати?',
      msg_l: 'Повідомлення', msg_ph: 'Ваше запитання або побажання...',
      submit: 'Надіслати повідомлення',
      toast_sent: 'Ваше повідомлення надіслано! Дякуємо за звернення.',
    },
  },
  ru: {
    nav: { home: 'Главная', gallery: 'Галерея', about: 'О нас', contacts: 'Контакты' },
    cart_btn: 'Корзина',
    hero: {
      badge: '✦ Авторские работы',
      title: 'Искусство, которое <em>живёт</em> в вашем доме',
      desc: 'Коллекция уникальных картин от украинских художников. Каждая работа — это история, эмоция и частица души мастера.',
      btn_gallery: 'Смотреть галерею', btn_about: 'О нас',
      stat_works: 'Работ в коллекции', stat_artists: 'Художников', stat_buyers: 'Довольных покупателей',
      tag_title: 'Закат над морем', tag_meta: 'Игорь Борщ · 2023 · Масло на холсте',
    },
    featured: { title: 'Избранные работы', subtitle: 'Свежие поступления и самые популярные картины нашей галереи', btn_all: 'Смотреть все работы →' },
    how: {
      title: 'Как это работает', subtitle: 'Купить картину просто — от выбора до доставки за несколько шагов',
      s1t: 'Выберите', s1d: 'Просматривайте коллекцию, фильтруйте по стилю, цене и технике',
      s2t: 'Добавьте в корзину', s2d: 'Нажмите «В корзину» и оформите заказ в один клик',
      s3t: 'Подтвердите', s3d: 'Мы свяжемся с вами для подтверждения и уточнения деталей',
      s4t: 'Получите', s4d: 'Доставка по всей Украине. Упаковка гарантирует сохранность',
    },
    banner: { title: 'Каждая картина — живая история', desc: 'Мы сотрудничаем с украинскими художниками, чтобы донести их творчество до вашего дома. Все работы — оригиналы с сертификатом подлинности.', btn_gallery: 'Открыть галерею', btn_contact: 'Связаться с нами' },
    gallery: {
      title: 'Галерея картин', subtitle: 'Уникальные авторские работы украинских художников',
      f_cat: 'Категория', f_price: 'Максимальная цена', f_tech: 'Техника',
      s_default: 'По умолчанию', s_new: 'Сначала новые', s_asc: 'Цена: по возрастанию', s_desc: 'Цена: по убыванию',
      found: 'Найдено', works: 'работ', empty_t: 'Ничего не найдено', empty_d: 'Попробуйте изменить параметры поиска',
    },
    cat: { all: 'Все', landscape: 'Пейзаж', urban: 'Городской', abstract: 'Абстракция', portrait: 'Портрет', still_life: 'Натюрморт' },
    tech: { all: 'Все', oil: 'Масло на холсте', acrylic: 'Акрил на холсте', watercolor: 'Акварель', mixed: 'Акрил, микс-медиа' },
    cart: {
      title: 'Корзина', clear: 'Очистить корзину',
      w1: 'работа', w2: 'работы', w5: 'работ',
      subtotal: 'Сумма', delivery: 'Доставка', total: 'Итого',
      checkout: 'Оформить заказ', secure: '🔒 Безопасная оплата',
      note: 'После оформления заказа мы свяжемся с вами для подтверждения',
      empty_t: 'Корзина пуста', empty_d: 'Добавьте понравившиеся работы из галереи',
      btn_gallery: 'Перейти в галерею', confirm: 'Очистить корзину?',
      toast_empty: 'Корзина пуста', toast_ordered: 'Заказ оформлен! Мы свяжемся с вами в ближайшее время.', free: 'Бесплатно',
    },
    badge: { new: 'Новинка', sold: 'Продана', sale: 'Скидка' },
    card: { add: '+ В корзину', in_cart: '✓ В корзине', sold: 'Продана', details: 'Подробнее', buy: 'Купить' },
    modal: { close: 'Закрыть', add: '🛒 В корзину', in_cart: '✓ В корзине', technique: 'Техника', size: 'Размер', category: 'Категория', status: 'Статус', available: 'В наличии', sold: 'Продана' },
    toast_added: 'добавлена в корзину',
    footer: {
      tagline: 'Галерея авторских картин.\nИскусство в каждый дом.',
      col_gallery: 'Галерея', all_works: 'Все работы', landscapes: 'Пейзажи', portraits: 'Портреты', abstract: 'Абстракция',
      col_info: 'Информация', about: 'О нас', delivery: 'Доставка', returns: 'Возврат', certs: 'Сертификаты',
      col_contacts: 'Контакты', write: 'Написать нам', instagram: 'Instagram',
      copy: '© 2024 ArtSpace. Все права защищены.', made: 'Сделано с ❤️ в Украине',
    },
    about: {
      hero_t: 'О галерее <span style="color:var(--accent)">ArtSpace</span>',
      hero_d: 'Мы объединяем украинских художников и ценителей искусства, чтобы красота находила свой дом.',
      mission_label: 'Наша миссия', mission_t: 'Искусство должно быть доступным',
      mission_p1: 'ArtSpace — это онлайн-галерея, созданная для того, чтобы украинские художники могли показать свои работы всему миру, а покупатели могли найти уникальные произведения, которые украсят их пространство.',
      mission_p2: 'Каждая работа в нашей галерее — оригинал с сертификатом подлинности. Мы тщательно отбираем авторов и следим за качеством каждого произведения.',
      stat_founded: '2020', stat_founded_l: 'Год основания', stat_artists: '8', stat_artists_l: 'Художников',
      stat_sold: '120+', stat_sold_l: 'Работ продано', stat_buyers: '340+', stat_buyers_l: 'Покупателей',
      artists_t: 'Наши художники', artists_d: 'Талантливые мастера, чьи работы представлены в галерее',
      a1_name: 'Игорь Борщ', a1_spec: 'Пейзажист · Абстракционист', a1_bio: 'Выпускник ДНУ. Работает в технике масла и акрила. Специализируется на морских пейзажах и абстрактных композициях.',
      a2_name: 'Мария Степаненко', a2_spec: 'Натюрморт · Пейзаж', a2_bio: 'Мастер нежных акварельных пейзажей и поэтичных натюрмортов. Её работы отличаются особой лёгкостью и воздушностью.',
      a3_name: 'Алексей Громов', a3_spec: 'Портрет · Городской пейзаж', a3_bio: 'Академический художник с глубокими знаниями портретной живописи. Создаёт выразительные городские сцены и тонкие психологические портреты.',
      why_t: 'Почему выбирают нас',
      w1t: 'Сертификат подлинности', w1d: 'Каждая работа поставляется с персональным сертификатом художника',
      w2t: 'Профессиональная упаковка', w2d: 'Специальная упаковка защищает картину во время транспортировки',
      w3t: 'Украинские художники', w3d: 'Поддерживаем отечественное искусство и культуру',
      w4t: 'Личная консультация', w4d: 'Поможем выбрать картину, которая подойдёт именно вашему пространству',
    },
    contact: {
      hero_t: 'Связаться с нами', hero_d: 'Ответим на все вопросы о картинах, доставке и заказах',
      info_t: 'Будем рады помочь',
      info_d: 'Если вы хотите узнать больше о картине, заказать персональную консультацию по выбору или договориться о комиссии — напишите нам. Обычно отвечаем в течение 24 часов.',
      hours_l: 'Часы работы', hours_v: 'Пн–Пт: 10:00 – 19:00',
      location_l: 'Местонахождение', location_v: 'Днепр, Украина',
      form_t: 'Написать сообщение',
      name_l: 'Ваше имя', name_ph: 'Имя',
      email_l: 'Email', email_ph: 'email@example.com',
      subject_l: 'Тема', subject_ph: 'О чём хотите написать?',
      msg_l: 'Сообщение', msg_ph: 'Ваш вопрос или пожелание...',
      submit: 'Отправить сообщение',
      toast_sent: 'Ваше сообщение отправлено! Спасибо за обращение.',
    },
  },
  en: {
    nav: { home: 'Home', gallery: 'Gallery', about: 'About', contacts: 'Contacts' },
    cart_btn: 'Cart',
    hero: {
      badge: '✦ Original artworks',
      title: 'Art that <em>lives</em> in your home',
      desc: 'A collection of unique paintings by Ukrainian artists. Each work is a story, an emotion and a piece of the master\'s soul.',
      btn_gallery: 'View Gallery', btn_about: 'About Us',
      stat_works: 'Works in collection', stat_artists: 'Artists', stat_buyers: 'Happy buyers',
      tag_title: 'Sunset over the Sea', tag_meta: 'Igor Borshch · 2023 · Oil on canvas',
    },
    featured: { title: 'Featured Works', subtitle: 'Fresh arrivals and the most popular paintings in our gallery', btn_all: 'View all works →' },
    how: {
      title: 'How It Works', subtitle: 'Buying a painting is easy — from choice to delivery in a few steps',
      s1t: 'Choose', s1d: 'Browse the collection, filter by style, price and technique',
      s2t: 'Add to Cart', s2d: 'Click "Add to Cart" and place your order in one click',
      s3t: 'Confirm', s3d: 'We\'ll contact you to confirm and clarify details',
      s4t: 'Receive', s4d: 'Delivery across Ukraine. Packaging guarantees safety',
    },
    banner: { title: 'Every painting is a living story', desc: 'We work with Ukrainian artists to bring their creativity to your home. All works are originals with a certificate of authenticity.', btn_gallery: 'Open Gallery', btn_contact: 'Contact Us' },
    gallery: {
      title: 'Painting Gallery', subtitle: 'Unique original works by Ukrainian artists',
      f_cat: 'Category', f_price: 'Maximum Price', f_tech: 'Technique',
      s_default: 'Default', s_new: 'Newest first', s_asc: 'Price: lowest first', s_desc: 'Price: highest first',
      found: 'Found', works: 'works', empty_t: 'Nothing found', empty_d: 'Try adjusting your search parameters',
    },
    cat: { all: 'All', landscape: 'Landscape', urban: 'Urban', abstract: 'Abstract', portrait: 'Portrait', still_life: 'Still Life' },
    tech: { all: 'All', oil: 'Oil on canvas', acrylic: 'Acrylic on canvas', watercolor: 'Watercolor', mixed: 'Acrylic, mixed media' },
    cart: {
      title: 'Cart', clear: 'Clear cart',
      w1: 'work', w2: 'works', w5: 'works',
      subtotal: 'Subtotal', delivery: 'Delivery', total: 'Total',
      checkout: 'Place Order', secure: '🔒 Secure payment',
      note: 'After placing your order we will contact you to confirm',
      empty_t: 'Cart is empty', empty_d: 'Add paintings you like from the gallery',
      btn_gallery: 'Go to Gallery', confirm: 'Clear cart?',
      toast_empty: 'Cart is empty', toast_ordered: 'Order placed! We\'ll contact you shortly.', free: 'Free',
    },
    badge: { new: 'New', sold: 'Sold', sale: 'Sale' },
    card: { add: '+ Add to Cart', in_cart: '✓ In Cart', sold: 'Sold', details: 'Details', buy: 'Buy' },
    modal: { close: 'Close', add: '🛒 Add to Cart', in_cart: '✓ In Cart', technique: 'Technique', size: 'Size', category: 'Category', status: 'Status', available: 'Available', sold: 'Sold' },
    toast_added: 'added to cart',
    footer: {
      tagline: 'Gallery of original paintings.\nArt for every home.',
      col_gallery: 'Gallery', all_works: 'All works', landscapes: 'Landscapes', portraits: 'Portraits', abstract: 'Abstract',
      col_info: 'Information', about: 'About Us', delivery: 'Delivery', returns: 'Returns', certs: 'Certificates',
      col_contacts: 'Contacts', write: 'Write to Us', instagram: 'Instagram',
      copy: '© 2024 ArtSpace. All rights reserved.', made: 'Made with ❤️ in Ukraine',
    },
    about: {
      hero_t: 'About <span style="color:var(--accent)">ArtSpace</span> Gallery',
      hero_d: 'We connect Ukrainian artists and art lovers so that beauty finds its home.',
      mission_label: 'Our Mission', mission_t: 'Art should be accessible',
      mission_p1: 'ArtSpace is an online gallery created so Ukrainian artists can showcase their work to the world, and buyers can find unique pieces that will decorate their space.',
      mission_p2: 'Every work in our gallery is an original with a certificate of authenticity. We carefully select artists and monitor the quality of each piece.',
      stat_founded: '2020', stat_founded_l: 'Founded', stat_artists: '8', stat_artists_l: 'Artists',
      stat_sold: '120+', stat_sold_l: 'Works sold', stat_buyers: '340+', stat_buyers_l: 'Buyers',
      artists_t: 'Our Artists', artists_d: 'Talented masters whose works are featured in the gallery',
      a1_name: 'Igor Borshch', a1_spec: 'Landscape · Abstract', a1_bio: 'Graduate of DNU. Works in oil and acrylic. Specializes in seascapes and abstract compositions.',
      a2_name: 'Maria Stepanenko', a2_spec: 'Still Life · Landscape', a2_bio: 'Master of delicate watercolor landscapes and poetic still lifes. Her works are known for their lightness and airiness.',
      a3_name: 'Alexey Gromov', a3_spec: 'Portrait · Urban Landscape', a3_bio: 'Academic artist with deep knowledge of portrait painting. Creates expressive urban scenes and subtle psychological portraits.',
      why_t: 'Why Choose Us',
      w1t: 'Certificate of Authenticity', w1d: 'Each work comes with a personal certificate from the artist',
      w2t: 'Professional Packaging', w2d: 'Special packaging protects the painting during transportation',
      w3t: 'Ukrainian Artists', w3d: 'Supporting domestic art and culture',
      w4t: 'Personal Consultation', w4d: 'We\'ll help you choose a painting that suits your space',
    },
    contact: {
      hero_t: 'Contact Us', hero_d: 'We\'ll answer all questions about paintings, delivery and orders',
      info_t: 'We\'d be happy to help',
      info_d: 'If you want to learn more about a painting, order a personal consultation, or arrange a commission — write to us. We usually respond within 24 hours.',
      hours_l: 'Working hours', hours_v: 'Mon–Fri: 10:00 – 19:00',
      location_l: 'Location', location_v: 'Dnipro, Ukraine',
      form_t: 'Send a message',
      name_l: 'Your name', name_ph: 'Name',
      email_l: 'Email', email_ph: 'email@example.com',
      subject_l: 'Subject', subject_ph: 'What would you like to write about?',
      msg_l: 'Message', msg_ph: 'Your question or request...',
      submit: 'Send message',
      toast_sent: 'Your message has been sent! Thank you for reaching out.',
    },
  },
  es: {
    nav: { home: 'Inicio', gallery: 'Galería', about: 'Nosotros', contacts: 'Contactos' },
    cart_btn: 'Carrito',
    hero: {
      badge: '✦ Obras originales',
      title: 'Arte que <em>vive</em> en tu hogar',
      desc: 'Una colección de pinturas únicas de artistas ucranianos. Cada obra es una historia, una emoción y una parte del alma del maestro.',
      btn_gallery: 'Ver Galería', btn_about: 'Sobre nosotros',
      stat_works: 'Obras en colección', stat_artists: 'Artistas', stat_buyers: 'Compradores felices',
      tag_title: 'Puesta de Sol sobre el Mar', tag_meta: 'Igor Borshch · 2023 · Óleo sobre lienzo',
    },
    featured: { title: 'Obras Destacadas', subtitle: 'Nuevas llegadas y las pinturas más populares de nuestra galería', btn_all: 'Ver todas las obras →' },
    how: {
      title: 'Cómo Funciona', subtitle: 'Comprar una pintura es fácil — desde la elección hasta la entrega en pocos pasos',
      s1t: 'Elige', s1d: 'Explora la colección, filtra por estilo, precio y técnica',
      s2t: 'Añade al Carrito', s2d: 'Haz clic en "Al Carrito" y realiza tu pedido con un clic',
      s3t: 'Confirma', s3d: 'Nos pondremos en contacto para confirmar y aclarar detalles',
      s4t: 'Recibe', s4d: 'Entrega en toda Ucrania. El embalaje garantiza la seguridad',
    },
    banner: { title: 'Cada cuadro es una historia viva', desc: 'Trabajamos con artistas ucranianos para llevar su creatividad a tu hogar. Todas las obras son originales con certificado de autenticidad.', btn_gallery: 'Abrir Galería', btn_contact: 'Contáctanos' },
    gallery: {
      title: 'Galería de Pinturas', subtitle: 'Obras originales únicas de artistas ucranianos',
      f_cat: 'Categoría', f_price: 'Precio Máximo', f_tech: 'Técnica',
      s_default: 'Por defecto', s_new: 'Más recientes', s_asc: 'Precio: menor a mayor', s_desc: 'Precio: mayor a menor',
      found: 'Encontrado', works: 'obras', empty_t: 'Nada encontrado', empty_d: 'Intenta ajustar los parámetros de búsqueda',
    },
    cat: { all: 'Todo', landscape: 'Paisaje', urban: 'Urbano', abstract: 'Abstracto', portrait: 'Retrato', still_life: 'Naturaleza muerta' },
    tech: { all: 'Todo', oil: 'Óleo sobre lienzo', acrylic: 'Acrílico sobre lienzo', watercolor: 'Acuarela', mixed: 'Acrílico, técnica mixta' },
    cart: {
      title: 'Carrito', clear: 'Vaciar carrito',
      w1: 'obra', w2: 'obras', w5: 'obras',
      subtotal: 'Subtotal', delivery: 'Envío', total: 'Total',
      checkout: 'Realizar Pedido', secure: '🔒 Pago seguro',
      note: 'Después de realizar el pedido nos pondremos en contacto para confirmar',
      empty_t: 'El carrito está vacío', empty_d: 'Añade las pinturas que te gusten de la galería',
      btn_gallery: 'Ir a la Galería', confirm: '¿Vaciar el carrito?',
      toast_empty: 'El carrito está vacío', toast_ordered: '¡Pedido realizado! Nos pondremos en contacto pronto.', free: 'Gratis',
    },
    badge: { new: 'Nuevo', sold: 'Vendido', sale: 'Oferta' },
    card: { add: '+ Al Carrito', in_cart: '✓ En Carrito', sold: 'Vendido', details: 'Detalles', buy: 'Comprar' },
    modal: { close: 'Cerrar', add: '🛒 Al Carrito', in_cart: '✓ En Carrito', technique: 'Técnica', size: 'Tamaño', category: 'Categoría', status: 'Estado', available: 'Disponible', sold: 'Vendido' },
    toast_added: 'añadido al carrito',
    footer: {
      tagline: 'Galería de pinturas originales.\nArte para cada hogar.',
      col_gallery: 'Galería', all_works: 'Todas las obras', landscapes: 'Paisajes', portraits: 'Retratos', abstract: 'Abstracto',
      col_info: 'Información', about: 'Sobre nosotros', delivery: 'Envío', returns: 'Devoluciones', certs: 'Certificados',
      col_contacts: 'Contactos', write: 'Escríbenos', instagram: 'Instagram',
      copy: '© 2024 ArtSpace. Todos los derechos reservados.', made: 'Hecho con ❤️ en Ucrania',
    },
    about: {
      hero_t: 'Sobre la Galería <span style="color:var(--accent)">ArtSpace</span>',
      hero_d: 'Conectamos artistas ucranianos y amantes del arte para que la belleza encuentre su hogar.',
      mission_label: 'Nuestra Misión', mission_t: 'El arte debe ser accesible',
      mission_p1: 'ArtSpace es una galería en línea creada para que artistas ucranianos puedan mostrar su trabajo al mundo, y los compradores puedan encontrar piezas únicas que decoren su espacio.',
      mission_p2: 'Cada obra en nuestra galería es un original con certificado de autenticidad. Seleccionamos cuidadosamente a los artistas y controlamos la calidad de cada pieza.',
      stat_founded: '2020', stat_founded_l: 'Fundado en', stat_artists: '8', stat_artists_l: 'Artistas',
      stat_sold: '120+', stat_sold_l: 'Obras vendidas', stat_buyers: '340+', stat_buyers_l: 'Compradores',
      artists_t: 'Nuestros Artistas', artists_d: 'Maestros talentosos cuyas obras se presentan en la galería',
      a1_name: 'Igor Borshch', a1_spec: 'Paisajista · Abstracto', a1_bio: 'Graduado de DNU. Trabaja en óleo y acrílico. Especializado en marinas y composiciones abstractas.',
      a2_name: 'Maria Stepanenko', a2_spec: 'Naturaleza muerta · Paisaje', a2_bio: 'Maestra de delicados paisajes acuarela y naturalezas muertas poéticas. Sus obras son conocidas por su ligereza y luminosidad.',
      a3_name: 'Alexey Gromov', a3_spec: 'Retrato · Paisaje Urbano', a3_bio: 'Artista académico con profundo conocimiento de la pintura de retratos. Crea escenas urbanas expresivas y sutiles retratos psicológicos.',
      why_t: 'Por Qué Elegirnos',
      w1t: 'Certificado de Autenticidad', w1d: 'Cada obra viene con un certificado personal del artista',
      w2t: 'Embalaje Profesional', w2d: 'El embalaje especial protege la pintura durante el transporte',
      w3t: 'Artistas Ucranianos', w3d: 'Apoyamos el arte y la cultura nacionales',
      w4t: 'Consulta Personal', w4d: 'Te ayudaremos a elegir una pintura que se adapte a tu espacio',
    },
    contact: {
      hero_t: 'Contáctanos', hero_d: 'Responderemos todas las preguntas sobre pinturas, envíos y pedidos',
      info_t: 'Estaremos encantados de ayudarte',
      info_d: 'Si quieres saber más sobre una pintura, solicitar una consulta personal, o acordar una comisión — escríbenos. Solemos responder en 24 horas.',
      hours_l: 'Horario', hours_v: 'Lun–Vie: 10:00 – 19:00',
      location_l: 'Ubicación', location_v: 'Dnipro, Ucrania',
      form_t: 'Enviar un mensaje',
      name_l: 'Tu nombre', name_ph: 'Nombre',
      email_l: 'Email', email_ph: 'email@example.com',
      subject_l: 'Asunto', subject_ph: '¿Sobre qué quieres escribir?',
      msg_l: 'Mensaje', msg_ph: 'Tu pregunta o solicitud...',
      submit: 'Enviar mensaje',
      toast_sent: '¡Tu mensaje ha sido enviado! Gracias por contactarnos.',
    },
  },
};

// ── Language helpers ─────────────────────────────────────────────────────────
const LANG_META = {
  uk: { flag: '🇺🇦', code: 'UA', label: 'Українська' },
  ru: { flag: '🇷🇺', code: 'RU', label: 'Русский' },
  en: { flag: '🇬🇧', code: 'EN', label: 'English' },
  es: { flag: '🇪🇸', code: 'ES', label: 'Español' },
};

let currentLang = localStorage.getItem('art_lang') || 'uk';

function setLang(lang) {
  if (!T[lang]) return;
  currentLang = lang;
  localStorage.setItem('art_lang', lang);
  applyTranslations();
}

function t(section, key) {
  const sec = T[currentLang][section];
  return sec ? (sec[key] !== undefined ? sec[key] : '') : '';
}

function applyTranslations() {
  // data-i18n="section.key" → textContent
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const [sec, key] = el.dataset.i18n.split('.');
    const val = t(sec, key);
    if (val !== '') el.textContent = val;
  });
  // data-i18n-html="section.key" → innerHTML
  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    const [sec, key] = el.dataset.i18nHtml.split('.');
    const val = t(sec, key);
    if (val !== '') el.innerHTML = val;
  });
  // data-i18n-ph="section.key" → placeholder
  document.querySelectorAll('[data-i18n-ph]').forEach(el => {
    const [sec, key] = el.dataset.i18nPh.split('.');
    const val = t(sec, key);
    if (val !== '') el.placeholder = val;
  });
  updateLangSwitcherUI();
}

function updateLangSwitcherUI() {
  const meta = LANG_META[currentLang];
  document.querySelectorAll('.lang-flag').forEach(el => el.textContent = meta.flag);
  document.querySelectorAll('.lang-code').forEach(el => el.textContent = meta.code);
  document.querySelectorAll('.lang-opt').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === currentLang);
  });
}

function initLangSwitcher() {
  document.querySelectorAll('#lang-toggle').forEach(toggle => {
    const dropdown = toggle.nextElementSibling;
    toggle.addEventListener('click', e => {
      e.stopPropagation();
      dropdown.classList.toggle('open');
    });
    document.addEventListener('click', () => dropdown.classList.remove('open'));
  });
  document.querySelectorAll('.lang-opt').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      setLang(btn.dataset.lang);
      btn.closest('.lang-dropdown').classList.remove('open');
      // re-render dynamic content
      if (typeof renderDynamic === 'function') renderDynamic();
    });
  });
  applyTranslations();
}
