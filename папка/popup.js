const themeBtn = document.getElementById('btn-theme');
const body = document.documentElement;

// ==========================================
// 1. НАСТРОЙКИ И ТЕМЫ
// ==========================================
let appSettings = { theme: 'light', waitTime: 12, soundEnabled: true, autoDownload: false };

async function loadSettings() {
    // Грузим настройки приложения и данные авторизации
    const data = await chrome.storage.local.get(['appSettings', 'authData']);
    
    if (data.appSettings) appSettings = { ...appSettings, ...data.appSettings };
    
    if (appSettings.theme === 'dark') { 
        body.setAttribute('data-theme', 'dark'); 
        themeBtn.textContent = '☀️'; 
    }
    
    document.getElementById('setting-wait').value = appSettings.waitTime;
    document.getElementById('wait-time-val').textContent = appSettings.waitTime;
    document.getElementById('setting-sound').checked = appSettings.soundEnabled;
    document.getElementById('setting-auto').checked = appSettings.autoDownload;

    // Вставляем данные логина/пароля в поля, если они были сохранены
    if (data.authData) {
        document.getElementById('auth-email').value = data.authData.email || '';
        document.getElementById('auth-password').value = data.authData.password || '';
    }
}

themeBtn.addEventListener('click', async () => {
    const isDark = body.getAttribute('data-theme') === 'dark';
    appSettings.theme = isDark ? 'light' : 'dark';
    if (!isDark) { 
        body.setAttribute('data-theme', 'dark'); 
        themeBtn.textContent = '☀️'; 
    } else { 
        body.removeAttribute('data-theme'); 
        themeBtn.textContent = '🌙'; 
    }
    await chrome.storage.local.set({ appSettings });
});

document.getElementById('btn-settings').addEventListener('click', () => { 
    document.getElementById('settings-overlay').classList.add('active'); 
});

document.getElementById('setting-wait').addEventListener('input', (e) => { 
    document.getElementById('wait-time-val').textContent = e.target.value; 
});

// Кнопка сохранения всех настроек (включая авторизацию)
document.getElementById('btn-close-settings').addEventListener('click', async () => {
    appSettings.waitTime = parseInt(document.getElementById('setting-wait').value);
    appSettings.soundEnabled = document.getElementById('setting-sound').checked;
    appSettings.autoDownload = document.getElementById('setting-auto').checked;
    
    const authData = {
        email: document.getElementById('auth-email').value.trim(),
        password: document.getElementById('auth-password').value.trim()
    };

    await chrome.storage.local.set({ appSettings, authData });
    document.getElementById('settings-overlay').classList.remove('active');
});

// Кнопка удаления данных авторизации
document.getElementById('btn-clear-auth').addEventListener('click', async () => {
    document.getElementById('auth-email').value = '';
    document.getElementById('auth-password').value = '';
    await chrome.storage.local.remove(['authData']);
    alert('Данные авторизации удалены из памяти!');
});

// ==========================================
// 2. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ И ДАННЫЕ
// ==========================================
const OVD_ORDER = ["Железнодорожный", "Дзержинский", "Заельцовский", "Калининский", "Кировский", "Ленинский", "Октябрьский", "Первомайский", "Советский", "Центральный", "Бердск", "Искитим", "Новосибирский", "Есенина 1", "Есенина 2", "УВМ"];
const T1_COLS = [{ key: "гр-во, ССР, утрата", title: "гр-во, ССР, утрата" }, { key: "РП 14,20,45, фамилия", title: "РП 20,45, фам..." }, { key: "РУ", title: "РУ" }, { key: "озпэ", title: "ОЗП" }, { key: "ОЗП10", title: "ОЗПЭ" }, { key: "Адресная справка", title: "АСР" }];
const T2_COLS = [
    { key: "МУ", title: "МУ" }, { key: "Дактилоскопия", title: "Дактилоскопия" }, { key: "Приглашения", title: "Приглашения" },
    { key: "ВНЖ", title: "ВНЖ" }, { key: "РВП", title: "РВП" }, { key: "Патент", title: "Патент" }, 
    { key: "Гражданство", title: "Гражданство" }, { key: "Прием гражданства", title: "Прием гражданства" }
];
const T3_COLS = [
    { key: "Визы", title: "Визы" }, { key: "Работники", title: "Работники" }, { key: "Иные услуги", title: "Иные услуги" },
    { key: "Личный прием", title: "Личный прием" }, { key: "Доп услуги", title: "Доп услуги" },
    { key: "Локальные услуги", title: "Локальные услуги" }, { key: "Локальная услуга", title: "Локальная услуга" }
];


