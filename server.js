const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const pool = require('./db');

const app = express();
const PORT = 3000;
const SECRET = 'library_secret_key_2024';
app.use(express.static(__dirname)); // 托管当前目录下的所有静态文件
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// ========== 索书号生成 ==========
const FLOOR_MAP = {
    A: { floor: 1, shelf: '01' }, B: { floor: 2, shelf: '01' }, C: { floor: 3, shelf: '01' },
    D: { floor: 4, shelf: '01' }, F: { floor: 1, shelf: '02' }, G: { floor: 1, shelf: '03' },
    H: { floor: 1, shelf: '04' }, I: { floor: 2, shelf: '02' }, J: { floor: 2, shelf: '03' },
    K: { floor: 2, shelf: '04' }, O: { floor: 3, shelf: '02' }, P: { floor: 3, shelf: '03' },
    Q: { floor: 3, shelf: '04' }, R: { floor: 4, shelf: '02' }, S: { floor: 4, shelf: '03' },
    T: { floor: 1, shelf: '05' }, U: { floor: 2, shelf: '05' }, V: { floor: 2, shelf: '06' },
    X: { floor: 3, shelf: '05' }, Z: { floor: 4, shelf: '04' }
};

function getLocation(cateCode) {
    const firstChar = cateCode[0].toUpperCase();
    return FLOOR_MAP[firstChar] || { floor: 1, shelf: '99' };
}

async function generateBookCode(cateCode) {
    const { floor, shelf } = getLocation(cateCode);
    const prefix = `${cateCode}-${floor}${shelf}`;
    const [rows] = await pool.query('SELECT current_index FROM serial_index WHERE cate_code = ?', [prefix]);
    let idx = 0;
    if (rows.length === 0) {
        await pool.query('INSERT INTO serial_index (cate_code, current_index) VALUES (?, 1)', [prefix]);
        idx = 1;
    } else {
        idx = rows[0].current_index + 1;
        await pool.query('UPDATE serial_index SET current_index = ? WHERE cate_code = ?', [idx, prefix]);
    }
    return `${prefix}/${String(idx).padStart(3, '0')}`;
}

// ========== 中间件 ==========
function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: '未登录' });
    try {
        req.user = jwt.verify(authHeader.split(' ')[1], SECRET);
        next();
    } catch (err) {
        return res.status(403).json({ error: '令牌无效' });
    }
}

function isAdmin(req, res, next) {
    if (req.user.role !== 'admin') return res.status(403).json({ error: '无权限' });
    next();
}

async function isUserAbnormal(userNo) {
    const [rows] = await pool.query(
        `SELECT 1 FROM borrow_records 
         WHERE user_no = ? 
         AND ((state = 1 AND deadline < CURDATE()) 
              OR (fine > 0 AND fine_paid = 0))
         LIMIT 1`,
        [userNo]
    );
    return rows.length > 0;
}

function calcOverdue(record) {
    if (record.state === 0) return { overdueDays: 0, fine: 0 };
    const today = new Date();
    const deadline = new Date(record.deadline);
    if (today <= deadline) return { overdueDays: 0, fine: 0 };
    const diff = Math.ceil((today - deadline) / 86400000);
    return { overdueDays: diff, fine: parseFloat((diff * 0.1).toFixed(2)) };
}

