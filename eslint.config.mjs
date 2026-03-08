import antfu from '@antfu/eslint-config'

export default antfu(
  {
    ignores: ['issue.json', 'label.json'],
  },
  {
    rules: {
      'e18e/ban-dependencies': 'off',
      'no-console': 'off',
      'node/prefer-global/process': 'off',
    },
  },
)
