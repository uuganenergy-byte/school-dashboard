const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// 🔐 Админ нууц үг (хүсвэл доорх тоог өөрчилнө үү)
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '89366860';
const sessions = new Set();

function requireAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (sessions.has(token)) return next();
  res.status(401).json({ success: false, message: 'Нэвтрээгүй байна' });
}

// JSON өгөгдөл хүлээн авах middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Public болон Uploads хавтаснуудыг статик байдлаар нээх
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// 📁 Файлын замууд
const ROOMS_FILE = path.join(__dirname, 'rooms.json');
const SETTINGS_FILE = path.join(__dirname, 'settings.json');
const TEACHERS_FILE = path.join(__dirname, 'teachers.json');
const MASTER_SCHEDULE_FILE = path.join(__dirname, 'master-schedule.json');

// 🛠️ Туслах функцүүд (JSON унших, бичих)
// ӨӨРЧЛӨЛТ: defaultData параметрийг нэмж, файл үүсгэхдээ Array эсвэл Object байхыг ялгадаг болгов
function readJson(filePath, defaultData) {
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2), 'utf8');
      return defaultData;
    }
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data || JSON.stringify(defaultData));
  } catch (err) {
    console.error(`Файл уншихад алдаа гарлаа (${filePath}):`, err);
    return defaultData;
  }
}

// Аюулгүй бичилт: эхлээд түр файлд бичээд дараа нь нэрийг нь солино.
// Ингэснээр нүүр хуудас файлыг уншиж байх үед хагас бичигдсэн файл хэзээ ч харагдахгүй.
function writeJson(filePath, data) {
  const json = JSON.stringify(data, null, 2);
  const tmpPath = filePath + '.tmp';
  try {
    fs.writeFileSync(tmpPath, json, 'utf8');
    try {
      fs.renameSync(tmpPath, filePath);
    } catch (renameErr) {
      // Антивирус гэх мэт шалтгаанаар нэр солилт амжилтгүй бол шууд бичнэ
      fs.writeFileSync(filePath, json, 'utf8');
      try { fs.unlinkSync(tmpPath); } catch (e) { /* үл тоомсорлоно */ }
    }
    return true;
  } catch (err) {
    console.error(`Файл бичихэд алдаа гарлаа (${filePath}):`, err);
    return false;
  }
}

// 📤 Файл хуулах (Multer тохиргоо)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'public/uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB хязгаар
  fileFilter: (req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png|gif|webp|glb)$/i;
    if (allowed.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Зөвшөөрөгдөөгүй файлын төрөл: зөвхөн зураг болон .glb файл хуулна уу'));
    }
  }
});

// -------------------------------------------------------------
// 🚀 API ROUTES (Холболтын замууд)
// -------------------------------------------------------------

// 1. БҮХ ӨРӨӨНИЙ МЭДЭЭЛЭЛ АВАХ (GET /api/rooms)
app.get('/api/rooms', (req, res) => {
  const rooms = readJson(ROOMS_FILE, []);
  res.json(rooms);
});

// 2. НЭГ ӨРӨӨНИЙ МЭДЭЭЛЭЛ АВАХ (GET /api/rooms/:id)
app.get('/api/rooms/:id', (req, res) => {
  const rooms = readJson(ROOMS_FILE, []);
  const roomId = req.params.id;
  const room = rooms.find(r => String(r.id) === String(roomId) || String(r.roomNumber) === String(roomId));
  if (room) {
    res.json(room);
  } else {
    res.status(404).json({ message: "Өрөө олдсонгүй" });
  }
});

// 3. ӨРӨӨ НЭМЭХ / ШИНЭЧЛЭХ (POST /api/rooms)
app.post('/api/rooms', requireAuth, (req, res) => {
  const newRoom = req.body;
  let rooms = readJson(ROOMS_FILE, []);

  const index = rooms.findIndex(r => String(r.roomNumber) === String(newRoom.roomNumber) || (newRoom.id && String(r.id) === String(newRoom.id)));

  if (index !== -1) {
    rooms[index] = { ...rooms[index], ...newRoom };
  } else {
    if (!newRoom.id) newRoom.id = Date.now().toString();
    rooms.push(newRoom);
  }

  if (writeJson(ROOMS_FILE, rooms)) {
    res.json({ success: true, message: "Амжилттай хадгалагдлаа" });
  } else {
    res.status(500).json({ success: false, message: "Файлд бичихэд алдаа гарлаа" });
  }
});

