import { renderToStaticMarkup } from 'react-dom/server';
import { Button } from '@byteflock/ui-react';

// P1.4-T08 smoke: the dashboard consumes ui-react from source through its public entry.
describe('ui-react in the dashboard', () => {
  it('renders the Button from @byteflock/ui-react', () => {
    const html = renderToStaticMarkup(<Button>Assign</Button>);
    expect(html).toContain('data-slot="button"');
    expect(html).toContain('Assign');
  });
});
