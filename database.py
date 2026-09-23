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
    
    # Main Drives Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS main_drives (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            total_capacity_tb REAL DEFAULT 10.0,
            enabled INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
    
    # Ensure drive_id column exists in target_paths
    target_cols = [row[1] for row in cursor.execute("PRAGMA table_info(target_paths)").fetchall()]
    if "drive_id" not in target_cols:
        cursor.execute("ALTER TABLE target_paths ADD COLUMN drive_id INTEGER DEFAULT 1 REFERENCES main_drives(id)")
    
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

    # Ensure drive_id column exists in folder_snapshots
    snapshot_cols = [row[1] for row in cursor.execute("PRAGMA table_info(folder_snapshots)").fetchall()]
    if "drive_id" not in snapshot_cols:
        cursor.execute("ALTER TABLE folder_snapshots ADD COLUMN drive_id INTEGER DEFAULT 1 REFERENCES main_drives(id)")
    
    # Default configs
    cursor.execute("INSERT OR IGNORE INTO drive_configs (key, value) VALUES ('total_capacity_tb', '10')")
    cursor.execute("INSERT OR IGNORE INTO drive_configs (key, value) VALUES ('drive_name', 'NAS Main Storage')")
    cursor.execute("INSERT OR IGNORE INTO drive_configs (key, value) VALUES ('auto_scan_enabled', 'true')")
    cursor.execute("INSERT OR IGNORE INTO drive_configs (key, value) VALUES ('scan_cron_hour', '0')") # 00:00 AM
    
    # Auto-seed initial main_drive if empty
    cursor.execute("SELECT COUNT(*) FROM main_drives")
    if cursor.fetchone()[0] == 0:
        cursor.execute("SELECT value FROM drive_configs WHERE key = 'drive_name'")
        row_name = cursor.fetchone()
        drive_name = row_name[0] if row_name else "NAS Main Storage"
        
        cursor.execute("SELECT value FROM drive_configs WHERE key = 'total_capacity_tb'")
        row_cap = cursor.fetchone()
        cap_tb = float(row_cap[0]) if row_cap else 10.0
        
        cursor.execute("INSERT INTO main_drives (id, name, total_capacity_tb, enabled) VALUES (1, ?, ?, 1)", (drive_name, cap_tb))
        cursor.execute("UPDATE target_paths SET drive_id = 1 WHERE drive_id IS NULL OR drive_id = 0")
        cursor.execute("UPDATE folder_snapshots SET drive_id = 1 WHERE drive_id IS NULL OR drive_id = 0")
    
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

def get_drives():
    conn = get_db()
    rows = conn.execute("SELECT * FROM main_drives ORDER BY id ASC").fetchall()
    conn.close()
    return [dict(row) for row in rows]

def get_drive(drive_id: int):
    conn = get_db()
    row = conn.execute("SELECT * FROM main_drives WHERE id = ?", (drive_id,)).fetchone()
    conn.close()
    return dict(row) if row else None

def add_drive(name: str, total_capacity_tb: float, enabled: int = 1):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO main_drives (name, total_capacity_tb, enabled) VALUES (?, ?, ?)", (name, total_capacity_tb, enabled))
    drive_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return drive_id

def update_drive(drive_id: int, name: str, total_capacity_tb: float, enabled: int = 1):
    conn = get_db()
    conn.execute("UPDATE main_drives SET name = ?, total_capacity_tb = ?, enabled = ? WHERE id = ?", (name, total_capacity_tb, enabled, drive_id))
    conn.commit()
    conn.close()

def delete_drive(drive_id: int):
    conn = get_db()
    conn.execute("DELETE FROM main_drives WHERE id = ?", (drive_id,))
    conn.execute("DELETE FROM target_paths WHERE drive_id = ?", (drive_id,))
    conn.execute("DELETE FROM folder_snapshots WHERE drive_id = ?", (drive_id,))
    conn.commit()
    conn.close()

def get_targets(drive_id=None):
    conn = get_db()
    if drive_id and str(drive_id).lower() != 'all':
        rows = conn.execute("""
            SELECT t.*, d.name as drive_name 
            FROM target_paths t
            LEFT JOIN main_drives d ON t.drive_id = d.id
            WHERE t.drive_id = ?
            ORDER BY t.id ASC
        """, (drive_id,)).fetchall()
    else:
        rows = conn.execute("""
            SELECT t.*, d.name as drive_name 
            FROM target_paths t
            LEFT JOIN main_drives d ON t.drive_id = d.id
            ORDER BY t.id ASC
        """).fetchall()
    conn.close()
    return [dict(row) for row in rows]

