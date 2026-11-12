// jsx-a11y rules as errors (D-29, P2.1-T20).
//
// Nx's React presets differ: `flat/react` includes the jsx-a11y rules as warnings, which never fail
// lint, and `flat/react-typescript` (the dashboard's) does not include them at all. A React
// project's eslint.config.mjs calls this with Nx's `flat/react-jsx` preset; the returned entry
// registers the jsx-a11y plugin from that preset and raises every jsx-a11y rule it turns on to
// "error", keeping the rule's options.
export function a11yAsErrors(presetConfigs) {
  const rules = {};
  let plugin;
  for (const config of presetConfigs) {
    plugin ??= config.plugins?.['jsx-a11y'];
    for (const [rule, setting] of Object.entries(config.rules ?? {})) {
      if (!rule.startsWith('jsx-a11y/')) continue;
      const [level, ...options] = Array.isArray(setting) ? setting : [setting];
      if (level === 'off' || level === 0) continue;
      rules[rule] = ['error', ...options];
    }
  }
  if (!plugin || Object.keys(rules).length === 0)
    throw new Error(
      "a11yAsErrors: the preset has no jsx-a11y plugin or rules; pass nx.configs['flat/react-jsx']",
    );
  return {
    files: ['**/*.tsx', '**/*.jsx'],
    plugins: { 'jsx-a11y': plugin },
    rules,
  };
}
