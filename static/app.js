// Global State
let dashboardData = null;
let treemapChartInstance = null;
let trendChartInstance = null;
let currentSortField = 'size'; // 'id', 'name', 'size', 'percent', 'files'
let currentSortOrder = 'desc';

// Utility functions
function formatBytes(bytes, decimals = 2) {
    if (bytes === undefined || bytes === null || isNaN(bytes) || bytes === 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    let icon = '<i class="fa-solid fa-circle-info"></i>';
    if (type === 'success') icon = '<i class="fa-solid fa-circle-check text-emerald"></i>';
    if (type === 'error') icon = '<i class="fa-solid fa-circle-exclamation text-rose"></i>';
    
    toast.innerHTML = `${icon} <span>${message}</span>`;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// DOM Elements & Initialization
document.addEventListener('DOMContentLoaded', () => {
    initCharts();
    loadDashboard();
    setupEventListeners();
});

function initCharts() {
    const treemapEl = document.getElementById('treemapChart');
    const trendEl = document.getElementById('trendChart');
    
    if (treemapEl) treemapChartInstance = echarts.init(treemapEl);
    if (trendEl) trendChartInstance = echarts.init(trendEl);
    
    window.addEventListener('resize', () => {
        if (treemapChartInstance) treemapChartInstance.resize();
        if (trendChartInstance) trendChartInstance.resize();
    });
}

// Fetch and Render Dashboard
async function loadDashboard() {
    try {
        const response = await fetch('/api/dashboard');
        dashboardData = await response.json();
        
        renderHeaderAndMetrics(dashboardData);
        renderTreemapChart(dashboardData.snapshots);
        renderTrendChart(dashboardData.history);
        renderFolderTable(dashboardData.snapshots);
        renderTargetList(dashboardData.targets);
        populateConfigModalForm(dashboardData.configs);
    } catch (error) {
        console.error("Error loading dashboard:", error);
        showToast("ไม่สามารถโหลดข้อมูล Dashboard ได้", "error");
    }
}

function renderHeaderAndMetrics(data) {
    const { configs, summary } = data;
    
    // Header
    document.getElementById('driveNameHeader').innerText = configs.drive_name || "NAS Network Drive Monitor";
    document.getElementById('scanScheduleLabel').innerText = `Daily Scan: ${String(configs.scan_cron_hour).padStart(2, '0')}:00 AM`;
    
    if (summary.last_scan_time) {
        document.getElementById('lastScanText').innerHTML = `<i class="fa-regular fa-clock"></i> สแกนล่าสุด: ${summary.last_scan_time} (${summary.last_scan_duration_sec}s)`;
    }
    
    // Storage Gauge Card
    const usedText = formatBytes(summary.used_bytes);
    const totalText = `จาก ${configs.total_capacity_tb} TB`;
    document.getElementById('usedSizeText').innerText = usedText;
    document.getElementById('totalCapacityText').innerText = totalText;
    
    const pct = summary.used_percentage || 0;
    document.getElementById('usageBadge').innerText = `${pct}%`;
    document.getElementById('storageProgressBar').style.width = `${Math.min(pct, 100)}%`;
    document.getElementById('freeSpaceText').innerText = `คงเหลือ: ${formatBytes(summary.free_bytes)}`;
    
    // Counters
    document.getElementById('targetCountText').innerText = summary.target_count || 0;
    document.getElementById('totalFilesText').innerText = (summary.total_files || 0).toLocaleString();
    
    // 24h Growth
    const growthBytes = summary.size_change_24h_bytes || 0;
    const growthEl = document.getElementById('growth24hText');
    if (growthBytes >= 0) {
        growthEl.innerText = `+${formatBytes(growthBytes)}`;
        growthEl.className = 'text-emerald';
    } else {
        growthEl.innerText = formatBytes(growthBytes);
        growthEl.className = 'text-rose';
    }
}

function renderTreemapChart(snapshots) {
    if (!treemapChartInstance) return;
    
    if (!snapshots || snapshots.length === 0) {
        treemapChartInstance.setOption({
            title: { text: 'ยังไม่มีข้อมูลสแกนโฟลเดอร์', left: 'center', top: 'center', textStyle: { color: '#94a3b8', fontSize: 14 } }
        });
        return;
    }
    
    const data = snapshots.map(item => ({
        name: item.folder_name,
        value: item.size_bytes,
        path: item.folder_path,
        files: item.file_count
    }));
    
    const option = {
        tooltip: {
            formatter: function (info) {
                const value = formatBytes(info.value);
                const files = (info.data.files || 0).toLocaleString();
                return `
                    <div style="font-weight:700; font-family: sans-serif; font-size:13px;">${info.name}</div>
                    <div style="font-size:12px; color:#64748b;">${info.data.path}</div>
                    <div style="margin-top:6px; font-size:12px;">ขนาด: <b>${value}</b></div>
                    <div style="font-size:12px;">จำนวนไฟล์ย่อยรวม: <b>${files} ไฟล์</b></div>
                `;
            }
        },
        series: [{
            type: 'treemap',
            data: data,
            leafDepth: 1,
            roam: false,
            label: {
                show: true,
                formatter: '{b}\n{c}',
                fontSize: 12,
                fontWeight: 'bold',
                color: '#ffffff'
            },
            upperLabel: { show: false },
            itemStyle: {
                borderColor: '#ffffff',
                borderWidth: 2,
                gapWidth: 2,
                borderRadius: 6
            },
            levels: [{
                itemStyle: {
                    colorMappingBy: 'value',
                    borderWidth: 0,
                    gapWidth: 2
                }
            }],
            color: ['#2563eb', '#3b82f6', '#60a5fa', '#6366f1', '#818cf8', '#0ea5e9', '#06b6d4']
        }]
    };
    
    data.forEach(d => {
        d.label = { formatter: `${d.name}\n${formatBytes(d.value)}` };
    });
    
    treemapChartInstance.setOption(option, true);
}

function renderTrendChart(history) {
    if (!trendChartInstance) return;
    
    if (!history || history.length === 0) {
        trendChartInstance.setOption({
            title: { text: 'สั่งสแกนเพื่อเริ่มบันทึกประวัติ', left: 'center', top: 'center', textStyle: { color: '#94a3b8', fontSize: 14 } }
        });
        return;
    }
    
    const dates = history.map(h => h.scan_time.split(' ')[0]);
    const valuesGB = history.map(h => (h.total_bytes / (1024 ** 3)).toFixed(2));
    
    const option = {
        tooltip: {
            trigger: 'axis',
            formatter: '{b}<br/>ความจุที่ใช้: <b>{c} GB</b>'
        },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        xAxis: {
            type: 'category',
            boundaryGap: false,
            data: dates,
            axisLine: { lineStyle: { color: '#cbd5e1' } }
        },
        yAxis: {
            type: 'value',
            name: 'GB',
            axisLine: { lineStyle: { color: '#cbd5e1' } },
            splitLine: { lineStyle: { color: '#f1f5f9' } }
        },
        series: [{
            name: 'Total Storage (GB)',
            type: 'line',
            smooth: true,
            symbolSize: 6,
            data: valuesGB,
            itemStyle: { color: '#2563eb' },
            areaStyle: {
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    { offset: 0, color: 'rgba(37, 99, 235, 0.25)' },
                    { offset: 1, color: 'rgba(37, 99, 235, 0.01)' }
                ])
            }
        }]
    };
    
    trendChartInstance.setOption(option, true);
}

