import { LIB_NAME as designTokens } from '@byteflock/design-tokens';
import { LIB_NAME as theme } from '@byteflock/theme';
import { LIB_NAME as uiReact } from '@byteflock/ui-react';

// The library list is a placeholder until P1.6 renders the themed dashboard (P1.1-T05).
const linkedLibraries = [uiReact, theme, designTokens].join(', ');

export default function Page() {
  return (
    <main>
      <h1>Admin dashboard</h1>
      <p>Foundation libraries linked: {linkedLibraries}.</p>
    </main>
  );
}