// ==================== 登录 ====================
app.post('/api/login', async (req, res) => {
    const { role, username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: '账号密码不能为空' });

    if (role === 'admin' && username === 'admin' && password === '123456') {
        return res.json({
            token: jwt.sign({ role: 'admin', name: '超级管理员', no: 'ADMIN001' }, SECRET, { expiresIn: '24h' }),
            user: { role: 'admin', name: '超级管理员', no: 'ADMIN001' }
        });
    }

    if (role === 'student') {
        const [students] = await pool.query('SELECT * FROM students WHERE no = ?', [username]);
        if (!students.length) return res.status(400).json({ error: '学号不存在' });
        const stu = students[0];
        if (stu.id_card.slice(-6) !== password) return res.status(400).json({ error: '密码错误' });
        return res.json({
            token: jwt.sign({ role: 'student', name: stu.name, no: stu.no }, SECRET, { expiresIn: '24h' }),
            user: { role: 'student', name: stu.name, no: stu.no }
        });
    }

    if (role === 'teacher') {
        const [teachers] = await pool.query('SELECT * FROM teachers WHERE no = ?', [username]);
        if (!teachers.length) return res.status(400).json({ error: '工号不存在' });
        const tea = teachers[0];
        if (tea.id_card.slice(-6) !== password) return res.status(400).json({ error: '密码错误' });
        return res.json({
            token: jwt.sign({ role: 'teacher', name: tea.name, no: tea.no }, SECRET, { expiresIn: '24h' }),
            user: { role: 'teacher', name: tea.name, no: tea.no }
        });
    }

    return res.status(400).json({ error: '未知角色' });
});

// ==================== 图书管理 ====================
app.get('/api/books/search', authenticate, async (req, res) => {
    const { keyword } = req.query;
    if (!keyword || !keyword.trim()) return res.json([]);
    const like = `%${keyword.trim()}%`;
    const [rows] = await pool.query(
        `SELECT book_code, name, author, cate_code FROM books WHERE state = 0 AND (name LIKE ? OR author LIKE ?) LIMIT 10`,
        [like, like]
    );
    res.json(rows);
});

app.get('/api/books', authenticate, async (req, res) => {
    const [books] = await pool.query('SELECT * FROM books');
    res.json(books);
});

app.post('/api/books', authenticate, isAdmin, async (req, res) => {
    const { cateCode, name, author, publisher, isbn, price } = req.body;
    if (!cateCode || !name || !author) return res.status(400).json({ error: '信息不完整' });
    try {
        const bookCode = await generateBookCode(cateCode);
        await pool.query(
            `INSERT INTO books (book_code, cate_code, name, author, publisher, isbn, price, state) VALUES (?,?,?,?,?,?,?,0)`,
            [bookCode, cateCode, name, author, publisher || '', isbn, price || 0]
        );
        res.json({ success: true, bookCode });
    } catch (err) {
        res.status(500).json({ error: '入库失败: ' + err.message });
    }
});

app.post('/api/books/import', authenticate, isAdmin, async (req, res) => {
    const { csvText } = req.body;
    if (!csvText) return res.status(400).json({ error: 'CSV内容为空' });
    const rows = csvText.split('\n').filter(r => r.trim());
    let success = 0, errors = [];
    for (let i = 1; i < rows.length; i++) {
        const cols = rows[i].split(',').map(c => c.trim());
        if (cols.length < 6) { errors.push(`第${i+1}行字段不足`); continue; }
        const [cateCode, name, author, publisher, isbn, price] = cols;
        if (!cateCode || !name || !author) { errors.push(`第${i+1}行必填项为空`); continue; }
        try {
            const bookCode = await generateBookCode(cateCode);
            await pool.query(
                'INSERT INTO books (book_code, cate_code, name, author, publisher, isbn, price, state) VALUES (?,?,?,?,?,?,?,0)',
                [bookCode, cateCode, name, author, publisher || '', isbn, price || 0]
            );
            success++;
        } catch (err) { errors.push(`第${i+1}行: ${err.message}`); }
    }
    res.json({ count: success, errors });
});

app.delete('/api/books/:code', authenticate, isAdmin, async (req, res) => {
    const code = decodeURIComponent(req.params.code);
    const [book] = await pool.query('SELECT * FROM books WHERE book_code = ?', [code]);
    if (!book.length) return res.status(404).json({ error: '图书不存在' });
    if (book[0].state === 1) return res.status(400).json({ error: '已借出，无法删除' });
    await pool.query('DELETE FROM books WHERE book_code = ?', [code]);
    res.json({ success: true });
});

