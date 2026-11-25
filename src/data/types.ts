// Mirrors SPEC.md §5. Every record is append-only and dated.
export type Level = 'beginner' | 'intermediate' | 'pro';
export type Mode = 'count' | 'time';
export type SparType = 'light' | 'hard';
export type Winner = 'red' | 'blue' | 'draw';

type Rec = { id: string; createdAt: string; synced?: boolean };

export type Branch = { id: string; name: string; nameEn?: string; address?: string };
export type Coach = { id: string; name: string; role: 'owner' | 'coach' };
/**
 * Player as stored. The fields after `joinedAt` are filled in by `useDB()` from the latest
 * PlayerEdit rows, so screens always see the current profile.
 */
export type Player = Rec & {
  name: string; nameEn?: string; phone: string; birthYear: number; joinedAt: string;
  birthDate?: string; photoUri?: string; noReminders?: boolean; archived?: boolean;
};
/** Append-only profile change: only the fields that changed. Latest row per field wins. */
export type PlayerEdit = Rec & {
  playerId: string; date: string;
  name?: string; phone?: string; birthDate?: string; photoUri?: string; noReminders?: boolean; archived?: boolean;
};
export type BranchHistory = Rec & { playerId: string; branchId: string; fromDate: string };
export type WeightLog = Rec & { playerId: string; weightKg: number; date: string };
export type LevelHistory = Rec & { playerId: string; level: Level; date: string };
export type Attendance = Rec & { playerId: string; branchId: string; date: string; method: 'manual' | 'qr' };
export type Package = { id: string; name: string; nameEn?: string; type: 'monthly' | 'quarterly' | 'sessions'; price: number; sessions?: number; days: number };
export type Subscription = Rec & { playerId: string; packageId: string; startDate: string; endDate: string };
export type Payment = Rec & { playerId: string; subscriptionId: string; amount: number; date: string; method: 'cash' };
export type Exercise = { id: string; name: string; nameEn?: string; mode: Mode; target: number; seconds: number; custom?: boolean };
export type WorkoutSession = Rec & { branchId: string; coachId: string; date: string };
export type ExerciseResult = Rec & {
  sessionId: string; playerId: string; exerciseId: string; mode: Mode; reps?: number; seconds?: number; date: string;
};
export type SparringSession = Rec & { branchId: string; type: SparType; rounds: number; roundSec: number; restSec: number; date: string };
export type Bout = Rec & { sparringId: string; red: string; blue: string; date: string; type: SparType; round?: number };
export type Round = Rec & { boutId: string; number: number; winner: Winner; date: string };
export type CoachNote = Rec & { playerId: string; coachId: string; text: string; date: string };

/** One WhatsApp reminder the coach sent (append-only; synced to Supabase later). */
export type ReminderLog = Rec & { playerId: string; kind: 'pay' | 'train'; reason: string; message: string; date: string; channel?: string };

export type DB = {
  players: Player[];
  playerEdits: PlayerEdit[];
  branchHistory: BranchHistory[];
  weights: WeightLog[];
  levels: LevelHistory[];
  attendance: Attendance[];
  subscriptions: Subscription[];
  payments: Payment[];
  sessions: WorkoutSession[];
  results: ExerciseResult[];
  sparrings: SparringSession[];
  bouts: Bout[];
  rounds: Round[];
  reminderLogs: ReminderLog[];
  coachNotes: CoachNote[];
};
export type Table = keyof DB;
