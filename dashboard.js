const CSV_URL = './epp.csv';
// Español / 中文简体
const tiposEntregaList = [
    'ENTREGA NUEVO / 新发放',
    'CAMBIO / 更换',
    'EXTRAVIO / 丢失',
    'EPP RECUPERADO / 回收劳保'
];
let datos = [];
let charts = {};

window.onload = function () {
    fetch(CSV_URL + '?cachebust=' + Date.now())
        .then(r => r.text())
        .then(csv => {
            datos = csvToJson(csv);
            llenarFiltros();
            dibujarGraficos();
        })
        .catch(() => {
            document.body.innerHTML += '<div style="color:red; font-size:1.1em; text-align:center; margin-top:18px;">No se pudo cargar el archivo epp.csv.<br>Verifica que exista en tu carpeta y que el archivo sea accesible.<br>Abre este dashboard SIEMPRE desde un servidor web (Live Server, Python, IIS, etc) y nunca como file://<br>无法加载epp.csv文件，请确保文件存在于当前目录且可访问。请务必通过Web服务器方式打开本页面。</div>';
        });
    document.getElementById('desdeFilter').addEventListener('change', dibujarGraficos);
    document.getElementById('hastaFilter').addEventListener('change', dibujarGraficos);
};

function csvToJson(csv) {
    const lines = csv.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    return lines.slice(1).map(line => {
        let cells = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"' && line[i + 1] === '"') { current += '"'; i++; }
            else if (char === '"') inQuotes = !inQuotes;
            else if (char === ',' && !inQuotes) { cells.push(current); current = ''; }
            else current += char;
        }
        cells.push(current);
        let obj = {};
        headers.forEach((h, i) => obj[h] = (cells[i] !== undefined && cells[i] !== '' ? cells[i].trim() : ''));
        return obj;
    });
}

function llenarFiltros() {
    const areaSel = document.getElementById('areaFilter');
    const descSel = document.getElementById('descFilter');
    areaSel.innerHTML = '<option value="">Todas / 全部</option>';
    descSel.innerHTML = '<option value="">Todas / 全部</option>';
    for (const area of [...new Set(datos.map(d => d.AREA).filter(x => x))].sort())
        areaSel.innerHTML += `<option value="${area}">${area}</option>`;
    for (const desc of [...new Set(datos.map(d => d['DESCRIPCION']).filter(x => x))].sort())
        descSel.innerHTML += `<option value="${desc}">${desc}</option>`;
    areaSel.onchange = dibujarGraficos;
    descSel.onchange = dibujarGraficos;

    const tipoEntregaSel = document.getElementById('tipoEntregaFilter');
    tipoEntregaSel.innerHTML = '<option value="">Todos / 全部</option>';
    for (const tipo of tiposEntregaList)
        tipoEntregaSel.innerHTML += `<option value="${tipo}">${tipo}</option>`;
    tipoEntregaSel.onchange = dibujarGraficos;
}

function resetFiltros() {
    document.getElementById('areaFilter').value = '';
    document.getElementById('descFilter').value = '';
    document.getElementById('tipoEntregaFilter').value = '';
    document.getElementById('desdeFilter').value = '';
    document.getElementById('hastaFilter').value = '';
    dibujarGraficos();
}

function filtrarDatos() {
    const area = document.getElementById('areaFilter').value;
    const desc = document.getElementById('descFilter').value;
    const tipoEntrega = document.getElementById('tipoEntregaFilter').value;
    const desde = document.getElementById('desdeFilter').value;
    const hasta = document.getElementById('hastaFilter').value;
    return datos.filter(d => {
        let ok = true;
        if (area && d.AREA !== area) ok = false;
        if (desc && d['DESCRIPCION'] !== desc) ok = false;
        // Soporta ambas etiquetas en español/chino
        if (tipoEntrega && !(parseInt(d[tipoEntrega.split(' / ')[0]]) > 0 || parseInt(d[tipoEntrega.split(' / ')[1]]) > 0)) ok = false;
        if (desde && d.FECHA && dateToISO(d.FECHA) < desde) ok = false;
        if (hasta && d.FECHA && dateToISO(d.FECHA) > hasta) ok = false;
        return ok;
    });
}

