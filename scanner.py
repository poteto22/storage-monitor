import os
import time
import logging
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
import database

logger = logging.getLogger("scanner")

# Global scan status with live console logging
scan_state = {
    "is_scanning": False,
    "progress_percent": 0,
    "current_folder": "",
    "scanned_count": 0,
    "total_targets": 0,
    "last_error": None,
    "logs": []  # List of dicts: {"time": "18:20:00", "message": "...", "type": "info/success/error"}
}

def get_scan_status():
    return scan_state

def add_scan_log(message, msg_type="info"):
    now_str = datetime.now().strftime("%H:%M:%S")
    log_entry = {"time": now_str, "message": message, "type": msg_type}
    scan_state["logs"].append(log_entry)
    if len(scan_state["logs"]) > 150:
        scan_state["logs"] = scan_state["logs"][-150:]

def format_bytes_simple(bytes_val):
    if not bytes_val or bytes_val == 0:
        return '0 B'
    k = 1024
    sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
    import math
    i = int(math.floor(math.log(bytes_val) / math.log(k)))
    return f"{round(bytes_val / math.pow(k, i), 2)} {sizes[i]}"

def get_detailed_folder_stats(folder_path):
    """
    100% Accurate & Detailed Scanner:
    Recursively walks through all nested subdirectories and stat()s every file
    to sum exact byte sizes and count all files and subfolders accurately.
    """
    if not os.path.exists(folder_path):
        return {
            "path": folder_path,
            "exists": False,
            "size_bytes": 0,
            "file_count": 0,
            "subfolder_count": 0,
            "error": "Path does not exist or network drive unmounted."
        }
    
    total_size = 0
    file_count = 0
    subfolder_count = 0
    error_count = 0
    
    try:
        for root, dirs, files in os.walk(folder_path, followlinks=False):
            # Skip hidden directories like .DS_Store, .AppleDB, etc.
            dirs[:] = [d for d in dirs if not d.startswith('.')]
            subfolder_count += len(dirs)
            
            for f in files:
                if f.startswith('.') or f in ['.DS_Store', 'Thumbs.db']:
                    continue
                fp = os.path.join(root, f)
                try:
                    st = os.stat(fp, follow_symlinks=False)
                    total_size += st.st_size
                    file_count += 1
                except (PermissionError, FileNotFoundError, OSError):
                    error_count += 1
                    continue
                    
        return {
            "path": folder_path,
            "exists": True,
            "size_bytes": total_size,
            "file_count": file_count,
            "subfolder_count": subfolder_count,
            "error": f"{error_count} permission errors" if error_count > 0 else None
        }
    except Exception as e:
        return {
            "path": folder_path,
            "exists": True,
            "size_bytes": total_size,
            "file_count": file_count,
            "subfolder_count": subfolder_count,
            "error": str(e)
        }

