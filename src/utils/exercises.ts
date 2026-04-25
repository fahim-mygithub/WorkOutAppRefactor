import { parse } from 'papaparse';
import { Exercise, ExerciseRaw, ExerciseDifficulty, ExerciseForce, ExerciseGrip, ExerciseMechanic } from '../types/exercise';

export const parseExerciseCSV = (csvContent: string): Exercise[] => {
  const result = parse<ExerciseRaw>(csvContent, {
    header: true,
    skipEmptyLines: true,
  });

  // Group exercises by name to consolidate duplicates
  const exerciseMap = new Map<string, {
    data: ExerciseRaw;
    muscleGroups: Set<string>;
    videoLinks: Set<string>;
    instructions: Set<string>;
    index: number;
  }>();

  result.data.forEach((row, index) => {
    const exerciseName = row['Exercise Name'];
    
    if (exerciseMap.has(exerciseName)) {
      // Add muscle group to existing exercise
      const existing = exerciseMap.get(exerciseName)!;
      existing.muscleGroups.add(row['Muscle Group']);
      
      // Add video links if they exist
      if (row['Video Links']) {
        row['Video Links'].split(',').forEach(link => {
          existing.videoLinks.add(link.trim());
        });
      }
      
      // Add instructions if they exist
      if (row['Instructions']) {
        row['Instructions'].split('|').forEach(instruction => {
          existing.instructions.add(instruction.trim());
        });
      }
    } else {
      // Create new exercise entry
      const muscleGroups = new Set<string>([row['Muscle Group']]);
      const videoLinks = new Set<string>();
      const instructions = new Set<string>();
      
      if (row['Video Links']) {
        row['Video Links'].split(',').forEach(link => {
          videoLinks.add(link.trim());
        });
      }
      
      if (row['Instructions']) {
        row['Instructions'].split('|').forEach(instruction => {
          instructions.add(instruction.trim());
        });
      }
      
      exerciseMap.set(exerciseName, {
        data: row,
        muscleGroups,
        videoLinks,
        instructions,
        index
      });
    }
  });

  // Convert consolidated exercises to Exercise objects
  return Array.from(exerciseMap.entries()).map(([exerciseName, consolidated], index) => {
    const muscleGroupsArray = Array.from(consolidated.muscleGroups).sort();
    const muscleGroupString = muscleGroupsArray.join(', ');
    
    const videoLinksArray = Array.from(consolidated.videoLinks).filter(Boolean);
    const instructionsArray = Array.from(consolidated.instructions).filter(Boolean);

    // Generate comprehensive search keywords from name, muscle groups, and equipment
    const generateSearchKeywords = (name: string, muscleGroups: string[], equipment: string): string[] => {
      const nameWords = name.toLowerCase().split(' ').filter(Boolean);
      const keywords = new Set<string>();
      
      // Add full name
      keywords.add(name.toLowerCase());
      
      // Add individual words
      nameWords.forEach(word => keywords.add(word));
      
      // Add muscle groups
      muscleGroups.forEach(mg => keywords.add(mg.toLowerCase()));
      
      // Add equipment
      keywords.add(equipment.toLowerCase());
      
      // Add plural/singular variations
      nameWords.forEach(word => {
        if (word.endsWith('s') && word.length > 3) {
          keywords.add(word.slice(0, -1)); // Remove 's' for singular
        } else if (!word.endsWith('s')) {
          keywords.add(word + 's'); // Add 's' for plural
        }
      });
      
      // Add common abbreviations and expansions
      const abbreviations: Record<string, string[]> = {
        'dumbbell': ['db', 'dumbell'],
        'barbell': ['bb', 'barbel'],
        'kettlebell': ['kb', 'kettle bell'],
        'overhead': ['oh'],
        'extension': ['ext'],
        'extensions': ['ext'],
        'press': ['pres'],
        'curl': ['curls'],
        'row': ['rows'],
        'tricep': ['triceps', 'tri'],
        'bicep': ['biceps', 'bi'],
      };
      
      nameWords.forEach(word => {
        if (abbreviations[word]) {
          abbreviations[word].forEach(abbrev => keywords.add(abbrev));
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
    
    const searchKeywords = generateSearchKeywords(exerciseName, muscleGroupsArray, consolidated.data['Equipment']);

    return {
      id: `exercise-${index + 1}`,
      muscleGroup: muscleGroupString,
      muscleGroups: muscleGroupsArray,
      name: exerciseName,
      equipment: consolidated.data['Equipment'],
      videoLinks: videoLinksArray,
      difficulty: (consolidated.data['Difficulty'] || 'Intermediate') as ExerciseDifficulty,
      force: consolidated.data['Force'] ? (consolidated.data['Force'] as ExerciseForce) : null,
      grips: consolidated.data['Grips'] ? (consolidated.data['Grips'] as ExerciseGrip) : null,
      mechanic: consolidated.data['Mechanic'] ? (consolidated.data['Mechanic'] as ExerciseMechanic) : null,
      instructions: instructionsArray,
      searchKeywords,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  });
};

export const loadExercisesFromCSV = async (): Promise<Exercise[]> => {
  try {
    const response = await fetch('/muscle_exercises.csv');
    const csvContent = await response.text();
    return parseExerciseCSV(csvContent);
  } catch (error) {
    console.error('Failed to load exercises from CSV:', error);
    return [];
  }
};

export const filterExercises = (exercises: Exercise[], searchTerm: string, muscleGroup?: string): Exercise[] => {
  let filtered = exercises;

  if (searchTerm) {
    const search = searchTerm.toLowerCase();
    filtered = filtered.filter(exercise => 
      exercise.name.toLowerCase().includes(search) ||
      exercise.muscleGroup.toLowerCase().includes(search) ||
      exercise.muscleGroups.some(mg => mg.toLowerCase().includes(search)) ||
      exercise.equipment.toLowerCase().includes(search) ||
      exercise.searchKeywords.some(keyword => 
        keyword.toLowerCase().includes(search)
      ) ||
      exercise.instructions.some(instruction => 
        instruction.toLowerCase().includes(search)
      )
    );
  }

  if (muscleGroup && muscleGroup !== 'all') {
    filtered = filtered.filter(exercise => 
      exercise.muscleGroups.some(mg => mg.toLowerCase() === muscleGroup.toLowerCase()) ||
      exercise.muscleGroup.toLowerCase() === muscleGroup.toLowerCase()
    );
  }

  return filtered;
};