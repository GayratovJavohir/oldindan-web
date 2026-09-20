import React from 'react'
import { useTranslation } from 'react-i18next';
import PageHeader from '../../../components/header/PageHeader';
import styles from './Staff.module.css';
import STableCard from './components/STableCard';

export default function Staff() {
    const { t } = useTranslation();
    return (
        <>
            <PageHeader title={t('pages.staff')} />
            <div className={styles.staffContainer}>
                <STableCard />
            </div>
        </>
    );
}