function formatForInput(dateObj) {
    const y = dateObj.getFullYear(), m = String(dateObj.getMonth() + 1).padStart(2, '0'), d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function formatDate(dateString) {
    if (!dateString) return "";
    const [year, month, day] = dateString.split('-');
    return `${day}.${month}.${year}`;
}

// ==========================================
// 3. ИНИЦИАЛИЗАЦИЯ ИНТЕРФЕЙСА
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    await loadSettings(); 
    const today = new Date(); 
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    
    document.getElementById('date-start').value = formatForInput(firstDay);
    document.getElementById('date-end').value = formatForInput(today);

    const data = await chrome.storage.local.get(['allData']);
    const allData = data.allData || {};
    const statusBoard = document.getElementById('status-board');
    
    OVD_ORDER.forEach(ovd => {
        const badge = document.createElement('span'); 
        badge.className = 'badge';
        if (allData[ovd] && Object.keys(allData[ovd]).length > 0) { 
            badge.classList.add('done'); 
            badge.innerHTML = `✅ ${ovd}`; 
        } else { 
            badge.innerHTML = `⏳ ${ovd}`; 
        }
        badge.addEventListener('click', () => { document.getElementById('ovd').value = ovd; });
        statusBoard.appendChild(badge);
    });
});

// ==========================================
// 4. УПРАВЛЕНИЕ (СТАРТ/СТОП/ОЧИСТКА)
// ==========================================
document.getElementById('btn-start').addEventListener('click', async () => {
    const ovd = document.getElementById('ovd').value.trim();
    if (!ovd) return alert("Выберите ОВД!");

    const newState = {
        ovd: ovd,
        startDate: formatDate(document.getElementById('date-start').value),
        endDate: formatDate(document.getElementById('date-end').value),
        running: true,
        forceStop: false,
        currentStageIndex: 0, 
        passportGroup1: 0, 
        passportTotal: 0
    };

    await chrome.storage.local.set(newState);

    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (tabs[0]) { chrome.tabs.reload(tabs[0].id); }
        window.close();
    });
});

document.getElementById('btn-stop').addEventListener('click', async () => {
    await chrome.storage.local.set({ forceStop: true });
    alert("Сигнал остановки отправлен. Скрипт прекратит работу.");
});

document.getElementById('btn-clear').addEventListener('click', async () => {
    if (confirm("Удалить ВСЕ собранные данные?")) { 
        await chrome.storage.local.remove(['allData', 'running', 'currentStageIndex']); 
        window.location.reload(); 
    }
});

