const SPREADSHEET_ID = "1srqYo1RcoXabp9ZXCFnrm9fWagBnvYRDbPBsSactVUc";
const UPLOAD_FOLDER_ID = "1CatiLpe5thDQQ5sP768jiHvYmlZUXAnc";

// ตัวแปรส่วนกลางสำหรับบันทึกข้อมูล IP และ User-Agent ของคำขอ
let currentRequestIP = "GAS_API";
let currentRequestUA = "Google Apps Script Serverless";

// ดึง Spreadsheet ตาม ID หรือใช้แผ่นงานปัจจุบัน
function getSpreadsheet() {
  if (typeof SPREADSHEET_ID !== 'undefined' && SPREADSHEET_ID && SPREADSHEET_ID !== "YOUR_SPREADSHEET_ID_HERE") {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

// ตรวจสอบและสร้างคอลัมน์เซสชันในตาราง users ถ้ายังไม่มี
function checkUsersSessionColumns(sheet) {
  if (sheet.getLastColumn() < 13) {
    sheet.getRange(1, 12).setValue("session_token");
    sheet.getRange(1, 13).setValue("token_expiry");
  }
}

// ฟังก์ชันตรวจสอบเซสชันโทเค็นของผู้ใช้งาน
function validateSession(ss, sessionToken) {
  if (!sessionToken || sessionToken === "") return { success: false, message: "กรุณาส่งกุญแจยืนยันตนเซสชัน (session_token)" };
  
  const cleanToken = String(sessionToken).trim();
  const cache = CacheService.getScriptCache();
  
  // 1. ตรวจสอบใน Fast Session Cache ก่อน เพื่อเลี่ยงการอ่าน Sheet
  try {
    const cachedUserJson = cache.get("sess_token_" + cleanToken);
    if (cachedUserJson) {
      const cachedUser = JSON.parse(cachedUserJson);
      const expiry = Number(cachedUser.token_expiry || 0);
      const now = new Date().getTime();
      if (now <= expiry) {
        return { success: true, user: cachedUser };
      }
    }
  } catch(e) {}

  let users = getSheetData(ss, "users", true);
  let user = users.find(u => u.session_token && String(u.session_token).trim() === cleanToken);
  
  // หากไม่พบใน Cache อาจเป็นเพราะเพิ่งล็อกอิน ให้ลองดึงแบบไม่ใช้ Cache จาก Sheet อีกครั้งเพื่อความแม่นยำ
  if (!user) {
    users = getSheetData(ss, "users", false);
    user = users.find(u => u.session_token && String(u.session_token).trim() === cleanToken);
  }
  
  if (!user) {
    return { success: false, message: "เซสชันไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่" };
  }
  
  const expiry = Number(user.token_expiry || 0);
  const now = new Date().getTime();
  if (now > expiry) {
    return { success: false, message: "เซสชันหมดอายุแล้ว กรุณาเข้าสู่ระบบใหม่" };
  }
  
  // ยืดอายุเซสชันชั่วคราวเมื่อเหลือน้อยกว่า 30 นาที
  const remaining = expiry - now;
  if (remaining < 30 * 60 * 1000) {
    const sheet = ss.getSheetByName("users");
    checkUsersSessionColumns(sheet);
    const newExpiry = now + (2 * 60 * 60 * 1000);
    const vals = sheet.getDataRange().getValues();
    for (let i = 1; i < vals.length; i++) {
      if (String(vals[i][0]) === String(user.id)) {
        sheet.getRange(i + 1, 13).setValue(String(newExpiry));
        user.token_expiry = String(newExpiry);
        clearSheetCache("users");
        break;
      }
    }
  }
  
  // บันทึกลง Fast Session Cache (หมดอายุตามเวลาโทเค็นหรือสูงสุด 2 ชั่วโมง)
  try {
    const ttlSeconds = Math.min(Math.floor((expiry - now) / 1000), 7200);
    if (ttlSeconds > 0) {
      cache.put("sess_token_" + cleanToken, JSON.stringify(user), ttlSeconds);
    }
  } catch(e) {}

  return { success: true, user: user };
}

// จัดการคำขอแบบ GET
function doGet(e) {
  if (e && e.parameter) {
    if (e.parameter.client_ip) currentRequestIP = e.parameter.client_ip;
    if (e.parameter.user_agent) currentRequestUA = e.parameter.user_agent;
  }
  
  const action = e.parameter.action;
  let ss;
  try {
    ss = getSpreadsheet();
  } catch(err) {
    return jsonResponse({ success: false, message: "ไม่สามารถเปิด Spreadsheet ได้ กรุณาตรวจสอบสิทธิ์และ SPREADSHEET_ID: " + err.toString() });
  }

  // 2. ตรวจสอบความปลอดภัยของเซสชันเมื่อเข้าถึง API ภายใน (ยกเว้น API สาธารณะหน้าแรก)
  const publicActions = ["getSettings", "getDashboardStats", "getStats", "getDashboardAllData"];
  if (publicActions.indexOf(action) === -1) {
    const authResult = validateSession(ss, e.parameter.session_token);
    if (!authResult.success) {
      return jsonResponse({ success: false, status: 401, message: authResult.message });
    }
  }
  
  try {
    switch(action) {
      case "getSettings":
        return getSettings(ss);
      case "getStats":
      case "getDashboardStats":
        return getDashboardStats(ss);
      case "getDashboardAllData":
        return getDashboardAllData(ss);
      case "listUsers":
        return listUsers(ss);
      case "getReportData":
        return getReportData(ss, e.parameter.year, e.parameter.term);
      case "getAnalyticsData":
        return getAnalyticsData(ss, e.parameter.year, e.parameter.term);
      case "getReportById":
        return getReportById(ss, e.parameter.id);
      case "getTemplate":
        return getTemplate(ss, e.parameter.id);
      case "listTemplates":
        return listTemplates(ss);
      case "listTerms":
        return listTerms(ss);
      case "getActiveTerm":
        return getActiveTerm(ss);
      case "listAssignments":
        return listAssignments(ss);
      case "listLogs":
        return listLogs(ss);
      default:
        return jsonResponse({ success: false, message: "ไม่พบ Action GET: " + action });
    }
  } catch(err) {
    return jsonResponse({ success: false, message: "เกิดข้อผิดพลาด: " + err.toString() });
  }
}

// จัดการคำขอแบบ POST
function doPost(e) {
  if (e && e.parameter) {
    if (e.parameter.client_ip) currentRequestIP = e.parameter.client_ip;
    if (e.parameter.user_agent) currentRequestUA = e.parameter.user_agent;
  }
  
  const action = e.parameter.action;
  let ss;
  try {
    ss = getSpreadsheet();
  } catch(err) {
    return jsonResponse({ success: false, message: "ไม่สามารถเปิด Spreadsheet ได้: " + err.toString() });
  }

  // 2. ตรวจสอบความปลอดภัยของเซสชันเมื่อเข้าถึง API ภายใน (ยกเว้นเข้าสู่ระบบ)
  const publicActions = ["login"];
  if (publicActions.indexOf(action) === -1) {
    const authResult = validateSession(ss, e.parameter.session_token);
    if (!authResult.success) {
      return jsonResponse({ success: false, status: 401, message: authResult.message });
    }
  }

  let input;
  try {
    input = JSON.parse(e.postData.contents);
  } catch(err) {
    return jsonResponse({ success: false, message: "รูปแบบ JSON ไม่ถูกต้อง" });
  }
  
  try {
    let result;
    switch(action) {
      case "login":
        result = login(ss, input.username, input.password);
        clearSheetCache("users");
        break;
      case "saveData":
        result = saveData(ss, input);
        clearSheetCache("supervision_records");
        break;
      case "updateReport":
        result = updateReport(ss, input);
        clearSheetCache("supervision_records");
        break;
      case "saveConfig":
        result = saveConfig(ss, input);
        clearSheetCache("templates");
        break;
      case "saveSettings":
        result = saveSettings(ss, input);
        clearSheetCache("settings");
        break;
      case "createUser":
        result = createUser(ss, input);
        clearSheetCache("users");
        break;
      case "updateUser":
        result = updateUser(ss, input);
        clearSheetCache("users");
        break;
      case "deleteUser":
        result = deleteUser(ss, input.id);
        clearSheetCache("users");
        break;
      case "bulkAssignTemplates":
        result = bulkAssignTemplates(ss, input);
        clearSheetCache("users");
        break;
      case "changePassword":
        result = changePassword(ss, input);
        clearSheetCache("users");
        break;
      case "createAssignments":
        result = createAssignments(ss, input);
        clearSheetCache("supervision_assignments");
        break;
      case "updateAssignment":
        result = updateAssignment(ss, input);
        clearSheetCache("supervision_assignments");
        break;
      case "deleteAssignment":
        result = deleteAssignment(ss, input.id || input);
        clearSheetCache("supervision_assignments");
        break;
      case "deleteReport":
        result = deleteReport(ss, input.id);
        clearSheetCache("supervision_records");
        break;
      case "createTerm":
        result = createTerm(ss, input);
        clearSheetCache("terms");
        break;
      case "setTermActive":
        result = setTermActive(ss, input.id);
        clearSheetCache("terms");
        break;
      case "deleteTerm":
        result = deleteTerm(ss, input.id);
        clearSheetCache("terms");
        break;
      case "importUsers":
        result = importUsers(ss, input);
        clearSheetCache("users");
        break;
      default:
        return jsonResponse({ success: false, message: "ไม่พบ Action POST: " + action });
    }
    return result;
  } catch(err) {
    return jsonResponse({ success: false, message: "เกิดข้อผิดพลาด: " + err.toString() });
  }
}

// === ฟังก์ชันตอบกลับในรูปแบบ JSON ===
function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// === ฟังก์ชันช่วยเหลือสำหรับการล้าง Cache ===
function clearSheetCache(sheetName) {
  try {
    const cache = CacheService.getScriptCache();
    if (sheetName) {
      const countKey = "sheet_cache_count_" + sheetName;
      const countStr = cache.get(countKey);
      if (countStr) {
        const count = parseInt(countStr, 10);
        const keysToRemove = [countKey];
        for (let i = 0; i < count; i++) {
          keysToRemove.push("sheet_cache_" + sheetName + "_" + i);
        }
        cache.removeAll(keysToRemove);
      } else {
        cache.remove("sheet_cache_" + sheetName);
      }
    } else {
      ["settings", "users", "terms", "templates", "supervision_records", "assignments"].forEach(s => {
        clearSheetCache(s);
      });
    }
  } catch(e) {}
}

// === ฟังก์ชันช่วยเหลือ: แปลงแผ่นงานเป็น Array ของ Object พร้อมระบบ Chunked Caching ===
function getSheetData(ss, sheetName, useCache = true) {
  if (useCache) {
    try {
      const cache = CacheService.getScriptCache();
      const countStr = cache.get("sheet_cache_count_" + sheetName);
      if (countStr) {
        const count = parseInt(countStr, 10);
        const keys = [];
        for (let i = 0; i < count; i++) {
          keys.push("sheet_cache_" + sheetName + "_" + i);
        }
        const cachedChunks = cache.getAll(keys);
        let fullStr = "";
        for (let i = 0; i < count; i++) {
          const chunkKey = "sheet_cache_" + sheetName + "_" + i;
          if (cachedChunks[chunkKey]) {
            fullStr += cachedChunks[chunkKey];
          } else {
            fullStr = null;
            break;
          }
        }
        if (fullStr) {
          return JSON.parse(fullStr);
        }
      }
      
      const singleCached = cache.get("sheet_cache_" + sheetName);
      if (singleCached) {
        return JSON.parse(singleCached);
      }
    } catch(e) {}
  }

  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  const range = sheet.getDataRange();
  const values = range.getValues();
  if (values.length <= 1) return [];
  
  const headers = values[0];
  const data = [];
  
  if (sheetName === "supervision_records") {
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      let rawDate = row[9];
      let formattedDate = (rawDate instanceof Date) ? Utilities.formatDate(rawDate, "GMT+7", "yyyy-MM-dd") : String(rawDate || "").trim();
      
      let rawTs = row[28];
      let formattedTs = (rawTs instanceof Date) ? Utilities.formatDate(rawTs, "GMT+7", "yyyy-MM-dd HH:mm:ss") : String(rawTs || "").trim();
      
      const teacherIdStr = String(row[4] !== undefined ? row[4] : "").trim();
      const teacherPosStr = String(row[5] !== undefined ? row[5] : "").trim();
      const classStr = String(row[8] !== undefined ? row[8] : "").trim();
      const obsIdStr = String(row[13] !== undefined ? row[13] : "").trim();
      const obsPosStr = String(row[14] !== undefined ? row[14] : "").trim();
      const scoresStr = String(row[15] !== undefined ? row[15] : "").trim();
      const signTStr = String(row[22] !== undefined ? row[22] : "").trim();
      const signOStr = String(row[23] !== undefined ? row[23] : "").trim();
      const file1Str = String(row[24] !== undefined ? row[24] : "").trim();
      const file2Str = String(row[25] !== undefined ? row[25] : "").trim();
      const file3Str = String(row[26] !== undefined ? row[26] : "").trim();
      const file4Str = String(row[27] !== undefined ? row[27] : "").trim();
      
      data.push({
        id: String(row[0] !== undefined ? row[0] : "").trim(),
        term: String(row[1] !== undefined ? row[1] : "").trim(),
        year: String(row[2] !== undefined ? row[2] : "").trim(),
        teacher: String(row[3] !== undefined ? row[3] : "").trim(),
        teacher_id: teacherIdStr,
        teacherId: teacherIdStr,
        teacher_position: teacherPosStr,
        teacherPosition: teacherPosStr,
        department: String(row[6] !== undefined ? row[6] : "").trim(),
        subject: String(row[7] !== undefined ? row[7] : "").trim(),
        class: classStr,
        className: classStr,
        date: formattedDate,
        occurrence: String(row[10] !== undefined ? row[10] : "").trim(),
        time: String(row[11] !== undefined ? row[11] : "").trim(),
        observer: String(row[12] !== undefined ? row[12] : "").trim(),
        observer_id: obsIdStr,
        observerId: obsIdStr,
        observer_position: obsPosStr,
        observerPosition: obsPosStr,
        scores_json: scoresStr,
        scores: scoresStr,
        total: row[16] !== undefined ? String(row[16]) : "0",
        percent: row[17] !== undefined ? String(row[17]) : "0",
        level: String(row[18] !== undefined ? row[18] : "").trim(),
        strengths: String(row[19] !== undefined ? row[19] : "").trim(),
        improvements: String(row[20] !== undefined ? row[20] : "").trim(),
        suggestions: String(row[21] !== undefined ? row[21] : "").trim(),
        sign_teacher: signTStr,
        signTeacher: signTStr,
        sign_observer: signOStr,
        signObserver: signOStr,
        file_url1: file1Str,
        fileUrl1: file1Str,
        file_url2: file2Str,
        fileUrl2: file2Str,
        file_url3: file3Str,
        fileUrl3: file3Str,
        file_url4: file4Str,
        fileUrl4: file4Str,
        timestamp: formattedTs
      });
    }
  } else {
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = row[index];
      });
      data.push(obj);
    }
  }

  if (useCache) {
    try {
      const cache = CacheService.getScriptCache();
      const str = JSON.stringify(data);
      const chunkSize = 80000;
      const chunks = [];
      for (let i = 0; i < str.length; i += chunkSize) {
        chunks.push(str.substring(i, i + chunkSize));
      }
      
      const cacheMap = {};
      cacheMap["sheet_cache_count_" + sheetName] = String(chunks.length);
      chunks.forEach((chunk, index) => {
        cacheMap["sheet_cache_" + sheetName + "_" + index] = chunk;
      });
      
      cache.putAll(cacheMap, 1800);
    } catch(e) {}
  }

  return data;
}

