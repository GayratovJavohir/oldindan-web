import React from 'react'
import PageHeader from '../../../components/header/PageHeader'
import styles from './Floor.module.css'
import LayoutFloor from './components/LayoutFloor'

export default function Layout() {
    return (
        <>
            <PageHeader title="Floor Layout" />
            <div className={styles.layoutContainer}>
                <LayoutFloor />
            </div>
        </>
    )
}
