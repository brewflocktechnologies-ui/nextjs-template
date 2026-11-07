// @byteflock/ui-react public API (P1.4-T08). Named exports only.
// CSS: import '@byteflock/ui-react/shadcn-bridge.css' after the design-token CSS (see README).
export * from './components/ui/button';
export * from './components/ui/checkbox';
export * from './components/ui/combobox';
export * from './components/ui/dialog';
export * from './components/ui/input';
export * from './components/ui/input-group';
export * from './components/ui/label';
export * from './components/ui/popover';
export * from './components/ui/select';
export * from './components/ui/table';
export * from './components/ui/textarea';
export * from './components/ui/tooltip';
export * from './components/data-table';
export * from './composites/filter-dialog';
export * from './theme';
export { cn } from './lib/utils';

/** Library identity (the dashboard shell lists linked libraries until P1.6). */
export const LIB_NAME = 'ui-react';