// === ฟังก์ชันการยืนยันตัวตน (Authentication) ===
function login(ss, username, password) {
  const sheet = ss.getSheetByName("users");
  checkUsersSessionColumns(sheet);
  
  const users = getSheetData(ss, "users");
  const user = users.find(u => String(u.username).trim() === String(username).trim());
  
  if (!user) {
    writeLog(ss, "", "login_failed", "users", "", `ชื่อผู้ใช้ไม่ถูกต้อง: ${username}`);
    return jsonResponse({ success: false, message: "ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง" });
  }
  
  const isMatch = checkPassword(password, user.password_hash);
  if (isMatch) {
    // สร้างเซสชันโทเค็นสุ่ม UUID
    const token = Utilities.getUuid() + "_" + Math.random().toString(36).substr(2, 9);
    // เซสชันหมดอายุในอีก 2 ชั่วโมง
    const expiryTime = new Date().getTime() + (2 * 60 * 60 * 1000); 
    
    // บันทึกลงตาราง users
    const vals = sheet.getDataRange().getValues();
    for (let i = 1; i < vals.length; i++) {
      if (String(vals[i][0]) === String(user.id)) {
        sheet.getRange(i + 1, 12).setValue(token);
        sheet.getRange(i + 1, 13).setValue(String(expiryTime));
        clearSheetCache("users");
        break;
      }
    }
    
    writeLog(ss, user.id, "login_success", "users", user.id, `เข้าสู่ระบบสำเร็จ (บทบาท: ${user.role})`);
    return jsonResponse({
      success: true,
      message: "เข้าสู่ระบบสำเร็จ",
      session_token: token,
      user: {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        email: user.email,
        role: user.role,
        template_id: user.template_id,
        position: user.position,
        academic_standing: user.academic_standing,
        department: user.department,
        session_token: token
      }
    });
  } else {
    writeLog(ss, "", "login_failed", "users", "", `รหัสผ่านผิดสำหรับผู้ใช้: ${username}`);
    return jsonResponse({ success: false, message: "ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง" });
  }
}
// ตรวจสอบรหัสผ่าน (รองรับ Plain text และ SHA-256 อย่างง่าย)
function checkPassword(inputPassword, storedHash) {
  if (inputPassword === storedHash) return true;
  // ลองถอดหรือตรวจด้วย SHA-256
  const hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, inputPassword, Utilities.Charset.UTF_8);
  let hashStr = "";
  for (let i = 0; i < hash.length; i++) {
    let byteVal = hash[i];
    if (byteVal < 0) byteVal += 256;
    let byteString = byteVal.toString(16);
    if (byteString.length == 1) byteString = "0" + byteString;
    hashStr += byteString;
  }
  if (hashStr === storedHash) return true;
  
  // ตรวจสอบ PHP password_verify (กรณีนำเข้าจาก PHP เดิม)
  // เนื่องจากใน GAS การเขียน BCrypt ถอดรหัสเต็มรูปแบบอาจใช้เวลานานและซับซ้อนมาก
  // หากต้องการใช้ BCrypt ต่อบน GAS จำเป็นต้องใช้ไลบรารีภายนอก หรือเปลี่ยนรหัสผ่านใน Google Sheets เป็น SHA-256 หรือข้อความธรรมดาตอนย้ายระบบ
  // ในที่นี้เราจะพยายามตรวจว่าถ้าเป็น bcrypt hash ($2y$) แล้วถ้าเช็คไม่ได้ แนะนำให้สร้างรหัสผ่านใหม่หรือเก็บเป็น SHA-256
  return false; 
}
// === การจัดการ Settings ===
function getSettings(ss) {
  const data = getSheetData(ss, "settings");
  const settings = {};
  data.forEach(row => {
    // พยายามแปลง JSON string กลับเป็น Object
    try {
      settings[row.id] = JSON.parse(row.value);
    } catch(e) {
      settings[row.id] = row.value;
    }
  });
  return jsonResponse({ success: true, data: settings });
}
function saveSettings(ss, input) {
  const sheet = ss.getSheetByName("settings");
  const data = sheet.getDataRange().getValues();
  const keys = data.map(r => r[0]);
  
  const entries = Object.entries(input);
  entries.forEach(([key, val]) => {
    let valStr = "";
    if (key === "school_logo" && typeof val === "string" && val.startsWith("data:image")) {
      valStr = saveBase64ImageToDrive(val, "school_logo.png");
    } else {
      valStr = (typeof val === "object") ? JSON.stringify(val) : String(val);
    }
    
    // ถ้าไม่มีการแนบรูปภาพโลโก้ใหม่และส่งมาเป็นค่าว่าง ให้ข้ามการบันทึกทับค่าเก่า
    if (key === "school_logo" && valStr === "") {
      return;
    }
    
    const idx = keys.indexOf(key);
    if (idx !== -1) {
      sheet.getRange(idx + 1, 2).setValue(valStr);
    } else {
      sheet.appendRow([key, valStr]);
      keys.push(key);
    }
  });
  
  return jsonResponse({ success: true, message: "บันทึกข้อมูลทั่วไปเรียบร้อย" });
}
// === สถิติแดชบอร์ดหน้าแรก ===
function getDashboardStats(ss) {
  const records = getSheetData(ss, "supervision_records");
  const users = getSheetData(ss, "users");
  
  const totalEvaluations = records.length;
  const totalTeachers = users.filter(u => u.role === "teacher").length;
  
  let sumScore = 0;
  records.forEach(r => {
    sumScore += Number(r.percent || 0);
  });
  const avgScore = totalEvaluations > 0 ? (sumScore / totalEvaluations).toFixed(1) : 0;
  
  const levelStats = { "ดีมาก": 0, "ดี": 0, "พอใช้": 0, "ปรับปรุง": 0 };
  records.forEach(r => {
    const l = String(r.level).trim();
    if (levelStats.hasOwnProperty(l)) {
      levelStats[l]++;
    }
  });
  
  return jsonResponse({
    success: true,
    data: {
      total_evaluations: totalEvaluations,
      total_teachers: totalTeachers,
      avg_score: avgScore,
      levels: levelStats
    }
  });
}

