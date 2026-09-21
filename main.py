import os
import asyncio
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional, List

import database
import scanner
import scheduler

app = FastAPI(title="Network Drive Folder Size Monitor", version="1.0.0")

# Request Models
class DriveModel(BaseModel):
    name: str
    total_capacity_tb: float
    enabled: Optional[int] = 1

class TargetModel(BaseModel):
    name: str
    path: str
    enabled: Optional[int] = 1
    drive_id: Optional[int] = 1

class ConfigModel(BaseModel):
    total_capacity_tb: Optional[float] = 10.0
    drive_name: Optional[str] = "NAS Storage"
    auto_scan_enabled: Optional[bool] = True
    scan_cron_hour: Optional[int] = 0

class PathTestModel(BaseModel):
    path: str

@app.on_event("startup")
def startup_event():
    database.init_db()
    scheduler.init_scheduler()
    
    # Check if empty targets, populate sample target folders if local demo
    targets = database.get_targets()
    if not targets:
        # Pre-populate sample local folder targets for instant demonstration
        user_home = os.path.expanduser("~")
        database.add_target("Documents Folder", os.path.join(user_home, "Documents"), 1, 1)
        database.add_target("Downloads Folder", os.path.join(user_home, "Downloads"), 1, 1)
        database.add_target("Desktop Folder", os.path.join(user_home, "Desktop"), 1, 1)

# API Endpoints
@app.get("/api/dashboard")
def get_dashboard_data(drive_id: Optional[str] = "all"):
    configs = database.get_configs()
    latest_scan = database.get_latest_scan()
    drives = database.get_drives()
    targets = database.get_targets(drive_id)
    snapshots = database.get_latest_snapshots(drive_id)
    history = database.get_growth_history(30, drive_id)
    
    # Selected drive configuration
    selected_drive = None
    if drive_id and str(drive_id).lower() != "all":
        try:
            d_id = int(drive_id)
            selected_drive = database.get_drive(d_id)
        except ValueError:
            selected_drive = None
            
    if selected_drive:
        total_capacity_tb = float(selected_drive["total_capacity_tb"])
        drive_name = selected_drive["name"]
    else:
        # Combined sum of capacity for all enabled drives
        total_capacity_tb = sum(float(d["total_capacity_tb"]) for d in drives if d.get("enabled", 1) == 1) if drives else float(configs.get("total_capacity_tb", 10))
        drive_name = "ทุก Drive หลัก (All Drives)" if len(drives) > 1 else (drives[0]["name"] if drives else "NAS Storage")
        
    total_capacity_bytes = total_capacity_tb * (1024 ** 4) # TB to Bytes
    
    # Calculate used_bytes & total_files from current filtered snapshots
    used_bytes = sum(s["size_bytes"] for s in snapshots) if snapshots else 0
    total_files = sum(s["file_count"] for s in snapshots) if snapshots else 0
    
    free_bytes = max(0, total_capacity_bytes - used_bytes)
    used_percentage = round((used_bytes / total_capacity_bytes) * 100, 2) if total_capacity_bytes > 0 else 0
    
    # Calculate 24h or previous scan size change
    size_change_bytes = 0
    if len(history) >= 2:
        size_change_bytes = history[-1]["total_bytes"] - history[-2]["total_bytes"]
        
    return {
        "selected_drive_id": drive_id,
        "drives": drives,
        "configs": {
            "drive_name": drive_name,
            "total_capacity_tb": total_capacity_tb,
            "total_capacity_bytes": total_capacity_bytes,
            "auto_scan_enabled": configs.get("auto_scan_enabled", "true") == "true",
            "scan_cron_hour": int(configs.get("scan_cron_hour", 0))
        },
        "summary": {
            "used_bytes": used_bytes,
            "free_bytes": free_bytes,
            "total_capacity_bytes": total_capacity_bytes,
            "used_percentage": used_percentage,
            "total_files": total_files,
            "target_count": len(targets),
            "size_change_24h_bytes": size_change_bytes,
            "last_scan_time": latest_scan["scan_time"] if latest_scan else None,
            "last_scan_duration_sec": latest_scan["duration_sec"] if latest_scan else 0
        },
        "snapshots": snapshots,
        "history": history,
        "targets": targets
    }

