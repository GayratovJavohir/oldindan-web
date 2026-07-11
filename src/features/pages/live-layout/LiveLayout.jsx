import React from 'react'
import PageHeader from '../../../components/header/PageHeader'
import styles from './LiveLayout.module.css'
import LiveFloor from './components/LiveFloor'

export default function LiveLayout() {
    return (
        <>
            <PageHeader title="Live View" />
            <div className={styles.liveLayoutContainer}>
                <LiveFloor />
            </div>
        </>
    )
}
