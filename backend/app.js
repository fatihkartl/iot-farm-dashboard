
const express = require('express'); 
const cors = require('cors'); 
const http = require('http'); 
const { Server } = require('socket.io');
const { Client } = require('pg');
const mqtt = require('mqtt');

const app = express(); 

// CORS
app.use(cors()); 
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

// --- HTTP + WebSocket (Socket.IO) sunucu
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

io.on('connection', (socket) => {
  console.log('[WS] client connected:', socket.id);
  socket.on('disconnect', () => console.log('[WS] client disconnected:', socket.id));
});

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
mqttClient.on('error', (err) => { console.error('[MQTT] Connection error:', err?.message || err); });

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

    // Anında frontend'e it
    io.emit('sensor:data', data);

    console.log('[DB] Saved:', data);
  } catch (err) {
    console.error('[ERROR] MQTT handler:', err.message);
  }
});

// --- REST API: History endpoint
app.get('/history', async (req, res) => {
  try {
    const deviceId = req.query.deviceId || 'sensor-A';
    const limitNum = Math.max(1, Math.min(1000, parseInt(req.query.limit || '40', 10)));

    const q = `
      SELECT ts, temperature, humidity, ph, soil_moisture, device_id
      FROM sensor_data
      WHERE device_id = $1
      ORDER BY ts DESC
      LIMIT $2
    `;
    const r = await pgClient.query(q, [deviceId, limitNum]);

    // En yeniler üstte geldi; grafikte soldan sağa aksın diye reverse
    const out = r.rows.reverse().map(row => ({
      deviceId: row.device_id,
      ts: row.ts,
      temperature: row.temperature,
      humidity: row.humidity,
      ph: row.ph,
      soilMoisture: row.soil_moisture, // camelCase
      soil_moisture: row.soil_moisture // geriye uyumluluk
    }));
    res.json(out);
  } catch (e) {
    console.error('[HISTORY] error:', e);
    res.status(500).json({ error: e.message });
  }
});

// --- Health endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Sunucu başlat (HTTP + WS)
server.listen(8080, () => {
  console.log('Backend + WS listening on 8080');
});
