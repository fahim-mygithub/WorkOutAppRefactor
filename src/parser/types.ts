export interface ParsedSet {
  reps: number | { min: number; max: number };
  weight?: number;
  unit?: 'lbs' | 'kg';
  rpe?: number;
  time?: number;
  distance?: number;
}

export interface ParsedExercise {
  name: string;
  sets: ParsedSet[];
  notes?: string;
  restTime?: number;
}

export interface ParsedWorkout {
  exercises: ParsedExercise[];
  supersets: ParsedExercise[][];
}

export interface ParseError {
  line: number;
  column: number;
  message: string;
  suggestion?: string;
}

export interface ParseResult {
  success: boolean;
  workout?: ParsedWorkout;
  errors: ParseError[];
  warnings: string[];
}