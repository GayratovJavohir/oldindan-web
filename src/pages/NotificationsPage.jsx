import Topbar from '../components/Topbar';
import { useAppStore } from '../store/appStore';

const TYPE_ICON = {
    booking: '📋',
    noshow: '⚠️',
    system: '⚙️',
};

export default function NotificationsPage() {
    const notifications = useAppStore(s => s.notifications);
    const markRead = useAppStore(s => s.markNotificationRead);
    const markAll = useAppStore(s => s.markAllNotificationsRead);
    const clear = useAppStore(s => s.clearNotifications);

    const unread = notifications.filter(n => !n.read).length;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Topbar title="Notifications" subtitle={`${unread} unread`}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={markAll}>Mark all read</button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => { if (confirm('Clear all notifications?')) clear(); }}>Clear</button>
            </Topbar>

            <div className="page-body animate-in">
                <div style={{ maxWidth: 720, margin: '0 auto' }}>
                    {notifications.length === 0 && (
                        <div className="empty-state">
                            <div className="empty-state-icon">🔔</div>
                            <div className="empty-state-title">No notifications</div>
                            <div className="empty-state-sub">Booking activity will appear here</div>
                        </div>
                    )}

                    {notifications.map((n, i) => (
                        <div
                            key={`${n.id}-${i}`}
                            role="button"
                            tabIndex={0}
                            onClick={() => markRead(n.id)}
                            onKeyDown={e => e.key === 'Enter' && markRead(n.id)}
                            className="card"
                            style={{
                                marginBottom: 12,
                                cursor: 'pointer',
                                borderLeft: n.read ? '3px solid transparent' : '3px solid var(--red)',
                                opacity: n.read ? 0.75 : 1,
                            }}
                        >
                            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                                <div style={{ fontSize: 22 }}>{TYPE_ICON[n.type] || '•'}</div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{n.title}</div>
                                    <div style={{ fontSize: 13.5, color: 'var(--text2)', marginBottom: 8 }}>{n.message}</div>
                                    <div style={{ fontSize: 12, color: 'var(--text3)' }}>{n.time}</div>
                                </div>
                                {!n.read && <span className="badge badge-red" style={{ fontSize: 10 }}>New</span>}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
