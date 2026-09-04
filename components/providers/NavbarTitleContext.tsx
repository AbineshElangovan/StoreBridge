'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface NavbarTitleContextType {
  customTitle: string | null;
  setCustomTitle: (title: string | null) => void;
}

const NavbarTitleContext = createContext<NavbarTitleContextType>({
  customTitle: null,
  setCustomTitle: () => {},
});

export function NavbarTitleProvider({ children }: { children: ReactNode }) {
  const [customTitle, setCustomTitle] = useState<string | null>(null);

  return (
    <NavbarTitleContext.Provider value={{ customTitle, setCustomTitle }}>
      {children}
    </NavbarTitleContext.Provider>
  );
}

export function useNavbarTitle() {
  return useContext(NavbarTitleContext);
}
