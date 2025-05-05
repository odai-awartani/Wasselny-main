// context/LanguageContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translations } from '@/constants/languages';

type LanguageContextType = {
  language: 'en' | 'ar';
  setLanguage: (lang: 'en' | 'ar') => void;
  t: typeof translations.en;
};

const LanguageContext = createContext<LanguageContextType>({} as LanguageContextType);

export const LanguageProvider = ({ children }: { children: React.ReactNode }) => {
    const [language, setLanguage] = useState<'en' | 'ar'>('en'); // Changed default to 'en'

    useEffect(() => {
      const loadLanguage = async () => {
        const savedLanguage = await AsyncStorage.getItem('language');
        // Set to English if no language found
        setLanguage(savedLanguage as 'en' | 'ar' || 'en');
      };
      loadLanguage();
    }, []);

  const value = {
    language,
    setLanguage: async (lang: 'en' | 'ar') => {
      await AsyncStorage.setItem('language', lang);
      setLanguage(lang);
    },
    t: translations[language]
  };

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useLanguage = () => useContext(LanguageContext);