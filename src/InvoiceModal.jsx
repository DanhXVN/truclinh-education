import { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';

const parseMoneyValue = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value !== 'string') return 0;
  const normalized = value.replace(/[^\d-]/g, '').replace(/(?!^)-/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toYMD = (dateObj) => {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const formatMoney = (value) => `${Number(value || 0).toLocaleString('vi-VN')}đ`;
const formatMoneyWithSign = (value) => {
  const amount = Number(value || 0);
  if (amount > 0) return `+${amount.toLocaleString('vi-VN')}đ`;
  if (amount < 0) return `${amount.toLocaleString('vi-VN')}đ`;
  return '0đ';
};

function InvoiceModal({ student, yearMonth, onClose }) {
  const [invoiceData, setInvoiceData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 900);
  const invoiceContentRef = useRef(null);

  useEffect(() => {
    fetchInvoiceData();
  }, [student.id, yearMonth]);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 900);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const fetchInvoiceData = async () => {
    try {
      setLoading(true);
      const [yearStr, monthStr] = yearMonth.split('-');
      const year = Number(yearStr);
      const month = Number(monthStr);
      const firstDay = `${yearStr}-${monthStr}-01`;
      const lastDayNumber = new Date(year, month, 0).getDate();
      const lastDay = `${yearStr}-${monthStr}-${String(lastDayNumber).padStart(2, '0')}`;

      const { data: attendanceData } = await supabase
        .from('attendance')
        .select('date, status')
        .eq('student_id', student.id)
        .gte('date', firstDay)
        .lte('date', lastDay);

      const { data: noteData } = await supabase
        .from('notes')
        .select('date, money, content')
        .eq('student_id', student.id)
        .gte('date', firstDay)
        .lte('date', lastDay);

      const { data: scheduleData } = await supabase
        .from('student_schedules')
        .select('day_of_week')
        .eq('student_id', student.id);

      const scheduleSet = new Set((scheduleData || []).map((s) => s.day_of_week));
      const days = [];
      let current = new Date(year, month - 1, 1);
      const monthEnd = new Date(year, month - 1, lastDayNumber);

      while (current <= monthEnd) {
        days.push(toYMD(current));
        current.setDate(current.getDate() + 1);
      }

      const detailData = days.map((date) => {
        const attendance = (attendanceData || []).find((a) => a.date === date);
        const notes = (noteData || []).filter((n) => n.date === date);
        const totalNotesMoney = notes.reduce((sum, n) => sum + parseMoneyValue(n.money), 0);
        const isPresent = !!attendance && (attendance.status === true || attendance.status === 'true' || attendance.status === 'Có mặt');
        const sessionMoney = isPresent ? 50000 : 0;
        const dayOfWeek = new Date(`${date}T00:00:00`).getDay();
        const isScheduledDay = scheduleSet.has(dayOfWeek);

        let calendarStatus = 'none';
        if (isScheduledDay) {
          calendarStatus = isPresent ? 'present' : 'absent';
        }

        return {
          date,
          day: Number(date.slice(8, 10)),
          isScheduledDay,
          isPresent,
          attendanceText: isPresent ? 'Có mặt' : (isScheduledDay ? 'Vắng' : 'Không có lịch'),
          sessionMoney,
          notes,
          totalNotesMoney,
          totalMoney: sessionMoney + totalNotesMoney,
          calendarStatus
        };
      });

      const scheduledDays = detailData.filter((d) => d.isScheduledDay).length;
      const presentDays = detailData.filter((d) => d.isScheduledDay && d.isPresent).length;
      const absentDays = Math.max(scheduledDays - presentDays, 0);
      const totalSessionMoney = detailData.reduce((sum, d) => sum + d.sessionMoney, 0);
      const totalNotesMoney = detailData.reduce((sum, d) => sum + d.totalNotesMoney, 0);
      const noteSummary = detailData
        .flatMap((d) => d.notes.map((n) => ({
          date: d.date,
          content: n.content?.trim() || 'Phát sinh',
          money: parseMoneyValue(n.money)
        })))
        .filter((n) => n.money !== 0 || n.content !== 'Phát sinh');

      setInvoiceData({
        details: detailData,
        scheduledDays,
        presentDays,
        absentDays,
        totalSessionMoney,
        totalNotesMoney,
        totalMoney: totalSessionMoney + totalNotesMoney,
        noteSummary
      });
    } catch (error) {
      console.error('Error fetching invoice:', error);
      setInvoiceData(null);
    } finally {
      setLoading(false);
    }
  };

  const exportPDF = async () => {
    if (!invoiceData || !invoiceContentRef.current) return;
    const [{ jsPDF }, { default: html2canvas }] = await Promise.all([
      import('jspdf'),
      import('html2canvas')
    ]);

    const canvas = await html2canvas(invoiceContentRef.current, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff'
    });

    const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 16;
    const printableWidth = pageWidth - margin * 2;
    const printableHeight = pageHeight - margin * 2;

    const pxPerPt = canvas.width / printableWidth;
    const pageCanvasHeightPx = Math.floor(printableHeight * pxPerPt);

    let renderedHeightPx = 0;
    let pageIndex = 0;

    while (renderedHeightPx < canvas.height) {
      const sliceHeightPx = Math.min(pageCanvasHeightPx, canvas.height - renderedHeightPx);
      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceHeightPx;
      const pageCtx = pageCanvas.getContext('2d');
      pageCtx.drawImage(
        canvas,
        0,
        renderedHeightPx,
        canvas.width,
        sliceHeightPx,
        0,
        0,
        canvas.width,
        sliceHeightPx
      );

      if (pageIndex > 0) pdf.addPage();
      const sliceHeightPt = sliceHeightPx / pxPerPt;
      const imgData = pageCanvas.toDataURL('image/png');
      pdf.addImage(imgData, 'PNG', margin, margin, printableWidth, sliceHeightPt);

      renderedHeightPx += sliceHeightPx;
      pageIndex += 1;
    }

    pdf.save(`Phieu_hoc_phi_${student.name}_${yearMonth}.pdf`);
  };

  const calendarCellStyle = (status) => {
    if (status === 'present') {
      return { background: '#dcfce7', color: '#166534', border: '1px solid #86efac' };
    }
    if (status === 'absent') {
      return { background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5' };
    }
    return { background: '#f3f4f6', color: '#6b7280', border: '1px solid #d1d5db' };
  };

  const statusIcon = (status) => {
    if (status === 'present') return '✓';
    if (status === 'absent') return '✕';
    return '•';
  };

  if (loading) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
        <div style={{ background: '#fff', borderRadius: 20, padding: 36, textAlign: 'center', fontWeight: 700 }}>
          ⏳ Đang tải phiếu học phí...
        </div>
      </div>
    );
  }

  if (!invoiceData) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
        <div style={{ background: '#fff', borderRadius: 20, padding: 36, textAlign: 'center', fontWeight: 700 }}>
          ❌ Không tìm thấy dữ liệu phiếu.
        </div>
      </div>
    );
  }

  const firstWeekdayOfMonth = new Date(`${yearMonth}-01T00:00:00`).getDay();
  const firstWeekdayMondayStart = (firstWeekdayOfMonth + 6) % 7;
  const leadingEmptyCells = Array.from({ length: firstWeekdayMondayStart }, () => null);
  const rawCalendarCells = [...leadingEmptyCells, ...invoiceData.details];
  const trailingCount = (7 - (rawCalendarCells.length % 7)) % 7;
  const calendarCells = [...rawCalendarCells, ...Array.from({ length: trailingCount }, () => null)];

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15,23,42,.52)', backdropFilter: 'blur(6px)', zIndex: 1100,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, overflowY: 'auto'
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%', maxWidth: 920, maxHeight: '92vh', overflowY: 'auto',
          borderRadius: 28, background: 'linear-gradient(180deg,#ffffff 0%,#f8f7ff 100%)',
          boxShadow: '0 20px 64px rgba(76,63,160,.35)', padding: isMobile ? 16 : 24,
          border: '1px solid #e5e7eb'
        }}
        onClick={(e) => e.stopPropagation()}
        ref={invoiceContentRef}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{
              width: 52, height: 52, borderRadius: '50%',
              background: 'linear-gradient(135deg,#6C63FF 0%,#A855F7 100%)',
              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 900, fontFamily: "'Nunito', sans-serif"
            }}>
              TL
            </div>
            <div>
              <h2 style={{ margin: 0, fontFamily: "'Nunito', sans-serif", fontSize: 22, fontWeight: 900, color: '#1f2a44' }}>
                Trúc Linh Education Center
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b', fontWeight: 700 }}>
                PHIẾU THU HỌC PHÍ • Tháng {yearMonth}
              </p>
            </div>
          </div>
          {!isMobile && (
            <button
              onClick={onClose}
              style={{
                border: '1px solid #fecaca', background: '#fee2e2', color: '#b91c1c',
                borderRadius: 10, fontSize: 20, padding: '0 9px', cursor: 'pointer'
              }}
            >
              ✕
            </button>
          )}
        </div>

        <div style={{
          marginBottom: 18, borderRadius: 16, border: '1.5px solid #e2e8f0', background: '#fff',
          padding: 14, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
          boxShadow: '0 8px 20px rgba(15,23,42,.05)'
        }}>
          <div>
            <p style={{ margin: 0, fontSize: 12, color: '#64748b', fontWeight: 700 }}>Học sinh</p>
            <p style={{ margin: '4px 0 0', fontSize: 18, color: '#1e293b', fontWeight: 900 }}>{student.name}</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', justifyContent: isMobile ? 'stretch' : 'flex-start' }}>
            <button
              onClick={exportPDF}
              style={{
                border: 'none', background: 'linear-gradient(135deg,#ef4444 0%,#f97316 100%)', boxShadow: '0 8px 20px rgba(249,115,22,.24)', color: '#fff',
                borderRadius: 999, fontWeight: 800, fontSize: 13, padding: '10px 16px', cursor: 'pointer',
                width: isMobile ? '100%' : 'auto'
              }}
            >
              📄 Xuất PDF
            </button>
            <button
              onClick={onClose}
              style={{
                border: 'none', background: 'linear-gradient(135deg,#6C63FF 0%,#A855F7 100%)', color: '#fff',
                borderRadius: 999, fontWeight: 800, fontSize: 13, padding: '10px 16px', cursor: 'pointer',
                width: isMobile ? '100%' : 'auto'
              }}
            >
              ✓ Đóng
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.3fr .9fr', gap: 14, marginBottom: 14 }}>
          <div style={{ borderRadius: 16, border: '1.5px solid #e2e8f0', background: '#fff', padding: 14 }}>
            <p style={{ margin: '0 0 10px', fontWeight: 800, color: '#4f46e5', fontSize: 14 }}>📅 Lịch học trong tháng</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 6 }}>
              {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((d) => (
                <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 800, color: '#64748b' }}>{d}</div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
              {calendarCells.map((d, idx) => {
                if (!d) {
                  return (
                    <div
                      key={`empty-${idx}`}
                      style={{
                        borderRadius: 10,
                        minHeight: 40,
                        background: 'transparent',
                        border: '1px dashed rgba(203,213,225,.45)'
                      }}
                    />
                  );
                }
                const style = calendarCellStyle(d.calendarStatus);
                return (
                  <div
                    key={d.date}
                    title={`${d.date}: ${d.attendanceText}`}
                    style={{
                      ...style,
                      borderRadius: 10,
                      minHeight: 40,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      lineHeight: 1.1
                    }}
                  >
                    <span style={{ fontSize: 12 }}>{d.day}</span>
                    <span style={{ fontSize: 11 }}>{statusIcon(d.calendarStatus)}</span>
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 10, fontSize: 11, fontWeight: 700 }}>
              <span style={{ color: '#166534' }}>■ Có lịch + đi học</span>
              <span style={{ color: '#b91c1c' }}>■ Có lịch + vắng</span>
              <span style={{ color: '#6b7280' }}>■ Không có lịch</span>
            </div>
          </div>

          <div style={{ borderRadius: 16, border: '1.5px solid #e9d5ff', background: 'linear-gradient(135deg,#f5f3ff 0%,#eef2ff 100%)', padding: 14 }}>
            <p style={{ margin: '0 0 10px', fontWeight: 800, color: '#6d28d9', fontSize: 14 }}>📊 Bảng thống kê</p>
            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#334155' }}><span>Buổi theo lịch</span><span>{invoiceData.scheduledDays}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#166534' }}><span>Có mặt</span><span>{invoiceData.presentDays}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#b91c1c' }}><span>Vắng</span><span>{invoiceData.absentDays}</span></div>
              <div style={{ borderTop: '1px dashed #c4b5fd', margin: '2px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#4338ca' }}><span>Tiền buổi học</span><span>{formatMoney(invoiceData.totalSessionMoney)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: invoiceData.totalNotesMoney < 0 ? '#dc2626' : '#059669' }}><span>Tiền phát sinh/hoàn trả</span><span>{formatMoney(invoiceData.totalNotesMoney)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: 18, color: '#6c63ff', background: '#fff', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #ddd6fe' }}><span>Tổng cộng</span><span>{formatMoney(invoiceData.totalMoney)}</span></div>
            </div>
          </div>
        </div>

        <div style={{ borderRadius: 16, border: '1.5px solid #e2e8f0', background: '#fff', padding: 14, marginBottom: 14 }}>
          <p style={{ margin: '0 0 8px', fontWeight: 800, color: '#0f766e', fontSize: 14 }}>📝 Tóm tắt phát sinh / hoàn trả</p>
          {invoiceData.noteSummary.length === 0 ? (
            <p style={{ margin: 0, color: '#64748b', fontWeight: 600, fontSize: 13 }}>Không có phát sinh trong tháng.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {invoiceData.noteSummary.slice(0, 8).map((note, idx) => (
                <div key={`${note.date}_${idx}`} style={{
                  display: 'flex', justifyContent: 'space-between', gap: 8,
                  padding: '8px 10px', borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0'
                }}>
                  <span style={{ color: '#334155', fontWeight: 700, fontSize: 12 }}>{note.date} • {note.content}</span>
                  <span style={{ color: note.money < 0 ? '#dc2626' : '#16a34a', fontWeight: 900, fontSize: 12 }}>{formatMoneyWithSign(note.money)}</span>
                </div>
              ))}
              {invoiceData.noteSummary.length > 8 && (
                <p style={{ margin: 0, fontSize: 12, color: '#64748b', fontWeight: 700 }}>
                  ... và {invoiceData.noteSummary.length - 8} mục khác.
                </p>
              )}
            </div>
          )}
        </div>

        <div style={{
          borderRadius: 14, background: 'linear-gradient(135deg,#eef2ff 0%,#f5f3ff 100%)',
          border: '1.5px solid #d8b4fe', padding: '14px 16px'
        }}>
          <p style={{ margin: 0, fontWeight: 800, color: '#5b21b6', fontSize: 13 }}>
            Cảm ơn Quý phụ huynh đã tin tưởng đồng hành cùng Trúc Linh Education Center.
          </p>
          <p style={{ margin: '6px 0 0', color: '#475569', fontWeight: 700, fontSize: 12 }}>
            Liên hệ cô Trúc Linh: <span style={{ color: '#dc2626' }}>0358.950.222</span>
          </p>
        </div>
      </div>
    </div>
  );
}

export default InvoiceModal;
