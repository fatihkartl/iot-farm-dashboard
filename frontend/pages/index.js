import { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import { Line } from "react-chartjs-2";
import Chart from "chart.js/auto";
import { io } from "socket.io-client";

const SENSOR_LIST = ["sensor-A", "sensor-B", "sensor-C"];

// REST istekleri için hâlâ /api/... (Next.js rewrite ile backend'e gider)
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

// WS taban adresini güvenle üret (tarayıcıdaki host + :8080)
// Örn: http://localhost:8080  (HTTPS ise https://<host>:8080)
function getWsBase() {
  if (typeof window === "undefined") return "";
  const host = window.location.hostname; // localhost ya da IP
  const isHttps = window.location.protocol === "https:";
  const scheme = isHttps ? "https" : "http";
  return `${scheme}://${host}:8080`;
}

export default function Home() {
  const [sensorId, setSensorId] = useState(SENSOR_LIST[0]);
  const [rows, setRows] = useState([]);
  const [wsReady, setWsReady] = useState(false);

  // 1) İlk yüklemede/sensör değişince geçmiş veriyi çek
  useEffect(() => {
    let alive = true;
    const fetchData = async () => {
      try {
        const res = await fetch(
          `/api/history?deviceId=${encodeURIComponent(sensorId)}&limit=40`
        );
        const json = await res.json();
        if (alive) setRows(json || []);
      } catch (e) {
        console.error("history fetch error:", e);
      }
    };
    fetchData();
    // WS kurulana kadar fallback olarak 3 sn'de bir çek
    let id;
    if (!wsReady) id = setInterval(fetchData, 3000);
    return () => { alive = false; if (id) clearInterval(id); };
  }, [sensorId, wsReady]);

  // 2) WebSocket’e doğrudan backend’e bağlan
  useEffect(() => {
    const wsBase = getWsBase(); // http(s)://<host>:8080
    // path: /socket.io ; sadece websocket dene, polling fallback'ı da açık bırakabiliriz
    const socket = io(wsBase, {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      withCredentials: false,
    });

    socket.on("connect", () => setWsReady(true));
    socket.on("disconnect", () => setWsReady(false));
    socket.on("connect_error", (err) => {
      console.error("WS connect_error:", err?.message || err);
      setWsReady(false);
    });

    // Backend'in yaydığı kanal
    socket.on("sensor:data", (msg) => {
      if (!msg || msg.deviceId !== sensorId) return; // yalnız seçili sensör
      setRows((prev) => {
        const next = [...prev, msg];
        if (next.length > 40) next.shift();
        return next;
      });
    });

    return () => {
      socket.off("sensor:data");
      socket.disconnect();
    };
  }, [sensorId]);

  // Grafik veri dönüşümleri
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

  const tempData = useMemo(() => ({
    labels,
    datasets: [{ data: series.temperature, borderColor: "#ff6384", backgroundColor: "rgba(255,99,132,.25)", tension: .25 }]
  }), [labels, series.temperature]);

  const humData = useMemo(() => ({
    labels,
    datasets: [{ data: series.humidity, borderColor: "#36a2eb", backgroundColor: "rgba(54,162,235,.25)", tension: .25 }]
  }), [labels, series.humidity]);

  const phData = useMemo(() => ({
    labels,
    datasets: [{ data: series.ph, borderColor: "#4bc0c0", backgroundColor: "rgba(75,192,192,.25)", tension: .25 }]
  }), [labels, series.ph]);

  const soilData = useMemo(() => ({
    labels,
    datasets: [{ data: series.soilMoisture, borderColor: "#f6c244", backgroundColor: "rgba(246,194,68,.25)", tension: .25 }]
  }), [labels, series.soilMoisture]);

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
          </div>
        </div>

        <div className="grid">
          {/* Sıcaklık */}
          <div className="card">
            <h4 style={{ color: "var(--accent1)" }}>Sıcaklık (°C)</h4>
            <div className="chart"><Line data={tempData} options={baseOpts} /></div>
            <div className="statrow">
              <div className="badge"><span>MIN</span><b>{stats.temperature.min}</b></div>
              <div className="badge"><span>SON</span><b>{stats.temperature.last}</b></div>
              <div className="badge"><span>MAX</span><b>{stats.temperature.max}</b></div>
            </div>
          </div>
          {/* Nem */}
          <div className="card">
            <h4 style={{ color: "var(--accent2)" }}>Nem (%)</h4>
            <div className="chart"><Line data={humData} options={baseOpts} /></div>
            <div className="statrow">
              <div className="badge"><span>MIN</span><b>{stats.humidity.min}</b></div>
              <div className="badge"><span>SON</span><b>{stats.humidity.last}</b></div>
              <div className="badge"><span>MAX</span><b>{stats.humidity.max}</b></div>
            </div>
          </div>
          {/* pH */}
          <div className="card">
            <h4 style={{ color: "var(--accent3)" }}>pH</h4>
            <div className="chart"><Line data={phData} options={baseOpts} /></div>
            <div className="statrow">
              <div className="badge"><span>MIN</span><b>{stats.ph.min}</b></div>
              <div className="badge"><span>SON</span><b>{stats.ph.last}</b></div>
              <div className="badge"><span>MAX</span><b>{stats.ph.max}</b></div>
            </div>
          </div>
          {/* Toprak Nemi */}
          <div className="card">
            <h4 style={{ color: "var(--accent4)" }}>Toprak Nemi (%)</h4>
            <div className="chart"><Line data={soilData} options={baseOpts} /></div>
            <div className="statrow">
              <div className="badge"><span>MIN</span><b>{stats.soilMoisture.min}</b></div>
              <div className="badge"><span>SON</span><b>{stats.soilMoisture.last}</b></div>
              <div className="badge"><span>MAX</span><b>{stats.soilMoisture.max}</b></div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
