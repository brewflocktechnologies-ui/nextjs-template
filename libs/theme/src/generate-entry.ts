// `@byteflock/theme/generate`: the theme generator (ADR-016, P2.4). Used by the design-tokens Nx
// scripts and the dashboard server; never imported by the widget frame.
export {
  generateTheme,
  previewCss,
  GENERATOR_VERSION,
  type GenerateInput,
  type GenerateResult,
} from './generate/generate';
export {
  reportMarkdown,
  type Finding,
  type GenerationReport,
} from './generate/report';
export { FONT_REGISTRY } from './generate/values';
export {
  CONTRACT,
  CONTRACT_ID,
  CONTRACT_BY_PATH,
  CONTRAST_PAIRS,
  type ContractToken,
  type ContractType,
} from './contract/contract';
export {
  ThemeManifestV1,
  type ThemeManifest,
} from './schema/theme-manifest.v1';
export {
  ThemeArtifactV1,
  type ThemeArtifact,
} from './schema/theme-artifact.v1';