function getDashboardAllData(ss) {
  const records = getSheetData(ss, "supervision_records");
  const users = getSheetData(ss, "users");
  const settingsRes = getSettings(ss);
  const terms = getSheetData(ss, "terms");
  const assignments = getSheetData(ss, "assignments");

  const totalEvaluations = records.length;
  const totalTeachers = users.filter(u => u.role === "teacher").length;
  
  let sumScore = 0;
  records.forEach(r => {
    sumScore += Number(r.percent || 0);
  });
  const avgScore = totalEvaluations > 0 ? (sumScore / totalEvaluations).toFixed(1) : 0;
  
  const levelStats = { "ดีมาก": 0, "ดี": 0, "พอใช้": 0, "ปรับปรุง": 0 };
  records.forEach(r => {
    const l = String(r.level).trim();
    if (levelStats.hasOwnProperty(l)) {
      levelStats[l]++;
    }
  });

  let rawSettings = {};
  try {
    const parsed = JSON.parse(settingsRes.getContent());
    if (parsed && parsed.data) rawSettings = parsed.data;
  } catch(e) {}

  return jsonResponse({
    success: true,
    data: {
      stats: {
        total_evaluations: totalEvaluations,
        total_teachers: totalTeachers,
        avg_score: avgScore,
        levels: levelStats
      },
      settings: rawSettings,
      terms: terms,
      assignments: assignments
    }
  });
}
// === รายชื่อผู้ใช้งาน ===
function listUsers(ss) {
  const users = getSheetData(ss, "users");
  // ซ่อนฟิลด์ที่เป็น password_hash เพื่อความปลอดภัย
  const safeUsers = users.map(u => {
    const { password_hash, ...rest } = u;
    return rest;
  });
  return jsonResponse({ success: true, data: safeUsers });
}
function createUser(ss, input) {
  const sheet = ss.getSheetByName("users");
  const id = new Date().getTime(); // รหัสจำลอง
  
  // ทำการ Hash รหัสผ่านด้วย SHA-256
  const hash = sha256(input.password);
  
  const newRow = [
    id,
    input.username,
    hash,
    input.display_name,
    input.email,
    input.role || "teacher",
    input.template_id || "",
    input.position || "",
    input.academic_standing || "",
    input.department || "",
    Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd HH:mm:ss")
  ];
  sheet.appendRow(newRow);
  
  return jsonResponse({ success: true, message: "เพิ่มผู้ใช้งานสำเร็จ" });
}
function updateUser(ss, input) {
  const sheet = ss.getSheetByName("users");
  const range = sheet.getDataRange();
  const values = range.getValues();
  
  let foundRow = -1;
  for(let i = 1; i < values.length; i++) {
    if(String(values[i][0]) === String(input.id)) {
      foundRow = i + 1;
      break;
    }
  }
  
  if (foundRow === -1) {
    return jsonResponse({ success: false, message: "ไม่พบผู้ใช้ที่ต้องการแก้ไข" });
  }
  
  sheet.getRange(foundRow, 2).setValue(input.username); // username
  if(input.password) {
    const hash = sha256(input.password);
    sheet.getRange(foundRow, 3).setValue(hash); // password_hash
  }
  sheet.getRange(foundRow, 4).setValue(input.display_name); // display_name
  sheet.getRange(foundRow, 5).setValue(input.email); // email
  sheet.getRange(foundRow, 6).setValue(input.role); // role
  sheet.getRange(foundRow, 7).setValue(input.template_id || ""); // template_id
  sheet.getRange(foundRow, 8).setValue(input.position || ""); // position
  sheet.getRange(foundRow, 9).setValue(input.academic_standing || ""); // academic_standing
  sheet.getRange(foundRow, 10).setValue(input.department || ""); // department
  
  return jsonResponse({ success: true, message: "บันทึกข้อมูลสำเร็จ" });
}
function deleteUser(ss, id) {
  const sheet = ss.getSheetByName("users");
  const values = sheet.getDataRange().getValues();
  for(let i = 1; i < values.length; i++) {
    if(String(values[i][0]) === String(id)) {
      sheet.deleteRow(i + 1);
      return jsonResponse({ success: true, message: "ลบผู้ใช้เรียบร้อยแล้ว" });
    }
  }
  return jsonResponse({ success: false, message: "ไม่พบผู้ใช้งาน" });
}
function bulkAssignTemplates(ss, input) {
  const sheet = ss.getSheetByName("users");
  const values = sheet.getDataRange().getValues();
  const userIds = input.user_ids.map(id => String(id));
  const tplId = input.template_id || "";
  
  let updateCount = 0;
  for(let i = 1; i < values.length; i++) {
    if(userIds.indexOf(String(values[i][0])) !== -1) {
      sheet.getRange(i + 1, 7).setValue(tplId);
      updateCount++;
    }
  }
  return jsonResponse({ success: true, message: `อัปเดตรูปแบบแบบประเมินให้กลุ่มครูจำนวน ${updateCount} รายเรียบร้อยแล้ว` });
}
function changePassword(ss, input) {
  const sheet = ss.getSheetByName("users");
  const values = sheet.getDataRange().getValues();
  
  for(let i = 1; i < values.length; i++) {
    if(String(values[i][0]) === String(input.id)) {
      const hash = sha256(input.new_password);
      sheet.getRange(i + 1, 3).setValue(hash);
      return jsonResponse({ success: true, message: "เปลี่ยนรหัสผ่านเรียบร้อย" });
    }
  }
  return jsonResponse({ success: false, message: "ไม่พบผู้ใช้ที่ต้องการเปลี่ยนรหัสผ่าน" });
}
// === บันทึกผลการนิเทศ (Supervision Records) ===
function getReportData(ss, year, term) {
  const records = getSheetData(ss, "supervision_records");
  
  // กรองตามปีและภาคเรียน (ถ้าส่งพารามิเตอร์มา)
  let filtered = records;
  if (year && year !== "" && year !== "all") {
    filtered = filtered.filter(r => String(r.year || "").trim() === String(year).trim());
  }
  if (term && term !== "" && term !== "all") {
    filtered = filtered.filter(r => String(r.term || "").trim() === String(term).trim());
  }
  
  return jsonResponse({ success: true, data: filtered });
}
function getReportById(ss, id) {
  const records = getSheetData(ss, "supervision_records");
  const record = records.find(r => String(r.id).trim() === String(id).trim());
  if (record) {
    return jsonResponse({ success: true, data: record });
  }
  return jsonResponse({ success: false, message: "ไม่พบข้อมูลที่ระบุ" });
}
function saveData(ss, input) {
  const recordSheet = ss.getSheetByName("supervision_records");
  const id = input.id || "N" + new Date().getTime();
  
  // อัปโหลดรูปแนบฝั่ง Google Drive
  const imgUrl1 = saveBase64ImageToDrive(input.attachedFileBase64_1, `img1_${input.teacher}_${id}.png`);
  const imgUrl2 = saveBase64ImageToDrive(input.attachedFileBase64_2, `img2_${input.teacher}_${id}.png`);
  const imgUrl3 = saveBase64ImageToDrive(input.attachedFileBase64_3, `img3_${input.teacher}_${id}.png`);
  const imgUrl4 = saveBase64ImageToDrive(input.attachedFileBase64_4, `img4_${input.teacher}_${id}.png`);
  
  // อัปโหลดรูปลายเซ็นฝั่ง Google Drive
  const signTeacherUrl = saveBase64ImageToDrive(input.signTeacher, `sig_teacher_${input.teacher}_${id}.png`);
  const signObserverUrl = saveBase64ImageToDrive(input.signObserver, `sig_observer_${input.observer}_${id}.png`);
  
  // เตรียมข้อมูลบันทึกแถวใหม่
  const newRow = [
    id,
    input.term,
    input.year,
    input.teacher,
    input.teacherId || "",
    input.teacherPosition || "-",
    input.department,
    input.subject,
    input.className,
    input.date,
    input.occurrence || "-",
    input.time || "-",
    input.observer,
    input.observerId || "",
    input.observerPosition || "-",
    JSON.stringify(input.scores),
    Number(input.total),
    Number(input.percent),
    input.level,
    input.strengths || "",
    input.improvements || "",
    input.suggestions || "",
    signTeacherUrl,
    signObserverUrl,
    imgUrl1,
    imgUrl2,
    imgUrl3,
    imgUrl4,
    Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd HH:mm:ss")
  ];
  
  recordSheet.appendRow(newRow);
  
  // เมื่อบันทึกนิเทศเรียบร้อยแล้ว ให้อัปเดตตารางมอบหมายงานนิเทศ (ถ้ามี) ให้เป็น completed
  if(input.teacherId) {
    const assignmentSheet = ss.getSheetByName("supervision_assignments");
    if (assignmentSheet) {
      const assVals = assignmentSheet.getDataRange().getValues();
      for(let i = 1; i < assVals.length; i++) {
        const obsId = String(assVals[i][1]);
        const tcId = String(assVals[i][2]);
        const term = String(assVals[i][3]);
        const year = String(assVals[i][4]);
        
        if (obsId === String(input.observerId) && tcId === String(input.teacherId) && term === String(input.term) && year === String(input.year)) {
          assignmentSheet.getRange(i + 1, 6).setValue("completed");
        }
      }
    }
  }
  
  writeLog(ss, input.observerId || "", "save_data", "supervision_records", id, `บันทึกข้อมูลการนิเทศครู: ${input.teacher}`);
  
  return jsonResponse({ success: true, message: "บันทึกข้อมูลนิเทศเรียบร้อยแล้ว" });
}

