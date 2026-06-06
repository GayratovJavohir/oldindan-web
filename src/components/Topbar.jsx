export default function Topbar({ title, subtitle, actions, children }) {
    return (
        <div className="topbar">
            <div style={{ flex: 1 }}>
                <div className="topbar-title">{title}</div>
                {subtitle && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 1 }}>{subtitle}</div>}
            </div>
            <div className="topbar-actions">
                {children}
                {actions}
            </div>
        </div>
    );
}