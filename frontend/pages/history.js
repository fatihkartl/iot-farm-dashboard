import { useEffect, useState } from "react";
import Head from "next/head";
import { Line, Bar } from "react-chartjs-2";
import Chart from "chart.js/auto";

const SENSOR_LIST = ["sensor-A", "sensor-B", "sensor-C"];

function monthName(num) {
  // 1-based (1=Ocak)
  return [
    "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", 
    "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"
  ][num - 1];
}

export default function History() {
  const [sensorId, setSensorId] = useState(SENSOR_LIST[0]);
  const [step, setStep] = useState("year"); // year, month, day
  const [selectedMonth, setSelectedMonth] = useState(null); // {year, month}
  const [selectedDay, setSelectedDay] = useState(null); // {year, month, day}
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  // Fetch data
  useEffect(() => {
    setLoading(true);
    let url = "";
    if (step === "year") {
      url = `/api/history/monthly?deviceId=${sensorId}`;
    } else if (step === "month" && selectedMonth) {
      url = `/api/history/daily?deviceId=${sensorId}&year=${selectedMonth.year}&month=${selectedMonth.month}`;
    } else if (step === "day" && selectedDay) {
      url = `/api/history/day?deviceId=${sensorId}&year=${selectedDay.year}&month=${selectedDay.month}&day=${selectedDay.day}`;
    }
    if (!url) return;
    fetch(url)
      .then(res => res.json())
      .then(json => setData(json || []))
      .finally(() => setLoading(false));
  }, [sensorId, step, selectedMonth, selectedDay]);

  // Chart Data
  let chart, title = "";
  if (step === "year") {
    title = "Son 1 Yıl (Aylık Ortalama)";
    const labels = data.map(r => {
      const d = new Date(r.month);
      return monthName(d.getMonth() + 1) + " " + d.getFullYear();
    });
    chart = (
      <Bar
        data={{
          labels,
          datasets: [
            { label: "Sıcaklık", data: data.map(r => +r.temperature), backgroundColor: "#ff638455" },
            { label: "Nem", data: data.map(r => +r.humidity), backgroundColor: "#36a2eb55" },
            { label: "pH", data: data.map(r => +r.ph), backgroundColor: "#4bc0c055" },
            { label: "Toprak Nemi", data: data.map(r => +r.soil_moisture), backgroundColor: "#f6c24455" },
          ],
        }}
        options={{
          plugins: { legend: { position: "bottom" } },
          onClick: (e, el) => {
            if (el.length) {
              // tıklanan bar ay
              const idx = el[0].index;
              const dt = new Date(data[idx].month);
              setSelectedMonth({ year: dt.getFullYear(), month: dt.getMonth() + 1 });
              setStep("month");
            }
          }
        }}
        height={120}
      />
    );
  } else if (step === "month" && selectedMonth) {
    title = `${monthName(selectedMonth.month)} ${selectedMonth.year} (Günlük Ortalama)`;
    const labels = data.map(r => {
      const d = new Date(r.day);
      return d.getDate() + " " + monthName(d.getMonth() + 1);
    });
    chart = (
      <Bar
        data={{
          labels,
          datasets: [
            { label: "Sıcaklık", data: data.map(r => +r.temperature), backgroundColor: "#ff638455" },
            { label: "Nem", data: data.map(r => +r.humidity), backgroundColor: "#36a2eb55" },
            { label: "pH", data: data.map(r => +r.ph), backgroundColor: "#4bc0c055" },
            { label: "Toprak Nemi", data: data.map(r => +r.soil_moisture), backgroundColor: "#f6c24455" },
          ],
        }}
        options={{
          plugins: { legend: { position: "bottom" } },
          onClick: (e, el) => {
            if (el.length) {
              const idx = el[0].index;
              const d = new Date(data[idx].day);
              setSelectedDay({ year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() });
              setStep("day");
            }
          }
        }}
        height={120}
      />
    );
  } else if (step === "day" && selectedDay) {
    title = `${selectedDay.day} ${monthName(selectedDay.month)} ${selectedDay.year} (Saatlik Değerler)`;
    const labels = data.map(r => new Date(r.ts).toLocaleTimeString("tr-TR", { hour12: false }));
    chart = (
      <Line
        data={{
          labels,
          datasets: [
            { label: "Sıcaklık", data: data.map(r => +r.temperature), borderColor: "#ff6384", backgroundColor: "#ff638455", tension: 0.25 },
            { label: "Nem", data: data.map(r => +r.humidity), borderColor: "#36a2eb", backgroundColor: "#36a2eb55", tension: 0.25 },
            { label: "pH", data: data.map(r => +r.ph), borderColor: "#4bc0c0", backgroundColor: "#4bc0c055", tension: 0.25 },
            { label: "Toprak Nemi", data: data.map(r => +r.soil_moisture), borderColor: "#f6c244", backgroundColor: "#f6c24455", tension: 0.25 },
          ],
        }}
        options={{ plugins: { legend: { position: "bottom" } } }}
        height={120}
      />
    );
  }

  // Navigation breadcrumbs
  let nav = null;
  if (step === "month" && selectedMonth) {
    nav = (
      <div style={{ marginBottom: 8 }}>
        <a href="#" onClick={e => { e.preventDefault(); setStep("year"); setSelectedMonth(null); }}>⟵ Yıllık Görünüm</a>
      </div>
    );
  }
  if (step === "day" && selectedDay) {
    nav = (
      <div style={{ marginBottom: 8 }}>
        <a href="#" onClick={e => { e.preventDefault(); setStep("month"); setSelectedDay(null); }}>⟵ Aylık Görünüm</a> &nbsp;|&nbsp;
        <a href="#" onClick={e => { e.preventDefault(); setStep("year"); setSelectedDay(null); setSelectedMonth(null); }}>Yıllık</a>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Geçmiş Ölçümler – Tarla Sensör Dashboard</title>
      </Head>
      <div style={{
        maxWidth: 980, margin: "0 auto", padding: 24,
        fontFamily: "system-ui, sans-serif"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 20 }}>
          <h2>📊 Geçmiş Ölçümler</h2>
          <select value={sensorId} onChange={e => {
            setSensorId(e.target.value);
            setStep("year"); setSelectedMonth(null); setSelectedDay(null);
          }}>
            {SENSOR_LIST.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        {nav}
        <h4>{title}</h4>
        {loading ? <div>Yükleniyor...</div> : chart}
      </div>
    </>
  );
}
