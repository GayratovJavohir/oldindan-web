import React from 'react';
import styles from '../Brand.module.css';

export default function BTableCard() {
    return (
        <div className={styles.pageBrands}>
            <div className={styles.cardBrand}>

                <div className={styles.cardBrandHeader}>
                    <h2 className={styles.headerTitle}>Brands</h2>
                    <button className={styles.addBtn}>+ Add Brand</button>
                </div>

                <div className={styles.tableWrapper}>
                    <table className={styles.brandTable}>
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>NAME</th>
                                <th>SLUG</th>
                                <th>OWNER</th>
                                <th>BRANCHES</th>
                                <th>CREATED</th>
                                <th>ACTIONS</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>#1</td>
                                <td className={styles.brandName}>KFC Uzbekistan</td>
                                <td className={styles.slug}>kfc-uzbekistan</td>
                                <td>Firdavs Karimov</td>
                                <td>3</td>
                                <td>2024-01-15</td>
                                <td>
                                    <button className={styles.editBtn}>Edit</button>
                                </td>
                            </tr>
                            <tr>
                                <td>#2</td>
                                <td className={styles.brandName}>Plov House</td>
                                <td className={styles.slug}>plov-house</td>
                                <td>Firdavs Karimov</td>
                                <td>1</td>
                                <td>2024-06-20</td>
                                <td>
                                    <button className={styles.editBtn}>Edit</button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

            </div>
        </div>
    );
}