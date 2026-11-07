// Placeholder (P1.1-T03/T05). The theme contract arrives in P1.3 and resolves against design-tokens.
import { LIB_NAME as designTokens } from '@byteflock/design-tokens';

export const LIB_NAME = 'theme';
export const DEPENDS_ON = [designTokens] as const;