def add_target(name, path, enabled=1, drive_id=1):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO target_paths (name, path, enabled, drive_id) VALUES (?, ?, ?, ?)", (name, path, enabled, drive_id))
    target_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return target_id

def update_target(target_id, name, path, enabled, drive_id=1):
    conn = get_db()
    conn.execute("UPDATE target_paths SET name = ?, path = ?, enabled = ?, drive_id = ? WHERE id = ?", (name, path, enabled, drive_id, target_id))
    conn.commit()
    conn.close()

def delete_target(target_id):
    conn = get_db()
    conn.execute("DELETE FROM target_paths WHERE id = ?", (target_id,))
    conn.execute("DELETE FROM folder_snapshots WHERE target_id = ?", (target_id,))
    conn.commit()
    conn.close()

def is_scan_running():
    conn = get_db()
    row = conn.execute("""
        SELECT id FROM scan_runs 
        WHERE status = 'running' 
        AND scan_time >= datetime('now', '-2 hours')
        LIMIT 1
    """).fetchone()
    conn.close()
    return row is not None

def start_scan_run():
    conn = get_db()
    cursor = conn.cursor()
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cursor.execute(
        "INSERT INTO scan_runs (scan_time, total_bytes, total_files, status, duration_sec) VALUES (?, 0, 0, 'running', 0)",
        (now_str,)
    )
    scan_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return scan_id

def finish_scan_run(scan_id, total_bytes, total_files, status="completed", duration_sec=0):
    conn = get_db()
    conn.execute(
        "UPDATE scan_runs SET total_bytes = ?, total_files = ?, status = ?, duration_sec = ? WHERE id = ?",
        (total_bytes, total_files, status, duration_sec, scan_id)
    )
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

