// Launcher strings and text direction. The launcher runs on the customer's page under tight size
// budgets, so it keeps its own small table instead of importing the frame's i18n (and Lit with it).
// The frame sets its own lang and dir from the same locale (frame/main.ts).

interface LauncherStrings {
  /** Accessible name and iframe title when the page gives no data-launcher-label. */
  name: string;
  unread: (count: number) => string;
  /** Appended to the accessible name while the chat cannot load. */
  unavailable: string;
  /** Tooltip while the chat cannot load. */
  unavailableTitle: string;
}

const STRINGS: Record<string, LauncherStrings> = {
  en: {
    name: 'Chat',
    unread: (n) => (n === 1 ? '1 unread message' : `${n} unread messages`),
    unavailable: 'unavailable',
    unavailableTitle: 'Chat unavailable',
  },
  de: {
    name: 'Chat',
    unread: (n) =>
      n === 1 ? '1 ungelesene Nachricht' : `${n} ungelesene Nachrichten`,
    unavailable: 'nicht verfügbar',
    unavailableTitle: 'Chat nicht verfügbar',
  },
  fr: {
    name: 'Discussion',
    // French uses the singular for 0 and 1.
    unread: (n) => (n < 2 ? `${n} message non lu` : `${n} messages non lus`),
    unavailable: 'indisponible',
    unavailableTitle: 'Discussion indisponible',
  },
  es: {
    name: 'Chat',
    unread: (n) => (n === 1 ? '1 mensaje sin leer' : `${n} mensajes sin leer`),
    unavailable: 'no disponible',
    unavailableTitle: 'Chat no disponible',
  },
};

/** Languages written right to left (the same list as the frame's dirOf). */
const RTL_LANGUAGES = new Set(['ar', 'he', 'fa', 'ur']);

const language = (locale: string) => locale.split('-')[0].toLowerCase();

export const launcherStrings = (locale: string): LauncherStrings =>
  STRINGS[language(locale)] ?? STRINGS.en;

export const launcherDir = (locale: string): 'ltr' | 'rtl' =>
  RTL_LANGUAGES.has(language(locale)) ? 'rtl' : 'ltr';
