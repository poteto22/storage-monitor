// Global State
let dashboardData = null;
let treemapChartInstance = null;
let trendChartInstance = null;
let currentSortField = 'size'; // 'id', 'name', 'drive', 'size', 'percent', 'files'
let currentSortOrder = 'desc';
let currentSelectedDriveId = 'all';

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
    try { initCharts(); } catch(e) { console.error("initCharts error:", e); }
    try { loadDashboard(); } catch(e) { console.error("loadDashboard error:", e); }
    try { setupEventListeners(); } catch(e) { console.error("setupEventListeners error:", e); }
});

function initCharts() {
    if (typeof echarts === 'undefined') {
        console.warn("ECharts library not loaded.");
        return;
    }
    const treemapEl = document.getElementById('treemapChart');
    const trendEl = document.getElementById('trendChart');
    
    if (treemapEl && !treemapChartInstance) {
        try { treemapChartInstance = echarts.init(treemapEl); } catch(e) {}
    }
    if (trendEl && !trendChartInstance) {
        try { trendChartInstance = echarts.init(trendEl); } catch(e) {}
    }
    
    window.addEventListener('resize', () => {
        if (treemapChartInstance) treemapChartInstance.resize();
        if (trendChartInstance) trendChartInstance.resize();
    });
}

// Fetch and Render Dashboard
async function loadDashboard(driveId = currentSelectedDriveId) {
    try {
        currentSelectedDriveId = driveId;
        const response = await fetch(`/api/dashboard?drive_id=${driveId}`);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        dashboardData = await response.json();
        
        try { renderDriveSelectFilter(dashboardData.drives, dashboardData.selected_drive_id); } catch(e) { console.error(e); }
        try { renderHeaderAndMetrics(dashboardData); } catch(e) { console.error(e); }
        try { renderTreemapChart(dashboardData.snapshots); } catch(e) { console.error(e); }
        try { renderTrendChart(dashboardData.history); } catch(e) { console.error(e); }
        try { renderFolderTable(dashboardData.snapshots); } catch(e) { console.error(e); }
        try { renderDriveList(dashboardData.drives); } catch(e) { console.error(e); }
        try { renderTargetList(dashboardData.targets); } catch(e) { console.error(e); }
        try { renderTargetDriveOptions(dashboardData.drives); } catch(e) { console.error(e); }
        try { populateConfigModalForm(dashboardData.configs); } catch(e) { console.error(e); }
    } catch (error) {
        console.error("Error loading dashboard:", error);
        showToast("ไม่สามารถโหลดข้อมูล Dashboard ได้ (" + error.message + ")", "error");
    }
}

function renderDriveSelectFilter(drives, selectedId) {
    const select = document.getElementById('driveSelectFilter');
    if (!select) return;
    
    let html = `<option value="all" ${String(selectedId) === 'all' ? 'selected' : ''}>ทุก Drive หลัก (All Drives)</option>`;
    if (drives && drives.length > 0) {
        drives.forEach(d => {
            const isSel = String(d.id) === String(selectedId) ? 'selected' : '';
            html += `<option value="${d.id}" ${isSel}>🖴 ${d.name} (${d.total_capacity_tb} TB)</option>`;
        });
    }
    select.innerHTML = html;
}

function renderTargetDriveOptions(drives) {
    const select = document.getElementById('newTargetDriveSelect');
    if (!select) return;
    
    if (!drives || drives.length === 0) {
        select.innerHTML = `<option value="1">Drive หลักเริ่มต้น</option>`;
        return;
    }
    select.innerHTML = drives.map(d => `<option value="${d.id}">${d.name} (${d.total_capacity_tb} TB)</option>`).join('');
}