// ==================== 人员管理 ====================
app.get('/api/students', authenticate, async (req, res) => {
    const [students] = await pool.query(`
        SELECT s.*, 
               (EXISTS (
                   SELECT 1 FROM borrow_records br 
                   WHERE br.user_no = s.no 
                   AND ((br.state = 1 AND br.deadline < CURDATE()) 
                        OR (br.fine > 0 AND br.fine_paid = 0))
               )) AS is_abnormal
        FROM students s
    `);
    res.json(students);
});

app.get('/api/teachers', authenticate, async (req, res) => {
    const [teachers] = await pool.query(`
        SELECT t.*, 
               (EXISTS (
                   SELECT 1 FROM borrow_records br 
                   WHERE br.user_no = t.no 
                   AND ((br.state = 1 AND br.deadline < CURDATE()) 
                        OR (br.fine > 0 AND br.fine_paid = 0))
               )) AS is_abnormal
        FROM teachers t
    `);
    res.json(teachers);
});

app.post('/api/students/import', authenticate, isAdmin, async (req, res) => {
    const { csvText } = req.body;
    const rows = csvText.split('\n').filter(r => r.trim());
    let success = 0, errors = [];
    for (let i = 1; i < rows.length; i++) {
        const cols = rows[i].split(',').map(c => c.trim());
        if (cols.length < 8) { errors.push(`第${i+1}行字段不足`); continue; }
        const [name, gender, no, college, education, grade, major, idCard] = cols;
        if (!name || !no || !idCard) { errors.push(`第${i+1}行必填项为空`); continue; }
        if (idCard.length !== 18) { errors.push(`第${i+1}行身份证长度错误`); continue; }
        try {
            await pool.query(
                'INSERT INTO students (no, name, gender, college, education, grade, major, id_card) VALUES (?,?,?,?,?,?,?,?)',
                [no, name, gender, college, education, grade, major, idCard]
            );
            success++;
        } catch (e) { errors.push(`第${i+1}行: ${e.message}`); }
    }
    res.json({ success, errors });
});

app.post('/api/teachers/import', authenticate, isAdmin, async (req, res) => {
    const { csvText } = req.body;
    const rows = csvText.split('\n').filter(r => r.trim());
    let success = 0, errors = [];
    for (let i = 1; i < rows.length; i++) {
        const cols = rows[i].split(',').map(c => c.trim());
        if (cols.length < 5) { errors.push(`第${i+1}行字段不足`); continue; }
        const [name, gender, no, college, idCard] = cols;
        if (!name || !no || !idCard) { errors.push(`第${i+1}行必填项为空`); continue; }
        if (idCard.length !== 18) { errors.push(`第${i+1}行身份证长度错误`); continue; }
        try {
            await pool.query(
                'INSERT INTO teachers (no, name, gender, college, id_card) VALUES (?,?,?,?,?)',
                [no, name, gender, college, idCard]
            );
            success++;
        } catch (e) { errors.push(`第${i+1}行: ${e.message}`); }
    }
    res.json({ success, errors });
});

// ==================== 借还管理 ====================
app.get('/api/borrows', authenticate, async (req, res) => {
    let sql = 'SELECT * FROM borrow_records';
    const params = [];
    if (req.user.role !== 'admin') {
        sql += ' WHERE user_no = ?';
        params.push(req.user.no);
    }
    sql += ' ORDER BY id DESC';
    const [records] = await pool.query(sql, params);
    const enriched = records.map(r => {
        const { overdueDays, fine } = calcOverdue(r);
        return { ...r, currentOverdueDays: overdueDays, currentFine: fine };
    });
    res.json(enriched);
});

