import js from '@eslint/js';
import hooks from 'eslint-plugin-react-hooks';
import refresh from 'eslint-plugin-react-refresh';

const browserGlobals = {
  window: 'readonly', document: 'readonly', localStorage: 'readonly', setTimeout: 'readonly',
  crypto: 'readonly', alert: 'readonly', structuredClone: 'readonly', Blob: 'readonly', URL: 'readonly', FormData: 'readonly',
  MouseEvent: 'readonly', Event: 'readonly', HTMLInputElement: 'readonly', HTMLSelectElement: 'readonly', HTMLAnchorElement: 'readonly', File: 'readonly', Storage: 'readonly'
};

export default [
  { ignores: ['dist/**', 'node_modules/**'] },
  js.configs.recommended,
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module', parserOptions: { ecmaFeatures: { jsx: true } }, globals: browserGlobals },
    plugins: { 'react-hooks': hooks, 'react-refresh': refresh },
    rules: { ...hooks.configs.recommended.rules, 'react-refresh/only-export-components': 'off', 'no-unused-vars': ['error', { argsIgnorePattern: '^_' }] }
  }
];