function renderHeaderAndMetrics(data) {
    if (!data) return;
    const configs = data.configs || {};
    const summary = data.summary || {};
    const drives = data.drives || [];
    const snapshots = data.snapshots || [];
    const isAllDrives = !data.selected_drive_id || String(data.selected_drive_id).toLowerCase() === 'all';

    const driveNameHeader = document.getElementById('driveNameHeader');
    if (driveNameHeader) driveNameHeader.innerText = configs.drive_name || "NAS Network Drive Monitor";

    const scanScheduleLabel = document.getElementById('scanScheduleLabel');
    if (scanScheduleLabel) scanScheduleLabel.innerText = `Daily Scan: ${String(configs.scan_cron_hour || 0).padStart(2, '0')}:00 AM`;

    const lastScanText = document.getElementById('lastScanText');
    if (lastScanText) {
        if (summary.last_scan_time) {
            lastScanText.innerHTML = `<i class="fa-regular fa-clock"></i> สแกนล่าสุด: ${summary.last_scan_time} (${summary.last_scan_duration_sec || 0}s)`;
        } else {
            lastScanText.innerHTML = `<i class="fa-regular fa-clock"></i> ยังไม่มีข้อมูลสแกน`;
        }
    }

    const singleContainer = document.getElementById('storageSingleContainer');
    const multiContainer = document.getElementById('storageMultiContainer');
    const cardTitle = document.getElementById('storageCardTitle');

    if (isAllDrives && drives.length > 1) {
        if (cardTitle) cardTitle.innerText = "ความจุแยกตาม Drive หลัก";
        if (singleContainer) singleContainer.classList.add('hidden');
        if (multiContainer) {
            multiContainer.classList.remove('hidden');
            
            multiContainer.innerHTML = drives.map(d => {
                const driveSnaps = snapshots.filter(s => String(s.drive_id) === String(d.id));
                const dUsed = driveSnaps.reduce((sum, s) => sum + (s.size_bytes || 0), 0);
                const dCapBytes = (parseFloat(d.total_capacity_tb) || 10) * (1024 ** 4);
                const dPct = dCapBytes > 0 ? Math.min(100, parseFloat(((dUsed / dCapBytes) * 100).toFixed(1))) : 0;
                const dFree = Math.max(0, dCapBytes - dUsed);

                return `
                    <div class="drive-breakdown-item">
                        <div class="drive-breakdown-header">
                            <span class="drive-breakdown-title"><i class="fa-solid fa-hard-drive text-blue"></i> ${d.name}</span>
                            <span class="drive-breakdown-size"><b>${formatBytes(dUsed)}</b> / ${d.total_capacity_tb} TB (${dPct}%)</span>
                        </div>
                        <div class="progress-bar-container" style="height: 7px; margin-top: 4px;">
                            <div class="progress-bar-fill" style="width: ${dPct}%;"></div>
                        </div>
                        <div class="drive-breakdown-footer">
                            <span>คงเหลือ: ${formatBytes(dFree)}</span>
                        </div>
                    </div>
                `;
            }).join('');
        }
    } else {
        if (cardTitle) cardTitle.innerText = "ความจุ Drive รวม";
        if (multiContainer) multiContainer.classList.add('hidden');
        if (singleContainer) {
            singleContainer.classList.remove('hidden');
            
            const usedText = formatBytes(summary.used_bytes || 0);
            const totalText = `จาก ${configs.total_capacity_tb || 0} TB`;

            const usedSizeText = document.getElementById('usedSizeText');
            if (usedSizeText) usedSizeText.innerText = usedText;

            const totalCapacityText = document.getElementById('totalCapacityText');
            if (totalCapacityText) totalCapacityText.innerText = totalText;

            const pct = summary.used_percentage || 0;
            const usageBadge = document.getElementById('usageBadge');
            if (usageBadge) usageBadge.innerText = `${pct}%`;

            const storageProgressBar = document.getElementById('storageProgressBar');
            if (storageProgressBar) storageProgressBar.style.width = `${Math.min(pct, 100)}%`;

            const freeSpaceText = document.getElementById('freeSpaceText');
            if (freeSpaceText) freeSpaceText.innerText = `คงเหลือ: ${formatBytes(summary.free_bytes || 0)}`;
        }
    }

    const totalFilesText = document.getElementById('totalFilesText');
    if (totalFilesText) totalFilesText.innerText = (summary.total_files || 0).toLocaleString();

    const growthBytes = summary.size_change_24h_bytes || 0;
    const growthEl = document.getElementById('growth24hText');
    if (growthEl) {
        if (growthBytes >= 0) {
            growthEl.innerText = `+${formatBytes(growthBytes)}`;
            growthEl.className = 'text-emerald';
        } else {
            growthEl.innerText = formatBytes(growthBytes);
            growthEl.className = 'text-rose';
        }
    }
}