// 4. ТУСГАЙ ИД-ГЭЭР ӨРӨӨ ШИНЭЧЛЭХ (POST /api/rooms/:id)
app.post('/api/rooms/:id', requireAuth, (req, res) => {
  const roomId = req.params.id;
  const roomData = req.body;
  let rooms = readJson(ROOMS_FILE, []);

  const index = rooms.findIndex(r => String(r.id) === String(roomId) || String(r.roomNumber) === String(roomId));

  if (index !== -1) {
    rooms[index] = { ...rooms[index], ...roomData };
  } else {
    roomData.id = roomId;
    rooms.push(roomData);
  }

  if (writeJson(ROOMS_FILE, rooms)) {
    res.json({ success: true, message: "Амжилттай шинэчлэгдлээ" });
  } else {
    res.status(500).json({ success: false, message: "Хадгалахад алдаа гарлаа" });
  }
});

// 5. ӨРӨӨ УСТГАХ (DELETE /api/rooms/:id)
app.delete('/api/rooms/:id', requireAuth, (req, res) => {
  const roomId = req.params.id;
  let rooms = readJson(ROOMS_FILE, []);

  const filteredRooms = rooms.filter(r => String(r.roomNumber) !== String(roomId) && String(r.id) !== String(roomId));

  if (writeJson(ROOMS_FILE, filteredRooms)) {
    res.json({ success: true, message: "Өрөө устгагдлаа" });
  } else {
    res.status(500).json({ success: false, message: "Устгахад алдаа гарлаа" });
  }
});

// 6. СУРГУУЛИЙН ТОХИРГОО АВАХ ХАДГАЛАХ
app.get('/api/school-settings', (req, res) => {
  // ӨӨРЧЛӨЛТ: Тохиргоог уншихдаа хоосон Object {} ашиглана
  const settings = readJson(SETTINGS_FILE, {});
  res.json(settings);
});

app.post('/api/school-settings', requireAuth, (req, res) => {
  if (writeJson(SETTINGS_FILE, req.body)) {
    res.json({ success: true });
  } else {
    res.status(500).json({ success: false });
  }
});

// 7. ФАЙЛ ХУУЛАХ (POST /api/upload)
// 5 хүртэлх олон зураг хуулах API
app.post('/api/upload-multiple', requireAuth, upload.array('images', 5), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'Зураг оруулаагүй байна.' });
  }
  // Хуулагдсан зургуудын замыг массив болгон буцаана
  const filePaths = req.files.map(file => `/uploads/${file.filename}`);
  res.json({ success: true, filePaths });
});

// 8. АДМИН НЭВТРЭХ (POST /api/login)
app.post('/api/login', (req, res) => {
  const { pin, password } = req.body;
  const inputPass = pin || password;

  if (inputPass === ADMIN_PASSWORD) {
    const token = crypto.randomBytes(32).toString('hex');
    sessions.add(token);
    res.json({ success: true, token });
  } else {
    res.status(401).json({ success: false, message: "Нууц үг буруу байна!" });
  }
});

// public/uploads хавтас доторх зургуудын жагсаалтыг буцаах API
app.get('/api/uploads-list', (req, res) => {
  const uploadsDir = path.join(__dirname, 'public', 'uploads');
  
  if (!fs.existsSync(uploadsDir)) {
      return res.json([]);
  }
  
  fs.readdir(uploadsDir, (err, files) => {
    if (err) {
      return res.status(500).json({ error: 'Файлуудыг уншиж чадсангүй' });
    }
    const validFiles = files.filter(file => 
      /\.(jpg|jpeg|png|gif|webp|glb)$/i.test(file)
    );
    res.json(validFiles);
  });
});

// 2D АНГИЙН КООРДИНАТ ХАДГАЛАХ API (Засаж тохируулсан)
app.post('/api/rooms/:roomNumber/coords', requireAuth, (req, res) => {
  const { roomNumber } = req.params;
  const { floor, x, y } = req.body;

  let rooms = readJson(ROOMS_FILE, []);
  const roomIndex = rooms.findIndex(r => String(r.roomNumber) === String(roomNumber));

  if (roomIndex !== -1) {
    rooms[roomIndex].coords = { floor: Number(floor), x: Number(x), y: Number(y) };
    if (writeJson(ROOMS_FILE, rooms)) {
      res.json({ success: true, room: rooms[roomIndex] });
    } else {
      res.status(500).json({ error: 'Хадгалахад алдаа гарлаа' });
    }
  } else {
    res.status(404).json({ error: 'Анги олдсонгүй' });
  }
});

