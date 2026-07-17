import React from 'react'
import { useTranslation } from 'react-i18next';
import PageHeader from '../../../components/header/PageHeader';
import styles from './Brand.module.css';
import BTableCard from './components/TableCard';

export default function Brand() {
    const { t } = useTranslation();
    return (
        <>
            <PageHeader title={t('pages.brands')} />
            <div className={styles.brandContainer}>
                <BTableCard />
            </div>
        </>
    );
}