function renderTreemapChart(snapshots) {
    if (typeof echarts === 'undefined') return;
    const treemapEl = document.getElementById('treemapChart');
    if (!treemapEl) return;
    if (!treemapChartInstance) treemapChartInstance = echarts.init(treemapEl);
    
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
        files: item.file_count,
        drive: item.drive_name
    }));
    
    const option = {
        tooltip: {
            formatter: function (info) {
                const value = formatBytes(info.value);
                const files = (info.data.files || 0).toLocaleString();
                const driveStr = info.data.drive ? `<div style="font-size:12px; color:#2563eb;">Drive: <b>${info.data.drive}</b></div>` : '';
                return `
                    <div style="font-weight:700; font-family: sans-serif; font-size:13px;">${info.name}</div>
                    ${driveStr}
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
    if (typeof echarts === 'undefined') return;
    const trendEl = document.getElementById('trendChart');
    if (!trendEl) return;
    if (!trendChartInstance) trendChartInstance = echarts.init(trendEl);
    
    if (!history || history.length === 0) {
        trendChartInstance.setOption({
            title: { text: 'สั่งสแกนเพื่อเริ่มบันทึกประวัติ', left: 'center', top: 'center', textStyle: { color: '#94a3b8', fontSize: 14 } }
        });
        return;
    }
    
    const dates = history.map(h => (h.scan_time || '').split(' ')[0]);
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
        } else if (currentSortField === 'drive') {
            valA = a.drive_name || '';
            valB = b.drive_name || '';
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
    
    const tableBadge = document.getElementById('tableCountBadge');
    if (tableBadge) tableBadge.innerText = `${snapshots ? snapshots.length : 0} โฟลเดอร์`;
    
    if (!snapshots || snapshots.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">
                    ยังไม่มีข้อมูลสแกนโฟลเดอร์ในระบบ กดปุ่ม <b>"สแกนทันที"</b> เพื่อเริ่มต้น
                </td>
            </tr>
        `;
        return;
    }
    
    const sorted = getSortedSnapshots(snapshots);
    const totalCapacity = (dashboardData && dashboardData.configs && dashboardData.configs.total_capacity_bytes) || 1;
    
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
                <td><span class="path-code"><i class="fa-solid fa-hard-drive"></i> ${item.drive_name || 'NAS Storage'}</span></td>
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

function renderDriveList(drives) {
    const tbody = document.getElementById('driveListBody');
    if (!tbody) return;
    
    if (!drives || drives.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="empty-state">ยังไม่มีข้อมูล Drive หลัก</td></tr>`;
        return;
    }
    
    tbody.innerHTML = drives.map((d, index) => `
        <tr>
            <td><b>${index + 1}</b></td>
            <td>
                <input type="text" class="form-input form-input-sm" id="editDriveName_${d.id}" value="${d.name}">
            </td>
            <td>
                <div style="display: flex; align-items: center; gap: 4px;">
                    <input type="number" step="0.1" class="form-input form-input-sm" id="editDriveCap_${d.id}" value="${d.total_capacity_tb}" style="width: 85px;">
                    <span style="font-size:0.85rem; font-weight:600;">TB</span>
                </div>
            </td>
            <td>
                <div style="display: flex; align-items: center; gap: 6px;">
                    <button type="button" class="btn btn-sm btn-outline" style="padding: 4px 8px; font-size: 0.8rem;" onclick="saveDriveItem(${d.id})" title="บันทึกการแก้ไข">
                        <i class="fa-solid fa-floppy-disk text-blue"></i> บันทึก
                    </button>
                    ${drives.length > 1 ? `
                        <button type="button" class="btn-danger-sm" onclick="deleteDriveItem(${d.id})" title="ลบ Drive">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    ` : ''}
                </div>
            </td>
        </tr>
    `).join('');
}

function renderTargetList(targets) {
    const tbody = document.getElementById('targetListBody');
    if (!tbody) return;
    
    if (!targets || targets.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="empty-state">ยังไม่มีการเพิ่ม Target Network Path</td></tr>`;
        return;
    }
    
    tbody.innerHTML = targets.map(t => `
        <tr>
            <td><b>${t.name}</b></td>
            <td><span class="badge-percentage"><i class="fa-solid fa-hard-drive"></i> ${t.drive_name || 'NAS Storage'}</span></td>
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
    const cronHourEl = document.getElementById('cfgCronHour');
    if (cronHourEl) cronHourEl.value = configs.scan_cron_hour || 0;
    
    const autoEnabledEl = document.getElementById('cfgAutoEnabled');
    if (autoEnabledEl) autoEnabledEl.checked = configs.auto_scan_enabled;
}

// Event Listeners
function setupEventListeners() {
    // Drive Dropdown Filter Change
    const driveSelectFilter = document.getElementById('driveSelectFilter');
    if (driveSelectFilter) {
        driveSelectFilter.addEventListener('change', (e) => {
            loadDashboard(e.target.value);
        });
    }

    // Column header sort clicks
    document.querySelectorAll('.th-sortable').forEach(th => {
        th.addEventListener('click', () => {
            const field = th.getAttribute('data-sort');
            if (currentSortField === field) {
                currentSortOrder = currentSortOrder === 'asc' ? 'desc' : 'asc';
            } else {
                currentSortField = field;
                currentSortOrder = field === 'name' || field === 'drive' ? 'asc' : 'desc';
            }
            if (dashboardData && dashboardData.snapshots) {
                const queryEl = document.getElementById('searchInput');
                const query = queryEl ? queryEl.value.toLowerCase() : '';
                const filtered = dashboardData.snapshots.filter(s => 
                    s.folder_name.toLowerCase().includes(query) || (s.drive_name && s.drive_name.toLowerCase().includes(query))
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
    
    // Save Global Auto-Scan Schedule
    const btnSaveGlobalConfig = document.getElementById('btnSaveGlobalConfig');
    if (btnSaveGlobalConfig) {
        btnSaveGlobalConfig.addEventListener('click', saveGlobalConfig);
    }

    // Add Drive
    const btnAddDrive = document.getElementById('btnAddDrive');
    if (btnAddDrive) {
        btnAddDrive.addEventListener('click', addNewDrive);
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
                s.folder_name.toLowerCase().includes(query) || (s.drive_name && s.drive_name.toLowerCase().includes(query))
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
        const res = await fetch(`/api/scan/trigger?drive_id=${currentSelectedDriveId}`, { method: 'POST' });
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
    const cronHourEl = document.getElementById('cfgCronHour');
    const autoEnabledEl = document.getElementById('cfgAutoEnabled');
    if (!cronHourEl || !autoEnabledEl) return;
    
    const scan_cron_hour = parseInt(cronHourEl.value);
    const auto_scan_enabled = autoEnabledEl.checked;
    
    try {
        const res = await fetch('/api/configs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ scan_cron_hour, auto_scan_enabled })
        });
        if (res.ok) {
            showToast("บันทึกการตั้งค่าเรียบร้อยแล้ว", "success");
            loadDashboard();
        }
    } catch (e) {
        showToast("บันทึกการตั้งค่าไม่สำเร็จ", "error");
    }
}

async function saveDriveItem(driveId) {
    const nameEl = document.getElementById(`editDriveName_${driveId}`);
    const capEl = document.getElementById(`editDriveCap_${driveId}`);
    if (!nameEl || !capEl) return;
    
    const name = nameEl.value.trim();
    const capacity = parseFloat(capEl.value);
    
    if (!name || isNaN(capacity) || capacity <= 0) {
        showToast("กรุณากรอกชื่อและขนาดความจุ TB ของ Drive ให้ถูกต้อง", "error");
        return;
    }
    
    try {
        const res = await fetch(`/api/drives/${driveId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, total_capacity_tb: capacity, enabled: 1 })
        });
        if (res.ok) {
            showToast(`บันทึกแก้ไข Drive "${name}" (${capacity} TB) เรียบร้อยแล้ว`, "success");
            await loadDashboard();
        } else {
            showToast("บันทึกการแก้ไขไม่สำเร็จ", "error");
        }
    } catch (e) {
        showToast("บันทึกการแก้ไขไม่สำเร็จ", "error");
    }
}

