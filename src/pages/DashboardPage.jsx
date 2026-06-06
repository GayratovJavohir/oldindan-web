import { useMemo, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Topbar from '../components/Topbar';
import { useAppStore, todayISO, computeDashboardStats } from '../store/appStore';
import { useAuth } from '../features/auth/AuthContext';
import { api, getApiError } from '../services/api';
import { mapBookingFromApi, mapUiActionToApiStatus } from '../services/mappers';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

const STATUS_BADGE = {
    confirmed: <span className="badge badge-green">● Confirmed</span>,
    pending: <span className="badge badge-yellow">◌ Pending</span>,
    cancelled: <span className="badge badge-red">✕ Cancelled</span>,
    'no-show': <span className="badge badge-gray">— No Show</span>,
    completed: <span className="badge badge-blue">✓ Completed</span>,
};




function MiniChart({ data }) {
    const max = Math.max(...data.map(d => d.bookings), 1);
    return (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 60, marginTop: 12 }}>
            {data.map((d, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div style={{
                        flex: 1,
                        width: '100%',
                        background: i === data.length - 1 ? 'var(--red)' : 'var(--bg3)',
                        borderRadius: 4,
                        height: `${(d.bookings / max) * 100}%`,
                        minHeight: 4,
                        transition: 'all 0.3s',
                    }} />
                    <div style={{ fontSize: 9, color: 'var(--text3)' }}>{d.day}</div>
                </div>
            ))}
        </div>
    );
}

/**
 * 仪表板页面组件
 * 显示餐厅预订、员工、分支机构和统计数据的概览
 */
