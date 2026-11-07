// Playground index (PoC-A-T09). The playground shares no code with the widget; it reaches the widget
// only through its public /v1/ URLs (BOUND-04). Fixture pages are static files in public/.
import { WIDGET_ORIGIN } from './origins';

const TENANTS = [
  { key: 'wk_acme_demo', name: 'Acme Corp (light, circle)' },
  { key: 'wk_globex_demo', name: 'Globex (dark, pill, bottom left)' },
  { key: 'wk_initech_demo', name: 'Initech (compact, full radius)' },
];

const PER_TENANT = [
  { page: 'clean.html', title: 'Clean page' },
  { page: 'hostile-css.html', title: 'Hostile CSS' },
  { page: 'hostile-script.html', title: 'Hostile script (T-01)' },
  { page: 'rrweb.html', title: 'Session recording (rrweb)' },
  { page: 'frame-blocked.html', title: 'Frame blocked by CSP' },
  { page: 'mobile.html', title: 'Mobile (use a 390 × 844 viewport)' },
];

const SINGLE = [
  { href: '/strict-csp.html', title: 'Strict CSP and Trusted Types (T-08)' },
  { href: '/two-instances.html', title: 'Two instances' },
  { href: '/slow-config.html?case=timeout', title: 'Config timeout' },
  { href: '/slow-config.html?case=json', title: 'Invalid theme JSON' },
  {
    href: '/slow-config.html?case=version',
    title: 'Unsupported theme version',
  },
  { href: '/slow-config.html?case=missing', title: 'Missing config' },
  {
    href: '/wrong-domain.html',
    title: 'Widget key not allowed on this origin (ENDP-02a)',
  },
  {
    href: '/clean.html?key=wk_acme_demo&frame=open',
    title: 'Frame created on first open (Q-015)',
  },
  {
    href: '/clean.html?key=wk_acme_demo&locale=ar',
    title: 'Right-to-left locale',
  },
];

function link(href: string, text: string): HTMLLIElement {
  const li = document.createElement('li');
  const a = document.createElement('a');
  a.href = href;
  a.textContent = text;
  li.append(a);
  return li;
}

const origin = document.querySelector('#widget-origin');
if (origin) origin.textContent = WIDGET_ORIGIN;

const list = document.querySelector('#fixtures');
if (list) {
  for (const tenant of TENANTS) {
    const section = document.createElement('li');
    section.append(tenant.name);
    const pages = document.createElement('ul');
    for (const f of PER_TENANT)
      pages.append(link(`/${f.page}?key=${tenant.key}`, f.title));
    section.append(pages);
    list.append(section);
  }
  const other = document.createElement('li');
  other.append('Other scenarios');
  const pages = document.createElement('ul');
  for (const f of SINGLE) pages.append(link(f.href, f.title));
  other.append(pages);
  list.append(other);
}
