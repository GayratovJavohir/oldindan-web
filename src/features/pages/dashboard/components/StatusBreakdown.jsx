import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from '../Dashboard.module.css';

export default function StatusBreakdown({ bookings = [] }) {
  const { t } = useTranslation();
  const totalCount = bookings.length;

  const getStatusCount = (statusName) => {
    return bookings.filter((b) => b.status?.toLowerCase() === statusName.toLowerCase()
      || String(b.status || '').toLowerCase().replace(/\s+/g, '_') === statusName).length;
  };

  const statuses = [
    { key: 'confirmed', name: t('status.confirmed'), match: 'confirmed', color: '#0066ff' },
    { key: 'pending', name: t('status.pending'), match: 'pending', color: '#ffb800' },
    { key: 'canceled', name: t('status.canceled'), match: 'canceled', color: '#ff3333' },
    { key: 'completed', name: t('status.completed'), match: 'completed', color: '#00cc66' },
    { key: 'noShow', name: t('status.noShow'), match: 'no_show', color: '#8a8a8a' },
  ];

  return (
    <div className={styles.statusBlock}>
      <h3>{t('dashboard.statusBreakdown')}</h3>

      <div className={styles.statusList}>
        {statuses.map((status) => {
          const count = status.match === 'canceled'
            ? bookings.filter((b) => ['canceled', 'cancelled'].includes(String(b.status || '').toLowerCase())).length
            : status.match === 'no_show'
              ? bookings.filter((b) => ['no show', 'no_show', 'noshow'].includes(String(b.status || '').toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_'))
                || String(b.status || '').toLowerCase() === 'no show').length
              : getStatusCount(status.match);
          const percentage = totalCount > 0 ? (count / totalCount) * 100 : 0;

          return (
            <div key={status.key} className={styles.statusRow}>
              <div className={styles.statusLabelInfo}>
                <span className={styles.statusIndicator} style={{ backgroundColor: status.color }}></span>
                <span className={styles.statusName}>{status.name}</span>
                <span className={styles.statusCount}>{count}</span>
              </div>

              <div className={styles.progressBarBg}>
                <div
                  className={styles.progressBarFill}
                  style={{
                    width: `${percentage}%`,
                    backgroundColor: status.color,
                  }}
                ></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
