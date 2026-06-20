import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  LANGUAGE_STORAGE_KEY,
  normalizeLocale,
  translate,
  type Locale,
  type MessageKey,
} from '../lib/i18n';

export interface LanguageContextValue {
  locale: Locale;
  setLocale: (next: Locale) => void;
  t: (key: MessageKey, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function safeReadLocalStorage(): string | null {
  try {
    return localStorage.getItem(LANGUAGE_STORAGE_KEY);
  } catch {
    return null;
  }
}

function safeWriteLocalStorage(value: Locale): void {
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, value);
  } catch {
    /* noop */
  }
}

function applyLocaleToDom(locale: Locale): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = locale;
}

interface LanguageProviderProps {
  children: ReactNode;
}

export function LanguageProvider({ children }: LanguageProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(() =>
    normalizeLocale(safeReadLocalStorage()),
  );

  if (typeof document !== 'undefined') {
    if (document.documentElement.lang !== locale) {
      applyLocaleToDom(locale);
    }
  }

  const setLocale = useCallback((next: Locale) => {
    setLocaleState((prev) => (prev === next ? prev : next));
    safeWriteLocalStorage(next);
  }, []);

  const t = useCallback(
    (key: MessageKey, params?: Record<string, string | number>) => translate(locale, key, params),
    [locale],
  );

  useEffect(() => {
    applyLocaleToDom(locale);
  }, [locale]);

  const value = useMemo<LanguageContextValue>(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (ctx) return ctx;
  return {
    locale: 'en',
    setLocale: () => undefined,
    t: (key, params) => translate('en', key, params),
  };
}
