import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { getLocales } from "expo-localization";
import zhTW from "./locales/zh-TW.json";
import en from "./locales/en.json";

const deviceLocale = getLocales()[0]?.languageTag ?? "zh-TW";

i18n.use(initReactI18next).init({
  resources: {
    "zh-TW": { translation: zhTW },
    en: { translation: en },
  },
  lng: deviceLocale.startsWith("zh") ? "zh-TW" : "en",
  fallbackLng: "zh-TW",
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
