'use client';
import { useState } from 'react';
import { Button, FilterDialog } from '@byteflock/ui-react';

const AGENTS = [
  'Ava Nguyen',
  'Ben Patel',
  'Chloe Smith',
  'Dev Nguyen',
  'Ema Patel',
  'Finn Smith',
];

/** Home-page sample: the FilterDialog composite and a primary button, themed by the tenant. */
export function AgentFilterDemo() {
  const [selected, setSelected] = useState<string[]>([]);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <FilterDialog
        items={AGENTS}
        value={selected}
        onValueChange={setSelected}
        triggerLabel="Filter by agent"
        title="Filter conversations"
        description="Show conversations assigned to these agents."
        fieldLabel="Agents"
        placeholder="Search agents"
      />
      <Button>New conversation</Button>
    </div>
  );
}
