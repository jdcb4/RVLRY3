import { create } from 'zustand';

export const useGameStore = create((set) => ({
  playerName: '',
  roomCode: '',
  gameType: '',
  mode: 'online',
  setSession: (data) => set((state) => ({ ...state, ...data })),
  reset: () => set({ playerName: '', roomCode: '', gameType: '', mode: 'online' }),
}));