function dateToISO(fecha) {
    if (!fecha) return '';
    if (fecha.includes('/')) {
        const [d, m, y] = fecha.split('/');
        return `${y.padStart(4, '0')}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    if (fecha.includes('-')) { return fecha; }
    return '';
}

function obtenerGastoFila(d) {
    return (parseFloat(d['TOTAL COSTOS']) || 0);
}

function mostrarKPIs(filtrados, porEpp, entregasPorTipo) {
    const totalEntregas = filtrados.reduce((acc, d) => acc + (parseFloat(d['CANTIDAD']) || 0), 0);
    const totalGasto = filtrados.reduce((acc, d) => acc + obtenerGastoFila(d), 0);
    const tiposEPP = new Set(filtrados.map(d => d['DESCRIPCION'])).size;
    const topEpp = Object.entries(porEpp).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';
    const tipoEntregaTop = Object.entries(entregasPorTipo).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

    // Área que más consumió
    const normalizaArea = s => (s || 'Sin dato')
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();

    let areaConsumo = {};
    filtrados.forEach(d => {
        let key = normalizaArea(d['AREA']);
        areaConsumo[key] = (areaConsumo[key] || 0) + (parseFloat(d['CANTIDAD']) || 0);
    });
    let areaTop = Object.entries(areaConsumo)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

    document.getElementById('kpiTotalEntregas').innerText = totalEntregas;
    document.getElementById('kpiTotalGasto').innerText = '$' + totalGasto.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
    document.getElementById('kpiTiposEPP').innerText = tiposEPP;
    document.getElementById('kpiTopEPP').innerText = topEpp;
    document.getElementById('kpiTopEPP').previousElementSibling.innerText = "EPP con más flujo / 流通最多劳保";
    document.getElementById('kpiTipoEntregaTop').innerText = tipoEntregaTop;
    document.getElementById('kpiAreaTop').innerText = areaTop;
    document.getElementById('kpiAreaTop').previousElementSibling.innerText = "Área que más consumió / 消耗最多区域";
}

function dibujarGraficos() {
    const filtrados = filtrarDatos();

    // Gasto total mensual
    let gastoMes = {};
    filtrados.forEach(d => {
        let mes = dateToISO(d['FECHA']) ? dateToISO(d['FECHA']).substring(0, 7) : 'Sin dato / 无数据';
        let gasto = obtenerGastoFila(d);
        gastoMes[mes] = (gastoMes[mes] || 0) + gasto;
    });
    let mesesGasto = Object.keys(gastoMes).sort();
    graficar(
        'gastoMesChart',
        'line',
        mesesGasto,
        mesesGasto.map(m => gastoMes[m]),
        'Gasto total mensual / 每月总支出',
        '#005a9e',
        undefined,
        true,
        { height: 400 }
    );

    // Evolución mensual por tipo de entrega
    let mesesSet = new Set();
    let dataEvolucion = {};
    tiposEntregaList.forEach(tipo => dataEvolucion[tipo] = {});
    filtrados.forEach(d => {
        let mes = dateToISO(d['FECHA']) ? dateToISO(d['FECHA']).substring(0, 7) : 'Sin dato / 无数据';
        mesesSet.add(mes);
        tiposEntregaList.forEach(tipo => {
            let key = tipo.split(' / ')[0];
            let keyCN = tipo.split(' / ')[1];
            let val = parseFloat(d[key]) || parseFloat(d[keyCN]);
            if (!isNaN(val) && val > 0) dataEvolucion[tipo][mes] = (dataEvolucion[tipo][mes] || 0) + val;
        });
    });
    let meses = Array.from(mesesSet).sort();
    let datasetsEvolucion = tiposEntregaList.map((tipo, i) => ({
        label: tipo,
        data: meses.map(m => dataEvolucion[tipo][m] || 0),
        borderColor: ['#3b82f6', '#fbbf24', '#ef4444', '#10b981'][i],
        backgroundColor: ['#3b82f6', '#fbbf24', '#ef4444', '#10b981'][i],
        fill: false,
        tension: .25
    }));
    if (charts['evolucionTipoEntregaChart']) charts['evolucionTipoEntregaChart'].destroy();
    charts['evolucionTipoEntregaChart'] = new Chart(document.getElementById('evolucionTipoEntregaChart'), {
        type: 'line',
        data: { labels: meses, datasets: datasetsEvolucion },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: true, position: 'bottom', labels: { font: { size: 11 } } } },
            scales: { y: { beginAtZero: true, ticks: { font: { size: 10 } } }, x: { ticks: { font: { size: 10 } } } }
        }
    });

    // Top 5 EPP más usados/cambiados (cantidad total)
    const TOP_EPP = 5;
    let usoPorEpp = {};
    filtrados.forEach(d => {
        let key = d['DESCRIPCION'] || 'Sin dato / 无数据';
        let totalUso = 0;
        tiposEntregaList.forEach(tipo => {
            let k = tipo.split(' / ')[0];
            let kcn = tipo.split(' / ')[1];
            let val = parseFloat(d[k]) || parseFloat(d[kcn]);
            if (!isNaN(val) && val > 0) totalUso += val;
        });
        usoPorEpp[key] = (usoPorEpp[key] || 0) + totalUso;
    });
    let topEppArr = Object.entries(usoPorEpp)
        .sort((a, b) => b[1] - a[1])
        .slice(0, TOP_EPP);
    let eppLabels = topEppArr.map(e => e[0]);
    let eppData = topEppArr.map(e => e[1]);
    graficar(
        'eppMasUsadosChart',
        'bar',
        eppLabels,
        eppData,
        'Top 5 EPP más usados/cambiados / 最常用/更换前五劳保',
        '#36a2eb',
        'horizontalBar',
        false,
        { fontSize: 13, height: 300 }
    );

    // ----------- GRAFICA COMPARATIVA GASTO VS CANTIDAD POR ÁREA (Áreas en X, valores en Y) -----------
    const normalizaArea = s => (s || 'Sin dato / 无数据')
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();

    let gastoPorArea = {}, cantidadPorArea = {};
    filtrados.forEach(d => {
        let area = normalizaArea(d['AREA']);
        gastoPorArea[area] = (gastoPorArea[area] || 0) + obtenerGastoFila(d);
        cantidadPorArea[area] = (cantidadPorArea[area] || 0) + (parseFloat(d['CANTIDAD']) || 0);
    });

    let areaLabels = Object.keys(gastoPorArea)
        .sort((a, b) => gastoPorArea[b] - gastoPorArea[a]);
    let gastoData = areaLabels.map(a => gastoPorArea[a]);
    let cantidadData = areaLabels.map(a => cantidadPorArea[a]);

    // Normaliza
    const maxGasto = Math.max(...gastoData) || 1;
    const maxCantidad = Math.max(...cantidadData) || 1;
    let gastoDataNorm = gastoData.map(v => (v / maxGasto) * 100);
    let cantidadDataNorm = cantidadData.map(v => (v / maxCantidad) * 100);

    if (charts['gastoVsCantidadAreaChart']) charts['gastoVsCantidadAreaChart'].destroy();

    charts['gastoVsCantidadAreaChart'] = new Chart(document.getElementById('gastoVsCantidadAreaChart'), {
        type: 'bar',
        data: {
            labels: areaLabels,
            datasets: [
                {
                    label: 'Gasto (%) / 支出 (%)',
                    data: gastoDataNorm,
                    backgroundColor: 'rgba(76, 175, 80, 0.85)',
                    borderColor: '#388e3c',
                    borderWidth: 1,
                    datalabels: {
                        anchor: 'end',
                        align: 'top',
                        color: '#388e3c',
                        font: { size: 11, weight: 'bold' },
                        formatter: (v, ctx) => {
                            const real = gastoData[ctx.dataIndex];
                            return `$${real.toLocaleString(undefined, {maximumFractionDigits:0})}`;
                        }
                    }
                },
                {
                    label: 'Cantidad (%) / 数量 (%)',
                    data: cantidadDataNorm,
                    backgroundColor: 'rgba(33, 150, 243, 0.80)',
                    borderColor: '#1565c0',
                    borderWidth: 1,
                    datalabels: {
                        anchor: 'end',
                        align: 'bottom',
                        color: '#1565c0',
                        font: { size: 11, weight: 'bold' },
                        formatter: (v, ctx) => {
                            const real = cantidadData[ctx.dataIndex];
                            return `${real.toLocaleString()}`;
                        }
                    }
                }
            ]
        },
        options: {
            indexAxis: 'x',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top', labels: { font: { size: 13 } } },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let idx = context.dataIndex;
                            if (context.dataset.label.includes('Gasto')) {
                                return `Gasto / 支出: $${gastoData[idx].toLocaleString(undefined,{maximumFractionDigits:2})} (${context.parsed.y.toFixed(1)}%)`;
                            } else {
                                return `Cantidad / 数量: ${cantidadData[idx].toLocaleString()} (${context.parsed.y.toFixed(1)}%)`;
                            }
                        }
                    }
                },
                datalabels: { display: true }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: {
                        font: { size: 11 },
                        autoSkip: false,
                        maxRotation: 38,
                        minRotation: 12,
                    }
                },
                y: {
                    beginAtZero: true,
                    max: 105,
                    title: {
                        display: true,
                        text: 'Porcentaje sobre el máximo de cada métrica (%) / 各指标最大值百分比',
                        font: { size: 13 }
                    },
                    ticks: { font: { size: 11 }, stepSize: 20 },
                    grid: { display: true }
                }
            }
        },
        plugins: [ChartDataLabels]
    });
    // ----------- FIN GRAFICA -----------

    // KPIs y alertas
    let porEpp = {};
    filtrados.forEach(d => {
        let key = d['DESCRIPCION'] || 'Sin dato / 无数据';
        let cantidad = parseFloat(d['CANTIDAD']) || 0;
        porEpp[key] = (porEpp[key] || 0) + cantidad;
    });
    let entregasPorTipo = {};
    tiposEntregaList.forEach(tipo => entregasPorTipo[tipo] = 0);
    filtrados.forEach(d => {
        tiposEntregaList.forEach(tipo => {
            let k = tipo.split(' / ')[0];
            let kcn = tipo.split(' / ')[1];
            let val = parseFloat(d[k]) || parseFloat(d[kcn]);
            if (!isNaN(val) && val > 0) entregasPorTipo[tipo] += val;
        });
    });

    mostrarKPIs(filtrados, porEpp, entregasPorTipo);
    mostrarAlertas(filtrados);
    mostrarNombres(filtrados);
}
// Mostrar lista de nombres que recibieron EPP y tipo de entrega
function mostrarNombres(filtrados) {
    if (!filtrados.length) {
        document.getElementById('tablaNombres').innerHTML = "<span style='color:#888;'>No hay entregas en el periodo seleccionado.<br>选定期间无发放记录。</span>";
        return;
    }
    // Detectar la columna real de nombre (soporta NOMBRE, NOMBRE ENTRE, etc)
    function obtenerCampoNombre(obj) {
        for (let key of Object.keys(obj)) {
            // acepta "nombre", "nombre entre", etc., sin mayúsculas ni espacios
            if (key.trim().toLowerCase().replace(/\s+/g, '') === 'nombreentre') return key;
        }
        // fallback: busca la palabra 'nombre' en el campo
        for (let key of Object.keys(obj)) {
            if (key.trim().toLowerCase().includes('nombre')) return key;
        }
        return null;
    }
    const campoNombre = obtenerCampoNombre(filtrados[0]);
    if (!campoNombre) {
        document.getElementById('tablaNombres').innerHTML = "<span style='color:#e00;'>No se encontró la columna NOMBRE ENTRE.<br>未找到“NOMBRE ENTRE”列。</span>";
        return;
    }
    // Agrupar: nombre => [{tipoEntrega, cantidad, fecha, descripcion, area}]
    let personas = {};
    filtrados.forEach(d => {
        let nombre = (d[campoNombre] || '').trim();
        if (!nombre) return;
        tiposEntregaList.forEach(tipo => {
            let [tipoES, tipoCN] = tipo.split(' / ');
            let cantidad = parseFloat(d[tipoES]) || parseFloat(d[tipoCN]) || 0;
            if (cantidad > 0) {
                if (!personas[nombre]) personas[nombre] = [];
                personas[nombre].push({
                    tipo: tipo,
                    cantidad: cantidad,
                    fecha: d['FECHA'] || '',
                    descripcion: d['DESCRIPCION'] || '',
                    area: d['AREA'] || ''
                });
            }
        });
    });
    let nombresUnicos = Object.keys(personas).sort((a, b) => a.localeCompare(b, 'es', {sensitivity:'base'}));
    if (nombresUnicos.length === 0) {
        document.getElementById('tablaNombres').innerHTML = "<span style='color:#888;'>No hay entregas en el periodo seleccionado.<br>选定期间无发放记录。</span>";
        return;
    }
    let html = `<table style="border-collapse:collapse;width:100%;font-size:1em;">
        <thead>
            <tr style="background:#e8fbe9;">
                <th style="padding:6px 10px;">Nombre / 姓名</th>
                <th style="padding:6px 10px;">Tipo de Entrega / 发放类型</th>
                <th style="padding:6px 10px;">Cantidad / 数量</th>
                <th style="padding:6px 10px;">Descripción / 描述</th>
                <th style="padding:6px 10px;">Área / 区域</th>
                <th style="padding:6px 10px;">Fecha / 日期</th>
            </tr>
        </thead>
        <tbody>`;
    nombresUnicos.forEach(nombre => {
        personas[nombre].forEach(entrega => {
            html += `<tr>
                <td style="border-bottom:1px solid #e0f0e2;padding:6px 10px;">${nombre}</td>
                <td style="border-bottom:1px solid #e0f0e2;padding:6px 10px;">${entrega.tipo}</td>
                <td style="border-bottom:1px solid #e0f0e2;padding:6px 10px;">${entrega.cantidad}</td>
                <td style="border-bottom:1px solid #e0f0e2;padding:6px 10px;">${entrega.descripcion}</td>
                <td style="border-bottom:1px solid #e0f0e2;padding:6px 10px;">${entrega.area}</td>
                <td style="border-bottom:1px solid #e0f0e2;padding:6px 10px;">${entrega.fecha}</td>
            </tr>`;
        });
    });
    html += "</tbody></table>";
    document.getElementById('tablaNombres').innerHTML = html;
}


function graficar(id, tipo, labels, data, titulo, color, tipoForzado, showValues, extraOptions = {}) {
    if (charts[id]) charts[id].destroy();
    let chartType = tipo || 'bar';
    let indexAxis = undefined;
    if (tipoForzado === 'horizontalBar') {
        chartType = 'bar';
        indexAxis = 'y';
    }
    let opts = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: chartType === 'doughnut' },
            tooltip: {
                callbacks: {
                    label: function (context) {
                        if (showValues) {
                            return `${context.label}: $${context.parsed.y !== undefined ? context.parsed.y.toLocaleString() : context.parsed.x}`;
                        } else {
                            return `${context.label}: ${context.parsed.y !== undefined ? context.parsed.y : context.parsed.x}`;
                        }
                    }
                }
            }
        },
        indexAxis: indexAxis,
        scales: indexAxis ? {
            y: {
                beginAtZero: true,
                ticks: {
                    font: { size: extraOptions.fontSize || 12 },
                    autoSkip: false,
                }
            },
            x: { 
                beginAtZero: true, 
                ticks: { font: { size: extraOptions.fontSize || 12 } }
            }
        } : { 
            x: { 
                ticks: { font: { size: extraOptions.fontSize || 10 }, maxRotation: 38, minRotation: 12 },
                grid: { display: false }
            }, 
            y: { beginAtZero: true, ticks: { font: { size: extraOptions.fontSize || 10 } } }
        }
    };
    charts[id] = new Chart(document.getElementById(id), {
        type: chartType,
        data: {
            labels: labels,
            datasets: [{
                label: titulo,
                data: data,
                backgroundColor: color instanceof Array ? color : Array(data.length).fill(color),
                barPercentage: extraOptions.barPercentage || 0.7,
                categoryPercentage: extraOptions.categoryPercentage || 0.7,
            }]
        },
        options: opts
    });
}

// ALERTAS: SOLO LO QUE MÁS AUMENTÓ, LO QUE MÁS SE EXTRAVIÓ Y LO QUE MÁS SE CAMBIÓ
function mostrarAlertas(filtrados) {
    let alertas = [];

    // 1. LO QUE MÁS AUMENTÓ (por área)
    let areaMes = {};
    filtrados.forEach(d => {
        let area = d['AREA'] || 'Sin dato / 无数据';
        let mes = dateToISO(d['FECHA']) ? dateToISO(d['FECHA']).substring(0, 7) : 'Sin dato / 无数据';
        areaMes[area] = areaMes[area] || {};
        areaMes[area][mes] = (areaMes[area][mes] || 0) + (parseFloat(d['CANTIDAD']) || 0);
    });
    let meses = Object.values(areaMes).reduce((acc, mesObj) => {
        Object.keys(mesObj).forEach(m => acc.add(m));
        return acc;
    }, new Set());
    meses = Array.from(meses).sort();
    const mesActual = meses[meses.length - 1];
    const mesPrevio = meses[meses.length - 2];
    let maxAumento = { area: '', variacion: -Infinity };
    if (mesActual && mesPrevio) {
        Object.entries(areaMes).forEach(([area, mesObj]) => {
            let actual = mesObj[mesActual] || 0;
            let previo = mesObj[mesPrevio] || 0;
            if (previo > 0) {
                let variacion = ((actual - previo) / previo) * 100;
                if (variacion > maxAumento.variacion) {
                    maxAumento = { area, variacion };
                }
            }
        });
    }
    if (maxAumento.area && maxAumento.variacion > 0) {
        alertas.push(`<div class="alerta-row aumento-rojo">El área <b>${maxAumento.area}</b> es la que más aumentó su consumo de EPP este mes (<b>${maxAumento.variacion.toFixed(1)}%</b> más)<br>区域 <b>${maxAumento.area}</b> 本月劳保消耗增幅最大 (<b>${maxAumento.variacion.toFixed(1)}%</b> 增长)</div>`);
    }

    // 2. LO QUE MÁS SE EXTRAVIÓ (por EPP)
    let extraviosPorEPP = {};
    let hoy = new Date();
    let hace3m = new Date(hoy.getFullYear(), hoy.getMonth() - 3, hoy.getDate());
    filtrados.forEach(d => {
        let fecha = dateToISO(d['FECHA']);
        if (!fecha) return;
        let f = new Date(fecha);
        if (f >= hace3m) {
            let epp = d['DESCRIPCION'] || 'Sin dato / 无数据';
            let extravios = parseInt(d['EXTRAVIO']) || 0;
            if (extravios > 0) {
                extraviosPorEPP[epp] = (extraviosPorEPP[epp] || 0) + extravios;
            }
        }
    });
    let maxExtravios = Object.entries(extraviosPorEPP)
        .sort((a, b) => b[1] - a[1])[0];
    if (maxExtravios && maxExtravios[1] > 0) {
        let clase = maxExtravios[1] > 40 ? "alerta-row extravio-rojo"
            : maxExtravios[1] > 15 ? "alerta-row extravio-naranja"
            : "alerta-row extravio-verde";
        alertas.push(`<div class="${clase}">Lo que más se extravió/perdió fue <b>${maxExtravios[0]}</b> (<b>${maxExtravios[1]}</b> en el último trimestre)<br>丢失/遗失最多的是 <b>${maxExtravios[0]}</b>（近三个月共 <b>${maxExtravios[1]}</b> 件）</div>`);
    }

    // 3. LO QUE MÁS SE CAMBIÓ (por EPP)
    let cambioPorEPP = {};
    filtrados.forEach(d => {
        let epp = d['DESCRIPCION'] || 'Sin dato / 无数据';
        let cambio = parseInt(d['CAMBIO']) || 0;
        if (cambio > 0) cambioPorEPP[epp] = (cambioPorEPP[epp] || 0) + cambio;
    });
    let maxCambio = Object.entries(cambioPorEPP)
        .sort((a, b) => b[1] - a[1])[0];
    if (maxCambio && maxCambio[1] > 0) {
        alertas.push(`<div class="alerta-row aumento-naranja">Lo que más se cambió fue <b>${maxCambio[0]}</b> (<b>${maxCambio[1]}</b> cambios)<br>更换最多的是 <b>${maxCambio[0]}</b>（共 <b>${maxCambio[1]}</b> 次）</div>`);
    }

    document.getElementById('alertas').innerHTML = alertas.length ? alertas.join("") : "<div style='color:#888;'>Sin alertas relevantes. / 暂无相关预警。</div>";
}
