// ThemeController (P1.5-T02): applies resolved --sem-* variables to the frame document and follows
// the appearance, including `system` through matchMedia.
import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { isResolvedKey, type ResolvedVars } from '@byteflock/theme/guard';
import { resolveTheme, type Appearance } from '@byteflock/theme/resolve';
import type { Theme } from '@byteflock/theme/guard';

export type AppearanceMode = 'light' | 'dark' | 'system';

export interface ThemeControllerOptions {
  /** Element that receives the variables; defaults to document.documentElement. */
  root?: HTMLElement;
  /** Injectable for tests; defaults to window.matchMedia. */
  matchMedia?: (query: string) => MediaQueryList;
  /** Called whenever the effective appearance changes. */
  onAppearance?: (appearance: Appearance) => void;
}

export class ThemeController implements ReactiveController {
  private readonly root: HTMLElement;
  private readonly media: MediaQueryList | null;
  private readonly onAppearance?: (appearance: Appearance) => void;
  private mode: AppearanceMode = 'light';
  private theme: Theme | null = null;
  private readonly listener = () => this.refresh();

  constructor(
    host: ReactiveControllerHost | null,
    options: ThemeControllerOptions = {},
  ) {
    this.root = options.root ?? document.documentElement;
    const mm = options.matchMedia ?? globalThis.matchMedia?.bind(globalThis);
    this.media = mm ? mm('(prefers-color-scheme: dark)') : null;
    this.onAppearance = options.onAppearance;
    host?.addController(this);
  }

  /** The effective appearance right now. */
  get appearance(): Appearance {
    if (this.mode !== 'system') return this.mode;
    return this.media?.matches ? 'dark' : 'light';
  }

  /**
   * Sets variables on the root. Keys outside RESOLVED_KEYS are rejected (not applied) and
   * returned, so the caller can report them.
   */
  apply(vars: ResolvedVars | Record<string, string>): string[] {
    const rejected: string[] = [];
    for (const [key, value] of Object.entries(vars)) {
      if (!isResolvedKey(key) || typeof value !== 'string') {
        rejected.push(key);
        continue;
      }
      this.root.style.setProperty(key, value);
    }
    return rejected;
  }

  /** Follows `light`, `dark`, or the viewer's preference for `system`. */
  applyAppearance(mode: AppearanceMode): void {
    this.media?.removeEventListener('change', this.listener);
    this.mode = mode;
    if (mode === 'system')
      this.media?.addEventListener('change', this.listener);
    this.refresh();
  }

  /** Uses a validated theme: resolves it for the effective appearance and keeps it in sync. */
  setTheme(theme: Theme): void {
    this.theme = theme;
    this.applyAppearance(theme.appearance.mode);
  }

  private refresh(): void {
    const appearance = this.appearance;
    this.root.dataset.appearance = appearance;
    if (this.theme) this.apply(resolveTheme(this.theme, { appearance }));
    this.onAppearance?.(appearance);
  }

  hostConnected(): void {
    if (this.mode === 'system')
      this.media?.addEventListener('change', this.listener);
  }

  hostDisconnected(): void {
    this.media?.removeEventListener('change', this.listener);
  }
}
