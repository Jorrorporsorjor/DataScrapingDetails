const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const app = express();
const PORT = 4000;

app.use(cors());
app.use(express.json());

let scraperProcess = null;
let scraperStatus = {
  isRunning: false,
  lastStarted: null,
  lastCompleted: null,
  lastError: null,
  totalRuns: 0,
  successfulRuns: 0,
  failedRuns: 0
};

function runScraper() {
  if (scraperProcess && scraperStatus.isRunning) {
    console.log('⏭️  Scraper กำลังทำงานอยู่ ข้ามรอบนี้...');
    return;
  }

  console.log('\n' + '='.repeat(60));
  console.log(`🚀 เริ่มรัน Scraper รอบที่ ${scraperStatus.totalRuns + 1}`);
  console.log(`⏰ เวลา: ${new Date().toLocaleString('th-TH')}`);
  console.log('='.repeat(60));

  scraperStatus.isRunning = true;
  scraperStatus.lastStarted = new Date().toISOString();
  scraperStatus.totalRuns++;

  scraperProcess = spawn('node', ['scraper/scraper-multi-groups.js'], {
    stdio: 'inherit'
  });

  scraperProcess.on('close', (code) => {
    scraperStatus.isRunning = false;
    scraperStatus.lastCompleted = new Date().toISOString();

    if (code === 0) {
      scraperStatus.successfulRuns++;
      console.log('\n✅ Scraper ทำงานสำเร็จ');
    } else {
      scraperStatus.failedRuns++;
      scraperStatus.lastError = `Exit code: ${code}`;
      console.log(`\n❌ Scraper ล้มเหลว (Exit code: ${code})`);
    }

    console.log(`📊 สถิติ: ${scraperStatus.successfulRuns}/${scraperStatus.totalRuns} สำเร็จ`);
    scraperProcess = null;
  });

  scraperProcess.on('error', (error) => {
    scraperStatus.isRunning = false;
    scraperStatus.lastError = error.message;
    scraperStatus.failedRuns++;
    console.error('❌ เกิดข้อผิดพลาดในการรัน Scraper:', error.message);
    scraperProcess = null;
  });
}

// ==========================
// ⏰ Scheduler ทุก 30 วินาที
// ==========================
console.log('⏰ ตั้งค่า Scheduler: รัน Scraper ทุก 30 วินาที');
setInterval(() => {
  runScraper();
}, 30000);

console.log('🎬 รัน Scraper ครั้งแรกทันที...');
runScraper();

// API routes

// // ✅ serve success_keyword.json
// app.get('/keywords', (req, res) => {
//   const filePath = path.join(__dirname, '..', 'output', 'success_keyword.json');
//   if (!fs.existsSync(filePath)) {
//     return res.status(404).json({ error: 'File not found' });
//   }
//   const data = fs.readFileSync(filePath, 'utf-8');
//   res.json(JSON.parse(data));
// });

// // ✅ serve all_posts_data.json
// app.get('/posts', (req, res) => {
//   const filePath = path.join(__dirname, '..', 'output', 'all_posts_data.json');
//   if (!fs.existsSync(filePath)) {
//     return res.status(404).json({ error: 'File not found' });
//   }
//   const data = fs.readFileSync(filePath, 'utf-8');
//   res.json(JSON.parse(data));
// });

// ✅ endpoint สถานะ scraper
app.get('/status', (req, res) => {
  res.json({
    server: 'running',
    timestamp: new Date().toISOString(),
    scraper: scraperStatus
  });
});

// ✅ endpoint manual run scraper
app.post('/run-scraper', (req, res) => {
  if (scraperStatus.isRunning) {
    return res.status(409).json({
      error: 'Scraper is already running',
      status: scraperStatus
    });
  }

  runScraper();
  res.json({
    message: 'Scraper started',
    status: scraperStatus
  });
});

app.get('/:query', (req, res) => {
  const { query } = req.params;
  const filePath = path.join(__dirname, '..', 'output', `${query}.json`);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: `ไม่พบไฟล์ ${query}.json` });
  }

  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    res.json(JSON.parse(data));
  } catch (err) {
    console.error(`❌ อ่านไฟล์ ${query}.json ล้มเหลว:`, err.message);
    res.status(500).json({ error: `เกิดข้อผิดพลาดในการอ่านไฟล์ ${query}.json` });
  }
});

// ✅ fallback
app.get('/', (req, res) => {
  res.json({
    message: '✅ Scraper Server Running',
    endpoints: {
      '/status': 'GET - ดูสถานะ server และ scraper',
      '/run-scraper': 'POST - รัน scraper ทันที',
      '/:query': 'GET - ดึงข้อมูลไฟล์ JSON ตามชื่อ เช่น /เบียร์ หรือ /ร้านค้า_failed'
    },
    scheduler: {
      interval: '30 seconds',
      status: scraperStatus
    }
  });
});

app.listen(PORT, () => {
  console.log(`\n${'🚀'.repeat(30)}`);
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`⏰ Scraper จะรันทุกๆ 30 วินาที`);
  console.log('🚀'.repeat(30) + '\n');
});