async function addNewDrive() {
    const nameEl = document.getElementById('newDriveName');
    const capEl = document.getElementById('newDriveCapacity');
    if (!nameEl || !capEl) return;
    
    const name = nameEl.value.trim();
    const capacity = parseFloat(capEl.value);
    
    if (!name || isNaN(capacity) || capacity <= 0) {
        showToast("กรุณากรอกชื่อและขนาดความจุ TB ของ Drive ให้ถูกต้อง", "error");
        return;
    }
    
    try {
        const res = await fetch('/api/drives', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, total_capacity_tb: capacity, enabled: 1 })
        });
        if (res.ok) {
            showToast(`เพิ่ม Drive หลัก "${name}" (${capacity} TB) เรียบร้อยแล้ว`, "success");
            nameEl.value = '';
            capEl.value = '';
            await loadDashboard();
        } else {
            const errData = await res.json().catch(() => ({}));
            showToast(`เพิ่ม Drive ไม่สำเร็จ: ${errData.detail || 'ข้อผิดพลาดระบบ'}`, "error");
        }
    } catch (e) {
        showToast("เพิ่มข้อมูล Drive ไม่สำเร็จ", "error");
    }
}

async function deleteDriveItem(driveId) {
    if (!confirm("คุณแน่ใจหรือไม่ว่าต้องการลบ Drive หลักนี้? (โฟลเดอร์เป้าหมายทั้งหมดใน Drive นี้จะถูกลบออกด้วย)")) return;
    
    try {
        const res = await fetch(`/api/drives/${driveId}`, { method: 'DELETE' });
        if (res.ok) {
            showToast("ลบ Drive หลักเรียบร้อยแล้ว", "success");
            currentSelectedDriveId = 'all';
            await loadDashboard('all');
        }
    } catch (e) {
        showToast("ลบข้อมูล Drive ไม่สำเร็จ", "error");
    }
}

