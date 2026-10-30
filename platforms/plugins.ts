import type { PluginOption } from 'vite';
import { crazygames } from './crazygames/vite';
import { playgama } from './playgama/vite';

/**
 * The plugins a platform adds to its build: the SDK in the page, its files (`platforms/<name>/vite.ts`).
 * Only the build for that platform takes them. A platform without any is not named here.
 */
export const PLATFORM_PLUGINS: Record<string, () => PluginOption[]> = { crazygames, playgama };
