# 🖥️ Network Drive Folder Size Monitor

ระบบเว็บแอปพลิเคชันสำหรับ **ติดตาม, สแกนขนาดพื้นที่ (Folder Size), และนับจำนวนไฟล์ย่อยย้อนหลังบน Network Drive หลายลูกพร้อมกัน** (เช่น SMB/CIFS, NFS, NAS) พร้อมหน้าแดชบอร์ดสไตล์ **Modern Light Mode** ที่แสดงผล Treemap, กราฟแนวโน้มความจุ, ตารางเรียงลำดับข้อมูล, การจำแนกความจุแยกตาม Drive, และระบบสตรีมมิ่ง Live Scan Console Log แบบ Real-time

---

## 🌟 ฟีเจอร์หลัก (Key Features)

1. **รองรับหลาย Drive หลัก (Multi Main Drives Support):**
   * บันทึกและจัดการ Drive หลักได้หลายลูก พร้อมตั้งชื่อ Mount Path และระบุความจุรวม (Total Capacity GB/TB) ของแต่ละ Drive แยกกัน
   * สามารถแก้ไขชื่อและปรับเปลี่ยนความจุรวมของแต่ละ Drive หลักได้ตลอดเวลา

2. **Dashboard สไตล์ Modern Light Mode & Drive Filtering:**
   * **Drive Selector:** เลือกสลับมุมมองดูข้อมูลเฉพาะ Drive หลักที่สนใจ หรือเลือกดู **"ทั้งหมด (All Drives)"**
   * **Multi-Drive Capacity Card:** แสดงรายละเอียดสรุปความจุรวม (Used vs Total Capacity) และ Breakdown แสดงเปอร์เซ็นต์การใช้งานแยกราย Drive เมื่อเลือกมุมมอง All Drives
   * **Treemap Chart (Apache ECharts):** แสดงสัดส่วนขนาดพื้นที่ของโฟลเดอร์ย่อยใน Drive หลักที่เลือก
   * **Storage Trend Line Chart:** บันทึกและแสดงกราฟแนวโน้มการใช้งานพื้นที่ย้อนหลัง
   * **Interactive Folder Table:** ตารางรายละเอียดโฟลเดอร์พร้อมเปอร์เซ็นต์ % และการระบุสังกัด Drive หลัก รองรับการกดหัวคอลัมน์เพื่อเรียงลำดับ (Sorting) ตามชื่อ, ขนาด, หรือจำนวนไฟล์

3. **High-Performance Native OS Scanner & Drive-Scoped Scanning:**
   * สแกนขนาดพื้นที่แบบ Ultra-fast ผ่านคำสั่ง OS Disk Usage (`du -sk`) ร่วมกับ Multi-threaded Parallel Execution
   * นับจำนวนไฟล์ย่อยลึกลงไปทุกชั้น (Deep Recursive File Counting)
   * รองรับการสั่ง **"สแกนทันที" เฉพาะ Drive หลักที่เลือก** หรือสแกนทุก Drive โดยรักษาประวัติ Snapshot ของ Drive อื่นๆ ไว้ครบถ้วน

4. **Live Scan Progress & Terminal Console Panel:**
   * สตรีมมิ่ง Log การสแกนแต่ละโฟลเดอร์ขึ้นหน้าเว็บแบบ Real-time (Server-Sent Events) พร้อม Progress Bar แจ้งสถานะเปอร์เซ็นต์

5. **Web Configuration Management:**
   * เพิ่ม/แก้ไข/ลบ Drive หลัก และกำหนดโฟลเดอร์ย่อย (Target Folders) ที่ต้องการติดตาม
   * ระบบ **"ทดสอบอ่าน Path" (Test Connection)** ตรวจสอบสิทธิ์และสถิติโฟลเดอร์ก่อนบันทึกจริง
   * ตั้งเวลา Auto-Scan รายวันอัตโนมัติ

---

## 📁 โครงสร้างโปรเจกต์ (Project Structure)

