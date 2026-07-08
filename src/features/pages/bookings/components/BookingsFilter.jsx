import React, { useState } from 'react';
import styles from '../Bookings.module.css';

export default function BookingFilters({ onApplyFilters }) {
    const [filters, setFilters] = useState({
        search: '',
        status: '',
        start_date: '',
        end_date: '',
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
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
                placeholder="Search guest name, phone..."
                className={styles.searchInput}
                value={filters.search}
                onChange={handleChange}
            />
            <select name="status" className={styles.selectInput} value={filters.status} onChange={handleChange}>
                <option value="">All statuses</option>
                <option value="Confirmed">Confirmed</option>
                <option value="Pending">Pending</option>
                <option value="Checked In">Checked In</option>
                <option value="Completed">Completed</option>
                <option value="Canceled">Canceled</option>
                <option value="No Show">No Show</option>
            </select>

            <input
                type="text"
                name="start_date"
                placeholder="dd/mm/yyyy"
                className={styles.dateInput}
                value={filters.start_date}
                onFocus={(e) => (e.target.type = "date")}
                onBlur={(e) => !e.target.value && (e.target.type = "text")}
                onChange={handleChange}
            />
            <input
                type="text"
                name="end_date"
                placeholder="dd/mm/yyyy"
                className={styles.dateInput}
                value={filters.end_date}
                onFocus={(e) => (e.target.type = "date")}
                onBlur={(e) => !e.target.value && (e.target.type = "text")}
                onChange={handleChange}
            />
            <button className={styles.applyBtn} onClick={handleApply}>Apply</button>
            <button className={styles.applyBtn} onClick={handleReset}>Reset</button>
        </div>
    );
}