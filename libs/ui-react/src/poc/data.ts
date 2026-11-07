// Sample data for the PoC-B stories (agents and teams of a support desk).

export interface Agent {
  id: string;
  name: string;
  team: string;
  open: number;
  status: 'online' | 'away' | 'offline';
}

const FIRST = [
  'Ava',
  'Ben',
  'Chloe',
  'Dev',
  'Ema',
  'Finn',
  'Gia',
  'Hugo',
  'Isla',
  'Jai',
  'Kira',
  'Leo',
  'Mia',
  'Noah',
  'Olive',
  'Priya',
  'Quinn',
];
const TEAMS = ['Billing', 'Onboarding', 'Technical', 'Enterprise', 'Returns'];
const STATUS: Agent['status'][] = ['online', 'away', 'offline'];

export const AGENTS: Agent[] = FIRST.flatMap((first, i) =>
  [0, 1, 2].map((j) => ({
    id: `a${i * 3 + j}`,
    name: `${first} ${['Nguyen', 'Smith', 'Patel'][j]}`,
    team: TEAMS[(i + j) % TEAMS.length],
    open: (i * 7 + j * 3) % 13,
    status: STATUS[(i + j) % STATUS.length],
  })),
).slice(0, 50);

/** Searchable items: 45 agents plus the teams, 50 in total. */
export const ASSIGNEES: string[] = [
  ...TEAMS.map((t) => `${t} team`),
  ...AGENTS.slice(0, 45).map((a) => a.name),
];
