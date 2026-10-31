import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CustomExerciseService, type SaveCustomExerciseData } from './customExerciseService';
import * as firestore from 'firebase/firestore';

vi.mock('firebase/firestore', () => {
  return {
    collection: vi.fn(() => ({ type: 'collection' })),
    doc: vi.fn((_db, _col, _uid, _subcol, id) => ({ id: id || 'doc-123' })),
    getDocs: vi.fn(),
    getDoc: vi.fn(),
    addDoc: vi.fn(),
    updateDoc: vi.fn(),
    deleteDoc: vi.fn(),
    query: vi.fn((c) => c),
    where: vi.fn(),
    orderBy: vi.fn(),
    writeBatch: vi.fn(),
    Timestamp: {
      fromDate: vi.fn((d: Date) => ({ toDate: () => d })),
      now: vi.fn(() => ({ toDate: () => new Date() })),
    },
  };
});

vi.mock('../firebase/config', () => ({
  db: {},
}));

describe('CustomExerciseService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('saveCustomExercise', () => {
    it('saves a custom exercise with timestamps and returns generated ID', async () => {
      vi.mocked(firestore.addDoc).mockResolvedValue({ id: 'saved-ex-1' } as any);

      const data: SaveCustomExerciseData = {
        name: 'Incline Cable Fly',
        originalName: 'Incline Cable Fly',
        muscleGroup: 'Chest',
        equipment: 'Cable',
        difficulty: 'Intermediate',
        instructions: ['Set pulleys low.', 'Fly upward.'],
        notes: 'Target upper chest',
        videoLinks: ['https://r2.test/fly.mp4'],
      };

      const result = await CustomExerciseService.saveCustomExercise('user-1', data);
      expect(result).toBe('saved-ex-1');
      expect(firestore.addDoc).toHaveBeenCalledTimes(1);
      const payload = vi.mocked(firestore.addDoc).mock.calls[0][1] as any;
      expect(payload.name).toBe('Incline Cable Fly');
      expect(payload.videoLinks).toEqual(['https://r2.test/fly.mp4']);
      expect(payload.isCustom).toBe(true);
      expect(payload.searchKeywords).toContain('incline');
    });

    it('throws when Firestore write fails', async () => {
      vi.mocked(firestore.addDoc).mockRejectedValue(new Error('Network error'));
      await expect(
        CustomExerciseService.saveCustomExercise('user-1', {
          name: 'Fail Ex',
          originalName: 'Fail Ex',
          muscleGroup: 'Legs',
          equipment: 'Barbell',
          difficulty: 'Beginner',
        }),
      ).rejects.toThrow('Failed to save custom exercise');
    });
  });

  describe('updateCustomExercise', () => {
    it('updates exercise fields in Firestore with updated timestamp', async () => {
      vi.mocked(firestore.updateDoc).mockResolvedValue(undefined as any);

      await CustomExerciseService.updateCustomExercise('user-1', 'ex-123', {
        name: 'Updated Fly',
        videoLinks: ['https://r2.test/new-video.mp4'],
      });

      expect(firestore.updateDoc).toHaveBeenCalledTimes(1);
      const call = vi.mocked(firestore.updateDoc).mock.calls[0];
      expect(call[1]).toMatchObject({
        name: 'Updated Fly',
        videoLinks: ['https://r2.test/new-video.mp4'],
      });
    });

    it('throws when update fails', async () => {
      vi.mocked(firestore.updateDoc).mockRejectedValue(new Error('Permission denied'));
      await expect(
        CustomExerciseService.updateCustomExercise('user-1', 'ex-123', { name: 'X' }),
      ).rejects.toThrow('Failed to update custom exercise');
    });
  });

  describe('deleteCustomExercise', () => {
    it('deletes exercise document from Firestore', async () => {
      vi.mocked(firestore.deleteDoc).mockResolvedValue(undefined as any);

      await CustomExerciseService.deleteCustomExercise('user-1', 'ex-123');
      expect(firestore.deleteDoc).toHaveBeenCalledTimes(1);
    });

    it('throws when delete fails', async () => {
      vi.mocked(firestore.deleteDoc).mockRejectedValue(new Error('Delete error'));
      await expect(CustomExerciseService.deleteCustomExercise('user-1', 'ex-123')).rejects.toThrow(
        'Failed to delete custom exercise',
      );
    });
  });

  describe('getUserCustomExercises', () => {
    it('retrieves and maps user custom exercises', async () => {
      const mockDocs = [
        {
          id: 'ex-1',
          data: () => ({
            name: 'Hack Squat',
            originalName: 'Hack Squat',
            muscleGroup: 'Legs',
            equipment: 'Machine',
            difficulty: 'Intermediate',
            videoLinks: ['https://r2.test/squat.webm'],
            usageCount: 5,
            createdAt: { toDate: () => new Date('2026-01-01') },
            updatedAt: { toDate: () => new Date('2026-01-02') },
          }),
        },
      ];
      vi.mocked(firestore.getDocs).mockResolvedValue({
        forEach: (fn: any) => mockDocs.forEach(fn),
      } as any);

      const exercises = await CustomExerciseService.getUserCustomExercises('user-1');
      expect(exercises).toHaveLength(1);
      expect(exercises[0].name).toBe('Hack Squat');
      expect(exercises[0].videoLinks).toEqual(['https://r2.test/squat.webm']);
      expect(exercises[0].usageCount).toBe(5);
    });
  });

  describe('mergeWithDatabaseExercises', () => {
    it('places custom exercises first sorted by usageCount', () => {
      const dbExercises = [
        {
          id: 'db-1',
          name: 'Barbell Bench Press',
          muscleGroup: 'Chest',
          muscleGroups: ['Chest'],
          equipment: 'Barbell',
          videoLinks: [],
          instructions: [],
          difficulty: 'Intermediate' as const,
          force: null,
          grips: null,
          mechanic: null,
          searchKeywords: ['bench'],
          createdAt: '',
          updatedAt: '',
        },
      ];

      const customExercises = [
        {
          id: 'c-1',
          name: 'Custom Low Usage',
          originalName: 'Custom Low Usage',
          userId: 'u1',
          isCustom: true as const,
          muscleGroup: 'Back',
          equipment: 'Dumbbells',
          videoLinks: [],
          instructions: [],
          difficulty: 'Beginner' as const,
          force: null,
          grips: null,
          mechanic: null,
          searchKeywords: ['custom'],
          createdAt: new Date('2026-01-01'),
          updatedAt: new Date('2026-01-01'),
          usageCount: 1,
        },
        {
          id: 'c-2',
          name: 'Custom High Usage',
          originalName: 'Custom High Usage',
          userId: 'u1',
          isCustom: true as const,
          muscleGroup: 'Back',
          equipment: 'Cable',
          videoLinks: ['https://r2.test/high.gif'],
          instructions: [],
          difficulty: 'Advanced' as const,
          force: null,
          grips: null,
          mechanic: null,
          searchKeywords: ['custom'],
          createdAt: new Date('2026-01-02'),
          updatedAt: new Date('2026-01-02'),
          usageCount: 10,
        },
      ];

      const merged = CustomExerciseService.mergeWithDatabaseExercises(dbExercises, customExercises);
      expect(merged).toHaveLength(3);
      expect(merged[0].name).toBe('Custom High Usage');
      expect(merged[1].name).toBe('Custom Low Usage');
      expect(merged[2].name).toBe('Barbell Bench Press');
    });
  });

  describe('createCustomExerciseFromText', () => {
    it('infers muscle group and equipment from text patterns', () => {
      const result = CustomExerciseService.createCustomExerciseFromText('Incline Dumbbell Bench Press', 'u1');
      expect(result.name).toBe('Incline Dumbbell Bench Press');
      expect(result.muscleGroup).toBe('Chest');
      expect(result.equipment).toBe('Dumbbells');
    });
  });
});