function updateReport(ss, input) {
  if (!input.id) {
    return jsonResponse({ success: false, message: "ไม่พบรหัสข้อมูลการนิเทศ (ID)" });
  }

  const recordSheet = ss.getSheetByName("supervision_records");
  if (!recordSheet) {
    return jsonResponse({ success: false, message: "ไม่พบแผ่นงาน supervision_records" });
  }

  const range = recordSheet.getDataRange();
  const values = range.getValues();
  let rowIndex = -1;
  let existingRow = null;

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]).trim() === String(input.id).trim()) {
      rowIndex = i + 1;
      existingRow = values[i];
      break;
    }
  }

  if (rowIndex === -1 || !existingRow) {
    return jsonResponse({ success: false, message: `ไม่พบข้อมูลการนิเทศที่มี ID: ${input.id}` });
  }

  // อัปโหลดรูปแนบฝั่ง Google Drive (ถ้ามีการส่ง base64 มาใหม่ ให้บันทึกใหม่ หากไม่มีให้ใช้รูปเดิม)
  const imgUrl1 = (input.attachedFileBase64_1 && String(input.attachedFileBase64_1).indexOf('data:image/') === 0)
    ? saveBase64ImageToDrive(input.attachedFileBase64_1, `img1_${input.teacher}_${input.id}.png`)
    : (existingRow[24] || "");

  const imgUrl2 = (input.attachedFileBase64_2 && String(input.attachedFileBase64_2).indexOf('data:image/') === 0)
    ? saveBase64ImageToDrive(input.attachedFileBase64_2, `img2_${input.teacher}_${input.id}.png`)
    : (existingRow[25] || "");

  const imgUrl3 = (input.attachedFileBase64_3 && String(input.attachedFileBase64_3).indexOf('data:image/') === 0)
    ? saveBase64ImageToDrive(input.attachedFileBase64_3, `img3_${input.teacher}_${input.id}.png`)
    : (existingRow[26] || "");

  const imgUrl4 = (input.attachedFileBase64_4 && String(input.attachedFileBase64_4).indexOf('data:image/') === 0)
    ? saveBase64ImageToDrive(input.attachedFileBase64_4, `img4_${input.teacher}_${input.id}.png`)
    : (existingRow[27] || "");

  // อัปโหลดรูปลายเซ็น (ถ้ามีการวาดลายเซ็นใหม่เป็น base64 ให้บันทึกใหม่ หากเป็น URL หรือว่าง ให้ใช้ลายเซ็นเดิม)
  const signTeacherUrl = (input.signTeacher && String(input.signTeacher).indexOf('data:image/') === 0)
    ? saveBase64ImageToDrive(input.signTeacher, `sig_teacher_${input.teacher}_${input.id}.png`)
    : (input.signTeacher && String(input.signTeacher).indexOf('http') === 0 ? input.signTeacher : (existingRow[22] || ""));

  const signObserverUrl = (input.signObserver && String(input.signObserver).indexOf('data:image/') === 0)
    ? saveBase64ImageToDrive(input.signObserver, `sig_observer_${input.observer}_${input.id}.png`)
    : (input.signObserver && String(input.signObserver).indexOf('http') === 0 ? input.signObserver : (existingRow[23] || ""));

  const updatedRow = [
    input.id,
    input.term !== undefined ? input.term : existingRow[1],
    input.year !== undefined ? input.year : existingRow[2],
    input.teacher !== undefined ? input.teacher : existingRow[3],
    input.teacherId !== undefined ? input.teacherId : existingRow[4],
    input.teacherPosition || existingRow[5] || "-",
    input.department !== undefined ? input.department : existingRow[6],
    input.subject !== undefined ? input.subject : existingRow[7],
    input.className !== undefined ? input.className : existingRow[8],
    input.date !== undefined ? input.date : existingRow[9],
    input.occurrence || existingRow[10] || "-",
    input.time || existingRow[11] || "-",
    input.observer !== undefined ? input.observer : existingRow[12],
    input.observerId !== undefined ? input.observerId : existingRow[13],
    input.observerPosition || existingRow[14] || "-",
    input.scores ? JSON.stringify(input.scores) : existingRow[15],
    input.total !== undefined ? Number(input.total) : existingRow[16],
    input.percent !== undefined ? Number(input.percent) : existingRow[17],
    input.level || existingRow[18] || "-",
    input.strengths !== undefined ? input.strengths : existingRow[19],
    input.improvements !== undefined ? input.improvements : existingRow[20],
    input.suggestions !== undefined ? input.suggestions : existingRow[21],
    signTeacherUrl,
    signObserverUrl,
    imgUrl1,
    imgUrl2,
    imgUrl3,
    imgUrl4,
    Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd HH:mm:ss")
  ];

  recordSheet.getRange(rowIndex, 1, 1, updatedRow.length).setValues([updatedRow]);

  writeLog(ss, input.observerId || "", "update_data", "supervision_records", input.id, `แก้ไขบันทึกการนิเทศครู: ${input.teacher}`);

  return jsonResponse({ success: true, message: "อัปเดตข้อมูลบันทึกการนิเทศเรียบร้อยแล้ว" });
}
function deleteReport(ss, id) {
  const sheet = ss.getSheetByName("supervision_records");
  const values = sheet.getDataRange().getValues();
  for(let i = 1; i < values.length; i++) {
    if(String(values[i][0]) === String(id)) {
      sheet.deleteRow(i + 1);
      writeLog(ss, "", "delete_data", "supervision_records", id, `ลบบันทึกการนิเทศรหัส: ${id}`);
      return jsonResponse({ success: true, message: "ลบบันทึกข้อมูลนิเทศเรียบร้อย" });
    }
  }
  return jsonResponse({ success: false, message: "ไม่พบบันทึกการนิเทศ" });
}
// === การจัดการรูปแบบแบบประเมิน (Evaluation Templates) ===
function listTemplates(ss) {
  const data = getSheetData(ss, "evaluation_templates");
  return jsonResponse({ success: true, templates: data });
}
function getTemplate(ss, id) {
  const templates = getSheetData(ss, "evaluation_templates");
  const template = templates.find(t => String(t.id) === String(id));
  
  if (!template) {
    return jsonResponse({ success: false, message: "ไม่พบรูปแบบประเมิน" });
  }
  
  const items = getSheetData(ss, "evaluation_items");
  const filteredItems = items
    .filter(it => String(it.template_id) === String(id))
    .sort((a,b) => Number(a.sort_order) - Number(b.sort_order));
    
  template.items_json = JSON.stringify({ items: filteredItems });
  return jsonResponse({ success: true, template: template });
}
function saveConfig(ss, input) {
  const templateSheet = ss.getSheetByName("evaluation_templates");
  const itemsSheet = ss.getSheetByName("evaluation_items");
  
  let id = input.id;
  const name = input.name;
  
  let items = [];
  if (Array.isArray(input.items)) {
    items = input.items;
  } else if (input.items_json) {
    try {
      let parsed = typeof input.items_json === 'string' ? JSON.parse(input.items_json) : input.items_json;
      if (typeof parsed === 'string') parsed = JSON.parse(parsed);
      items = parsed.items || (Array.isArray(parsed) ? parsed : []);
    } catch(e) {
      console.error("Error parsing items_json:", e);
    }
  }
  
  if (id) {
    // อัปเดตเทมเพลตที่มีอยู่แล้ว
    const tValues = templateSheet.getDataRange().getValues();
    for (let i = 1; i < tValues.length; i++) {
      if (String(tValues[i][0]) === String(id)) {
        templateSheet.getRange(i + 1, 2).setValue(name);
        break;
      }
    }
    
    // ลบหัวข้อประเมินย่อยเดิมของ template_id นี้
    if (itemsSheet) {
      const itemVals = itemsSheet.getDataRange().getValues();
      for (let i = itemVals.length - 1; i >= 1; i--) {
        if (String(itemVals[i][1]) === String(id)) {
          itemsSheet.deleteRow(i + 1);
        }
      }
    }
  } else {
    // สร้างเทมเพลตใหม่
    id = "TMP_" + new Date().getTime();
    if (templateSheet) {
      templateSheet.appendRow([
        id,
        name,
        Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd HH:mm:ss")
      ]);
    }
  }
  
  // บันทึกหัวข้อการประเมินลงในแผ่นงาน evaluation_items
  if (itemsSheet) {
    const timestamp = new Date().getTime();
    items.forEach((item, index) => {
      const itemId = item.id || ("ITEM_" + timestamp + "_" + (index + 1));
      itemsSheet.appendRow([
        itemId,
        id,
        item.type || "sub",
        item.text || "",
        item.sort_order !== undefined ? Number(item.sort_order) : index
      ]);
    });
  }
  
  return jsonResponse({ success: true, message: "บันทึกรูปแบบและหัวข้อการประเมินลงตารางเรียบร้อย" });
}
// === การจัดการภาคเรียน (Academic Terms) ===
function listTerms(ss) {
  const data = getSheetData(ss, "academic_terms");
  return jsonResponse({ success: true, data: data });
}
function getActiveTerm(ss) {
  const data = getSheetData(ss, "academic_terms");
  const active = data.find(t => {
    const act = String(t.is_active).trim().toLowerCase();
    return act === "1" || act === "true" || act === "yes";
  });
  if(active) {
    return jsonResponse({ success: true, data: active });
  } else {
    return jsonResponse({ success: false, message: "ยังไม่ได้ตั้งค่าภาคเรียนปัจจุบัน" });
  }
}
function createTerm(ss, input) {
  const sheet = ss.getSheetByName("academic_terms");
  const checkVals = sheet.getDataRange().getValues();
  
  for(let i = 1; i < checkVals.length; i++) {
    if(String(checkVals[i][1]) === String(input.term) && String(checkVals[i][2]) === String(input.year)) {
      return jsonResponse({ success: false, message: "ภาคเรียนและปีการศึกษานี้มีในระบบแล้ว" });
    }
  }
  
  const id = new Date().getTime();
  const isActVal = input.is_active ? 1 : 0;
  
  if (isActVal === 1) {
    deactivateAllTerms(sheet);
  }
  
  sheet.appendRow([id, input.term, input.year, isActVal]);
  return jsonResponse({ success: true, message: "เพิ่มภาคเรียนเรียบร้อย" });
}
function setTermActive(ss, id) {
  const sheet = ss.getSheetByName("academic_terms");
  deactivateAllTerms(sheet);
  
  const vals = sheet.getDataRange().getValues();
  for(let i = 1; i < vals.length; i++) {
    if(String(vals[i][0]) === String(id)) {
      sheet.getRange(i + 1, 4).setValue("TRUE");
      return jsonResponse({ success: true, message: "ตั้งค่าภาคเรียนปัจจุบันเรียบร้อย" });
    }
  }
  return jsonResponse({ success: false, message: "ไม่พบภาคเรียนที่เลือก" });
}
function deactivateAllTerms(sheet) {
  const vals = sheet.getDataRange().getValues();
  for(let i = 1; i < vals.length; i++) {
    sheet.getRange(i + 1, 4).setValue(0);
  }
}
function deleteTerm(ss, id) {
  const sheet = ss.getSheetByName("academic_terms");
  const vals = sheet.getDataRange().getValues();
  for(let i = 1; i < vals.length; i++) {
    if(String(vals[i][0]) === String(id)) {
      sheet.deleteRow(i + 1);
      return jsonResponse({ success: true, message: "ลบภาคเรียนเรียบร้อย" });
    }
  }
  return jsonResponse({ success: false, message: "ไม่พบภาคเรียนที่ต้องการลบ" });
}
// === มอบหมายงานการนิเทศ (Supervision Assignments) ===
function listAssignments(ss) {
  const assignments = getSheetData(ss, "supervision_assignments");
  const users = getSheetData(ss, "users");
  const terms = getSheetData(ss, "academic_terms");
  
  const mapped = assignments.map(a => {
    const teacher = users.find(u => String(u.id) === String(a.teacher_id));
    const observer = users.find(u => String(u.id) === String(a.observer_id));

    const termObj = terms ? terms.find(t => 
      String(t.id) === String(a.term_id) || 
      String(t.id) === String(a.term) || 
      (String(t.term) === String(a.term) && String(t.year) === String(a.year))
    ) : null;

    const yearVal = String(a.year || a.term_year || (termObj ? termObj.year : "") || "");
    const termVal = String(a.term || (termObj ? termObj.term : "") || "");
    const termName = String(a.term_name || (termObj ? ("ภาคเรียนที่ " + termObj.term) : (termVal ? "ภาคเรียนที่ " + termVal : "")) || "");

    return {
      id: a.id,
      observer_id: a.observer_id,
      observer_name: observer ? (observer.display_name || observer.username) : (a.observer_name || ("ผู้นิเทศ ID: " + a.observer_id)),
      teacher_id: a.teacher_id,
      teacher_name: teacher ? (teacher.display_name || teacher.username) : (a.teacher_name || ("ครู ID: " + a.teacher_id)),
      term: termVal,
      term_id: a.term_id || a.term || (termObj ? termObj.id : ""),
      term_name: termName,
      year: yearVal,
      term_year: yearVal,
      status: a.status || "pending",
      created_at: a.created_at
    };
  });
  
  return jsonResponse({ success: true, data: mapped });
}

