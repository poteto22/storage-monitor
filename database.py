import sqlite3
import os
from datetime import datetime, timedelta

DB_PATH = os.path.join(os.path.dirname(__file__), "monitor.db")

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()
    
    # Global Config Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS drive_configs (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    """)
    
    # Monitored Network Drive Targets Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS target_paths (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            path TEXT NOT NULL,
            enabled INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Scan History Runs Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS scan_runs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            scan_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            total_bytes INTEGER DEFAULT 0,
            total_files INTEGER DEFAULT 0,
            status TEXT DEFAULT 'completed',
            duration_sec REAL DEFAULT 0
        )
    """)
    
    # Folder Snapshots Per Scan
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS folder_snapshots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            scan_id INTEGER,
            target_id INTEGER,
            folder_name TEXT NOT NULL,
            folder_path TEXT NOT NULL,
            size_bytes INTEGER DEFAULT 0,
            file_count INTEGER DEFAULT 0,
            subfolder_count INTEGER DEFAULT 0,
            scan_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (scan_id) REFERENCES scan_runs(id),
            FOREIGN KEY (target_id) REFERENCES target_paths(id)
        )
    """)
    
    # Default configs
    cursor.execute("INSERT OR IGNORE INTO drive_configs (key, value) VALUES ('total_capacity_tb', '10')")
    cursor.execute("INSERT OR IGNORE INTO drive_configs (key, value) VALUES ('drive_name', 'NAS Main Storage')")
    cursor.execute("INSERT OR IGNORE INTO drive_configs (key, value) VALUES ('auto_scan_enabled', 'true')")
    cursor.execute("INSERT OR IGNORE INTO drive_configs (key, value) VALUES ('scan_cron_hour', '0')") # 00:00 AM
    
    conn.commit()
    conn.close()

def get_configs():
    conn = get_db()
    rows = conn.execute("SELECT key, value FROM drive_configs").fetchall()
    conn.close()
    return {row["key"]: row["value"] for row in rows}

def set_config(key, value):
    conn = get_db()
    conn.execute("INSERT OR REPLACE INTO drive_configs (key, value) VALUES (?, ?)", (key, str(value)))
    conn.commit()
    conn.close()

def get_targets():
    conn = get_db()
    rows = conn.execute("SELECT * FROM target_paths ORDER BY id ASC").fetchall()
    conn.close()
    return [dict(row) for row in rows]

def add_target(name, path, enabled=1):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO target_paths (name, path, enabled) VALUES (?, ?, ?)", (name, path, enabled))
    target_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return target_id

def update_target(target_id, name, path, enabled):
    conn = get_db()
    conn.execute("UPDATE target_paths SET name = ?, path = ?, enabled = ? WHERE id = ?", (name, path, enabled, target_id))
    conn.commit()
    conn.close()

def delete_target(target_id):
    conn = get_db()
    conn.execute("DELETE FROM target_paths WHERE id = ?", (target_id,))
    conn.execute("DELETE FROM folder_snapshots WHERE target_id = ?", (target_id,))
    conn.commit()
    conn.close()

def record_scan_run(total_bytes, total_files, status, duration_sec):
    conn = get_db()
    cursor = conn.cursor()
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cursor.execute(
        "INSERT INTO scan_runs (scan_time, total_bytes, total_files, status, duration_sec) VALUES (?, ?, ?, ?, ?)",
        (now_str, total_bytes, total_files, status, duration_sec)
    )
    scan_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return scan_id

def record_folder_snapshot(scan_id, target_id, folder_name, folder_path, size_bytes, file_count, subfolder_count):
    conn = get_db()
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    conn.execute(
        """INSERT INTO folder_snapshots 
           (scan_id, target_id, folder_name, folder_path, size_bytes, file_count, subfolder_count, scan_time)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (scan_id, target_id, folder_name, folder_path, size_bytes, file_count, subfolder_count, now_str)
    )
    conn.commit()
    conn.close()

def get_latest_scan():
    conn = get_db()
    row = conn.execute("SELECT * FROM scan_runs ORDER BY id DESC LIMIT 1").fetchone()
    conn.close()
    return dict(row) if row else None

def get_latest_snapshots():
    conn = get_db()
    # Find the latest scan_run that actually has folder_snapshots recorded
    row = conn.execute("""
        SELECT scan_id FROM folder_snapshots 
        ORDER BY id DESC LIMIT 1
    """).fetchone()
    
    if not row:
        conn.close()
        return []
    
    latest_scan_id = row["scan_id"]
    rows = conn.execute("""
        SELECT s.*, COALESCE(t.name, s.folder_name) as target_name 
        FROM folder_snapshots s
        LEFT JOIN target_paths t ON s.target_id = t.id
        WHERE s.scan_id = ?
        ORDER BY s.size_bytes DESC
    """, (latest_scan_id,)).fetchall()
    
    conn.close()
    return [dict(row) for row in rows]

def get_growth_history(days=30):
    conn = get_db()
    rows = conn.execute("""
        SELECT id, scan_time, total_bytes, total_files, duration_sec
        FROM scan_runs
        WHERE scan_time >= datetime('now', '-' || ? || ' days')
        ORDER BY scan_time ASC
    """, (days,)).fetchall()
    conn.close()
    return [dict(row) for row in rows]
