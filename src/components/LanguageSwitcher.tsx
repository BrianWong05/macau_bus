import { useTranslation } from 'react-i18next';

const languages = [
  { code: 'zh-TW', label: '繁中' },
  { code: 'en', label: 'EN' },
  { code: 'pt', label: 'PT' },
];

export const LanguageSwitcher = () => {
  const { i18n } = useTranslation();

  return (
    <div className="flex gap-1 bg-white/20 backdrop-blur-md rounded-lg p-1 border border-white/10 shadow-sm">
      {languages.map(({ code, label }) => (
        <button
          key={code}
          onClick={() => i18n.changeLanguage(code)}
          className={`px-2 py-1 text-xs font-bold rounded transition-all ${
            i18n.language === code
              ? 'bg-white text-teal-600 shadow-sm transform scale-105'
              : 'text-white/90 hover:bg-white/10'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
};
