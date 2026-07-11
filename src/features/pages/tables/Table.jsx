import React from 'react'
import PageHeader from '../../../components/header/PageHeader'
import styles from './Table.module.css'
import TableCard from './components/TableCard';

export default function Table() {
  return (
    <>
      <PageHeader title="Tables" />
      <div className={styles.tablesContainer}>
        <TableCard />
      </div>
    </>
  )
}
