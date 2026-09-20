import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from '../Bookings.module.css';

export default function BookingFilters({ onApplyFilters }) {
    const { t } = useTranslation();
    const [filters, setFilters] = useState({
        search: '',
        status: '',
        start_date: '',
        end_date: '',
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFilters((prev) => ({ ...prev, [name]: value }));
    };

    const handleApply = () => {
        onApplyFilters(filters);
    };

    const handleReset = () => {
        const cleared = {
            search: '',
            status: '',
            start_date: '',
            end_date: '',
        };
        setFilters(cleared);
        onApplyFilters(cleared);
    };

    return (
        <div className={styles.filters}>
            <input
                type="text"
                name="search"
                placeholder={t('bookings.searchPlaceholder')}
                className={styles.searchInput}
                value={filters.search}
                onChange={handleChange}
            />
            <select name="status" className={styles.selectInput} value={filters.status} onChange={handleChange}>
                <option value="">{t('bookings.allStatuses')}</option>
                <option value="Confirmed">{t('status.confirmed')}</option>
                <option value="Pending">{t('status.pending')}</option>
                <option value="Checked In">{t('status.checkedIn')}</option>
                <option value="Completed">{t('status.completed')}</option>
                <option value="Canceled">{t('status.canceled')}</option>
                <option value="No Show">{t('status.noShow')}</option>
            </select>

            <input
                type="text"
                name="start_date"
                placeholder="dd/mm/yyyy"
                className={styles.dateInput}
                value={filters.start_date}
                onFocus={(e) => { e.target.type = 'date'; }}
                onBlur={(e) => { if (!e.target.value) e.target.type = 'text'; }}
                onChange={handleChange}
            />
            <input
                type="text"
                name="end_date"
                placeholder="dd/mm/yyyy"
                className={styles.dateInput}
                value={filters.end_date}
                onFocus={(e) => { e.target.type = 'date'; }}
                onBlur={(e) => { if (!e.target.value) e.target.type = 'text'; }}
                onChange={handleChange}
            />
            <button type="button" className={styles.applyBtn} onClick={handleApply}>{t('common.apply')}</button>
            <button type="button" className={styles.applyBtn} onClick={handleReset}>{t('common.reset')}</button>
        </div>
    );
}