// -------------------------------------------------------------
// 👨‍🏫 БАГШ НАРЫН БҮРТГЭЛ (ангиас тусдаа, teachers.json файлд хадгална)
// -------------------------------------------------------------

// Бүх багшийг авах (нүүр хуудас болон админ хоёул ашиглана)
app.get('/api/teachers', (req, res) => {
  res.json(readJson(TEACHERS_FILE, []));
});

// Багшийн хариуцсан кабинетүүдийг цэвэрлэнэ (хуучин нэг "roomNumber"-тай нийцнэ)
function normalizeRoomNumbers(t) {
  const src = Array.isArray(t.roomNumbers) ? t.roomNumbers : (t.roomNumber ? [t.roomNumber] : []);
  const out = [];
  src.forEach(v => {
    const s = String(v == null ? '' : v).trim();
    if (s && s.length <= 20 && !out.includes(s)) out.push(s);
  });
  return out.slice(0, 50);
}

// Багш нэмэх / шинэчлэх (нууц үгээр нэвтэрсэн үед л)
app.post('/api/teachers', requireAuth, (req, res) => {
  const t = req.body || {};
  if (!t.name || !String(t.name).trim()) {
    return res.status(400).json({ success: false, message: 'Багшийн нэр хоосон байна' });
  }

  const teachers = readJson(TEACHERS_FILE, []);
  const id = t.id ? String(t.id) : 't' + Date.now();

  const roomNumbers = normalizeRoomNumbers(t);

  const clean = {
    id,
    name: String(t.name).trim(),
    subject: String(t.subject || '').trim(),
    homeroomClass: String(t.homeroomClass || '').trim(),
    phone: String(t.phone || '').trim(),
    roomNumbers,                       // хариуцсан бүх кабинет
    roomNumber: roomNumbers[0] || '',  // хуучин кодтой нийцүүлэх (эхний кабинет)
    image: String(t.image || ''),
    schedule: (t.schedule && typeof t.schedule === 'object') ? t.schedule : {}
  };

  const index = teachers.findIndex(x => String(x.id) === id);
  if (index !== -1) teachers[index] = clean;
  else teachers.push(clean);

  if (writeJson(TEACHERS_FILE, teachers)) {
    res.json({ success: true, id });
  } else {
    res.status(500).json({ success: false, message: 'Файлд бичихэд алдаа гарлаа' });
  }
});

// Багш устгах
app.delete('/api/teachers/:id', requireAuth, (req, res) => {
  const teachers = readJson(TEACHERS_FILE, []);
  const rest = teachers.filter(x => String(x.id) !== String(req.params.id));
  if (writeJson(TEACHERS_FILE, rest)) {
    res.json({ success: true });
  } else {
    res.status(500).json({ success: false, message: 'Устгахад алдаа гарлаа' });
  }
});

// 🔄 Нэг удаагийн шилжүүлэг: хуучин ангийн доторх багш нарыг teachers.json руу зөөнө
function migrateTeachersIfNeeded() {
  if (fs.existsSync(TEACHERS_FILE)) return; // аль хэдийн шилжүүлсэн

  const rooms = readJson(ROOMS_FILE, []);
  const teachers = [];
  const seen = new Set();
  let counter = 0;

  rooms.forEach(room => {
    [['teacher1', 'scheduleTeacher1'], ['teacher2', 'scheduleTeacher2']].forEach(([tKey, sKey]) => {
      const t = room.teachers && room.teachers[tKey];
      if (!t || !t.name || !String(t.name).trim()) return;

      const nameKey = String(t.name).trim().toLowerCase();
      if (seen.has(nameKey)) return; // нэг багшийг давхар оруулахгүй
      seen.add(nameKey);

      teachers.push({
        id: 't' + Date.now() + '_' + (counter++),
        name: String(t.name).trim(),
        subject: t.subject || '',
        homeroomClass: t.responsibleClass || '',
        phone: t.phone || '',
        roomNumber: String(room.roomNumber || ''),
        roomNumbers: room.roomNumber ? [String(room.roomNumber)] : [],
        image: t.image || '',
        schedule: room[sKey] || {}
      });
    });
  });

  // Аюулгүй байлгахын тулд хуучин файлаас нөөц хувь үлдээнэ
  try {
    fs.copyFileSync(ROOMS_FILE, path.join(__dirname, 'rooms.backup-before-teachers.json'));
  } catch (e) {
    console.error('Нөөц хувь хийж чадсангүй:', e);
  }

  writeJson(TEACHERS_FILE, teachers);

  // Хуучин талбаруудыг ангиас хасна (багш нар одоо тусдаа)
  rooms.forEach(room => {
    delete room.teachers;
    delete room.scheduleTeacher1;
    delete room.scheduleTeacher2;
  });
  writeJson(ROOMS_FILE, rooms);

  console.log(`👨‍🏫 ${teachers.length} багшийг ангиас teachers.json руу шилжүүллээ.`);
}

