import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { storyTheme, type TenantId } from '../../.storybook/themes';
import { AGENTS } from '../sample-data';
import { FilterDialog } from './filter-dialog';

const NAMES = AGENTS.map((a) => a.name);

function AgentFilter() {
  const [selected, setSelected] = useState<string[]>([]);
  return (
    <FilterDialog
      items={NAMES}
      value={selected}
      onValueChange={setSelected}
      triggerLabel="Filter by agent"
      title="Filter conversations"
      description="Show conversations assigned to these agents."
      fieldLabel="Agents"
      placeholder="Search agents"
    />
  );
}

const meta: Meta = {
  title: 'Composites/FilterDialog',
  tags: ['a11y'],
  render: () => <AgentFilter />,
};
export default meta;

/** PoC-B item 3: select by keyboard, close, reopen, remove a chip by keyboard. */
async function filterFlow(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  const body = within(canvasElement.ownerDocument.body);

  await userEvent.click(
    canvas.getByRole('button', { name: /Filter by agent/ }),
  );
  const dialog = await body.findByRole('dialog', {
    name: 'Filter conversations',
  });
  const input = within(dialog).getByRole('combobox', { name: 'Agents' });

  for (const [i, name] of ['Ava Smith', 'Ben Patel'].entries()) {
    await userEvent.type(input, name);
    await body.findByRole('option', { name });
    await userEvent.keyboard('{ArrowDown}{Enter}');
    await waitFor(() =>
      expect(
        within(dialog).getAllByRole('button', { name: 'Remove' }),
      ).toHaveLength(i + 1),
    );
  }
  await userEvent.keyboard('{Escape}'); // closes the list
  await userEvent.keyboard('{Escape}'); // closes the dialog
  await waitFor(() =>
    expect(
      body.queryByRole('dialog', { name: 'Filter conversations' }),
    ).not.toBeInTheDocument(),
  );

  await userEvent.click(
    canvas.getByRole('button', { name: 'Filter by agent (2)' }),
  );
  const reopened = await body.findByRole('dialog', {
    name: 'Filter conversations',
  });
  await expect(within(reopened).getByText('Ava Smith')).toBeInTheDocument();
  await expect(within(reopened).getByText('Ben Patel')).toBeInTheDocument();

  within(reopened).getAllByRole('button', { name: 'Remove' })[0].focus();
  await userEvent.keyboard('{Enter}');
  await waitFor(() =>
    expect(within(reopened).queryByText('Ava Smith')).not.toBeInTheDocument(),
  );
}

/** P1.4-AC05: the tenant's primary colour reaches the page. */
async function expectTenantPrimary(tenant: TenantId) {
  const expected = storyTheme(tenant, 'tenant', false).vars?.[
    '--sem-color-primary'
  ];
  const actual = getComputedStyle(document.documentElement)
    .getPropertyValue('--sem-color-primary')
    .trim();
  await expect(actual).toBe(expected);
}

const tenantStory = (tenant: TenantId): StoryObj => ({
  globals: { tenant },
  play: async ({ canvasElement }) => {
    await expectTenantPrimary(tenant);
    await filterFlow(canvasElement);
  },
});

export const Acme = tenantStory('acme');
export const Globex = tenantStory('globex');
export const Initech = tenantStory('initech');
