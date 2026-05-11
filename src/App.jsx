import { useEffect, useState, useRef } from 'react';
import { supabase } from './supabaseClient';
import * as XLSX from 'xlsx';
import Login from './Login';
import StudentSchedule, { getStudentsScheduledToday } from './StudentSchedule';
import InvoiceModal from './InvoiceModal';

const parseMoneyValue = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value !== 'string') return 0;
  const digitsOnly = value.replace(/[^\d-]/g, '');
  const parsed = Number(digitsOnly);
  return Number.isFinite(parsed) ? parsed : 0;
};

// ⭐ TỔNG TIỀN THÁNG (CÓ TÍNH TIỀN PHÁT SINH)
const StudentMonthMoney = ({ studentId, selectedDate, refreshTrigger }) => {
  const [monthMoney, setMonthMoney] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!studentId || !selectedDate) return;
    const fetchMonthMoney = async () => {
      try {
        setLoading(true);
        const year = selectedDate.slice(0, 4);
        const month = selectedDate.slice(5, 7);
        const firstDayOfMonth = `${year}-${month}-01`;
        const lastDay = new Date(Number(year), Number(month), 0).getDate();
        const lastDayOfMonth = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

        const { data: attendanceData } = await supabase
          .from('attendance').select('date, status, student_id')
          .eq('student_id', studentId).gte('date', firstDayOfMonth).lte('date', lastDayOfMonth);
        const { data: noteData } = await supabase
          .from('notes').select('date, money, student_id')
          .eq('student_id', studentId).gte('date', firstDayOfMonth).lte('date', lastDayOfMonth);

        const presentDays = (attendanceData || []).filter(a =>
          a.status === true || a.status === 'true' || a.status === 'Có mặt'
        ).length;
        const totalNotesMoney = (noteData || []).reduce((sum, n) => sum + parseMoneyValue(n.money), 0);
        setMonthMoney(presentDays * 50000 + totalNotesMoney);
      } catch { setMonthMoney(0); }
      finally { setLoading(false); }
    };
    fetchMonthMoney();
  }, [studentId, selectedDate, refreshTrigger]);

  return (
    <div className="student-money">
      {loading ? '...' : `${monthMoney.toLocaleString('vi-VN')}đ`}
    </div>
  );
};

