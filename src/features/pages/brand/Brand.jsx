import React from 'react';
import PageHeader from '../../../components/header/PageHeader';
import styles from './Brand.module.css';
import BTableCard from './components/TableCard';

export default function Brand() {
    return (
        <>
            <PageHeader title="Brands" />
            <div className={styles.brandContainer}>
                <BTableCard />
            </div>
        </>
    );
}
