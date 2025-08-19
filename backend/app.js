const express = require('express');
const { Client } = require('pg');
const mqtt = require('mqtt');

const app = express();

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
        ph REAL
      );
    `);
    console.log('[DB] Table checked/created');
  } catch (err) {
    console.error('[DB] Init error:', err.message);
    process.exit(1); // DB açılmazsa container dursun
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

mqttClient.on('reconnect', () => {
  console.log('[MQTT] Reconnecting...');
});

mqttClient.on('close', () => {
  console.log('[MQTT] Connection closed');
});

mqttClient.on('offline', () => {
  console.log('[MQTT] Offline');
});

mqttClient.on('end', () => {
  console.log('[MQTT] Connection ended');
});

mqttClient.on('error', (err) => {
  console.error('[MQTT] Connection error:', err);
});

// --- MQTT veri handler
mqttClient.on('message', async (topic, message) => {
  if (topic !== 'sensors/data') return;
  try {
    const data = JSON.parse(message.toString());
    console.log('[MQTT] Data received:', data);

    await pgClient.query(
      `INSERT INTO sensor_data (device_id, ts, temperature, humidity, ph)
       VALUES ($1, $2, $3, $4, $5)`,
      [data.deviceId, data.ts, data.temperature, data.humidity, data.ph]
    );
    console.log('[DB] Saved:', data);
  } catch (err) {
    console.error('[ERROR] MQTT handler:', err.message);
  }
});

// --- Health endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// --- Sunucu başlat
app.listen(8080, () => {
  console.log('Backend listening on 8080');
});