// -------------------------------------------------------------
// 📥 EXCEL-ЭЭС БАГШ НАРЫН ХУВААРЬ ТАТАХ
// (гаднаас сан суулгах шаардлагагүй - .xlsx файлыг өөрөө уншдаг)
// -------------------------------------------------------------
const zlib = require('zlib');

const SCHED_DAYS = ['Даваа', 'Мягмар', 'Лхагва', 'Пүрэв', 'Баасан'];
const SCHED_TIMES = [
  "07:50 - 08:30", "08:35 - 09:15", "09:20 - 10:00", "10:20 - 11:00", "11:05 - 11:45", "11:50 - 12:30", "12:35 - 13:15",
  "13:30 - 14:10", "14:15 - 14:55", "15:00 - 15:40", "16:00 - 16:40", "16:45 - 17:25", "17:30 - 18:10", "18:15 - 18:55"
];

const importUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/\.xlsx$/i.test(file.originalname)) cb(null, true);
    else cb(new Error('Зөвхөн .xlsx (Excel) файл оруулна уу'));
  }
});

function xmlDecode(s) {
  return String(s)
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (m, d) => String.fromCodePoint(+d))
    .replace(/&#x([0-9a-fA-F]+);/g, (m, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/_x([0-9a-fA-F]{4})_/g, (m, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&amp;/g, '&');
}

// .xlsx бол ZIP файл. Доторх файлуудын жагсаалтыг уншина
function zipEntries(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Энэ файл жинхэнэ .xlsx хэлбэртэй биш байна');

  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const entries = {};
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOff = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    entries[name] = { method, compSize, localOff };
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function zipRead(buf, entry) {
  const p = entry.localOff;
  if (buf.readUInt32LE(p) !== 0x04034b50) throw new Error('Excel файл гэмтсэн байна');
  const nameLen = buf.readUInt16LE(p + 26);
  const extraLen = buf.readUInt16LE(p + 28);
  const start = p + 30 + nameLen + extraLen;
  const data = buf.subarray(start, start + entry.compSize);
  if (entry.method === 0) return data;
  if (entry.method === 8) return zlib.inflateRawSync(data);
  throw new Error('Дэмжигдээгүй шахалтын төрөл');
}

function colToNum(letters) {
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

function xmlAttrs(str) {
  const out = {};
  const re = /([\w:.-]+)\s*=\s*"([^"]*)"/g;
  let m;
  while ((m = re.exec(str)) !== null) out[m[1]] = xmlDecode(m[2]);
  return out;
}

