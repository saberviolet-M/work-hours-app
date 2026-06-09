#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use rusqlite::{Connection, Result as SqliteResult};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;
use uuid::Uuid;

struct AppState {
    db: Mutex<Connection>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WorkRecord {
    pub id: String,
    pub date: String,
    pub requirement_name: String,
    pub hours: f64,
    pub project: String,
    pub raw_tags: Vec<String>,
    pub is_manual: bool,
    pub import_batch: String,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TagMapping {
    pub tag: String,
    pub category: String,
    pub mapped_to: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ExportConfig {
    pub id: String,
    pub month: String,
    pub attendance_days: i32,
    pub allocation_result: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Settings {
    pub api_key: String,
    pub default_attendance_days: i32,
    pub hours_per_day: f64,
}

fn init_db(conn: &Connection) -> SqliteResult<()> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS work_records (
            id TEXT PRIMARY KEY,
            date TEXT NOT NULL,
            requirement_name TEXT NOT NULL,
            hours REAL NOT NULL,
            project TEXT,
            raw_tags TEXT,
            is_manual INTEGER DEFAULT 0,
            import_batch TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS tag_mappings (
            tag TEXT PRIMARY KEY,
            category TEXT NOT NULL,
            mapped_to TEXT,
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS export_config (
            id TEXT PRIMARY KEY,
            month TEXT NOT NULL,
            attendance_days INTEGER NOT NULL,
            allocation_result TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )",
        [],
    )?;

    // Insert default settings if not exists
    conn.execute(
        "INSERT OR IGNORE INTO settings (key, value) VALUES ('api_key', '')",
        [],
    )?;
    conn.execute(
        "INSERT OR IGNORE INTO settings (key, value) VALUES ('default_attendance_days', '22')",
        [],
    )?;
    conn.execute(
        "INSERT OR IGNORE INTO settings (key, value) VALUES ('hours_per_day', '7.5')",
        [],
    )?;

    Ok(())
}

#[tauri::command]
fn get_all_records(state: State<AppState>) -> Result<Vec<WorkRecord>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare("SELECT id, date, requirement_name, hours, project, raw_tags, is_manual, import_batch, created_at FROM work_records ORDER BY date DESC")
        .map_err(|e| e.to_string())?;

    let records = stmt
        .query_map([], |row| {
            let raw_tags_str: String = row.get::<_, String>(5).unwrap_or_default();
            let raw_tags: Vec<String> = serde_json::from_str(&raw_tags_str).unwrap_or_default();

            Ok(WorkRecord {
                id: row.get(0)?,
                date: row.get(1)?,
                requirement_name: row.get(2)?,
                hours: row.get(3)?,
                project: row.get::<_, Option<String>>(4).unwrap_or_default().unwrap_or_default(),
                raw_tags,
                is_manual: row.get::<_, i32>(6).unwrap_or(0) == 1,
                import_batch: row.get::<_, Option<String>>(7).unwrap_or_default().unwrap_or_default(),
                created_at: row.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(records)
}

#[tauri::command]
fn add_records(state: State<AppState>, records: Vec<serde_json::Value>) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let batch_id = Uuid::new_v4().to_string();

    for record in records {
        let id = Uuid::new_v4().to_string();
        let date = record["date"].as_str().unwrap_or("");
        let requirement_name = record["requirement_name"].as_str().unwrap_or("");
        let hours = record["hours"].as_f64().unwrap_or(0.0);
        let project = record["project"].as_str().unwrap_or("");
        let raw_tags = serde_json::to_string(&record["raw_tags"]).unwrap_or_default();
        let is_manual = record["is_manual"].as_bool().unwrap_or(false);

        conn.execute(
            "INSERT INTO work_records (id, date, requirement_name, hours, project, raw_tags, is_manual, import_batch) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            rusqlite::params![id, date, requirement_name, hours, project, raw_tags, is_manual as i32, batch_id],
        ).map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
fn update_record(state: State<AppState>, id: String, updates: serde_json::Value) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;

    if let Some(date) = updates["date"].as_str() {
        conn.execute("UPDATE work_records SET date = ?1 WHERE id = ?2", rusqlite::params![date, id])
            .map_err(|e| e.to_string())?;
    }
    if let Some(name) = updates["requirement_name"].as_str() {
        conn.execute("UPDATE work_records SET requirement_name = ?1 WHERE id = ?2", rusqlite::params![name, id])
            .map_err(|e| e.to_string())?;
    }
    if let Some(hours) = updates["hours"].as_f64() {
        conn.execute("UPDATE work_records SET hours = ?1 WHERE id = ?2", rusqlite::params![hours, id])
            .map_err(|e| e.to_string())?;
    }
    if let Some(project) = updates["project"].as_str() {
        conn.execute("UPDATE work_records SET project = ?1 WHERE id = ?2", rusqlite::params![project, id])
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
fn delete_record(state: State<AppState>, id: String) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM work_records WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_tag_mappings(state: State<AppState>) -> Result<Vec<TagMapping>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare("SELECT tag, category, mapped_to FROM tag_mappings")
        .map_err(|e| e.to_string())?;

    let mappings = stmt
        .query_map([], |row| {
            Ok(TagMapping {
                tag: row.get(0)?,
                category: row.get(1)?,
                mapped_to: row.get(2).ok(),
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(mappings)
}

#[tauri::command]
fn update_tag_mapping(state: State<AppState>, tag: String, mapping: serde_json::Value) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let category = mapping["category"].as_str().unwrap_or("requirement");
    let mapped_to = mapping["mapped_to"].as_str();

    conn.execute(
        "INSERT OR REPLACE INTO tag_mappings (tag, category, mapped_to, updated_at) VALUES (?1, ?2, ?3, datetime('now'))",
        rusqlite::params![tag, category, mapped_to],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
fn get_settings(state: State<AppState>) -> Result<Settings, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;

    let get_setting = |key: &str| -> String {
        conn.query_row(
            "SELECT value FROM settings WHERE key = ?1",
            [key],
            |row| row.get(0),
        )
        .unwrap_or_default()
    };

    Ok(Settings {
        api_key: get_setting("api_key"),
        default_attendance_days: get_setting("default_attendance_days").parse().unwrap_or(22),
        hours_per_day: get_setting("hours_per_day").parse().unwrap_or(7.5),
    })
}

#[tauri::command]
fn save_settings(state: State<AppState>, settings: Settings) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('api_key', ?1)",
        [&settings.api_key],
    ).map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('default_attendance_days', ?1)",
        [settings.default_attendance_days.to_string()],
    ).map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('hours_per_day', ?1)",
        [settings.hours_per_day.to_string()],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn import_lake_file(content: String, use_ai: bool, api_key: String) -> Result<Vec<WorkRecord>, String> {
    // Parse lake file content
    let records = parse_lake_content(&content)?;

    if !use_ai || api_key.is_empty() {
        // Return raw records without AI processing
        return Ok(records);
    }

    // TODO: Call Claude API for AI processing
    // For now, return parsed records as-is
    Ok(records)
}

fn parse_lake_content(content: &str) -> Result<Vec<WorkRecord>, String> {
    use regex::Regex;

    // Extract card value
    let re = Regex::new(r#"value="([^"]+)""#).map_err(|e| e.to_string())?;
    let caps = re.captures(content).ok_or("Cannot find card value")?;
    let encoded = caps.get(1).ok_or("Cannot extract value")?.as_str();

    // URL decode
    let decoded = url_decode(encoded);

    // Parse outer JSON
    let outer: serde_json::Value = serde_json::from_str(&decoded).map_err(|e| e.to_string())?;

    // Parse content (it's a JSON string)
    let content_str = outer["content"].as_str().ok_or("No content field")?;
    let inner: serde_json::Value = serde_json::from_str(content_str).map_err(|e| e.to_string())?;

    let columns = inner["sheet"][0]["columns"]
        .as_array()
        .ok_or("No columns")?;
    let records = inner["records"]
        .as_array()
        .ok_or("No records")?;

    // Build column index
    let mut col_map: std::collections::HashMap<String, usize> = std::collections::HashMap::new();
    for (i, col) in columns.iter().enumerate() {
        if let Some(name) = col["name"].as_str() {
            col_map.insert(name.to_string(), i);
        }
    }

    let get_col_idx = |name: &str| -> Option<usize> {
        col_map.get(name).copied()
    };

    let get_value = |col_name: &str, data: &serde_json::Value| -> Option<String> {
        let idx = get_col_idx(col_name)?;
        let val = data.get(idx)?;
        Some(val.to_string())
    };

    let mut result = Vec::new();

    for record in records {
        let data = record["data"].as_str()
            .and_then(|s| serde_json::from_str(s).ok())
            .unwrap_or_default();

        let date = get_value("使用日期", &data).unwrap_or_default().trim_matches('"').to_string();
        let hours_str = get_value("使用时间", &data).unwrap_or_default();
        let hours: f64 = hours_str.trim_matches('"').parse().unwrap_or(1.0);
        let tags_str = get_value("工时内容", &data).unwrap_or_default();
        let tags: Vec<String> = serde_json::from_str(&tags_str).unwrap_or_default();
        let project = get_value("所属项目", &data).unwrap_or_default().trim_matches('"').to_string();

        result.push(WorkRecord {
            id: Uuid::new_v4().to_string(),
            date,
            requirement_name: tags.join(", "),
            hours,
            project,
            raw_tags: tags,
            is_manual: false,
            import_batch: Uuid::new_v4().to_string(),
            created_at: chrono::Utc::now().to_rfc3339(),
        });
    }

    Ok(result)
}

fn url_decode(s: &str) -> String {
    let mut result = String::new();
    let mut chars = s.chars().peekable();

    while let Some(c) = chars.next() {
        if c == '%' {
            let hex: String = chars.by_ref().take(2).collect();
            if hex.len() == 2 {
                if let Ok(byte) = u8::from_str_radix(&hex, 16) {
                    result.push(byte as char);
                } else {
                    result.push('%');
                    result.push_str(&hex);
                }
            } else {
                result.push('%');
                result.push_str(&hex);
            }
        } else if c == '+' {
            result.push(' ');
        } else {
            result.push(c);
        }
    }

    result
}

fn main() {
    let app_dir = tauri::api::path::app_data_dir(&tauri::Config::default()).unwrap_or_else(|| {
        std::path::PathBuf::from(".")
    });
    std::fs::create_dir_all(&app_dir).ok();

    let db_path = app_dir.join("work_hours.db");
    let conn = Connection::open(&db_path).expect("Failed to open database");
    init_db(&conn).expect("Failed to initialize database");

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(AppState {
            db: Mutex::new(conn),
        })
        .invoke_handler(tauri::generate_handler![
            get_all_records,
            add_records,
            update_record,
            delete_record,
            get_tag_mappings,
            update_tag_mapping,
            get_settings,
            save_settings,
            import_lake_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