// ==========================================
// 5. ПРЕДПРОСМОТР ТАБЛИЦЫ
// ==========================================
document.getElementById('btn-preview').addEventListener('click', async () => {
    const data = await chrome.storage.local.get(['allData']);
    const allData = data.allData || {};
    const previewDiv = document.getElementById('preview-content');
    
    if (Object.keys(allData).length === 0) {
        previewDiv.innerHTML = "<p style='text-align:center; color: #e74c3c; font-weight: bold;'>Нет собранных данных.</p>";
        document.getElementById('preview-overlay').classList.add('active');
        return;
    }

    const columns = [...T1_COLS, ...T2_COLS, ...T3_COLS];
    let html = `<div class="table-container"><table><thead><tr><th>ОВД</th>`;
    columns.forEach(col => { html += `<th>${col.title}</th>`; });
    html += `</tr></thead><tbody>`;

    let sums = new Array(columns.length).fill(0);

    OVD_ORDER.forEach((ovdName) => {
        html += `<tr><td style="text-align: left; font-weight: bold;">${ovdName}</td>`;
        let ovdData = allData[ovdName] || {};
        
        columns.forEach((col, colIndex) => {
            let val = ovdData[col.key];
            let num = (val && val !== "-" && !isNaN(val)) ? parseInt(val, 10) : "";
            
            if (num !== "") {
                sums[colIndex] += num;
                html += `<td style="color: #28a745; font-weight: bold;">${num}</td>`;
            } else {
                html += `<td style="color: #999;">-</td>`;
            }
        });
        html += `</tr>`;
    });

    html += `<tr class="sum-row"><td>ИТОГО:</td>`;
    sums.forEach(s => { html += `<td>${s > 0 ? s : '-'}</td>`; });
    html += `</tr></tbody></table></div>`;

    previewDiv.innerHTML = html;
    document.getElementById('preview-overlay').classList.add('active');
});

document.getElementById('btn-close-preview').addEventListener('click', () => {
    document.getElementById('preview-overlay').classList.remove('active');
});

// ==========================================
// 6. ВЫГРУЗКА CSV ВРУЧНУЮ
// ==========================================
document.getElementById('btn-csv').addEventListener('click', async () => {
    const data = await chrome.storage.local.get(['allData', 'startDate', 'endDate']);
    const allData = data.allData || {};
    const endD = data.endDate || formatDate(document.getElementById('date-end').value);

    if (Object.keys(allData).length === 0) return alert("Нет данных для скачивания.");

    let csvRows = [`предварительная запись отчет за период: ${data.startDate||""} - ${endD};;;;;;`];

    function buildCsvTable(columnsArray) {
        if (!columnsArray || columnsArray.length === 0) return; 
        csvRows.push(["Наименование ОВД"].concat(columnsArray.map(c => c.title)).join(";"));
        let datesRow = [""]; columnsArray.forEach(() => datesRow.push(endD)); csvRows.push(datesRow.join(";"));
        let sums = new Array(columnsArray.length).fill(0);

        OVD_ORDER.forEach((ovdName, index) => {
            let rowStr = [`${index} ${ovdName}`];
            let ovdData = allData[ovdName] || {};
            columnsArray.forEach((col, colIndex) => {
                let val = ovdData[col.key]; 
                let num = (val && val !== "-" && !isNaN(val)) ? parseInt(val, 10) : "";
                rowStr.push(num !== "" ? num : ""); 
                if (num !== "") sums[colIndex] += num;
            });
            csvRows.push(rowStr.join(";"));
        });
        csvRows.push(["сумма"].concat(sums.map(s => s > 0 ? s : "")).join(";")); csvRows.push(";;;;;;");
    }

    buildCsvTable(T1_COLS); buildCsvTable(T2_COLS); buildCsvTable(T3_COLS);
    csvRows.push("Рассчёт РП ОМУ %;То что написано красным - не трогать, меняешь только чёрный текст;;;;;\n191;6.3772955;14 лет;;;;\n2804;93.622705;20-45 лет;;;;\n2995;100;сумма;;;;\nРП по ОМУ;478;Сколько РП по ому напиши слева, остальное посчитает само;;;;\n% от СУЭО на ОМУ;;;;;;\n30.48347245;14 лет;30;;;;\n447.5165275;20-45 лет;448;;;;");

    const blob = new Blob(["\uFEFF" + csvRows.join("\n")], { type: 'text/csv;charset=utf-8;' });
    chrome.downloads.download({ url: URL.createObjectURL(blob), filename: `MVD_Stats_${endD}.csv`, saveAs: true });
});