function createAssignments(ss, input) {
  const sheet = ss.getSheetByName("supervision_assignments");
  const currentAss = getSheetData(ss, "supervision_assignments");
  const terms = getSheetData(ss, "academic_terms");
  
  let itemsToCreate = [];
  if (input.assignments && Array.isArray(input.assignments)) {
    itemsToCreate = input.assignments;
  } else if (input.term_id && input.observer_ids && input.teacher_ids) {
    const termObj = terms.find(t => String(t.id) === String(input.term_id));
    const termVal = termObj ? termObj.term : input.term_id;
    const yearVal = termObj ? termObj.year : "";
    
    const obsArr = Array.isArray(input.observer_ids) ? input.observer_ids : [input.observer_ids];
    const teachArr = Array.isArray(input.teacher_ids) ? input.teacher_ids : [input.teacher_ids];
    
    obsArr.forEach(obsId => {
      teachArr.forEach(teachId => {
        itemsToCreate.push({
          observer_id: obsId,
          teacher_id: teachId,
          term: termVal,
          year: yearVal
        });
      });
    });
  }
  
  let createdCount = 0;
  
  itemsToCreate.forEach(item => {
    const isDup = currentAss.some(a => 
      String(a.observer_id) === String(item.observer_id) &&
      String(a.teacher_id) === String(item.teacher_id) &&
      String(a.term) === String(item.term) &&
      String(a.year) === String(item.year)
    );
    
    if(!isDup) {
      sheet.appendRow([
        new Date().getTime() + "_" + Math.floor(Math.random() * 1000),
        item.observer_id,
        item.teacher_id,
        item.term,
        item.year,
        "pending",
        Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd HH:mm:ss")
      ]);
      createdCount++;
    }
  });
  
  clearSheetCache("supervision_assignments");
  return jsonResponse({ success: true, message: `บันทึกการมอบหมายงานนิเทศเรียบร้อยแล้ว จำนวน ${createdCount} งาน` });
}

