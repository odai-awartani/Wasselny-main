import { Drawer } from 'expo-router/drawer'
import SideMenu from '@/components/SideMenu' // adjust path if needed
import React from 'react'
import { NotificationProvider } from '@/context/NotificationContext'

export default function RootLayout() {
  return (
    <NotificationProvider>
      <Drawer
        screenOptions={{
          headerShown: false,
          drawerStyle: {
            backgroundColor: 'transparent',
            width: 280,
          },
        }}
        drawerContent={() => <SideMenu />}
      >
        <Drawer.Screen
          name="(tabs)"
          options={{
            drawerLabel: 'Home',
          }}
        />
        <Drawer.Screen
          name="notifications"
          options={{
            drawerLabel: 'Notifications',
          }}
        />
        <Drawer.Screen
          name="profile"
          options={{
            drawerLabel: 'Profile',
          }}
        />
        <Drawer.Screen
          name="settings"
          options={{
            drawerLabel: 'Settings',
          }}
        />
        <Drawer.Screen
          name="find-ride"
          options={{
            drawerLabel: 'Find Ride',
          }}
        />
        <Drawer.Screen
          name="ride-details"
          options={{
            drawerLabel: 'Ride Details',
          }}
        />
        <Drawer.Screen
          name="profilePageEdit"
          options={{
            drawerLabel: 'Edit Profile',
          }}
        />
      </Drawer>
    </NotificationProvider>
  )
}