```text
CG-Share Detail/
├── main.py              # FastAPI Web Server & REST API Endpoints
├── scanner.py           # ตัวสแกนความเร็วสูง (Native OS Scanner, Parallel Execution & SSE Log)
├── database.py          # ตัวจัดการ SQLite Database (monitor.db) & SQLite Schema Migrations
├── scheduler.py         # ตัวตั้งเวลารันสแกนรายวันอัตโนมัติ (APScheduler)
├── requirements.txt     # รายการ Python Dependencies
├── monitor.db           # ไฟล์ฐานข้อมูล SQLite (สร้างและอัปเดตอัตโนมัติ)
├── static/              # ไฟล์ Frontend Web Dashboard
│   ├── index.html       # หน้า HTML Dashboard & Modals
│   ├── styles.css       # Stylesheet ธีม Light Mode สไตล์ Modern
│   └── app.js           # JavaScript ควบคุมการทำงาน ECharts, Filter & REST APIs
└── README.md            # คู่มือการใช้งานและการติดตั้ง
```

---

## 🚀 1. วิธีเปิดรันบนเครื่อง Local / Development

### ขั้นตอนที่ 1: เตรียม Python Environment
เปิด Terminal เข้าไปยังโฟลเดอร์โปรเจกต์แล้วสร้าง Python Virtual Environment:

```bash
cd "/Users/bobby/CG-Share Detail"

# สร้าง Virtual Environment
python3 -m venv venv

# ติดตั้ง Dependencies
./venv/bin/pip install -r requirements.txt
```

### ขั้นตอนที่ 2: เริ่มต้นรัน Development Server
รันบริการ Web Server ด้วย Uvicorn:

```bash
./venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
```

เปิด Web Browser เข้าไปที่: **`http://localhost:8000`**

---

## 🏗️ 2. วิธีย้ายและติดตั้งบนเครื่อง Production (Production Deployment Guide)

เมื่อต้องการนำระบบไปติดตั้งและรันบนเครื่อง Production (เช่น Linux Server หรือ macOS Server) มีขั้นตอนปฏิบัติดังนี้:

### ขั้นตอนที่ 1: คัดลอกซอร์สโค้ดไปยังเครื่อง Production
คัดลอกไฟล์ทั้งหมด (ยกเว้นโฟลเดอร์ `venv/` และ `monitor.db` เก่าหากต้องการเริ่มใหม่) ไปยังเครื่อง Production:

```bash
# ตัวอย่างการใช้ rsync ย้ายไฟล์ไปยังเครื่อง Server
rsync -avz --exclude 'venv' --exclude 'monitor.db' ./ user@production-server:/opt/drive-monitor/
```

### ขั้นตอนที่ 2: Mount Network Drive บนเครื่อง Production
ต้องแน่ใจว่าเครื่อง Production ได้ทำการ Mount Network Share (SMB/NFS) เรียบร้อยแล้ว และ User ที่รันโปรเจกต์มีสิทธิ์อ่านไฟล์ (Read Permission):

* **สำหรับ Linux (SMB/CIFS Mount):**
  ```bash
  sudo mkdir -p /mnt/share19
  sudo mount -t cifs -o username=domain_user,password=your_password //192.168.1.100/CG-Share19 /mnt/share19
  ```
  *(แนะนำให้เพิ่มใน `/etc/fstab` เพื่อให้ Auto-mount ทุกครั้งที่รีสตาร์ทเครื่อง)*

* **สำหรับ macOS Server:**
  Network Drive มักจะอยู่ที่ `/Volumes/CG-Share19/`, `/Volumes/CG-Share20/` เป็นต้น

---

### ขั้นตอนที่ 3: เลือกวิธีการเปิดรันบน Production (Deployment Options)

#### 🔹 ทางเลือกที่ 1: Deploy เป็น System Daemon ด้วย `systemd` (แนะนำสำหรับ Linux)

1. สร้างไฟล์ Service:
   ```bash
   sudo nano /etc/systemd/system/drive-monitor.service
   ```

2. ใส่ข้อความคอนฟิกดังนี้ (ปรับเปลี่ยน Path และ User ตามจริง):
   ```ini
   [Unit]
   Description=Network Drive Folder Size Monitor Service
   After=network.target

   [Service]
   User=root
   WorkingDirectory=/opt/drive-monitor
   ExecStart=/opt/drive-monitor/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 --workers 2
   Restart=always
   RestartSec=5

   [Install]
   WantedBy=multi-user.target
   ```

3. สั่งเปิดใช้งาน Service:
   ```bash
   # Reload systemd
   sudo systemctl daemon-reload

   # สั่งรันและตั้งให้ทำงานอัตโนมัติเมื่อเปิดเครื่อง
   sudo systemctl enable drive-monitor
   sudo systemctl start drive-monitor

   # ตรวจสอบสถานะการทำงาน
   sudo systemctl status drive-monitor
   ```

