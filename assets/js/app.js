// Thai Date Formatter Helper
function formatDateThai(dateStr) {
    if (!dateStr || dateStr === '-') return '-';
    if (typeof dateStr === 'string' && (dateStr.includes('ม.ค.') || dateStr.includes('มกราคม') || dateStr.includes('พ.ศ.'))) {
        return dateStr;
    }
    
    let date;
    if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())) {
        const [y, m, d] = dateStr.trim().split('-').map(Number);
        date = new Date(y, m - 1, d);
    } else {
        date = new Date(dateStr);
    }
    
    if (isNaN(date.getTime())) return dateStr;

    const thaiMonthsFull = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
    const day = date.getDate();
    const month = thaiMonthsFull[date.getMonth()];
    const year = date.getFullYear() + 543;
    
    return `${day} ${month} ${year}`;
}

// ================= TablePaginator Helper Class =================
class TablePaginator {
    constructor(options) {
        this.tableBodyId = options.tableBodyId;
        this.paginationContainerId = options.paginationContainerId;
        this.pageSize = options.pageSize || 10;
        this.rawItems = [];
        this.filteredItems = [];
        this.currentPage = 1;
        this.renderRowCallback = options.renderRow;
        this.filterCallback = options.filter || ((items) => items);
        
        // แปลงเครื่องหมายยีดกลางเป็นขีดล่างเพื่อใช้เป็นชื่อตัวแปรที่ถูกต้อง
        this.instanceName = this.tableBodyId.replace(/-/g, '_') + 'Paginator';
        window[this.instanceName] = this;
        
        this.setupElements();
    }
    
    setupElements() {
        this.tbody = document.getElementById(this.tableBodyId);
        this.pagContainer = document.getElementById(this.paginationContainerId);
    }
    
    setData(items) {
        this.rawItems = items || [];
        this.applyFilter();
    }
    
    applyFilter() {
        this.filteredItems = this.filterCallback(this.rawItems);
        this.currentPage = 1;
        this.render();
    }
    
    render() {
        if (!this.tbody) this.setupElements();
        if (!this.tbody) return;
        
        this.tbody.innerHTML = '';
        
        if (this.filteredItems.length === 0) {
            const colspan = this.tbody.closest('table').querySelectorAll('thead th').length || 6;
            this.tbody.innerHTML = `<tr><td colspan="${colspan}" class="text-center py-8 text-gray-500">ไม่พบข้อมูลที่ตรงกับเงื่อนไข</td></tr>`;
            if (this.pagContainer) this.pagContainer.innerHTML = '';
            return;
        }
        
        const start = (this.currentPage - 1) * this.pageSize;
        const end = start + this.pageSize;
        const pageItems = this.filteredItems.slice(start, end);
        
        pageItems.forEach((item, index) => {
            const actualIndex = start + index;
            const trHtml = this.renderRowCallback(item, actualIndex);
            if (trHtml) {
                this.tbody.insertAdjacentHTML('beforeend', trHtml);
            }
        });
        
        this.renderPagination();
    }
    
    renderPagination() {
        if (!this.pagContainer) return;
        this.pagContainer.innerHTML = '';
        
        const totalPages = Math.ceil(this.filteredItems.length / this.pageSize);
        if (totalPages <= 1) return;
        
        const wrapper = document.createElement('div');
        wrapper.className = 'flex justify-between items-center px-4 py-3 bg-white border-t border-gray-200 sm:px-6 w-full mt-4 rounded-b-lg';
        
        const startItem = (this.currentPage - 1) * this.pageSize + 1;
        const endItem = Math.min(this.currentPage * this.pageSize, this.filteredItems.length);
        
        let paginationButtons = '';
        
        // Prev button
        const prevDisabled = this.currentPage === 1 ? 'disabled class="opacity-50 cursor-not-allowed text-gray-400 px-3 py-2 border border-gray-300 rounded-l-md bg-white"' : 'class="relative inline-flex items-center px-3 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"';
        paginationButtons += `
            <button onclick="window['${this.instanceName}'].setPage(${this.currentPage - 1})" ${prevDisabled}>
                <i class="fas fa-chevron-left"></i>
            </button>
        `;
        
        // Page numbers
        for (let i = 1; i <= totalPages; i++) {
            const activeClass = i === this.currentPage 
                ? 'z-10 bg-blue-50 border-blue-500 text-blue-600' 
                : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50';
            paginationButtons += `
                <button onclick="window['${this.instanceName}'].setPage(${i})" class="relative inline-flex items-center px-4 py-2 border text-sm font-medium ${activeClass}">
                    ${i}
                </button>
            `;
        }
        
        // Next button
        const nextDisabled = this.currentPage === totalPages ? 'disabled class="opacity-50 cursor-not-allowed text-gray-400 px-3 py-2 border border-gray-300 rounded-r-md bg-white"' : 'class="relative inline-flex items-center px-3 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"';
        paginationButtons += `
            <button onclick="window['${this.instanceName}'].setPage(${this.currentPage + 1})" ${nextDisabled}>
                <i class="fas fa-chevron-right"></i>
            </button>
        `;
        
        wrapper.innerHTML = `
            <div class="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between w-full">
                <div>
                    <p class="text-sm text-gray-700">
                        แสดงผลที่ <span class="font-medium">${startItem}</span> ถึง <span class="font-medium">${endItem}</span> จากทั้งหมด <span class="font-medium">${this.filteredItems.length}</span> รายการ
                    </p>
                </div>
                <div>
                    <nav class="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                        ${paginationButtons}
                    </nav>
                </div>
            </div>
        `;
        
        this.pagContainer.appendChild(wrapper);
    }
    
