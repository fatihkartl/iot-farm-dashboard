const mqtt = require('mqtt');

const mqttUrl = process.env.MQTT_URL || 'mqtt://mqtt:1883'; // Doğru host!
const client = mqtt.connect(mqttUrl);

const deviceId = 'sensor-A';

setInterval(() => {
  const data = {
    deviceId,
    ts: new Date().toISOString(),
    temperature: +(20 + Math.random() * 10).toFixed(2),
    humidity: +(40 + Math.random() * 20).toFixed(2),
    ph: +(5 + Math.random() * 2).toFixed(2),
  };
  client.publish('sensors/data', JSON.stringify(data));
  console.log(`[SIM] sent: ${JSON.stringify(data)}`);
}, 5000);