export default function DashboardPage() {
    // 导航和国际化钩子
    const navigate = useNavigate();
    const { user } = useAuth();
    const { t } = useTranslation();
    // 日期状态管理
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [showCalendar, setShowCalendar] = useState(false);

    // ✅ 2. store data - 从全局状态存储获取数据
    const bookings = useAppStore(s => s.bookings);

    // ✅ 3. derived values - 从原始数据派生的新值
    const selectedISO = selectedDate.toISOString().split('T')[0];

    // 获取今天的预订列表，限制为5条
    const todayList = useMemo(
        () => bookings.filter(b => b.date === selectedISO).slice(0, 5),
        [bookings, selectedISO]
    );


    // 获取其他必要数据
    const tables = useAppStore(s => s.tables);
    const branches = useAppStore(s => s.branches);
    const staff = useAppStore(s => s.staff);
    // 计算仪表板统计数据
    const stats = useMemo(() => computeDashboardStats(bookings, tables), [bookings, tables]);

    // 基础统计值
    const totalBookings = bookings.length;
    const branchCount = branches.length;
    const staffCount = staff.length;
    // 活跃分支机构和员工数量
    const activeBranches = useMemo(() => branches.filter(b => b.status === 'active').length, [branches]);
    const activeStaff = useMemo(() => staff.filter(s => s.status === 'active').length, [staff]);
    // API相关函数
    const setBookingsFromApi = useAppStore(s => s.setBookingsFromApi);
    // 刷新预订列表
    const refreshBookings = useCallback(async () => {
        const list = await api.getPartnerBookings();
        setBookingsFromApi(list.map(mapBookingFromApi));
    }, [setBookingsFromApi]);
    // 更新预订状态
    const postBookingStatus = (id, action) => {
        api.partnerBookingStatus(id, mapUiActionToApiStatus(action), '')
            .then(refreshBookings)
            .catch(e => alert(getApiError(e)));
    };

    // 格式化日期副标题
    const subtitle = useMemo(() => new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date()), []);


    // 随机欢迎语
    const greetings = [
        "Welcome back",
        "Good to see you",
        "What's cooking today",
        "Ready to hustle",
        "Let's get things done",
        "What are you working on",
        "Back at it again",
        "Let's make today count"
    ];

    const randomGreeting = useMemo(() => {
        return greetings[Math.floor(Math.random() * greetings.length)];
    }, []);

    // 计算本周总预订数
    const weekTotal = stats.weeklyData.reduce((s, d) => s + d.bookings, 0);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* 顶部导航栏 */}
            <Topbar title={t('dashboard.title')} subtitle={subtitle}>
                <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setShowCalendar(prev => !prev)}
                >
                    📅 This Week
                </button>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate('/manual-booking')}>
                    + {t('bookings.newBooking')}
                </button>
            </Topbar>

            {/* 日历选择器 */}
            {showCalendar && (
                <div style={{ position: 'absolute', zIndex: 10 }}>
                    <DatePicker
                        selected={selectedDate}
                        onChange={(date) => {
                            setSelectedDate(date);
                            setShowCalendar(false);
                        }}
                        inline
                    />
                </div>
            )}


            {/* 主要内容区域 */}
            <div className="page-body animate-in">
                {/* 欢迎信息 */}
                <div style={{ marginBottom: 24 }}>
                    <h1 style={{ fontSize: 24, fontWeight: 800, fontFamily: "'Space Grotesk', sans-serif" }}>
                        {randomGreeting}, {user?.firstname?.split(' ')[0]} 👋
                    </h1>
                    <p style={{ color: 'var(--text2)', fontSize: 14, marginTop: 4 }}>
                        Here&apos;s what&apos;s happening across your restaurants today.
                    </p>
                </div>

                {/* 统计卡片网格 */}
                <div className="stats-grid">
                    <div className="stat-card accent-red">
                        <span className="stat-icon">📋</span>
                        <div className="stat-label">{t('dashboard.todayBookings')}</div>
                        <div className="stat-value">{stats.todayBookings}</div>
                        <div className="stat-sub">{stats.noShows} {t('dashboard.noShows').toLowerCase()}</div>
                    </div>
                    <div className="stat-card accent-green">
                        <span className="stat-icon">📆</span>
                        <div className="stat-label">{t('common.all')} {t('bookings.title')}</div>
                        <div className="stat-value">{totalBookings}</div>
                        <div className="stat-sub"></div>
                    </div>
                    <div className="stat-card accent-yellow">
                        <span className="stat-icon">🏢</span>
                        <div className="stat-label">{t('branches.title')}</div>
                        <div className="stat-value">{branchCount}</div>
                        <div className="stat-sub">{activeBranches} {t('common.active').toLowerCase()}</div>
                    </div>
                    <div className="stat-card accent-blue">
                        <span className="stat-icon">👥</span>
                        <div className="stat-label">{t('staff.title')}</div>
                        <div className="stat-value">{staffCount}</div>
                        <div className="stat-sub">{activeStaff} {t('common.active').toLowerCase()}</div>
                    </div>
                </div>

                {/* 两列网格布局 */}
                <div className="grid-2" style={{ marginBottom: 24 }}>
                    {/* 每周预订卡片 */}
                    <div className="card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <div>
                                <div style={{ fontWeight: 700, fontSize: 15, fontFamily: "'Space Grotesk', sans-serif" }}>Weekly Bookings</div>
                                <div style={{ fontSize: 12, color: 'var(--text3)' }}>Last 7 days performance</div>
                            </div>
                            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 22, color: 'var(--red)' }}>{weekTotal}</div>
                        </div>
                        <MiniChart data={stats.weeklyData} />
                    </div>

                    {/* 分支机构摘要卡片 */}
                    <div className="card">
                        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14, fontFamily: "'Space Grotesk', sans-serif" }}>Branch Summary</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {branches.map(b => (
                                <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
                                    onClick={() => navigate('/branches')}
                                    onKeyDown={e => e.key === 'Enter' && navigate('/branches')}
                                    role="button"
                                    tabIndex={0}
                                >
                                    <div style={{
                                        width: 40, height: 40,
                                        background: b.status === 'active' ? 'var(--green-muted)' : 'var(--surface2)',
                                        borderRadius: 10,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: 18, flexShrink: 0
                                    }}>🏢</div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 600, fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name}</div>
                                        <div style={{ fontSize: 12, color: 'var(--text3)' }}>{b.tables} tables · {b.todayBookings} bookings today</div>
                                    </div>
                                    <span className={b.status === 'active' ? 'badge badge-green' : 'badge badge-gray'}>
                                        {b.status}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* 最近预订表格 */}
                <div className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <div>
                            <div style={{ fontWeight: 700, fontSize: 15, fontFamily: "'Space Grotesk', sans-serif" }}>Recent Bookings</div>
                            <div style={{ fontSize: 12, color: 'var(--text3)' }}>Today&apos;s reservations</div>
                        </div>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('/bookings')}>View All →</button>
                    </div>

                    <div className="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>Guest</th>
                                    <th>Time</th>
                                    <th>Table</th>
                                    <th>Guests</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {todayList.map(b => (
                                    <tr key={b.id}>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                <div className="avatar" style={{ background: `hsl(${b.id * 47}, 60%, 40%)`, fontSize: 11, width: 30, height: 30 }}>
                                                    {b.guestName.split(' ').map(w => w[0]).join('')}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 600, fontSize: 13 }}>{b.guestName}</div>
                                                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{b.phone}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif" }}>{b.time}</td>
                                        <td>
                                            <div style={{ fontWeight: 600 }}>{b.table}</div>
                                            <div style={{ fontSize: 11, color: 'var(--text3)' }}>{b.floor}</div>
                                        </td>
                                        <td><span style={{ fontWeight: 700 }}>{b.guests}</span> guests</td>
                                        <td>{STATUS_BADGE[b.status]}</td>
                                        <td>
                                            <div style={{ display: 'flex', gap: 6 }}>
                                                {b.status === 'confirmed' && (
                                                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => postBookingStatus(b.id, 'check_in')}>✓ Check-in</button>
                                                )}
                                                {b.status === 'pending' && (
                                                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => postBookingStatus(b.id, 'confirm')}>Confirm</button>
                                                )}
                                                {['pending', 'confirmed'].includes(b.status) && (
                                                    <button type="button" className="btn btn-danger btn-sm" onClick={() => { if (confirm('Cancel?')) postBookingStatus(b.id, 'cancel'); }}>✕</button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
