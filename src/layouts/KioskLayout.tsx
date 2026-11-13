// ==============================================================================
// PlantãoPS - Layout Quiosque (Item 3.3 & 2.7)
// Modo tela cheia sem menus ou elementos de navegação, pensado para TVs
// ==============================================================================

import React from 'react';
import { Outlet } from 'react-router-dom';

export const KioskLayout: React.FC = () => {
  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#090d16',
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
