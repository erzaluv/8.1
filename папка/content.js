// --- ИНЪЕКЦИЯ СКРИПТА БЕЗ НАРУШЕНИЯ CSP ---
const injectAntiAlert = document.createElement('script');
injectAntiAlert.src = chrome.runtime.getURL('inject.js');
injectAntiAlert.onload = function() { this.remove(); };
(document.head || document.documentElement).appendChild(injectAntiAlert);

const IS_TEST_MODE = window.location.protocol === 'file:';
const SELECTORS = { 
    dateStart: '#start_date', 
    dateEnd: '#end_date', 
    checkedFilters: 'input[type="checkbox"]:checked', 
    filterEpgu: 'input[value="EPGU"]', 
    filterReady: 'input[value="ready"]', 
    labels: '.item, .title, label', 
    treeSection: '.tree-multiselect-section', 
    plusIcon: '.glyphicon-plus', 
    checkbox: 'input[type="checkbox"]', 
    submitBtn: 'button.btn.btn-primary[type="submit"]', 
    paginationNav: 'nav.pagination', 
    bTags: 'b', 
    emptyAlert: '.alert-info, .empty-result, .no-data' 
};

const STAGES = [
    { search: "Осуществление миграционного учета в Российской Федерации", report: "МУ" },
    { search: "Государственная услуга по оформлению и выдаче заграничных паспортов со сроком действия 5 лет", report: "озпэ" },
    { search: "Добровольная дактилоскопическая регистрация", report: "Дактилоскопия" },
    { search: "Регистрационный учет по месту жительства или пребывания", report: "РУ" },
    { search: "Предоставление адресно-справочной информации", report: "Адресная справка" },
    { search: "Получение внутреннего паспорта (Группа 1)", report: "РП 14,20,45, фамилия" },
    { search: "Получение внутреннего паспорта (Группа 2)", report: "гр-во, ССР, утрата" },
    { search: "Оформление и выдача приглашений на въезд в Российскую Федерацию", report: "Приглашения" },
    { search: "Иные услуги и сервисы МВД России", report: "Иные услуги" },
    { search: "Выдача иностранным гражданам и лицам без гражданства вида на жительство", report: "ВНЖ" },
    { search: "личный прием руководителя", report: "Личный прием" },
    { search: "Дополнительные услуги", report: "Доп услуги" },
    { search: "Выдача иностранному гражданину и лицу без гражданства разрешения на временное проживание", report: "РВП" },
    { search: "Локальные услуги", report: "Локальные услуги" },
    { search: "Локальная услуга", report: "Локальная услуга" },
    { search: "Оформление гражданства", report: "Гражданство" },
    { search: "прием по вопросам гражданства РФ", report: "Прием гражданства" },
    { search: "Оформление и выдача патента", report: "Патент" },
    { search: "Визы для иностранных граждан", report: "Визы" },
    { search: "Выдача разрешений на привлечение и использование иностранных работников", report: "Работники" },
    { search: "Получение заграничного паспорта со сроком действия 10 лет", report: "ОЗП10" }
];

const GROUP_1_KEYWORDS = ["изменения фамилии", "непригодности", "изменения внешности", "20 или 45 лет", "изменения пола", "оформление (замена) паспорта", "изменением установочных данных", "выдача готового паспорта"];
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

let appSettings = { theme: 'light', waitTime: 12, soundEnabled: true, autoDownload: false };
let widgetDiv = null;

// --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---
function playSound(type) {
    if (!appSettings.soundEnabled) return;
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator(); const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        if (type === 'success') { osc.type = 'sine'; osc.frequency.setValueAtTime(523.25, ctx.currentTime); gain.gain.setValueAtTime(0.1, ctx.currentTime); osc.start(); osc.stop(ctx.currentTime + 0.3); } 
        else { osc.type = 'sawtooth'; osc.frequency.setValueAtTime(150, ctx.currentTime); gain.gain.setValueAtTime(0.1, ctx.currentTime); osc.start(); osc.stop(ctx.currentTime + 0.3); }
    } catch(e) {}
}

