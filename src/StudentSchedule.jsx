import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

// ✅ FIX #1: Kiểm tra lịch học có học sinh hôm nay
export const getStudentsScheduledToday = async (students, selectedDate) => {
  try {
    const dayOfWeek = new Date(selectedDate).getDay();
    const { data: scheduleData } = await supabase
      .from('student_schedules')
      .select('student_id')
      .eq('day_of_week', dayOfWeek);
    
    const scheduledIds = new Set((scheduleData || []).map(s => s.student_id));
    return students.filter(s => scheduledIds.has(s.id));
  } catch (error) {
    console.error('Error getting today\'s students:', error);
    return students;
  }
};

function StudentSchedule({ students, onClose }) {
  const [schedules, setSchedules] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalHovered, setIsModalHovered] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 700);

  // ✅ FIX: Đổi thứ tự - bắt đầu từ Thứ Hai (1) kết thúc Chủ Nhật (0)
  const days = [
    { id: 1, name: 'Thứ Hai', label: 'T2' },
    { id: 2, name: 'Thứ Ba', label: 'T3' },
    { id: 3, name: 'Thứ Tư', label: 'T4' },
    { id: 4, name: 'Thứ Năm', label: 'T5' },
    { id: 5, name: 'Thứ Sáu', label: 'T6' },
    { id: 6, name: 'Thứ Bảy', label: 'T7' },
    { id: 0, name: 'Chủ Nhật', label: 'CN' }
  ];

  useEffect(() => {
    fetchSchedules();
  }, []);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 700);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const fetchSchedules = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('student_schedules').select('*');
      if (error) throw error;
      const schedulesMap = {};
      (data || []).forEach(schedule => {
        const key = `${schedule.student_id}_${schedule.day_of_week}`;
        schedulesMap[key] = schedule.id;
      });
      setSchedules(schedulesMap);
    } catch (error) {
      console.error('Error fetching schedules:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSchedule = async (studentId, dayOfWeek) => {
    const key = `${studentId}_${dayOfWeek}`;
    const scheduleId = schedules[key];

    try {
      if (scheduleId) {
        // DELETE nếu đã có
        const { error: deleteError } = await supabase.from('student_schedules').delete().eq('id', scheduleId);
        if (deleteError) throw deleteError;
        const newSchedules = { ...schedules };
        delete newSchedules[key];
        setSchedules(newSchedules);
      } else {
        // ✅ FIX #1: Kiểm tra xem có lịch cũ chưa? Nếu có thì xóa rồi thêm mới
        // (Tránh duplicate key constraint violation)
        const { data: existingSchedule, error: findError } = await supabase
          .from('student_schedules')
          .select('id')
          .eq('student_id', studentId)
          .eq('day_of_week', dayOfWeek)
          .maybeSingle();

        if (findError) throw findError;

        if (existingSchedule) {
          // Xóa lịch cũ nếu vô tình còn
          const { error: cleanupError } = await supabase.from('student_schedules').delete().eq('id', existingSchedule.id);
          if (cleanupError) throw cleanupError;
        }

        // INSERT lịch mới
        const { data: insertedSchedule, error } = await supabase
          .from('student_schedules')
          .insert([
            {
              student_id: studentId,
              day_of_week: dayOfWeek
            }
          ])
          .select('id')
          .single();

        if (error) {
          // Nếu vẫn lỗi duplicate, thì làm refresh lại dữ liệu
          if (error.code === '23505') {
            console.warn('Duplicate key detected, refreshing schedules...');
            await fetchSchedules();
            return;
          }
          throw error;
        }

        // UPDATE schedules state
        setSchedules({
          ...schedules,
          [key]: insertedSchedule?.id // Lưu đúng ID để bấm xóa ngay vẫn hoạt động
        });
      }
    } catch (error) {
      alert('Lỗi lưu lịch học: ' + error.message);
      console.error('Error toggling schedule:', error);
      // Refresh dữ liệu sau lỗi
      await fetchSchedules();
    }
  };

  const filteredStudents = students.filter(student =>
    student.name.toLowerCase().includes(searchTerm.toLowerCase().trim())
  );

  const getScheduledCount = (studentId) =>
    days.filter(day => !!schedules[`${studentId}_${day.id}`]).length;

  if (loading) {
    return (
      <div style={{
        position: 'fixed', inset: 0, background: 'rgba(15,23,42,.52)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
      }}>
        <div style={{
          background: '#fff', borderRadius: 20, padding: 40,
          textAlign: 'center', fontWeight: 700, fontSize: 16
        }}>
          ⏳ Đang tải...
        </div>
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      padding: '16px'
    }} onClick={onClose}>
      <div style={{
        background: 'linear-gradient(180deg, #ffffff 0%, #f8f7ff 100%)',
        borderRadius: 28, padding: isMobile ? '20px 14px' : '28px 22px',
        maxHeight: '85vh', overflowY: 'auto', maxWidth: '760px', width: '100%',
        boxShadow: '0 20px 60px rgba(108,99,255,.25)',
        border: '1px solid #e5e7eb'
      }} onClick={(e) => e.stopPropagation()} onMouseEnter={() => setIsModalHovered(true)} onMouseLeave={() => setIsModalHovered(false)}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 14, borderBottom: '2px solid #efedff', paddingBottom: 14
        }}>
          <div>
            <h2 style={{
              fontFamily: "'Nunito', sans-serif", fontSize: 22, fontWeight: 900,
              color: '#1a1d2e', margin: 0
            }}>📅 Lịch học trong tuần</h2>
            <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 12, fontWeight: 700 }}>Sắp xếp từ Thứ Hai đến Chủ Nhật • Bấm vào từng ngày để bật/tắt lịch học</p>
          </div>
          <button onClick={onClose} style={{
            background: isModalHovered ? '#fee2e2' : 'transparent',
            border: isModalHovered ? '1px solid #fca5a5' : '1px solid transparent',
            fontSize: 24, cursor: 'pointer', padding: '0 8px',
            borderRadius: 10,
            opacity: isModalHovered ? 1 : 0.35,
            color: isModalHovered ? '#dc2626' : '#7f1d1d',
            transition: 'all .2s ease'
          }}>✕</button>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr auto',
          gap: 10,
          marginBottom: 16,
          alignItems: 'center'
        }}>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="🔎 Lọc học sinh theo tên..."
            style={{
              width: '100%',
              padding: '11px 14px',
              borderRadius: 12,
              border: '1.5px solid #ddd6fe',
              background: '#fff',
              fontSize: 13,
              fontWeight: 600,
              color: '#312e81',
              outline: 'none'
            }}
          />
          <div style={{
            padding: '9px 12px',
            borderRadius: 999,
            background: '#eef2ff',
            border: '1.5px solid #c7d2fe',
            fontSize: 12,
            fontWeight: 800,
            color: '#4f46e5',
            whiteSpace: 'nowrap'
          }}>
            👥 {filteredStudents.length} học sinh
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {filteredStudents.length === 0 && (
            <div style={{
              textAlign: 'center',
              background: '#fff',
              border: '1.5px dashed #d8b4fe',
              borderRadius: 16,
              padding: '20px 12px',
              color: '#7c3aed',
              fontWeight: 700
            }}>
              Không tìm thấy học sinh phù hợp
            </div>
          )}

          {filteredStudents.map(student => (
            <div key={student.id} style={{
              background: '#fff', borderRadius: 16, padding: '16px',
              border: '1.5px solid #e8ecf4',
              boxShadow: '0 6px 18px rgba(76, 63, 160, 0.08)',
              transition: 'transform .15s, box-shadow .15s'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <p style={{
                  fontWeight: 800, fontSize: 14,
                  color: '#6c63ff', fontFamily: "'Nunito', sans-serif",
                  margin: 0
                }}>
                  🎓 {student.name}
                </p>
                <span style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: '#059669',
                  background: '#dcfce7',
                  border: '1px solid #86efac',
                  borderRadius: 999,
                  padding: '4px 10px',
                  whiteSpace: 'nowrap'
                }}>
                  {getScheduledCount(student.id)}/7 buổi
                </span>
              </div>
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
                gap: isMobile ? 6 : 8
              }}>
                {days.map(day => {
                  const isScheduled = !!schedules[`${student.id}_${day.id}`];
                  return (
                    <button
                      key={day.id}
                      onClick={() => toggleSchedule(student.id, day.id)}
                      title={day.name}
                      style={{
                        padding: isMobile ? '8px 4px' : '10px 8px', borderRadius: 12, border: '2px solid',
                        fontWeight: 700, fontSize: isMobile ? 11 : 12, cursor: 'pointer',
                        fontFamily: "'Quicksand', sans-serif",
                        transition: 'all .2s',
                        background: isScheduled 
                          ? 'linear-gradient(135deg,#22C55E 0%,#16A34A 100%)' 
                          : '#fff',
                        borderColor: isScheduled ? '#16a34a' : '#e8ecf4',
                        color: isScheduled ? '#fff' : '#4a5073'
                      }}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <button onClick={onClose} style={{
            padding: '12px 32px', borderRadius: 99, border: 'none',
            background: 'linear-gradient(135deg,#6C63FF 0%,#A855F7 100%)',
            color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer',
            fontFamily: "'Nunito', sans-serif", boxShadow: '0 4px 14px rgba(108,99,255,.35)'
          }}>
            ✓ Xong
          </button>
        </div>
      </div>
    </div>
  );
}

export default StudentSchedule;
