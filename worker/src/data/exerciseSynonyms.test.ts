import { describe, expect, it } from 'vitest';
import bundledExercises from './exerciseLibrary.json';
import { exerciseTokens, type LibraryExercise } from './exerciseIndex';
import { EXERCISE_SYNONYMS, getAllSynonymTargets, getSynonymPhrases } from './exerciseSynonyms';

describe('exerciseSynonyms', () => {
  it('asserts every synonym target exists in exerciseLibrary.json and matches >= 1 exercise', () => {
    const library = bundledExercises as LibraryExercise[];
    const targets = getAllSynonymTargets();

    expect(Object.keys(EXERCISE_SYNONYMS).length).toBeGreaterThan(0);
    expect(targets.length).toBeGreaterThan(0);

    for (const target of targets) {
      const targetTokens = exerciseTokens(target);
      expect(targetTokens.length, `Target "${target}" should yield tokens`).toBeGreaterThan(0);

      const matching = library.filter((ex) =>
        targetTokens.every((t) => exerciseTokens(ex.name).includes(t)),
      );

      expect(
        matching.length,
        `Expected synonym target "${target}" to match >= 1 exercise in exerciseLibrary.json`,
      ).toBeGreaterThanOrEqual(1);
    }
  });

  it('maps gym slang queries to appropriate synonym phrases', () => {
    // Pec deck / chest fly machine
    expect(getSynonymPhrases('pec deck')).toEqual(['machine pec fly']);
    expect(getSynonymPhrases('pec dec')).toEqual(['machine pec fly']);
    expect(getSynonymPhrases('chest fly machine')).toEqual(['machine pec fly']);
    expect(getSynonymPhrases('butterfly machine')).toEqual(['machine pec fly']);

    // Lat pulldown
    expect(getSynonymPhrases('lat pull down')).toEqual(['machine pulldown']);
    expect(getSynonymPhrases('lat pulldown')).toEqual(['machine pulldown']);

    // Smith machine
    expect(getSynonymPhrases('smith')).toEqual(['smith machine']);

    // RDL
    expect(getSynonymPhrases('rdl')).toEqual(['romanian deadlift']);

    // OHP and shoulder press
    expect(getSynonymPhrases('ohp')).toEqual(['overhead press']);
    expect(getSynonymPhrases('shoulder press')).toEqual(['overhead press']);

    // Skull crusher spellings
    const skullCrusherSyns = getSynonymPhrases('skull crusher');
    expect(skullCrusherSyns).toContain('skullcrusher');
    expect(skullCrusherSyns).toContain('lying triceps extension');

    const skullcrusherSyns = getSynonymPhrases('skullcrusher');
    expect(skullcrusherSyns).toContain('skull crusher');
    expect(skullcrusherSyns).toContain('lying triceps extension');

    // db / bb / kb
    expect(getSynonymPhrases('db')).toEqual(['dumbbell']);
    expect(getSynonymPhrases('bb')).toEqual(['barbell']);
    expect(getSynonymPhrases('kb')).toEqual(['kettlebell']);

    // Hack squat
    expect(getSynonymPhrases('hack')).toEqual(['hack squat']);
    expect(getSynonymPhrases('hacksquat')).toEqual(['hack squat']);

    // Leg curl / extension
    expect(getSynonymPhrases('legcurl')).toEqual(['leg curl']);
    expect(getSynonymPhrases('hamstring curl')).toEqual(['leg curl']);
    expect(getSynonymPhrases('legextension')).toEqual(['leg extension']);
    expect(getSynonymPhrases('quad extension')).toEqual(['leg extension']);

    // Preacher curl
    expect(getSynonymPhrases('preacher')).toEqual(['preacher curl']);
    expect(getSynonymPhrases('preachercurl')).toEqual(['preacher curl']);

    // Face pull
    expect(getSynonymPhrases('facepull')).toEqual(['face pull']);

    // T-bar row
    expect(getSynonymPhrases('tbar')).toEqual(['t bar row']);
    expect(getSynonymPhrases('tbar row')).toEqual(['t bar row']);

    // Pull up / chin up
    expect(getSynonymPhrases('pullup')).toEqual(['pull up']);
    expect(getSynonymPhrases('chinup')).toEqual(['chin up']);
  });

  it('performs subphrase replacement for compound queries', () => {
    const compound = getSynonymPhrases('dumbbell skull crusher');
    expect(compound).toContain('dumbbell skullcrusher');
  });

  it('returns empty array when query is already canonical or unknown', () => {
    expect(getSynonymPhrases('')).toEqual([]);
    expect(getSynonymPhrases('   ')).toEqual([]);
    expect(getSynonymPhrases('bench press')).toEqual([]);
    expect(getSynonymPhrases('pull up')).toEqual([]);
    expect(getSynonymPhrases('completelyunmatchedgibberishword')).toEqual([]);
  });
});
