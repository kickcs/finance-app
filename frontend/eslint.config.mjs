import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import pluginVue from 'eslint-plugin-vue';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import pluginQuery from '@tanstack/eslint-plugin-query';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist', 'eslint.config.mjs'] },

  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  ...pluginQuery.configs['flat/recommended'],
  eslintPluginPrettierRecommended,

  // Vue files parsed with typescript-eslint
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
      },
    },
  },

  // Global settings
  {
    languageOptions: {
      globals: { ...globals.browser },
    },
  },

  // Rules
  {
    rules: {
      // Prettier
      'prettier/prettier': 'error',

      // Code quality
      eqeqeq: ['error', 'always'],
      'prefer-const': 'error',
      'no-console': 'warn',
      'no-return-assign': 'error',

      // TypeScript
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      // Vue
      // Vue 3 defineProps with TypeScript handles optional props via `?` syntax, defaults via withDefaults()
      'vue/require-default-prop': 'off',
      'vue/multi-word-component-names': 'off',
      'vue/block-order': ['error', { order: ['script', 'template', 'style'] }],
      'vue/define-macros-order': [
        'error',
        { order: ['defineProps', 'defineEmits', 'defineSlots'] },
      ],
      'vue/no-v-html': 'warn',
      'vue/component-name-in-template-casing': ['error', 'PascalCase'],
      'vue/prefer-true-attribute-shorthand': 'warn',

      // TanStack Query - disable exhaustive-deps as Vue computed queryKeys track deps reactively
      '@tanstack/query/exhaustive-deps': 'off',
    },
  },
);
