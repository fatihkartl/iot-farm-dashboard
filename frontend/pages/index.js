import { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import { Line, Bar } from "react-chartjs-2";
import Chart from "chart.js/auto";
import { io } from "socket.io-client";

const SENSOR_LIST = ["sensor-A", "sensor-B", "sensor-C"];
const LIMIT_OPTIONS = [50, 100, 200];

function getWsBase() {
  if (typeof window === "undefined") return "";
  const host = window.location.hostname;
  const isHttps = window.location.protocol === "https:";
  const scheme = isHttps ? "https" : "http";
  return `${scheme}://${host}:8080`;
}

export default function Home() {
  const [sensorId, setSensorId] = useState(SENSOR_LIST[0]);
  const [limit, setLimit] = useState(LIMIT_OPTIONS[0]);
  const [rows, setRows] = useState([]);
  const [wsReady, setWsReady] = useState(false);

  // Analiz modalı (Aylık/Günlük/Gün içi) state'leri
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [monthly, setMonthly] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [daily, setDaily] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null);
  const [dayDetail, setDayDetail] = useState([]);

  // --- Geçmiş veriyi çek (limitli)
  useEffect(() => {
    let alive = true;
    const fetchData = async () => {
      try {
        const res = await fetch(
          `/api/history?deviceId=${encodeURIComponent(sensorId)}&limit=${limit}`
        );
        const json = await res.json();
        if (alive) setRows(json || []);
      } catch (e) {
        console.error("history fetch error:", e);
      }
    };
    fetchData();
    let id;
    if (!wsReady) id = setInterval(fetchData, 3000);
    return () => { alive = false; if (id) clearInterval(id); };
  }, [sensorId, limit, wsReady]);

  // --- Canlı WebSocket
  useEffect(() => {
    const wsBase = getWsBase();
    const socket = io(wsBase, {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      withCredentials: false,
    });

    socket.on("connect", () => setWsReady(true));
    socket.on("disconnect", () => setWsReady(false));
    socket.on("connect_error", () => setWsReady(false));

    socket.on("sensor:data", (msg) => {
      if (!msg || msg.deviceId !== sensorId) return;
      setRows((prev) => {
        const next = [...prev, msg];
        if (next.length > limit) next.shift();
        return next;
      });
    });

    return () => {
      socket.off("sensor:data");
      socket.disconnect();
    };
  }, [sensorId, limit]);

  // --- Analiz modalı açıldığında verileri getir
  useEffect(() => {
    if (!analysisOpen) return;
    fetch(`/api/history/monthly?deviceId=${sensorId}`)
      .then(r => r.json()).then(setMonthly).catch(() => setMonthly([]));
    setSelectedMonth(null);
    setDaily([]);
    setSelectedDay(null);
    setDayDetail([]);
  }, [analysisOpen, sensorId]);

  useEffect(() => {
    if (!analysisOpen || !selectedMonth) return;
    const [year, month] = selectedMonth.split("-");
    fetch(`/api/history/daily?deviceId=${sensorId}&year=${year}&month=${month}`)
      .then(r => r.json()).then(setDaily).catch(() => setDaily([]));
    setSelectedDay(null);
    setDayDetail([]);
  }, [analysisOpen, selectedMonth, sensorId]);

  const openDay = (date) => {
    const [year, month, day] = date.split("-");
    fetch(`/api/history/day?deviceId=${sensorId}&year=${year}&month=${month}&day=${day}`)
      .then(r => r.json()).then(setDayDetail).catch(() => setDayDetail([]));
    setSelectedDay(date);
  };

  // --- Anlık grafik serileri
  const labels = useMemo(
    () => rows.map(r => new Date(r.ts).toLocaleTimeString("tr-TR", { hour12: false })),
    [rows]
  );
  const series = useMemo(() => ({
    temperature: rows.map(r => r.temperature ?? null),
    humidity: rows.map(r => r.humidity ?? null),
    ph: rows.map(r => r.ph ?? null),
    soilMoisture: rows.map(r => r.soilMoisture ?? r.soil_moisture ?? null),
  }), [rows]);

  const stats = useMemo(() => {
    const safe = arr => arr.filter(v => typeof v === "number");
    const mm = arr => safe(arr).length
      ? { min: Math.min(...safe(arr)), max: Math.max(...safe(arr)), last: safe(arr)[safe(arr).length-1] }
      : { min: "-", max: "-", last: "-" };
    return {
      temperature: mm(series.temperature),
      humidity: mm(series.humidity),
      ph: mm(series.ph),
      soilMoisture: mm(series.soilMoisture),
    };
  }, [series]);

  const baseOpts = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 250 },
    plugins: { legend: { display: false } },
    scales: {
      x: { display: false, grid: { display: false } },
      y: {
        ticks: { color: "#9aa3b2", font: { size: 13 } },
        grid: { color: "rgba(255,255,255,.06)" },
      },
    },
  };

  // --- Aylık & Günlük bar chart dataset üreticileri
  const monthlyLabels = monthly.map(m => m.month?.slice(0, 7) ?? "??");
  const monthlyData = (key) => ({
    labels: monthlyLabels,
    datasets: [{
      label: key,
      data: monthly.map(m => Number(m[key])),
      borderColor: "#F67212",
      backgroundColor: "#FFA72655",
      borderWidth: 2,
      borderRadius: 8,
    }]
  });

  const dailyLabels = daily.map(d => d.day?.slice(0, 10) ?? "??");
  const dailyData = (key) => ({
    labels: dailyLabels,
    datasets: [{
      label: key,
      data: daily.map(d => Number(d[key])),
      borderColor: "#198754",
      backgroundColor: "#1DE9B655",
      borderWidth: 2,
      borderRadius: 7,
    }]
  });

  // --- Gün içi modal grafiği
  const dayDetailLabels = dayDetail.map(d => new Date(d.ts).toLocaleTimeString("tr-TR", { hour12:false }));
  const dayDetailData = {
    labels: dayDetailLabels,
    datasets: [{
      data: dayDetail.map(d => d.temperature ?? null),
      label: "Sıcaklık",
      borderColor: "#ff6384",
      backgroundColor: "#ff638455",
      tension: .25,
    }]
  };

  return (
    <>
      <Head>
        <title>Tarla Sensör Dashboard</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </Head>

      <div className="dashboard">
        <div className="topbar">
          <div className="title">
            🌱 Tarla Sensör Dashboard {wsReady ? "• Canlı" : "• Bekliyor"}
          </div>
          <div className="controls">
            <span style={{ color:"#9aa3b2", fontSize:15 }}>Sensör:</span>
            <select className="select" value={sensorId} onChange={e => setSensorId(e.target.value)}>
              {SENSOR_LIST.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <span style={{ marginLeft: 16, color:"#9aa3b2", fontSize:15 }}>Kayıt Limiti:</span>
            <select className="select" value={limit} onChange={e => setLimit(Number(e.target.value))}>
              {LIMIT_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
            </select>

            {/* Analiz butonu */}
            <button
              className="btn"
              style={{ marginLeft: 16 }}
              onClick={() => setAnalysisOpen(true)}
            >
              📊 Geçmiş Analiz
            </button>
          </div>
        </div>

        {/* 4 kart – tek ekranda, kayma yok */}
        <div className="grid">
          <div className="card">
            <h4 style={{ color: "var(--accent1)" }}>Sıcaklık (°C)</h4>
            <div className="chart">
              <Line data={{
                labels,
                datasets: [{ data: series.temperature, borderColor: "#ff6384", backgroundColor: "#ff638455", tension: .25 }]
              }} options={baseOpts} />
            </div>
            <div className="statrow">
              <div className="badge"><span>MIN</span><b>{stats.temperature.min}</b></div>
              <div className="badge"><span>SON</span><b>{stats.temperature.last}</b></div>
              <div className="badge"><span>MAX</span><b>{stats.temperature.max}</b></div>
            </div>
          </div>

          <div className="card">
            <h4 style={{ color: "var(--accent2)" }}>Nem (%)</h4>
            <div className="chart">
              <Line data={{
                labels,
                datasets: [{ data: series.humidity, borderColor: "#36a2eb", backgroundColor: "#36a2eb55", tension: .25 }]
              }} options={baseOpts} />
            </div>
            <div className="statrow">
              <div className="badge"><span>MIN</span><b>{stats.humidity.min}</b></div>
              <div className="badge"><span>SON</span><b>{stats.humidity.last}</b></div>
              <div className="badge"><span>MAX</span><b>{stats.humidity.max}</b></div>
            </div>
          </div>

          <div className="card">
            <h4 style={{ color: "var(--accent3)" }}>pH</h4>
            <div className="chart">
              <Line data={{
                labels,
                datasets: [{ data: series.ph, borderColor: "#4bc0c0", backgroundColor: "#4bc0c055", tension: .25 }]
              }} options={baseOpts} />
            </div>
            <div className="statrow">
              <div className="badge"><span>MIN</span><b>{stats.ph.min}</b></div>
              <div className="badge"><span>SON</span><b>{stats.ph.last}</b></div>
              <div className="badge"><span>MAX</span><b>{stats.ph.max}</b></div>
            </div>
          </div>

          <div className="card">
            <h4 style={{ color: "var(--accent4)" }}>Toprak Nemi (%)</h4>
            <div className="chart">
              <Line data={{
                labels,
                datasets: [{ data: series.soilMoisture, borderColor: "#f6c244", backgroundColor: "#f6c24455", tension: .25 }]
              }} options={baseOpts} />
            </div>
            <div className="statrow">
              <div className="badge"><span>MIN</span><b>{stats.soilMoisture.min}</b></div>
              <div className="badge"><span>SON</span><b>{stats.soilMoisture.last}</b></div>
              <div className="badge"><span>MAX</span><b>{stats.soilMoisture.max}</b></div>
            </div>
          </div>
        </div>
      </div>

      {/* ==================== ANALİZ MODALI ==================== */}
      {analysisOpen && (
        <div className="modal-bg">
          <div className="modal-card modal-wide">
            <h2 style={{marginTop:0, marginBottom:12}}>📊 Geçmiş Analiz — {sensorId}</h2>

            {/* Aylık ortalama */}
            <div className="bar-container" style={{marginTop:10}}>
              <h3>Aylık Ortalama Sıcaklık (Son 1 Yıl)</h3>
              <div style={{height:220}}>
                <Bar
                  data={monthlyData("temperature")}
                  options={{
                    ...baseOpts,
                    plugins: { legend: { display: false } },
                    onClick: (_, elements) => {
                      if (!elements?.length) return;
                      const monthLabel = monthlyLabels[elements[0].index];
                      setSelectedMonth(monthLabel);
                    }
                  }}
                />
              </div>
              <div className="info-txt">
                Bir aya tıkla → o ayın **günlük ortalamaları** aşağıda açılsın.
                {selectedMonth && (
                  <span className="selected-month"> Seçili Ay: {selectedMonth}</span>
                )}
              </div>
            </div>

            {/* Günlük ortalama (seçili ay) */}
            {selectedMonth && (
              <div className="daily-bar-container">
                <h3>Günlük Ortalama Sıcaklık — {selectedMonth}</h3>
                <div style={{height:200}}>
                  <Bar
                    data={dailyData("temperature")}
                    options={{
                      ...baseOpts,
                      plugins: { legend: { display: false } },
                      onClick: (_, elements) => {
                        if (!elements?.length) return;
                        const label = dailyLabels[elements[0].index];
                        openDay(label); // gün içi detay grafiği
                      }
                    }}
                  />
                </div>
                <div className="day-info">Bir güne tıkla → **o günün tüm ölçümleri** aşağıda çizilsin.</div>
              </div>
            )}

            {/* Gün içi detay */}
            {selectedDay && (
              <div className="bar-container" style={{background:"#fff", color:"#222"}}>
                <h3>Gün İçi Detay — {selectedDay}</h3>
                <div style={{height:220}}>
                  <Line data={dayDetailData} options={baseOpts} />
                </div>
              </div>
            )}

            <div style={{display:"flex", gap:10, justifyContent:"flex-end", marginTop:12}}>
              {selectedMonth && (
                <button className="btn btn-ghost" onClick={() => { setSelectedMonth(null); setDaily([]); setSelectedDay(null); setDayDetail([]); }}>
                  Ayı Temizle
                </button>
              )}
              <button className="btn" onClick={() => setAnalysisOpen(false)}>Kapat</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