// Excel файлыг уншаад хуудас бүрийн нүднүүдийг буцаана
function parseXlsx(buf) {
  const entries = zipEntries(buf);
  const text = name => entries[name] ? zipRead(buf, entries[name]).toString('utf8') : '';

  const workbookXml = text('xl/workbook.xml');
  if (!workbookXml) throw new Error('Excel файлын бүтэц танигдсангүй');

  const relsXml = text('xl/_rels/workbook.xml.rels');
  const rels = {};
  (relsXml.match(/<Relationship\b[^>]*>/g) || []).forEach(tag => {
    const a = xmlAttrs(tag);
    if (a.Id) rels[a.Id] = a.Target;
  });

  // Давхардсан текстүүд
  const shared = [];
  const ssXml = text('xl/sharedStrings.xml');
  (ssXml.match(/<si\b[\s\S]*?<\/si>|<si\s*\/>/g) || []).forEach(si => {
    const clean = si.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '');
    let s = '';
    (clean.match(/<t\b[^>]*>[\s\S]*?<\/t>|<t\s*\/>/g) || []).forEach(t => {
      s += xmlDecode(t.replace(/^<t\b[^>]*>/, '').replace(/<\/t>$/, '').replace(/^<t\s*\/>$/, ''));
    });
    shared.push(s);
  });

  const sheets = [];
  (workbookXml.match(/<sheet\b[^>]*>/g) || []).forEach(tag => {
    const a = xmlAttrs(tag);
    let target = rels[a['r:id']];
    if (!target || !a.name) return;
    target = target.startsWith('/') ? target.slice(1) : 'xl/' + target;
    if (!entries[target]) return;

    const xml = zipRead(buf, entries[target]).toString('utf8');
    const cells = new Map();
    let maxRow = 0, maxCol = 0;

    const cellRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let m;
    while ((m = cellRe.exec(xml)) !== null) {
      const at = xmlAttrs(m[1]);
      const inner = m[2];
      if (!at.r || !inner) continue;
      const rc = /^([A-Z]+)(\d+)$/.exec(at.r);
      if (!rc) continue;
      const col = colToNum(rc[1]);
      const row = parseInt(rc[2], 10);

      let val = '';
      if (at.t === 's') {
        const vm = /<v>([^<]*)<\/v>/.exec(inner);
        if (vm) val = shared[parseInt(vm[1], 10)] || '';
      } else if (at.t === 'inlineStr') {
        (inner.match(/<t\b[^>]*>[\s\S]*?<\/t>/g) || []).forEach(t => {
          val += xmlDecode(t.replace(/^<t\b[^>]*>/, '').replace(/<\/t>$/, ''));
        });
      } else {
        const vm = /<v>([^<]*)<\/v>/.exec(inner);
        if (vm) val = xmlDecode(vm[1]);
      }

      val = String(val).replace(/\s+/g, ' ').trim();
      if (val === '') continue;
      cells.set(row + ',' + col, val);
      if (row > maxRow) maxRow = row;
      if (col > maxCol) maxCol = col;
    }

    const merges = [];
    (xml.match(/<mergeCell\b[^>]*>/g) || []).forEach(tag => {
      const ref = xmlAttrs(tag).ref;
      const mm = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/.exec(ref || '');
      if (mm) merges.push({ c1: colToNum(mm[1]), r1: +mm[2], c2: colToNum(mm[3]), r2: +mm[4] });
    });

    sheets.push({
      name: a.name, maxRow, maxCol, merges,
      get: (r, c) => cells.get(r + ',' + c) || ''
    });
  });

  return sheets;
}

function dayIndexOf(text) {
  const t = String(text || '').trim().toLowerCase();
  if (!t) return null;
  if (/^(даваа|mon(day)?)$/.test(t)) return 0;
  if (/^(мягмар|tue(s(day)?)?)$/.test(t)) return 1;
  if (/^(лхагва|wed(nesday)?)$/.test(t)) return 2;
  if (/^(пүрэв|thu(r(s(day)?)?)?)$/.test(t)) return 3;
  if (/^(баасан|fri(day)?)$/.test(t)) return 4;
  return null;
}

function cleanTeacherName(s) {
  return String(s || '').replace(/\s+/g, ' ').replace(/\.\s+/g, '.').trim();
}

function normName(s) {
  return String(s || '').replace(/\s+/g, '').toLowerCase();
}

