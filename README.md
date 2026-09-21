# 🖥️ Network Drive Folder Size Monitor

ระบบเว็บแอปพลิเคชันสำหรับ **ติดตาม, สแกนขนาดพื้นที่ (Folder Size), และนับจำนวนไฟล์ย่อยย้อนหลังบน Network Drive** (เช่น SMB/CIFS, NFS, NAS) พร้อมหน้าแดชบอร์ดสไตล์ **Modern Light Mode** ที่แสดงผล Treemap, กราฟแนวโน้มความจุ, ตารางเรียงลำดับข้อมูล, และระบบสตรีมมิ่ง Live Scan Console Log แบบ Real-time

---

## 🌟 ฟีเจอร์หลัก (Key Features)

1. **Dashboard สไตล์ Modern Light Mode:**
   - **Metric Cards:** สรุปความจุรวม (Used vs Total Capacity TB), สรุปโฟลเดอร์ที่ใหญ่ที่สุด, และจำนวนไฟล์ย่อยรวมทั้งหมด
   - **Treemap Chart (Apache ECharts):** แสดงสัดส่วนขนาดพื้นที่ของแต่ละโฟลเดอร์หลักบน Network Drive
   - **Storage Trend Line Chart:** บันทึกและแสดงกราฟแนวโน้มการใช้งานพื้นที่ย้อนหลัง
   - **Interactive Folder Table:** ตารางรายละเอียดโฟลเดอร์พร้อมเปอร์เซ็นต์ % และรองรับการกดหัวคอลัมน์เพื่อเรียงลำดับ (Sorting) ตามชื่อ, ขนาด, หรือจำนวนไฟล์

2. **High-Performance Native OS Scanner:**
   - สแกนขนาดพื้นที่แบบ Ultra-fast ผ่านคำสั่ง OS Disk Usage (`du -sk`) ร่วมกับ Multi-threaded Parallel Execution
   - นับจำนวนไฟล์ย่อยลึกลงไปทุกชั้น (Deep Recursive File Counting)

3. **Live Scan Progress & Terminal Console Panel:**
   - สตรีมมิ่ง Log การสแกนแต่ละโฟลเดอร์ขึ้นหน้าเว็บแบบ Real-time พร้อม Progress Bar แจ้งสถานะแบบเปอร์เซ็นต์

4. **Web Configuration Management:**
   - เพิ่ม/แก้ไข/ลบ Network Target Path ได้ผ่านหน้าเว็บ
   - มีระบบ **"ทดสอบอ่าน Path" (Test Connection)** ตรวจสอบสิทธิ์ก่อนบันทึกจริง
   - ปรับตั้งค่าความจุ Drive รวม (Total Capacity TB) และเวลา Auto-Scan รายวันอัตโนมัติ

---

## 📁 โครงสร้างโปรเจกต์ (Project Structure)

```text
CG-Share Detail/
├── main.py              # FastAPI Web Server & REST API Endpoints
├── scanner.py           # ตัวสแกนความเร็วสูง (Native OS Scanner & Live Console Log)
├── database.py          # ตัวจัดการ SQLite Database (monitor.db)
├── scheduler.py         # ตัวตั้งเวลารันสแกนรายวันอัตโนมัติ (APScheduler)
├── requirements.txt     # รายการ Python Dependencies
├── monitor.db           # ไฟล์ฐานข้อมูล SQLite (สร้างอัตโนมัติ)
├── static/              # ไฟล์ Frontend Web Dashboard
│   ├── index.html       # หน้า HTML Dashboard & Modals
│   ├── styles.css       # Stylesheet ธีม Light Mode
│   └── app.js           # JavaScript ควบคุมการทำงาน ECharts & REST APIs
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
# ตัวอย่างการใช้ rsync หรือ scp ย้ายไฟล์ไปยังเครื่อง Server
rsync -avz --exclude 'venv' --exclude 'monitor.db' ./ user@production-server:/opt/drive-monitor/
```

### ขั้นตอนที่ 2: Mount Network Drive บนเครื่อง Production

ต้องแน่ใจว่าเครื่อง Production ได้ทำการ Mount Network Share (SMB/NFS) เรียบร้อยแล้ว และ User ที่รันโปรเจกต์มีสิทธิ์อ่านไฟล์ (Read Permission):

- **สำหรับ Linux (SMB/CIFS Mount):**

  ```bash
  sudo mkdir -p /mnt/network_share
  sudo mount -t cifs -o username=domain_user,password=your_password //192.168.1.100/ShareName /mnt/network_share
  ```

  _(แนะนำให้เพิ่มใน `/etc/fstab` เพื่อให้ Auto-mount ทุกครั้งที่รีสตาร์ทเครื่อง)_

- **สำหรับ macOS Server:**
  Network Drive มักจะอยู่ที่ `/Volumes/ShareName/`

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

หากต้องการรันด้วย Docker ให้สร้างไฟล์ `Dockerfile` และ `docker-compose.yml` ในโฟลเดอร์โปรเจกต์:

**`docker-compose.yml`**:

```yaml
version: "3.8"

services:
  drive-monitor:
    build: .
    container_name: drive-monitor
    ports:
      - "8000:8000"
    volumes:
      - ./monitor.db:/app/monitor.db
      - /Volumes/CG-Share19:/mnt/share19:ro # Mount Network Drive แบบ Read-Only
    restart: always
```

