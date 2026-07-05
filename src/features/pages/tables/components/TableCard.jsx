import React from 'react';
import styles from '../Table.module.css';

export default function TableCard() {
    return (
        <div className={styles.pageTables}>
            <div className={styles.cardTable}>

                <div className={styles.cardTableHeader}>
                    <h2 className={styles.headerTitle}>Tables</h2>
                    <div className={styles.buttonWrapper}>
                        <select id="floors" name="floors">
                            <option value=""> All floors</option>
                            <option value="floor1">Floor 1</option>
                            <option value="floor2">Floor 2</option>
                        </select>
                        <button className={styles.addBtn}>+ Add Table </button>
                    </div>
                </div>

                <div className={styles.tableWrapper}>
                    <table className={styles.Table}>
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>NAME</th>
                                <th>BRANCH</th>
                                <th>FLOOR</th>
                                <th>ZONE</th>
                                <th>SEATS</th>
                                <th>SHAPE</th>
                                <th>STATUS</th>
                                <th>ACTIONS</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>#1</td>
                                <td>T1</td>
                                <td>KFC Almazor</td>
                                <td>Floor 1</td>
                                <td>VIP</td>
                                <td>2</td>
                                <td>round</td>
                                <td className={styles.status}>active</td>
                                <td>
                                    <button className={styles.editBtn}>Edit</button>
                                    <button className={styles.deactiveBtn}>Deactive</button>
                                </td>
                            </tr>
                            <tr>
                                <td>#2</td>
                                <td>T2</td>
                                <td>KFC Chilanzar</td>
                                <td>Floor 1</td>
                                <td>Indoor</td>
                                <td>4</td>
                                <td>rect</td>
                                <td className={styles.status}>active</td>
                                <td>
                                    <button className={styles.editBtn}>Edit</button>
                                    <button className={styles.deactiveBtn}>Deactive</button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

            </div>
        </div>
    );
}