function updateAssignment(ss, input) {
  const sheet = ss.getSheetByName("supervision_assignments");
  if (!sheet) return jsonResponse({ success: false, message: "ไม่พบตารางการมอบหมายงาน" });
  
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return jsonResponse({ success: false, message: "ไม่พบข้อมูลการมอบหมายงาน" });
  
  const headers = data[0];
  const idCol = headers.indexOf("id");
  const obsCol = headers.indexOf("observer_id");
  const teachCol = headers.indexOf("teacher_id");
  const termCol = headers.indexOf("term");
  const yearCol = headers.indexOf("year");

  let termVal = "";
  let yearVal = "";
  if (input.term_id) {
    const terms = getSheetData(ss, "academic_terms");
    const termObj = terms.find(t => String(t.id) === String(input.term_id));
    if (termObj) {
      termVal = termObj.term;
      yearVal = termObj.year;
    }
  }
  
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idCol]) === String(input.id)) {
      if (obsCol !== -1 && input.observer_id) sheet.getRange(i + 1, obsCol + 1).setValue(input.observer_id);
      if (teachCol !== -1 && input.teacher_id) sheet.getRange(i + 1, teachCol + 1).setValue(input.teacher_id);
      if (termCol !== -1 && (termVal || input.term)) sheet.getRange(i + 1, termCol + 1).setValue(termVal || input.term);
      if (yearCol !== -1 && (yearVal || input.year)) sheet.getRange(i + 1, yearCol + 1).setValue(yearVal || input.year);
      
      clearSheetCache("supervision_assignments");
      return jsonResponse({ success: true, message: "แก้ไขข้อมูลการมอบหมายงานเรียบร้อยแล้ว" });
    }
  }
  
  return jsonResponse({ success: false, message: "ไม่พบรายการมอบหมายงานที่ต้องการแก้ไข" });
}

