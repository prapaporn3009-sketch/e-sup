/**
 * Configuration & Global Session Helpers for e-Supervision
 */

// URL สำหรับเรียกใช้งาน Google Apps Script Web App API (หลังบ้าน)
// ให้ผู้ใช้งานนำ URL ที่ได้จากการ Deploy Apps Script เป็น Web App มาวางแทนที่ค่าว่างนี้
const GAS_API_URL = "https://script.google.com/macros/s/AKfycbxq2SaC4w97ugKBgwftMolqe8fHiQvp973SGYqpBVhQaJPmTHv98qWfHSr5_shq3474zg/exec";

// ดึงไอพีสาธารณะของลูกค้าและเก็บไว้ใน sessionStorage
if (typeof window !== 'undefined' && !sessionStorage.getItem('client_ip')) {
    fetch('https://api.ipify.org?format=json')
        .then(r => r.json())
        .then(data => sessionStorage.setItem('client_ip', data.ip))
        .catch(() => sessionStorage.setItem('client_ip', 'GAS_API'));
}

/**
 * ดึงข้อมูลผู้ใช้งานที่ล็อกอินปัจจุบันจาก LocalStorage
 */
function getSession() {
    const sessionStr = localStorage.getItem('user_session');
    if (!sessionStr) return null;
    try {
        return JSON.parse(sessionStr);
    } catch (e) {
        return null;
    }
}

/**
 * บันทึกข้อมูลเซสชันลง LocalStorage
 */
function saveSession(userData) {
    if (userData) {
        localStorage.setItem('user_session', JSON.stringify(userData));
    }
}

/**
 * ล้างข้อมูลเซสชันออกจาก LocalStorage (ออกจากระบบ)
 */
function clearSession() {
    localStorage.removeItem('user_session');
}

/**
 * ตรวจสอบการยืนยันตัวตนและการเข้าถึงหน้านั้นๆ
 * @param {string[]} allowedRoles บทบาทที่มีสิทธิ์ (เช่น ['admin', 'observer']) หากปล่อยว่างแปลว่าทุกคนที่เข้าสู่ระบบมีสิทธิ์
 * @param {string} redirectUrl หน้าที่จะโยนไปเมื่อไม่มีสิทธิ์ (เช่น 'login.html')
 */
function checkAuth(allowedRoles = [], redirectUrl = '../auth/login.html') {
    const user = getSession();
    if (!user) {
        window.location.href = redirectUrl;
        return null;
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
        // หากไม่มีบทบาทตามสิทธิ์ ให้ดีดไปหน้า Dashboard หลัก
        alert('คุณไม่มีสิทธิ์เข้าใช้งานหน้านี้');
        window.location.href = '../views/dashboard.html';
        return null;
    }

    return user;
}

/**
 * ฟังก์ชัน Wrapper สำหรับยิง Fetch API ไปหา Google Apps Script
 * @param {string} action ชื่อแอ็กชัน (เช่น login, saveData, getSettings)
 * @param {object} options รายละเอียดคำขอ (Method, Body, Headers)
 */
async function callGAS(action, options = {}) {
    if (!GAS_API_URL) {
        throw new Error("ยังไม่ได้ตั้งค่าคีย์หลังบ้าน GAS_API_URL ในไฟล์ assets/js/config.js");
    }

    const clientIp = (typeof sessionStorage !== 'undefined') ? (sessionStorage.getItem('client_ip') || 'GAS_API') : 'GAS_API';
    const userAgent = (typeof navigator !== 'undefined') ? navigator.userAgent : 'NodeJS Subagent';
    
    // ดึงเซสชันโทเค็นปัจจุบันของผู้ใช้ล็อกอิน (ถ้ามี)
    let sessionToken = '';
    const sessionStr = localStorage.getItem('user_session');
    if (sessionStr) {
        try {
            const sessionObj = JSON.parse(sessionStr);
            if (sessionObj && sessionObj.session_token) {
                sessionToken = sessionObj.session_token;
            }
        } catch (e) {}
    }

    const url = `${GAS_API_URL}?action=${action}&session_token=${encodeURIComponent(sessionToken)}&client_ip=${encodeURIComponent(clientIp)}&user_agent=${encodeURIComponent(userAgent)}`;
    const defaultHeaders = {
        'Content-Type': 'text/plain;charset=utf-8' // สำคัญ: ใช้ text/plain เพื่อหลีกเลี่ยงข้อจำกัด CORS preflight OPTIONS ของ GAS
    };

    const fetchOptions = {
        method: options.method || 'GET',
        headers: {
            ...defaultHeaders,
            ...options.headers
        }
    };

    if (options.body) {
        fetchOptions.body = JSON.stringify(options.body);
    }

    try {
        const response = await fetch(url, fetchOptions);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (err) {
        console.error(`เกิดข้อผิดพลาดในการเรียกใช้ API: action=${action}`, err);
        throw err;
    }
}

// === ตัวดักฟังการเชื่อมต่อแบบสากลเพื่อปรับปรุงรูปแบบลิงก์รูปภาพ Google Drive ===
if (typeof window !== 'undefined') {
    const originalFetch = window.fetch;
    window.fetch = function() {
        let [resource, config] = arguments;
        if (typeof resource === 'string' && (resource.startsWith(GAS_API_URL) || resource.includes('script.google.com'))) {
            return originalFetch(resource, config).then(response => {
                if (response.ok) {
                    return response.text().then(text => {
                        if (text.includes('lh3.googleusercontent.com')) {
                            const correctedText = text.replace(/https:\/\/lh3\.googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/g, 'https://drive.google.com/thumbnail?id=$1&sz=w1000');
                            return new Response(correctedText, {
                                status: response.status,
                                statusText: response.statusText,
                                headers: response.headers
                            });
                        }
                        return new Response(text, {
                            status: response.status,
                            statusText: response.statusText,
                            headers: response.headers
                        });
                    });
                }
                return response;
            });
        }
        return originalFetch(resource, config);
    };
}
