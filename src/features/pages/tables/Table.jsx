import React from 'react'
import styles from './Table.module.css'
import TableCard from './components/TableCard';

export default function Table() {
  return (
    <>
      <header className={styles.tablesHeader}>
          <h1 className={styles.tablesTitle}>Tables</h1>
          <div className={styles.bellIcon}>🔔</div>
      </header>
      <div className={styles.tablesContainer}>
        <TableCard />
      </div>
    </>
  )
}
