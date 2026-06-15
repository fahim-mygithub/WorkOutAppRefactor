// Shared, pure exercise-consolidation logic used by the build-time generator.
// This mirrors the previous client-side `parseExerciseCSV` (src/utils/exercises.ts)
// exactly so the emitted `exercises.json` matches the shape consumers expect.
// Keeping it here (Node-side only) means papaparse never ships in the client bundle.

// Deterministic build constant so the generated JSON is reproducible/cacheable.
// (The original used `new Date().toISOString()` per build, which broke caching.)
const BUILD_TIMESTAMP = '2026-06-14T00:00:00.000Z';

// Generate comprehensive search keywords from name, muscle groups, and equipment.
// Logic preserved verbatim from the original parseExerciseCSV implementation.
const generateSearchKeywords = (name, muscleGroups, equipment) => {
  const nameWords = name.toLowerCase().split(' ').filter(Boolean);
  const keywords = new Set();

  // Add full name
  keywords.add(name.toLowerCase());

  // Add individual words
  nameWords.forEach((word) => keywords.add(word));

  // Add muscle groups
  muscleGroups.forEach((mg) => keywords.add(mg.toLowerCase()));

  // Add equipment
  keywords.add(equipment.toLowerCase());

  // Add plural/singular variations
  nameWords.forEach((word) => {
    if (word.endsWith('s') && word.length > 3) {
      keywords.add(word.slice(0, -1)); // Remove 's' for singular
    } else if (!word.endsWith('s')) {
      keywords.add(word + 's'); // Add 's' for plural
    }
  });

  // Add common abbreviations and expansions
  const abbreviations = {
    dumbbell: ['db', 'dumbell'],
    barbell: ['bb', 'barbel'],
    kettlebell: ['kb', 'kettle bell'],
    overhead: ['oh'],
    extension: ['ext'],
    extensions: ['ext'],
    press: ['pres'],
    curl: ['curls'],
    row: ['rows'],
    tricep: ['triceps', 'tri'],
    bicep: ['biceps', 'bi'],
  };

  nameWords.forEach((word) => {
    if (abbreviations[word]) {
      abbreviations[word].forEach((abbrev) => keywords.add(abbrev));
    }
    // Reverse lookup - if word is an abbreviation, add full forms
    Object.entries(abbreviations).forEach(([full, abbrevs]) => {
      if (abbrevs.includes(word)) {
        keywords.add(full);
      }
    });
  });

  // Add generic terms based on exercise type
  if (name.toLowerCase().includes('row')) {
    keywords.add('rows');
    keywords.add('row');
    if (name.toLowerCase().includes('barbell')) {
      keywords.add('barbell rows');
      keywords.add('barbell row');
    }
  }

  if (name.toLowerCase().includes('extension') || name.toLowerCase().includes('tricep')) {
    keywords.add('tricep extension');
    keywords.add('tricep extensions');
    if (name.toLowerCase().includes('overhead')) {
      keywords.add('overhead extension');
      keywords.add('overhead extensions');
    }
  }

  if (name.toLowerCase().includes('curl')) {
    keywords.add('curl');
    keywords.add('curls');
    if (name.toLowerCase().includes('dumbbell')) {
      keywords.add('dumbbell curls');
      keywords.add('db curls');
    }
  }

  return Array.from(keywords).filter(Boolean);
};

// Consolidate the raw papaparse rows into the unique `Exercise[]` shape.
// `rows` is the `result.data` array of objects keyed by CSV header.
export const consolidateExercises = (rows) => {
  // Group exercises by name to consolidate duplicates
  const exerciseMap = new Map();

  rows.forEach((row, index) => {
    const exerciseName = row['Exercise Name'];

    if (exerciseMap.has(exerciseName)) {
      // Add muscle group to existing exercise
      const existing = exerciseMap.get(exerciseName);
      existing.muscleGroups.add(row['Muscle Group']);

      // Add video links if they exist
      if (row['Video Links']) {
        row['Video Links'].split(',').forEach((link) => {
          existing.videoLinks.add(link.trim());
        });
      }

      // Add instructions if they exist
      if (row['Instructions']) {
        row['Instructions'].split('|').forEach((instruction) => {
          existing.instructions.add(instruction.trim());
        });
      }
    } else {
      // Create new exercise entry
      const muscleGroups = new Set([row['Muscle Group']]);
      const videoLinks = new Set();
      const instructions = new Set();

      if (row['Video Links']) {
        row['Video Links'].split(',').forEach((link) => {
          videoLinks.add(link.trim());
        });
      }

      if (row['Instructions']) {
        row['Instructions'].split('|').forEach((instruction) => {
          instructions.add(instruction.trim());
        });
      }

      exerciseMap.set(exerciseName, {
        data: row,
        muscleGroups,
        videoLinks,
        instructions,
        index,
      });
    }
  });

  // Convert consolidated exercises to Exercise objects
  return Array.from(exerciseMap.entries()).map(([exerciseName, consolidated], index) => {
    const muscleGroupsArray = Array.from(consolidated.muscleGroups).sort();
    const muscleGroupString = muscleGroupsArray.join(', ');

    const videoLinksArray = Array.from(consolidated.videoLinks).filter(Boolean);
    const instructionsArray = Array.from(consolidated.instructions).filter(Boolean);

    const searchKeywords = generateSearchKeywords(
      exerciseName,
      muscleGroupsArray,
      consolidated.data['Equipment']
    );

    return {
      id: `exercise-${index + 1}`,
      name: exerciseName,
      muscleGroup: muscleGroupString,
      muscleGroups: muscleGroupsArray,
      equipment: consolidated.data['Equipment'],
      videoLinks: videoLinksArray,
      instructions: instructionsArray,
      difficulty: consolidated.data['Difficulty'] || 'Intermediate',
      force: consolidated.data['Force'] ? consolidated.data['Force'] : null,
      grips: consolidated.data['Grips'] ? consolidated.data['Grips'] : null,
      mechanic: consolidated.data['Mechanic'] ? consolidated.data['Mechanic'] : null,
      searchKeywords,
      createdAt: BUILD_TIMESTAMP,
      updatedAt: BUILD_TIMESTAMP,
    };
  });
};
