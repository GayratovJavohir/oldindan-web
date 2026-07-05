import React from 'react'
import styles from './Branch.module.css'
import BranchCard from './components/BranchCard'

const branchesData = [
    {
        id: 1,
        name: 'KFC Almazor',
        status: 'Active',
        location: 'Almazor district, Tashkent',
        phone: '+998712223344',
        floors: 2,
        tables: 6,
        fee: 5000,
        hasDeposit: false
    },
    {
        id: 2,
        name: 'KFC Chilonzor',
        status: 'Active',
        location: 'Chilonzor district, Tashkent',
        phone: '+998712445566',
        floors: 1,
        tables: 4,
        fee: 5000,
        hasDeposit: false
    },
    {
        id: 3,
        name: 'KFC Yunusabad',
        status: 'Inactive',
        location: 'Yunusabad, Tashkent',
        phone: '+998712667788',
        floors: 1,
        tables: 8,
        fee: 7000,
        hasDeposit: true
    }
];

export default function Branch() {
    return (
        <>
            <header className={styles.branchHeader}>
                <h1 className={styles.branchTitle}>Branches</h1>
                <button className={styles.addBranchBtn}>+ Add Branch</button>
            </header>

            <div className={styles.branchContainer}>
                {branchesData.map((item) => (
                    <BranchCard key={item.id} branch={item} />
                ))}
            </div>
        </>
    )
}