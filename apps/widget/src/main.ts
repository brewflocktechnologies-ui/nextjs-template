// Placeholder entry for the widget origin (P1.1-T04). PoC-A replaces it with the loader,
// launcher and frame builds. The imports create the project-graph edges the specs expect.
import { LIB_NAME as chatWidget } from '@byteflock/chat-widget';
import { LIB_NAME as theme } from '@byteflock/theme';

const status = document.querySelector('#status');
if (status) {
  status.textContent = `Libraries linked: ${chatWidget}, ${theme}.`;
}