# Main Drives Endpoints
@app.get("/api/drives")
def list_drives():
    return database.get_drives()

@app.post("/api/drives")
def create_drive(drive: DriveModel):
    did = database.add_drive(drive.name, drive.total_capacity_tb, drive.enabled)
    return {"id": did, "name": drive.name, "total_capacity_tb": drive.total_capacity_tb, "enabled": drive.enabled}

@app.put("/api/drives/{drive_id}")
def update_drive(drive_id: int, drive: DriveModel):
    database.update_drive(drive_id, drive.name, drive.total_capacity_tb, drive.enabled)
    return {"status": "success"}

@app.delete("/api/drives/{drive_id}")
def delete_drive(drive_id: int):
    database.delete_drive(drive_id)
    return {"status": "success"}

@app.get("/api/targets")
def list_targets(drive_id: Optional[str] = None):
    return database.get_targets(drive_id)

@app.post("/api/targets")
def create_target(target: TargetModel):
    tid = database.add_target(target.name, target.path, target.enabled, target.drive_id or 1)
    return {"id": tid, "name": target.name, "path": target.path, "enabled": target.enabled, "drive_id": target.drive_id}

@app.put("/api/targets/{target_id}")
def update_target(target_id: int, target: TargetModel):
    database.update_target(target_id, target.name, target.path, target.enabled, target.drive_id or 1)
    return {"status": "success"}

@app.delete("/api/targets/{target_id}")
def delete_target(target_id: int):
    database.delete_target(target_id)
    return {"status": "success"}

@app.post("/api/targets/test")
def test_target(req: PathTestModel):
    return scanner.test_path_access(req.path)

@app.post("/api/scan/trigger")
def trigger_scan(background_tasks: BackgroundTasks, drive_id: Optional[str] = "all"):
    if scanner.get_scan_status()["is_scanning"]:
        return {"status": "already_scanning", "message": "Scan is already in progress."}
    background_tasks.add_task(scanner.run_full_scan, drive_id)
    return {"status": "scan_started", "message": f"Background scan initiated successfully for drive: {drive_id}."}

@app.get("/api/scan/status")
def get_scan_status():
    return scanner.get_scan_status()

@app.get("/api/folders/history")
def get_folder_history(folder_path: Optional[str] = None, folder_name: Optional[str] = None, days: Optional[int] = 30):
    if not folder_path and not folder_name:
        raise HTTPException(status_code=400, detail="folder_path or folder_name is required")
    history = database.get_folder_history(folder_path, folder_name, days or 30)
    return {
        "folder_path": folder_path,
        "folder_name": folder_name,
        "days": days or 30,
        "count": len(history),
        "history": history
    }

@app.get("/api/configs")
def get_configs():
    return database.get_configs()

@app.post("/api/configs")
def update_configs(cfg: ConfigModel):
    if cfg.total_capacity_tb is not None:
        database.set_config("total_capacity_tb", cfg.total_capacity_tb)
    if cfg.drive_name is not None:
        database.set_config("drive_name", cfg.drive_name)
    if cfg.auto_scan_enabled is not None:
        database.set_config("auto_scan_enabled", "true" if cfg.auto_scan_enabled else "false")
    if cfg.scan_cron_hour is not None:
        database.set_config("scan_cron_hour", cfg.scan_cron_hour)
        
    scheduler.reschedule()
    return {"status": "success"}

# Serve Frontend static directory
static_dir = os.path.join(os.path.dirname(__file__), "static")
if not os.path.exists(static_dir):
    os.makedirs(static_dir)

app.mount("/static", StaticFiles(directory=static_dir), name="static")

@app.get("/")
def read_index():
    return FileResponse(os.path.join(static_dir, "index.html"))
