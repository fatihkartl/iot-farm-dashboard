const express = require('express');
const cors = require('cors');
const { Client } = require('pg');
const mqtt = require('mqtt');

const app = express();
app.use(cors());

// --- Geri kalan kod burada...


// --- CORS için (gerekirse)
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  next();
});

// --- PostgreSQL bağlantısı
const pgClient = new Client({
  connectionString: process.env.DATABASE_URL
});

async function initDb() {
  try {
    await pgClient.connect();
    await pgClient.query(`
      CREATE TABLE IF NOT EXISTS sensor_data (
        id SERIAL PRIMARY KEY,
        device_id VARCHAR(32),
        ts TIMESTAMP,
        temperature REAL,
        humidity REAL,
        ph REAL,
        soil_moisture REAL
      );
    `);
    console.log('[DB] Table checked/created');
  } catch (err) {
    console.error('[DB] Init error:', err.message);
    process.exit(1);
  }
}

initDb();

// --- MQTT bağlantısı & event logları
const mqttUrl = process.env.MQTT_URL || "mqtt://localhost:1883";
console.log('[CONFIG] MQTT_URL:', mqttUrl);

const mqttClient = mqtt.connect(mqttUrl);

mqttClient.on('connect', () => {
  console.log('[MQTT] Connected');
  mqttClient.subscribe('sensors/data', (err) => {
    if (err) {
      console.error('[MQTT] Subscribe error:', err);
    } else {
      console.log('[MQTT] Subscribed to sensors/data');
    }
  });
});

mqttClient.on('reconnect', () => { console.log('[MQTT] Reconnecting...'); });
mqttClient.on('close', () => { console.log('[MQTT] Connection closed'); });
mqttClient.on('offline', () => { console.log('[MQTT] Offline'); });
mqttClient.on('end', () => { console.log('[MQTT] Connection ended'); });
mqttClient.on('error', (err) => { console.error('[MQTT] Connection error:', err); });

// --- MQTT veri handler
mqttClient.on('message', async (topic, message) => {
  if (topic !== 'sensors/data') return;
  try {
    const data = JSON.parse(message.toString());
    console.log('[MQTT] Data received:', data);

    await pgClient.query(
      `INSERT INTO sensor_data (device_id, ts, temperature, humidity, ph, soil_moisture)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [data.deviceId, data.ts, data.temperature, data.humidity, data.ph, data.soilMoisture]
    );
    console.log('[DB] Saved:', data);
  } catch (err) {
    console.error('[ERROR] MQTT handler:', err.message);
  }
});

// --- REST API: Canlı history endpoint
app.get('/history', async (req, res) => {
  const { deviceId, limit } = req.query;
  try {
    const q = `
      SELECT ts, temperature, humidity, ph, soil_moisture, device_id
      FROM sensor_data
      WHERE device_id = $1
      ORDER BY ts DESC
      LIMIT $2
    `;
    const r = await pgClient.query(q, [deviceId, limit || 40]);
    // frontend ile uyum için camelCase:
    res.json(
      r.rows.reverse().map(row => ({
        ...row,
        soilMoisture: row.soil_moisture
      }))
    );
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Health endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(8080, () => {
  console.log('Backend listening on 8080');
});
