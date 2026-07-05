import React from 'react';
import styles from '../Staff.module.css';

export default function STableCard() {
    return (
        <div className={styles.pageBrands}>
            <div className={styles.cardStaff}>

                <div className={styles.cardStaffHeader}>
                    <h2 className={styles.headerTitle}>Staff Members</h2>
                    <button className={styles.addBtn}>+ Add Staff </button>
                </div>

                <div className={styles.tableWrapper}>
                    <table className={styles.staffTable}>
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>NAME</th>
                                <th>EMAIL</th>
                                <th>ROLE</th>
                                <th>BRANCH</th>
                                <th>STATUS</th>
                                <th>ACTIONS</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>#1</td>
                                <td>Alisher Nazarov</td>
                                <td>manager@kfc-almazor.uz</td>
                                <td className={styles.role}>Manager</td>
                                <td>KFC Almazor</td>
                                <td className={styles.status}>active</td>
                                <td>
                                    <button className={styles.editBtn}>Edit</button>
                                    <button className={styles.deactiveBtn}>Deactive</button>
                                </td>
                            </tr>
                            <tr>
                                <td>#2</td>
                                <td>Zulfiya Rahimova</td>
                                <td>reception1@kfc-almazor.uz</td>
                                <td className={styles.role}>Receptionist</td>
                                <td>KFC Almazor</td>
                                <td className={styles.status}>Active</td>
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