// Хуудас нь "багш x өдөр x цаг" хуваарь мөн эсэхийг танина
function analyzeScheduleSheet(sh, shift) {
  // 1) Гарагуудын мөрийг олно
  let dayRow = 0;
  for (let r = 1; r <= Math.min(15, sh.maxRow); r++) {
    const found = new Set();
    for (let c = 1; c <= sh.maxCol; c++) {
      const d = dayIndexOf(sh.get(r, c));
      if (d !== null) found.add(d);
    }
    if (found.size >= 3) { dayRow = r; break; }
  }
  if (!dayRow) return null;

  // 2) Цагийн дугаарын мөр (1, 2, 3 ...)
  let periodRow = 0;
  for (const r of [dayRow + 1, dayRow]) {
    let n = 0;
    for (let c = 1; c <= sh.maxCol; c++) {
      const t = sh.get(r, c);
      if (/^\d{1,2}$/.test(t) && +t >= 1 && +t <= 14) n++;
    }
    if (n >= 5) { periodRow = r; break; }
  }
  if (!periodRow) return null;

  // 3) Багшийн нэрийн багана, хичээлийн бүлгийн багана
  let nameCol = 0, subjectCol = 0;
  for (let r = dayRow; r <= periodRow && !nameCol; r++) {
    for (let c = 1; c <= sh.maxCol; c++) {
      const t = sh.get(r, c);
      if (/багш|teacher/i.test(t) && dayIndexOf(t) === null) { nameCol = c; break; }
    }
  }
  if (!nameCol) return null;
  for (let r = dayRow; r <= periodRow && !subjectCol; r++) {
    for (let c = 1; c <= sh.maxCol; c++) {
      if (c === nameCol) continue;
      if (/^(суд\/баг|суд|class|хичээл|subject)/i.test(sh.get(r, c))) { subjectCol = c; break; }
    }
  }

  // 4) Багана бүр аль өдөр, аль цаг вэ?
  const colMap = [];
  let curDay = null, lastPeriod = 0, block = 0, maxBlock = 0;
  for (let c = 1; c <= sh.maxCol; c++) {
    const dtext = sh.get(dayRow, c);
    const d = dayIndexOf(dtext);
    if (d !== null) {
      if (d !== curDay) { curDay = d; lastPeriod = 0; block = 0; }
    } else if (dtext !== '') {
      curDay = null; // "Ангийн нийт цаг" гэх мэт хуваарьт хамаарахгүй багана
    }
    const pt = sh.get(periodRow, c);
    if (curDay === null || !/^\d{1,2}$/.test(pt)) continue;
    const p = parseInt(pt, 10);
    if (p < 1 || p > 14) continue;
    if (p <= lastPeriod) block++;
    lastPeriod = p;
    if (block > maxBlock) maxBlock = block;
    colMap.push({ col: c, day: curDay, block, p });
  }
  if (!colMap.length) return null;

  const blocksPerDay = maxBlock + 1;
  const offset = (blocksPerDay === 1 && shift === 2) ? 7 : 0;

  // 5) Нэгтгэсэн нүднээс хичээлийн бүлгийг мөр бүрд тодорхойлно
  const subjectByRow = {};
  if (subjectCol) {
    sh.merges.forEach(m => {
      if (m.c1 <= subjectCol && subjectCol <= m.c2 && m.r1 > periodRow) {
        const anchor = sh.get(m.r1, m.c1);
        for (let r = m.r1; r <= m.r2; r++) subjectByRow[r] = anchor;
      }
    });
  }

  // 6) Багш бүрийн хичээлүүдийг цуглуулна
  const byName = new Map();
  for (let r = periodRow + 1; r <= sh.maxRow; r++) {
    const name = cleanTeacherName(sh.get(r, nameCol));
    if (!name || name.length > 60) continue;
    if (/^(нийт|total|sum|дүн)/i.test(name) || /^\d+$/.test(name)) continue;

    const cells = [];
    colMap.forEach(cm => {
      const t = sh.get(r, cm.col);
      if (!t || t === '-' || t === '.') return;
      const period = cm.p + cm.block * 7 + offset;
      if (period < 1 || period > 14) return;
      cells.push([cm.day, period, t.slice(0, 60)]);
    });

    const key = normName(name);
    let subject = subjectByRow[r] !== undefined ? subjectByRow[r] : (subjectCol ? sh.get(r, subjectCol) : '');
    subject = String(subject || '').replace(/\s+/g, ' ').trim();

    if (byName.has(key)) {
      const ex = byName.get(key);
      ex.cells = ex.cells.concat(cells);
      if (!ex.subject && subject) ex.subject = subject;
    } else {
      byName.set(key, { name, subject, cells });
    }
  }

  const teachers = Array.from(byName.values());
  let lessons = 0, s1 = 0, s2 = 0, withLessons = 0;
  teachers.forEach(t => {
    if (t.cells.length) withLessons++;
    t.cells.forEach(c => { lessons++; if (c[1] <= 7) s1++; else s2++; });
  });

  return {
    name: sh.name,
    blocksPerDay,
    teachers,
    teacherCount: teachers.length,
    teachersWithLessons: withLessons,
    lessons,
    lessonsShift1: s1,
    lessonsShift2: s2
  };
}

