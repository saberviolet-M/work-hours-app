import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

export interface WorkRecord {
  id: string;
  date: string;
  requirement_name: string;
  hours: number;
  project: string;
  raw_tags: string[];
  is_manual: boolean;
  import_batch: string;
  created_at: string;
}

export interface TagMapping {
  tag: string;
  category: 'requirement' | 'activity';
  mapped_to: string | null;
}

export interface ExportConfig {
  id: string;
  month: string;
  attendance_days: number;
  allocation_result: string;
}

export interface Settings {
  api_key: string;
  default_attendance_days: number;
  hours_per_day: number;
}

interface AppState {
  records: WorkRecord[];
  tagMappings: TagMapping[];
  settings: Settings;
  isLoading: boolean;
  error: string | null;

  loadRecords: () => Promise<void>;
  addRecords: (records: Omit<WorkRecord, 'id' | 'created_at'>[]) => Promise<void>;
  updateRecord: (id: string, updates: Partial<WorkRecord>) => Promise<void>;
  deleteRecord: (id: string) => Promise<void>;

  loadTagMappings: () => Promise<void>;
  updateTagMapping: (tag: string, mapping: Partial<TagMapping>) => Promise<void>;

  loadSettings: () => Promise<void>;
  saveSettings: (settings: Settings) => Promise<void>;

  importLakeFile: (content: string, useAI: boolean) => Promise<WorkRecord[]>;
}

export const useAppStore = create<AppState>((set, get) => ({
  records: [],
  tagMappings: [],
  settings: {
    api_key: '',
    default_attendance_days: 22,
    hours_per_day: 7.5,
  },
  isLoading: false,
  error: null,

  loadRecords: async () => {
    set({ isLoading: true, error: null });
    try {
      const records = await invoke<WorkRecord[]>('get_all_records');
      set({ records, isLoading: false });
    } catch (e) {
      set({ error: String(e), isLoading: false });
    }
  },

  addRecords: async (records) => {
    set({ isLoading: true, error: null });
    try {
      await invoke('add_records', { records });
      await get().loadRecords();
    } catch (e) {
      set({ error: String(e), isLoading: false });
    }
  },

  updateRecord: async (id, updates) => {
    set({ isLoading: true, error: null });
    try {
      await invoke('update_record', { id, updates });
      await get().loadRecords();
    } catch (e) {
      set({ error: String(e), isLoading: false });
    }
  },

  deleteRecord: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await invoke('delete_record', { id });
      await get().loadRecords();
    } catch (e) {
      set({ error: String(e), isLoading: false });
    }
  },

  loadTagMappings: async () => {
    try {
      const mappings = await invoke<TagMapping[]>('get_tag_mappings');
      set({ tagMappings: mappings });
    } catch (e) {
      set({ error: String(e) });
    }
  },

  updateTagMapping: async (tag, mapping) => {
    try {
      await invoke('update_tag_mapping', { tag, mapping });
      await get().loadTagMappings();
    } catch (e) {
      set({ error: String(e) });
    }
  },

  loadSettings: async () => {
    try {
      const settings = await invoke<Settings>('get_settings');
      set({ settings });
    } catch (e) {
      set({ error: String(e) });
    }
  },

  saveSettings: async (settings) => {
    try {
      await invoke('save_settings', { settings });
      set({ settings });
    } catch (e) {
      set({ error: String(e) });
    }
  },

  importLakeFile: async (content, useAI) => {
    set({ isLoading: true, error: null });
    try {
      const records = await invoke<WorkRecord[]>('import_lake_file', {
        content,
        useAI,
        apiKey: get().settings.api_key,
      });
      set({ isLoading: false });
      return records;
    } catch (e) {
      set({ error: String(e), isLoading: false });
      throw e;
    }
  },
}));
