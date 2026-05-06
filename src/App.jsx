import { useEffect, useState, useRef } from 'react';
import { supabase } from './supabaseClient'; 
import * as XLSX from 'xlsx'; 
import Login from './Login'

// ⭐ COMPONENT HIỂN THỊ TỔNG TIỀN THÁNG
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
        const lastDayOfMonth = selectedDate;

        const { data: attendanceData, error: attError } = await supabase
          .from('attendance')
          .select('date, status, student_id')
          .eq('student_id', studentId)
          .gte('date', firstDayOfMonth)
          .lte('date', lastDayOfMonth);

        if (attError) throw attError;

        const { data: noteData, error: noteError } = await supabase
          .from('notes')
          .select('date, money, student_id')
          .eq('student_id', studentId)
          .gte('date', firstDayOfMonth)
          .lte('date', lastDayOfMonth);

        if (noteError) throw noteError;

        const presentDays = (attendanceData || []).filter(a => {
          return a.status === 'Có mặt' || a.status === true;
        }).length;

        const sessionMoney = presentDays * 50000;
        const totalNotesMoney = (noteData || []).reduce((sum, n) => sum + (Number(n.money) || 0), 0);
        const totalMonth = sessionMoney + totalNotesMoney;

        setMonthMoney(totalMonth);
      } catch (error) {
        console.error('❌ Error:', error);
        setMonthMoney(0);
      } finally {
        setLoading(false);
      }
    };

    fetchMonthMoney();
  }, [studentId, selectedDate, refreshTrigger]);

  return (
    <div style={{ 
      fontSize: '11px', 
      marginTop: '4px', 
      fontWeight: '600', 
      color: '#059669',
      minHeight: '18px'
    }}>
      {loading ? '⏳ ...' : `💰 ${monthMoney.toLocaleString('vi-VN')}đ`}
    </div>
  );
};

