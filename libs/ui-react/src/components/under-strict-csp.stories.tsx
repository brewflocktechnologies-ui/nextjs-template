import { CSPProvider } from '@base-ui/react/csp-provider';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
} from './ui/popover';

/**
 * PoC-B item 5: Base UI under a nonce-only style CSP. The play function installs
 * `style-src 'self' 'nonce-poc'` on this story's page (a meta CSP added by script is enforced for
 * everything inserted afterwards), then opens and closes a dialog and a popover. Base UI receives
 * the nonce through CSPProvider; any <style> it inserts without it would raise a violation.
 * Kept in its own file so the policy cannot leak into other stories.
 */
const NONCE = 'poc';

const meta: Meta = {
  title: 'Foundations/Under strict CSP',
  tags: ['a11y'],
  // The platform default theme: no tenant <style> is inserted after the CSP is installed.
  globals: { tenant: 'default' },
};
export default meta;

export const Default: StoryObj = {
  render: () => (
    <CSPProvider nonce={NONCE}>
      <Dialog>
        <DialogTrigger render={<Button />}>Open under CSP</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nonce-only styles</DialogTitle>
            <DialogDescription>
              Rendered with a nonce from CSPProvider.
            </DialogDescription>
          </DialogHeader>
          <Popover>
            <PopoverTrigger render={<Button variant="outline" />}>
              Details
            </PopoverTrigger>
            <PopoverContent>
              <PopoverTitle>Details</PopoverTitle>
              <PopoverDescription>
                No inline styles without a nonce.
              </PopoverDescription>
            </PopoverContent>
          </Popover>
        </DialogContent>
      </Dialog>
    </CSPProvider>
  ),
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const violations: string[] = [];
    doc.addEventListener('securitypolicyviolation', (e) =>
      violations.push(`${e.effectiveDirective} ${e.blockedURI}`),
    );
    if (!doc.querySelector('meta[data-poc-csp]')) {
      const meta = doc.createElement('meta');
      meta.httpEquiv = 'Content-Security-Policy';
      meta.content = `style-src 'self' 'nonce-${NONCE}'`;
      meta.dataset.pocCsp = '';
      doc.head.prepend(meta);
    }

    // Prove the policy is live: an inline <style> without the nonce must be refused.
    const probe = doc.createElement('style');
    probe.textContent = '.csp-probe { color: rgb(1, 2, 3); }';
    doc.head.append(probe);
    await waitFor(() => expect(violations.length).toBeGreaterThan(0));
    const baseline = violations.length;

    const canvas = within(canvasElement);
    const body = within(doc.body);
    await userEvent.click(
      canvas.getByRole('button', { name: 'Open under CSP' }),
    );
    const dialog = await body.findByRole('dialog', {
      name: 'Nonce-only styles',
    });
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Details' }),
    );
    await expect(
      await body.findByText('No inline styles without a nonce.'),
    ).toBeVisible();
    await userEvent.keyboard('{Escape}');
    await userEvent.keyboard('{Escape}');
    await waitFor(() =>
      expect(
        body.queryByRole('dialog', { name: 'Nonce-only styles' }),
      ).not.toBeInTheDocument(),
    );

    await expect(violations.slice(baseline)).toEqual([]);
  },
};
