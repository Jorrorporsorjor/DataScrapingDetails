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

// ฟังก์ชันเรียกใช้ scraper
function runScraper() {
  // ถ้ายังทำงานอยู่ ข้าม
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

  // เรียกใช้ scraper-multi-groups.js
  scraperProcess = spawn('node', ['scraper/scraper-multi-groups.js'], {
    stdio: 'inherit' // แสดง log ของ scraper ใน console
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

// ตั้ง scheduler ทุก 30 วินาที
console.log('⏰ ตั้งค่า Scheduler: รัน Scraper ทุก 30 วินาที');
setInterval(() => {
  runScraper();
}, 30000);

// รันครั้งแรกทันที
console.log('🎬 รัน Scraper ครั้งแรกทันที...');
runScraper();

// ✅ serve success_keyword.json
app.get('/keywords', (req, res) => {
  const filePath = path.join(__dirname, '..', 'output', 'success_keyword.json');
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }
  const data = fs.readFileSync(filePath, 'utf-8');
  res.json(JSON.parse(data));
});

// ✅ serve all_posts_data.json
app.get('/posts', (req, res) => {
  const filePath = path.join(__dirname, '..', 'output', 'all_posts_data.json');
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }
  const data = fs.readFileSync(filePath, 'utf-8');
  res.json(JSON.parse(data));
});

// ✅ endpoint สถานะ scraper
app.get('/status', (req, res) => {
  res.json({
    server: 'running',
    timestamp: new Date().toISOString(),
    scraper: scraperStatus
  });
});

// ✅ endpoint เรียกใช้ scraper แบบ manual
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

// ✅ fallback
app.get('/', (req, res) => {
  res.json({
    message: '✅ Scraper Server Running',
    endpoints: {
      '/keywords': 'GET - ดึงข้อมูล keywords',
      '/posts': 'GET - ดึงข้อมูล posts',
      '/status': 'GET - ดูสถานะ server และ scraper',
      '/run-scraper': 'POST - รัน scraper ทันที (ถ้าไม่ได้ทำงานอยู่)'
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