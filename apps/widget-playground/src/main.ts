// Playground entry (P1.1-T04). The playground shares no code with the widget; it reaches
// the widget only through its public /v1/ URLs (BOUND-04).
import { WIDGET_ORIGIN } from './origins';

const target = document.querySelector('#widget-origin');
if (target) target.textContent = WIDGET_ORIGIN;
