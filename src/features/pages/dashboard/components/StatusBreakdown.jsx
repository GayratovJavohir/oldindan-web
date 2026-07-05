import React from 'react';
import styles from '../Dashboard.module.css';

export default function StatusBreakdown({ bookings = [] }) {
  const totalCount = bookings.length;

  const getStatusCount = (statusName) => {
    return bookings.filter(b => b.status?.toLowerCase() === statusName.toLowerCase()).length;
  };

  const statuses = [
    { name: 'Confirmed', count: getStatusCount('confirmed'), color: '#0066ff' },
    { name: 'Pending', count: getStatusCount('pending'), color: '#ffb800' },
    { name: 'Canceled', count: getStatusCount('canceled'), color: '#ff3333' },
    { name: 'Completed', count: getStatusCount('completed'), color: '#00cc66' },
    { name: 'No Show', count: getStatusCount('no_show'), color: '#8a8a8a' },
  ];

  return (
    <div className={styles.statusBlock}>
      <h3>Status breakdown</h3>

      <div className={styles.statusList}>
        {statuses.map((status) => {
          const percentage = totalCount > 0 ? (status.count / totalCount) * 100 : 0;

          return (
            <div key={status.name} className={styles.statusRow}>
              <div className={styles.statusLabelInfo}>
                <span className={styles.statusIndicator} style={{ backgroundColor: status.color }}></span>
                <span className={styles.statusName}>{status.name}</span>
                <span className={styles.statusCount}>{status.count}</span>
              </div>

              <div className={styles.progressBarBg}>
                <div
                  className={styles.progressBarFill}
                  style={{
                    width: `${percentage}%`,
                    backgroundColor: status.color
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