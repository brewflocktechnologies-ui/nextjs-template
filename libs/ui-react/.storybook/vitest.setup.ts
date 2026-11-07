import { setProjectAnnotations } from '@storybook/react-vite';
import * as a11yAnnotations from '@storybook/addon-a11y/preview';
import * as projectAnnotations from './preview';

// Applies the Storybook preview (styles, a11y parameters) to stories run by Vitest.
setProjectAnnotations([a11yAnnotations, projectAnnotations]);
