const DAYS = ["Даваа", "Мягмар", "Лхагва", "Пүрэв", "Баасан"];
const DEFAULT_TIMES = [
  "07:50 - 08:30", "08:35 - 09:15", "09:20 - 10:00", "10:20 - 11:00", "11:05 - 11:45", "11:50 - 12:30", "12:35 - 13:15",
  "13:30 - 14:10", "14:15 - 14:55", "15:00 - 15:40", "16:00 - 16:40", "16:45 - 17:25", "17:30 - 18:10", "18:15 - 18:55"
];

let roomsData = [];
let teachersData = [];
let availableUploads = [];
window.adminToken = '';

// Нэвтэрсний дараа сервер рүү явуулах хүсэлт бүрд нууц токен нэмнэ
function authHeaders(extra) {
  return Object.assign({ 'Authorization': 'Bearer ' + window.adminToken }, extra || {});
}

// Enter товч дарахад нэвтрэх
document.addEventListener('keydown', function (e) {
  const overlay = document.getElementById('loginOverlay');
  if (e.key === 'Enter' && overlay && overlay.style.display !== 'none') handleLogin();
});

// ================= НЭВТРЭХ =================
async function handleLogin() {
  const pin = document.getElementById('pinInput').value;
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      window.adminToken = data.token;
      document.getElementById('loginOverlay').style.display = 'none';
      document.getElementById('adminContent').style.display = 'block';
      loadAdminData();
    } else {
      document.getElementById('loginError').style.display = 'block';
    }
  } catch (err) {
    alert("Сервертэй холбогдож чадсангүй.");
  }
}
window.handleLogin = handleLogin;

function checkAuth() {
  document.getElementById('loginOverlay').style.display = 'flex';
  document.getElementById('adminContent').style.display = 'none';
}

// ================= ЦЭС (ТАБ) СОЛИХ =================
function showTab(name) {
  ['rooms', 'teachers', 'import', 'schedule_input', 'map'].forEach(n => {
    const box = document.getElementById('tab_' + n);
    const btn = document.getElementById('tabBtn_' + n);
    if (box) box.style.display = (n === name) ? 'block' : 'none';
    if (btn) btn.classList.toggle('active', n === name);
  });

  if (name === 'schedule_input') {
    renderAdminScheduleInput();
  }
}
window.showTab = showTab;

// ================= public/uploads доторх файлууд =================
async function loadUploadsList() {
  try {
    const res = await fetch('/api/uploads-list');
    if (res.ok) {
      availableUploads = await res.json();

      populateUploadDropdown('floor1Select');
      populateUploadDropdown('floor2Select');
      populateUploadDropdown('model3dSelect');
      populateUploadDropdown('roomPanorama');
      populateUploadDropdown('teacherImage');
    }
  } catch (e) {
    console.error('Зургийн жагсаалт уншиж чадсангүй:', e);
  }
}

function populateUploadDropdown(selectId) {
  const select = document.getElementById(selectId);
  if (!select) return;

  const prev = select.value;
  select.innerHTML = '<option value="">-- Зураг сонгоогүй --</option>';

  availableUploads.forEach(file => {
    const opt = document.createElement('option');
    opt.value = `/uploads/${file}`;
    opt.innerText = file;
    select.appendChild(opt);
  });

  select.value = prev;
}

function updateImgPreview(selectId, imgId) {
  const select = document.getElementById(selectId);
  const img = document.getElementById(imgId);
  if (!select || !img) return;

  const val = select.value;
  if (val) {
    img.src = val;
    img.style.display = 'block';
  } else {
    img.src = '';
    img.style.display = 'none';
  }
}

