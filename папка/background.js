const OVD_ORDER = ["Железнодорожный", "Дзержинский", "Заельцовский", "Калининский", "Кировский", "Ленинский", "Октябрьский", "Первомайский", "Советский", "Центральный", "Бердск", "Искитим", "Новосибирский", "Есенина 1", "Есенина 2", "УВМ"];
// Здесь поменяны местами ОЗПЭ и ОЗП10, а также убрана цифра 14 из названия паспортов
const T1_COLS = [{ key: "гр-во, ССР, утрата", title: "гр-во, ССР, утрата" }, { key: "РП 14,20,45, фамилия", title: "РП 20,45, фам..." }, { key: "РУ", title: "РУ" }, { key: "озпэ", title: "ОЗПЭ" }, { key: "ОЗП10", title: "ОЗП" }, { key: "Адресная справка", title: "АСР" }];

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "autoDownloadCSV") {
        chrome.storage.local.get(['allData', 'startDate', 'endDate'], (data) => {
            const allData = data.allData || {};
            const endD = data.endDate || new Date().toISOString().split('T')[0];
            
            if (Object.keys(allData).length === 0) return;

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

            buildCsvTable(T1_COLS);
            csvRows.push("Рассчёт РП ОМУ %;То что написано красным - не трогать, меняешь только чёрный текст;;;;;\n191;6.3772955;14 лет;;;;\n2804;93.622705;20-45 лет;;;;\n2995;100;сумма;;;;\nРП по ОМУ;478;Сколько РП по ому напиши слева, остальное посчитает само;;;;\n% от СУЭО на ОМУ;;;;;;\n30.48347245;14 лет;30;;;;\n447.5165275;20-45 лет;448;;;;");

            // Конвертация в Base64 для поддержки кириллицы в Manifest V3
            const utf8Bytes = unescape(encodeURIComponent("\uFEFF" + csvRows.join("\n")));
            const base64 = btoa(utf8Bytes);
            const dataUrl = "data:text/csv;base64," + base64;

            chrome.downloads.download({ url: dataUrl, filename: `MVD_Stats_${endD}_AUTO.csv`, saveAs: false });
        });
    }
});