function getSortedSnapshots(snapshots) {
    if (!snapshots || snapshots.length === 0) return [];
    
    const list = [...snapshots];
    list.sort((a, b) => {
        let valA, valB;
        if (currentSortField === 'name') {
            valA = a.folder_name || '';
            valB = b.folder_name || '';
            return currentSortOrder === 'asc' 
                ? valA.localeCompare(valB, 'th') 
                : valB.localeCompare(valA, 'th');
        } else if (currentSortField === 'files') {
            valA = a.file_count || 0;
            valB = b.file_count || 0;
        } else if (currentSortField === 'id') {
            valA = a.id || 0;
            valB = b.id || 0;
        } else {
            valA = a.size_bytes || 0;
            valB = b.size_bytes || 0;
        }
        
        return currentSortOrder === 'asc' ? valA - valB : valB - valA;
    });
    
    return list;
}

function renderFolderTable(snapshots) {
    const tbody = document.getElementById('folderTableBody');
    if (!tbody) return;
    
    document.getElementById('tableCountBadge').innerText = `${snapshots ? snapshots.length : 0} โฟลเดอร์`;
    
    if (!snapshots || snapshots.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="empty-state">
                    ยังไม่มีข้อมูลสแกนโฟลเดอร์ในระบบ กดปุ่ม <b>"สแกนทันที"</b> เพื่อเริ่มต้น
                </td>
            </tr>
        `;
        return;
    }
    
    const sorted = getSortedSnapshots(snapshots);
    const totalCapacity = dashboardData.configs.total_capacity_bytes || 1;
    
    tbody.innerHTML = sorted.map((item, index) => {
        const pct = ((item.size_bytes / totalCapacity) * 100).toFixed(2);
        return `
            <tr>
                <td><b>${index + 1}</b></td>
                <td>
                    <div class="folder-name-cell">
                        <i class="fa-solid fa-folder folder-icon"></i>
                        <span>${item.folder_name}</span>
                    </div>
                </td>
                <td><b>${formatBytes(item.size_bytes)}</b></td>
                <td>
                    <span class="badge-percentage">${pct}%</span>
                </td>
                <td><b>${(item.file_count || 0).toLocaleString()}</b> ไฟล์</td>
            </tr>
        `;
    }).join('');
    
    updateSortHeaderUI();
}

function updateSortHeaderUI() {
    const headers = document.querySelectorAll('.th-sortable');
    headers.forEach(th => {
        const field = th.getAttribute('data-sort');
        const icon = th.querySelector('.sort-icon');
        if (!icon) return;
        
        if (field === currentSortField) {
            th.classList.add('active-sort');
            icon.className = currentSortOrder === 'asc' ? 'fa-solid fa-sort-up sort-icon' : 'fa-solid fa-sort-down sort-icon';
        } else {
            th.classList.remove('active-sort');
            icon.className = 'fa-solid fa-sort sort-icon';
        }
    });
}

function renderTargetList(targets) {
    const tbody = document.getElementById('targetListBody');
    if (!tbody) return;
    
    if (!targets || targets.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="empty-state">ยังไม่มีการเพิ่ม Target Network Path</td></tr>`;
        return;
    }
    
    tbody.innerHTML = targets.map(t => `
        <tr>
            <td><b>${t.name}</b></td>
            <td><span class="path-code">${t.path}</span></td>
            <td>
                <span class="badge-status ${t.enabled ? 'success' : 'danger'}">
                    ${t.enabled ? 'เปิดใช้งาน' : 'ปิดอยู่'}
                </span>
            </td>
            <td>
                <button class="btn-danger-sm" onclick="deleteTargetItem(${t.id})">
                    <i class="fa-solid fa-trash"></i> ลบ
                </button>
            </td>
        </tr>
    `).join('');
}