// ================= ХИЧЭЭЛИЙН ХУВААРИЙН ХҮСНЭГТ =================
function generateScheduleTables() {
  const configs = [
    { id: "sc1Tbody", prefix: "sc1", rows: 7 },
    { id: "sc2Tbody", prefix: "sc2", rows: 7 },
    { id: "tschTbody", prefix: "tsch", rows: 14 }
  ];

  configs.forEach(cfg => {
    const tbody = document.getElementById(cfg.id);
    if (!tbody) return;
    tbody.innerHTML = "";
    for (let i = 1; i <= cfg.rows; i++) {
      let tr = document.createElement("tr");

      let tdP = document.createElement("td");
      tdP.innerHTML = `<b>${i}</b>`;
      tr.appendChild(tdP);

      let tdTime = document.createElement("td");
      let inputTime = document.createElement("input");
      inputTime.type = "text";
      inputTime.id = `${cfg.prefix}_time_${i}`;
      inputTime.value = DEFAULT_TIMES[i - 1] || "";
      tdTime.appendChild(inputTime);
      tr.appendChild(tdTime);

      DAYS.forEach((day, colIdx) => {
        let td = document.createElement("td");
        let input = document.createElement("input");
        input.type = "text";
        input.id = `${cfg.prefix}_${i}_${day}`;
        input.placeholder = "-";
        input.addEventListener("paste", (e) => handleExcelPaste(e, cfg.prefix, i, colIdx));
        td.appendChild(input);
        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    }
  });
}

function handleExcelPaste(e, prefix, startRow, startCol) {
  const clipboardData = e.clipboardData || window.clipboardData;
  const pastedData = clipboardData.getData('Text');
  if (pastedData && (pastedData.includes('\t') || pastedData.includes('\n'))) {
    e.preventDefault();
    fillMatrixFromText(pastedData, prefix, startRow, startCol);
  }
}

function fillMatrixFromText(pastedText, prefix, startRow = 1, startCol = 0) {
  if (!pastedText) return;
  const rows = pastedText.trim().split(/\r\n|\r|\n/);
  const maxRows = (prefix === 'tsch') ? 14 : 7;

  rows.forEach((rowStr, rIdx) => {
    const pIdx = startRow + rIdx;
    if (pIdx > maxRows) return;
    const cols = rowStr.split('\t');
    cols.forEach((cellVal, cIdx) => {
      const targetColIdx = startCol + cIdx;
      if (targetColIdx >= 5) return;
      const day = DAYS[targetColIdx];
      const inputEl = document.getElementById(`${prefix}_${pIdx}_${day}`);
      if (inputEl) inputEl.value = cellVal.trim();
    });
  });
}

function pasteModal(prefix) {
  const text = prompt("Excel-ээс хуулсан мэдээллээ буулгана уу:");
  if (text) fillMatrixFromText(text, prefix, 1, 0);
}

function fillScheduleData(schedObj, prefix, maxRows) {
  schedObj = schedObj || {};
  for (let i = 1; i <= maxRows; i++) {
    const rowData = schedObj[`${i}-р цаг`] || {};
    const timeInput = document.getElementById(`${prefix}_time_${i}`);
    if (timeInput) timeInput.value = rowData.time || DEFAULT_TIMES[i - 1] || "";

    DAYS.forEach(day => {
      const inp = document.getElementById(`${prefix}_${i}_${day}`);
      if (inp) inp.value = rowData[day] || '';
    });
  }
}

function collectScheduleData(prefix, maxRows) {
  let sched = {};
  for (let i = 1; i <= maxRows; i++) {
    const periodKey = `${i}-р цаг`;
    sched[periodKey] = {
      time: document.getElementById(`${prefix}_time_${i}`)?.value.trim() || ''
    };
    DAYS.forEach(day => {
      const inp = document.getElementById(`${prefix}_${i}_${day}`);
      sched[periodKey][day] = inp ? inp.value.trim() : '';
    });
  }
  return sched;
}

// ================= БҮХ ӨГӨГДЛИЙГ АЧААЛАХ =================
async function loadAdminData() {
  try {
    await loadUploadsList();

    const setRes = await fetch('/api/school-settings');
    if (setRes.ok) {
      const s = await setRes.json();
      document.getElementById('floor1Select').value = s.floor1Image || '';
      document.getElementById('floor2Select').value = s.floor2Image || '';
      document.getElementById('model3dSelect').value = s.model3d || '';
    }

    const res = await fetch('/api/rooms');
    if (res.ok) roomsData = await res.json();

    const tRes = await fetch('/api/teachers');
    if (tRes.ok) teachersData = await tRes.json();

    const msRes = await fetch('/api/master-schedule');
    if (msRes.ok) masterScheduleData = await msRes.json();
    renderMasterScheduleViewer();

    populateRoomDropdown();
    updateCoordRoomDropdown(roomsData);
    populateTeacherRoomDropdown();
    populateTeacherDropdown();

    changeCoordFloor();

    document.getElementById('adminRoomSelect').value = "";
    prepareNewRoomForm();

    document.getElementById('teacherSelect').value = "";
    prepareNewTeacherForm();
  } catch (e) {
    console.error(e);
  }
}

// ================= АНГИ (ӨРӨӨ) =================
function populateRoomDropdown() {
  const select = document.getElementById('adminRoomSelect');
  if (!select) return;

  select.innerHTML = '<option value="">-- Засах ангиа сонгоно уу --</option>';
  if (roomsData.length === 0) return;

  const sortedRooms = [...roomsData].sort((a, b) =>
    String(a.roomNumber || '').localeCompare(String(b.roomNumber || ''), undefined, { numeric: true, sensitivity: 'base' })
  );

  sortedRooms.forEach(r => {
    const opt = document.createElement('option');
    opt.value = r.roomNumber;
    opt.innerText = `${r.roomNumber} тоот ${r.name ? '(' + r.name + ')' : ''}`;
    select.appendChild(opt);
  });
}

function loadSelectedRoomToForm() {
  const num = document.getElementById('adminRoomSelect').value;
  const room = roomsData.find(r => String(r.roomNumber) === String(num));
  if (!room) return;

  document.getElementById('roomId').value = room.id || '';
  document.getElementById('roomNumber').value = room.roomNumber || '';
  document.getElementById('roomName').value = room.name || '';
  document.getElementById('class1Group').value = room.class1Group || '';
  document.getElementById('class2Group').value = room.class2Group || '';
  document.getElementById('class1Info').value = room.class1Info || '';
  document.getElementById('class2Info').value = room.class2Info || '';

  document.getElementById('roomPanorama').value = room.panorama || '';
  updateImgPreview('roomPanorama', 'prevPano');

  fillScheduleData(room.scheduleClass1, "sc1", 7);
  fillScheduleData(room.scheduleClass2, "sc2", 7);
}

function prepareNewRoomForm() {
  document.getElementById('roomId').value = '';
  document.getElementById('roomForm').reset();

  document.getElementById('roomPanorama').value = '';
  updateImgPreview('roomPanorama', 'prevPano');

  fillScheduleData({}, "sc1", 7);
  fillScheduleData({}, "sc2", 7);
}

async function saveRoomData() {
  const roomNum = document.getElementById('roomNumber').value.trim();
  if (!roomNum) {
    alert("⚠️ Ангийн дугаарыг (Тоот) заавал оруулна уу!");
    return;
  }

  let imageUrls = [];
  const imageInput = document.getElementById('roomImagesInput');
  const existingRoom = roomsData.find(r => String(r.roomNumber) === String(roomNum));

  if (imageInput && imageInput.files && imageInput.files.length > 0) {
    if (imageInput.files.length > 5) {
      alert('Хамгийн ихдээ 5 зураг сонгох боломжтой!');
      return;
    }

    const formData = new FormData();
    for (let i = 0; i < imageInput.files.length; i++) {
      formData.append('images', imageInput.files[i]);
    }

    try {
      const uploadRes = await fetch('/api/upload-multiple', {
        method: 'POST',
        headers: authHeaders(),
        body: formData
      });
      const uploadData = await uploadRes.json();
      if (uploadData.success) {
        imageUrls = uploadData.filePaths;
      } else {
        alert('⚠️ Зураг хуулж чадсангүй: ' + (uploadData.error || 'алдаа гарлаа'));
        return;
      }
    } catch (err) {
      console.error('Зураг хуулахад алдаа гарлаа:', err);
      alert('⚠️ Зураг хуулж чадсангүй.');
      return;
    }
  } else if (existingRoom && existingRoom.images) {
    imageUrls = existingRoom.images;
  } else if (existingRoom && existingRoom.image) {
    imageUrls = [existingRoom.image];
  }

  const payload = {
    id: document.getElementById('roomId').value || Date.now().toString(),
    roomNumber: roomNum,
    name: document.getElementById('roomName').value.trim(),
    panorama: document.getElementById('roomPanorama').value,
    image: imageUrls[0] || '',
    images: imageUrls,
    class1Group: document.getElementById('class1Group').value.trim(),
    class2Group: document.getElementById('class2Group').value.trim(),
    class1Info: document.getElementById('class1Info').value.trim(),
    class2Info: document.getElementById('class2Info').value.trim(),
    scheduleClass1: collectScheduleData("sc1", 7),
    scheduleClass2: collectScheduleData("sc2", 7)
  };

  try {
    const res = await fetch('/api/rooms', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (res.ok && data.success) {
      alert("✅ Мэдээлэл амжилттай хадгалагдлаа!");
      const resRooms = await fetch('/api/rooms');
      if (resRooms.ok) {
        roomsData = await resRooms.json();
        populateRoomDropdown();
        updateCoordRoomDropdown(roomsData);
        populateTeacherRoomDropdown();
      }
      prepareNewRoomForm();
      const roomSelect = document.getElementById('adminRoomSelect');
      if (roomSelect) roomSelect.value = "";
    } else {
      alert("⚠️ Хадгалахад алдаа гарлаа.");
    }
  } catch (err) {
    console.error(err);
    alert("⚠️ Сервертэй холбогдож чадсангүй.");
  }
}

async function deleteCurrentRoom() {
  const roomNum = document.getElementById('roomNumber').value;
  if (!roomNum) return;
  if (confirm(`${roomNum} тоот ангийг устгах уу?`)) {
    await fetch(`/api/rooms/${encodeURIComponent(roomNum)}`, { method: 'DELETE', headers: authHeaders() });
    loadAdminData();
  }
}

// ================= БАГШ (ангиас тусдаа) =================
function getTeacherRooms(t) {
  if (!t) return [];
  const arr = Array.isArray(t.roomNumbers) ? t.roomNumbers : (t.roomNumber ? [t.roomNumber] : []);
  return [...new Set(arr.map(x => String(x).trim()).filter(Boolean))];
}

function getSelectedTeacherRooms() {
  return [...document.querySelectorAll('#teacherRoomList input[type="checkbox"]:checked')].map(cb => cb.value);
}

function updateTeacherRoomSummary() {
  const el = document.getElementById('teacherRoomSummary');
  if (!el) return;
  const sel = getSelectedTeacherRooms();
  el.textContent = sel.length ? `Сонгосон (${sel.length}): ${sel.join(', ')}` : 'Кабинет сонгоогүй';
}

function makeRoomCheckbox(value, labelText, isOrphan) {
  const wrap = document.createElement('label');
  wrap.style.cssText = 'display:flex; align-items:center; gap:6px; margin:0; font-size:13px; color:#e2e8f0; cursor:pointer; white-space:nowrap;';
  if (isOrphan) wrap.dataset.orphan = '1';

  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.value = value;
  cb.style.cssText = 'width:auto; margin:0; padding:0;';
  cb.addEventListener('change', updateTeacherRoomSummary);

  const span = document.createElement('span');
  span.textContent = labelText;

  wrap.appendChild(cb);
  wrap.appendChild(span);
  return wrap;
}

function setSelectedTeacherRooms(list) {
  const box = document.getElementById('teacherRoomList');
  if (!box) return;
  const want = new Set((list || []).map(String));

  box.querySelectorAll('[data-orphan]').forEach(el => el.remove());
  const have = new Set([...box.querySelectorAll('input')].map(cb => cb.value));
  want.forEach(v => {
    if (!have.has(v)) box.appendChild(makeRoomCheckbox(v, `${v} (⚠️ жагсаалтад алга)`, true));
  });

  box.querySelectorAll('input').forEach(cb => { cb.checked = want.has(cb.value); });
  updateTeacherRoomSummary();
}

function populateTeacherRoomDropdown() {
  const box = document.getElementById('teacherRoomList');
  if (!box) return;

  const prev = getSelectedTeacherRooms();
  box.innerHTML = '';

  const sortedRooms = [...roomsData].sort((a, b) =>
    String(a.roomNumber || '').localeCompare(String(b.roomNumber || ''), undefined, { numeric: true, sensitivity: 'base' })
  );

  sortedRooms.forEach(r => {
    const label = `${r.roomNumber} тоот${r.name ? ' (' + r.name + ')' : ''}`;
    box.appendChild(makeRoomCheckbox(String(r.roomNumber), label, false));
  });

  setSelectedTeacherRooms(prev);
}

function populateTeacherDropdown() {
  const select = document.getElementById('teacherSelect');
  if (!select) return;

  const prev = select.value;
  select.innerHTML = '<option value="">-- Засах багшаа сонгоно уу --</option>';

  const givenName = (full) => {
    const s = String(full || '').trim();
    const i = s.lastIndexOf('.');
    return (i >= 0 ? s.slice(i + 1) : s).trim();
  };
  const collator = new Intl.Collator('mn', { sensitivity: 'base' });

  const sorted = [...teachersData].sort((a, b) =>
    collator.compare(givenName(a.name), givenName(b.name)) ||
    collator.compare(String(a.name || ''), String(b.name || ''))
  );

  sorted.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.innerText = `${t.name}${t.subject ? ' - ' + t.subject : ''}`;
    select.appendChild(opt);
  });

  select.value = prev;
}

function loadSelectedTeacherToForm() {
  const id = document.getElementById('teacherSelect').value;
  const t = teachersData.find(x => String(x.id) === String(id));
  if (!t) return;

  document.getElementById('teacherId').value = t.id || '';
  document.getElementById('teacherName').value = t.name || '';
  document.getElementById('teacherSubject').value = t.subject || '';
  document.getElementById('teacherHomeroom').value = t.homeroomClass || '';
  document.getElementById('teacherPhone').value = t.phone || '';
  setSelectedTeacherRooms(getTeacherRooms(t));
  document.getElementById('teacherImage').value = t.image || '';
  document.getElementById('teacherImageFile').value = '';
  updateImgPreview('teacherImage', 'prevTeacher');

  fillScheduleData(t.schedule, "tsch", 14);
}

function prepareNewTeacherForm() {
  document.getElementById('teacherId').value = '';
  document.getElementById('teacherForm').reset();
  document.getElementById('teacherSelect').value = '';
  setSelectedTeacherRooms([]);
  document.getElementById('teacherImage').value = '';
  updateImgPreview('teacherImage', 'prevTeacher');
  fillScheduleData({}, "tsch", 14);
}

async function saveTeacherData() {
  const name = document.getElementById('teacherName').value.trim();
  if (!name) {
    alert("⚠️ Багшийн нэрийг заавал оруулна уу!");
    return;
  }

  let image = document.getElementById('teacherImage').value;
  const fileInput = document.getElementById('teacherImageFile');
  if (fileInput && fileInput.files && fileInput.files.length > 0) {
    const formData = new FormData();
    formData.append('images', fileInput.files[0]);
    try {
      const upRes = await fetch('/api/upload-multiple', {
        method: 'POST',
        headers: authHeaders(),
        body: formData
      });
      const upData = await upRes.json();
      if (upData.success && upData.filePaths && upData.filePaths.length > 0) {
        image = upData.filePaths[0];
      } else {
        alert('⚠️ Зураг хуулж чадсангүй.');
        return;
      }
    } catch (err) {
      console.error(err);
      alert('⚠️ Зураг хуулж чадсангүй.');
      return;
    }
  }

  const payload = {
    id: document.getElementById('teacherId').value || '',
    name: name,
    subject: document.getElementById('teacherSubject').value.trim(),
    homeroomClass: document.getElementById('teacherHomeroom').value.trim(),
    phone: document.getElementById('teacherPhone').value.trim(),
    roomNumbers: getSelectedTeacherRooms(),
    roomNumber: getSelectedTeacherRooms()[0] || '',
    image: image,
    schedule: collectScheduleData("tsch", 14)
  };

  try {
    const res = await fetch('/api/teachers', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (res.ok && data.success) {
      alert("✅ Багшийн мэдээлэл амжилттай хадгалагдлаа!");
      const tRes = await fetch('/api/teachers');
      if (tRes.ok) teachersData = await tRes.json();

      await loadUploadsList();
      populateTeacherDropdown();
      populateTeacherRoomDropdown();
      prepareNewTeacherForm();
      const teacherSelect = document.getElementById('teacherSelect');
      if (teacherSelect) teacherSelect.value = "";
    } else {
      alert("⚠️ Хадгалахад алдаа гарлаа.");
    }
  } catch (err) {
    console.error(err);
    alert("⚠️ Сервертэй холбогдож чадсангүй.");
  }
}

async function deleteCurrentTeacher() {
  const id = document.getElementById('teacherId').value;
  const name = document.getElementById('teacherName').value;
  if (!id) {
    alert("Устгах багшаа эхлээд сонгоно уу.");
    return;
  }
  if (!confirm(`${name} багшийг устгах уу?`)) return;

  try {
    const res = await fetch(`/api/teachers/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: authHeaders()
    });
    if (res.ok) {
      const tRes = await fetch('/api/teachers');
      if (tRes.ok) teachersData = await tRes.json();
      document.getElementById('teacherSelect').value = '';
      populateTeacherDropdown();
      prepareNewTeacherForm();
    } else {
      alert("⚠️ Устгахад алдаа гарлаа.");
    }
  } catch (err) {
    console.error(err);
  }
}

// ================= EXCEL ИМПОРТ =================
let importParsed = null;
let importSheetIdx = 0;
let masterScheduleData = [];

function escapeHtmlAdmin(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function normNameAdmin(s) {
  return String(s || '').replace(/\s+/g, '').toLowerCase();
}

function setImportStatus(msg, isError) {
  const el = document.getElementById('importStatus');
  if (!el) return;
  el.style.color = isError ? '#fca5a5' : '#94a3b8';
  el.innerText = msg || '';
}

function onImportFileChange() {
  const input = document.getElementById('importFile');
  const shift = document.getElementById('importShift');
  resetImport(true);
  if (!input.files.length) return;
  const name = input.files[0].name.toLowerCase();
  if (name.includes('дунд')) shift.value = '2';
  else if (name.includes('ахлах')) shift.value = '1';
}

function resetImport(keepFile) {
  importParsed = null;
  importSheetIdx = 0;
  const box = document.getElementById('importPreview');
  if (box) box.style.display = 'none';
  setImportStatus('');
  if (!keepFile) {
    const input = document.getElementById('importFile');
    if (input) input.value = '';
  }
}

async function parseImportFile() {
  const input = document.getElementById('importFile');
  if (!input.files.length) {
    alert('⚠️ Эхлээд Excel файлаа (.xlsx) сонгоно уу.');
    return;
  }

  const fd = new FormData();
  fd.append('shift', document.getElementById('importShift').value);
  fd.append('file', input.files[0]);

  setImportStatus('⏳ Файлыг уншиж байна...');
  try {
    const res = await fetch('/api/import/parse', {
      method: 'POST',
      headers: authHeaders(),
      body: fd
    });
    const data = await res.json();

    if (!res.ok || !data.success) {
      document.getElementById('importPreview').style.display = 'none';
      setImportStatus('⚠️ ' + (data.message || data.error || 'Файлыг уншиж чадсангүй.'), true);
      return;
    }

    importParsed = data;
    importSheetIdx = data.recommended || 0;
    setImportStatus('✅ Файл амжилттай уншигдлаа.');
    renderImportPreview();
  } catch (err) {
    console.error(err);
    setImportStatus('⚠️ Сервертэй холбогдож чадсангүй.', true);
  }
}

function onImportSheetChange(value) {
  importSheetIdx = Number(value) || 0;
  renderImportPreview();
}

function renderImportPreview() {
  if (!importParsed) return;
  const sheets = importParsed.sheets;
  const sheet = sheets[importSheetIdx];
  document.getElementById('importPreview').style.display = 'block';

  const sheetBox = document.getElementById('importSheetBox');
  if (sheets.length > 1) {
    sheetBox.innerHTML = `
      <label style="color:#38bdf8;">📄 Файлаас ${sheets.length} хуудас олдлоо:</label>
      <select onchange="onImportSheetChange(this.value)">
        ${sheets.map((s, i) => `<option value="${i}" ${i === importSheetIdx ? 'selected' : ''}>
          "${escapeHtmlAdmin(s.name)}" - ${s.teachersWithLessons} багш, ${s.lessons} хичээл
        </option>`).join('')}
      </select>`;
  } else {
    sheetBox.innerHTML = '';
  }

  const existing = new Set(teachersData.map(t => normNameAdmin(t.name)));
  let newCount = 0, updCount = 0, skipCount = 0;
  const skipEmpty = document.getElementById('importSkipEmpty').checked;

  const rows = sheet.teachers.map((t, i) => {
    const s1 = t.cells.filter(c => c[1] <= 7).length;
    const s2 = t.cells.filter(c => c[1] > 7).length;
    const isExisting = existing.has(normNameAdmin(t.name));
    let status;
    if (t.cells.length === 0 && !isExisting && skipEmpty) { status = '<span class="st-skip">⏭ Хичээлгүй - алгасна</span>'; skipCount++; }
    else if (isExisting) { status = '<span class="st-upd">🔄 Байгаа багш - нэмэгдэнэ</span>'; updCount++; }
    else { status = '<span class="st-new">🆕 Шинэ багш</span>'; newCount++; }
    return `<tr>
      <td>${i + 1}</td>
      <td>${escapeHtmlAdmin(t.name)}</td>
      <td>${escapeHtmlAdmin(t.subject || '-')}</td>
      <td>${s1 || '-'}</td>
      <td>${s2 || '-'}</td>
      <td>${status}</td>
    </tr>`;
  });
  document.getElementById('importTbody').innerHTML = rows.join('');

  document.getElementById('importSummary').innerHTML = `
    📄 Хуудас: <b>"${escapeHtmlAdmin(sheet.name)}"</b> · Нийт <b>${sheet.teacherCount}</b> багш<br>
    🆕 Шинэ: <b class="st-new">${newCount}</b> · 🔄 Шинэчлэгдэх: <b class="st-upd">${updCount}</b> · ⏭ Алгасах: <b class="st-skip">${skipCount}</b>`;
}

async function applyImport() {
  if (!importParsed) return;
  const sheet = importParsed.sheets[importSheetIdx];

  const clearShifts = [];
  if (document.getElementById('importClear1').checked) clearShifts.push(1);
  if (document.getElementById('importClear2').checked) clearShifts.push(2);

  let question = `"${sheet.name}" хуудасны ${sheet.teacherCount} багшийн хуваарийг хадгалах уу?`;
  if (!confirm(question)) return;

  const payload = {
    teachers: sheet.teachers.map(t => ({ name: t.name, subject: t.subject, cells: t.cells })),
    clearShifts,
    skipEmpty: document.getElementById('importSkipEmpty').checked
  };

  setImportStatus('⏳ Хадгалж байна...');
  try {
    const res = await fetch('/api/import/apply', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (res.ok && data.success) {
      alert(`✅ Амжилттай татагдлаа! Нийт багш: ${data.total}`);
      const tRes = await fetch('/api/teachers');
      if (tRes.ok) teachersData = await tRes.json();
      populateTeacherDropdown();
      renderImportPreview();
      setImportStatus(`✅ Татаж дууслаа.`);
    } else {
      setImportStatus('⚠️ Хадгалахад алдаа гарлаа.', true);
    }
  } catch (err) {
    console.error(err);
    setImportStatus('⚠️ Сервертэй холбогдож чадсангүй.', true);
  }
}

async function saveSchoolSettings() {
  const payload = {
    floor1Image: document.getElementById('floor1Select').value,
    floor2Image: document.getElementById('floor2Select').value,
    model3d: document.getElementById('model3dSelect').value
  };
  const r = await fetch('/api/school-settings', {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload)
  });
  if (r.ok) alert("✅ Сургуулийн тохиргоо амжилттай хадгалагдлаа!");
  else alert("⚠️ Хадгалахад алдаа гарлаа.");
}

window.onload = () => {
  generateScheduleTables();
  checkAuth();
  const skipBox = document.getElementById('importSkipEmpty');
  if (skipBox) skipBox.addEventListener('change', renderImportPreview);
};

// ================= 2D КООРДИНАТ ТОХИРУУЛАХ =================
let currentClickCoords = null;

function onMapClick(event) {
  const img = document.getElementById('coordMapImg');
  const rect = img.getBoundingClientRect();

  const xPercent = ((event.clientX - rect.left) / rect.width) * 100;
  const yPercent = ((event.clientY - rect.top) / rect.height) * 100;
  const floor = document.getElementById('coordFloorSelect').value;

  currentClickCoords = {
    floor: Number(floor),
    x: Number(xPercent.toFixed(2)),
    y: Number(yPercent.toFixed(2))
  };

  const marker = document.getElementById('clickMarker');
  marker.style.left = `${currentClickCoords.x}%`;
  marker.style.top = `${currentClickCoords.y}%`;
  marker.style.display = 'block';
}

function changeCoordFloor() {
  const floor = document.getElementById('coordFloorSelect').value;
  const img = document.getElementById('coordMapImg');
  const marker = document.getElementById('clickMarker');

  if (marker) marker.style.display = 'none';
  currentClickCoords = null;

  const floor1Path = document.getElementById('floor1Select')?.value;
  const floor2Path = document.getElementById('floor2Select')?.value;

  if (img) {
    img.src = (floor === '1') ? (floor1Path || '/uploads/floor1.png') : (floor2Path || '/uploads/plan22.png');
  }

  renderSavedAdminMarkers();
}

async function saveRoomCoords() {
  const roomNum = document.getElementById('coordRoomSelect').value;
  if (!roomNum) return alert('Ангиа сонгоно уу!');
  if (!currentClickCoords) return alert('Зураг дээр даран байршлын цэгээ зааж өгнө үү!');

  try {
    const res = await fetch(`/api/rooms/${encodeURIComponent(roomNum)}/coords`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(currentClickCoords)
    });

    if (res.ok) {
      alert(`${roomNum} тоот ангийн 2D байршил амжилттай хадгалагдлаа!`);
      const roomRes = await fetch('/api/rooms');
      if (roomRes.ok) {
        roomsData = await roomRes.json();
        renderSavedAdminMarkers();
      }
    } else {
      alert('Хадгалахад алдаа гарлаа.');
    }
  } catch (err) {
    console.error(err);
  }
}

function updateCoordRoomDropdown(rooms) {
  const select = document.getElementById('coordRoomSelect');
  if (!select) return;
  select.innerHTML = '<option value="">-- Анги сонгох --</option>';

  const sortedRooms = [...(rooms || [])].sort((a, b) =>
    String(a.roomNumber || '').localeCompare(String(b.roomNumber || ''), undefined, { numeric: true, sensitivity: 'base' })
  );

  sortedRooms.forEach(r => {
    const opt = document.createElement('option');
    opt.value = r.roomNumber;
    opt.innerText = `${r.roomNumber} тоот (${r.name || 'Нэргүй'})`;
    select.appendChild(opt);
  });
}

function renderSavedAdminMarkers() {
  const floor = document.getElementById('coordFloorSelect').value;
  const wrapper = document.getElementById('coordMapWrapper');

  document.querySelectorAll('.admin-saved-pin').forEach(el => el.remove());

  roomsData.forEach(r => {
    if (r.coords && String(r.coords.floor) === String(floor)) {
      const pin = document.createElement('div');
      pin.className = 'admin-saved-pin';
      pin.style.position = 'absolute';
      pin.style.left = `${r.coords.x}%`;
      pin.style.top = `${r.coords.y}%`;
      pin.style.transform = 'translate(-50%, -50%)';
      pin.style.background = '#0284c7';
      pin.style.color = 'white';
      pin.style.padding = '3px 7px';
      pin.style.borderRadius = '12px';
      pin.style.fontSize = '11px';
      pin.style.fontWeight = 'bold';
      pin.style.border = '1px solid white';
      pin.style.boxShadow = '0 0 6px rgba(0,0,0,0.5)';
      pin.style.pointerEvents = 'none';
      pin.innerText = `🏫 ${r.roomNumber}`;

      wrapper.appendChild(pin);
    }
  });
}

// ================= НЭГДСЭН ХУВААРЬ =================
async function saveToMasterSchedule() {
  if (!importParsed) {
    alert('Эхлээд Excel файлаа уншиж харна уу.');
    return;
  }
  const sheet = importParsed.sheets[importSheetIdx];

  try {
    const res = await fetch('/api/master-schedule', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(sheet.teachers)
    });
    const data = await res.json();
    if (res.ok && data.success) {
      alert(`✅ Нэгдсэн хуваарьт ${data.count} багшийн мэдээлэл хадгалагдлаа!`);
      const msRes = await fetch('/api/master-schedule');
      if (msRes.ok) masterScheduleData = await msRes.json();
      renderMasterScheduleViewer();
    } else {
      alert('⚠️ Хадгалахад алдаа гарлаа.');
    }
  } catch (err) {
    console.error(err);
    alert('⚠️ Сервертэй холбогдож чадсангүй.');
  }
}

function renderMasterScheduleViewer() {
  const tbody = document.getElementById('masterSchedTbody');
  const countEl = document.getElementById('masterSchedCount');
  if (!tbody) return;

  if (masterScheduleData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#64748b; padding:15px;">Одоогоор хоосон байна.</td></tr>';
    if (countEl) countEl.innerText = '';
    return;
  }

  const sorted = [...masterScheduleData]
    .map((t, i) => ({ ...t, _origIndex: i }))
    .sort((a, b) => String(a.name).localeCompare(String(b.name), undefined, { sensitivity: 'base' }));

  tbody.innerHTML = sorted.map((t, i) => `
    <tr data-ms-row="${t._origIndex}">
      <td>${i + 1}</td>
      <td><input type="text" value="${escapeHtmlAdmin(t.name)}" data-ms-name="${t._origIndex}" style="margin-bottom:0;"></td>
      <td>${escapeHtmlAdmin(t.subject || '-')}</td>
      <td style="text-align:center;">${(t.cells || []).length}</td>
      <td style="text-align:center;"><button type="button" class="btn btn-danger" style="padding:4px 8px; font-size:11px;" onclick="deleteMasterScheduleRow(${t._origIndex})">🗑️</button></td>
    </tr>
  `).join('');

  if (countEl) countEl.innerText = `Нийт ${masterScheduleData.length} багш`;
  filterMasterScheduleViewer();
}

function filterMasterScheduleViewer() {
  const q = (document.getElementById('masterSchedSearch')?.value || '').trim().toLowerCase();
  document.querySelectorAll('#masterSchedTbody tr[data-ms-row]').forEach(tr => {
    const nameInput = tr.querySelector('input[data-ms-name]');
    const text = (nameInput ? nameInput.value : tr.innerText).toLowerCase();
    tr.style.display = (!q || text.includes(q)) ? '' : 'none';
  });
}

async function saveMasterScheduleNameEdits() {
  const updated = masterScheduleData.map((t, i) => {
    const input = document.querySelector(`input[data-ms-name="${i}"]`);
    return { ...t, name: input ? input.value.trim() : t.name };
  });

  try {
    const res = await fetch('/api/master-schedule', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(updated)
    });
    const data = await res.json();
    if (res.ok && data.success) {
      alert('✅ Нэрийн засвар хадгалагдлаа!');
      const msRes = await fetch('/api/master-schedule');
      if (msRes.ok) masterScheduleData = await msRes.json();
      renderMasterScheduleViewer();
    }
  } catch (err) {
    console.error(err);
  }
}

async function deleteMasterScheduleRow(origIndex) {
  const t = masterScheduleData[origIndex];
  if (!t) return;
  if (!confirm(`"${t.name}" мөрийг устгах уу?`)) return;

  const updated = masterScheduleData.filter((_, i) => i !== origIndex);
  try {
    const res = await fetch('/api/master-schedule', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(updated)
    });
    if (res.ok) {
      const msRes = await fetch('/api/master-schedule');
      if (msRes.ok) masterScheduleData = await msRes.json();
      renderMasterScheduleViewer();
    }
  } catch (err) {
    console.error(err);
  }
}

function pullScheduleForTeacher() {
  const nameInput = document.getElementById('teacherName');
  const name = (nameInput?.value || '').trim();
  if (!name) {
    alert('Эхлээд багшийн нэрийг бичнэ үү.');
    return;
  }

  const key = normNameAdmin(name);
  const match = masterScheduleData.find(t => normNameAdmin(t.name) === key);
  if (!match) {
    alert(`⚠️ "${name}" нэртэй багш нэгдсэн хуваариас олдсонгүй.`);
    return;
  }

  const schedObj = {};
  for (let p = 1; p <= 14; p++) {
    schedObj[`${p}-р цаг`] = { time: DEFAULT_TIMES[p - 1] || '' };
    DAYS.forEach(d => { schedObj[`${p}-р цаг`][d] = ''; });
  }
  (match.cells || []).forEach(([dayIdx, period, text]) => {
    const day = DAYS[dayIdx];
    if (!day || period < 1 || period > 14) return;
    schedObj[`${period}-р цаг`][day] = text;
  });

  fillScheduleData(schedObj, "tsch", 14);
  const subjectInput = document.getElementById('teacherSubject');
  if (subjectInput && !subjectInput.value.trim() && match.subject) {
    subjectInput.value = match.subject;
  }
  alert(`✅ "${match.name}" багшийн хуваарь татагдлаа.`);
}

// ================= EXCEL PASTE ЛОГИК =================
function handleAdminGridPaste(e, startTeacherIdx, startColIndex) {
  const clipboardData = e.clipboardData || window.clipboardData;
  const pastedData = clipboardData.getData('Text');
  
  // Хэрэв хуулсан өгөгдөл хоосон эсвэл хүснэгтийн бүтэцгүй байвал энгийн paste хийх горимд үлдээнэ
  if (!pastedData) return;

  e.preventDefault();

  // Excel-ээс хуулахад мөр нь \r\n эсвэл \n-ээр, багана нь \t (tab)-аар тусгаарлагддаг
  const rows = pastedData.split(/\r\n|\r|\n/).filter(row => row.length > 0);

  rows.forEach((rowStr, rIdx) => {
    const tIdx = startTeacherIdx + rIdx;
    const inputsInRow = document.querySelectorAll(`input.sched-input-cell[data-teacher-index="${tIdx}"]`);
    if (!inputsInRow.length) return;

    const cols = rowStr.split('\t');
    cols.forEach((cellVal, cIdx) => {
      const targetColIdx = startColIndex + cIdx;
      if (targetColIdx >= 70) return; // Нийт 5 өдөр * 14 цаг = 70 багана

      const targetInput = inputsInRow[targetColIdx];
      if (targetInput) {
        targetInput.value = cellVal.trim();
      }
    });
  });
}
window.handleAdminGridPaste = handleAdminGridPaste;
window.handleAdminGridPaste = handleAdminGridPaste;

// ================= ХУВААРЬ ОРУУЛАХ ТАБЫН ХҮСНЭГТ =================
function renderAdminScheduleInput() {
  const container = document.getElementById('adminScheduleTableContainer');
  if (!container) return;

  // Зөвхөн энэ хүснэгтэд үйлчлэх дараалал
const customOrder = [
    "М.Болор", "Ц.Дэлгэрмаа", "Г.Нэргүй", "Тү.Оюунтуяа", "Ц.Наранцацрал", 
    "Г.Аззаяа", "Ц.Энхчимэг", "А.Соёлмаа", "Ж.Отгонбилэг", "Э.Батболд", 
    "Б.Мөнхбаяр", "Н.Мөнх-Од", "Н.Цолмон", "Д.Ариунтуул", "Б.Одмаа", 
    "С.Мөнхцэцэг", "С.Шүрэнцэцэг", "Э.Цогзолмаа", "Б.Ариунцэцэг", "Л.Авирмэд", 
    "Г.Одмаа", "Л.Бямбадорж", "З.Наранцацрал", "Д.Ариумаа", "Э.Ганцэцэг", 
    "Ө.Цолмонбаатар", "А.Ууганбаяр", "Б.Үүрийнтуяа", "Г.Ундрахбаяр", "М.Оюунсарнай", 
    "Б.Алтанчимэг", "А.Доржпүрэв", "Н.Нандинцэцэг", "Ү.Магсармаа", "Тө.Оюунтуяа", 
    "М.Хонгорзул", "О.Ганбаяр", "Д.Жаргалсайхан", "Н.Хулан", "Н.Жавзан", 
    "Э.Түмэндэмбэрэл", "М.Аззаяа", "Э.Отгонпүрэв", "М.Түвшинбат", "Э.Уртнасан", 
    "Д.Алтанцоож", "П.Эрдэнэцэцэг", "Л.Мөнхбаяр", "Ч.Төмөрбаатар", "М.Хулан", 
    "М.Мөнхбаяр", "Д.Хулан", "Б.Гэрэлмандах", "П.Мөнхтайван", "Г.Мөнгөнбаясгалан", 
    "Э.Лундаажанцан", "Ц.Отгонбат", "Ц.Ариунтуяа", "Г.Наранзул", "П.Мөнхсайхан", "М.Оюунсүх"
  ];

  let teachers = [];
  customOrder.forEach(name => {
    const found = teachersData.find(t => (t.name || '').trim() === name.trim());
    if (found) teachers.push(found);
  });
  
  teachersData.forEach(t => {
    if (!teachers.some(existing => (existing.name || '').trim() === (t.name || '').trim())) {
      teachers.push(t);
    }
  });

  if (!teachers.length) {
    container.innerHTML = `<div class="admin-empty">Багшийн мэдээлэл олдсонгүй</div>`;
    return;
  }

  const days = ['Даваа', 'Мягмар', 'Лхагва', 'Пүрэв', 'Баасан'];
  let dayHeaderHtml = '';
  let subHeaderHtml = '';

  days.forEach((day, dIndex) => {
    const isLastDay = dIndex === days.length - 1;
    const dayBorderRight = isLastDay ? '1px solid #334155' : '3px solid #38bdf8';

    dayHeaderHtml += `<th colspan="14" style="border: 1px solid #334155; border-right: ${dayBorderRight}; background: #0f172a; color: #38bdf8; text-align: center; padding: 6px; font-size: 13px;">${escapeHtmlAdmin(day)}</th>`;
    
    for (let i = 1; i <= 2; i++) {
      for (let p = 1; p <= 7; p++) {
        let subBorderRight = '1px solid #334155';
        if (p === 7 && i === 1) subBorderRight = '2px solid #64748b';
        else if (p === 7 && i === 2) subBorderRight = dayBorderRight;

        subHeaderHtml += `<th style="border: 1px solid #334155; border-right: ${subBorderRight}; background: #1e293b; color: #38bdf8; text-align: center; width: 30px; font-size: 10px; padding: 4px 2px;">${p}</th>`;
      }
    }
  });

  let rowsHtml = '';
  teachers.forEach((t, tIdx) => {
    let cellsHtml = '';
    let globalColIdx = 0;

    days.forEach((day, dIndex) => {
      const isLastDay = dIndex === days.length - 1;
      const dayBorderRight = isLastDay ? '1px solid #334155' : '3px solid #38bdf8';

      const getLessonVal = (teacherObj, dayName, periodNum) => {
        if (!teacherObj || !teacherObj.schedule) return '';
        for (let key in teacherObj.schedule) {
          if (key.startsWith(periodNum + '-')) {
            return teacherObj.schedule[key][dayName] || '';
          }
        }
        return '';
      };

      for (let p = 1; p <= 14; p++) {
        const val = getLessonVal(t, day, p);
        const isEndOfShift = (p === 7);
        const isEndOfDay = (p === 14);
        let cellBorderRight = '1px solid #334155';
        if (isEndOfShift) cellBorderRight = '2px solid #64748b';
        if (isEndOfDay) cellBorderRight = dayBorderRight;

        const currentGlobalCol = globalColIdx;
        cellsHtml += `<td style="border: 1px solid #334155; border-right: ${cellBorderRight}; text-align: center; padding: 2px; font-size: 11px;">
          <input type="text" value="${escapeHtmlAdmin(val)}" data-teacher-id="${escapeHtmlAdmin(t.id)}" data-teacher-index="${tIdx}" data-col-index="${currentGlobalCol}" data-day="${day}" data-period="${p}" class="sched-input-cell" onpaste="handleAdminGridPaste(event, ${tIdx}, ${currentGlobalCol})" style="width: 100%; background: #0f172a; border: 1px solid #334155; color: #f8fafc; text-align: center; font-size: 11px; padding: 4px 0; border-radius: 3px;" />
        </td>`;
        globalColIdx++;
      }
    });

    rowsHtml += `
      <tr>
        <td style="border: 1px solid #334155; border-right: 3px solid #38bdf8; padding: 8px; font-weight: bold; text-align: left; background: #1e293b; white-space: nowrap; position: sticky; left: 0; z-index: 2; color: #38bdf8;">${escapeHtmlAdmin(t.name)}</td>
        ${cellsHtml}
      </tr>
    `;
  });

  container.innerHTML = `
    <div style="margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
      <span style="font-size: 12px; color: #94a3b8;">💡 Ангийн дугаар (жишээ нь: 11а, 9д) шууд бичих эсвэл Excel-ээс хуулаад (Ctrl+V) тавих боломжтой.</span>
      <button type="button" class="btn btn-primary" onclick="saveAllAdminSchedules()" style="padding: 8px 20px; font-size: 13px;">💾 Бүх хуваарийг хадгалах</button>
    </div>
    <div class="admin-table-wrap" style="overflow-x: auto; max-height: 70vh; border: 1px solid #334155; border-radius: 6px;">
      <table class="admin-table" style="border-collapse: collapse; width: max-content; min-width: 100%;">
        <thead>
          <tr>
            <th rowspan="2" style="border: 1px solid #334155; border-right: 3px solid #38bdf8; background: #0f172a; color: #38bdf8; vertical-align: middle; text-align: center; padding: 8px; position: sticky; left: 0; z-index: 3;">Багш нар</th>
            ${dayHeaderHtml}
          </tr>
          <tr>
            ${subHeaderHtml}
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </div>`;
}
window.renderAdminScheduleInput = renderAdminScheduleInput;

async function saveAllAdminSchedules() {
  const inputs = document.querySelectorAll('.sched-input-cell');
  const updatesMap = {};

  inputs.forEach(input => {
    const tId = input.dataset.teacherId;
    const day = input.dataset.day;
    const period = input.dataset.period;
    const val = input.value.trim();

    if (!updatesMap[tId]) {
      const teacherObj = teachersData.find(x => String(x.id) === String(tId));
      if (teacherObj) {
        updatesMap[tId] = JSON.parse(JSON.stringify(teacherObj.schedule || {}));
      }
    }

    if (updatesMap[tId]) {
      const pKey = `${period}-р цаг`;
      if (!updatesMap[tId][pKey]) {
        updatesMap[tId][pKey] = { time: DEFAULT_TIMES[period - 1] || "" };
      }
      updatesMap[tId][pKey][day] = val;
    }
  });

  try {
    let successCount = 0;
    for (let tId in updatesMap) {
      const teacherObj = teachersData.find(x => String(x.id) === String(tId));
      if (!teacherObj) continue;

      // Анхаарах зүйл: Өмнө нь байсан кабинет болон бусад мэдээллүүдийг (roomNumbers, roomNumber, homeroomClass гэх мэт) бүрэн бүтэн хэвээр нь авч үлдэх зорилгоор teacherObj-оос шууд дамжуулж байна.
      const payload = {
        id: teacherObj.id,
        name: teacherObj.name,
        subject: teacherObj.subject || '',
        homeroomClass: teacherObj.homeroomClass || '',
        phone: teacherObj.phone || '',
        roomNumbers: teacherObj.roomNumbers || [],
        roomNumber: teacherObj.roomNumber || '',
        image: teacherObj.image || '',
        schedule: updatesMap[tId]
      };

      const res = await fetch('/api/teachers', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload)
      });
      if (res.ok) successCount++;
    }

    alert(`✅ Амжилттай хадгалагдлаа! (${successCount} багшийн хуваарь шинэчлэгдлээ)`);
    
    // Өгөгдлийг шинээр татаж шинэчилнэ
    const tRes = await fetch('/api/teachers');
    if (tRes.ok) teachersData = await tRes.json();
    renderAdminScheduleInput();
  } catch (err) {
    console.error(err);
    alert('⚠️ Хадгалахад алдаа гарлаа.');
  }
}
window.saveAllAdminSchedules = saveAllAdminSchedules;
window.saveAllAdminSchedules = saveAllAdminSchedules;