// Нэг нүдэнд хоёр анги давхцвал " / "-ээр холбоно (хуучин мэдээллийг устгахгүй)
function mergeLessonText(existing, incoming) {
  const ex = String(existing || '').trim();
  const inc = String(incoming || '').trim();
  if (!inc) return ex;
  if (!ex) return inc;
  const parts = ex.split('/').map(s => s.replace(/\s+/g, '').toLowerCase());
  if (parts.includes(inc.replace(/\s+/g, '').toLowerCase())) return ex;
  return ex + ' / ' + inc;
}

function ensureTeacherSchedule(t) {
  if (!t.schedule || typeof t.schedule !== 'object') t.schedule = {};
  for (let p = 1; p <= 14; p++) {
    const key = `${p}-р цаг`;
    const row = (t.schedule[key] && typeof t.schedule[key] === 'object') ? t.schedule[key] : {};
    if (!row.time) row.time = SCHED_TIMES[p - 1];
    SCHED_DAYS.forEach(d => { if (typeof row[d] !== 'string') row[d] = ''; });
    t.schedule[key] = row;
  }
}

// 1-р алхам: Excel файлыг уншиж, юу татагдахыг харуулна (юуг ч хадгалахгүй)
app.post('/api/import/parse', requireAuth, importUpload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'Файл сонгоогүй байна' });
  const shift = String(req.body.shift) === '2' ? 2 : 1;

  try {
    const sheets = parseXlsx(req.file.buffer);
    const found = [];
    sheets.forEach(sh => {
      const r = analyzeScheduleSheet(sh, shift);
      if (r && r.teachers.length) found.push(r);
    });

    if (found.length === 0) {
      return res.status(422).json({
        success: false,
        message: 'Энэ файлаас багшийн хуваарийн хүснэгт олдсонгүй. (Гарагууд болон "Багш нарын нэрс" гэсэн гарчиг хэрэгтэй)'
      });
    }

    let best = 0;
    found.forEach((s, i) => { if (s.lessons > found[best].lessons) best = i; });
    res.json({ success: true, recommended: best, sheets: found });
  } catch (e) {
    console.error('Excel уншихад алдаа:', e);
    res.status(422).json({ success: false, message: 'Файлыг уншиж чадсангүй: ' + e.message });
  }
});

// 2-р алхам: уншсан хуваарийг багш нарт хадгална
app.post('/api/import/apply', requireAuth, (req, res) => {
  const body = req.body || {};
  const incoming = body.teachers;
  if (!Array.isArray(incoming)) {
    return res.status(400).json({ success: false, message: 'Өгөгдөл буруу байна' });
  }

  // Аль ээлжийн хуучин хуваарийг арилгах вэ
  const clearPeriods = new Set();
  (Array.isArray(body.clearShifts) ? body.clearShifts : []).forEach(s => {
    if (Number(s) === 1) for (let p = 1; p <= 7; p++) clearPeriods.add(p);
    if (Number(s) === 2) for (let p = 8; p <= 14; p++) clearPeriods.add(p);
  });
  const skipEmpty = body.skipEmpty !== false;

  const teachers = readJson(TEACHERS_FILE, []);

  // Аюулгүй байлгахын тулд нөөц хувь үлдээнэ
  try {
    if (fs.existsSync(TEACHERS_FILE)) {
      const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
      fs.copyFileSync(TEACHERS_FILE, path.join(__dirname, `teachers.backup-${stamp}.json`));

      // Зөвхөн сүүлийн 5 нөөц хувийг үлдээнэ
      const backups = fs.readdirSync(__dirname).filter(f => /^teachers\.backup-\d+\.json$/.test(f)).sort();
      backups.slice(0, Math.max(0, backups.length - 5)).forEach(f => {
        try { fs.unlinkSync(path.join(__dirname, f)); } catch (e) { /* алгасна */ }
      });
    }
  } catch (e) {
    console.error('Нөөц хувь хийж чадсангүй:', e);
  }

  const byName = new Map();
  teachers.forEach(t => byName.set(normName(t.name), t));

  let created = 0, updated = 0, unchanged = 0, skipped = 0;

  incoming.forEach((it, i) => {
    if (!it || typeof it.name !== 'string') return;
    const name = cleanTeacherName(it.name);
    if (!name || name.length > 80) return;

    const cells = (Array.isArray(it.cells) ? it.cells : []).filter(c =>
      Array.isArray(c) && Number.isInteger(c[0]) && c[0] >= 0 && c[0] <= 4 &&
      Number.isInteger(c[1]) && c[1] >= 1 && c[1] <= 14 && typeof c[2] === 'string' && c[2].trim() !== ''
    );

    const key = normName(name);
    let t = byName.get(key);
    let isNew = false;

    if (!t) {
      if (cells.length === 0 && skipEmpty) { skipped++; return; }
      t = {
        id: 't' + Date.now() + '_' + i,
        name,
        subject: String(it.subject || '').replace(/\s+/g, ' ').trim().slice(0, 80),
        homeroomClass: '', phone: '', roomNumber: '', roomNumbers: [], image: '',
        schedule: {}
      };
      teachers.push(t);
      byName.set(key, t);
      isNew = true;
    }

    ensureTeacherSchedule(t);
    const before = isNew ? '' : JSON.stringify(t.schedule);

    clearPeriods.forEach(p => {
      const row = t.schedule[`${p}-р цаг`];
      SCHED_DAYS.forEach(d => { row[d] = ''; });
    });

    cells.forEach(([d, p, text]) => {
      const row = t.schedule[`${p}-р цаг`];
      const day = SCHED_DAYS[d];
      row[day] = mergeLessonText(row[day], text.trim());
    });

    if (!t.subject && it.subject) {
      t.subject = String(it.subject).replace(/\s+/g, ' ').trim().slice(0, 80);
    }

    if (isNew) created++;
    else if (JSON.stringify(t.schedule) !== before) updated++;
    else unchanged++;
  });

  if (writeJson(TEACHERS_FILE, teachers)) {
    res.json({ success: true, created, updated, unchanged, skipped, total: teachers.length });
  } else {
    res.status(500).json({ success: false, message: 'Файлд бичихэд алдаа гарлаа' });
  }
});

