import { setProjectAnnotations } from '@storybook/web-components-vite';
import * as a11yAnnotations from '@storybook/addon-a11y/preview';
import * as projectAnnotations from './preview';

// Applies the Storybook preview (theme decorator, a11y parameters) to stories run by Vitest.
setProjectAnnotations([a11yAnnotations, projectAnnotations]);