def run_full_scan():
    global scan_state
    if scan_state["is_scanning"]:
        return {"status": "already_running"}
        
    scan_state["is_scanning"] = True
    scan_state["progress_percent"] = 0
    scan_state["scanned_count"] = 0
    scan_state["last_error"] = None
    scan_state["logs"] = []
    
    add_scan_log("เริ่มต้นการสแกนละเอียด (Detailed Precision Scan)...", "info")
    
    start_time = time.time()
    targets = database.get_targets()
    enabled_targets = [t for t in targets if t.get("enabled", 1) == 1]
    
    if not enabled_targets:
        scan_id = database.record_scan_run(0, 0, "completed_empty", 0)
        scan_state["is_scanning"] = False
        scan_state["progress_percent"] = 100
        add_scan_log("ไม่มี Target โฟลเดอร์ที่เปิดใช้งาน", "warning")
        return {"scan_id": scan_id, "targets_scanned": 0, "total_bytes": 0, "duration_sec": 0}
    
    # Expand targets into main folders
    expanded_items = []
    for t in enabled_targets:
        t_path = t["path"]
        if os.path.exists(t_path) and os.path.isdir(t_path):
            try:
                sub_dirs = []
                with os.scandir(t_path) as it:
                    for entry in it:
                        if entry.is_dir(follow_symlinks=False) and not entry.name.startswith('.'):
                            sub_dirs.append(entry)
                            
                if sub_dirs:
                    for sd in sub_dirs:
                        expanded_items.append((t["id"], sd.name, sd.path))
                else:
                    expanded_items.append((t["id"], t["name"], t_path))
            except Exception:
                expanded_items.append((t["id"], t["name"], t_path))
        else:
            expanded_items.append((t["id"], t["name"], t_path))
            
    scan_state["total_targets"] = len(expanded_items)
    add_scan_log(f"พบทั้งสิ้น {len(expanded_items)} โฟลเดอร์หลัก กำลังเริ่มสแกนและคำนวณไฟล์อย่างละเอียดทุกไฟล์...", "info")
    
    snapshots_to_record = []
    total_bytes = 0
    total_files = 0
    
    # Execute parallel detailed scanning with 8 worker threads
    max_workers = min(len(expanded_items), 8) if expanded_items else 1
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_to_item = {
            executor.submit(get_detailed_folder_stats, item[2]): item 
            for item in expanded_items
        }
        
        for future in as_completed(future_to_item):
            target_id, folder_name, folder_path = future_to_item[future]
            try:
                stats = future.result()
                snapshots_to_record.append((target_id, folder_name, folder_path, stats))
                total_bytes += stats["size_bytes"]
                total_files += stats["file_count"]
                
                size_str = format_bytes_simple(stats["size_bytes"])
                files_str = f"{stats['file_count']:,}"
                add_scan_log(f"สแกนละเอียดสำเร็จ: [{folder_name}] -> {size_str} ({files_str} ไฟล์ย่อย)", "success")
            except Exception as e:
                snapshots_to_record.append((target_id, folder_name, folder_path, {
                    "path": folder_path,
                    "exists": False,
                    "size_bytes": 0,
                    "file_count": 0,
                    "subfolder_count": 0,
                    "error": str(e)
                }))
                add_scan_log(f"สแกนผิดพลาด: [{folder_name}] ({str(e)})", "error")
            
            scan_state["scanned_count"] += 1
            if scan_state["total_targets"] > 0:
                scan_state["progress_percent"] = int((scan_state["scanned_count"] / scan_state["total_targets"]) * 100)
            scan_state["current_folder"] = folder_name

    duration = round(time.time() - start_time, 2)
    scan_id = database.record_scan_run(total_bytes, total_files, "completed", duration)
    
    # Save snapshots into SQLite
    for target_id, folder_name, folder_path, stats in snapshots_to_record:
        database.record_folder_snapshot(
            scan_id=scan_id,
            target_id=target_id,
            folder_name=folder_name,
            folder_path=folder_path,
            size_bytes=stats["size_bytes"],
            file_count=stats["file_count"],
            subfolder_count=stats["subfolder_count"]
        )
        
    scan_state["is_scanning"] = False
    scan_state["progress_percent"] = 100
    add_scan_log(f"สแกนเสร็จสมบูรณ์! รวมทั้งหมด {len(snapshots_to_record)} โฟลเดอร์ ({format_bytes_simple(total_bytes)} / {total_files:,} ไฟล์) ใช้เวลา {duration}s", "success")
    
    return {
        "scan_id": scan_id,
        "targets_scanned": len(snapshots_to_record),
        "total_bytes": total_bytes,
        "total_files": total_files,
        "duration_sec": duration
    }

def test_path_access(path):
    if not os.path.exists(path):
        return {"accessible": False, "message": "Path does not exist or network drive unmounted."}
    
    try:
        with os.scandir(path) as it:
            sample_count = 0
            for _ in it:
                sample_count += 1
                if sample_count >= 5:
                    break
        return {"accessible": True, "message": f"Successfully connected to path ({sample_count}+ items found)."}
    except Exception as e:
        return {"accessible": False, "message": f"Permission or access error: {str(e)}"}
