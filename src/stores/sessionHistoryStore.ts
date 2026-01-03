import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

// Serializable session record for persistence
export interface SessionRecord {
  id: string;
  fileId: string; // Unique file identifier for tracking across renames/moves
  fileName: string; // Display name (can change)
  startTime: string; // ISO 8601 string for serialization
  endTime: string | null;
  duration: number; // in seconds
  stitchesCompleted: number;
  stitchesPerMinute: number;
  status: 'active' | 'paused' | 'completed';
}

interface SessionHistoryFile {
  version: string;
  sessions: SessionRecord[];
}

interface SessionHistoryState {
  sessions: SessionRecord[];
  isLoaded: boolean;
  currentSessionId: string | null;

  // Actions
  loadHistory: () => Promise<void>;
  saveHistory: () => Promise<void>;
  startSession: (fileId: string, fileName: string) => string;
  findActiveSessionByFileId: (fileId: string) => SessionRecord | undefined;
  pauseSession: (sessionId: string) => void;
  resumeSession: (sessionId: string) => void;
  endSession: (sessionId: string, duration: number, stitchesCompleted: number, stitchesPerMinute: number) => void;
  updateCurrentSession: (duration: number, stitchesCompleted: number, stitchesPerMinute: number) => void;
  updateCurrentSessionFileName: (fileName: string) => void;
  deleteSession: (sessionId: string) => void;
  clearHistory: () => Promise<void>;
}

export const useSessionHistoryStore = create<SessionHistoryState>((set, get) => ({
  sessions: [],
  isLoaded: false,
  currentSessionId: null,

  loadHistory: async () => {
    try {
      const data = await invoke<string>('load_session_history');
      if (data) {
        const parsed: SessionHistoryFile = JSON.parse(data);
        // Mark any "active" sessions from previous runs as "paused"
        const sessions = parsed.sessions.map(session => ({
          ...session,
          status: session.status === 'active' ? 'paused' as const : session.status,
        }));
        set({ sessions, isLoaded: true });
      } else {
        set({ sessions: [], isLoaded: true });
      }
    } catch (error) {
      console.error('Failed to load session history:', error);
      set({ sessions: [], isLoaded: true });
    }
  },

  saveHistory: async () => {
    const { sessions } = get();
    const data: SessionHistoryFile = {
      version: '1.0',
      sessions,
    };
    try {
      await invoke('save_session_history', { data: JSON.stringify(data, null, 2) });
    } catch (error) {
      console.error('Failed to save session history:', error);
    }
  },

  startSession: (fileId: string, fileName: string) => {
    const newSessionId = `session-${Date.now()}`;
    const newSession: SessionRecord = {
      id: newSessionId,
      fileId,
      fileName,
      startTime: new Date().toISOString(),
      endTime: null,
      duration: 0,
      stitchesCompleted: 0,
      stitchesPerMinute: 0,
      status: 'active',
    };
    set(state => ({
      sessions: [newSession, ...state.sessions],
      currentSessionId: newSessionId,
    }));
    // Save after starting
    get().saveHistory();
    return newSessionId;
  },

  findActiveSessionByFileId: (fileId: string) => {
    const { sessions } = get();
    // Find an active or paused session for this file
    return sessions.find(s => s.fileId === fileId && (s.status === 'active' || s.status === 'paused'));
  },

  pauseSession: (sessionId: string) => {
    set(state => ({
      sessions: state.sessions.map(session =>
        session.id === sessionId
          ? { ...session, status: 'paused' as const }
          : session
      ),
    }));
    get().saveHistory();
  },

  resumeSession: (sessionId: string) => {
    set(state => ({
      sessions: state.sessions.map(session =>
        session.id === sessionId
          ? { ...session, status: 'active' as const }
          : session
      ),
      currentSessionId: sessionId,
    }));
    get().saveHistory();
  },

  endSession: (sessionId: string, duration: number, stitchesCompleted: number, stitchesPerMinute: number) => {
    set(state => ({
      sessions: state.sessions.map(session =>
        session.id === sessionId
          ? {
              ...session,
              endTime: new Date().toISOString(),
              duration,
              stitchesCompleted,
              stitchesPerMinute,
              status: 'completed' as const,
            }
          : session
      ),
      currentSessionId: null,
    }));
    get().saveHistory();
  },

  updateCurrentSession: (duration: number, stitchesCompleted: number, stitchesPerMinute: number) => {
    const { currentSessionId } = get();
    if (!currentSessionId) return;

    set(state => ({
      sessions: state.sessions.map(session =>
        session.id === currentSessionId
          ? {
              ...session,
              duration,
              stitchesCompleted,
              stitchesPerMinute,
            }
          : session
      ),
    }));
  },

  updateCurrentSessionFileName: (fileName: string) => {
    const { currentSessionId } = get();
    if (!currentSessionId) return;

    set(state => ({
      sessions: state.sessions.map(session =>
        session.id === currentSessionId
          ? { ...session, fileName }
          : session
      ),
    }));
    get().saveHistory();
  },

  deleteSession: (sessionId: string) => {
    const { currentSessionId } = get();
    set(state => ({
      sessions: state.sessions.filter(session => session.id !== sessionId),
      // Clear currentSessionId if we're deleting the current session
      currentSessionId: currentSessionId === sessionId ? null : currentSessionId,
    }));
    get().saveHistory();
  },

  clearHistory: async () => {
    set({ sessions: [], currentSessionId: null });
    await get().saveHistory();
  },
}));

// Helper to format date for display
export function formatSessionDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
  }) + ' ' + date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}
