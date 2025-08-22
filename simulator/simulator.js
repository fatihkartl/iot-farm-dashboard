const mqtt = require('mqtt'); 
const mqttUrl = process.env.MQTT_URL || 'mqtt://mqtt:1883'; // MQTT bağlantısı
const client = mqtt.connect(mqttUrl);

const deviceId = 'sensor-A'; // Sensör cihaz ID'si

setInterval(() => {
  const data = {
    deviceId,
    ts: new Date().toISOString(),
    temperature: +(30 + Math.random() * 10).toFixed(2), // 30-40°C arası rastgele sıcaklık
    humidity: +(40 + Math.random() * 20).toFixed(2), // 40-60% arası rastgele nem
    ph: +(5 + Math.random() * 2).toFixed(2), // 5-7 arası rastgele pH
    soilMoisture: +(30 + Math.random() * 40).toFixed(2) // 30-70% arası rastgele nem
  };
  client.publish('sensors/data', JSON.stringify(data)); // MQTT kanalına gönder
  console.log(`[SIM] sent: ${JSON.stringify(data)}`); 
}, 10000);
