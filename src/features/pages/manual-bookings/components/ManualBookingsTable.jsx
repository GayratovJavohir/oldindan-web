import React from 'react'
import styles from '../ManualBookings.module.css'

export default function ManualBookingsTable() {
  return (
    <div className={styles.formContainer}>
      <div className={styles.formHeader}>
        <h2 className={styles.formTitle}>Create Manual Booking</h2>
      </div>

      <div className={styles.formBody}>
        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Guest (existing user ID, optional)</label>
            <input
              type="text"
              placeholder="Leave blank to use staff as guest"
              className={styles.inputField}
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>Branch *</label>
            <select className={styles.selectField} defaultValue="KFC Almazor">
              <option>KFC Almazor</option>
            </select>
          </div>
        </div>

        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Floor *</label>
            <select className={styles.selectField} defaultValue="Floor 1 — Main Hall">
              <option>Floor 1 — Main Hall</option>
            </select>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>Zone</label>
            <select className={styles.selectField} defaultValue="No zone">
              <option>No zone</option>
            </select>
          </div>
        </div>

        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Table *</label>
            <select className={styles.selectField} defaultValue="T1 — 4 seats">
              <option>T1 — 4 seats</option>
            </select>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>Guest count *</label>
            <input
              type="number"
              defaultValue={2}
              className={styles.inputField}
            />
          </div>
        </div>

        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Children count</label>
            <input
              type="number"
              defaultValue={0}
              className={styles.inputField}
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>Booking start *</label>
            <input
              type="text"
              placeholder="dd/mm/yyyy, --:--"
              className={styles.inputField}
            />
          </div>
        </div>

        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Booking end *</label>
            <input
              type="text"
              placeholder="dd/mm/yyyy, --:--"
              className={styles.inputField}
            />
          </div>
          <div className={styles.formGroup}></div>
        </div>

        <div className={styles.formGroupFull}>
          <label className={styles.label}>Special request</label>
          <textarea
            placeholder="Window seat, birthday, allergy info..."
            rows="4"
            className={styles.textareaField}
          ></textarea>
        </div>
      </div>

      <div className={styles.formFooter}>
        <button className={styles.clearBtn}>Clear</button>
        <button className={styles.submitBtn}>Create Booking</button>
      </div>
    </div>
  )
}