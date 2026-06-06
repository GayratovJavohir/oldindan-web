import { useMemo } from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
} from 'recharts';
import { useTranslation } from 'react-i18next';
import Topbar from '../components/Topbar';
import {
    useAppStore,
    todayISO,
    computeDashboardStats,
    bookingsSeriesByDay,
    bookingStatusPieData,
    branchBookingPieData,
    EST_REVENUE_PER_GUEST,
} from '../store/appStore';

const chartTooltipStyle = {
    backgroundColor: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    fontSize: 12,
};

export default function AnalyticsPage() {
    const { t } = useTranslation();
    const bookings = useAppStore(s => s.bookings);
    const tables = useAppStore(s => s.tables);
    const branches = useAppStore(s => s.branches);
    const stats = useMemo(() => computeDashboardStats(bookings, tables), [bookings, tables]);

    const today = todayISO();

    const series14 = useMemo(() => bookingsSeriesByDay(bookings, 14), [bookings]);
    const statusPie = useMemo(() => bookingStatusPieData(bookings), [bookings]);
    const branchPie = useMemo(() => branchBookingPieData(bookings, branches), [bookings, branches]);

    const byBranch = useMemo(() => {
        return branches.map(b => {
            const list = bookings.filter(x => x.branchId === b.id && x.date === today);
            const active = list.filter(x => !['cancelled', 'no-show'].includes(x.status));
            return {
                name: b.name,
                total: list.length,
                active: active.length,
                cancelled: list.filter(x => x.status === 'cancelled').length,
                revenue: Math.round(active.reduce((s, x) => s + (x.guests || 0) * EST_REVENUE_PER_GUEST, 0)),
            };
        });
    }, [bookings, branches, today]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Topbar title={t('analytics.title', 'Analytics')} subtitle={t('analytics.subtitle', 'From your saved bookings · est. revenue = guests × deposit estimate')} />

            <div className="page-body animate-in">
                <div className="stats-grid" style={{ marginBottom: 24 }}>
                    <div className="stat-card accent-red">
                        <span className="stat-icon">📋</span>
                        <div className="stat-label">Today (active)</div>
                        <div className="stat-value">{stats.todayBookings}</div>
                        <div className="stat-sub">Excludes cancelled &amp; no-show</div>
                    </div>
                    <div className="stat-card accent-blue">
                        <span className="stat-icon">💰</span>
                        <div className="stat-label">Est. revenue</div>
                        <div className="stat-value">${stats.revenue.toLocaleString()}</div>
                        <div className="stat-sub">{stats.totalGuests} guests × ~${EST_REVENUE_PER_GUEST}</div>
                    </div>
                    <div className="stat-card accent-yellow">
                        <span className="stat-icon">⚠️</span>
                        <div className="stat-label">No-shows today</div>
                        <div className="stat-value">{stats.noShows}</div>
                        <div className="stat-sub">Marked no-show for {today}</div>
                    </div>
                    <div className="stat-card accent-green">
                        <span className="stat-icon">👥</span>
                        <div className="stat-label">Guests today</div>
                        <div className="stat-value">{stats.totalGuests}</div>
                        <div className="stat-sub">Covers for active bookings today</div>
                    </div>
                </div>

                <div className="grid-2" style={{ marginBottom: 24, alignItems: 'stretch' }}>
                    <div className="card card-lg" style={{ minHeight: 360 }}>
                        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4, fontFamily: "'Space Grotesk', sans-serif" }}>
                            Active bookings &amp; est. revenue (14 days)
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 16 }}>
                            Real counts from your data; revenue line uses guest-weighted estimate
                        </div>
                        <div style={{ width: '100%', height: 280 }}>
                            <ResponsiveContainer>
                                <LineChart data={series14} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.6} />
                                    <XAxis dataKey="short" tick={{ fill: 'var(--text3)', fontSize: 11 }} />
                                    <YAxis yAxisId="left" tick={{ fill: 'var(--text3)', fontSize: 11 }} allowDecimals={false} />
                                    <YAxis yAxisId="right" orientation="right" tick={{ fill: 'var(--text3)', fontSize: 11 }} tickFormatter={v => `$${v}`} />
                                    <Tooltip contentStyle={chartTooltipStyle} labelFormatter={(_, p) => p?.[0]?.payload?.label ?? ''} />
                                    <Legend wrapperStyle={{ fontSize: 12 }} />
                                    <Line yAxisId="left" type="monotone" dataKey="bookings" name="Active bookings" stroke="var(--red)" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                                    <Line yAxisId="right" type="monotone" dataKey="revenue" name="Est. revenue ($)" stroke="var(--blue)" strokeWidth={2} dot={{ r: 3 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="card card-lg" style={{ minHeight: 360 }}>
                        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4, fontFamily: "'Space Grotesk', sans-serif" }}>
                            Booking status (all time)
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 16 }}>
                            Share of every reservation in the system
                        </div>
                        <div style={{ width: '100%', height: 280 }}>
                            {statusPie.length === 0 ? (
                                <div className="empty-state" style={{ padding: 40 }}>
                                    <div className="empty-state-title">No data yet</div>
                                </div>
                            ) : (
                                <ResponsiveContainer>
                                    <PieChart>
                                        <Pie
                                            data={statusPie}
                                            dataKey="value"
                                            nameKey="name"
                                            cx="50%"
                                            cy="50%"
                                            outerRadius={100}
                                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                        >
                                            {statusPie.map((entry) => (
                                                <Cell key={entry.name} fill={entry.color} stroke="var(--surface)" strokeWidth={1} />
                                            ))}
                                        </Pie>
                                        <Tooltip contentStyle={chartTooltipStyle} />
                                    </PieChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </div>
                </div>

                <div className="grid-2" style={{ marginBottom: 24 }}>
                    <div className="card card-lg">
                        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4, fontFamily: "'Space Grotesk', sans-serif" }}>
                            Guests per day (14 days)
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 16 }}>Guest headcount on active bookings only</div>
                        <div style={{ width: '100%', height: 240 }}>
                            <ResponsiveContainer>
                                <LineChart data={series14} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.6} />
                                    <XAxis dataKey="short" tick={{ fill: 'var(--text3)', fontSize: 11 }} />
                                    <YAxis tick={{ fill: 'var(--text3)', fontSize: 11 }} allowDecimals={false} />
                                    <Tooltip contentStyle={chartTooltipStyle} labelFormatter={(_, p) => p?.[0]?.payload?.label ?? ''} />
                                    <Line type="monotone" dataKey="guests" name="Guests" stroke="var(--green)" strokeWidth={2} dot={{ r: 3 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="card card-lg">
                        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4, fontFamily: "'Space Grotesk', sans-serif" }}>
                            Bookings by branch (all time)
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 16 }}>Total reservations per location</div>
                        <div style={{ width: '100%', height: 240 }}>
                            {branchPie.length === 0 ? (
                                <div className="empty-state" style={{ padding: 32 }}>
                                    <div className="empty-state-title">No branch data</div>
                                </div>
                            ) : (
                                <ResponsiveContainer>
                                    <PieChart>
                                        <Pie
                                            data={branchPie}
                                            dataKey="value"
                                            nameKey="name"
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={50}
                                            outerRadius={85}
                                            paddingAngle={2}
                                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                        >
                                            {branchPie.map((entry) => (
                                                <Cell key={entry.name} fill={entry.color} stroke="var(--surface)" strokeWidth={1} />
                                            ))}
                                        </Pie>
                                        <Tooltip contentStyle={chartTooltipStyle} />
                                    </PieChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </div>
                </div>

                <div className="card" style={{ padding: 0 }}>
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif" }}>
                        Today by branch
                    </div>
                    <div className="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>Branch</th>
                                    <th>All today</th>
                                    <th>Active</th>
                                    <th>Cancelled</th>
                                    <th>Est. revenue</th>
                                </tr>
                            </thead>
                            <tbody>
                                {byBranch.map(row => (
                                    <tr key={row.name}>
                                        <td>{row.name}</td>
                                        <td>{row.total}</td>
                                        <td>{row.active}</td>
                                        <td>{row.cancelled}</td>
                                        <td>${row.revenue.toLocaleString()}</td>
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