    setPage(page) {
        this.currentPage = page;
        this.render();
    }
}

        // ==========================================
        // Evaluation Criteria Editor Logic
        // ==========================================
        let criteriaData = window.evaluationCriteria || [];

        function renderCriteriaEditor() {
            const tbody = document.getElementById('criteria-table-body');
            if (!tbody) return;
            
            // ถ้ายังไม่มีเกณฑ์เลย ให้ลองดึงจาก global state เผื่อมีการโหลดมาแล้ว
            if (criteriaData.length === 0 && window.evaluationCriteria) {
                criteriaData = window.evaluationCriteria;
            }
            
            tbody.innerHTML = '';
            
            if (criteriaData.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-gray-500">ไม่มีข้อมูลเกณฑ์ กรุณาเพิ่มเกณฑ์ใหม่</td></tr>';
                return;
            }
            
            const colorOptions = [
                { val: 'green', label: 'เขียว (ดีมาก)' },
                { val: 'blue', label: 'น้ำเงิน (ดี)' },
                { val: 'yellow', label: 'เหลือง (พอใช้)' },
                { val: 'orange', label: 'ส้ม (ควรปรับปรุง)' },
                { val: 'red', label: 'แดง (ไม่ผ่าน)' }
            ];
            
            criteriaData.forEach((item, index) => {
                const tr = document.createElement('tr');
                
                let colorSelect = '<select class="w-full border-gray-300 rounded p-1 text-sm" onchange="updateCriteria(' + index + ', \'color\', this.value)">';
                colorOptions.forEach(opt => {
                    colorSelect += `<option value="${opt.val}" ${item.color === opt.val ? 'selected' : ''}>${opt.label}</option>`;
                });
                colorSelect += '</select>';
                
                tr.innerHTML = `
                    <td class="px-4 py-2"><input type="text" value="${item.name}" onchange="updateCriteria(${index}, 'name', this.value)" class="w-full border-gray-300 rounded p-1 text-sm"></td>
                    <td class="px-4 py-2"><input type="number" value="${item.min}" onchange="updateCriteria(${index}, 'min', this.value)" class="w-full border-gray-300 rounded p-1 text-sm text-center" min="0" max="100"></td>
                    <td class="px-4 py-2"><input type="number" value="${item.max}" onchange="updateCriteria(${index}, 'max', this.value)" class="w-full border-gray-300 rounded p-1 text-sm text-center" min="0" max="100"></td>
                    <td class="px-4 py-2">${colorSelect}</td>
                    <td class="px-4 py-2 text-center">
                        <button onclick="removeCriteriaItem(${index})" class="text-red-500 hover:text-red-700" title="ลบ"><i class="fas fa-trash-alt"></i></button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
            
            // Sort data by max descending for correct evaluation logic
            criteriaData.sort((a, b) => b.max - a.max);
            // Update global window object for other views to use
            window.evaluationCriteria = criteriaData;
        }

        function addCriteriaItem() {
            criteriaData.push({ name: 'เกณฑ์ใหม่', min: 0, max: 0, color: 'blue' });
            renderCriteriaEditor();
        }

        function updateCriteria(index, field, value) {
            if (field === 'min' || field === 'max') value = parseInt(value) || 0;
            criteriaData[index][field] = value;
            renderCriteriaEditor();
        }

        function removeCriteriaItem(index) {
            criteriaData.splice(index, 1);
            renderCriteriaEditor();
        }

        function saveCriteriaConfig() {
            Swal.fire({ title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            
            fetch('../api/settings.php?action=save_criteria', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ evaluation_criteria: criteriaData })
            })
            .then(res => res.json())
            .then(res => {
                if (res.success) {
                    Swal.fire('สำเร็จ', res.message, 'success');
                } else {
                    Swal.fire('ข้อผิดพลาด', res.message, 'error');
                }
            })
            .catch(err => Swal.fire('ข้อผิดพลาด', err.message, 'error'));
        }
        // ================= Global State & Auth =================
        let configData = { items: [] };
        let signTeacher, signObserver;

        // ================= Initialization =================
        let globalTemplates = [];

        window.addEventListener('popstate', (e) => {
            if (e.state && e.state.page) {
                performSwitch(e.state.page);
            } else {
                const path = window.location.pathname;
                const match = path.match(/\/([^\/]+)\.php$/);
                const page = (match && match[1] !== 'dashboard') ? match[1] : 'home';
                performSwitch(page);
            }
        });

        window.addEventListener('DOMContentLoaded', () => {
            const path = window.location.pathname;
            const match = path.match(/\/([^\/]+)\.php$/);
            const page = (match && match[1] !== 'dashboard') ? match[1] : null;
            if (page) {
                performSwitch(page);
            }
            loadConfig();
            loadTemplatesList();

            const now = new Date();
            now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
            const fDate = document.getElementById('f_date');
            if (fDate) fDate.value = now.toISOString().slice(0, 10);

            const cT = document.getElementById('padTeacher');
            const cO = document.getElementById('padObserver');
            if (cT && cO) {
                signTeacher = new SignaturePad(cT, { backgroundColor: 'rgb(255, 255, 255)', penColor: 'rgb(30, 64, 175)' }); // หมึกสีน้ำเงิน
                signObserver = new SignaturePad(cO, { backgroundColor: 'rgb(255, 255, 255)', penColor: 'rgb(30, 64, 175)' });
            }
        });

        function toggleSidebar() {
            const sidebar = document.getElementById('sidebar');
            const overlay = document.getElementById('sidebar-overlay');
            sidebar.classList.toggle('-translate-x-full');
            overlay.classList.toggle('hidden');
        }

                function switchView(viewId) {
            performSwitch(viewId);
            window.history.pushState({page: viewId}, '', viewId + '.php');
        }

        function performSwitch(viewId) {
            document.querySelectorAll('.view-section').forEach(el => el.classList.add('view-hidden'));
            document.getElementById('view-' + viewId).classList.remove('view-hidden');
            
            // ปิด Sidebar บนมือถือ
            const sidebar = document.getElementById('sidebar');
            const overlay = document.getElementById('sidebar-overlay');
            if (sidebar && !sidebar.classList.contains('-translate-x-full')) {
                sidebar.classList.add('-translate-x-full');
                if(overlay) overlay.classList.add('hidden');
            }

            if (viewId === 'settings') {
                loadSettingsTemplatesList();
                const evw = document.getElementById('template-editor-view');
                const lvw = document.getElementById('template-list-view');
                if (evw && lvw) {
                    evw.classList.add('hidden');
                    lvw.classList.remove('hidden');
                }
            }
            if (viewId === 'form') {
                loadFormTeachers();
                renderEvalTable();
            }
            if (viewId === 'report') loadReportData();
            if (viewId === 'users') loadUsers();
        }

        // ================= Config System =================
        function loadConfig() {
            fetch('../api/api.php?action=getConfig')
                .then(response => {
                    if (!response.ok) throw new Error('เกิดข้อผิดพลาดในการโหลดการตั้งค่า');
                    return response.json();
                })
                .then(res => {
                    configData = res;
                    if (!configData.items || configData.items.length === 0) {
                        configData.items = [
                            { id: generateId(), type: 'main', text: 'ด้านการเตรียมการสอน' },
                            { id: generateId(), type: 'sub', text: 'มีแผนการจัดการเรียนรู้ที่สอดคล้องกับตัวชี้วัด' }
                        ];
                    }
                    // ถ้าเปิดหน้า config อยู่ให้โหลดใหม่
                    if (!document.getElementById('view-config').classList.contains('view-hidden')) {
                        renderConfigEditor();
                    }
                    // ถ้าเปิดหน้า form อยู่ ให้เรนเดอร์ตารางใหม่ด้วย
                    if (!document.getElementById('view-form').classList.contains('view-hidden')) {
                        renderEvalTable();
                    }
                })
                .catch(err => console.error("โหลดการตั้งค่าล้มเหลว:", err));
        }

        function generateId() { return 'item_' + Math.random().toString(36).substr(2, 9); }

        function renderConfigEditor() {
            const container = document.getElementById('config-container');
            container.innerHTML = '';

            if (configData.items.length === 0) {
                container.innerHTML = '<p class="text-gray-400 italic">ยังไม่มีหัวข้อประเมิน กรุณาเพิ่มหัวข้อ</p>';
                return;
            }

            configData.items.forEach((item, index) => {
                const isMain = item.type === 'main';
                const bgClass = isMain ? 'bg-blue-50 border-l-4 border-school' : 'bg-white border ml-8';
                const icon = isMain ? '<i class="fas fa-folder-open text-school mr-2"></i>' : '<i class="fas fa-file-alt text-blue-300 mr-2"></i>';

                const html = `
                    <div class="flex items-center p-3 rounded shadow-sm ${bgClass}" data-id="${item.id}">
                        <div class="cursor-move text-gray-300 mr-3"><i class="fas fa-grip-vertical"></i></div>
                        ${icon}
                        <input type="text" class="flex-grow border-b border-gray-200 focus:outline-none focus:border-school bg-transparent px-2 py-1 ${isMain ? 'font-bold text-school' : 'text-gray-700'}" 
                               value="${item.text}" onchange="updateConfigText('${item.id}', this.value)" placeholder="${isMain ? 'ระบุหัวข้อหลัก' : 'ระบุหัวข้อย่อย'}">
                        <button onclick="removeConfigItem('${item.id}')" class="text-red-400 hover:text-red-600 ml-4 transition"><i class="fas fa-trash"></i></button>
                    </div>
                `;
                container.insertAdjacentHTML('beforeend', html);
            });
        }

        function addConfigItem(type) { configData.items.push({ id: generateId(), type: type, text: '' }); renderConfigEditor(); }
        function removeConfigItem(id) { configData.items = configData.items.filter(i => String(i.id) !== String(id)); renderConfigEditor(); }
        function updateConfigText(id, val) { const item = configData.items.find(i => String(i.id) === String(id)); if (item) item.text = val; }

        // original saveConfig 
function saveConfigOriginal() {
            Swal.fire({ title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            fetch('../api/api.php?action=saveConfig', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(configData)
            })
            .then(response => {
                if (!response.ok) throw new Error('ไม่สามารถบันทึกข้อมูลการตั้งค่าไปยังเซิร์ฟเวอร์');
                return response.json();
            })
            .then(res => {
                if (res.success) Swal.fire('สำเร็จ', res.message, 'success');
                else Swal.fire('ข้อผิดพลาด', res.message, 'error');
            })
            .catch(err => Swal.fire('ข้อผิดพลาดเซิร์ฟเวอร์', err.message, 'error'));
        }

        // ================= Image Preview =================
        function previewImage(input, previewId) {
            const preview = document.getElementById(previewId);
            const container = document.getElementById('previewContainer' + previewId.replace('preview', ''));

            if (input.files && input.files[0]) {
                const reader = new FileReader();
                reader.onload = function (e) {
                    preview.src = e.target.result;
                    container.classList.remove('hidden');
                }
                reader.readAsDataURL(input.files[0]);
            } else {
                preview.src = "";
                container.classList.add('hidden');
            }
        }

        // ================= Form System =================
        function renderEvalTable() {
            const tbody = document.getElementById('eval-table-body');
            tbody.innerHTML = '';
            let mainCounter = 0, subCounter = 0, totalMaxScore = 0;

            configData.items.forEach(item => {
                if (item.type === 'main') {
                    mainCounter++; subCounter = 0;
                    tbody.insertAdjacentHTML('beforeend', `<tr class="topic-main"><td class="text-center">${mainCounter}.</td><td colspan="6">${item.text}</td></tr>`);
                } else {
                    subCounter++;
                    let prefix = mainCounter > 0 ? mainCounter + "." + subCounter : subCounter;
                    totalMaxScore += 5;
                    tbody.insertAdjacentHTML('beforeend', `
                        <tr class="hover:bg-blue-50 transition">
                            <td class="text-center text-sm text-gray-500">${prefix}</td>
                            <td class="topic-sub">${item.text}</td>
                            <td class="text-center"><input type="radio" name="${item.id}" value="5" onchange="calcScore()" required></td>
                            <td class="text-center"><input type="radio" name="${item.id}" value="4" onchange="calcScore()"></td>
                            <td class="text-center"><input type="radio" name="${item.id}" value="3" onchange="calcScore()"></td>
                            <td class="text-center"><input type="radio" name="${item.id}" value="2" onchange="calcScore()"></td>
                            <td class="text-center"><input type="radio" name="${item.id}" value="1" onchange="calcScore()"></td>
                        </tr>
                    `);
                }
            });
            document.getElementById('display-max').innerText = totalMaxScore;
        }

        function calcScore() {
            const radios = document.querySelectorAll('#eval-table-body input[type="radio"]:checked');
            let sum = 0;
            radios.forEach(r => sum += parseInt(r.value));

            const max = parseInt(document.getElementById('display-max').innerText) || 1;
            const percent = ((sum / max) * 100).toFixed(2);

            let level = "ไม่ผ่าน", color = "text-red-600 border-red-200";
            if (percent >= 91) { level = "ดีมาก"; color = "text-green-600 border-green-200"; }
            else if (percent >= 81) { level = "ดี"; color = "text-blue-600 border-blue-200"; }
            else if (percent >= 71) { level = "พอใช้"; color = "text-yellow-600 border-yellow-200"; }
            else if (percent >= 61) { level = "ควรปรับปรุง"; color = "text-orange-600 border-orange-200"; }

            document.getElementById('display-total').innerText = sum;
            document.getElementById('display-percent').innerText = percent;

            const lvlEl = document.getElementById('display-level');
            lvlEl.innerText = level;
            lvlEl.className = `font-bold text-xl px-4 py-1 rounded bg-white shadow-sm border ${color}`;
        }

        async function submitForm(e) {
            e.preventDefault();

            const scores = {};
            configData.items.forEach(item => {
                if (item.type === 'sub') {
                    const checked = document.querySelector(`input[name="${item.id}"]:checked`);
                    scores[item.id] = checked ? checked.value : 0;
                }
            });

            // แปลงไฟล์แนบทั้ง 4 รูปเป็น Base64
            const getBase64 = async (id) => {
                const fileInput = document.getElementById(id);
                if (fileInput && fileInput.files.length > 0) return await toBase64(fileInput.files[0]);
                return "";
            };

            const f1 = await getBase64('f_file1');
            const f2 = await getBase64('f_file2');
            const f3 = await getBase64('f_file3');
            const f4 = await getBase64('f_file4');

            const stData = signTeacher.isEmpty() ? "" : signTeacher.toDataURL();
            const soData = signObserver.isEmpty() ? "" : signObserver.toDataURL();
            const teacherSelect = document.getElementById('f_teacher');
            const teacherId = teacherSelect.value;
            const teacherName = teacherSelect.options[teacherSelect.selectedIndex] ? teacherSelect.options[teacherSelect.selectedIndex].text : '';

            const formData = {
                occurrence: document.getElementById('f_occurrence').value,
                term: document.getElementById('f_term').value,
                year: document.getElementById('f_year').value,
                teacher: teacherName,
                teacherId: teacherId,
                department: document.getElementById('f_department').value,
                subject: document.getElementById('f_subject').value,
                className: document.getElementById('f_class').value,
                date: document.getElementById('f_date').value,
                time: document.getElementById('f_time').value,
                observer: document.getElementById('f_observer').value,
                teacherPosition: document.getElementById('f_teacher_pos').value,
                observerPosition: document.getElementById('f_observer_pos').value,
                scores: scores,
                total: document.getElementById('display-total').innerText,
                percent: document.getElementById('display-percent').innerText,
                level: document.getElementById('display-level').innerText,
                strengths: document.getElementById('f_strengths').value,
                improvements: document.getElementById('f_improvements').value,
                suggestions: document.getElementById('f_suggestions').value,
                signTeacher: stData,
                signObserver: soData,
                attachedFileBase64_1: f1,
                attachedFileBase64_2: f2,
                attachedFileBase64_3: f3,
                attachedFileBase64_4: f4
            };

            Swal.fire({
                title: 'กำลังอัปโหลดข้อมูล...',
                text: 'กรุณารอสักครู่ หากแนบรูปภาพหลายรูปอาจใช้เวลาสักพัก',
                allowOutsideClick: false, didOpen: () => Swal.showLoading()
            });

            
            const apiUrl = editModeId ? '../api/api.php?action=updateReport' : '../api/api.php?action=saveData';
            if (editModeId) formData.id = editModeId;

            fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            })
            .then(response => {
                if (!response.ok) throw new Error('เกิดข้อผิดพลาดในการส่งข้อมูลไปยังเซิร์ฟเวอร์');
                return response.json();
            })
            .then(res => {
                if (res.success) {
                    Swal.fire('สำเร็จ', 'บันทึกข้อมูลและรูปภาพเรียบร้อยแล้ว', 'success').then(() => {
                        document.getElementById('evalForm').reset();
                        editModeId = null;
                        document.querySelector('#evalForm button[type="submit"]').innerHTML = '<i class="fas fa-save mr-2"></i> บันทึกข้อมูลและสร้างรายงาน';
                        signTeacher.clear(); signObserver.clear();

                        for (let i = 1; i <= 4; i++) {
                            document.getElementById('previewContainer' + i).classList.add('hidden');
                            document.getElementById('preview' + i).src = "";
                        }
                        renderEvalTable(); calcScore();
                        switchView('report');
                    });
                } else {
                    Swal.fire('ข้อผิดพลาด', res.message, 'error');
                }
            })
            .catch(err => Swal.fire('ข้อผิดพลาดจากเซิร์ฟเวอร์', err.message, 'error'));
        }

        const toBase64 = file => new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });

        // ================= Report System =================
        let reportsPaginator = null;
        function loadReportData() {
            const tbody = document.getElementById('report-table-body');
            tbody.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-blue-500"><i class="fas fa-spinner fa-spin fa-2x"></i><br>กำลังโหลดข้อมูล...</td></tr>';

            const filterYear = document.getElementById('filterYear') ? document.getElementById('filterYear').value : '';
            const filterTerm = document.getElementById('filterTerm') ? document.getElementById('filterTerm').value : '';

            fetch(`../api/api.php?action=getReportData&year=${filterYear}&term=${filterTerm}`)
                .then(response => {
                    if (!response.ok) throw new Error('ไม่สามารถเชื่อมต่อดึงข้อมูลจากเซิร์ฟเวอร์ได้');
                    return response.json();
                })
                .then(dataArray => {
                    let actualData = dataArray;
                    if (dataArray && dataArray.data !== undefined) {
                        actualData = dataArray.data;
                    }
                    if (dataArray && dataArray.success === false) {
                        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-red-500"><i class="fas fa-exclamation-triangle fa-2x mb-3"></i><br>ข้อผิดพลาด: ${dataArray.message || 'ข้อมูลผิดปกติ'}</td></tr>`;
                        return;
                    }
                    if (!actualData || !Array.isArray(actualData)) {
                        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-red-500"><i class="fas fa-exclamation-triangle fa-2x mb-3"></i><br>ข้อมูลผิดปกติ</td></tr>';
                        return;
                    }
                    
                    if (!reportsPaginator) {
                        reportsPaginator = new TablePaginator({
                            tableBodyId: 'report-table-body',
                            paginationContainerId: 'reports-pagination',
                            pageSize: 10,
                            renderRow: (row) => {
                                let lvlColor = "text-gray-600 bg-gray-100";
                                if (row.level === 'ดีมาก') lvlColor = "text-green-700 bg-green-100";
                                else if (row.level === 'ดี') lvlColor = "text-blue-700 bg-blue-100";
                                else if (row.level === 'ไม่ผ่าน') lvlColor = "text-red-700 bg-red-100";
                                else if (row.level === 'พอใช้') lvlColor = "text-yellow-700 bg-yellow-100";
                                else if (row.level === 'ควรปรับปรุง') lvlColor = "text-orange-700 bg-orange-100";
                                
                                let docBtns = `<a href="preview_report.php?id=${row.id}" target="_blank" class="inline-flex items-center bg-red-600 text-white px-3 py-1.5 rounded text-sm hover:bg-red-700 transition shadow-sm" title="ดูรายงาน/พิมพ์ PDF"><i class="fas fa-print mr-1"></i> ดูรายงาน / พิมพ์ PDF</a>`;
                                
                                if (window.userRole === 'admin' || window.userRole === 'observer') {
                                    docBtns += ` <button onclick="editReport('${row.id}')" class="inline-flex items-center bg-yellow-500 text-white px-3 py-1.5 rounded text-sm hover:bg-yellow-600 transition shadow-sm ml-2" title="แก้ไข"><i class="fas fa-edit mr-1"></i> แก้ไข</button>`;
                                }
                                
                                return `
                                <tr class="hover:bg-blue-50 transition search-row">
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">${formatDateThai(row.date)}</td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-800 search-target">${row.teacher || '-'}</td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600 search-target">${row.subject || '-'}</td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-center font-bold text-school">${row.percent || '0'}%</td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-center"><span class="px-3 py-1 rounded-full text-xs font-bold ${lvlColor}">${row.level || '-'}</span></td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-center">${docBtns}</td>
                                </tr>
                                `;
                            },
                            filter: (items) => {
                                const input = document.getElementById('searchReports') ? document.getElementById('searchReports').value.toLowerCase() : '';
                                return items.filter(row => 
                                    (row.teacher && row.teacher.toLowerCase().includes(input)) ||
                                    (row.subject && row.subject.toLowerCase().includes(input)) ||
                                    (row.level && row.level.toLowerCase().includes(input))
                                );
                            }
                        });
                    }
                    
                    reportsPaginator.setData(actualData);
                })
                .catch(error => {
                    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-red-500">ดึงข้อมูลล้มเหลว: ${error.message}</td></tr>`;
                });
        }

        function filterReports() {
            if (reportsPaginator) {
                reportsPaginator.applyFilter();
            }
        }

        function filterTable() {
            const input = document.getElementById('searchTable').value.toLowerCase();
            const rows = document.querySelectorAll('.search-row');
            rows.forEach(row => {
                row.style.display = row.innerText.toLowerCase().includes(input) ? '' : 'none';
            });
        }

        // ฟังก์ชันการออกรายงานผ่าน Google Docs เดิม ไม่ใช้แล้วในระบบ PHP/MySQL
        // เปลี่ยนมาดาวน์โหลด PDF โดยตรงจากหน้าเว็บ
        function downloadPdfDirectly(id) {
            window.open('api/generate_pdf.php?id=' + id, '_blank');
        }

        function handleCsvUpload(event) {
            const file = event.target.files[0];
            if (!file) return;
            
            const ext = file.name.split('.').pop().toLowerCase();
            if (ext !== 'csv') {
                Swal.fire('ข้อผิดพลาด', 'กรุณาอัปโหลดไฟล์นามสกุล .csv เท่านั้น', 'error');
                event.target.value = '';
                return;
            }
            
            const formData = new FormData();
            formData.append('csv_file', file);
            
            Swal.fire({
                title: 'กำลังนำเข้าข้อมูล...',
                text: 'กรุณารอสักครู่ ระบบกำลังประมวลผลไฟล์ CSV',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });
            
            fetch('../api/import_users.php', {
                method: 'POST',
                body: formData
            })
            .then(res => res.json())
            .then(res => {
                event.target.value = '';
                
                let detailsHtml = '';
                if (res.details && res.details.length > 0) {
                    detailsHtml = `
                        <div class="text-left mt-4 max-h-60 overflow-y-auto text-xs border border-gray-200 rounded p-2 bg-gray-50 font-sans">
                            <table class="w-full text-left border-collapse">
                                <thead>
                                    <tr class="border-b border-gray-300">
                                        <th class="py-1 font-bold w-12 text-center">แถว</th>
                                        <th class="py-1 font-bold">Username</th>
                                        <th class="py-1 font-bold">สถานะ</th>
                                        <th class="py-1 font-bold">รายละเอียด</th>
                                    </tr>
                                </thead>
                                <tbody>
                    `;
                    res.details.forEach(item => {
                        let badge = '';
                        if (item.status === 'success') {
                            badge = '<span class="text-green-600 font-bold"><i class="fas fa-check-circle mr-1"></i>สำเร็จ</span>';
                        } else if (item.status === 'skip') {
                            badge = '<span class="text-yellow-600 font-bold"><i class="fas fa-exclamation-triangle mr-1"></i>ข้าม</span>';
                        } else {
                            badge = '<span class="text-red-600 font-bold"><i class="fas fa-times-circle mr-1"></i>ล้มเหลว</span>';
                        }
                        detailsHtml += `
                            <tr class="border-b border-gray-100 hover:bg-gray-100 transition">
                                <td class="py-1 text-gray-500 text-center">${item.row}</td>
                                <td class="py-1 font-semibold text-gray-800">${item.username}</td>
                                <td class="py-1">${badge}</td>
                                <td class="py-1 text-gray-500">${item.reason}</td>
                            </tr>
                        `;
                    });
                    detailsHtml += `
                                </tbody>
                            </table>
                        </div>
                    `;
                }

                if (res.success) {
                    Swal.fire({
                        title: 'นำเข้าข้อมูลเรียบร้อย',
                        html: `<p class="text-sm font-medium text-gray-700">${res.message}</p>${detailsHtml}`,
                        icon: 'success',
                        confirmButtonText: 'ตกลง',
                        customClass: {
                            popup: 'swal2-large-popup'
                        }
                    }).then(() => {
                        loadUsers();
                    });
                } else {
                    Swal.fire({
                        title: 'ไม่สามารถนำเข้าข้อมูลได้',
                        html: `<p class="text-sm font-medium text-red-600">${res.message}</p>${detailsHtml}`,
                        icon: 'warning',
                        confirmButtonText: 'ตกลง'
                    });
                }
            })
            .catch(err => {
                event.target.value = '';
                Swal.fire('ข้อผิดพลาด', 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์: ' + err.message, 'error');
            });
        }

        let usersPaginator = null;
        function loadUsers() {
            const tbody = document.getElementById('users-table-body');
            tbody.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-blue-500"><i class="fas fa-spinner fa-spin fa-2x mb-3"></i><br>กำลังโหลดข้อมูล...</td></tr>';
            
            // รีเซ็ต master checkbox และ bulk action panel ทุกครั้งที่โหลดใหม่
            const selectAll = document.getElementById('selectAllUsers');
            if (selectAll) selectAll.checked = false;
            const bulkPanel = document.getElementById('bulkActionPanel');
            if (bulkPanel) bulkPanel.classList.add('hidden');

            fetch('../api/user.php?action=list')
                .then(response => response.json())
                .then(res => {
                    if (!res.success) throw new Error(res.message);
                    
                    if (!usersPaginator) {
                        usersPaginator = new TablePaginator({
                            tableBodyId: 'users-table-body',
                            paginationContainerId: 'users-pagination',
                            pageSize: 10,
                            renderRow: (user) => {
                                let roleColor = 'bg-gray-200 text-gray-800';
                                if(user.role === 'admin') roleColor = 'bg-red-100 text-red-800';
                                if(user.role === 'observer') roleColor = 'bg-blue-100 text-blue-800';
                                if(user.role === 'teacher') roleColor = 'bg-green-100 text-green-800';

                                return `
                                    <tr class="hover:bg-blue-50 transition search-row">
                                        <td class="px-4 py-4 text-center whitespace-nowrap text-sm">
                                            <input type="checkbox" value="${user.id}" onchange="onUserSelectChange()" class="user-checkbox rounded text-school focus:ring-school cursor-pointer">
                                        </td>
                                        <td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-800">${user.username}</td>
                                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">${user.display_name || '-'}</td>
                                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">${user.email || '-'}</td>
                                        <td class="px-6 py-4 text-center whitespace-nowrap text-sm"><span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${roleColor}">${user.role}</span></td>
                                        <td class="px-6 py-4 text-center whitespace-nowrap text-sm font-medium">
                                            <button onclick="editUser('${user.id}', '${user.username}', '${user.display_name}', '${user.email}', '${user.role}', '${user.template_id || ''}')" class="text-indigo-600 hover:text-indigo-900 mr-3"><i class="fas fa-edit"></i></button>
                                            <button onclick="deleteUser('${user.id}')" class="text-red-600 hover:text-red-900"><i class="fas fa-trash"></i></button>
                                        </td>
                                    </tr>
                                `;
                            },
                            filter: (items) => {
                                const input = document.getElementById('searchUsers') ? document.getElementById('searchUsers').value.toLowerCase() : '';
                                return items.filter(user => 
                                    user.username.toLowerCase().includes(input) ||
                                    (user.display_name && user.display_name.toLowerCase().includes(input)) ||
                                    (user.email && user.email.toLowerCase().includes(input)) ||
                                    user.role.toLowerCase().includes(input)
                                );
                            }
                        });
                    }
                    
                    usersPaginator.setData(res.data);
                })
                .catch(err => {
                    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-red-500"><i class="fas fa-exclamation-triangle fa-2x mb-3"></i><br><b>ผิดพลาด:</b> ${err.message}</td></tr>`;
                });
        }

        function filterUsers() {
            if (usersPaginator) {
                usersPaginator.applyFilter();
            }
        }

        function toggleTemplateDropdown() {
            const role = document.getElementById('userRole').value;
            const container = document.getElementById('templateContainer');
            if (container) {
                if (role === 'teacher') {
                    container.style.display = 'block';
                } else {
                    container.style.display = 'none';
                    document.getElementById('userTemplate').value = '';
                }
            }
        }

        function loadTemplatesList() {
            fetch('../api/templates.php?action=list')
                .then(res => res.json())
                .then(res => {
                    if (res.success) {
                        globalTemplates = res.templates;
                        const select = document.getElementById('userTemplate');
                        if (select) {
                            select.innerHTML = '<option value="">-- ค่าเริ่มต้น --</option>';
                            globalTemplates.forEach(t => {
                                select.innerHTML += `<option value="${t.id}">${t.name}</option>`;
                            });
                        }
                        
                        // อัปเดตรายชื่อเทมเพลตใน Bulk Action Dropdown
                        const bulkSelect = document.getElementById('bulkTemplateSelect');
                        if (bulkSelect) {
                            bulkSelect.innerHTML = '<option value="">-- ลบเทมเพลต/ค่าเริ่มต้น --</option>';
                            globalTemplates.forEach(t => {
                                bulkSelect.innerHTML += `<option value="${t.id}">${t.name}</option>`;
                            });
                        }
                    }
                })
                .catch(err => console.error("โหลดรูปแบบแบบประเมินล้มเหลว:", err));
        }

        // ==========================================
        // Bulk Template Assignment JavaScript Actions
        // ==========================================
        function toggleSelectAllUsers(master) {
            const checkboxes = document.querySelectorAll('.user-checkbox');
            checkboxes.forEach(cb => {
                cb.checked = master.checked;
            });
            onUserSelectChange();
        }

        function onUserSelectChange() {
            const checkboxes = document.querySelectorAll('.user-checkbox:checked');
            const count = checkboxes.length;
            
            const panel = document.getElementById('bulkActionPanel');
            const countLabel = document.getElementById('selectedCount');
            const masterCheckbox = document.getElementById('selectAllUsers');
            const allCheckboxes = document.querySelectorAll('.user-checkbox');
            
            if (count > 0) {
                panel.classList.remove('hidden');
                countLabel.innerText = count;
            } else {
                panel.classList.add('hidden');
            }
            
            if (masterCheckbox && allCheckboxes.length > 0) {
                masterCheckbox.checked = (count === allCheckboxes.length);
            }
        }

        function applyBulkTemplate() {
            const checkedBoxes = document.querySelectorAll('.user-checkbox:checked');
            const userIds = Array.from(checkedBoxes).map(cb => cb.value);
            const templateId = document.getElementById('bulkTemplateSelect').value;
            
            if (userIds.length === 0) {
                Swal.fire('ข้อผิดพลาด', 'กรุณาเลือกผู้ใช้อย่างน้อย 1 คน', 'warning');
                return;
            }
            
            Swal.fire({
                title: 'ยืนยันการตั้งค่า?',
                text: `คุณต้องการกำหนดเทมเพลตนี้ให้ครูที่เลือกจำนวน ${userIds.length} คน ใช่หรือไม่?`,
                icon: 'question',
                showCancelButton: true,
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#d33',
                confirmButtonText: 'ใช่, ดำเนินการ',
                cancelButtonText: 'ยกเลิก'
            }).then((result) => {
                if (result.isConfirmed) {
                    Swal.fire({ title: 'กำลังดำเนินการ...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
                    
                    fetch('../api/user.php?action=bulk_assign_templates', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ user_ids: userIds, template_id: templateId })
                    })
                    .then(res => res.json())
                    .then(res => {
                        if (res.success) {
                            Swal.fire('สำเร็จ', res.message, 'success').then(() => {
                                loadUsers();
                            });
                        } else {
                            Swal.fire('ข้อผิดพลาด', res.message, 'error');
                        }
                    })
                    .catch(err => Swal.fire('ข้อผิดพลาด', err.message, 'error'));
                }
            });
        }

        function showUserModal() {
            document.getElementById('userForm').reset();
            document.getElementById('userId').value = '';
            document.getElementById('userRole').value = 'teacher';
            const ut = document.getElementById('userTemplate');
            if(ut) ut.value = '';
            toggleTemplateDropdown();
            document.getElementById('userModalTitle').innerText = 'เพิ่มผู้ใช้งาน';
            document.getElementById('userModal').classList.remove('hidden');
        }

        function editUser(id, username, displayName, email, role, templateId) {
            document.getElementById('userId').value = id;
            document.getElementById('userUsername').value = username;
            document.getElementById('userDisplayName').value = displayName;
            document.getElementById('userEmail').value = email;
            document.getElementById('userRole').value = role;
            const ut = document.getElementById('userTemplate');
            if(ut) ut.value = templateId || '';
            document.getElementById('userPassword').value = ''; // ว่างไว้ = ไม่เปลี่ยน
            toggleTemplateDropdown();
            document.getElementById('userModalTitle').innerText = 'แก้ไขผู้ใช้งาน';
            document.getElementById('userModal').classList.remove('hidden');
        }

        function hideUserModal() {
            document.getElementById('userModal').classList.add('hidden');
        }

        function saveUser(event) {
            event.preventDefault();
            const id = document.getElementById('userId').value;
            const data = {
                id: id,
                username: document.getElementById('userUsername').value,
                display_name: document.getElementById('userDisplayName').value,
                email: document.getElementById('userEmail').value,
                role: document.getElementById('userRole').value,
                template_id: document.getElementById('userTemplate') ? document.getElementById('userTemplate').value : '',
                password: document.getElementById('userPassword').value
            };

            const action = id ? 'update' : 'create';

            Swal.fire({ title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            fetch('../api/user.php?action=' + action, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            })
            .then(res => res.json())
            .then(res => {
                if (res.success) {
                    Swal.fire('สำเร็จ', res.message, 'success');
                    hideUserModal();
                    loadUsers();
                } else {
                    Swal.fire('ข้อผิดพลาด', res.message, 'error');
                }
            })
            .catch(err => Swal.fire('ข้อผิดพลาด', err.message, 'error'));
        }

        function deleteUser(id) {
            Swal.fire({
                title: 'ยืนยันการลบ?',
                text: "คุณไม่สามารถกู้คืนข้อมูลผู้ใช้ที่ลบได้!",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                cancelButtonColor: '#3085d6',
                confirmButtonText: 'ใช่, ลบเลย!',
                cancelButtonText: 'ยกเลิก'
            }).then((result) => {
                if (result.isConfirmed) {
                    Swal.fire({ title: 'กำลังลบ...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
                    fetch('../api/user.php?action=delete', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id: id })
                    })
                    .then(res => res.json())
                    .then(res => {
                        if (res.success) {
                            Swal.fire('ลบแล้ว!', res.message, 'success');
                            loadUsers();
                        } else {
                            Swal.fire('ข้อผิดพลาด', res.message, 'error');
                        }
                    })
                    .catch(err => Swal.fire('ข้อผิดพลาด', err.message, 'error'));
                }
            });
        }

        function showChangePasswordModal() {
            document.getElementById('changePasswordForm').reset();
            document.getElementById('changePasswordModal').classList.remove('hidden');
        }

        function hideChangePasswordModal() {
            document.getElementById('changePasswordModal').classList.add('hidden');
        }

        function changePassword(event) {
            event.preventDefault();
            const oldPass = document.getElementById('oldPassword').value;
            const newPass = document.getElementById('newPassword').value;
            const confirmPass = document.getElementById('confirmPassword').value;

            if (newPass !== confirmPass) {
                Swal.fire('ข้อผิดพลาด', 'รหัสผ่านใหม่ไม่ตรงกัน', 'error');
                return;
            }

            Swal.fire({ title: 'กำลังเปลี่ยนรหัสผ่าน...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            fetch('../api/user.php?action=change_password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ old_password: oldPass, new_password: newPass })
            })
            .then(res => res.json())
            .then(res => {
                if (res.success) {
                    Swal.fire('สำเร็จ', res.message, 'success');
                    hideChangePasswordModal();
                } else {
                    Swal.fire('ข้อผิดพลาด', res.message, 'error');
                }
            })
            .catch(err => Swal.fire('ข้อผิดพลาด', err.message, 'error'));
        }

        function switchSettingsTab(tabName) {
            const tabs = ['general', 'evaluation', 'terms'];
            
            tabs.forEach(tab => {
                const content = document.getElementById('tab-content-' + tab);
                const btn = document.getElementById('tab-btn-' + tab);
                if (content && btn) {
                    if (tab === tabName) {
                        content.classList.remove('hidden');
                        btn.classList.add('text-school', 'border-b-2', 'border-school');
                        btn.classList.remove('text-gray-500');
                    } else {
                        content.classList.add('hidden');
                        btn.classList.remove('text-school', 'border-b-2', 'border-school');
                        btn.classList.add('text-gray-500');
                    }
                }
            });
            
            if (tabName === 'evaluation') {
                loadSettingsTemplatesList();
                renderCriteriaEditor();
            } else if (tabName === 'terms') {
                loadSettingsTerms();
            }
        }

        function saveGeneralSettings() {
            const form = document.getElementById('generalSettingsForm');
            if(!form) return;
            const formData = new FormData(form);

            Swal.fire({ title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

            fetch('../api/settings.php?action=save_general', {
                method: 'POST',
                body: formData
            })
            .then(res => res.json())
            .then(res => {
                if (res.success) {
                    Swal.fire('สำเร็จ', res.message, 'success').then(() => {
                        window.location.reload();
                    });
                } else {
                    Swal.fire('ข้อผิดพลาด', res.message, 'error');
                }
            })
            .catch(err => {
                Swal.fire('ข้อผิดพลาด', err.message, 'error');
            });
        }
        // ================= Template Management =================
        function loadSettingsTemplatesList() {
            const tbody = document.getElementById('templates-table-body');
            if (!tbody) return;
            tbody.innerHTML = '<tr><td colspan="2" class="text-center py-4 text-blue-500"><i class="fas fa-spinner fa-spin"></i></td></tr>';
            
            fetch('../api/templates.php?action=list')
                .then(res => res.json())
                .then(res => {
                    if (res.success) {
                        tbody.innerHTML = '';
                        if (res.templates.length === 0) {
                            tbody.innerHTML = '<tr><td colspan="2" class="text-center py-4 text-gray-500">ไม่มีรูปแบบประเมิน</td></tr>';
                            return;
                        }
                        res.templates.forEach(t => {
                            tbody.insertAdjacentHTML('beforeend', `
                                <tr class="hover:bg-blue-50 transition">
                                    <td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-800">${t.name}</td>
                                    <td class="px-6 py-4 text-center whitespace-nowrap text-sm font-medium">
                                        <button onclick="editTemplate('${t.id}', '${t.name}')" class="text-indigo-600 hover:text-indigo-900 mr-3"><i class="fas fa-edit"></i></button>
                                        <button onclick="deleteTemplate('${t.id}')" class="text-red-600 hover:text-red-900"><i class="fas fa-trash"></i></button>
                                    </td>
                                </tr>
                            `);
                        });
                    }
                })
                .catch(err => console.error(err));
        }

        function editGlobalTemplate() {
            document.getElementById('template-list-view').classList.add('hidden');
            document.getElementById('template-editor-view').classList.remove('hidden');
            document.getElementById('editor-title').innerText = 'แก้ไขรูปแบบเริ่มต้น (Default Template)';
            document.getElementById('template_id_input').value = 'global';
            document.getElementById('template_name_input').value = 'รูปแบบเริ่มต้น';
            
            Swal.fire({ title: 'กำลังโหลด...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            
            fetch('../api/api.php?action=getConfig')
                .then(res => res.json())
                .then(res => {
                    configData = res;
                    if (!configData.items || configData.items.length === 0) {
                        configData.items = [
                            { id: generateId(), type: 'main', text: 'ด้านการเตรียมการสอน' },
                            { id: generateId(), type: 'sub', text: 'มีแผนการจัดการเรียนรู้ที่สอดคล้องกับตัวชี้วัด' }
                        ];
                    }
                    renderConfigEditor();
                    Swal.close();
                })
                .catch(err => Swal.fire('ข้อผิดพลาด', err.message, 'error'));
        }

        function createNewTemplate() {
            document.getElementById('template-list-view').classList.add('hidden');
            document.getElementById('template-editor-view').classList.remove('hidden');
            document.getElementById('editor-title').innerText = 'สร้างรูปแบบแบบประเมินใหม่';
            document.getElementById('template_id_input').value = '';
            document.getElementById('template_name_input').value = '';
            configData.items = [];
            renderConfigEditor();
        }

        function editTemplate(id, name) {
            document.getElementById('template-list-view').classList.add('hidden');
            document.getElementById('template-editor-view').classList.remove('hidden');
            document.getElementById('editor-title').innerText = 'แก้ไขรูปแบบ: ' + name;
            document.getElementById('template_id_input').value = id;
            document.getElementById('template_name_input').value = name;
            
            Swal.fire({ title: 'กำลังโหลด...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            
            fetch('../api/templates.php?action=get&id=' + id)
                .then(res => res.json())
                .then(res => {
                    if (res.success) {
                        try {
                            configData = JSON.parse(res.template.items_json);
                        } catch(e) {
                            configData = { items: [] };
                        }
                        renderConfigEditor();
                        Swal.close();
                    } else {
                        Swal.fire('ข้อผิดพลาด', res.message, 'error');
                    }
                });
        }

        function closeTemplateEditor() {
            document.getElementById('template-editor-view').classList.add('hidden');
            document.getElementById('template-list-view').classList.remove('hidden');
            loadSettingsTemplatesList();
        }

        function saveTemplateConfig() {
            const id = document.getElementById('template_id_input').value;
            const name = document.getElementById('template_name_input').value;
            
            if (id === 'global') {
                saveConfigOriginal();
                return;
            }
            
            if (!name) {
                Swal.fire('ข้อผิดพลาด', 'กรุณาระบุชื่อรูปแบบประเมิน', 'error');
                return;
            }

            Swal.fire({ title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            
            fetch('../api/templates.php?action=save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: id,
                    name: name,
                    items_json: JSON.stringify(configData)
                })
            })
            .then(res => res.json())
            .then(res => {
                if (res.success) {
                    Swal.fire('สำเร็จ', res.message, 'success').then(() => {
                        closeTemplateEditor();
                    });
                } else {
                    Swal.fire('ข้อผิดพลาด', res.message, 'error');
                }
            })
            .catch(err => Swal.fire('ข้อผิดพลาด', err.message, 'error'));
        }

        function deleteTemplate(id) {
            Swal.fire({
                title: 'ยืนยันการลบ?',
                text: "คุณไม่สามารถกู้คืนรูปแบบที่ลบได้!",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                cancelButtonColor: '#3085d6',
                confirmButtonText: 'ใช่, ลบเลย!',
                cancelButtonText: 'ยกเลิก'
            }).then((result) => {
                if (result.isConfirmed) {
                    Swal.fire({ title: 'กำลังลบ...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
                    fetch('../api/templates.php?action=delete', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id: id })
                    })
                    .then(res => res.json())
                    .then(res => {
                        if (res.success) {
                            Swal.fire('ลบแล้ว!', res.message, 'success');
                            loadSettingsTemplatesList();
                        } else {
                            Swal.fire('ข้อผิดพลาด', res.message, 'error');
                        }
                    })
                    .catch(err => Swal.fire('ข้อผิดพลาด', err.message, 'error'));
                }
            });
        }

        // Override original saveConfig (no longer used, replaced by saveTemplateConfig)
        function saveConfig() {
            saveTemplateConfig();
        }

        // Form Teacher Dropdown Logic
        let formTeachersList = [];
        
        function loadFormTeachers() {
            const select = document.getElementById('f_teacher');
            if (!select) return;
            fetch('../api/user.php?action=list')
                .then(res => res.json())
                .then(res => {
                    if (res.success) {
                        formTeachersList = res.data.filter(u => u.role === 'teacher');
                        select.innerHTML = '<option value="">-- กรุณาเลือกครู --</option>';
                        formTeachersList.forEach(t => {
                            select.innerHTML += `<option value="${t.id}">${t.display_name || t.username}</option>`;
                        });
                    }
                });
        }

        function teacherSelected(teacherId) {
            if (!teacherId) return;
            const teacher = formTeachersList.find(t => t.id == teacherId);
            if (teacher) {
                // Set text input value for f_teacher to be used in form submit (wait, we changed it to select, so f_teacher value is ID now!)
                // Let's keep it ID for submit, or find display name. We'll handle this in submitForm.
                if (teacher.template_id) {
                    loadConfigByTemplateId(teacher.template_id);
                } else {
                    loadConfig(); // Default
                }
            }
        }

        function loadConfigByTemplateId(templateId) {
            fetch('../api/templates.php?action=get&id=' + templateId)
                .then(res => res.json())
                .then(res => {
                    if (res.success) {
                        try {
                            configData = JSON.parse(res.template.items_json);
                        } catch(e) {
                            configData = { items: [] };
                        }
                        renderEvalTable();
                    }
                });
        }

        // ================= Edit System =================
        let editModeId = null;

        function editReport(id) {
            Swal.fire({
                title: 'กำลังดึงข้อมูล...',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });

            fetch(`../api/api.php?action=getReportById&id=${id}`)
                .then(res => res.json())
                .then(res => {
                    Swal.close();
                    if(res.success) {
                        const data = res.data;
                        editModeId = id;
                        
                        // Switch to form view
                        switchView('form');
                        
                        // Populate basic info
                        document.getElementById('f_occurrence').value = data.occurrence;
                        document.getElementById('f_term').value = data.term;
                        document.getElementById('f_year').value = data.year;
                        
                        if (data.teacher_id) {
                            document.getElementById('f_teacher').value = data.teacher_id;
                        } else {
                            const sel = document.getElementById('f_teacher');
                            for (let i = 0; i < sel.options.length; i++) {
                                if (sel.options[i].text === data.teacher) {
                                    sel.selectedIndex = i;
                                    break;
                                }
                            }
                        }
                        
                        document.getElementById('f_department').value = data.department;
                        document.getElementById('f_subject').value = data.subject;
                        document.getElementById('f_class').value = data.class;
                        document.getElementById('f_date').value = data.date;
                        document.getElementById('f_time').value = data.time;
                        document.getElementById('f_observer').value = data.observer;
                        document.getElementById('f_teacher_pos').value = data.teacher_position;
                        document.getElementById('f_observer_pos').value = data.observer_position;
                        
                        document.getElementById('f_strengths').value = data.strengths;
                        document.getElementById('f_improvements').value = data.improvements;
                        document.getElementById('f_suggestions').value = data.suggestions;

                        // Load correct template and check scores
                        const teacherObj = formTeachersList.find(t => t.id == data.teacher_id);
                        const templateId = teacherObj ? teacherObj.template_id : null;
                        
                        let configPromise;
                        if (templateId) {
                            configPromise = fetch('../api/templates.php?action=get&id=' + templateId).then(r => r.json());
                        } else {
                            configPromise = fetch('../api/api.php?action=getConfig').then(r => r.json());
                        }
                        
                        configPromise.then(cRes => {
                            if (templateId) {
                                if (cRes.success) {
                                    try { configData = JSON.parse(cRes.template.items_json); } 
                                    catch(e) { configData = { items: [] }; }
                                }
                            } else {
                                if (cRes.success && cRes.data) configData = cRes.data;
                                else configData = { items: [] };
                            }
                            renderEvalTable();
                            
                            const scores = JSON.parse(data.scores_json || '{}');
                            for (const [key, value] of Object.entries(scores)) {
                                const radio = document.querySelector(`input[name="${key}"][value="${value}"]`);
                                if (radio) radio.checked = true;
                            }
                            
                            calcScore(); // update displays
                        });

                        // Change form button text and behavior
                        document.querySelector('#evalForm button[type="submit"]').innerHTML = '<i class="fas fa-save mr-2"></i> บันทึกการแก้ไข';
                    } else {
                        Swal.fire('ข้อผิดพลาด', res.message, 'error');
                    }
                })
                .catch(err => {
                    Swal.close();
                    Swal.fire('ข้อผิดพลาด', err.message, 'error');
                });
        }
