import React from 'react';
import { Outlet } from 'react-router-dom';

export const KioskLayout: React.FC = () => {
  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#06332e',
        color: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Outlet />
    </div>
  );
};