function deleteAssignment(ss, id) {
  const sheet = ss.getSheetByName("supervision_assignments");
  if (!sheet) return jsonResponse({ success: false, message: "ไม่พบตารางการมอบหมายงาน" });
  
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return jsonResponse({ success: false, message: "ไม่พบข้อมูลการมอบหมายงาน" });
  
  const headers = data[0];
  const idCol = headers.indexOf("id");
  
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idCol]) === String(id)) {
      sheet.deleteRow(i + 1);
      clearSheetCache("supervision_assignments");
      return jsonResponse({ success: true, message: "ลบการมอบหมายงานเรียบร้อยแล้ว" });
    }
  }
  
  return jsonResponse({ success: false, message: "ไม่พบรายการมอบหมายงานที่ต้องการลบ" });
}
// === บันทึกประวัติ (Write Log helper) ===
function writeLog(ss, userId, action, tableName, rowId, details) {
  const sheet = ss.getSheetByName("logs");
  if (!sheet) return;
  
  // ตรวจสอบและสร้างหัวข้อในตาราง logs คอลัมน์ H และ I ถ้ายังไม่มี
  if (sheet.getLastColumn() < 8) {
    sheet.getRange(1, 8).setValue("ip_address");
    sheet.getRange(1, 9).setValue("user_agent");
  }
  
  sheet.appendRow([
    new Date().getTime() + "_" + Math.floor(Math.random() * 100),
    userId || "",
    action,
    tableName || "",
    rowId || "",
    details,
    Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd HH:mm:ss"),
    currentRequestIP,
    currentRequestUA
  ]);
}
// === นำเข้าผู้ใช้งานด้วย JSON (Import CSV parsed from frontend) ===
function importUsers(ss, input) {
  const sheet = ss.getSheetByName("users");
  const currentUsers = getSheetData(ss, "users");
  const usersToImport = input.users || []; // array ของข้อมูลครู
  
  let success = 0;
  let fail = 0;
  
  usersToImport.forEach(user => {
    const exists = currentUsers.some(u => String(u.username).trim() === String(user.username).trim());
    if (exists || !user.username || !user.password) {
      fail++;
    } else {
      const hash = sha256(user.password);
      sheet.appendRow([
        new Date().getTime() + "_" + Math.floor(Math.random() * 1000),
        user.username,
        hash,
        user.display_name,
        user.email || "",
        user.role || "teacher",
        "",
        user.position || "",
        user.academic_standing || "",
        user.department || "",
        Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd HH:mm:ss")
      ]);
      success++;
    }
  });
  
  return jsonResponse({ success: true, message: `นำเข้าสำเร็จ ${success} ราย, ข้ามบรรทัดที่ซ้ำ/ไม่สมบูรณ์ ${fail} ราย` });
}
// === อัปโหลดรูปภาพลง Google Drive และเปิดสิทธิ์แชร์ ===
function saveBase64ImageToDrive(base64Str, fileName) {
  if (!base64Str || !base64Str.startsWith("data:image")) return "";
  
  const folder = DriveApp.getFolderById(UPLOAD_FOLDER_ID);
  const match = base64Str.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!match) return "";
  
  const contentType = "image/" + match[1];
  const rawData = Utilities.base64Decode(match[2]);
  const blob = Utilities.newBlob(rawData, contentType, fileName);
  
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  
  // แปลงให้เป็น URL สำหรับแสดงผลรูปภาพโดยตรง (Direct Image Link) เพื่อให้หน้าเว็บนำไปทำ img src ได้โดยไม่ติดหน้าดาวน์โหลด
  const fileId = file.getId();
  return "https://drive.google.com/thumbnail?id=" + fileId + "&sz=w1000";
}
// === ดึงข้อมูลประวัติกิจกรรม (Logs) ===
function listLogs(ss) {
  const logs = getSheetData(ss, "logs");
  const users = getSheetData(ss, "users");
  
  // สร้างแผนผังจับคู่ user_id กับ display_name หรือ username
  const userMap = {};
  users.forEach(u => {
    userMap[String(u.id)] = u.display_name || u.username;
  });
  
  const mappedLogs = logs.map(log => {
    const userId = String(log.user_id || "");
    const username = userMap[userId] || (userId === "1" ? "ผู้ดูแลระบบหลัก" : (userId ? "ผู้ใช้งาน ID: " + userId : "ระบบ"));
    
    return {
      id: log.id,
      user_id: log.user_id || "",
      username: username,
      action: log.action || "",
      description: log.details || "",
      ip_address: log.ip_address || "GAS_API",
      user_agent: log.user_agent || "Google Apps Script Serverless",
      date_formatted: log.created_at || "",
      created_at: log.created_at || ""
    };
  });
  
  mappedLogs.sort((a, b) => {
    const timeA = new Date(a.created_at || a.id || 0).getTime();
    const timeB = new Date(b.created_at || b.id || 0).getTime();
    return timeB - timeA;
  });
  return jsonResponse({ success: true, data: mappedLogs });
}
// SHA-256 function สำหรับสร้าง Hash ของรหัสผ่าน
function sha256(input) {
  const hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, input, Utilities.Charset.UTF_8);
  let hashStr = "";
  for (let i = 0; i < hash.length; i++) {
    let byteVal = hash[i];
    if (byteVal < 0) byteVal += 256;
    let byteString = byteVal.toString(16);
    if (byteString.length == 1) byteString = "0" + byteString;
    hashStr += byteString;
  }
  return hashStr;
}