สั่งรันด้วยคำสั่ง:

```bash
docker-compose up -d
```

---

#### 🔹 ทางเลือกที่ 4: Deploy บน Windows Server (แนะนำรันเป็น Background Windows Service ด้วย NSSM)

การติดตั้งบน Windows Server เพื่อให้ระบบทำงานใน Background อัตโนมัติเมื่อเปิดเครื่อง มีขั้นตอนปฏิบัติดังนี้:

##### 1. เตรียม Python และ Virtual Environment บน Windows Server:
1. ดาวน์โหลดและติดตั้ง **Python 3.10+** บน Windows Server (ติ๊กถูก **"Add python.exe to PATH"**)
2. คัดลอกโฟลเดอร์โปรเจกต์ไปวางไว้ที่ เช่น `C:\drive-monitor`
3. เปิด PowerShell (หรือ Command Prompt) ในฐานะ Administrator แล้วเข้าไปที่โฟลเดอร์โปรเจกต์:
   ```cmd
   cd C:\drive-monitor
   python -m venv venv
   .\venv\Scripts\pip install -r requirements.txt
   ```

##### 2. ติดตั้งและตั้งค่า Windows Service ด้วย NSSM (Non-Sucking Service Manager):
1. ดาวน์โหลด `nssm.exe` จาก [nssm.cc](https://nssm.cc/download) วางไว้ใน `C:\Windows\System32` (หรือโฟลเดอร์โปรเจกต์)
2. สั่งสร้าง Service ใหม่ด้วยคำสั่ง:
   ```cmd
   nssm install DriveMonitorService "C:\drive-monitor\venv\Scripts\uvicorn.exe" "main:app --host 0.0.0.0 --port 8000 --workers 2"
   ```
3. กำหนด Working Directory ของ Service:
   ```cmd
   nssm set DriveMonitorService AppDirectory "C:\drive-monitor"
   ```
4. **สำคัญ (สิทธิ์ Network Drive):** หากต้องอ่าน Network Drive (UNC Path เช่น `\\192.168.1.100\ShareName`) ให้ตั้งค่าให้ Service รันภายใต้ User Account / Domain Account ที่มีสิทธิ์อ่านไฟล์:
   ```cmd
   nssm set DriveMonitorService ObjectName "DOMAIN\ServiceUser" "Password123"
   ```
5. สั่งเริ่มต้น Service:
   ```cmd
   nssm start DriveMonitorService
   ```

##### 3. เปิด Firewall Port 8000 (Windows Defender Firewall):
เปิด PowerShell Admin แล้วรันคำสั่งอนุญาตให้อุปกรณ์ในเครือข่ายเข้าถึงหน้าเว็บได้:
```powershell
New-NetFirewallRule -DisplayName "Drive Monitor Web UI (Port 8000)" -Direction Inbound -LocalPort 8000 -Protocol TCP -Action Allow
```

##### 4. ทางเลือกเพิ่มเติม: Deploy บน Windows ด้วย PM2 Process Manager
หากเครื่อง Windows Server มี Node.js ติดตั้งอยู่แล้ว สามารถใช้ PM2 รันระบบได้เช่นกัน:

1. ติดตั้ง PM2 และ `pm2-windows-service` (เพื่อสั่งให้ PM2 รันอัตโนมัติเมื่อ Boot เครื่อง):
   ```cmd
   npm install -g pm2
   npm install -g pm2-windows-service
   pm2-service-install -n "PM2_DriveMonitor"
   ```
2. สั่งรัน Uvicorn ด้วย PM2:
   ```cmd
   cd C:\drive-monitor
   pm2 start "C:\drive-monitor\venv\Scripts\uvicorn.exe" --name "drive-monitor" -- main:app --host 0.0.0.0 --port 8000 --workers 2
   ```
3. บันทึก Process State:
   ```cmd
   pm2 save
   ```

> [!TIP]
> **การอัปเดตโค้ดระบบ (Updating Code):**
> หากมีการแก้ไขโค้ด Python (`main.py`, `database.py`, `scanner.py`) อย่าลืมรันคำสั่ง Restart Process ทุกครั้งเพื่อให้ Python โหลดโค้ดใหม่เข้าสู่ Memory:
> - **สำหรับ PM2:** `pm2 restart drive-monitor` (หรือ `pm2 restart all`)
> - **สำหรับ NSSM (Windows):** `nssm restart DriveMonitorService`
> - **สำหรับ systemd (Linux):** `sudo systemctl restart drive-monitor`

---

## ⚙️ 3. การตั้งค่าหลังย้ายไป Production

1. เข้าหน้าเว็บผ่าน IP ของเครื่อง Production: **`http://<PRODUCTION_SERVER_IP>:8000`**
2. กดปุ่ม **"ตั้งค่า Network Drive"**:
   - ปรับตั้งค่า **ชื่อ Drive** และ **ความจุรวม (Total Capacity TB)** บนเครื่อง Production
   - ระบุ Path ของ Network Drive (เช่น `/mnt/network_share` หรือ `/Volumes/ShareName`)
   - กดปุ่ม **"ทดสอบอ่าน Path"** เพื่อยืนยันว่าระบบเข้าถึงโฟลเดอร์ได้
3. กดปุ่ม **"สแกนทันที"** เพื่อทำการสร้าง Baseline Index ข้อมูลครั้งแรก
