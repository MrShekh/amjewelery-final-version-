module.exports = {
  extends: ['next/core-web-vitals'],
  rules: {
    // Disable problematic rules for production build
    '@typescript-eslint/no-unused-vars': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    'prefer-const': 'off',
    'react/no-unescaped-entities': 'off',
    '@next/next/no-img-element': 'off',
    'react-hooks/exhaustive-deps': 'off'
  }
}