app.post('/api/borrows/borrow', authenticate, async (req, res) => {
    const { bookCode, userNo } = req.body;
    if (!bookCode || !userNo) return res.status(400).json({ error: '信息不完整' });
    if (req.user.role !== 'admin' && req.user.no !== userNo) {
        return res.status(403).json({ error: '只能用自己的账号借阅' });
    }

    let user = null;
    const [stu] = await pool.query('SELECT * FROM students WHERE no = ?', [userNo]);
    if (stu.length) user = { ...stu[0], role: 'student' };
    else {
        const [tea] = await pool.query('SELECT * FROM teachers WHERE no = ?', [userNo]);
        if (tea.length) user = { ...tea[0], role: 'teacher' };
    }
    if (!user) return res.status(400).json({ error: '用户不存在' });

    if (await isUserAbnormal(userNo)) {
        return res.status(400).json({ error: '您有超期未还或未缴纳罚款，无法借书' });
    }

    const [book] = await pool.query('SELECT * FROM books WHERE book_code = ?', [bookCode]);
    if (!book.length) return res.status(400).json({ error: '图书不存在' });
    if (book[0].state !== 0) return res.status(400).json({ error: '图书不可借' });

    const borrowTime = new Date();
    const deadline = new Date(borrowTime);
    deadline.setDate(deadline.getDate() + 30);

    await pool.query(
        `UPDATE books SET state = 1, borrow_user_no = ?, borrow_user_name = ? WHERE book_code = ?`,
        [userNo, user.name, bookCode]
    );
    await pool.query(
        `INSERT INTO borrow_records (book_code, book_name, user_no, user_name, user_role, borrow_time, deadline, state, renew_times)
         VALUES (?,?,?,?,?,?,?,1,0)`,
        [bookCode, book[0].name, userNo, user.name, user.role,
         borrowTime.toISOString().slice(0,10), deadline.toISOString().slice(0,10)]
    );
    res.json({ success: true });
});

app.post('/api/borrows/return', authenticate, async (req, res) => {
    const { bookCode, userNo } = req.body;
    if (!bookCode || !userNo) return res.status(400).json({ error: '信息不完整' });

    const [book] = await pool.query('SELECT * FROM books WHERE book_code = ?', [bookCode]);
    if (!book.length) return res.status(400).json({ error: '图书不存在' });
    if (book[0].state !== 1) return res.status(400).json({ error: '图书未借出' });
    if (book[0].borrow_user_no !== userNo) return res.status(400).json({ error: '借阅人不符' });
    if (req.user.role !== 'admin' && req.user.no !== userNo) {
        return res.status(403).json({ error: '只能归还自己的书' });
    }

    const [record] = await pool.query('SELECT * FROM borrow_records WHERE book_code = ? AND state = 1', [bookCode]);
    if (!record.length) return res.status(400).json({ error: '无对应借阅记录' });

    const returnTime = new Date().toISOString().slice(0,10);
    const { overdueDays, fine } = calcOverdue(record[0]);

    await pool.query('UPDATE books SET state = 0, borrow_user_no = NULL, borrow_user_name = NULL WHERE book_code = ?', [bookCode]);
    await pool.query(
        `UPDATE borrow_records SET return_time = ?, overdue_days = ?, fine = ?, fine_paid = ?, state = 0 WHERE id = ?`,
        [returnTime, overdueDays, fine, fine === 0, record[0].id]
    );
    res.json({ success: true, overdueDays, fine });
});