function App() {
  const [students, setStudents] = useState([]);
  const [newName, setNewName] = useState('');
  const [attendanceList, setAttendanceList] = useState([]);
  const [notes, setNotes] = useState([]);
  const [now, setNow] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [loadingId, setLoadingId] = useState(null);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedExportStudents, setSelectedExportStudents] = useState([]);
  const [searchStudent, setSearchStudent] = useState('');
  const today = selectedDate;
  const [selectAll, setSelectAll] = useState(false);
  const [showSearchBox, setShowSearchBox] = useState(false);
  const filterRef = useRef(null);
  const [noteContent, setNoteContent] = useState('');
  const [noteMoney, setNoteMoney] = useState(''); // ✅ SỬA: dùng string rỗng thay vì 0
  const [fromDate, setFromDate] = useState(new Date().toISOString().split('T')[0]);
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [user, setUser] = useState(null)
  const displayName = () => {
  if (user?.email === 'truclinh@gmail.com') {
    return 'cô Trúc Linh'
  }
  return user?.email?.split('@')[0] || 'Giáo viên'
}

  const formatDate = () => {
    const days = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
    return `${days[now.getDay()]}, ngày ${now.getDate()} tháng ${now.getMonth() + 1} năm ${now.getFullYear()}`;
  };

  const formatTime = () => {
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const fetchData = async () => {
    try {
      const { data: stdData } = await supabase.from('students').select('*').order('id', { ascending: true });
      if (stdData) setStudents(stdData);

      const { data: attData } = await supabase.from('attendance').select('student_id').eq('date', today);
      if (attData) setAttendanceList([...new Set(attData.map(item => item.student_id))]);

      const { data: noteData } = await supabase.from('notes').select('*, students(name)').eq('date', today);
      if (noteData) setNotes(noteData);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  useEffect(() => {
  supabase.auth.getSession().then(({ data }) => {
    setUser(data.session?.user || null)
  })
}, [])

  useEffect(() => {
    fetchData();
  }, [selectedDate]);

  useEffect(() => {
    setFromDate(selectedDate);
    setToDate(selectedDate);
  }, [selectedDate]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filterRef.current && !filterRef.current.contains(event.target)) {
        setShowSearchBox(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);
if (!user) {
  return <Login onLogin={setUser} />
}
  const exportToExcel = async () => {
    try {
      const { data: attendanceData } = await supabase
        .from('attendance')
        .select('date, status, student_id, students(name)')
        .gte('date', fromDate)
        .lte('date', toDate);

      const { data: studentData } = await supabase.from('students').select('id, name');

      const studentMap = {};
      studentData.forEach(s => {
        studentMap[s.id] = s.name;
      });

      const report = attendanceData.map(a => ({
        "Ngày": a.date,
        "Học sinh": studentMap[a.student_id],
        "Trạng thái": a.status ? "Có mặt" : "Vắng"
      }));

      const worksheet = XLSX.utils.json_to_sheet(report);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "BaoCao");
      XLSX.writeFile(workbook, `Bao_Cao_${fromDate}_den_${toDate}.xlsx`);
    } catch (err) {
      console.log("exportToExcel error:", err);
      alert("Lỗi khi xuất file: " + err.message);
    }
  };

  const exportMonth = async () => {
    try {
      const month = fromDate.slice(0, 7);

      const { data } = await supabase
        .from('attendance')
        .select('date, status, student_id')
        .like('date', `${month}%`);

      const { data: studentsData } = await supabase.from('students').select('id, name');
      const { data: notesData } = await supabase
        .from('notes')
        .select('student_id, money, date')
        .like('date', `${month}%`);

      const map = {};
      studentsData.forEach(s => map[s.id] = s.name);

      let totalMonth = 0;

      const report = data.map(d => {
        const noteMoney = notesData
          .filter(n => n.student_id === d.student_id && n.date === d.date)
          .reduce((sum, n) => sum + (n.money || 0), 0);

        const sessionMoney = d.status ? 50000 : 0;
        totalMonth += sessionMoney + noteMoney;

        return {
          "Ngày": d.date,
          "Học sinh": map[d.student_id],
          "Trạng thái": d.status ? "Có mặt" : "Vắng",
          "Tiền buổi học": sessionMoney,
          "Tiền phát sinh": noteMoney
        };
      });

      report.push({
        "Ngày": "TỔNG",
        "Học sinh": "",
        "Trạng thái": "",
        "Tiền buổi học": "",
        "Tiền phát sinh": totalMonth
      });

      const ws = XLSX.utils.json_to_sheet(report);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Thang");
      XLSX.writeFile(wb, `Bao_Cao_Thang_${month}.xlsx`);
    } catch (err) {
      console.log("exportMonth error:", err);
      alert("Lỗi khi xuất file: " + err.message);
    }
  };

  const handleAddStudent = async () => {
    if (!newName) return;
    try {
      await supabase.from('students').insert([{ name: newName }]);
      setNewName('');
      fetchData();
    } catch (error) {
      console.error('Error adding student:', error);
    }
  };

  const handleAttendance = async (studentId) => {
    setLoadingId(studentId);

    try {
      const { data } = await supabase
        .from('attendance')
        .select('*')
        .eq('student_id', studentId)
        .eq('date', today);

      if (data.length === 0) {
        await supabase.from('attendance').insert([
          { student_id: studentId, date: today, status: true }
        ]);
      }

      await fetchData();
      setRefreshTrigger(t => t + 1);
    } catch (error) {
      console.error('Error marking attendance:', error);
    } finally {
      setLoadingId(null);
    }
  };

  const handleUncheck = async (studentId) => {
    setLoadingId(studentId);

    try {
      await supabase
        .from('attendance')
        .delete()
        .eq('student_id', studentId)
        .eq('date', today);

      await fetchData();
      setRefreshTrigger(t => t + 1);
    } catch (error) {
      console.error('Error unchecking attendance:', error);
    } finally {
      setLoadingId(null);
    }
  };

  const handleSaveNote = async () => {
    if (!selectedStudentId) return;

    try {
      await supabase.from('notes').insert([{
        student_id: selectedStudentId,
        content: noteContent,
        money: Number(noteMoney) || 0,
        date: selectedDate
      }]);

      setNoteContent('');
      setNoteMoney(''); // ✅ SỬA: reset về string rỗng thay vì 0
      setSelectedStudentId('');
      fetchData();
      setRefreshTrigger(t => t + 1);
    } catch (error) {
      console.error('Error saving note:', error);
    }
  };

  const theme = {
    bg: '#FFFDF0',
    fontCreative: "'Comfortaa', cursive",
    addCard: '#E0F2FE',
    addBtn: '#0EA5E9',
    noteCard: '#F5F3FF',
    noteBtn: '#8B5CF6',
    attendanceBtn: '#FFF7ED',
    presentBtn: '#4ADE80',
    textDark: '#334155',
    scrollbarThumb: '#FDA085',
    scrollbarTrack: '#FFF1F2'
  };

  const cardBase = {
    padding: '25px',
    borderRadius: '35px',
    boxShadow: '0 10px 25px rgba(0,0,0,0.04)',
    border: 'none',
  };

  const inputBase = {
    width: '100%',
    padding: '15px',
    borderRadius: '20px',
    border: '2px solid #E2E8F0',
    background: '#FFFFFF',
    fontSize: '15px',
    outline: 'none',
    fontWeight: '600',
    color: theme.textDark,
    fontFamily: theme.fontCreative
  };

  const handleDeleteStudent = async (id) => {
    if (!window.confirm("Xoá học sinh này?")) return;
    try {
      await supabase.from('students').delete().eq('id', id);
      fetchData();
    } catch (error) {
      console.error('Error deleting student:', error);
    }
  };

  const exportToday = async () => {
    try {
      const { data } = await supabase
        .from('attendance')
        .select('date, status, student_id, students(name)')
        .eq('date', selectedDate);

      const report = (data || []).map(d => ({
        "Ngày": d.date,
        "Học sinh": d.students?.name,
        "Trạng thái": d.status ? "Có mặt" : "Vắng"
      }));

      const ws = XLSX.utils.json_to_sheet(report);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "HomNay");
      XLSX.writeFile(wb, `Bao_Cao_Hom_Nay_${selectedDate}.xlsx`);
    } catch (err) {
      console.log("exportToday error:", err);
      alert("Lỗi khi xuất file: " + err.message);
    }
  };

  // ✅ NEW: Export range với tổng buổi + tổng tiền
  const exportRange = async () => {
    try {
      const year = fromDate.slice(0, 4);
      const month = fromDate.slice(5, 7);
      const firstDayOfMonth = `${year}-${month}-01`;

      const { data: attendanceData } = await supabase
        .from('attendance')
        .select('date, status, student_id')
        .gte('date', fromDate)
        .lte('date', toDate);

      const { data: noteData } = await supabase
        .from('notes')
        .select('student_id, date, content, money')
        .gte('date', fromDate)
        .lte('date', toDate);

      const { data: studentsData } = await supabase.from('students').select('id, name');

      // ✅ Lấy dữ liệu từ đầu tháng để tính tổng buổi
      const { data: attendanceDataFromMonthStart } = await supabase
        .from('attendance')
        .select('date, status, student_id')
        .gte('date', firstDayOfMonth)
        .lte('date', toDate);

      const { data: noteDataFromMonthStart } = await supabase
        .from('notes')
        .select('student_id, date, money')
        .gte('date', firstDayOfMonth)
        .lte('date', toDate);

      const attendanceMap = {};
      (attendanceData || []).forEach(a => {
        attendanceMap[`${a.student_id}_${a.date}`] = a.status;
      });

      const noteMap = {};
      (noteData || []).forEach(n => {
        noteMap[`${n.student_id}_${n.date}`] = {
          content: n.content,
          money: n.money || 0
        };
      });

      const dates = [];
      let current = new Date(fromDate);

      while (current <= new Date(toDate)) {
        dates.push(current.toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
      }

      const report = [];
      const studentTotals = {};

      dates.forEach(date => {
        studentsData
          .filter(student =>
            selectedExportStudents.length === 0 ||
            selectedExportStudents.includes(String(student.id))
          )
          .forEach(student => {
            const key = `${student.id}_${date}`;

            const sessionMoney = (attendanceMap[key] ? 50000 : 0);
            const extraMoney = noteMap[key]?.money || 0;
            const totalMoney = sessionMoney + extraMoney;

            if (!studentTotals[student.id]) {
              studentTotals[student.id] = {
                name: student.name,
                total: 0,
                totalSessions: 0
              };
            }
            studentTotals[student.id].total += totalMoney;

            const formattedExtraMoney = extraMoney > 0 ? extraMoney.toLocaleString('vi-VN') : "";
            const formattedSessionMoney = sessionMoney > 0 ? sessionMoney.toLocaleString('vi-VN') : "";
            const formattedTotalMoney = totalMoney > 0 ? totalMoney.toLocaleString('vi-VN') : "";

            report.push({
              "Ngày": date,
              "Học sinh": student.name,
              "Trạng thái": attendanceMap[key] ? "Có mặt" : "Vắng",
              "Ghi chú": noteMap[key]?.content || "",
              "Tiền phát sinh": formattedExtraMoney,
              "Tiền buổi học": formattedSessionMoney,
              "Tổng cộng": formattedTotalMoney
            });
          });
      });

      report.push({
        "Ngày": "",
        "Học sinh": "",
        "Trạng thái": "",
        "Ghi chú": "━━━━━━━━━",
        "Tiền phát sinh": "",
        "Tiền buổi học": "",
        "Tổng cộng": ""
      });

      // ✅ Tính tổng buổi và tổng tiền từ đầu tháng
      const studentSummary = {};
      studentsData.forEach(student => {
        if (selectedExportStudents.length === 0 || selectedExportStudents.includes(String(student.id))) {
          // Tính tổng buổi từ đầu tháng
          const totalSessions = (attendanceDataFromMonthStart || []).filter(a => 
            a.student_id === student.id && (a.status === 'Có mặt' || a.status === true)
          ).length;

          // Tính tổng tiền từ đầu tháng
          const sessionMoney = totalSessions * 50000;
          const totalNotesMoney = (noteDataFromMonthStart || [])
            .filter(n => n.student_id === student.id)
            .reduce((sum, n) => sum + (n.money || 0), 0);

          studentSummary[student.id] = {
            name: student.name,
            totalSessions,
            totalMoneyFromMonthStart: sessionMoney + totalNotesMoney
          };
        }
      });

      // ✅ Thêm tóm tắt theo học sinh
      report.push({
        "Ngày": "",
        "Học sinh": "═════════════════════",
        "Trạng thái": "",
        "Ghi chú": "",
        "Tiền phát sinh": "",
        "Tiền buổi học": "",
        "Tổng cộng": ""
      });

      report.push({
        "Ngày": "TÓMLẠI TỪNG HỌC SINH",
        "Học sinh": "Tên",
        "Trạng thái": "Buổi (1-nay)",
        "Ghi chú": "Tổng tiền (1-nay)",
        "Tiền phát sinh": "",
        "Tiền buổi học": "",
        "Tổng cộng": ""
      });

      Object.values(studentSummary).forEach(summary => {
        report.push({
          "Ngày": "",
          "Học sinh": summary.name,
          "Trạng thái": `${summary.totalSessions} buổi`,
          "Ghi chú": `${summary.totalMoneyFromMonthStart.toLocaleString('vi-VN')}đ`,
          "Tiền phát sinh": "",
          "Tiền buổi học": "",
          "Tổng cộng": ""
        });
      });

      report.push({
        "Ngày": "",
        "Học sinh": "",
        "Trạng thái": "",
        "Ghi chú": "",
        "Tiền phát sinh": "",
        "Tiền buổi học": "",
        "Tổng cộng": ""
      });

      const totalMoney = Object.values(studentTotals).reduce((sum, s) => sum + s.total, 0);

      report.push({
        "Ngày": "TỔNG CỘNG",
        "Học sinh": "",
        "Trạng thái": "",
        "Ghi chú": "",
        "Tiền phát sinh": "",
        "Tiền buổi học": "",
        "Tổng cộng": totalMoney > 0 ? totalMoney.toLocaleString('vi-VN') : ""
      });

      const ws = XLSX.utils.json_to_sheet(report);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "BaoCao");

      const isSameMonth = fromDate.slice(0, 7) === toDate.slice(0, 7);

      if (isSameMonth) {
        XLSX.writeFile(wb, `Bao_Cao_Thang_${fromDate.slice(0, 7)}.xlsx`);
      } else {
        XLSX.writeFile(wb, `Bao_Cao_${fromDate}_den_${toDate}.xlsx`);
      }

    } catch (err) {
      console.log("exportRange error:", err);
      alert("Lỗi khi xuất file: " + err.message);
    }
  };

  return (
    <div style={{
      padding: '15px',
      maxWidth: '1100px',
      margin: 'auto',
      fontFamily: theme.fontCreative,
      backgroundColor: theme.bg,
      minHeight: '100vh',
      color: theme.textDark
    }}>
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Comfortaa:wght@300;400;500;600;700&display=swap');

          ::-webkit-scrollbar {
            width: 10px;
          }
          ::-webkit-scrollbar-track {
            background: ${theme.scrollbarTrack};
            border-radius: 10px;
          }
          ::-webkit-scrollbar-thumb {
            background: ${theme.scrollbarThumb};
            border-radius: 10px;
            border: 2px solid ${theme.scrollbarTrack};
          }
          ::-webkit-scrollbar-thumb:hover {
            background: #F6D365;
          }

          .student-card {
            position: relative;
          }

          .delete-btn {
            opacity: 0;
            transform: scale(0.7);
            transition: all 0.2s ease;
          }

          @media (max-width: 768px) {
            .delete-btn {
              opacity: 1 !important;
              transform: scale(1) !important;
            }
          }

          .delete-btn.disabled {
            opacity: 0.4 !important;
            cursor: not-allowed !important;
          }

          input[type="checkbox"] {
            appearance: none;
            -webkit-appearance: none;
            width: 16px;
            height: 16px;
            border: 1px solid #424040;
            background-color: #fff;
            border-radius: 4px;
            cursor: pointer;
            display: inline-block;
            position: relative;
          }

          input[type="checkbox"]:checked {
            background-color: #22C55E;
            border-color: #22C55E;
          }

          input[type="checkbox"]:checked::after {
            content: "✓";
            position: absolute;
            color: white;
            font-size: 12px;
            left: 2px;
            top: -1px;
          }

          .student-card:hover .delete-btn {
            opacity: 1;
            transform: scale(1);
          }
        `}
      </style>

      <header style={{
        textAlign: 'center',
        marginBottom: '35px',
        padding: '60px 20px',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: '45px',
        boxShadow: '0 20px 40px rgba(118, 75, 162, 0.3)',
        color: '#FFFFFF',
        position: 'relative'
      }}>
        <div style={{
          fontSize: '60px',
          marginBottom: '10px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '15px',
          filter: 'drop-shadow(0 10px 15px rgba(0,0,0,0.2))'
        }}>
          <span style={{ transform: 'rotate(-10deg)' }}>🦉</span>
          <span style={{ fontSize: '75px' }}>✨📖✨</span>
          <span style={{ transform: 'rotate(10deg)' }}>✏️</span>
        </div>

        <h1 style={{
          fontSize: 'clamp(32px, 9vw, 56px)',
          marginTop: '20px',
          marginBottom: '0',
          fontWeight: '800',
          textTransform: 'uppercase',
          letterSpacing: '2px',
          lineHeight: '1.2',
          background: 'linear-gradient(90deg, #ffffff 0%, #ffeaa7 35%, #ff6bcb 70%, #fff 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          filter: 'drop-shadow(0 6px 12px rgba(0,0,0,0.25))'
        }}>
          Trúc Linh
        </h1>
<p style={{
  position: 'absolute',
  top: 15,
  left: 20,
  fontSize: 16,
  fontWeight: 600,
  color: '#fde047',
  textShadow: '0 2px 6px rgba(0,0,0,0.3)',
  margin: 0,
  zIndex: 1000
}}>
  Xin chào {displayName()} 👋
</p>
        <div style={{ marginTop: '10px' }}>
          <p style={{
            fontSize: '14px',
            fontWeight: '700',
            letterSpacing: '7px',
            opacity: 0.9,
            background: 'rgba(255,255,255,0.2)',
            display: 'inline-block',
            padding: '8px 25px',
            borderRadius: '50px',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.3)'
          }}>EDUCATION CENTER</p>
          <p style={{
            marginTop: '10px',
            fontSize: '15px',
            fontWeight: '800',
            background: 'linear-gradient(90deg, #ffffff 0%, #ffe066 40%, #fffbe6 70%, #ffffff 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '1px',
            textShadow: '0 3px 10px rgba(0,0,0,0.25)'
          }}>
            {formatDate()}
          </p>
          <div style={{
            marginTop: '18px',
            display: 'flex',
            justifyContent: 'center'
          }}>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{
                padding: '14px 26px',
                borderRadius: '40px',
                border: '2px solid rgba(255,255,255,0.5)',
                fontWeight: '700',
                fontFamily: theme.fontCreative,
                fontSize: '15px',
                background: 'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)',
                color: '#4C1D95',
                boxShadow: '0 10px 25px rgba(0,0,0,0.25)',
                backdropFilter: 'blur(10px)',
                cursor: 'pointer',
                outline: 'none',
                textAlign: 'center',
                transition: 'all 0.3s ease'
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = 'scale(1.05)';
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'scale(1)';
              }}
            />
          </div>
        </div>
      <div style={{
  position: 'absolute',
  top: 20,
  right: 20
}}>
  <button
    onClick={async () => {
      await supabase.auth.signOut()
      setUser(null)
    }}
    style={{
      padding: '8px 12px',
      background: '#ef4444',
      color: '#fff',
      border: 'none',
      borderRadius: '10px',
      cursor: 'pointer'
    }}
  >
    Logout
  </button>
</div></header>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '15px',
        marginBottom: '30px'
      }}>
        <div style={{ ...cardBase, background: '#E0F2FE', border: '2px solid #6a757a' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#0369A1' }}>TỔNG SỐ</div>
          <div style={{ fontSize: '32px', fontWeight: '700', color: '#0284C7' }}>{students.length}</div>
        </div>
        <div style={{ ...cardBase, background: '#F0FDF4', border: '2px solid #BBF7D0' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#166534' }}>CÓ MẶT</div>
          <div style={{ fontSize: '32px', fontWeight: '700', color: '#16A34A' }}>{attendanceList.length}</div>
        </div>
        <div style={{ ...cardBase, background: '#FEF2F2', border: '2px solid #FECACA' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#991B1B' }}>VẮNG</div>
          <div style={{ fontSize: '32px', fontWeight: '700', color: '#DC2626' }}>{students.length - attendanceList.length}</div>
        </div>
      </div>

      <div style={{ ...cardBase, backgroundColor: '#FFFFFF', marginBottom: '30px' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '15px',
          flexWrap: 'wrap',
          gap: '10px'
        }}>

          <h3 style={{
            margin: 0,
            color: '#F43F5E',
            fontSize: '20px',
            fontWeight: '700'
          }}>
            🎓 Lớp mình
          </h3>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexWrap: 'nowrap'
          }}>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              style={{
                padding: '4px 10px',
                borderRadius: '25px',
                border: '2px solid rgba(0,0,0,0.1)',
                fontWeight: '600',
                fontFamily: theme.fontCreative,
                fontSize: '11px',
                width: '90px',
                background: 'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)',
                color: '#4C1D95',
                boxShadow: '0 3px 6px rgba(0,0,0,0.1)',
                outline: 'none',
                cursor: 'pointer'
              }}
            />

            <span style={{
              fontWeight: '900',
              fontSize: '16px',
              color: '#6366F1'
            }}>
              →
            </span>

            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              style={{
                padding: '4px 10px',
                borderRadius: '25px',
                border: '2px solid rgba(0,0,0,0.1)',
                fontWeight: '600',
                fontFamily: theme.fontCreative,
                fontSize: '11px',
                width: '90px',
                background: 'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)',
                color: '#4C1D95',
                boxShadow: '0 3px 6px rgba(0,0,0,0.1)',
                outline: 'none',
                cursor: 'pointer'
              }}
            />
          </div>

          <div ref={filterRef} style={{
            position: 'relative',
          }}>
            <div style={{
              position: 'relative',
              width: '100%'
            }}>

              <div
                onClick={() => setShowSearchBox(!showSearchBox)}
                onMouseEnter={(e) => {
                  e.target.style.background = '#E2E8F0';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = '#F1F5F9';
                }}
                style={{
                  padding: '4px 6px',
                  borderRadius: '25px',
                  fontWeight: '600',
                  fontFamily: theme.fontCreative,
                  fontSize: '10px',
                  width: '90px',
                  background: '#F1F5F9',
                  color: '#334155',
                  border: '2px solid #E2E8F0',
                  boxShadow: '0 3px 6px rgba(0,0,0,0.08)',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.2s ease'
                }}
              >
                🔍 ({selectedExportStudents.length})
              </div>

              {showSearchBox && (
                <div style={{
                  position: 'absolute',
                  top: '38px',
                  left: 0,
                  width: '180px',
                  background: '#ffffffee',
                  border: '2px solid #E2E8F0',
                  borderRadius: '16px',
                  padding: '10px',
                  zIndex: 10,
                  maxHeight: '220px',
                  overflowY: 'auto',
                  backdropFilter: 'blur(10px)',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
                }}>

                  <input
                    type="text"
                    placeholder="🔍 Tìm học sinh..."
                    value={searchStudent}
                    onChange={(e) => setSearchStudent(e.target.value)}
                    style={{
                      width: '100%',
                      marginBottom: '8px',
                      padding: '8px',
                      borderRadius: '10px',
                      border: '1px solid #CBD5F5',
                      background: '#F8FAFC',
                      color: '#334155'
                    }}
                  />

                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    marginBottom: '6px',
                    fontWeight: '700',
                    fontSize: '14px'
                  }}>
                    <input
                      type="checkbox"
                      checked={selectAll}
                      onChange={() => {
                        if (selectAll) {
                          setSelectedExportStudents([]);
                        } else {
                          setSelectedExportStudents(students.map(s => String(s.id)));
                        }
                        setSelectAll(!selectAll);
                      }}
                    />
                    {' '}Chọn tất cả
                  </label>

                  {students
                    .filter(s =>
                      !searchStudent ||
                      s.name.toLowerCase().includes(searchStudent.toLowerCase())
                    )
                    .map(s => (
                      <label
                        key={s.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '13px',
                          marginBottom: '4px'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedExportStudents.includes(String(s.id))}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedExportStudents([
                                ...selectedExportStudents,
                                String(s.id)
                              ]);
                            } else {
                              setSelectedExportStudents(
                                selectedExportStudents.filter(id => id !== String(s.id))
                              );
                              setSelectAll(false);
                            }
                          }}
                          style={{
                            width: '16px',
                            height: '16px',
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                        />
                        {' '}{s.name}
                      </label>
                    ))}

                </div>
              )}

            </div>

          </div>
          <button
            onClick={exportRange}
            style={{
              padding: '10px 20px',
              background: '#2563EB',
              color: '#fff',
              border: 'none',
              borderRadius: '25px',
              fontWeight: '700',
              cursor: 'pointer',
              fontFamily: theme.fontCreative
            }}
          >
            📊 Xuất File
          </button>

        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
          gap: '15px',
          maxHeight: '450px',
          overflowY: 'auto',
          padding: '10px'
        }}>
          {students.map(s => {
            const isPresent = attendanceList.includes(s.id);

            return (
              <div key={s.id} className="student-card">

                <button
                  disabled={loadingId === s.id}
                  onClick={() => isPresent ? handleUncheck(s.id) : handleAttendance(s.id)}
                  style={{
                    padding: '20px 10px',
                    borderRadius: '25px',
                    border: 'none',
                    background: isPresent ? theme.presentBtn : theme.attendanceBtn,
                    color: isPresent ? '#fff' : '#C2410C',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    boxShadow: isPresent ? '0 8px 15px rgba(74, 222, 128, 0.3)' : '0 4px 6px rgba(0,0,0,0.02)',
                    transform: isPresent ? 'translateY(-3px)' : 'none',
                    width: '100%'
                  }}
                >
                  <div style={{ fontWeight: '700', fontSize: '14px' }}>
                    {s.name}
                  </div>

                  <StudentMonthMoney 
                    studentId={s.id} 
                    selectedDate={selectedDate} 
                    refreshTrigger={refreshTrigger} 
                  />

                  <div style={{ fontSize: '9px', marginTop: '5px' }}>
                    {isPresent ? 'Có mặt' : 'Vắng'}
                  </div>
                </button>

                <span
                  className={`delete-btn ${attendanceList.includes(s.id) ? 'disabled' : ''}`}
                  onClick={() => {
                    if (attendanceList.includes(s.id)) return;
                    handleDeleteStudent(s.id);
                  }}
                  style={{
                    position: 'absolute',
                    top: 6,
                    right: 6,
                    cursor: 'pointer',
                    fontSize: '10px',
                    color: '#ef4444',
                    background: '#ffffffcc',
                    borderRadius: '50%',
                    padding: '3px 5px',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
                  }}
                >
                  ✕
                </span>

              </div>
            );
          })}
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '25px'
      }}>
        <div style={{ ...cardBase, backgroundColor: '#EFF6FF' }}>
          <h4 style={{ margin: '0 0 15px 0', color: '#1D4ED8', fontSize: '18px' }}>🍎 Thêm bạn mới</h4>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input style={inputBase} type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Tên của bé..." />
            <button onClick={handleAddStudent} style={{
              padding: '0 25px',
              background: '#3B82F6',
              color: '#fff',
              border: 'none',
              borderRadius: '20px',
              fontWeight: '700',
              cursor: 'pointer',
              fontFamily: theme.fontCreative
            }}>THÊM</button>
          </div>
        </div>
        <div style={{ ...cardBase, backgroundColor: '#FAF5FF' }}>
          <h4 style={{ margin: '0 0 15px 0', color: '#7E22CE', fontSize: '18px' }}>📝 Nhật ký hôm nay</h4>
          <select style={{ ...inputBase, marginBottom: '10px' }} value={selectedStudentId} onChange={(e) => setSelectedStudentId(e.target.value)}>
            <option value="">-- Chọn tên bé --</option>
            {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <textarea style={{ ...inputBase, height: '80px', resize: 'none' }} value={noteContent} onChange={(e) => setNoteContent(e.target.value)} placeholder="Lời nhắn cho phụ huynh..." />
          <input
            type="number"
            value={noteMoney}
            onChange={(e) => setNoteMoney(e.target.value)} // ✅ SỬA: không ép kiểu Number, giữ string
            placeholder="Tiền phát sinh"
            style={{
              ...inputBase,
              marginTop: '10px',
              height: '40px'
            }}
          />
          <button onClick={handleSaveNote} style={{
            width: '100%',
            marginTop: '10px',
            padding: '15px',
            background: '#A855F7',
            color: '#fff',
            border: 'none',
            borderRadius: '20px',
            fontWeight: '700',
            cursor: 'pointer',
            fontFamily: theme.fontCreative
          }}>LƯU GHI CHÚ 💖</button>
        </div>
      </div>

      <footer style={{
        textAlign: 'center',
        marginTop: '60px',
        paddingBottom: '40px',
        color: '#94A3B8',
        fontSize: '13px',
        fontWeight: '600'
      }}>

        <div style={{ marginBottom: '10px' }}>
          🦉 TRÚC LINH EDUCATION CENTER • {new Date().getFullYear()} ✨📖
        </div>

        <div style={{
          fontSize: '18px',
          fontWeight: '700',
          letterSpacing: '2px',
          color: '#F97316',
          textShadow: '0 3px 8px rgba(0,0,0,0.3)'
        }}>
          🕒 {formatTime()}
        </div>

      </footer>
    </div>
  );
}

export default App;