// -------------------------------------------------------------
// 📅 НЭГДСЭН ХУВААРИЙН ХҮСНЭГТ (Excel-ээс уншсан түүхий өгөгдлийг хадгална)
// "Багшийн мэдээлэл" цэс дээрх "Хуваариас татах" товч үүнээс хайдаг
// -------------------------------------------------------------

app.get('/api/master-schedule', (req, res) => {
  res.json(readJson(MASTER_SCHEDULE_FILE, []));
});

// Бүхэлд нь орлуулж хадгалах (Excel-ээс шинээр импортлох, эсвэл нэр засварласны дараа хадгалах үед)
app.post('/api/master-schedule', requireAuth, (req, res) => {
  const incoming = Array.isArray(req.body) ? req.body : (req.body.teachers || []);

  const clean = incoming
    .filter(t => t && typeof t.name === 'string' && t.name.trim())
    .map((t, i) => ({
      id: t.id ? String(t.id) : 'ms' + Date.now() + '_' + i,
      name: cleanTeacherName(t.name),
      subject: String(t.subject || '').replace(/\s+/g, ' ').trim().slice(0, 80),
      cells: (Array.isArray(t.cells) ? t.cells : []).filter(c =>
        Array.isArray(c) && Number.isInteger(c[0]) && c[0] >= 0 && c[0] <= 4 &&
        Number.isInteger(c[1]) && c[1] >= 1 && c[1] <= 14 && typeof c[2] === 'string' && c[2].trim() !== ''
      )
    }));

  if (writeJson(MASTER_SCHEDULE_FILE, clean)) {
    res.json({ success: true, count: clean.length });
  } else {
    res.status(500).json({ success: false, message: 'Файлд бичихэд алдаа гарлаа' });
  }
});

// Файл хуулах үеийн алдааг (том файл, буруу төрөл) ойлгомжтой буцаах
app.use((err, req, res, next) => {
  res.status(400).json({ success: false, error: err.message });
});

// Серверийг асаах
migrateTeachersIfNeeded();
// Гэнэтийн алдаанаас болж сервер унахаас сэргийлнэ (алдааг лог руу бичнэ)
process.on('uncaughtException', err => console.error('uncaughtException:', err));
process.on('unhandledRejection', err => console.error('unhandledRejection:', err));

app.listen(PORT, () => {
  console.log(`=================================`);
  console.log(`🚀 Сервер http://localhost:${PORT} дээр ажиллаж байна`);
  console.log(`📁 rooms.json байршил: ${ROOMS_FILE}`);
  console.log(`=================================`);
});