import logging
from apscheduler.schedulers.background import BackgroundScheduler
import database
import scanner

logger = logging.getLogger("scheduler")
scheduler = BackgroundScheduler()

def trigger_scheduled_scan():
    logger.info("Starting scheduled background folder scan...")
    try:
        res = scanner.run_full_scan()
        logger.info(f"Scheduled scan finished: {res}")
    except Exception as e:
        logger.error(f"Error during scheduled scan: {e}")

def init_scheduler():
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
