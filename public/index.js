// ================= БАГШИЙН ЭРЭМБЭ (index.js болон admin.js-д ИЖИЛ байна) =================
// Эрэмбийг өөрчлөх бол ORDER жагсаалтыг ХОЁР файлд (index.js, admin.js) ижилхэн засна.
(function () {
  const ORDER = [
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
  const LATIN = { A:'А', B:'В', C:'С', E:'Е', H:'Н', K:'К', M:'М', O:'О', P:'Р', T:'Т', X:'Х', Y:'У' };

  // Зай, цэг хасаж, том үсэг болгож, латин төстэй үсгийг кирилл болгоно
  function norm(s) {
    return String(s || '').replace(/[\s.]+/g, '').toUpperCase()
      .replace(/[ABCEHKMOPTXY]/g, ch => LATIN[ch]);
  }

  // Levenshtein зай (хоёр нэр хэд хэдэн үсгээр л зөрж байгааг мэдэх)
  function lev(a, b) {
    const m = a.length, n = b.length;
    if (!m) return n; if (!n) return m;
    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev = cur;
    }
    return prev[n];
  }

  let lastLogSig = '';

  // 1) Нэр яг таарвал (нормчилсон) тэр байрлалд орно.
  // 2) Таараагүй үлдсэн багш нарыг, ЭЗЭНГҮЙ үлдсэн жагсаалтын нэртэй ойролцоо (1-3 үсгийн зөрүү)
  //    байвал тааруулна. Тү./Тө.Оюунтуяа зэрэг хоёулаа яг таарсан хүмүүс бие биедээ тааруулагдахгүй.
  // 3) Үлдсэн нь араас нь, өгөгдсөн дарааллаараа орно.
  function sortTeachersBySchoolOrder(list) {
    const teachers = Array.isArray(list) ? list : [];
    const keys = ORDER.map(norm);
    const rank = new Map();           // teacher -> ORDER index
    const claimed = new Set();        // ашиглагдсан ORDER index

    teachers.forEach(t => {
      const i = keys.indexOf(norm(t && t.name));
      if (i >= 0) { rank.set(t, i); claimed.add(i); }
    });

    const pairs = [];
    teachers.forEach(t => {
      if (rank.has(t)) return;
      const k = norm(t && t.name);
      if (!k) return;
      keys.forEach((ok, i) => {
        if (claimed.has(i)) return;
        const d = lev(k, ok);
        const limit = Math.max(ok.length, k.length) >= 10 ? 3 : 2;
        if (d <= limit) pairs.push({ t, i, d });
      });
    });
    pairs.sort((a, b) => a.d - b.d);
    const fuzzy = [];
    pairs.forEach(p => {
      if (rank.has(p.t) || claimed.has(p.i)) return;
      rank.set(p.t, p.i); claimed.add(p.i);
      fuzzy.push(`${p.t.name}  →  ${ORDER[p.i]}`);
    });

    const known = teachers.filter(t => rank.has(t)).sort((a, b) => rank.get(a) - rank.get(b));
    const unknown = teachers.filter(t => !rank.has(t));

    const sig = teachers.map(t => t && t.name).join('|');
    if (sig !== lastLogSig && teachers.length) {
      lastLogSig = sig;
      if (fuzzy.length) console.info('[Эрэмбэ] Ойролцоо нэрээр тааруулсан (DB-н нэрийг засвал зөв болно):\n' + fuzzy.join('\n'));
      if (unknown.length) console.warn('[Эрэмбэ] Жагсаалтад олдоогүй багш (төгсгөлд орно):', unknown.map(t => JSON.stringify(t && t.name)));
    }
    return known.concat(unknown);
  }

  window.sortTeachersBySchoolOrder = sortTeachersBySchoolOrder;
  window.TEACHER_ORDER_LIST = ORDER;
})();

let roomsData = [];
let teachersData = [];
let currentPano = "";
let activeDay = getTodayName();
let currentRoomImages = []; 
let currentImageIndex = 0;
let roomsVersion = 0;
let lastMarkerKey = "";
let panoViewer = null;   // Pannellum viewer-ийн лавлагаа (санах ой алдагдахаас сэргийлнэ)   

function getTodayName() {
  const days = { 1: "Даваа", 2: "Мягмар", 3: "Лхагва", 4: "Пүрэв", 5: "Баасан" };
  return days[new Date().getDay()] || "Даваа";
}

function changeDay(day) {
  activeDay = day;
  updateDayBtns();
  renderCurrentRoom();
}

function updateDayBtns() {
  document.querySelectorAll('.day-btn').forEach(b => {
    b.classList.toggle('active', b.innerText.trim() === activeDay);
  });
}

let lastSelectedRoom = ""; 

async function fetchData() {
  try {
    const setRes = await fetch('/api/school-settings');
    if (setRes.ok) {
      const s = await setRes.json();
      const floor1 = document.getElementById('floor1Image');
      const floor2 = document.getElementById('floor2Image');
      const model3d = document.getElementById('model3DViewer');

      if (floor1 && s.floor1Image && floor1.getAttribute('src') !== s.floor1Image) floor1.src = s.floor1Image;
      if (floor2 && s.floor2Image && floor2.getAttribute('src') !== s.floor2Image) floor2.src = s.floor2Image;
      if (model3d && s.model3d && s.model3d.trim() !== '' && model3d.getAttribute('src') !== s.model3d) {
        model3d.src = s.model3d;
      }
    }

    const [res, tRes] = await Promise.all([fetch('/api/rooms'), fetch('/api/teachers')]);
    if (res.ok) {
      const newRoomsData = await res.json();
      const newTeachersData = tRes.ok ? await tRes.json() : teachersData;

      if (JSON.stringify(roomsData) !== JSON.stringify(newRoomsData) ||
          JSON.stringify(teachersData) !== JSON.stringify(newTeachersData)) {
        roomsData = newRoomsData;
        teachersData = newTeachersData;
        roomsVersion++;
        updateDropdown();
        updateDayBtns();

        const select = document.getElementById('kioskRoomSelect');
        lastSelectedRoom = select ? select.value : "";
        renderCurrentRoom();
        if (typeof svRefreshAll === 'function') svRefreshAll();
        if (mainView === 'phones') renderPhonesView();
      }
      checkLiveTeacherStatus();
    }
  } catch (e) {
    console.error('Мэдээлэл ачаалахад алдаа гарлаа:', e);
  }
}

function updateDropdown() {
  const select = document.getElementById('kioskRoomSelect');
  if (!select) return;
  const curVal = select.value;
  select.innerHTML = "";

  const sortedRooms = [...roomsData].sort((a, b) => 
    String(a.roomNumber || '').localeCompare(String(b.roomNumber || ''), undefined, { numeric: true, sensitivity: 'base' })
  );

  sortedRooms.forEach(r => {
    const opt = document.createElement('option');
    opt.value = r.roomNumber;
    opt.innerText = `${r.roomNumber} тоот ${r.name ? '(' + r.name + ')' : ''}`;
    select.appendChild(opt);
  });

  if (curVal && sortedRooms.some(r => String(r.roomNumber) === String(curVal))) {
    select.value = curVal;
  }
}

function onRoomChange() {
  currentPano = "";
  renderCurrentRoom();
}

