// Storage is consent-gated in the widget frame (P1.5-T04, Q-006). Browser storage APIs may appear
// only in libs/chat-widget/src/controllers/consent-controller.ts; everything else goes through its
// `storage` facade. Used by libs/chat-widget and apps/widget (frame sources).
const message =
  'Storage is consent-gated: use ConsentController.storage (P1.5-T04).';
const APIS = ['localStorage', 'sessionStorage', 'indexedDB'];

/** @param {string[]} files globs the rule applies to */
export function storageRestrictions(files) {
  return {
    files,
    ignores: ['**/consent-controller.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        ...APIS.map((name) => ({ name, message })),
      ],
      'no-restricted-properties': [
        'error',
        ...['window', 'globalThis', 'self'].flatMap((object) =>
          APIS.map((property) => ({ object, property, message })),
        ),
        { object: 'document', property: 'cookie', message },
      ],
    },
  };
}
