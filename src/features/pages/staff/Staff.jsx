import React, { useState, useEffect } from 'react';
import styles from './Staff.module.css';

import { getOccupiedTables, getPartnerBookings } from '../../../services/bookings.services';
import { getPartnerTables } from '../../../services/tables.services';
import STableCard from './components/STableCard';

export default function Staff() {


  return (


    <>
      <header className={styles.staffHeader}>
        <h1 className={styles.staffTitle}>Staff</h1>
        <div className={styles.bellIcon}>🔔</div>
      </header>
      <div className={styles.staffContainer}>
        <STableCard />
      </div></>
  );
}