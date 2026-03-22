import React from 'react'
import { ConfigProvider, carbonDarkTheme } from '@agentscope-ai/design'
import { GatewayProvider } from './contexts/GatewayContext'
import { SnapshotProvider } from './contexts/SnapshotContext'
import { NavigationProvider } from './contexts/NavigationContext'
import AppShell from './layouts/AppShell'

export default function App() {
   return (
      <NavigationProvider>
         <GatewayProvider>
            <SnapshotProvider>
               <ConfigProvider {...carbonDarkTheme}>
                  <AppShell />
               </ConfigProvider>
            </SnapshotProvider>
         </GatewayProvider>
      </NavigationProvider>
   )
}