async function testNewPath() {
    const pathEl = document.getElementById('newTargetPath');
    const resultBox = document.getElementById('testPathResult');
    if (!pathEl || !resultBox) return;
    
    const path = pathEl.value.trim();
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
    const nameEl = document.getElementById('newTargetName');
    const pathEl = document.getElementById('newTargetPath');
    const driveSelectEl = document.getElementById('newTargetDriveSelect');
    if (!nameEl || !pathEl) return;
    
    const name = nameEl.value.trim();
    const path = pathEl.value.trim();
    const drive_id = driveSelectEl ? (parseInt(driveSelectEl.value) || 1) : 1;
    
    if (!name || !path) {
        showToast("กรุณากรอกชื่อและ Path โฟลเดอร์ให้ครบถ้วน", "error");
        return;
    }
    
    try {
        const res = await fetch('/api/targets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, path, enabled: 1, drive_id })
        });
        if (res.ok) {
            showToast(`เพิ่มโฟลเดอร์ "${name}" เรียบร้อยแล้ว`, "success");
            nameEl.value = '';
            pathEl.value = '';
            const testRes = document.getElementById('testPathResult');
            if (testRes) testRes.classList.add('hidden');
            await loadDashboard();
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
            await loadDashboard();
        }
    } catch (e) {
        showToast("ลบข้อมูลไม่สำเร็จ", "error");
    }
}
