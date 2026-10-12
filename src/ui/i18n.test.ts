import { afterAll, describe, expect, it } from 'vitest';
import { LANGUAGES, setLanguage, t } from './i18n';

describe('what the rules to read say of the levels', () => {
  afterAll(() => setLanguage('en'));

  it.each(LANGUAGES)('is three lines in %s: the goal, the faces and the floor, and nothing of a limit of moves', (code) => {
    setLanguage(code);
    const lines = t('howLevels').split('\n');
    expect(lines).toHaveLength(3);
    expect(t('howLevels')).not.toMatch(/ограничен|limited|begrenzt|limitad|limité|sınırl/i);
  });
});
