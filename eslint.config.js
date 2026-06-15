import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

/**
 * Scoped ESLint flat config (PWA-hardening design §6).
 *
 * A repo-wide clean run is currently impossible (~174 stock-recommended
 * errors across legacy pages/services). Rather than block CI on the whole
 * tree, we gate `npm run lint` on the GREEN surface only:
 *
 *   - src/components/ui   (Phase 0 primitives)
 *   - src/lib             (motion / scroll / utils helpers)
 *   - src/test            (test setup + smoke)
 *
 * Everything else is ignored so the gated scope can stay clean and the
 * boundary can be ratcheted outward one directory at a time as legacy
 * code is fixed.
 *
 * react-hooks rules are enabled EVERYWHERE (within the linted scope) as
 * WARNINGS — they surface the conditional-hook class of bugs without
 * failing the run, so the gate stays green while the warning still shows.
 */
export default tseslint.config(
  // 1. Global ignores. Anything matched here is invisible to `eslint .`.
  //    The CI gate is the GREEN surface only — src/components/ui, src/lib,
  //    and src/test — so we ignore every other directory in the tree.
  //
  //    NOTE: we deliberately do NOT use `src/**` + negated `!` re-includes.
  //    A broad `src/**` ignore stops ESLint from descending into src at all
  //    when invoked as `eslint .`, which makes the negations unreachable and
  //    yields "all files ignored". Enumerating the non-green paths keeps
  //    directory traversal alive into the green surface. Ratchet the gate
  //    outward by deleting entries from this list as legacy code is fixed.
  {
    ignores: [
      'dist/**',
      'dev-dist/**',
      'coverage/**',
      'node_modules/**',
      'public/**',
      'scripts/**',
      '*.config.{js,ts}',
      '*.config.*.{js,ts}',

      // --- Non-green src directories (NOT yet gated) ---
      'src/config/**',
      'src/contexts/**',
      'src/dev/**',
      'src/firebase/**',
      'src/firestore/**',
      'src/hooks/**',
      'src/pages/**',
      'src/parser/**',
      'src/providers/**',
      'src/router/**',
      'src/services/**',
      'src/store/**',
      'src/styles/**',
      'src/types/**',
      'src/utils/**',

      // src/components: only the `ui/` subtree is green; ignore siblings.
      'src/components/*.{ts,tsx}',
      'src/components/home/**',
      'src/components/profile/**',
      'src/components/workout/**',

      // Non-green src root files.
      'src/App.tsx',
      'src/main.tsx',
      'src/vite-env.d.ts',
    ],
  },

  // 2. Base recommended rules for the gated TypeScript/TSX scope.
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // 3. react-hooks as WARNINGS everywhere in scope (recommended-latest
  //    exposes the flat-config preset for plugin v5).
  {
    ...reactHooks.configs['recommended-latest'],
    rules: {
      ...reactHooks.configs['recommended-latest'].rules,
      'react-hooks/rules-of-hooks': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },

  // 4. Language options for the green surface.
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2022,
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
  },

  // 5. Test files also get the vitest/jsdom + node globals, and relax a
  //    couple of rules that fire on deliberately-constant assertion inputs
  //    (e.g. `cn('a', false && 'b', 'c')` exercising falsy-arg handling).
  {
    files: ['src/test/**/*.{ts,tsx}', 'src/**/*.test.{ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.vitest,
      },
    },
    rules: {
      'no-constant-binary-expression': 'off',
    },
  },
);
