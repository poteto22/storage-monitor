import os
import sys
import logging
from apscheduler.schedulers.background import BackgroundScheduler
import database
import scanner

logger = logging.getLogger("scheduler")
scheduler = BackgroundScheduler()
_lock_fp = None

def acquire_scheduler_lock():
    global _lock_fp
    if _lock_fp is not None:
        return True
    lock_file = os.path.join(os.path.dirname(__file__), ".scheduler.lock")
    try:
        fp = open(lock_file, "a+")
        if sys.platform == "win32":
            import msvcrt
            msvcrt.locking(fp.fileno(), msvcrt.LK_NBLCK, 1)
        else:
            import fcntl
            fcntl.flock(fp.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        _lock_fp = fp
        return True
    except Exception:
        return False

def trigger_scheduled_scan():
    logger.info("Starting scheduled background folder scan...")
    try:
        res = scanner.run_full_scan()
        logger.info(f"Scheduled scan finished: {res}")
    except Exception as e:
        logger.error(f"Error during scheduled scan: {e}")

def init_scheduler():
    if not acquire_scheduler_lock():
        logger.info("Scheduler already active in another worker process. Skipping initialization in this worker.")
        return

    configs = database.get_configs()
    auto_enabled = configs.get("auto_scan_enabled", "true") == "true"
    cron_hour = int(configs.get("scan_cron_hour", "0")) # Default 00:00 AM
    
    scheduler.remove_all_jobs()
    if auto_enabled:
        scheduler.add_job(
            trigger_scheduled_scan,
            trigger="cron",
            hour=cron_hour,
            minute=0,
            id="daily_network_scan"
        )
        logger.info(f"Daily scan scheduled at {cron_hour:02d}:00")
    
    if not scheduler.running:
        scheduler.start()

def reschedule():
    init_scheduler()

