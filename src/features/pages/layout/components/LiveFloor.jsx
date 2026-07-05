import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { LogIn, Monitor, Bath } from 'lucide-react';
import styles from '../Floor.module.css';

const tablesData = [
    { id: 'T1', type: 'circle', top: 120, left: 100, status: 'available', seats: 4 },
    { id: 'T2', type: 'square', top: 120, left: 250, status: 'checkedIn', seats: 4 },
    { id: 'T3', type: 'circle', top: 120, left: 400, status: 'confirmed', seats: 6 },
    { id: 'T7', type: 'circle', top: 150, left: 580, status: 'available', seats: 2 },
    { id: 'T4', type: 'rect', top: 350, left: 100, status: 'pending', seats: 8 },
    { id: 'T5', type: 'circle', top: 350, left: 280, status: 'available', seats: 4 },
    { id: 'T6', type: 'square', top: 350, left: 430, status: 'available', seats: 4 },
    { id: 'T8', type: 'square', top: 350, left: 580, status: 'available', seats: 4 },
];

const staticElements = [
    { id: 'Entrance', icon: LogIn, top: 80, left: 750, type: 'door' },
    { id: 'Cashier', icon: Monitor, top: 250, left: 750, type: 'facility' },
    { id: 'WC', icon: Bath, top: 350, left: 750, type: 'facility' },
];

export default function LiveFloor() {
    const [tables, setTables] = useState(tablesData);

    return (
        <div className={styles.floorContainer}>
            <header className={styles.header}>
                <div className={styles.legend}>
                    <span className={styles.legendItem}><div className={`${styles.dot} ${styles.availableDot}`}></div> Available</span>
                    <span className={styles.legendItem}><div className={`${styles.dot} ${styles.pendingDot}`}></div> Pending</span>
                    <span className={styles.legendItem}><div className={`${styles.dot} ${styles.confirmedDot}`}></div> Confirmed</span>
                    <span className={styles.legendItem}><div className={`${styles.dot} ${styles.checkedInDot}`}></div> Checked In</span>
                </div>
            </header>

            <div className={styles.canvas}>
                {tables.map((table) => (
                    <motion.div
                        key={table.id}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className={`${styles.tableWrapper} ${styles[table.type]} ${styles[table.status]}`}
                        style={{ top: table.top, left: table.left }}
                    >
                        <div className={styles.tableInner}>
                            <span className={styles.tableName}>{table.id}</span>
                            <span className={styles.tableSeats}>{table.seats} seats</span>
                        </div>
                        <div className={styles.chairTop}></div>
                        <div className={styles.chairBottom}></div>
                        {table.seats > 2 && (
                            <>
                                <div className={styles.chairLeft}></div>
                                <div className={styles.chairRight}></div>
                            </>
                        )}
                    </motion.div>
                ))}

                {staticElements.map((el) => {
                    const Icon = el.icon;
                    return (
                        <div
                            key={el.id}
                            className={`${styles.staticElement} ${styles[el.type]}`}
                            style={{ top: el.top, left: el.left }}
                        >
                            <Icon size={20} className={styles.staticIcon} />
                            <span className={styles.staticName}>{el.id}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}