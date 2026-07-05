import React, { useState } from 'react'
import styles from '../Bookings.module.css'
import ManualBookingModal from './ManualBookingModal'

const initialBookings = [
  { id: 1, guestName: 'Alisher Nazarov', phone: '+998901234567', branch: 'KFC Almazor', table: 'T3 - Floor 1', date: '09 Jun 2026', time: '19:00 - 20:00', guestsCount: '4 (+1 ch)', status: 'Confirmed', source: 'App' },
  { id: 2, guestName: 'Malika Yusupova', phone: '+998907654321', branch: 'KFC Almazor', table: 'T1 - Floor 1', date: '09 Jun 2026', time: '19:30 - 21:00', guestsCount: '2', status: 'Pending', source: 'App' },
  { id: 3, guestName: 'Bobur Tashmatov', phone: '+998991234567', branch: 'KFC Almazor', table: 'T5 - Floor 2', date: '09 Jun 2026', time: '20:00 - 21:30', guestsCount: '6 (+2 ch)', status: 'Checked In', source: 'Manual' },
  { id: 4, guestName: 'Nilufar Rahimova', phone: '+998901112233', branch: 'KFC Chilonzor', table: 'T2 - Floor 1', date: '09 Jun 2026', time: '18:00 - 19:00', guestsCount: '2', status: 'Completed', source: 'App' },
  { id: 5, guestName: 'Jasur Mirzayev', phone: '+998998887766', branch: 'KFC Almazor', table: 'T4 - Floor 1', date: '09 Jun 2026', time: '17:00 - 18:00', guestsCount: '3 (+1 ch)', status: 'Canceled', source: 'App' },
  { id: 6, guestName: 'Shahlo Ergasheva', phone: '+998998887766', branch: 'KFC Almazor', table: 'T6 - Floor 2', date: '09 Jun 2026', time: '21:00 - 22:00', guestsCount: '5', status: 'No Show', source: 'App' },
  { id: 7, guestName: 'Doniyor Kalandarov', phone: '+998903213214', branch: 'KFC Chilonzor', table: 'T1 - Floor 1', date: '10 Jun 2026', time: '12:00 - 13:30', guestsCount: '2 (+1 ch)', status: 'Pending', source: 'App' },
  { id: 8, guestName: 'Feruza Soliyeva', phone: '+998909876543', branch: 'KFC Almazor', table: 'T2 - Floor 1', date: '10 Jun 2026', time: '13:00 - 14:00', guestsCount: '4', status: 'Confirmed', source: 'Manual' }
]

export default function BookingsTable() {
  const [bookings, setBookings] = useState(initialBookings)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const getStatusStyle = (status) => {
    switch (status) {
      case 'Confirmed': return styles.statusConfirmed
      case 'Pending': return styles.statusPending
      case 'Checked In': return styles.statusCheckedIn
      case 'Completed': return styles.statusCompleted
      case 'Canceled': return styles.statusCanceled
      case 'No Show': return styles.statusNoShow
      default: return ''
    }
  }

  return (
    <div className={styles.container}>
      

      <div className={styles.mainCard}>
        <div className={styles.header}>
          <h2 className={styles.title}>All Bookings</h2>
          <button className={styles.manualBtn} onClick={() => setIsModalOpen(true)}>
            + Manual Booking
          </button>
        </div>
        <div className={styles.filters}>
          <input type="text" placeholder="Search guest name, phone..." className={styles.searchInput} />
          <select className={styles.selectInput}>
            <option>All statuses</option>
          </select>
          <input type="text" placeholder="dd/mm/yyyy" className={styles.dateInput} />
          <input type="text" placeholder="dd/mm/yyyy" className={styles.dateInput} />
          <button className={styles.applyBtn}>Apply</button>
        </div>

        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>#</th>
                <th>GUEST</th>
                <th>BRANCH / TABLE</th>
                <th>DATE & TIME</th>
                <th>GUESTS</th>
                <th>STATUS</th>
                <th>SOURCE</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((booking) => (
                <tr key={booking.id}>
                  <td className={styles.idCol}>#{booking.id}</td>
                  <td>
                    <div className={styles.guestName}>{booking.guestName}</div>
                    <div className={styles.guestPhone}>{booking.phone}</div>
                  </td>
                  <td>
                    <div className={styles.branchName}>{booking.branch}</div>
                    <div className={styles.tableName}>{booking.table}</div>
                  </td>
                  <td>
                    <div className={styles.dateText}>{booking.date}</div>
                    <div className={styles.timeText}>{booking.time}</div>
                  </td>
                  <td className={styles.guestsCount}>{booking.guestsCount}</td>
                  <td>
                    <span className={`${styles.statusBadge} ${getStatusStyle(booking.status)}`}>
                      {booking.status}
                    </span>
                  </td>
                  <td>
                    <span className={styles.sourceBadge}>
                      {booking.source === 'App' ? '📱 App' : '💻 Manual'}
                    </span>
                  </td>
                  <td>
                    <div className={styles.actions}>
                      <button className={styles.viewBtn}>View</button>
                      {booking.status === 'Pending' && (
                        <>
                          <button className={styles.confirmBtn}>Confirm</button>
                          <button className={styles.cancelBtn}>Cancel</button>
                        </>
                      )}
                      {booking.status === 'Confirmed' && (
                        <button className={styles.cancelBtn}>Cancel</button>
                      )}
                      {booking.status === 'Checked In' && (
                        <button className={styles.cancelBtn}>Cancel</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={styles.pagination}>
          <span className={styles.resultsCount}>Showing 1-20 of 84 results</span>
          <div className={styles.paginationBtns}>
            <button className={styles.pageBtn}>&larr; Prev</button>
            <button className={styles.pageBtn}>Next &rarr;</button>
          </div>
        </div>
      </div>

      {isModalOpen && <ManualBookingModal onClose={() => setIsModalOpen(false)} />}
    </div>
  )
}