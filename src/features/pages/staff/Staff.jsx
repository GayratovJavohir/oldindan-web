import React from 'react';
import PageHeader from '../../../components/header/PageHeader';
import styles from './Staff.module.css';
import STableCard from './components/STableCard';

export default function Staff() {
    return (
        <>
            <PageHeader title="Staff" />
            <div className={styles.staffContainer}>
                <STableCard />
            </div>
        </>
    );
}
