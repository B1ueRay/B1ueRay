const I18N = {
  uk: {
    langName: 'Українська',
    subtitle: 'Стеж за технікою присідань у реальному часі',
    startBtn: '▶️ Почати',
    stopBtn: '⏹ Зупинити',
    muteLabel: 'Без голосу',
    repsLabel: 'Повторення',
    phaseLabel: 'Фаза',
    phaseStanding: 'Стійка',
    phaseDescending: 'Опускання',
    phaseBottom: 'Низ',
    phaseAscending: 'Підйом',
    cameraFront: 'Фронтальна камера',
    cameraBack: 'Основна камера',
    overlayNoPerson: 'Стань так, щоб тебе було видно у повний ріст',
    overlayLoadingModel: 'Завантажую модель розпізнавання пози…',
    overlayRequestingCamera: 'Запитую доступ до камери…',
    hintText: 'Поклади телефон так, щоб у кадр влазив увесь ти, бажано трохи збоку. Увімкни звук або навушники — порада голосом.',
    privacyNote: '🔒 Відео обробляється локально в браузері телефону і нікуди не надсилається.',
    errCameraDenied: 'Немає доступу до камери',
    errNotSupported: 'Цей браузер не підтримує потрібні функції',
    cueGoDeeper: 'Нижче!',
    cueStraightenBack: 'Випрямся спиною',
    cueStraightenBackUrgent: 'Спину прямо!',
    cueSlowerDown: 'Повільніше',
    cueControlledUp: 'Контрольовано вгору',
    cueGoodRep: 'Добре!',
    cueGreatDepth: 'Чудова глибина!',
  },
  ru: {
    langName: 'Русский',
    subtitle: 'Следи за техникой приседаний в реальном времени',
    startBtn: '▶️ Начать',
    stopBtn: '⏹ Остановить',
    muteLabel: 'Без голоса',
    repsLabel: 'Повторения',
    phaseLabel: 'Фаза',
    phaseStanding: 'Стойка',
    phaseDescending: 'Опускание',
    phaseBottom: 'Низ',
    phaseAscending: 'Подъём',
    cameraFront: 'Фронтальная камера',
    cameraBack: 'Основная камера',
    overlayNoPerson: 'Встань так, чтобы тебя было видно в полный рост',
    overlayLoadingModel: 'Загружаю модель распознавания позы…',
    overlayRequestingCamera: 'Запрашиваю доступ к камере…',
    hintText: 'Поставь телефон так, чтобы в кадр влезал весь ты, желательно немного сбоку. Включи звук или наушники — подсказки голосом.',
    privacyNote: '🔒 Видео обрабатывается локально в браузере телефона и никуда не отправляется.',
    errCameraDenied: 'Нет доступа к камере',
    errNotSupported: 'Этот браузер не поддерживает нужные функции',
    cueGoDeeper: 'Ниже!',
    cueStraightenBack: 'Выпрямись спиной',
    cueStraightenBackUrgent: 'Спину прямо!',
    cueSlowerDown: 'Медленнее',
    cueControlledUp: 'Контролируемо вверх',
    cueGoodRep: 'Хорошо!',
    cueGreatDepth: 'Отличная глубина!',
  },
  en: {
    langName: 'English',
    subtitle: 'Live squat form feedback',
    startBtn: '▶️ Start',
    stopBtn: '⏹ Stop',
    muteLabel: 'Mute voice',
    repsLabel: 'Reps',
    phaseLabel: 'Phase',
    phaseStanding: 'Standing',
    phaseDescending: 'Descending',
    phaseBottom: 'Bottom',
    phaseAscending: 'Ascending',
    cameraFront: 'Front camera',
    cameraBack: 'Back camera',
    overlayNoPerson: 'Stand so your whole body is in frame',
    overlayLoadingModel: 'Loading pose model…',
    overlayRequestingCamera: 'Requesting camera access…',
    hintText: 'Prop the phone up so your whole body is in frame, ideally from a slight side angle. Turn on sound or headphones for voice cues.',
    privacyNote: '🔒 Video is processed locally in your phone’s browser and is never sent anywhere.',
    errCameraDenied: 'Camera access denied',
    errNotSupported: 'This browser does not support the required features',
    cueGoDeeper: 'Go lower!',
    cueStraightenBack: 'Straighten your back',
    cueStraightenBackUrgent: 'Chest up, back straight!',
    cueSlowerDown: 'Slow down',
    cueControlledUp: 'Drive up with control',
    cueGoodRep: 'Nice rep!',
    cueGreatDepth: 'Great depth!',
  },
};

const SPEECH_LANG = { uk: 'uk-UA', ru: 'ru-RU', en: 'en-US' };

let currentLang = localStorage.getItem('squatcoach_lang') || 'uk';

function t(key) {
  return (I18N[currentLang] && I18N[currentLang][key]) || I18N.uk[key] || key;
}

function setLang(lang) {
  if (!I18N[lang]) return;
  currentLang = lang;
  localStorage.setItem('squatcoach_lang', lang);
  if (typeof onLangChange === 'function') onLangChange();
}
