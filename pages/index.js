import { useEffect, useState } from "react";
import { Line } from "react-chartjs-2";
import Chart from "chart.js/auto";

export default function Home() {
  const [data, setData] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      const res = await fetch("http://localhost:8080/history?deviceId=sensor-A&limit=20");
      const json = await res.json();
      setData(json);
    };

    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const chartData = {
    labels: data.map(d => new Date(d.ts).toLocaleTimeString()),
    datasets: [
      {
        label: "Sıcaklık (°C)",
        data: data.map(d => d.temperature),
        fill: false,
        borderColor: "rgb(255, 99, 132)",
        tension: 0.2,
      },
    ],
  };

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: 20 }}>
      <h1>Tarla Sensör Dashboard</h1>
      <Line data={chartData} />
      <pre>{JSON.stringify(data[data.length - 1], null, 2)}</pre>
    </div>
  );
}
