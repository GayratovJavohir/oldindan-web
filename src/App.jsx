import React from 'react'
import { AppProviders } from './providers/AppProviders';
import "./styles/styles.css"
import AppRoutes from './routes/AppRoutes';

export default function App() {
  return (
    <AppProviders>
      <AppRoutes />
    </AppProviders>
  )
}