---

#### 🔹 ทางเลือกที่ 2: Deploy ด้วย `PM2` Process Manager (แนะนำสำหรับ macOS / Linux)

หากเครื่อง Server มี Node.js/PM2 ติดตั้งอยู่ สามารถใช้ PM2 บริหารจัดการ Process ให้รันใน Background ได้ง่ายดาย:

```bash
cd /opt/drive-monitor

# สร้าง venv และลง dependencies
python3 -m venv venv
./venv/bin/pip install -r requirements.txt

# สั่งให้ PM2 รันและคอยเปิดให้อัตโนมัติหาก Crash
pm2 start "./venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000" --name "drive-monitor"

# บันทึกสถานะ PM2
pm2 save
pm2 startup
```

---

#### 🔹 ทางเลือกที่ 3: Deploy ด้วย Docker Compose

หากต้องการรันด้วย Docker ให้สร้างไฟล์ `docker-compose.yml` ในโฟลเดอร์โปรเจกต์:

```yaml
version: '3.8'

services:
  drive-monitor:
    build: .
    container_name: drive-monitor
    ports:
      - "8000:8000"
    volumes:
      - ./monitor.db:/app/monitor.db
      - /Volumes/CG-Share19:/mnt/share19:ro  # Mount Network Drive แบบ Read-Only
      - /Volumes/CG-Share20:/mnt/share20:ro
    restart: always
```

สั่งรันด้วยคำสั่ง:
```bash
docker-compose up -d
```

---

## 🔌 4. รายการ REST API (REST API Endpoints)

| Method | Endpoint | คำอธิบาย |
| :--- | :--- | :--- |
| `GET` | `/api/dashboard?drive_id=all\|ID` | ดึงข้อมูลสรุปแดชบอร์ด (Metric Cards, Treemap, Trend, Folder Table) ตาม Filter Drive |
| `GET` | `/api/drives` | ดึงรายการ Drive หลักทั้งหมด |
| `POST` | `/api/drives` | เพิ่ม Drive หลักใหม่ (`name`, `mount_path`, `total_capacity_tb`) |
| `PUT` | `/api/drives/{id}` | แก้ไขชื่อ หรือความจุรวมของ Drive หลัก |
| `DELETE` | `/api/drives/{id}` | ลบ Drive หลักและข้อมูล Target ภายใน Drive |
| `GET` | `/api/targets` | ดึงรายการโฟลเดอร์ย่อยที่ติดตามทั้งหมด |
| `POST` | `/api/targets` | เพิ่มโฟลเดอร์ย่อยที่ติดตาม (`folder_path`, `drive_id`) |
| `DELETE` | `/api/targets/{id}` | ลบโฟลเดอร์ย่อยออกจากรายการติดตาม |
| `POST` | `/api/test-path` | ทดสอบการเข้าถึงโฟลเดอร์ Network Path |
| `POST` | `/api/scan/trigger?drive_id=all\|ID` | สั่งเริ่มสแกนโฟลเดอร์ทันที (เฉพาะ Drive ที่เลือก หรือทั้งหมด) |
| `GET` | `/api/scan-stream` | SSE Endpoint สำหรับรับ Live Scan Console Logs แบบ Real-time |
| `GET` | `/api/settings` | ดึงข้อมูลการตั้งค่าระบบ (เช่น เวลา Auto-Scan) |
| `POST` | `/api/settings` | บันทึกการตั้งค่าระบบ |

---

## ⚙️ 5. การตั้งค่าหลังย้ายไป Production

1. เข้าหน้าเว็บผ่าน IP ของเครื่อง Production: **`http://<PRODUCTION_SERVER_IP>:8000`**
2. กดปุ่ม **"ตั้งค่า Network Drive"**:
   * ปรับตั้งค่า **ชื่อ Drive** และ **ความจุรวม (Total Capacity TB)** ของแต่ละ Drive หลัก
   * ระบุ Path ของ Network Drive (เช่น `/mnt/share19` หรือ `/Volumes/CG-Share19`)
   * กดปุ่ม **"ทดสอบอ่าน Path"** เพื่อยืนยันว่าระบบเข้าถึงโฟลเดอร์ได้
3. เพิ่มโฟลเดอร์หลักที่ต้องการติดตามสำหรับแต่ละ Drive
4. กดปุ่ม **"สแกนทันที"** เพื่อทำการสร้าง Baseline Index ข้อมูลครั้งแรก
