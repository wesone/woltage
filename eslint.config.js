import globals from 'globals';
import tseslint from 'typescript-eslint';
import weslint from 'weslint';
import {globalIgnores} from 'eslint/config';

export default tseslint.config(
    {files: ['**/*.js'], languageOptions: {sourceType: 'commonjs'}},
    {files: ['**/*.{js,mjs,cjs,ts}'], languageOptions: {globals: globals.node}},
    tseslint.configs.recommended,
    weslint.configs.recommended,
    {
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-require-imports': 'off',
            '@typescript-eslint/no-unsafe-function-type': 'off',
            'no-unused-vars': 'off' // this is handled by @typescript-eslint/no-unused-vars otherwise eslint will complain in type definitions too
        }
    },
    globalIgnores(['**/dist/'])
);