function App() {
  const [showArchived, setShowArchived]           = useState(false);
  const [archivedStudents, setArchivedStudents]   = useState([]);
  const [students, setStudents]                   = useState([]);
  // ── MỚI: chỉ học sinh có lịch hôm nay ──
  const [todayStudents, setTodayStudents]         = useState([]);
  const [newName, setNewName]                     = useState('');
  const [attendanceList, setAttendanceList]       = useState([]);
  const [notes, setNotes]                         = useState([]);
  const [now, setNow]                             = useState(new Date());
  const [selectedDate, setSelectedDate]           = useState(new Date().toISOString().split('T')[0]);
  const [loadingId, setLoadingId]                 = useState(null);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedExportStudents, setSelectedExportStudents] = useState([]);
  const [searchStudent, setSearchStudent]         = useState('');
  const today                                     = selectedDate;
  const [selectAll, setSelectAll]                 = useState(false);
  const [showSearchBox, setShowSearchBox]         = useState(false);
  const filterRef                                 = useRef(null);
  const [noteContent, setNoteContent]             = useState('');
  const [noteMoney, setNoteMoney]                 = useState('');
  const [fromDate, setFromDate]                   = useState(new Date().toISOString().split('T')[0]);
  const [toDate, setToDate]                       = useState(new Date().toISOString().split('T')[0]);
  const [refreshTrigger, setRefreshTrigger]       = useState(0);
  const [user, setUser]                           = useState(null);

  // ── MỚI: modal lịch học & phiếu học phí ──
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [invoiceTarget, setInvoiceTarget]         = useState(null); // { student, yearMonth }
  const [showAllStudents, setShowAllStudents]     = useState(false); // toggle xem tất cả / chỉ hôm nay

  const displayName = () => {
    if (user?.email === 'truclinh@gmail.com') return 'cô Trúc Linh';
    return user?.email?.split('@')[0] || 'Giáo viên';
  };

  const formatDate = () => {
    const days = ['Chủ Nhật','Thứ Hai','Thứ Ba','Thứ Tư','Thứ Năm','Thứ Sáu','Thứ Bảy'];
    return `${days[now.getDay()]}, ngày ${now.getDate()} tháng ${now.getMonth() + 1} năm ${now.getFullYear()}`;
  };
  const formatTime = () => {
    const h = String(now.getHours()).padStart(2,'0');
    const m = String(now.getMinutes()).padStart(2,'0');
    const s = String(now.getSeconds()).padStart(2,'0');
    return `${h}:${m}:${s}`;
  };

  // ── fetchData ──
  const fetchData = async () => {
    try {
      const { data: stdData } = await supabase
        .from('students').select('*').eq('archived', false).order('id', { ascending: true });
      if (stdData) {
        setStudents(stdData);
        // Lọc học sinh có lịch hôm nay
        const scheduled = await getStudentsScheduledToday(stdData, selectedDate);
        setTodayStudents(scheduled);
      }
      const { data: attData } = await supabase.from('attendance').select('student_id').eq('date', today);
      if (attData) setAttendanceList([...new Set(attData.map(item => item.student_id))]);
      const { data: noteData } = await supabase
        .from('notes')
        .select('id, student_id, content, money, date')
        .eq('date', today);
      if (noteData) {
        const studentNameMap = {};
        (stdData || []).forEach(s => { studentNameMap[String(s.id)] = s.name; });
        const mergedNotes = noteData.map(n => ({
          ...n,
          studentName: studentNameMap[String(n.student_id)] || 'Không rõ học sinh'
        }));
        setNotes(mergedNotes);
      }
    } catch (error) { console.error('Error fetching data:', error); }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user || null));
  }, []);
  useEffect(() => { fetchData(); }, [selectedDate]);
  useEffect(() => { setFromDate(selectedDate); setToDate(selectedDate); }, [selectedDate]);
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) setShowSearchBox(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  if (!user) return <Login onLogin={setUser} />;

  // ── Danh sách hiển thị trong lưới điểm danh ──
  const displayedStudents = showAllStudents ? students : todayStudents;

  // ─────────────── EXPORT FUNCTIONS (giữ nguyên) ───────────────

  const exportToExcel = async () => {
    try {
      const { data: attendanceData } = await supabase.from('attendance')
        .select('date, status, student_id, students(name)').gte('date', fromDate).lte('date', toDate);
      const { data: studentData } = await supabase.from('students').select('id, name').eq('archived', false);
      const studentMap = {};
      studentData.forEach(s => { studentMap[s.id] = s.name; });
      const report = attendanceData.map(a => ({
        "Ngày": a.date, "Học sinh": studentMap[a.student_id], "Trạng thái": a.status ? "Có mặt" : "Vắng"
      }));
      const ws = XLSX.utils.json_to_sheet(report);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "BaoCao");
      XLSX.writeFile(wb, `Bao_Cao_${fromDate}_den_${toDate}.xlsx`);
    } catch (err) { alert("Lỗi khi xuất file: " + err.message); }
  };

  const exportMonth = async () => {
    try {
      const month = fromDate.slice(0, 7);
      const { data } = await supabase.from('attendance').select('date, status, student_id').like('date', `${month}%`);
      const { data: studentsData } = await supabase.from('students').select('id, name').eq('archived', false);
      const { data: notesData } = await supabase.from('notes').select('student_id, money, date').like('date', `${month}%`);
      const map = {};
      studentsData.forEach(s => map[s.id] = s.name);
      let totalMonth = 0;
      const report = data.map(d => {
        const noteMoney = notesData.filter(n => n.student_id === d.student_id && n.date === d.date)
          .reduce((sum, n) => sum + parseMoneyValue(n.money), 0);
        const sessionMoney = d.status ? 50000 : 0;
        totalMonth += sessionMoney + noteMoney;
        return { "Ngày": d.date, "Học sinh": map[d.student_id], "Trạng thái": d.status ? "Có mặt" : "Vắng", "Tiền buổi học": sessionMoney, "Tiền phát sinh": noteMoney };
      });
      report.push({ "Ngày": "TỔNG", "Học sinh": "", "Trạng thái": "", "Tiền buổi học": "", "Tiền phát sinh": totalMonth });
      const ws = XLSX.utils.json_to_sheet(report);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Thang");
      XLSX.writeFile(wb, `Bao_Cao_Thang_${month}.xlsx`);
    } catch (err) { alert("Lỗi khi xuất file: " + err.message); }
  };

  const handleAddStudent = async () => {
    if (!newName.trim()) return;
    try {
      const { error } = await supabase.from('students').insert([{ name: newName.trim(), archived: false }]);
      if (error) { alert('Lỗi thêm học sinh: ' + error.message); return; }
      setNewName('');
      fetchData();
    } catch (error) { console.error('Error adding student:', error); }
  };

  const handleAttendance = async (studentId) => {
    setLoadingId(studentId);
    try {
      const { data, error } = await supabase.from('attendance').select('*').eq('student_id', studentId).eq('date', today);
      if (error) { alert('Lỗi kiểm tra điểm danh: ' + error.message); return; }
      if (data.length === 0) {
        await supabase.from('attendance').insert([{ student_id: studentId, date: today, status: true }]);
      } else {
        await supabase.from('attendance').update({ status: true }).eq('student_id', studentId).eq('date', today);
      }
      await fetchData();
      setRefreshTrigger(t => t + 1);
    } catch (error) { console.error('Error marking attendance:', error); }
    finally { setLoadingId(null); }
  };

  const handleUncheck = async (studentId) => {
    setLoadingId(studentId);
    try {
      await supabase.from('attendance').delete().eq('student_id', studentId).eq('date', today);
      await fetchData();
      setRefreshTrigger(t => t + 1);
    } catch (error) { console.error('Error unchecking attendance:', error); }
    finally { setLoadingId(null); }
  };

  // ✅ FIX: Ghi chú KHÔNG đè nữa — luôn INSERT hàng mới
  const handleSaveNote = async () => {
    if (!selectedStudentId) return;
    try {
      const { error } = await supabase.from('notes').insert([{
        student_id: selectedStudentId,
        content:    noteContent.trim(),
        money:      parseMoneyValue(noteMoney),
        date:       selectedDate,
      }]);
      if (error) throw error;
      setNoteContent(''); setNoteMoney(''); setSelectedStudentId('');
      fetchData();
      setRefreshTrigger(t => t + 1);
    } catch (error) { alert('Lỗi lưu ghi chú: ' + error.message); }
  };

  const handleDeleteStudent = async (id) => {
    if (!window.confirm("Ẩn học sinh này? Dữ liệu điểm danh vẫn được giữ lại.")) return;
    try {
      const { error } = await supabase.from('students').update({ archived: true }).eq('id', id);
      if (error) { alert('LỖI: ' + error.message); return; }
      fetchData();
    } catch (error) { alert('CATCH LỖI: ' + error.message); }
  };

  const fetchArchivedStudents = async () => {
    const { data } = await supabase.from('students').select('*').eq('archived', true).order('id', { ascending: true });
    setArchivedStudents(data || []);
  };

  const handleRestoreStudent = async (id) => {
    if (!window.confirm("Khôi phục học sinh này?")) return;
    await supabase.from('students').update({ archived: false }).eq('id', id);
    fetchData(); fetchArchivedStudents();
  };

  const handlePermanentDeleteStudent = async (id) => {
    if (!window.confirm("⚠️ Xóa vĩnh viễn học sinh này? Dữ liệu sẽ mất hoàn toàn!")) return;
    try {
      const { error } = await supabase.from('students').delete().eq('id', id);
      if (error) { alert('Lỗi xóa: ' + error.message); return; }
      fetchArchivedStudents();
    } catch (error) { alert('Lỗi: ' + error.message); }
  };

  const exportToday = async () => {
    try {
      const { data } = await supabase.from('attendance').select('date, status, student_id, students(name)').eq('date', selectedDate);
      const report = (data || []).map(d => ({ "Ngày": d.date, "Học sinh": d.students?.name, "Trạng thái": d.status ? "Có mặt" : "Vắng" }));
      const ws = XLSX.utils.json_to_sheet(report); const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "HomNay");
      XLSX.writeFile(wb, `Bao_Cao_Hom_Nay_${selectedDate}.xlsx`);
    } catch (err) { alert("Lỗi khi xuất file: " + err.message); }
  };

  const exportRange = async () => {
    try {
      const year = fromDate.slice(0, 4); const month = fromDate.slice(5, 7);
      const firstDayOfMonth = `${year}-${month}-01`;
      const { data: attendanceData } = await supabase.from('attendance').select('date, status, student_id').gte('date', fromDate).lte('date', toDate);
      const { data: noteData } = await supabase.from('notes').select('student_id, date, content, money').gte('date', fromDate).lte('date', toDate);
      const { data: studentsData } = await supabase.from('students').select('id, name').eq('archived', false);
      const { data: attendanceDataFromMonthStart } = await supabase.from('attendance').select('date, status, student_id').gte('date', firstDayOfMonth).lte('date', toDate);
      const { data: noteDataFromMonthStart } = await supabase.from('notes').select('student_id, date, money').gte('date', firstDayOfMonth).lte('date', toDate);

      const attendanceMap = {};
      (attendanceData || []).forEach(a => { attendanceMap[`${a.student_id}_${a.date}`] = a.status; });
      const noteMap = {};
      (noteData || []).forEach(n => {
        const k = `${n.student_id}_${n.date}`;
        if (!noteMap[k]) noteMap[k] = { items: [] };
        noteMap[k].items.push({ content: n.content, money: parseMoneyValue(n.money) });
      });

      const dates = [];
      let current = new Date(fromDate);
      while (current <= new Date(toDate)) { dates.push(current.toISOString().split('T')[0]); current.setDate(current.getDate() + 1); }

      const report = []; const studentTotals = {};
      dates.forEach(date => {
        studentsData.filter(s => selectedExportStudents.length === 0 || selectedExportStudents.includes(String(s.id))).forEach(student => {
          const key = `${student.id}_${date}`;
          const sessionMoney = (attendanceMap[key] ? 50000 : 0);
          const noteItems = noteMap[key]?.items || [];
          const extraMoney = noteItems.reduce((s, i) => s + i.money, 0);
          const noteText = noteItems.map(i => `${i.content}${i.money > 0 ? ` (${i.money.toLocaleString('vi-VN')}đ)` : ''}`).join('; ');
          const totalMoney = sessionMoney + extraMoney;
          if (!studentTotals[student.id]) studentTotals[student.id] = { name: student.name, total: 0 };
          studentTotals[student.id].total += totalMoney;
          report.push({ "Ngày": date, "Học sinh": student.name, "Trạng thái": attendanceMap[key] ? "Có mặt" : "Vắng", "Ghi chú": noteText, "Tiền phát sinh": extraMoney > 0 ? extraMoney.toLocaleString('vi-VN') : "", "Tiền buổi học": sessionMoney > 0 ? sessionMoney.toLocaleString('vi-VN') : "", "Tổng cộng": totalMoney > 0 ? totalMoney.toLocaleString('vi-VN') : "" });
        });
      });

      report.push({ "Ngày": "", "Học sinh": "", "Trạng thái": "", "Ghi chú": "━━━━━━━━━", "Tiền phát sinh": "", "Tiền buổi học": "", "Tổng cộng": "" });
      const studentSummary = {};
      studentsData.forEach(student => {
        if (selectedExportStudents.length === 0 || selectedExportStudents.includes(String(student.id))) {
          const totalSessions = (attendanceDataFromMonthStart || []).filter(a => a.student_id === student.id && (a.status === 'Có mặt' || a.status === true)).length;
          const sessionMoney = totalSessions * 50000;
          const totalNotesMoney = (noteDataFromMonthStart || []).filter(n => n.student_id === student.id).reduce((sum, n) => sum + parseMoneyValue(n.money), 0);
          studentSummary[student.id] = { name: student.name, totalSessions, totalMoneyFromMonthStart: sessionMoney + totalNotesMoney };
        }
      });
      report.push({ "Ngày": "", "Học sinh": "═════════════════════", "Trạng thái": "", "Ghi chú": "", "Tiền phát sinh": "", "Tiền buổi học": "", "Tổng cộng": "" });
      report.push({ "Ngày": "TÓMLẠI TỪNG HỌC SINH", "Học sinh": "Tên", "Trạng thái": "Buổi (1-nay)", "Ghi chú": "Tổng tiền (1-nay)", "Tiền phát sinh": "", "Tiền buổi học": "", "Tổng cộng": "" });
      Object.values(studentSummary).forEach(summary => {
        report.push({ "Ngày": "", "Học sinh": summary.name, "Trạng thái": `${summary.totalSessions} buổi`, "Ghi chú": `${summary.totalMoneyFromMonthStart.toLocaleString('vi-VN')}đ`, "Tiền phát sinh": "", "Tiền buổi học": "", "Tổng cộng": "" });
      });
      report.push({ "Ngày": "", "Học sinh": "", "Trạng thái": "", "Ghi chú": "", "Tiền phát sinh": "", "Tiền buổi học": "", "Tổng cộng": "" });
      const totalMoney = Object.values(studentTotals).reduce((sum, s) => sum + s.total, 0);
      report.push({ "Ngày": "TỔNG CỘNG", "Học sinh": "", "Trạng thái": "", "Ghi chú": "", "Tiền phát sinh": "", "Tiền buổi học": "", "Tổng cộng": totalMoney > 0 ? totalMoney.toLocaleString('vi-VN') : "" });

      const ws = XLSX.utils.json_to_sheet(report); const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "BaoCao");
      const isSameMonth = fromDate.slice(0, 7) === toDate.slice(0, 7);
      XLSX.writeFile(wb, isSameMonth ? `Bao_Cao_Thang_${fromDate.slice(0, 7)}.xlsx` : `Bao_Cao_${fromDate}_den_${toDate}.xlsx`);
    } catch (err) { alert("Lỗi khi xuất file: " + err.message); }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="app-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Quicksand:wght@500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --brand-1: #6C63FF; --brand-2: #FF6584; --brand-3: #43C59E;
          --present: #22C55E; --absent: #F97316;
          --bg: #F3F5FD; --surface: #FFFFFF; --surface-2: #F8FAFF;
          --border: #E8ECF4; --text-1: #1A1D2E; --text-2: #4A5073; --text-3: #8B91B0;
          --shadow-sm: 0 4px 12px rgba(82, 67, 170, .08);
          --shadow-md: 0 10px 28px rgba(82, 67, 170, .12);
          --shadow-lg: 0 18px 50px rgba(82, 67, 170, .18);
          --radius-sm: 12px; --radius-md: 20px; --radius-lg: 28px; --radius-xl: 36px;
          --font-display: 'Nunito', sans-serif; --font-body: 'Quicksand', sans-serif;
        }
        body { background: var(--bg); font-family: var(--font-body); }
        .app-root { min-height: 100vh; background: radial-gradient(circle at top left, #eef2ff 0%, #f5f7fd 36%, #f3f5fd 100%); color: var(--text-1); font-family: var(--font-body); }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #c4c9e2; border-radius: 99px; }

        .header {
          background: linear-gradient(135deg, #6C63FF 0%, #A855F7 50%, #EC4899 100%);
          padding: 50px 24px 42px; text-align: center; position: relative; overflow: hidden;
          box-shadow: 0 14px 34px rgba(108,99,255,.28);
        }
        .header::before {
          content: ''; position: absolute; inset: 0;
          background: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.04'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
        }
        .header-greeting { position: absolute; top: 16px; left: 20px; font-size: 13px; font-weight: 700; color: rgba(255,255,255,.85); font-family: var(--font-body); letter-spacing: .3px; }
        .header-top-right { position: absolute; top: 14px; right: 16px; display: flex; gap: 8px; align-items: center; }
        .btn-schedule {
          padding: 7px 14px; background: rgba(255,255,255,.18); color: #fff;
          border: 1px solid rgba(255,255,255,.35); border-radius: 99px; cursor: pointer;
          font-size: 12px; font-weight: 700; font-family: var(--font-body);
          backdrop-filter: blur(8px); transition: background .2s;
        }
        .btn-schedule:hover { background: rgba(255,255,255,.32); }
        .header-logout {
          padding: 7px 16px; background: rgba(255,255,255,.15); color: #fff;
          border: 1px solid rgba(255,255,255,.3); border-radius: 99px; cursor: pointer;
          font-size: 12px; font-weight: 700; font-family: var(--font-body);
          backdrop-filter: blur(8px); transition: background .2s;
        }
        .header-logout:hover { background: rgba(255,255,255,.28); }
        .header-emoji-row { display: flex; align-items: center; justify-content: center; gap: 12px; font-size: 40px; margin-bottom: 10px; filter: drop-shadow(0 4px 12px rgba(0,0,0,.2)); }
        .header-title { font-family: var(--font-display); font-size: clamp(34px,8vw,58px); font-weight: 900; letter-spacing: 3px; text-transform: uppercase; background: linear-gradient(90deg,#fff 0%,#fde68a 40%,#fbcfe8 80%,#fff 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; line-height: 1.1; margin-bottom: 6px; }
        .header-badge { display: inline-block; padding: 5px 20px; background: rgba(255,255,255,.15); border: 1px solid rgba(255,255,255,.25); border-radius: 99px; font-size: 11px; font-weight: 700; letter-spacing: 5px; color: rgba(255,255,255,.9); backdrop-filter: blur(8px); margin-bottom: 8px; }
        .header-date { font-size: 14px; font-weight: 700; color: rgba(255,255,255,.85); margin: 6px 0 18px; letter-spacing: .5px; }
        .date-picker-wrap { display: inline-flex; align-items: center; background: rgba(255,255,255,.18); border: 1.5px solid rgba(255,255,255,.35); border-radius: 99px; padding: 4px 6px 4px 16px; gap: 8px; backdrop-filter: blur(10px); }
        .date-picker-wrap input[type="date"] { background: transparent; border: none; color: #fff; font-size: 14px; font-weight: 700; font-family: var(--font-body); outline: none; cursor: pointer; color-scheme: dark; }

        .main { max-width: 1160px; margin: 0 auto; padding: 30px 18px 52px; }

        .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 24px; }
        .stat-card { background: var(--surface); border-radius: var(--radius-lg); padding: 20px 18px; box-shadow: var(--shadow-sm); border: 1.5px solid var(--border); display: flex; flex-direction: column; gap: 4px; position: relative; overflow: hidden; }
        .stat-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; border-radius: 99px 99px 0 0; }
        .stat-card.blue::before { background: linear-gradient(90deg,#6C63FF,#818CF8); }
        .stat-card.green::before { background: linear-gradient(90deg,#22C55E,#86EFAC); }
        .stat-card.red::before { background: linear-gradient(90deg,#F97316,#FB923C); }
        .stat-label { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: var(--text-3); }
        .stat-value { font-family: var(--font-display); font-size: 38px; font-weight: 900; line-height: 1; }
        .stat-card.blue .stat-value { color: #6C63FF; }
        .stat-card.green .stat-value { color: #16A34A; }
        .stat-card.red .stat-value { color: #EA580C; }

        .panel { background: var(--surface); border-radius: var(--radius-xl); box-shadow: var(--shadow-sm); border: 1.5px solid var(--border); overflow: hidden; transition: box-shadow .2s, transform .2s; }
        .panel:hover { box-shadow: var(--shadow-md); transform: translateY(-1px); }
        .panel-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; padding: 20px 22px 16px; border-bottom: 1.5px solid var(--border); background: linear-gradient(180deg,#ffffff 0%,#fcfcff 100%); }
        .panel-title { font-family: var(--font-display); font-size: 17px; font-weight: 800; color: var(--text-1); display: flex; align-items: center; gap: 8px; }
        .panel-body { padding: 20px 22px; }

        /* Toggle today/all */
        .toggle-view-btn {
          padding: 5px 14px; border-radius: 99px; border: 1.5px solid var(--border);
          background: var(--surface-2); font-size: 11px; font-weight: 700;
          font-family: var(--font-body); color: var(--text-2); cursor: pointer; transition: all .2s;
        }
        .toggle-view-btn.active { background: #EEF2FF; border-color: #6C63FF; color: #6C63FF; }

        .att-controls { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .date-range-input { padding: 7px 14px; border-radius: 99px; border: 1.5px solid var(--border); background: var(--surface-2); font-size: 12px; font-weight: 700; font-family: var(--font-body); color: var(--text-1); outline: none; cursor: pointer; width: 120px; transition: border-color .2s, box-shadow .2s; }
        .date-range-input:focus { border-color: var(--brand-1); box-shadow: 0 0 0 3px rgba(108,99,255,.14); }
        .arrow-sep { font-weight: 900; font-size: 15px; color: var(--brand-1); flex-shrink: 0; }
        .filter-wrap { position: relative; }
        .filter-btn { padding: 7px 14px; border-radius: 99px; border: 1.5px solid var(--border); background: var(--surface-2); font-size: 12px; font-weight: 700; font-family: var(--font-body); color: var(--text-2); cursor: pointer; white-space: nowrap; transition: all .2s; }
        .filter-btn:hover { border-color: var(--brand-1); color: var(--brand-1); }
        .filter-dropdown { position: absolute; top: calc(100% + 8px); left: 0; width: 200px; background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--radius-md); padding: 12px; z-index: 100; max-height: 260px; overflow-y: auto; box-shadow: var(--shadow-md); }
        .filter-search { width: 100%; padding: 8px 12px; border-radius: var(--radius-sm); border: 1.5px solid var(--border); font-size: 13px; font-family: var(--font-body); outline: none; margin-bottom: 8px; color: var(--text-1); background: var(--surface-2); }
        .filter-label { display: flex; align-items: center; gap: 7px; font-size: 13px; font-weight: 600; margin-bottom: 5px; cursor: pointer; color: var(--text-1); }
        .btn-export { padding: 9px 20px; background: linear-gradient(135deg,#6C63FF 0%,#A855F7 100%); color: #fff; border: none; border-radius: 99px; font-weight: 800; font-size: 13px; cursor: pointer; font-family: var(--font-body); box-shadow: 0 4px 14px rgba(108,99,255,.35); transition: transform .15s, box-shadow .15s, filter .15s; white-space: nowrap; }
        .btn-export:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(108,99,255,.45); }
        .btn-export:active { transform: translateY(0); filter: brightness(.96); }

        .student-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(126px, 1fr)); gap: 12px; max-height: 490px; overflow-y: auto; padding: 4px 2px; }
        .student-card { position: relative; }
        .student-btn { width: 100%; padding: 16px 10px 12px; border-radius: var(--radius-lg); border: 2px solid transparent; cursor: pointer; transition: all .22s cubic-bezier(.34,1.56,.64,1); display: flex; flex-direction: column; align-items: center; gap: 6px; font-family: var(--font-body); position: relative; overflow: hidden; }
        .student-btn::after { content: ''; position: absolute; top: -80%; left: -40%; width: 60%; height: 220%; transform: rotate(20deg); background: rgba(255,255,255,.18); transition: left .35s; }
        .student-btn:hover::after { left: 110%; }
        .student-btn.absent { background: var(--surface-2); border-color: var(--border); color: var(--text-2); box-shadow: var(--shadow-sm); }
        .student-btn.absent:hover { border-color: var(--brand-3); transform: translateY(-3px); box-shadow: 0 8px 24px rgba(67,197,158,.18); }
        .student-btn.present { background: linear-gradient(135deg,#22C55E 0%,#16A34A 100%); border-color: transparent; color: #fff; box-shadow: 0 6px 18px rgba(34,197,94,.35); transform: translateY(-3px); }
        .student-btn.present:hover { box-shadow: 0 10px 28px rgba(34,197,94,.45); }
        .student-btn.loading { opacity: .6; cursor: wait; }
        .student-avatar { width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 17px; font-weight: 900; font-family: var(--font-display); flex-shrink: 0; }
        .student-btn.absent .student-avatar { background: linear-gradient(135deg,#E0E7FF 0%,#C7D2FE 100%); color: #6C63FF; }
        .student-btn.present .student-avatar { background: rgba(255,255,255,.25); color: #fff; }
        .student-name { font-size: 13px; font-weight: 700; text-align: center; line-height: 1.3; word-break: break-word; }
        .student-money { font-size: 11px; font-weight: 700; text-align: center; }
        .student-btn.absent .student-money { color: var(--brand-3); }
        .student-btn.present .student-money { color: rgba(255,255,255,.85); }
        .student-status-pill { font-size: 10px; font-weight: 700; padding: 2px 10px; border-radius: 99px; letter-spacing: .5px; }
        .student-btn.absent .student-status-pill { background: #FEF3C7; color: #92400E; }
        .student-btn.present .student-status-pill { background: rgba(255,255,255,.25); color: #fff; }
        
        /* ✅ Invoice button ở góc trái phía trên */
        .invoice-btn { position: absolute; top: 6px; left: 6px; width: 22px; height: 22px; border-radius: 50%; background: rgba(255,255,255,.9); border: 1px solid #c4b5fd; color: #7c3aed; font-size: 10px; display: flex; align-items: center; justify-content: center; cursor: pointer; opacity: 0; transform: scale(.7); transition: all .18s; box-shadow: 0 2px 6px rgba(0,0,0,.1); }
        .student-card:hover .invoice-btn { opacity: 1; transform: scale(1); }
        @media (max-width: 768px) { .invoice-btn { opacity: 1 !important; transform: scale(1) !important; } }
        
        .delete-btn { position: absolute; top: 6px; right: 6px; width: 20px; height: 20px; border-radius: 50%; background: rgba(255,255,255,.9); border: 1px solid #fca5a5; color: #ef4444; font-size: 9px; font-weight: 900; display: flex; align-items: center; justify-content: center; cursor: pointer; opacity: 0; transform: scale(.7); transition: all .18s; box-shadow: 0 2px 6px rgba(0,0,0,.1); line-height: 1; }
        .delete-btn.visible { opacity: 1 !important; transform: scale(1) !important; }
        .delete-btn.disabled { opacity: .3 !important; cursor: not-allowed !important; }
        .student-card:hover .delete-btn { opacity: 1; transform: scale(1); }
        @media (max-width: 768px) { .delete-btn { opacity: 1 !important; transform: scale(1) !important; } }

        input[type="checkbox"] { appearance: none; -webkit-appearance: none; width: 16px; height: 16px; border: 2px solid #CBD5E1; background: #fff; border-radius: 5px; cursor: pointer; position: relative; flex-shrink: 0; transition: all .15s; }
        input[type="checkbox"]:checked { background: var(--brand-3); border-color: var(--brand-3); }
        input[type="checkbox"]:checked::after { content: '✓'; position: absolute; color: white; font-size: 11px; font-weight: 900; left: 1px; top: -1px; }

        .bottom-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-top: 24px; }
        .form-input { width: 100%; padding: 13px 16px; border-radius: var(--radius-md); border: 1.5px solid var(--border); background: var(--surface-2); font-size: 14px; font-weight: 600; font-family: var(--font-body); color: var(--text-1); outline: none; transition: border-color .2s, box-shadow .2s; }
        .form-input:focus { border-color: var(--brand-1); box-shadow: 0 0 0 3px rgba(108,99,255,.1); background: #fff; }
        .form-input::placeholder { color: var(--text-3); }
        textarea.form-input { height: 88px; resize: none; }
        select.form-input { cursor: pointer; }
        .btn-primary { width: 100%; padding: 14px; border: none; border-radius: var(--radius-md); font-size: 14px; font-weight: 800; cursor: pointer; font-family: var(--font-display); letter-spacing: .5px; transition: transform .15s, box-shadow .15s, filter .15s; }
        .btn-primary:hover { transform: translateY(-1px); }
        .btn-primary:active { transform: translateY(0); filter: brightness(.97); }
        .btn-add { padding: 13px 22px; white-space: nowrap; border: none; border-radius: var(--radius-md); background: linear-gradient(135deg,#6C63FF 0%,#818CF8 100%); color: #fff; font-weight: 800; font-size: 13px; cursor: pointer; font-family: var(--font-display); box-shadow: 0 4px 14px rgba(108,99,255,.35); transition: transform .15s, box-shadow .15s; }
        .btn-add:hover { transform: translateY(-1px); }
        .panel-add { background: linear-gradient(135deg,#EEF2FF 0%,#F5F3FF 100%); }
        .panel-note { background: linear-gradient(135deg,#FDF4FF 0%,#FAF5FF 100%); }

        /* Notes list - ✅ Hiển thị tên học sinh + tiền phát sinh */
        .notes-list { margin-top: 12px; display: flex; flex-direction: column; gap: 8px; max-height: 200px; overflow-y: auto; }
        .note-item { background: #fff; border-radius: 12px; padding: 10px 14px; border: 1.5px solid #e9d5ff; }
        .note-item-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; flex-wrap: wrap; gap: 6px; }
        .note-item-name { font-size: 10px; font-weight: 800; color: #7e22ce; text-transform: uppercase; letter-spacing: 0.5px; }
        .note-item-money { font-size: 11px; font-weight: 800; color: #22c55e; }
        .note-item-content { font-size: 12px; color: #4a5073; font-weight: 600; margin-bottom: 4px; }
        .note-delete-btn { background: none; border: none; color: #fca5a5; cursor: pointer; font-size: 13px; padding: 2px 4px; border-radius: 6px; transition: all .15s; }
        .note-delete-btn:hover { background: #fee2e2; color: #dc2626; }

        .btn-archived-toggle { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; padding: 12px 24px; border-radius: 99px; border: 2px dashed #c4b5fd; background: linear-gradient(135deg,#fce7f3 0%,#ede9fe 100%); color: #7C3AED; font-weight: 800; font-size: 13px; cursor: pointer; font-family: var(--font-body); transition: all .2s; margin-top: 16px; }
        .btn-archived-toggle:hover { transform: scale(1.02); border-color: #a78bfa; }
        .archived-panel { margin-top: 16px; padding: 24px; background: linear-gradient(135deg,#fdf4ff 0%,#f5f0ff 100%); border-radius: var(--radius-xl); border: 2px dashed #e9d5ff; }
        .archived-title { text-align: center; font-weight: 800; font-size: 14px; margin-bottom: 16px; letter-spacing: 1px; background: linear-gradient(90deg,#ec4899,#8b5cf6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .archived-grid { display: flex; flex-wrap: wrap; gap: 12px; justify-content: center; }
        .archived-card { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 16px 14px; background: #fff; border-radius: 20px; border: 1.5px solid #fbcfe8; min-width: 100px; box-shadow: 0 3px 10px rgba(249,168,212,.2); transition: transform .2s; }
        .archived-card:hover { transform: translateY(-3px); }
        .archived-avatar { width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg,#f9a8d4 0%,#c4b5fd 100%); display: flex; align-items: center; justify-content: center; font-size: 17px; font-weight: 900; color: #fff; font-family: var(--font-display); }
        .archived-name { font-size: 12px; font-weight: 700; color: #7C3AED; text-align: center; }
        .btn-restore { padding: 5px 14px; background: linear-gradient(135deg,#34d399 0%,#059669 100%); color: #fff; border: none; border-radius: 99px; cursor: pointer; font-size: 11px; font-weight: 700; font-family: var(--font-body); transition: transform .15s; }
        .btn-restore:hover { transform: scale(1.06); }
        .btn-perm-delete { padding: 5px 12px; background: #ef4444; color: #fff; border: none; border-radius: 99px; cursor: pointer; font-size: 11px; font-weight: 700; font-family: var(--font-body); transition: transform .15s; }
        .btn-perm-delete:hover { transform: scale(1.06); }

        .footer { text-align: center; padding: 40px 16px; color: var(--text-3); font-size: 12px; font-weight: 600; }
        .footer-time { font-family: var(--font-display); font-size: 22px; font-weight: 900; color: var(--brand-1); letter-spacing: 2px; margin-top: 6px; }

        @media (max-width: 640px) {
          .header { padding: 52px 16px 32px; }
          .header-greeting { font-size: 11px; top: 14px; left: 14px; }
          .header-top-right { top: 12px; right: 12px; gap: 6px; }
          .btn-schedule, .header-logout { padding: 6px 10px; font-size: 11px; }
          .main { padding: 16px 10px 38px; }
          .panel { border-radius: 22px; }
          .stats-grid { gap: 10px; }
          .stat-value { font-size: 30px; }
          .stat-card { padding: 16px 12px; }
          .student-grid { grid-template-columns: repeat(auto-fill, minmax(108px, 1fr)); gap: 10px; max-height: none; }
          .panel-header { padding: 16px; }
          .panel-body { padding: 16px; }
          .att-controls { gap: 6px; }
          .date-range-input { width: 104px; font-size: 11px; }
          .btn-export { width: 100%; justify-content: center; }
          .bottom-grid { gap: 14px; }
        }
        @media (max-width: 400px) {
          .stats-grid { grid-template-columns: repeat(3, 1fr); }
          .stat-value { font-size: 26px; }
          .stat-label { font-size: 9px; }
          .student-grid { grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)); }
        }
      `}</style>

      {/* ── MODALS ── */}
      {showScheduleModal && (
        <StudentSchedule
          students={students}
          onClose={() => { setShowScheduleModal(false); fetchData(); }}
        />
      )}
      {invoiceTarget && (
        <InvoiceModal
          student={invoiceTarget.student}
          yearMonth={invoiceTarget.yearMonth}
          onClose={() => setInvoiceTarget(null)}
        />
      )}

      {/* ── HEADER ── */}
      <header className="header">
        <span className="header-greeting">Xin chào {displayName()} 👋</span>
        <div className="header-top-right">
          <button className="btn-schedule" onClick={() => setShowScheduleModal(true)}>
            📅 Lịch học
          </button>
          <button className="header-logout" onClick={async () => { await supabase.auth.signOut(); setUser(null); }}>
            Đăng xuất
          </button>
        </div>
        <div className="header-emoji-row">
          <span style={{ transform: 'rotate(-12deg)', display: 'inline-block' }}>🦉</span>
          <span>✨📖✨</span>
          <span style={{ transform: 'rotate(12deg)', display: 'inline-block' }}>✏️</span>
        </div>
        <h1 className="header-title">Trúc Linh</h1>
        <div className="header-badge">EDUCATION CENTER</div>
        <p className="header-date">{formatDate()}</p>
        <div className="date-picker-wrap">
          <span style={{ fontSize: '15px' }}>📅</span>
          <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
        </div>
      </header>

      {/* ── MAIN ── */}
      <main className="main">
        {/* STATS */}
        <div className="stats-grid">
          <div className="stat-card blue">
            <span className="stat-label">Tổng số</span>
            <span className="stat-value">{displayedStudents.length}</span>
          </div>
          <div className="stat-card green">
            <span className="stat-label">Có mặt</span>
            <span className="stat-value">{attendanceList.filter(id => displayedStudents.some(s => s.id === id)).length}</span>
          </div>
          <div className="stat-card red">
            <span className="stat-label">Vắng</span>
            <span className="stat-value">{displayedStudents.length - attendanceList.filter(id => displayedStudents.some(s => s.id === id)).length}</span>
          </div>
        </div>

        {/* ATTENDANCE PANEL */}
        <div className="panel" style={{ marginBottom: '24px' }}>
          <div className="panel-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="panel-title">🎓 Lớp mình</span>
              {/* Toggle hiển thị tất cả hay chỉ hôm nay */}
              <button
                className={`toggle-view-btn ${!showAllStudents ? 'active' : ''}`}
                onClick={() => setShowAllStudents(false)}
                title="Chỉ học sinh có lịch hôm nay"
              >
                📅 Hôm nay ({todayStudents.length})
              </button>
              <button
                className={`toggle-view-btn ${showAllStudents ? 'active' : ''}`}
                onClick={() => setShowAllStudents(true)}
                title="Tất cả học sinh"
              >
                👥 Tất cả ({students.length})
              </button>
            </div>
            <div className="att-controls">
              <input type="date" className="date-range-input" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              <span className="arrow-sep">→</span>
              <input type="date" className="date-range-input" value={toDate} onChange={(e) => setToDate(e.target.value)} />
              <div ref={filterRef} className="filter-wrap">
                <button className="filter-btn" onClick={() => setShowSearchBox(!showSearchBox)}>
                  🔍 {selectedExportStudents.length > 0 ? `(${selectedExportStudents.length})` : 'Lọc'}
                </button>
                {showSearchBox && (
                  <div className="filter-dropdown">
                    <input type="text" className="filter-search" placeholder="Tìm học sinh..." value={searchStudent} onChange={(e) => setSearchStudent(e.target.value)} />
                    <label className="filter-label" style={{ fontWeight: 800, marginBottom: 8 }}>
                      <input type="checkbox" checked={selectAll} onChange={() => { if (selectAll) { setSelectedExportStudents([]); } else { setSelectedExportStudents(students.map(s => String(s.id))); } setSelectAll(!selectAll); }} />
                      Chọn tất cả
                    </label>
                    {students.filter(s => !searchStudent || s.name.toLowerCase().includes(searchStudent.toLowerCase())).map(s => (
                      <label key={s.id} className="filter-label">
                        <input type="checkbox" checked={selectedExportStudents.includes(String(s.id))} onChange={(e) => { if (e.target.checked) { setSelectedExportStudents([...selectedExportStudents, String(s.id)]); } else { setSelectedExportStudents(selectedExportStudents.filter(id => id !== String(s.id))); setSelectAll(false); } }} />
                        {s.name}
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <button className="btn-export" onClick={exportRange}>📊 Xuất file</button>
            </div>
          </div>

          <div className="panel-body">
            {displayedStudents.length === 0 && !showAllStudents && (
              <div style={{ textAlign: 'center', padding: '32px 0', color: '#8b91b0' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>😴</div>
                <p style={{ fontWeight: 700 }}>Hôm nay không có lịch học</p>
                <p style={{ fontSize: 12, marginTop: 4 }}>Nhấn "Tất cả" để xem danh sách đầy đủ, hoặc cài lịch học bằng nút 📅 Lịch học</p>
              </div>
            )}
            <div className="student-grid">
              {displayedStudents.map(s => {
                const isPresent = attendanceList.includes(s.id);
                const isLoading = loadingId === s.id;
                return (
                  <div key={s.id} className="student-card">
                    <button
                      disabled={isLoading}
                      onClick={() => isPresent ? handleUncheck(s.id) : handleAttendance(s.id)}
                      className={`student-btn ${isPresent ? 'present' : 'absent'} ${isLoading ? 'loading' : ''}`}
                    >
                      <div className="student-avatar">{s.name.charAt(0).toUpperCase()}</div>
                      <span className="student-name">{s.name}</span>
                      <StudentMonthMoney studentId={s.id} selectedDate={selectedDate} refreshTrigger={refreshTrigger} />
                      <span className="student-status-pill">{isLoading ? '...' : isPresent ? 'Có mặt' : 'Vắng'}</span>
                    </button>
                    {/* ✅ Nút xem phiếu học phí ở góc trái phía trên */}
                    <span
                      className="invoice-btn"
                      onClick={() => setInvoiceTarget({ student: s, yearMonth: selectedDate.slice(0, 7) })}
                      title="Xem phiếu học phí"
                    >📄</span>
                    <span
                      className={`delete-btn ${attendanceList.includes(s.id) ? 'disabled' : ''}`}
                      onClick={() => { if (!attendanceList.includes(s.id)) handleDeleteStudent(s.id); }}
                      title="Ẩn học sinh"
                    >✕</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* BOTTOM GRID */}
        <div className="bottom-grid">
          {/* ADD STUDENT */}
          <div className="panel panel-add">
            <div className="panel-header" style={{ borderBottomColor: '#DDD6FE' }}>
              <span className="panel-title" style={{ color: '#4F46E5' }}>🍎 Thêm bạn mới</span>
            </div>
            <div className="panel-body">
              <div style={{ display: 'flex', gap: '10px' }}>
                <input className="form-input" type="text" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddStudent()} placeholder="Tên của bé..." />
                <button className="btn-add" onClick={handleAddStudent}>THÊM</button>
              </div>
              <button className="btn-archived-toggle" onClick={() => { const next = !showArchived; setShowArchived(next); if (next) fetchArchivedStudents(); }}>
                {showArchived ? '🙈 Ẩn danh sách' : '🌸 Học sinh đã nghỉ'}
              </button>
              {showArchived && (
                <div className="archived-panel">
                  <p className="archived-title">🌙 Các bé đã nghỉ 🌙</p>
                  {archivedStudents.length === 0 ? (
                    <p style={{ textAlign: 'center', color: '#d8b4fe', fontSize: '13px', fontWeight: 600 }}>✨ Chưa có bé nào nghỉ học ✨</p>
                  ) : (
                    <div className="archived-grid">
                      {archivedStudents.map(s => (
                        <div key={s.id} className="archived-card">
                          <div className="archived-avatar">{s.name.charAt(0).toUpperCase()}</div>
                          <span className="archived-name">{s.name}</span>
                          <button className="btn-restore" onClick={() => handleRestoreStudent(s.id)}>Khôi phục</button>
                          <button className="btn-perm-delete" onClick={() => handlePermanentDeleteStudent(s.id)}>Xóa</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* NOTE */}
          <div className="panel panel-note">
            <div className="panel-header" style={{ borderBottomColor: '#E9D5FF' }}>
              <span className="panel-title" style={{ color: '#7E22CE' }}>📝 Nhật ký hôm nay</span>
            </div>
            <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <select className="form-input" value={selectedStudentId} onChange={(e) => setSelectedStudentId(e.target.value)}>
                <option value="">— Chọn tên bé —</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <textarea className="form-input" value={noteContent} onChange={(e) => setNoteContent(e.target.value)} placeholder="Lời nhắn cho phụ huynh..." />
              <input
                type="text" inputMode="numeric" className="form-input"
                value={noteMoney ? Number(noteMoney).toLocaleString('vi-VN') : ''}
                onChange={(e) => { const raw = e.target.value.replace(/\./g, '').replace(/,/g, ''); if (raw === '' || /^\d+$/.test(raw)) setNoteMoney(raw); }}
                placeholder="Tiền phát sinh (nếu có)"
              />
              <button className="btn-primary" onClick={handleSaveNote} style={{ background: 'linear-gradient(135deg,#A855F7 0%,#EC4899 100%)', color: '#fff', boxShadow: '0 6px 18px rgba(168,85,247,.35)' }}>
                LƯU GHI CHÚ 💖
              </button>

              {/* ✅ Hiển thị danh sách ghi chú hôm nay (CÓ HIỂN THỊ TÊN + TIỀN) */}
              {notes.length > 0 && (
                <div>
                  <p style={{ fontSize: 11, fontWeight: 800, color: '#8b91b0', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>
                    Ghi chú hôm nay ({notes.length})
                  </p>
                  <div className="notes-list">
                    {notes.map(n => (
                      <div key={n.id} className="note-item">
                        <div className="note-item-header">
                          <span className="note-item-name">👤 {n.studentName || students.find(s => String(s.id) === String(n.student_id))?.name || 'Không rõ học sinh'}</span>
                          {parseMoneyValue(n.money) > 0 && <span className="note-item-money">+{parseMoneyValue(n.money).toLocaleString('vi-VN')}đ</span>}
                          <button
                            className="note-delete-btn"
                            onClick={async () => {
                              if (!window.confirm('Xóa ghi chú này?')) return;
                              await supabase.from('notes').delete().eq('id', n.id);
                              fetchData(); setRefreshTrigger(t => t + 1);
                            }}
                          >✕</button>
                        </div>
                        {n.content && <p className="note-item-content">{n.content}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* ── FOOTER ── */}
      <footer className="footer">
        <p>🦉 TRÚC LINH EDUCATION CENTER • {new Date().getFullYear()} ✨📖</p>
        <p className="footer-time">🕒 {formatTime()}</p>
      </footer>
    </div>
  );
}

export default App;
