'use client'

import * as React from 'react'
import {
  ThemeProvider as NextThemesProvider,
  type ThemeProviderProps,
} from 'next-themes'
import { useEffect } from 'react';
import { useState } from 'react';

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {

  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true)
  }, [])
  
  if (!hydrated) {
    return null
  }
  
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
