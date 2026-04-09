export function initMonitor() {
    if (window.monitorInitialized) {
        if (window.monitorResize) {
            window.monitorResize();
        }
        return;
    }
    window.monitorInitialized = true;

    // Load ECharts internally to ensure it's available
    if (typeof echarts === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/echarts@5.5.0/dist/echarts.min.js';
        script.onload = () => startMonitorApp();
        document.head.appendChild(script);
    } else {
        startMonitorApp();
    }
}

async function startMonitorApp() {
    let myChart = null;
    let topData = null; 

    const TIMER_MS = 20000;         
    const formatNumber = (num) => new Intl.NumberFormat('es-MX').format(num);

    try {
        const chartDom = document.getElementById('monitor-chart-container');
        if (!chartDom) return;
        
        // ECharts needs absolute sizes if flex is giving issues
        chartDom.style.height = '100%';
        myChart = echarts.init(chartDom);

        // Clic en la barra arroja al usuario hacia el formulario pre-seleccionado
        myChart.on('click', function (params) {
            if (topData && topData[params.dataIndex]) {
                const item = topData[params.dataIndex];
                if (item.troquelId) {
                    const event = new CustomEvent('qr:open-troquel', { detail: { troquelId: item.troquelId } });
                    document.dispatchEvent(event);
                }
            }
        });

        async function updateData() {
            try {
                const response = await fetch('/api/monitor/datos');
                if (!response.ok) throw new Error('Error al contactar al backend');
                const rawData = await response.json();
                topData = [...rawData].slice(0, 10).reverse();

                // 4. Actualizar el Gráfico Directamente
                myChart.setOption({
                    grid: { left: '2%', right: '12%', bottom: '1%', top: '2%', containLabel: true },
                    xAxis: { type: 'value', max: 100, splitLine: { show: false }, axisLabel: { show: false }, axisTick: { show: false }, axisLine: { show: false } },
                    yAxis: {
                        type: 'category',
                        data: topData.map(d => d.id),
                        axisLine: { show: false }, axisTick: { show: false },
                        axisLabel: { color: '#555', fontFamily: 'Segoe UI', fontWeight: 600, fontSize: 18, margin: 15 }
                    },
                    series: [{
                        type: 'bar',
                        barWidth: '40%',
                        showBackground: true,
                        backgroundStyle: { color: '#e9ecef', borderRadius: 6 },
                        data: topData.map((d) => {
                            let baseColor = '#343a40';

                            if (d.percentage >= 100) {
                                baseColor = '#fa5252';
                            } else if (d.percentage >= 80) {
                                baseColor = '#fd7e14';
                            }

                            return {
                                value: d.percentage,
                                itemStyle: {
                                    color: baseColor,
                                    opacity: 1, // <-- TODAS normales, sin enfocar
                                    borderRadius: 6
                                },
                                label: {
                                    show: true,
                                    position: 'right', 
                                    distance: 8,
                                    formatter: (params) => Math.round(params.value) + '%',
                                    color: baseColor,
                                    fontSize: 16,
                                    fontWeight: 800
                                }
                            };
                        }),
                        markLine: {
                            symbol: 'none',
                            data: [{ xAxis: 85 }],
                            lineStyle: { color: 'rgba(255, 82, 82, 0.4)', type: 'solid', width: 2 },
                            label: { show: false }
                        }
                    }]
                });
            } catch (error) {
                console.error("Hubo un fallo cargando el monitor dinámico:", error);
                if (document.getElementById('monitor-card-title')) {
                    document.getElementById('monitor-card-title').innerText = "Sistema";
                    document.getElementById('monitor-card-material').innerText = "Fallo de comunicación DB";
                }
            }
        }

        // Carga Inicial
        await updateData();

        // 5. Automatización y Refresco en tiempo real
        // Auto-poling como "seguro" extra si se deja abierta en background
        setInterval(updateData, 30000); 

        // Listener crítico: Reacciona al instante exacto en que cierran un mantenimiento localmente
        document.addEventListener('mantenimiento:finalizado', updateData);

        window.monitorResize = () => {
            if (myChart) {
                myChart.resize();
            }
        };

        window.addEventListener('resize', window.monitorResize);

    } catch (error) {
        console.error("Hubo un fallo cargando el monitor dinámico:", error);
        if (document.getElementById('monitor-card-title')) {
            document.getElementById('monitor-card-title').innerText = "Sistema";
            document.getElementById('monitor-card-material').innerText = "Fallo de comunicación DB";
        }
    }
}