function populateConfigModalForm(configs) {
    if (!configs) return;
    document.getElementById('cfgDriveName').value = configs.drive_name || '';
    document.getElementById('cfgCapacityTb').value = configs.total_capacity_tb || 10;
    document.getElementById('cfgCronHour').value = configs.scan_cron_hour || 0;
    document.getElementById('cfgAutoEnabled').checked = configs.auto_scan_enabled;
}

// Event Listeners
function setupEventListeners() {
    // Column header sort clicks
    document.querySelectorAll('.th-sortable').forEach(th => {
        th.addEventListener('click', () => {
            const field = th.getAttribute('data-sort');
            if (currentSortField === field) {
                currentSortOrder = currentSortOrder === 'asc' ? 'desc' : 'asc';
            } else {
                currentSortField = field;
                currentSortOrder = field === 'name' ? 'asc' : 'desc';
            }
            if (dashboardData && dashboardData.snapshots) {
                const query = document.getElementById('searchInput').value.toLowerCase();
                const filtered = dashboardData.snapshots.filter(s => 
                    s.folder_name.toLowerCase().includes(query)
                );
                renderFolderTable(filtered);
            }
        });
    });
    
    // Config Modal Open / Close
    const modal = document.getElementById('configModal');
    const btnOpenConfig = document.getElementById('btnOpenConfig');
    const btnCloseModal = document.getElementById('btnCloseModal');
    const btnCloseModalFooter = document.getElementById('btnCloseModalFooter');
    
    if (btnOpenConfig && modal) {
        btnOpenConfig.addEventListener('click', () => modal.classList.add('active'));
    }
    if (btnCloseModal && modal) {
        btnCloseModal.addEventListener('click', () => modal.classList.remove('active'));
    }
    if (btnCloseModalFooter && modal) {
        btnCloseModalFooter.addEventListener('click', () => modal.classList.remove('active'));
    }
    
    // Trigger Manual Scan
    const btnTriggerScan = document.getElementById('btnTriggerScan');
    if (btnTriggerScan) {
        btnTriggerScan.addEventListener('click', triggerManualScan);
    }
    
    // Save Global Drive Config
    const btnSaveGlobalConfig = document.getElementById('btnSaveGlobalConfig');
    if (btnSaveGlobalConfig) {
        btnSaveGlobalConfig.addEventListener('click', saveGlobalConfig);
    }
    
    // Add Target
    const btnAddTarget = document.getElementById('btnAddTarget');
    if (btnAddTarget) {
        btnAddTarget.addEventListener('click', addNewTarget);
    }
    
    // Test Target Path
    const btnTestNewPath = document.getElementById('btnTestNewPath');
    if (btnTestNewPath) {
        btnTestNewPath.addEventListener('click', testNewPath);
    }
    
    // Table Search Filter
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            if (!dashboardData || !dashboardData.snapshots) return;
            const filtered = dashboardData.snapshots.filter(s => 
                s.folder_name.toLowerCase().includes(query)
            );
            renderFolderTable(filtered);
        });
    }
}

