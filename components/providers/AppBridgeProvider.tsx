"use client";

import React, { useEffect, useState } from "react";
import { AppProvider } from "@shopify/polaris";
import '@shopify/polaris/build/esm/styles.css';

export default function ShopifyProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const polarisProvider = (
    <AppProvider i18n={{}}>
      {children}
    </AppProvider>
  );

  return polarisProvider;
}