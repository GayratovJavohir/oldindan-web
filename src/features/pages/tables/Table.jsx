import React from 'react'
import { useTranslation } from 'react-i18next'
import PageHeader from '../../../components/header/PageHeader'
import styles from './Table.module.css'
import TableCard from './components/TableCard';

export default function Table() {
    const { t } = useTranslation();
  return (
    <>
      <PageHeader title={t('pages.tables')} />
      <div className={styles.tablesContainer}>
        <TableCard />
      </div>
    </>
  )
}
