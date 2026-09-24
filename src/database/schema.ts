// src/database/schema.ts
import * as SQLite from 'expo-sqlite';

const DB_NAME = 'ai_coach.db';
let dbInstance: SQLite.SQLiteDatabase | null = null;

export const getDBConnection = async () => {
  if (dbInstance) {
    return dbInstance;
  }
  
  dbInstance = await SQLite.openDatabaseAsync(DB_NAME);
  
  // Kích hoạt Foreign Keys
  await dbInstance.execAsync('PRAGMA foreign_keys = ON;');

  // Tạo các bảng dữ liệu
  await dbInstance.execAsync(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      category TEXT,
      event_date TEXT NOT NULL,
      status TEXT DEFAULT 'ACTIVE',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS reflections (
      id TEXT PRIMARY KEY NOT NULL,
      event_id TEXT NOT NULL,
      past_experience TEXT,
      identified_mistakes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS preparation_tasks (
      id TEXT PRIMARY KEY NOT NULL,
      event_id TEXT NOT NULL,
      title TEXT NOT NULL,
      scheduled_time TEXT,
      is_completed INTEGER DEFAULT 0,
      notification_id TEXT,
      FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS evaluations (
      id TEXT PRIMARY KEY NOT NULL,
      event_id TEXT NOT NULL,
      user_feedback TEXT,
      helpfulness_score INTEGER,
      key_takeaways TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_settings (
      id TEXT PRIMARY KEY NOT NULL,
      full_name TEXT,
      age_group TEXT,
      occupation TEXT,
      notifications_enabled INTEGER DEFAULT 1,
      quiet_hours_start TEXT DEFAULT '22:00',
      quiet_hours_end TEXT DEFAULT '07:00',
      is_premium INTEGER DEFAULT 0,
      is_onboarded INTEGER DEFAULT 0
    );

  
    CREATE TABLE IF NOT EXISTS chat_sessions (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY NOT NULL,
      session_id TEXT NOT NULL,
      sender TEXT NOT NULL, -- 'user' hoặc 'ai'
      text TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES chat_sessions (id) ON DELETE CASCADE
    );
  `);

  console.log('✅ SQLite Database Connected & Configured!');
  return dbInstance;
};