// === คำนวณข้อมูลสถิติ/สารสนเทศสำหรับหน้าวิเคราะห์ข้อมูล (Analytics) ===
function getAnalyticsData(ss, year, term) {
  const records = getSheetData(ss, "supervision_records");
  const users = getSheetData(ss, "users");
  
  // จำนวนครูทั้งหมดในระบบ
  let teacherUsers = users.filter(u => String(u.role).toLowerCase() === "teacher" || String(u.role).toLowerCase() === "user" || String(u.role).toLowerCase() === "observer");
  if (teacherUsers.length === 0 && users.length > 0) {
    teacherUsers = users;
  }
  const totalAllTeachersCount = teacherUsers.length;

  let filtered = records;
  if (year && year !== "" && year !== "all") {
    filtered = filtered.filter(r => String(r.year || "").trim() === String(year).trim());
  }
  if (term && term !== "" && term !== "all") {
    filtered = filtered.filter(r => String(r.term || "").trim() === String(term).trim());
  }
  
  const totalRecords = filtered.length;
  const uniqueTeachers = {};
  let totalPercentSum = 0;
  let validPercentCount = 0;
  
  const levelsCount = {
    "ดีมาก": 0,
    "ดี": 0,
    "พอใช้": 0,
    "ปรับปรุง": 0
  };
  
  const deptStats = {};
  
  filtered.forEach(r => {
    // 1. ดึงชื่อครูผู้รับการนิเทศ (Teacher Name)
    let teacherName = r.teacher || r.teacher_name || r.teacherId || r.teacher_id || r["ครูผู้รับการนิเทศ"] || r["ชื่อครู"] || r["ผู้รับการนิเทศ"];
    if (!teacherName && typeof r === 'object') {
      const keys = Object.keys(r);
      if (keys.length >= 4 && r[keys[3]]) teacherName = r[keys[3]];
    }
    if (teacherName && String(teacherName).trim() !== "" && String(teacherName).trim() !== "-") {
      uniqueTeachers[String(teacherName).trim()] = true;
    }
    
    // 2. ดึงคะแนนร้อยละ (Percent / Percentage)
    let rawPct = r.percent !== undefined ? r.percent : (r.percentage !== undefined ? r.percentage : (r["คะแนนร้อยละ"] !== undefined ? r["คะแนนร้อยละ"] : r["ร้อยละ"]));
    if (rawPct === undefined || rawPct === null || rawPct === "") {
      if (r.total !== undefined && !isNaN(parseFloat(r.total))) {
        rawPct = parseFloat(r.total);
      }
    }
    
    const pct = parseFloat(String(rawPct || 0).replace(/%/g, '').trim());
    if (!isNaN(pct)) {
      totalPercentSum += pct;
      validPercentCount++;
      
      const dept = r.department || r.dept || r.group || r["กลุ่มสาระการเรียนรู้"] || r["กลุ่มสาระ"] || "ไม่ระบุ";
      if (!deptStats[dept]) {
        deptStats[dept] = { sum: 0, count: 0 };
      }
      deptStats[dept].sum += pct;
      deptStats[dept].count += 1;
    }
    
    let lvl = String(r.level || r.level_name || r["ระดับคุณภาพ"] || r["ระดับผลการประเมิน"] || "").trim();
    if (lvl === "ยอดเยี่ยม" || lvl === "ดีเลิศ" || lvl === "ดีมาก") {
      levelsCount["ดีมาก"]++;
    } else if (lvl === "ดี") {
      levelsCount["ดี"]++;
    } else if (lvl === "ปานกลาง" || lvl === "พอใช้") {
      levelsCount["พอใช้"]++;
    } else if (lvl === "ควรพัฒนา" || lvl === "ปรับปรุง" || lvl === "ควรปรับปรุง" || lvl === "ไม่ผ่าน") {
      levelsCount["ปรับปรุง"]++;
    }
  });
  
  const supervisedTeachersCount = Object.keys(uniqueTeachers).length;
  const allTeachersCount = Math.max(totalAllTeachersCount, supervisedTeachersCount);
  
  const supervisedRate = allTeachersCount > 0 
    ? ((supervisedTeachersCount / allTeachersCount) * 100).toFixed(1) 
    : "0.0";
    
  const avgScore = validPercentCount > 0 
    ? (totalPercentSum / validPercentCount).toFixed(2) 
    : (totalRecords > 0 && totalPercentSum > 0 ? (totalPercentSum / totalRecords).toFixed(2) : "0.00");
  
  const levelsArray = Object.entries(levelsCount).map(([level, count]) => ({
    level: level,
    count: count
  }));
  
  const deptArray = Object.entries(deptStats).map(([dept, stat]) => ({
    department: dept,
    avg_score: (stat.sum / stat.count).toFixed(2)
  }));
  
  const responseData = {
    overview: {
      total_records: totalRecords,
      total_all_teachers: allTeachersCount,
      supervised_teachers: supervisedTeachersCount,
      supervised_rate: supervisedRate,
      avg_score: avgScore
    },
    levels: levelsArray,
    departments: deptArray
  };
  
  return jsonResponse({ success: true, data: responseData });
}