// ★★★ 续借接口 ★★★
app.post('/api/borrows/renew', authenticate, async (req, res) => {
    const { bookCode, userNo } = req.body;
    if (!bookCode || !userNo) return res.status(400).json({ error: '信息不完整' });

    if (req.user.role !== 'admin' && req.user.no !== userNo) {
        return res.status(403).json({ error: '只能续借自己的书' });
    }

    const [book] = await pool.query('SELECT * FROM books WHERE book_code = ? AND state = 1', [bookCode]);
    if (!book.length) return res.status(400).json({ error: '图书不在借阅状态' });
    if (book[0].borrow_user_no !== userNo) return res.status(400).json({ error: '该图书不是您借阅的' });

    const [record] = await pool.query(
        `SELECT * FROM borrow_records WHERE book_code = ? AND user_no = ? AND state = 1 ORDER BY id DESC LIMIT 1`,
        [bookCode, userNo]
    );
    if (!record.length) return res.status(400).json({ error: '未找到借阅记录' });

    const rec = record[0];
    if (new Date(rec.deadline) < new Date(new Date().toISOString().slice(0,10))) {
        return res.status(400).json({ error: '该图书已超期，请先归还再借' });
    }
    if (rec.renew_times >= 2) {
        return res.status(400).json({ error: '续借已达上限（最多2次）' });
    }

    // 新代码：在原截止日期上增加30天
    const newDeadline = new Date(rec.deadline);
    newDeadline.setDate(newDeadline.getDate() + 30);
    const newDeadlineStr = newDeadline.toISOString().slice(0,10);

    await pool.query(
        `UPDATE borrow_records SET deadline = ?, renew_times = renew_times + 1 WHERE id = ?`,
        [newDeadlineStr, rec.id]
    );
    res.json({ success: true, newDeadline: newDeadlineStr, renewTimes: rec.renew_times + 1 });
});

app.post('/api/borrows/payfine', authenticate, isAdmin, async (req, res) => {
    const { recordId } = req.body;
    await pool.query('UPDATE borrow_records SET fine_paid = 1 WHERE id = ?', [recordId]);
    res.json({ success: true });
});

// ==================== 异常处理 ====================
app.get('/api/exceptions', authenticate, async (req, res) => {
    const [rows] = await pool.query('SELECT * FROM exception_records ORDER BY id DESC');
    res.json(rows);
});

app.post('/api/exceptions/register', authenticate, isAdmin, async (req, res) => {
    const { bookCode, exType, exPrice, exDesc } = req.body;
    const [book] = await pool.query('SELECT * FROM books WHERE book_code = ?', [bookCode]);
    if (!book.length) return res.status(400).json({ error: '图书不存在' });
    let newState = exType === 'lost' ? 2 : exType === 'nature' ? 3 : 4;
    await pool.query('UPDATE books SET state = ?, remark = ? WHERE book_code = ?', [newState, exDesc, bookCode]);
    await pool.query(
        `INSERT INTO exception_records (book_code, type, price, description, handle_time, handle_user, state)
         VALUES (?,?,?,?,NOW(),?,?)`,
        [bookCode, exType === 'lost' ? '丢失' : exType === 'nature' ? '自然损坏' : '人为损坏', exPrice || 0, exDesc, req.user.name, '已处理']
    );
    res.json({ success: true });
});

app.post('/api/exceptions/cancel', authenticate, isAdmin, async (req, res) => {
    const { bookCode } = req.body;
    await pool.query('DELETE FROM books WHERE book_code = ?', [bookCode]);
    await pool.query(
        `INSERT INTO exception_records (book_code, type, price, description, handle_time, handle_user, state)
         VALUES (?,?,?,?,NOW(),?,?)`,
        [bookCode, '编码注销', 0, '异常图书编码注销', req.user.name, '已处理']
    );
    res.json({ success: true });
});

app.post('/api/exceptions/recreate', authenticate, isAdmin, async (req, res) => {
    const { bookCode } = req.body;
    const [book] = await pool.query('SELECT * FROM books WHERE book_code = ?', [bookCode]);
    if (!book.length) return res.status(400).json({ error: '图书不存在' });
    const newCode = await generateBookCode(book[0].cate_code);
    await pool.query('UPDATE books SET book_code = ?, state = 0, remark = ? WHERE book_code = ?', [newCode, '', bookCode]);
    await pool.query(
        `INSERT INTO exception_records (book_code, type, price, description, handle_time, handle_user, state)
         VALUES (?,?,?,?,NOW(),?,?)`,
        [`${bookCode} → ${newCode}`, '重新入库', 0, '异常图书重新生成编码入库', req.user.name, '已处理']
    );
    res.json({ success: true, newCode });
});

app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
});