def record_folder_snapshot(scan_id, target_id, folder_name, folder_path, size_bytes, file_count, subfolder_count, drive_id=1):
    conn = get_db()
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    conn.execute(
        """INSERT INTO folder_snapshots 
           (scan_id, target_id, folder_name, folder_path, size_bytes, file_count, subfolder_count, scan_time, drive_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (scan_id, target_id, folder_name, folder_path, size_bytes, file_count, subfolder_count, now_str, drive_id)
    )
    conn.commit()
    conn.close()

def get_latest_scan():
    conn = get_db()
    row = conn.execute("SELECT * FROM scan_runs ORDER BY id DESC LIMIT 1").fetchone()
    conn.close()
    return dict(row) if row else None

def get_latest_snapshots(drive_id=None):
    conn = get_db()
    
    if drive_id and str(drive_id).lower() != 'all':
        rows = conn.execute("""
            SELECT s.*, COALESCE(t.name, s.folder_name) as target_name, d.name as drive_name
            FROM folder_snapshots s
            JOIN (
                SELECT folder_path, MAX(id) as max_snap_id
                FROM folder_snapshots
                GROUP BY folder_path
            ) latest ON s.id = latest.max_snap_id
            LEFT JOIN target_paths t ON s.target_id = t.id
            LEFT JOIN main_drives d ON s.drive_id = d.id
            WHERE s.drive_id = ?
            ORDER BY s.size_bytes DESC
        """, (drive_id,)).fetchall()
    else:
        rows = conn.execute("""
            SELECT s.*, COALESCE(t.name, s.folder_name) as target_name, d.name as drive_name
            FROM folder_snapshots s
            JOIN (
                SELECT folder_path, MAX(id) as max_snap_id
                FROM folder_snapshots
                GROUP BY folder_path
            ) latest ON s.id = latest.max_snap_id
            LEFT JOIN target_paths t ON s.target_id = t.id
            LEFT JOIN main_drives d ON s.drive_id = d.id
            ORDER BY s.size_bytes DESC
        """).fetchall()
    
    snapshots = [dict(row) for row in rows]
    
    # Calculate size change compared to previous scan for each folder
    for snap in snapshots:
        prev_row = conn.execute("""
            SELECT size_bytes, file_count FROM folder_snapshots
            WHERE folder_path = ? AND id < ?
            ORDER BY id DESC LIMIT 1
        """, (snap["folder_path"], snap["id"])).fetchone()
        
        if prev_row:
            prev_size = prev_row["size_bytes"] or 0
            prev_files = prev_row["file_count"] or 0
            curr_size = snap["size_bytes"] or 0
            curr_files = snap["file_count"] or 0
            
            diff_bytes = curr_size - prev_size
            diff_files = curr_files - prev_files
            pct = round((diff_bytes / prev_size * 100), 2) if prev_size > 0 else 0.0
            
            snap["change_bytes"] = diff_bytes
            snap["change_files"] = diff_files
            snap["change_percent"] = pct
        else:
            snap["change_bytes"] = 0
            snap["change_files"] = 0
            snap["change_percent"] = 0.0

    conn.close()
    return snapshots

def get_growth_history(days=30, drive_id=None):
    conn = get_db()
    if drive_id and str(drive_id).lower() != 'all':
        rows = conn.execute("""
            SELECT r.id, r.scan_time, 
                   COALESCE(SUM(s.size_bytes), 0) as total_bytes, 
                   COALESCE(SUM(s.file_count), 0) as total_files, 
                   r.duration_sec
            FROM scan_runs r
            JOIN folder_snapshots s ON r.id = s.scan_id
            WHERE s.drive_id = ? AND r.scan_time >= datetime('now', '-' || ? || ' days')
            GROUP BY r.id, r.scan_time, r.duration_sec
            ORDER BY r.scan_time ASC
        """, (drive_id, days)).fetchall()
    else:
        rows = conn.execute("""
            SELECT r.id, r.scan_time, 
                   COALESCE(SUM(s.size_bytes), 0) as total_bytes, 
                   COALESCE(SUM(s.file_count), 0) as total_files, 
                   r.duration_sec
            FROM scan_runs r
            JOIN folder_snapshots s ON r.id = s.scan_id
            WHERE r.scan_time >= datetime('now', '-' || ? || ' days')
            GROUP BY r.id, r.scan_time, r.duration_sec
            ORDER BY r.scan_time ASC
        """, (days,)).fetchall()
    conn.close()
    return [dict(row) for row in rows]

def get_folder_history(folder_path: str = None, folder_name: str = None, days: int = 30):
    conn = get_db()
    clean_path = (folder_path or "").strip()
    norm_path = clean_path.rstrip("/\\")
    clean_name = (folder_name or "").strip()
    
    rows = conn.execute("""
        SELECT s.*, r.scan_time as run_scan_time
        FROM folder_snapshots s
        LEFT JOIN scan_runs r ON s.scan_id = r.id
        WHERE (
            (length(?) > 0 AND (s.folder_path = ? OR s.folder_path = ? OR RTRIM(s.folder_path, '/\') = ?))
            OR (length(?) > 0 AND s.folder_name = ?)
        )
        AND s.scan_time >= datetime('now', '-' || ? || ' days')
        ORDER BY s.scan_time ASC
    """, (clean_path, clean_path, norm_path, norm_path, clean_name, clean_name, days)).fetchall()
    
    # Fallback search if strict path match produced 0 items
    if not rows and (clean_name or clean_path):
        search_key = clean_name or os.path.basename(clean_path)
        if search_key:
            rows = conn.execute("""
                SELECT s.*, r.scan_time as run_scan_time
                FROM folder_snapshots s
                LEFT JOIN scan_runs r ON s.scan_id = r.id
                WHERE s.folder_name = ? OR s.folder_path LIKE ?
                ORDER BY s.scan_time ASC
            """, (search_key, '%' + search_key)).fetchall()

    conn.close()
    
    result = [dict(row) for row in rows]
    for i in range(len(result)):
        if i == 0:
            result[i]["change_bytes"] = 0
            result[i]["change_files"] = 0
            result[i]["change_percent"] = 0.0
        else:
            prev_size = result[i-1]["size_bytes"] or 0
            curr_size = result[i]["size_bytes"] or 0
            prev_files = result[i-1]["file_count"] or 0
            curr_files = result[i]["file_count"] or 0
            
            diff_bytes = curr_size - prev_size
            diff_files = curr_files - prev_files
            pct = round((diff_bytes / prev_size * 100), 2) if prev_size > 0 else 0.0
            
            result[i]["change_bytes"] = diff_bytes
            result[i]["change_files"] = diff_files
            result[i]["change_percent"] = pct
            
    return result