function renderCurrentRoom() {
  const select = document.getElementById('kioskRoomSelect');
  if (!select) return;
  const num = select.value;
  const room = roomsData.find(r => String(r.roomNumber) === String(num));
  if (!room) return;

  const detailInfoEl = document.getElementById('roomDetailInfo');
  if (detailInfoEl) {
    detailInfoEl.innerHTML = `
      <div class="item-card">
        <b style="color: #38bdf8; font-size:15px;">${escapeHtml(room.roomNumber)} тоот кабинет</b>
        <div style="margin-top:4px; font-size:12px; color:#cbd5e1;">${escapeHtml(room.name || '')}</div>
        
        <div style="margin-top:8px; padding:6px 8px; background:#0f172a; border-radius:4px; font-size:12px; border-left:3px solid #38bdf8;">
          <div style="display:flex; justify-content:space-between;">
            <span style="color:#94a3b8; font-weight:bold;">1-р ээлж:</span>
            <b style="color:#38bdf8;">${escapeHtml(room.class1Group || 'Бүртгэгдээгүй')}</b>
          </div>
          ${room.class1Info ? `<div style="color:#f8fafc; margin-top:4px; border-top:1px solid #1e293b; padding-top:4px;">${escapeHtml(room.class1Info)}</div>` : ''}
        </div>

        <div style="margin-top:6px; padding:6px 8px; background:#0f172a; border-radius:4px; font-size:12px; border-left:3px solid #fbbf24;">
          <div style="display:flex; justify-content:space-between;">
            <span style="color:#94a3b8; font-weight:bold;">2-р ээлж:</span>
            <b style="color:#fbbf24;">${escapeHtml(room.class2Group || 'Бүртгэгдээгүй')}</b>
          </div>
          ${room.class2Info ? `<div style="color:#f8fafc; margin-top:4px; border-top:1px solid #1e293b; padding-top:4px;">${escapeHtml(room.class2Info)}</div>` : ''}
        </div>
      </div>
    `;
  }

  renderTeacherList(room);

  if (room.panorama && room.panorama.trim() !== "") {
    if (room.panorama !== currentPano) {
      currentPano = room.panorama;
      const panoContainer = document.getElementById('panorama-container');
      if (panoContainer) {
        destroyPanoViewer();
        panoContainer.innerHTML = '';
        panoViewer = pannellum.viewer('panorama-container', { 
          type: 'equirectangular', 
          panorama: room.panorama, 
          autoLoad: true 
        });
      }
    }
  } else {
    currentPano = "";
    destroyPanoViewer();
    const panoContainer = document.getElementById('panorama-container');
    if (panoContainer) {
      panoContainer.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:center; height:100%; color:#64748b; font-size:12px;">
          📷 360° Панорама зураг оруулаагүй байна
        </div>`;
    }
  }

  displayRoomImages(room);

  const schedTitleEl = document.getElementById('schedTitle');
  if (schedTitleEl) schedTitleEl.innerText = `📋 ${room.roomNumber} тоот - ${activeDay} гараг`;
  renderScheduleTable(room);
}

function destroyPanoViewer() {
  if (panoViewer) {
    try { panoViewer.destroy(); } catch (e) { /* аль хэдийн устсан */ }
    panoViewer = null;
  }
}

function renderScheduleTable(room) {
  const s1 = room.scheduleClass1 || {};
  const s2 = room.scheduleClass2 || {};

  let html = `<table class="mini-table"><thead><tr><th>Цаг</th><th>1-р ээлж (${escapeHtml(room.class1Group||'-')})</th><th>2-р ээлж (${escapeHtml(room.class2Group||'-')})</th></tr></thead><tbody>`;

  for (let i = 1; i <= 7; i++) {
    const pKey = `${i}-р цаг`;
    const subj1 = s1[pKey]?.[activeDay] || '-';
    const subj2 = s2[pKey]?.[activeDay] || '-';
    html += `<tr><td><b>${i}</b></td><td${isElectiveText(subj1) ? ' class="sv-elective"' : ''}>${escapeHtml(subj1)}</td><td${isElectiveText(subj2) ? ' class="sv-elective"' : ''}>${escapeHtml(subj2)}</td></tr>`;
  }
  html += `</tbody></table>`;
  const schedBox = document.getElementById('schedTableBox');
  if (schedBox) schedBox.innerHTML = html;
}

function displayRoomImages(room) {
  if (room.images && room.images.length > 0) {
    currentRoomImages = room.images;
  } else if (room.image && room.image.trim() !== "") {
    currentRoomImages = [room.image];
  } else {
    currentRoomImages = [];
  }

  currentImageIndex = 0;
  renderSlider();
}

function renderSlider() {
  const imgElement = document.getElementById('kioskRoomImg') || document.getElementById('realImg');
  const dotsContainer = document.getElementById('sliderDots');
  const prevBtn = document.getElementById('prevImgBtn');
  const nextBtn = document.getElementById('nextImgBtn');

  if (!imgElement) return;

  if (currentRoomImages.length === 0) {
    imgElement.src = '';
    imgElement.style.display = 'none';
    if (prevBtn) prevBtn.style.display = 'none';
    if (nextBtn) nextBtn.style.display = 'none';
    if (dotsContainer) dotsContainer.innerHTML = '';
    return;
  }

  imgElement.src = currentRoomImages[currentImageIndex];
  imgElement.style.display = 'inline-block';

  if (currentRoomImages.length <= 1) {
    if (prevBtn) prevBtn.style.display = 'none';
    if (nextBtn) nextBtn.style.display = 'none';
    if (dotsContainer) dotsContainer.innerHTML = '';
    return;
  }

  if (prevBtn) prevBtn.style.display = 'block';
  if (nextBtn) nextBtn.style.display = 'block';

  if (dotsContainer) {
    dotsContainer.innerHTML = '';
    currentRoomImages.forEach((_, idx) => {
      const dot = document.createElement('div');
      dot.className = `dot ${idx === currentImageIndex ? 'active' : ''}`;
      dot.onclick = () => {
        currentImageIndex = idx;
        renderSlider();
      };
      dotsContainer.appendChild(dot);
    });
  }
}

function changeImage(direction) {
  if (currentRoomImages.length === 0) return;
  currentImageIndex += direction;

  if (currentImageIndex < 0) {
    currentImageIndex = currentRoomImages.length - 1;
  } else if (currentImageIndex >= currentRoomImages.length) {
    currentImageIndex = 0;
  }

  renderSlider();
}

function toggleImg(type) {
  const btns = document.querySelectorAll('.img-btn');
  if (type === 'pano') {
    btns[0].classList.add('active'); btns[1].classList.remove('active');
    document.getElementById('panoBox').style.display = 'block';
    document.getElementById('realBox').style.display = 'none';
  } else {
    btns[1].classList.add('active'); btns[0].classList.remove('active');
    document.getElementById('panoBox').style.display = 'none';
    document.getElementById('realBox').style.display = 'block';
  }
}

function checkLiveTeacherStatus() {
  const now = new Date();
  const clockEl = document.getElementById('clock');
  if (clockEl) clockEl.innerText = now.toTimeString().split(' ')[0];

  const select = document.getElementById('kioskRoomSelect');
  if (!select) return;
  const num = select.value;
  const room = roomsData.find(r => String(r.roomNumber) === String(num));
  if (room) updateTeacherStatuses(room, now);

  const key = now.getHours() + ':' + now.getMinutes() + '|' + roomsVersion;
  if (key !== lastMarkerKey) {
    lastMarkerKey = key;
    updateLiveMapMarkers(now);
  }
}

function normText(s) {
  const map = { A:'А', B:'В', C:'С', E:'Е', H:'Н', K:'К', M:'М', O:'О', P:'Р', T:'Т', X:'Х', Y:'У' };
  return String(s || '')
    .toUpperCase()
    .replace(/[ABCEHKMOPTXY]/g, ch => map[ch])
    .replace(/(\d)\s+(\p{L})/gu, '$1$2')
    .trim();
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function containsWord(text, word) {
  if (!word) return false;
  const re = new RegExp('(?<![\\p{L}\\d])' + escapeRegExp(word) + '(?![\\p{L}\\d])', 'u');
  return re.test(text);
}

function cleanGroup(g) {
  return normText(g).replace(/АНГИ|БАЙХГҮЙ/g, '').replace(/\s+/g, '');
}

function findRoomsForLesson(lessonText) {
  const text = normText(lessonText);
  if (!text) return [];

  const tokens = svClassTokens(lessonText);   // 11аб -> 11А, 11Б
  const found = [];
  for (const r of roomsData) {
    for (const g of [r.class1Group, r.class2Group]) {
      const grp = cleanGroup(g);
      if (grp && (containsWord(text, grp) || tokens.includes(grp))) {
        found.push({ room: r, group: g });
        break;
      }
    }
  }
  if (found.length) return found;

  for (const r of roomsData) {
    const num = normText(r.roomNumber).replace(/\s+/g, '');
    if (num && containsWord(text, num)) return [{ room: r, group: '' }];
  }
  return [];
}

function findRoomForLesson(lessonText) {
  const all = findRoomsForLesson(lessonText);
  return all.length ? all[0] : null;
}

function padTime(t) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(t || '').trim());
  return m ? m[1].padStart(2, '0') + ':' + m[2] : String(t || '').trim();
}

function getCurrentLessonInfo(sched, curDay, curTimeStr) {
  if (!sched) return null;
  for (let i = 1; i <= 14; i++) {
    const rowData = sched[`${i}-р цаг`];
    if (!rowData || !rowData.time) continue;
    const parts = String(rowData.time).split('-').map(s => padTime(s));
    if (parts.length < 2 || !parts[0] || !parts[1]) continue;
    if (curTimeStr >= parts[0] && curTimeStr <= parts[1]) {
      const lesson = String(rowData[curDay] || '').trim();
      if (lesson && lesson !== '-') return { period: i, time: rowData.time, text: lesson };
    }
  }
  return null;
}

const AVATAR_FALLBACK = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="20" fill="#475569"/>' +
  '<circle cx="20" cy="15" r="7" fill="#cbd5e1"/><path d="M6 36c2-9 9-12 14-12s12 3 14 12z" fill="#cbd5e1"/></svg>'
);

// 111 тоот кабинетыг хариуцсан багш нар (нэрний хэсгээр таних, жижиг үсгээр).
// Эдгээр багш өөр багштай кабинет (эсвэл анги) давхцвал 2D зураг дээр 111-д гарна.
const ROOM_111_OWNERS = ['мөнхтайван', 'оюунсүх', 'мөнгөнбаясгалан'];
// true бол кабинет давхцахаас гадна ижил анги давхцсан ч 111 руу шилжинэ (өмнөх Мөнхтайванын дүрэм шиг).
// Зөвхөн кабинет давхцалд хязгаарлах бол false болгоно.
const ROOM_111_CONFLICT_BY_CLASS = true;

function isRoom111Owner(teacher) {
  const n = String((teacher && teacher.name) || '').toLowerCase();
  return ROOM_111_OWNERS.some(k => n.includes(k));
}

function updateLiveMapMarkers(now) {
  const floor1Container = document.getElementById('floor1Markers');
  const floor2Container = document.getElementById('floor2Markers');
  if (!floor1Container || !floor2Container) return;

  floor1Container.innerHTML = '';
  floor2Container.innerHTML = '';

  const daysMap = { 1: "Даваа", 2: "Мягмар", 3: "Лхагва", 4: "Пүрэв", 5: "Баасан" };
  const curDay = daysMap[now.getDay()];
  if (!curDay) return;

  const curTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const specialActiveRooms = new Set();
  teachersData.forEach(teacher => {
    if (!teacher || !teacher.name) return;
    const tName = (teacher.name || '').toLowerCase();
    if (tName.includes('доржпүрэв') || tName.includes('ууганбаяр') || tName.includes('отгонбат') || tName.includes('наранзул')) {
      const lessonInfo = getCurrentLessonInfo(teacher.schedule, curDay, curTimeStr);
      if (lessonInfo) {
        const matchedRooms = findRoomsForLesson(lessonInfo.text);
        matchedRooms.forEach(m => specialActiveRooms.add(String(m.room.roomNumber)));
      }
    }
  });

  const byRoom = new Map();
  teachersData.forEach(teacher => {
    if (!teacher || !teacher.name) return;
    const lessonInfo = getCurrentLessonInfo(teacher.schedule, curDay, curTimeStr);
    if (!lessonInfo) return;

    const lesson = lessonInfo.text;
    let targetRooms = findRoomsForLesson(lesson);

    const tName = (teacher.name || '').toLowerCase();
    const isSpecialTeacher = tName.includes('доржпүрэв') || tName.includes('ууганбаяр') || tName.includes('отгонбат') || tName.includes('наранзул');
    const isByambadorj = tName.includes('бямбадорж');
    const isRoom111Teacher = isRoom111Owner(teacher);
    let movedTo111 = false;

    if (isByambadorj) {
      const byambadorjTokens = svClassTokens(lesson);
      let hasConflict = false;
      teachersData.forEach(otherTeacher => {
        if (!otherTeacher || otherTeacher === teacher || !otherTeacher.name) return;
        const otherLessonInfo = getCurrentLessonInfo(otherTeacher.schedule, curDay, curTimeStr);
        if (otherLessonInfo && otherLessonInfo.period === lessonInfo.period) {
          const otherTokens = svClassTokens(otherLessonInfo.text);
          if (byambadorjTokens.some(tok => otherTokens.includes(tok))) {
            hasConflict = true;
          }
        }
      });
      if (hasConflict) {
        const room207 = roomsData.find(r => String(r.roomNumber) === '207');
        if (room207) {
          targetRooms = [{ room: room207, group: '' }];
        }
      }
    }

    if (isRoom111Teacher) {
      const myTokens = svClassTokens(lesson);
      const myRooms = targetRooms.map(tr => String(tr.room.roomNumber));
      let hasConflict = false;

      teachersData.forEach(other => {
        if (hasConflict) return;
        if (!other || other === teacher || !other.name) return;
        const oInfo = getCurrentLessonInfo(other.schedule, curDay, curTimeStr);
        if (!oInfo) return;

        const oRooms = findRoomsForLesson(oInfo.text).map(m => String(m.room.roomNumber));
        const sameRoom = myRooms.some(r => oRooms.includes(r));
        const sameClass = ROOM_111_CONFLICT_BY_CLASS &&
          svClassTokens(oInfo.text).some(tok => myTokens.includes(tok));

        if (sameRoom || sameClass) hasConflict = true;
      });

      if (hasConflict) {
        const room111 = roomsData.find(r =>
          String(r.roomNumber) === '111' || String(r.roomNumber).toUpperCase() === 'Д111');
        if (room111 && room111.coords && typeof room111.coords.x === 'number') {
          targetRooms = [{ room: room111, group: '' }];
          movedTo111 = true;
        }
      }
    }

    if (!isSpecialTeacher && !isByambadorj && !movedTo111 && targetRooms.some(tr => specialActiveRooms.has(String(tr.room.roomNumber)))) {
      const room108 = roomsData.find(r => String(r.roomNumber) === '108' || String(r.roomNumber).toUpperCase() === 'Д108');
      if (room108) {
        targetRooms = [{ room: room108, group: '' }];
      }
    }

    targetRooms.forEach(({ room, group }) => {
      const c = room.coords;
      if (!c || typeof c.x !== 'number' || typeof c.y !== 'number') return;
      const key = String(room.roomNumber);
      if (!byRoom.has(key)) byRoom.set(key, { room, items: [] });
      byRoom.get(key).items.push({ teacher, group, elective: isElectiveText(lesson) });
    });
  });

  byRoom.forEach(({ room, items: allItems }) => {
    // Нэг кабинетэд 2+ багш давхцвал, сонгон ("с") хичээлтэй багшийг нууна (2D зураг дээр шигдэхээс сэргийлнэ).
    // Бүгд сонгон бол өрөө хоосон үлдэхгүйн тулд хэвээр үлдээнэ.
    const regular = allItems.filter(i => !i.elective);
    const items = (allItems.length > 1 && regular.length > 0) ? regular : allItems;

    const cluster = document.createElement('div');
    cluster.className = 'teacher-map-cluster';
    cluster.style.cssText =
      `position:absolute;left:${room.coords.x}%;top:${room.coords.y}%;` +
      'transform:translate(-50%,-50%);display:flex;flex-direction:row;' +
      'align-items:flex-start;gap:6px;z-index:5;pointer-events:none;';

    items.forEach(({ teacher, group }) => {
      const pin = document.createElement('div');
      pin.className = 'teacher-map-pin';
      pin.style.cssText =
        'position:static;transform:none;display:flex;flex-direction:column;' +
        'align-items:center;pointer-events:auto;cursor:pointer;';

      const avatarSrc = teacher.image || AVATAR_FALLBACK;
      const subjectText = teacher.subject && teacher.subject.trim() ? abbreviateSubject(teacher.subject.trim()) : '';
      const pinTitle = `${room.roomNumber} тоот${group ? ' [' + group + ']' : ''}: ${teacher.name}`;

      pin.innerHTML = `
        <img src="${escapeHtml(avatarSrc)}" alt="${escapeHtml(teacher.name)}" title="${escapeHtml(pinTitle)}"
             style="width:20px;height:20px;border-radius:50%;object-fit:cover;"
             onerror="this.onerror=null;this.src=AVATAR_FALLBACK">
        <div class="pin-badge">
          <span class="pin-teacher-name">${escapeHtml(teacher.name)}</span>
          ${subjectText ? `<span class="pin-subject-name">${formatSubjectForPin(subjectText)}</span>` : ''}
        </div>
      `;

      pin.onclick = () => {
        const sel = document.getElementById('kioskRoomSelect');
        if (sel) {
          sel.value = room.roomNumber;
          onRoomChange();
        }
      };
      cluster.appendChild(pin);
    });

    const floorVal = String(room.coords.floor);
    if (floorVal === '1') floor1Container.appendChild(cluster);
    else if (floorVal === '2') floor2Container.appendChild(cluster);
  });
}

const SUBJECT_ABBREVIATIONS = {
  "монгол хэл, уран зохиол, үндэсний бичиг": "МХУЗ"
};

function formatSubjectForPin(text) {
  if (!text) return '';
  return escapeHtml(text);
}

function abbreviateSubject(text) {
  if (!text) return text;
  const key = String(text).trim().toLowerCase();
  return SUBJECT_ABBREVIATIONS[key] || text;
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function getTeacherRooms(t) {
  if (!t) return [];
  const arr = Array.isArray(t.roomNumbers) ? t.roomNumbers : (t.roomNumber ? [t.roomNumber] : []);
  return [...new Set(arr.map(x => String(x).trim()).filter(Boolean))];
}

function getRoomTeachers(room) {
  const num = String(room.roomNumber).trim();
  return teachersData.filter(t => getTeacherRooms(t).includes(num));
}

function renderTeacherList(room) {
  const box = document.getElementById('teacherList');
  if (!box) return;

  const list = getRoomTeachers(room);
  if (list.length === 0) {
    box.innerHTML = '<div style="color:#64748b; font-size:12px; text-align:center; padding:15px;">👨‍🏫 Энэ кабинетад багш бүртгээгүй байна</div>';
    return;
  }

  box.innerHTML = list.map(t => `
    <div class="item-card">
      <div class="teacher-profile">
        <div class="teacher-avatar">${t.image ? `<img src="${escapeHtml(t.image)}">` : '👨‍🏫'}</div>
        <div class="teacher-info">
          <div style="font-weight: bold; font-size: 15px; color: #f8fafc; margin-bottom: 4px;">${escapeHtml(t.name)}</div>
          <div style="font-size: 12px; color: #94a3b8;">📚 Хичээл: ${escapeHtml(abbreviateSubject(t.subject) || '-')}</div>
          <div style="font-size: 12px; color: #38bdf8; margin-top: 2px;">🏫 Даасан анги: ${escapeHtml(t.homeroomClass || '-')}</div>
          ${getTeacherRooms(t).length > 1 ? `<div style="font-size: 12px; color: #a5b4fc; margin-top: 2px;">🏢 Кабинет: ${escapeHtml(getTeacherRooms(t).join(', '))}</div>` : ''}
          <div style="font-size: 12px; color: #cbd5e1; margin-top: 2px;">📱 Утас: ${escapeHtml(t.phone || '-')}</div>
        </div>
      </div>
      <div id="tstatus_${escapeHtml(t.id)}" class="status-badge status-free">🟢 Хичээлгүй байна</div>
    </div>
  `).join('');

  updateTeacherStatuses(room, new Date());
}

function updateTeacherStatuses(room, now) {
  getRoomTeachers(room).forEach(t => {
    evaluateTeacher('tstatus_' + t.id, t.schedule, now);
  });
}

function evaluateTeacher(elemId, sched, now) {
  const el = document.getElementById(elemId);
  if (!el) return;

  const daysMap = { 1: "Даваа", 2: "Мягмар", 3: "Лхагва", 4: "Пүрэв", 5: "Баасан" };
  const curDay = daysMap[now.getDay()];

  if (!curDay || !sched) {
    el.className = "status-badge status-free";
    el.innerText = "🟢 Хичээлгүй байна";
    return;
  }

  const curTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  let busyText = "";

  for (let i = 1; i <= 14; i++) {
    const rowData = sched[`${i}-р цаг`];
    if (!rowData || !rowData.time) continue;

    const [start, end] = String(rowData.time).split('-').map(s => padTime(s));
    if (start && end && curTimeStr >= start && curTimeStr <= end) {
      const lesson = rowData[curDay];
      if (lesson && lesson !== '-' && lesson !== '') {
        busyText = lesson;
        break;
      }
    }
  }

  if (busyText) {
    el.className = "status-badge status-busy";
    el.innerText = `🔴 ${busyText}-д хичээлтэй`;
  } else {
    el.className = "status-badge status-free";
    el.innerText = "🟢 Хичээлгүй байна";
  }
}

function fitMarkerLayer(imgId, layerId) {
  const img = document.getElementById(imgId);
  const layer = document.getElementById(layerId);
  if (!img || !layer || !img.naturalWidth || !img.clientWidth) return;

  const boxW = img.clientWidth;
  const boxH = img.clientHeight;
  const scale = Math.min(boxW / img.naturalWidth, boxH / img.naturalHeight);
  const w = img.naturalWidth * scale;
  const h = img.naturalHeight * scale;

  layer.style.left = ((boxW - w) / 2) + 'px';
  layer.style.top = ((boxH - h) / 2) + 'px';
  layer.style.width = w + 'px';
  layer.style.height = h + 'px';
  layer.style.right = 'auto';
  layer.style.bottom = 'auto';
}

function fitAllMarkerLayers() {
  fitMarkerLayer('floor1Image', 'floor1Markers');
  fitMarkerLayer('floor2Image', 'floor2Markers');
}

function initMarkerLayers() {
  ['floor1Image', 'floor2Image'].forEach(id => {
    const img = document.getElementById(id);
    if (img) img.addEventListener('load', fitAllMarkerLayers);
  });
  window.addEventListener('resize', fitAllMarkerLayers);
  fitAllMarkerLayers();
}

function init2DPanzoom() {
  const w1 = document.getElementById('floor1Wrapper');
  const w2 = document.getElementById('floor2Wrapper');

  if (w1 && typeof Panzoom !== 'undefined') {
    const pz1 = Panzoom(w1, { maxScale: 5, minScale: 1, contain: 'outside' });
    w1.parentElement.addEventListener('wheel', pz1.zoomWithWheel);
    pz1.zoom(1.6);
    pz1.pan(-120, -80);
  }

  if (w2 && typeof Panzoom !== 'undefined') {
    const pz2 = Panzoom(w2, { maxScale: 5, minScale: 1, contain: 'outside' });
    w2.parentElement.addEventListener('wheel', pz2.zoomWithWheel);
    pz2.zoom(1.6);
    pz2.pan(-120, -80);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  initScheduleView();
  fetchData();
  init2DPanzoom();
  initMarkerLayers();
  setInterval(checkLiveTeacherStatus, 1000);
  setInterval(fetchData, 4000);
});

const SV_DAYS = ["Даваа", "Мягмар", "Лхагва", "Пүрэв", "Баасан"];
const SV_DEFAULT_TIMES = [
  "07:50 - 08:30", "08:35 - 09:15", "09:20 - 10:00", "10:20 - 11:00", "11:05 - 11:45", "11:50 - 12:30", "12:35 - 13:15",
  "13:30 - 14:10", "14:15 - 14:55", "15:00 - 15:40", "16:00 - 16:40", "16:45 - 17:25", "17:30 - 18:10", "18:15 - 18:55"
];

let mainView = 'home';
let svState = {
  sub: 'teacher',
  teacherId: '',
  className: '',
  day: '',
  shift: 1,
  filter: { teacher: '', class: '', day: '', weekly: '' }
};
let svIndex = null;
let svIndexVersion = -1;
let svLastMinuteKey = '';

function showMainView(name) {
  if (name === 'web') {
    window.open('https://sites.google.com/view/temuujinschool/%D0%BD%D2%AF%D2%AF%D1%80?authuser=0', '_blank');
    return;
  }

  mainView = name;
  const home = document.querySelector('.dashboard-grid');
  const view = document.getElementById('scheduleView');
  const phonesView = document.getElementById('phonesView');

  if (home) home.style.display = (name === 'home') ? '' : 'none';
  if (view) view.style.display = (name === 'schedule') ? 'grid' : 'none';
  if (phonesView) phonesView.style.display = (name === 'phones') ? 'block' : 'none';

  const navHome = document.getElementById('navHome');
  const navSch = document.getElementById('navSchedule');
  const navPhones = document.getElementById('navPhones');

  if (navHome) navHome.classList.toggle('active', name === 'home');
  if (navSch) navSch.classList.toggle('active', name === 'schedule');
  if (navPhones) navPhones.classList.toggle('active', name === 'phones');

  if (name === 'phones') {
    renderPhonesView();
  } else if (name === 'schedule') {
    renderScheduleView();
  } else {
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
      if (typeof fitAllMarkerLayers === 'function') fitAllMarkerLayers();
    }, 60);
  }
}

// Утасны жагсаалтыг шинэ шаардлагаар render хийх функц
function renderPhonesView() {
  const grid = document.getElementById('phonesGrid');
  if (!grid) return;

  if (!teachersData || teachersData.length === 0) {
    grid.innerHTML = '<div style="color:#64748b; text-align:center; padding:20px;">Бүртгэлтэй багш байхгүй байна.</div>';
    return;
  }

  // Цэгийн хойд талын нэрээр эрэмбэлэх функц (Жишээ нь: "Б.Ариунцэцэг" -> "Ариунцэцэг")
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

  grid.innerHTML = sorted.map(t => `
    <div style="background: #0f172a; border: 1px solid #334155; border-radius: 10px; padding: 15px; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 12px;">
      <!-- Багшийн утасны дугаар бусад мэдээллээс том -->
      <div style="font-size: 22px; font-weight: bold; color: #38bdf8; background: rgba(56, 189, 248, 0.1); padding: 8px 14px; border-radius: 6px; border: 1px dashed #38bdf8; width: 100%; letter-spacing: 0.5px;">
        📱 ${escapeHtml(t.phone || 'Дугаар байхгүй')}
      </div>

      <!-- Доод талд нь багшийн аватар, нэр, заадаг хичээл, даасан анги жижгээр -->
      <div style="display: flex; align-items: center; gap: 12px; width: 100%; text-align: left;">
        <div style="width: 50px; height: 70px; border-radius: 6px; background: #334155; overflow: hidden; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
          ${t.image ? `<img src="${escapeHtml(t.image)}" style="width: 100%; height: 100%; object-fit: cover;">` : '👨‍🏫'}
        </div>
        <div style="display: flex; flex-direction: column; gap: 2px; min-width: 0;">
          <div style="font-size: 14px; font-weight: bold; color: #f8fafc; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(t.name)}</div>
          <div style="font-size: 11px; color: #94a3b8;">📚 Хичээл: ${escapeHtml(abbreviateSubject(t.subject) || '-')}</div>
          <div style="font-size: 11px; color: #fbbf24;">🏫 Даасан анги: ${escapeHtml(t.homeroomClass || '-')}</div>
        </div>
      </div>
    </div>
  `).join('');
}

function svNowInfo() {
  const now = new Date();
  const names = { 1: "Даваа", 2: "Мягмар", 3: "Лхагва", 4: "Пүрэв", 5: "Баасан" };
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return { now, dayName: names[now.getDay()] || '', hhmm };
}

function svTimes() {
  const times = SV_DEFAULT_TIMES.slice();
  for (let p = 1; p <= 14; p++) {
    for (const t of teachersData) {
      const row = t.schedule && t.schedule[`${p}-р цаг`];
      if (row && row.time) { times[p - 1] = row.time; break; }
    }
  }
  return times;
}

function svCurrentPeriod(times, hhmm) {
  for (let p = 1; p <= 14; p++) {
    const parts = String(times[p - 1] || '').split('-').map(s => padTime(s));
    if (parts.length === 2 && hhmm >= parts[0] && hhmm <= parts[1]) return p;
  }
  return 0;
}

function svLesson(t, day, p) {
  const row = t && t.schedule && t.schedule[`${p}-р цаг`];
  const v = row ? String(row[day] || '').trim() : '';
  return v === '-' ? '' : v;
}

function svTeacherLessonCount(t) {
  let n = 0;
  SV_DAYS.forEach(d => { for (let p = 1; p <= 14; p++) if (svLesson(t, d, p)) n++; });
  return n;
}

function svGivenName(full) {
  const s = String(full || '').trim();
  const i = s.lastIndexOf('.');
  return (i >= 0 ? s.slice(i + 1) : s).trim();
}
const svCollator = new Intl.Collator('mn', { sensitivity: 'base' });

function svSortedTeachers() {
  return [...teachersData].sort((a, b) =>
    svCollator.compare(svGivenName(a.name), svGivenName(b.name)) ||
    svCollator.compare(String(a.name || ''), String(b.name || '')));
}

function svMatches(text, query) {
  const q = String(query || '').replace(/\s+/g, '').toLowerCase();
  if (!q) return true;
  return String(text || '').replace(/\s+/g, '').toLowerCase().includes(q);
}

function svAvatar(t, cls) {
  return `<div class="${cls || 'sv-avatar'}">${t.image ? `<img src="${escapeHtml(t.image)}" alt="">` : '👨‍🏫'}</div>`;
}

// "11а" -> ["11А"], "11аб" -> ["11А","11Б"] (нэг тоонд хэд хэдэн ангийн үсэг залгаж бичиж болно)
function svClassTokens(text) {
  return svClassTokensDetailed(text).map(x => x.label);
}

// ================= СОНГОН СУДЛАХ ХИЧЭЭЛ =================
// "11а"   -> үндсэн хичээл
// "11а-с" -> сонгон судлах хичээл (ангийн ард "-с"), мөн "сонгон" гэсэн үг орсон бол
// Сонгон судлах хичээл хуваарь харах бүх хэсэгт шар дэвсгэртэй харагдана.
const ELECTIVE_INLINE_STYLE = 'background:#facc15; color:#1e293b; font-weight:bold;';

function isElectiveText(text) {
  const n = normText(text);
  if (!n) return false;
  if (n.includes('СОНГОН')) return true;
  return /(?<![\p{L}\d])\d{1,2}\p{L}{0,4}\s*[-\u2013\u2014]\s*С(?![\p{L}\d])/u.test(n);
}

// Ангийн токен бүрийг (11А, 9Д ...) сонгон судлах эсэхтэй нь хамт буцаана
function svClassTokensDetailed(text) {
  const out = [];
  const norm = normText(text);
  const wordElective = norm.includes('СОНГОН');
  const re = /(?<![\p{L}\d])(\d{1,2})(\p{L}{1,4})(?![\p{L}\d])/gu;   // 11а, 11аб, 11абв
  let m;
  while ((m = re.exec(norm)) !== null) {
    const rest = norm.slice(m.index + m[0].length);
    const elective = wordElective || /^\s*[-\u2013\u2014]\s*С(?![\p{L}\d])/u.test(rest);
    for (const ch of m[2]) out.push({ label: m[1] + ch, elective });   // 11аб -> 11А, 11Б
  }
  return out;
}

// "12-с", "11-с", "10-с" (ангийн үсэггүй) -> тухайн түвшний БҮХ ангид орох сонгон судлах хичээл.
// Буцаах утга: түвшний тоонуудын жагсаалт, жишээ нь "12-с" -> [12]
function svGradeElectives(text) {
  const out = [];
  const norm = normText(text);
  const re = /(?<![\p{L}\d])(\d{1,2})\s*[-\u2013\u2014]\s*С(?![\p{L}\d])/gu;
  let m;
  while ((m = re.exec(norm)) !== null) {
    const g = parseInt(m[1], 10);
    if (!out.includes(g)) out.push(g);
  }
  return out;
}

function svLegendHtml() {
  return '<div class="sv-legend"><span class="sv-legend-box"></span> Сонгон судлах хичээл (жишээ нь: 11а-с — нэг анги, 12-с — 12-р ангийн бүгд)</div>';
}

function svBuildIndex() {
  if (svIndex && svIndexVersion === roomsVersion) return svIndex;

  const classes = new Map();
  const ensure = (label) => {
    if (!classes.has(label)) classes.set(label, { label, grid: {}, lessons: 0, teachers: new Set() });
    return classes.get(label);
  };

  const gradeWide = [];   // "12-с" төрлийн хичээлүүд: нэг түвшний бүх ангид хамаарна

  teachersData.forEach(t => {
    SV_DAYS.forEach(day => {
      for (let p = 1; p <= 14; p++) {
        const text = svLesson(t, day, p);
        if (!text) continue;
        svGradeElectives(text).forEach(grade => gradeWide.push({ t, text, day, p, grade }));
        svClassTokensDetailed(text).forEach(({ label: tok, elective }) => {
          const entry = ensure(tok);
          if (!entry.grid[day]) entry.grid[day] = {};
          if (!entry.grid[day][p]) entry.grid[day][p] = [];
          entry.grid[day][p].push({ t, text, elective });
          entry.lessons++;
          entry.teachers.add(String(t.id));
        });
      }
    });
  });

  roomsData.forEach(r => [r.class1Group, r.class2Group].forEach(g => svClassTokens(g).forEach(ensure)));

  // Түвшний сонгон ("12-с"): тухайн түвшний (12А, 12Б, 12В ...) бүх ангид нэмнэ
  gradeWide.forEach(({ t, text, day, p, grade }) => {
    classes.forEach(entry => {
      if (parseInt(entry.label, 10) !== grade) return;
      if (!entry.grid[day]) entry.grid[day] = {};
      if (!entry.grid[day][p]) entry.grid[day][p] = [];
      entry.grid[day][p].push({ t, text, elective: true, gradeWide: grade });
      entry.lessons++;
      entry.teachers.add(String(t.id));
    });
  });

  const list = Array.from(classes.values()).sort((a, b) => {
    const ga = parseInt(a.label, 10), gb = parseInt(b.label, 10);
    if (ga !== gb) return ga - gb;
    return a.label.localeCompare(b.label);
  });

  svIndex = { classes, list };
  svIndexVersion = roomsVersion;
  return svIndex;
}

function svRoomsOfClass(label) {
  return roomsData.filter(r => [r.class1Group, r.class2Group].some(g => svClassTokens(g).includes(label)));
}

function svTableHtml(cellFn, times, info, curP, clsFn) {
  const blocks = [{ name: '🌅 1-р ээлж', from: 1 }, { name: '🌇 2-р ээлж', from: 8 }];
  let body = '';

  blocks.forEach(b => {
    let rowsHtml = '';
    let any = false;
    for (let i = 0; i < 7; i++) {
      const p = b.from + i;
      let tds = '';
      SV_DAYS.forEach(day => {
        const inner = cellFn(day, p);
        if (inner) any = true;
        const isNow = curP === p && info.dayName === day;
        const extra = clsFn ? clsFn(day, p) : '';
        tds += `<td class="sv-cell${isNow ? ' sv-now' : ''}${extra ? ' ' + extra : ''}">${inner || ''}</td>`;
      });
      const isCur = curP === p && info.dayName;
      rowsHtml += `<tr class="${isCur ? 'sv-cur-row' : ''}"><td class="sv-pnum">${i + 1}</td><td class="sv-time">${escapeHtml(times[p - 1])}</td>${tds}</tr>`;
    }
    if (any) body += `<tr class="sv-shift-row"><td colspan="7">${b.name}</td></tr>` + rowsHtml;
  });

  if (!body) return '';
  const head = SV_DAYS.map(d => `<th class="${info.dayName === d ? 'sv-today' : ''}">${d}</th>`).join('');
  return `<div class="sv-table-wrap"><table class="sv-table"><thead><tr><th>Цаг</th><th>Хугацаа</th>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

function renderScheduleView() {
  const content = document.getElementById('svContent');
  if (!content) return;

  document.querySelectorAll('.sv-menu-btn').forEach(b => b.classList.toggle('active', b.dataset.sub === svState.sub));

  if (svState.sub === 'teacher') renderSvTeacherShell(content);
  else if (svState.sub === 'class') renderSvClassShell(content);
  else if (svState.sub === 'day') renderSvDayShell(content);
  else if (svState.sub === 'now') renderSvNowShell(content);
  else if (svState.sub === 'weekly') renderSvWeeklyShell(content); // <-- Энэ мөрийг нэмнэ
}

function svRefreshAll() {
  if (mainView !== 'schedule') return;
  if (svState.sub === 'teacher') { renderSvTeacherChips(); renderSvTeacherDetail(); }
  else if (svState.sub === 'class') { renderSvClassChips(); renderSvClassDetail(); }
  else if (svState.sub === 'day') { renderSvDayDetail(); }
  else if (svState.sub === 'weekly') { renderSvWeeklyDetail(); }
  else { renderSvNow(); }
}

function renderSvTeacherShell(box) {
  box.innerHTML = `
    <div class="sv-title">👨‍🏫 Багшаар харах</div>
    <div class="sv-teacher-layout">
      <div id="svChips" class="sv-teacher-list"></div>
      <div id="svDetail" class="sv-teacher-detail"></div>
    </div>`;
  renderSvTeacherChips();
  renderSvTeacherDetail();
  svFitTeacherList();
}

function svFitTeacherList() {
  const list = document.getElementById('svChips');
  if (!list || !list.classList || !list.classList.contains('sv-teacher-list')) return;
  if (window.innerWidth <= 800) { list.style.maxHeight = ''; return; }
  const absTop = list.getBoundingClientRect().top + (window.scrollY || 0);
  list.style.maxHeight = Math.max(300, window.innerHeight - absTop - 16) + 'px';
}

function renderSvTeacherChips() {
  const box = document.getElementById('svChips');
  if (!box) return;
  const prevScroll = box.scrollTop;

  const list = svSortedTeachers();
  if (!list.length) {
    box.innerHTML = '<div class="sv-empty">Багш бүртгэгдээгүй байна</div>';
    return;
  }
  box.innerHTML = list.map(t => {
    const none = svTeacherLessonCount(t) === 0;
    const active = String(t.id) === String(svState.teacherId);
    return `<button type="button" class="sv-teacher-item${active ? ' active' : ''}${none ? ' dim' : ''}" data-action="pick-teacher" data-id="${escapeHtml(t.id)}" title="${escapeHtml(t.name)}">${escapeHtml(t.name)}</button>`;
  }).join('');
  box.style.gridTemplateRows = `repeat(${Math.ceil(list.length / 3)}, auto)`;
  box.scrollTop = prevScroll;
}

function renderSvTeacherDetail() {
  const box = document.getElementById('svDetail');
  if (!box) return;
  const t = teachersData.find(x => String(x.id) === String(svState.teacherId));
  if (!t) {
    box.innerHTML = '<div class="sv-empty">👈 Зүүн талаас багшаа сонгоно уу</div>';
    return;
  }

  const info = svNowInfo();
  const times = svTimes();
  const curP = info.dayName ? svCurrentPeriod(times, info.hhmm) : 0;
  const cur = info.dayName ? getCurrentLessonInfo(t.schedule, info.dayName, info.hhmm) : null;
  const total = svTeacherLessonCount(t);

  const badge = cur
    ? `<span class="sv-badge busy">🔴 Яг одоо ${escapeHtml(cur.text)} ангид хичээлтэй</span>`
    : `<span class="sv-badge free">🟢 Одоо хичээлгүй</span>`;

  const table = svTableHtml((day, p) => {
    const text = svLesson(t, day, p);
    return text ? `<span class="sv-lesson">${escapeHtml(text)}</span>` : '';
  }, times, info, curP, (day, p) => isElectiveText(svLesson(t, day, p)) ? 'sv-elective' : '');

  box.innerHTML = `
    <div class="sv-info">
      ${svAvatar(t, 'sv-avatar big')}
      <div class="sv-info-text">
        <div class="sv-info-name">${escapeHtml(t.name)}</div>
        <div>${escapeHtml(t.subject || '-')}${t.homeroomClass ? ' · Даасан анги: <b>' + escapeHtml(t.homeroomClass) + '</b>' : ''}</div>
        <div>${t.phone ? '📱 ' + escapeHtml(t.phone) + ' · ' : ''}📚 7 хоногт <b>${total}</b> цаг</div>
        <div style="margin-top:6px;">${badge}</div>
      </div>
    </div>
    ${table ? svLegendHtml() + table : '<div class="sv-empty">Энэ багшийн хичээлийн хуваарь оруулаагүй байна</div>'}`;
}

function renderSvClassShell(box) {
  box.innerHTML = `
    <div class="sv-title">🏫 Ангиар харах</div>
    <div class="sv-teacher-layout sv-layout-class">
      <div id="svChips" class="sv-teacher-list sv-cols-2"></div>
      <div id="svDetail" class="sv-class-detail"></div>
    </div>`;
  renderSvClassChips();
  renderSvClassDetail();
  svFitTeacherList();
}

function renderSvClassChips() {
  const box = document.getElementById('svChips');
  if (!box) return;
  const prevScroll = box.scrollTop;

  const list = svBuildIndex().list;
  if (!list.length) {
    box.innerHTML = '<div class="sv-empty">Анги бүртгэгдээгүй байна</div>';
    return;
  }
  box.innerHTML = list.map(c =>
    `<button type="button" class="sv-teacher-item${c.label === svState.className ? ' active' : ''}${c.lessons === 0 ? ' dim' : ''}" data-action="pick-class" data-label="${escapeHtml(c.label)}" title="${escapeHtml(c.label)}">${escapeHtml(c.label)}</button>`
  ).join('');
  box.style.gridTemplateRows = `repeat(${Math.ceil(list.length / 2)}, auto)`;
  box.scrollTop = prevScroll;
}

function renderSvClassDetail() {
  const box = document.getElementById('svDetail');
  if (!box) return;
  const entry = svBuildIndex().classes.get(svState.className);
  if (!entry) {
    box.innerHTML = '<div class="sv-empty">👈 Зүүн талаас ангиа сонгоно уу</div>';
    return;
  }

  const info = svNowInfo();
  const times = svTimes();
  const curP = info.dayName ? svCurrentPeriod(times, info.hhmm) : 0;
  const rooms = svRoomsOfClass(entry.label);
  const roomText = rooms.length ? rooms.map(r => `🏫 ${escapeHtml(r.roomNumber)} тоот`).join(', ') : 'Өрөө заагаагүй';

  const table = svTableHtml((day, p) => {
    const list = (entry.grid[day] && entry.grid[day][p]) || [];
    return list.map(x =>
      `<div class="sv-tline${x.elective ? ' sv-elective' : ''}"><b>${escapeHtml(x.t.name)}</b>${x.t.subject ? `<small>${escapeHtml(x.t.subject)}</small>` : ''}${x.gradeWide ? `<small>🎓 ${x.gradeWide}-р ангийн бүгд</small>` : ''}</div>`
    ).join('');
  }, times, info, curP);

  box.innerHTML = `
    <div class="sv-info">
      <div class="sv-avatar big class">${escapeHtml(entry.label)}</div>
      <div class="sv-info-text">
        <div class="sv-info-name">${escapeHtml(entry.label)} анги</div>
        <div>${roomText}</div>
        <div>📚 7 хоногт <b>${entry.lessons}</b> цаг · 👨‍🏫 <b>${entry.teachers.size}</b> багш</div>
      </div>
    </div>
    ${table ? svLegendHtml() + table : '<div class="sv-empty">Энэ ангийн хичээл олдсонгүй</div>'}`;
}

function renderSvDayShell(box) {
  if (!svState.day) svState.day = svNowInfo().dayName || 'Даваа';
  const today = svNowInfo().dayName;

  const dayBtns = SV_DAYS.map(d =>
    `<button type="button" class="sv-seg-btn${d === svState.day ? ' active' : ''}" data-action="pick-day" data-day="${d}">${d}${d === today ? ' •' : ''}</button>`
  ).join('');
  const shiftBtns = [1, 2].map(s =>
    `<button type="button" class="sv-seg-btn${s === svState.shift ? ' active' : ''}" data-action="pick-shift" data-shift="${s}">${s === 1 ? '🌅 1-р ээлж' : '🌇 2-р ээлж'}</button>`
  ).join('');

  box.innerHTML = `
    <div class="sv-title">📆 Өдрөөр харах</div>
    <div class="sv-toolbar"><div class="sv-seg">${dayBtns}</div><div class="sv-seg">${shiftBtns}</div></div>
    <input type="text" class="sv-search" data-role="search" placeholder="🔍 Багшийн нэрээр шүүх..." value="${escapeHtml(svState.filter.day)}">
    <div id="svDetail"></div>`;
  renderSvDayDetail();
}

function renderSvDayDetail() {
  const box = document.getElementById('svDetail');
  if (!box) return;

  const info = svNowInfo();
  const times = svTimes();
  const curP = info.dayName ? svCurrentPeriod(times, info.hhmm) : 0;
  const from = svState.shift === 1 ? 1 : 8;
  const isToday = svState.day === info.dayName;

  const rows = svSortedTeachers()
    .filter(t => svMatches(t.name, svState.filter.day))
    .map(t => {
      const cells = [];
      let count = 0;
      for (let i = 0; i < 7; i++) {
        const text = svLesson(t, svState.day, from + i);
        if (text) count++;
        cells.push(text);
      }
      return { t, cells, count };
    })
    .filter(r => r.count > 0);

  if (!rows.length) {
    box.innerHTML = `<div class="sv-empty">${escapeHtml(svState.day)} гарагийн ${svState.shift}-р ээлжид хичээлтэй багш олдсонгүй</div>`;
    return;
  }

  const head = Array.from({ length: 7 }, (_, i) => {
    const p = from + i;
    const now = isToday && curP === p;
    return `<th class="${now ? 'sv-today' : ''}">${i + 1}<small>${escapeHtml(times[p - 1])}</small></th>`;
  }).join('');

  const body = rows.map(r => {
    const tds = r.cells.map((text, i) => {
      const now = isToday && curP === from + i;
      return `<td class="sv-cell${now && text ? ' sv-now' : ''}${isElectiveText(text) ? ' sv-elective' : ''}">${text ? `<span class="sv-lesson">${escapeHtml(text)}</span>` : ''}</td>`;
    }).join('');
    return `<tr><td class="sv-name-col" data-action="open-teacher" data-id="${escapeHtml(r.t.id)}"><b>${escapeHtml(r.t.name)}</b>${r.t.subject ? `<small>${escapeHtml(r.t.subject)}</small>` : ''}</td>${tds}</tr>`;
  }).join('');

  box.innerHTML = `
    <div class="sv-summary">📅 <b>${escapeHtml(svState.day)}</b> · ${svState.shift}-р ээлж · <b>${rows.length}</b> багш хичээлтэй</div>
    ${svLegendHtml()}
    <div class="sv-table-wrap"><table class="sv-table sv-day-table"><thead><tr><th class="sv-name-col">Багш</th>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

function renderSvNowShell(box) {
  box.innerHTML = `
    <div class="sv-title">🟢 Яг одоо хичээлтэй байгаа багш нар</div>
    <div id="svDetail"></div>`;
  renderSvNow();
}

function renderSvNow() {
  const box = document.getElementById('svDetail');
  if (!box) return;

  const info = svNowInfo();
  const dayLabel = info.dayName ? `${info.dayName} гараг` : (info.now.getDay() === 6 ? 'Бямба гараг' : 'Ням гараг');

  if (!info.dayName) {
    box.innerHTML = `<div class="sv-summary">🕒 ${dayLabel} ${info.hhmm}</div><div class="sv-empty">Өнөөдөр хичээлтэй өдөр биш байна 🎉</div>`;
    return;
  }

  const teaching = svSortedTeachers()
    .map(t => ({ t, cur: getCurrentLessonInfo(t.schedule, info.dayName, info.hhmm) }))
    .filter(x => x.cur);

  const summary = `<div class="sv-summary">🕒 ${dayLabel} <b>${info.hhmm}</b> · Хичээлтэй багш: <b>${teaching.length}</b></div>`;

  if (!teaching.length) {
    box.innerHTML = summary + '<div class="sv-empty">Одоогоор хичээлтэй багш алга байна (завсарлага эсвэл хичээлийн бус цаг)</div>';
    return;
  }

  const cards = teaching.map(({ t, cur }) => {
    const found = findRoomForLesson(cur.text);
    const room = found ? found.room.roomNumber : (getTeacherRooms(t)[0] || '');
    const p = cur.period;
    const periodText = p <= 7 ? `1-р ээлж · ${p}-р цаг` : `2-р ээлж · ${p - 7}-р цаг`;
    return `
      <div class="sv-now-card" data-action="open-teacher" data-id="${escapeHtml(t.id)}" title="Хуваарийг нь харах">
        ${svAvatar(t, 'sv-avatar')}
        <div class="sv-now-info">
          <div class="sv-now-name">${escapeHtml(t.name)}</div>
          <div class="sv-now-sub">${escapeHtml(t.subject || '-')}</div>
          <div class="sv-now-lesson${isElectiveText(cur.text) ? ' sv-elective' : ''}">📚 <b>${escapeHtml(cur.text)}</b> ангид${room ? ' · 🏫 ' + escapeHtml(room) + ' тоот' : ''}</div>
          <div class="sv-now-time">🕒 ${escapeHtml(periodText)} · ${escapeHtml(cur.time)}</div>
        </div>
      </div>`;
  }).join('');

  box.innerHTML = summary + `<div class="sv-now-grid">${cards}</div>`;
}

function initScheduleView() {
  const view = document.getElementById('scheduleView');
  if (!view) return;

  view.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const action = el.dataset.action;

    if (action === 'sub') {
      svState.sub = el.dataset.sub;
      renderScheduleView();
    } else if (action === 'pick-teacher') {
      svState.teacherId = el.dataset.id;
      renderSvTeacherChips();
      renderSvTeacherDetail();
    } else if (action === 'pick-class') {
      svState.className = el.dataset.label;
      renderSvClassChips();
      renderSvClassDetail();
    } else if (action === 'pick-day') {
      svState.day = el.dataset.day;
      renderScheduleView();
    } else if (action === 'pick-shift') {
      svState.shift = Number(el.dataset.shift) === 2 ? 2 : 1;
      renderScheduleView();
    } else if (action === 'open-teacher') {
      svState.teacherId = el.dataset.id;
      svState.filter.teacher = '';
      svState.sub = 'teacher';
      renderScheduleView();
    }
  });

  window.addEventListener('resize', svFitTeacherList);

view.addEventListener('input', (e) => {
  const role = e.target.dataset && e.target.dataset.role;
  if (role === 'search-weekly') {
    svState.filter.weekly = e.target.value;
    renderSvWeeklyDetail();
  } else if (role === 'search') {
    svState.filter.day = e.target.value;
    renderSvDayDetail();
  }
});

  setInterval(() => {
    if (mainView !== 'schedule') return;
    if (svState.sub === 'now') { renderSvNow(); return; }
    const info = svNowInfo();
    const key = info.dayName + info.hhmm;
    if (key !== svLastMinuteKey) {
      svLastMinuteKey = key;
      if (svState.sub === 'teacher') renderSvTeacherDetail();
      else if (svState.sub === 'class') renderSvClassDetail();
      else if (svState.sub === 'day') renderSvDayDetail();
    }
  }, 5000);
}

function renderSvWeeklyShell(box) {
  const query = svState.filter.weekly || '';
  box.innerHTML = `
    <div class="sv-title">📅 7 хоногоор харах (Бүх өдөр)</div>
    <input type="text" class="sv-search" data-role="search-weekly" placeholder="🔍 Багшийн нэрээр шүүх..." value="${escapeHtml(query)}">
    <div id="svWeeklyDetail"></div>`;
  renderSvWeeklyDetail();
}

function renderSvWeeklyDetail() {
  const box = document.getElementById('svWeeklyDetail');
  if (!box) return;

  const query = (svState.filter.weekly || '').trim();
  
  // Эрэмбийг teacher-order.js дахь TEACHER_ORDER-ээс авна (нэрийг нормчилж харьцуулна)
  let teachers = sortTeachersBySchoolOrder(svSortedTeachers());

  // Хэрэв хайлтын утга бичсэн байвал шүүх
  if (query) {
    teachers = teachers.filter(t => svMatches(t.name, query));
  }

  if (!teachers.length) {
    box.innerHTML = `<div class="sv-empty">Багш олдсонгүй</div>`;
    return;
  }

  const days = ['Даваа', 'Мягмар', 'Лхагва', 'Пүрэв', 'Баасан'];

  let dayHeaderHtml = '';
  let subHeaderHtml = '';

  days.forEach((day, dIndex) => {
    const isLastDay = dIndex === days.length - 1;
    const dayBorderRight = isLastDay ? '1px solid #334155' : '3px solid #38bdf8';

    dayHeaderHtml += `<th colspan="14" style="border: 1px solid #334155; border-right: ${dayBorderRight}; background: #0f172a; color: #38bdf8; text-align: center; padding: 6px; font-size: 13px;">${escapeHtml(day)}</th>`;
    
    for (let i = 1; i <= 2; i++) {
      for (let p = 1; p <= 7; p++) {
        let subBorderRight = '1px solid #334155';
        if (p === 7 && i === 1) {
          subBorderRight = '2px solid #64748b';
        } else if (p === 7 && i === 2) {
          subBorderRight = dayBorderRight;
        }

        subHeaderHtml += `<th style="border: 1px solid #334155; border-right: ${subBorderRight}; background: #1e293b; color: #38bdf8; text-align: center; width: 30px; font-size: 10px; padding: 4px 2px;">${p}</th>`;
      }
    }
  });

  let rowsHtml = '';
  teachers.forEach((t) => {
    let cellsHtml = '';
    days.forEach((day, dIndex) => {
      const isLastDay = dIndex === days.length - 1;
      const dayBorderRight = isLastDay ? '1px solid #334155' : '3px solid #38bdf8';

      for (let p = 1; p <= 7; p++) {
        const val = svLesson(t, day, p);
        const cellBorderRight = (p === 7) ? '2px solid #64748b' : '1px solid #334155';
        cellsHtml += `<td style="border: 1px solid #334155; border-right: ${cellBorderRight}; text-align: center; padding: 6px 2px; font-size: 11px;${isElectiveText(val) ? ' ' + ELECTIVE_INLINE_STYLE : ''}">${escapeHtml(val)}</td>`;
      }
      for (let p = 8; p <= 14; p++) {
        const val = svLesson(t, day, p);
        const isEndOfDay = (p === 14);
        const cellBorderRight = isEndOfDay ? dayBorderRight : '1px solid #334155';
        cellsHtml += `<td style="border: 1px solid #334155; border-right: ${cellBorderRight}; text-align: center; padding: 6px 2px; font-size: 11px;${isElectiveText(val) ? ' ' + ELECTIVE_INLINE_STYLE : ''}">${escapeHtml(val)}</td>`;
      }
    });

    rowsHtml += `
      <tr>
        <td style="border: 1px solid #334155; border-right: 3px solid #38bdf8; padding: 8px; font-weight: bold; text-align: left; background: #1e293b; white-space: nowrap; position: sticky; left: 0; z-index: 2;">${escapeHtml(t.name)}</td>
        ${cellsHtml}
      </tr>
    `;
  });

  box.innerHTML = `
    <div class="sv-summary" style="margin-bottom: 10px;">📅 <b>Бүх багш нарын 7 хоногийн нэгдсэн хуваарь</b></div>
    ${svLegendHtml()}
    <div class="sv-table-wrap" style="overflow-x: auto;">
      <table class="sv-table" style="border-collapse: collapse; width: max-content; min-width: 100%;">
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