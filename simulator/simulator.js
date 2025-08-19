const mqtt = require('mqtt');
const mqttUrl = process.env.MQTT_URL || 'mqtt://mqtt:1883';
const client = mqtt.connect(mqttUrl);

const deviceId = 'sensor-A';

setInterval(() => {
  const data = {
    deviceId,
    ts: new Date().toISOString(),
    temperature: +(20 + Math.random() * 10).toFixed(2),
    humidity: +(40 + Math.random() * 20).toFixed(2),
    ph: +(5 + Math.random() * 2).toFixed(2),
    soilMoisture: +(30 + Math.random() * 40).toFixed(2) // 30-70 arası örnek
  };
  client.publish('sensors/data', JSON.stringify(data));
  console.log(`[SIM] sent: ${JSON.stringify(data)}`);
}, 5000);
