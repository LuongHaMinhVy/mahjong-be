import { locales } from './index.js';

describe('Locales Dictionary Integrity', () => {
  it('should have identical key structures across all languages', () => {
    const baseKeys = getKeys(locales.vi);
    
    Object.entries(locales).forEach(([lang, dict]) => {
      const keys = getKeys(dict);
      expect(keys).toEqual(baseKeys);
    });
  });
});

function getKeys(obj: any, prefix = ''): string[] {
  let keys: string[] = [];
  for (const key in obj) {
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      keys = keys.concat(getKeys(obj[key], `${prefix}${key}.`));
    } else {
      keys.push(`${prefix}${key}`);
    }
  }
  return keys.sort();
}