async function triggerManualScan() {
    const btn = document.getElementById('btnTriggerScan');
    const icon = document.getElementById('scanBtnIcon');
    const progressPanel = document.getElementById('scanProgressPanel');
    const liveProgressBar = document.getElementById('liveProgressBar');
    const progressPctBadge = document.getElementById('progressPctBadge');
    const progressTitle = document.getElementById('progressTitle');
    const progressSubtext = document.getElementById('progressSubtext');
    const consoleBody = document.getElementById('terminalConsoleBody');
    
    if (btn) btn.disabled = true;
    if (icon) icon.className = 'fa-solid fa-arrows-rotate fa-spin';
    if (progressPanel) progressPanel.classList.remove('hidden');
    if (consoleBody) consoleBody.innerHTML = '<div class="console-line info">[SYSTEM] เริ่มการสแกน Network Drive...</div>';
    
    showToast("เริ่มการสแกน Network Drive ใน Background...", "info");
    
    try {
        const res = await fetch('/api/scan/trigger', { method: 'POST' });
        const data = await res.json();
        
        if (data.status === "already_scanning") {
            showToast("การสแกนกำลังรันอยู่ก่อนหน้า...", "info");
        }
        
        // Poll status every 800ms until scan completes
        const pollInterval = setInterval(async () => {
            try {
                const statusRes = await fetch('/api/scan/status');
                const status = await statusRes.json();
                
                const pct = status.progress_percent || 0;
                if (liveProgressBar) liveProgressBar.style.width = `${pct}%`;
                if (progressPctBadge) progressPctBadge.innerText = `${pct}%`;
                
                if (status.current_folder && progressTitle && progressSubtext) {
                    progressTitle.innerText = `กำลังสแกน: ${status.current_folder}...`;
                    progressSubtext.innerText = `สแกนแล้ว ${status.scanned_count} จาก ${status.total_targets} โฟลเดอร์หลัก`;
                }
                
                // Stream Terminal Logs
                if (status.logs && status.logs.length > 0 && consoleBody) {
                    consoleBody.innerHTML = status.logs.map(log => `
                        <div class="console-line ${log.type}">
                            [${log.time}] ${log.message}
                        </div>
                    `).join('');
                    consoleBody.scrollTop = consoleBody.scrollHeight;
                }
                
                if (!status.is_scanning) {
                    clearInterval(pollInterval);
                    if (btn) {
                        btn.disabled = false;
                        btn.innerHTML = `<i class="fa-solid fa-arrows-rotate" id="scanBtnIcon"></i> สแกนทันที`;
                    }
                    if (progressTitle) progressTitle.innerText = `สแกน Network Drive เสร็จสมบูรณ์!`;
                    if (progressSubtext) progressSubtext.innerText = `ประมวลผลเสร็จสิ้น 100% ข้อมูลทั้งหมดถูกอัปเดตลง Dashboard`;
                    showToast("สแกนข้อมูล Network Drive เรียบร้อยแล้ว!", "success");
                    
                    await loadDashboard();
                }
            } catch (err) {
                console.error("Poll error:", err);
            }
        }, 800);
        
    } catch (e) {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<i class="fa-solid fa-arrows-rotate" id="scanBtnIcon"></i> สแกนทันที`;
        }
        showToast("เกิดข้อผิดพลาดขณะเริ่มสแกน", "error");
    }
}

async function saveGlobalConfig() {
    const drive_name = document.getElementById('cfgDriveName').value.trim();
    const total_capacity_tb = parseFloat(document.getElementById('cfgCapacityTb').value);
    const scan_cron_hour = parseInt(document.getElementById('cfgCronHour').value);
    const auto_scan_enabled = document.getElementById('cfgAutoEnabled').checked;
    
    try {
        const res = await fetch('/api/configs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ drive_name, total_capacity_tb, scan_cron_hour, auto_scan_enabled })
        });
        if (res.ok) {
            showToast("บันทึกการตั้งค่าเรียบร้อยแล้ว", "success");
            loadDashboard();
        }
    } catch (e) {
        showToast("บันทึกการตั้งค่าไม่สำเร็จ", "error");
    }
}

async function testNewPath() {
    const path = document.getElementById('newTargetPath').value.trim();
    const resultBox = document.getElementById('testPathResult');
    
    if (!path) {
        showToast("กรุณากรอก Path โฟลเดอร์ที่ต้องการทดสอบ", "error");
        return;
    }
    
    resultBox.className = 'test-result-box';
    resultBox.innerText = 'กำลังทดสอบการเข้าถึง Path...';
    resultBox.classList.remove('hidden');
    
    try {
        const res = await fetch('/api/targets/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path })
        });
        const data = await res.json();
        
        if (data.accessible) {
            resultBox.className = 'test-result-box success';
            resultBox.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${data.message}`;
        } else {
            resultBox.className = 'test-result-box error';
            resultBox.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${data.message}`;
        }
    } catch (e) {
        resultBox.className = 'test-result-box error';
        resultBox.innerText = 'ไม่สามารถทดสอบ Path ได้';
    }
}

async function addNewTarget() {
    const name = document.getElementById('newTargetName').value.trim();
    const path = document.getElementById('newTargetPath').value.trim();
    
    if (!name || !path) {
        showToast("กรุณากรอกชื่อและ Path โฟลเดอร์ให้ครบถ้วน", "error");
        return;
    }
    
    try {
        const res = await fetch('/api/targets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, path, enabled: 1 })
        });
        if (res.ok) {
            showToast(`เพิ่มโฟลเดอร์ "${name}" เรียบร้อยแล้ว`, "success");
            document.getElementById('newTargetName').value = '';
            document.getElementById('newTargetPath').value = '';
            document.getElementById('testPathResult').classList.add('hidden');
            loadDashboard();
        }
    } catch (e) {
        showToast("เพิ่มข้อมูลโฟลเดอร์ไม่สำเร็จ", "error");
    }
}

async function deleteTargetItem(targetId) {
    if (!confirm("คุณแน่ใจหรือไม่ว่าต้องการลบ Target โฟลเดอร์นี้ออกจากระบบ?")) return;
    
    try {
        const res = await fetch(`/api/targets/${targetId}`, { method: 'DELETE' });
        if (res.ok) {
            showToast("ลบโฟลเดอร์เป้าหมายเรียบร้อยแล้ว", "success");
            loadDashboard();
        }
    } catch (e) {
        showToast("ลบข้อมูลไม่สำเร็จ", "error");
    }
}