function createWidget(ovdName) {
    if (document.getElementById('mvd-parser-widget')) return;
    const isDark = appSettings.theme === 'dark';
    widgetDiv = document.createElement('div');
    widgetDiv.id = 'mvd-parser-widget';
    widgetDiv.innerHTML = `
        <div style="font-weight: bold; color: #11998e; display: flex; justify-content: space-between;"><span>Парсер работает 🚀</span></div>
        <div style="font-size: 12px;">ОВД: <b>${ovdName}</b></div>
        <div id="mvd-stage-text" style="font-size: 12px; margin: 5px 0;">Этап: Подготовка...</div>
        <div id="mvd-result-text" style="font-size: 12px; font-weight: bold;">Результат: -</div>
        <div style="width: 100%; background: #e0e0e0; border-radius: 5px; height: 8px; margin: 10px 0; overflow: hidden;">
            <div id="mvd-progress-bar" style="width: 0%; height: 100%; background: #11998e; transition: width 0.3s, background 0.3s;"></div>
        </div>
        <button id="mvd-btn-stop" style="width: 100%; background: #e74c3c; color: white; border: none; padding: 5px; cursor: pointer;">СТОП</button>
    `;
    Object.assign(widgetDiv.style, { position: 'fixed', bottom: '20px', right: '20px', zIndex: '9999', background: isDark ? '#333' : '#fff', padding: '15px', border: '1px solid #ccc', borderRadius: '10px', width: '220px', fontFamily: 'sans-serif', color: isDark ? '#fff' : '#000', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' });
    document.body.appendChild(widgetDiv);
    document.getElementById('mvd-btn-stop').onclick = () => chrome.storage.local.set({ forceStop: true });
}

function updateWidget(curr, total, name, res, warn = "") {
    if (!widgetDiv) return;
    
    let color = '#11998e'; 
    if (typeof res === 'number') {
        if (res > 0) color = '#28a745'; 
        else if (res === 0) color = '#f39c12'; 
    }
    if (warn) color = '#e74c3c'; 

    document.getElementById('mvd-stage-text').innerHTML = `Этап ${curr}/${total}: ${name} ${warn ? '<br><span style="color:red">'+warn+'</span>' : ''}`;
    const resEl = document.getElementById('mvd-result-text');
    resEl.innerText = `Последний результат: ${res}`;
    resEl.style.color = color;
    const barEl = document.getElementById('mvd-progress-bar');
    barEl.style.width = `${(curr / total) * 100}%`;
    barEl.style.background = color;
}

// ФУНКЦИЯ ВИЗУАЛЬНОГО КЛИКА
function clickWithVisualFeedback(element, callback) {
    if (!element) {
        if (callback) callback();
        return;
    }
    
    // Сохраняем оригинальные стили
    const origBackground = element.style.background || '';
    const origTransition = element.style.transition || '';
    const origTransform = element.style.transform || '';
    const origBoxShadow = element.style.boxShadow || '';
    const origColor = element.style.color || '';

    // Применяем эффект "нажатия роботом" (Оранжевый цвет, тень, вдавливание)
    element.style.transition = "all 0.2s ease";
    element.style.background = "#f39c12"; 
    element.style.color = "#ffffff";
    element.style.boxShadow = "0 0 15px #f39c12";
    element.style.transform = "scale(0.92)";

    // Ждем 350мс, чтобы человек успел увидеть анимацию, затем кликаем
    setTimeout(() => {
        // Возвращаем стили
        element.style.background = origBackground;
        element.style.transition = origTransition;
        element.style.transform = origTransform;
        element.style.boxShadow = origBoxShadow;
        element.style.color = origColor;
        
        // Фактический клик
        setTimeout(() => {
            element.click();
            if (callback) callback();
        }, 50);
    }, 350);
}

function parseResultFromDOM() {
    const pt = document.body.innerText;
    if (pt.includes("Записи не найдены") || pt.includes("Нет данных")) return 0;
    const nav = document.querySelector(SELECTORS.paginationNav);
    if (!nav) return 0;
    const bTags = nav.querySelectorAll(SELECTORS.bTags);
    if (bTags.length === 0) return 0;
    const num = parseInt(bTags[bTags.length - 1].innerText.replace(/\D/g, ''), 10);
    return isNaN(num) ? 0 : num;
}

// --- ОСНОВНОЙ ЦИКЛ ---
chrome.storage.local.get(null, async (data) => {
    if (!data.running || data.forceStop) {
        if (data.forceStop && document.getElementById('mvd-parser-widget')) {
            updateWidget(0, 1, "ОСТАНОВЛЕНО", "Остановлено пользователем", "СТОП");
            playSound('error');
        }
        return;
    }

    if (data.appSettings) appSettings = { ...appSettings, ...data.appSettings };
    createWidget(data.ovd);

    let idx = data.currentStageIndex;

    // --- РОУТИНГ (АВТОРИЗАЦИЯ -> ВЫБОР ОКНА) ---

    // 1. Страница авторизации
    if (document.getElementById('signin-page')) {
        updateWidget(0, STAGES.length, "Авторизация", "Ожидание...");
        setTimeout(() => {
            const auth = data.authData || {};
            let emailField = document.getElementById('user_email');
            let passField = document.getElementById('user_password');
            let btn = document.querySelector('#signin-page button[type="submit"]');

            // Если данные сохранены в расширении - вставляем их
            if (auth.email && auth.password) {
                if (emailField) emailField.value = auth.email;
                if (passField) passField.value = auth.password;
                updateWidget(0, STAGES.length, "Авторизация", "Вход...");
                
                setTimeout(() => {
                    clickWithVisualFeedback(btn);
                }, 500); 
            } 
            // Иначе, если браузер сам подставил данные
            else if (emailField && passField && emailField.value.trim() !== '') {
                updateWidget(0, STAGES.length, "Авторизация", "Вход...");
                clickWithVisualFeedback(btn);
            } 
            // Если пусто - ждем ручного ввода
            else {
                updateWidget(0, STAGES.length, "Авторизация", "Внимание!", "Заполните данные в настройках расширения");
            }
        }, 1000); 
        return;
    }

    // 2. Страница выбора "АРМ администратора"
    if (document.getElementById('select-counter-page')) {
        updateWidget(0, STAGES.length, "Выбор окна", "Выбираем АРМ...");
        setTimeout(() => {
            let armBtn = document.querySelector('a[data-counter-id="admin"]');
            let selectBtn = document.getElementById('select_counter');
            
            if (armBtn && selectBtn) {
                // Сначала кликаем АРМ, потом кнопку Выбрать
                clickWithVisualFeedback(armBtn, () => {
                    setTimeout(() => {
                        clickWithVisualFeedback(selectBtn);
                    }, 400);
                });
            }
        }, 1000);
        return;
    }

    // --- ОСНОВНОЙ ПАРСЕР ТАБЛИЦ (Индексы 0 - 20) ---

    let allData = data.allData || {};
    let pG1 = data.passportGroup1 || 0;
    let pTotal = data.passportTotal || 0;

    if (idx > 0 && idx <= STAGES.length) {
        const prevStage = STAGES[idx - 1];
        let val = parseResultFromDOM();

        if (prevStage.search === "Получение внутреннего паспорта (Группа 1)") pG1 = val;
        if (prevStage.search === "Получение внутреннего паспорта (Группа 2)") {
            pTotal = val;
            val = Math.max(0, pTotal - pG1);
        }

        if (!allData[data.ovd]) allData[data.ovd] = {};
        allData[data.ovd][prevStage.report] = val;
        
        await chrome.storage.local.set({ allData, passportGroup1: pG1, passportTotal: pTotal });
        updateWidget(idx, STAGES.length, prevStage.report, val);
    }

    if (idx >= STAGES.length) {
        if (appSettings.autoDownload) {
            chrome.runtime.sendMessage({ action: "autoDownloadCSV" });
            updateWidget(idx, STAGES.length, "ГОТОВО!", "Отправлено на скачивание");
        } else {
            updateWidget(idx, STAGES.length, "ГОТОВО!", "Ожидает действий");
        }
        
        // ВЕРНУЛ НА 0:
        await chrome.storage.local.set({ running: false, currentStageIndex: 0 });
        playSound('success');
        return;
    }

    const stage = STAGES[idx];
    updateWidget(idx + 1, STAGES.length, stage.report, "...", "Настройка фильтров...");

    try {
        await step1_FillDates(data.startDate, data.endDate);
        await step2_ResetFilters();
        await step3_BaseFilters();
        const found = await step4_SelectService(stage);

        await chrome.storage.local.set({ currentStageIndex: idx + 1 });
        await sleep(500);

        if (found) {
            const btn = document.querySelector(SELECTORS.submitBtn);
            if (btn) {
                // Визуальный клик по кнопке поиска/применения фильтров
                clickWithVisualFeedback(btn);
            } else {
                window.location.reload();
            }
        } else {
            window.location.reload();
        }
    } catch (e) {
        await chrome.storage.local.set({ currentStageIndex: idx + 1 });
        window.location.reload();
    }
});

async function step1_FillDates(s, e) {
    const sd = document.querySelector(SELECTORS.dateStart), ed = document.querySelector(SELECTORS.dateEnd);
    if (sd) { sd.value = s; sd.dispatchEvent(new Event('change', { bubbles: true })); }
    if (ed) { ed.value = e; ed.dispatchEvent(new Event('change', { bubbles: true })); }
}
async function step2_ResetFilters() {
    document.querySelectorAll(SELECTORS.checkedFilters).forEach(cb => cb.click());
    await sleep(200);
}
async function step3_BaseFilters() {
    const e = document.querySelector(SELECTORS.filterEpgu), r = document.querySelector(SELECTORS.filterReady);
    if (e && !e.checked) e.click(); if (r && !r.checked) r.click();
}
async function step4_SelectService(stage) {
    const isG1 = stage.search === "Получение внутреннего паспорта (Группа 1)", isG2 = stage.search === "Получение внутреннего паспорта (Группа 2)";
    const labels = document.querySelectorAll(SELECTORS.labels);
    if (isG1 || isG2) {
        let container = null;
        for (let lbl of labels) { if (lbl.textContent.includes("Получение внутреннего паспорта")) { container = lbl.closest(SELECTORS.treeSection) || lbl.parentElement; const plus = container.querySelector(SELECTORS.plusIcon); if (plus) { plus.click(); await sleep(400); } break; } }
        if (!container) return false;
        container.querySelectorAll(SELECTORS.checkbox).forEach(cb => {
            const text = cb.parentElement.textContent.toLowerCase(); if (text.includes("получение внутреннего паспорта")) return;
            const isKw = GROUP_1_KEYWORDS.some(k => text.includes(k));
            if ((isG1 && isKw) || isG2) { cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true })); }
        }); return true;
    }
    for (let lbl of labels) { if (lbl.textContent.trim().includes(stage.search)) { const cb = lbl.querySelector(SELECTORS.checkbox); if (cb) { cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true })); return true; } } }
    return false;
}