import { Stack } from 'expo-router'
import React from 'react'
import { NotificationProvider } from '@/context/NotificationContext'
import { useLanguage } from '@/context/LanguageContext'

const RootLayout = () => {
  const { language } = useLanguage();
  
  return (
    <NotificationProvider>
      <Stack>
               <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
               <Stack.Screen name="find-ride" options={{ headerShown: false }} />
               <Stack.Screen name="confirm-ride" options={{ headerShown: false }} />
               <Stack.Screen name="book-ride" options={{ headerShown: false }} /> 
               <Stack.Screen name="rideInfo" options={{ headerShown: false }} /> 
               <Stack.Screen name="carInfo" options={{ headerShown: false }} />
               <Stack.Screen name="locationInfo" options={{ headerShown: false }} />
               <Stack.Screen name="ride-details" options={{ headerShown: false }} />
               <Stack.Screen name="driver-profile" options={{ headerShown: false }} />
               <Stack.Screen name="chat" options={{ headerShown: false }} />
               <Stack.Screen name="driverInfo" options={{ headerShown: false }} />
               <Stack.Screen name="notifications" options={{ headerShown: false }} />
               <Stack.Screen name="test-notification" options={{ headerShown: false }} />
               <Stack.Screen name="profile" options={{ headerShown: false }} />
               <Stack.Screen name="create-ride" options={{ headerShown: false }} />
               <Stack.Screen name="admin" options={{ headerShown: false }} />
               <Stack.Screen name="ride-requests" options={{ headerShown: false }} />
               <Stack.Screen name="cityCheckpoints" options={{ headerShown: false }} />
               <Stack.Screen name="checkpointDetails" options={{ headerShown: false }} />
               <Stack.Screen name="ProfilePage" options={{ 
                 headerTitle: language === 'ar' ? 'الملف الشخصي' : 'Profile Page',
                 headerTitleStyle: {
                   fontFamily: language === 'ar' ? 'Cairo-Bold' : 'PlusJakartaSans-Bold',
                   fontSize: 18,
                 },
                 headerTitleAlign: 'center',
                 headerStyle: {
                   backgroundColor: 'white',
                 },
               }} />
               <Stack.Screen name="ProfilePageEdit" options={{
                   headerTitle: language === 'ar' ? 'تعديل الملف' : 'Profile Edit',
                   headerTitleStyle: {
                     fontFamily: language === 'ar' ? 'Cairo-Bold' : 'PlusJakartaSans-Bold',
                     fontSize: 18,
                   },
                   headerTitleAlign: 'center',
                 }}
               />
               <Stack.Screen name="help" options={{
                   headerTitle: language === 'ar' ? 'المساعدة والدعم' : 'Help & Support',
                   headerTitleStyle: {
                     fontFamily: language === 'ar' ? 'Cairo-Bold' : 'PlusJakartaSans-Bold',
                     fontSize: 18,
                   },
                   headerTitleAlign: 'center',
                 }}
               />
               <Stack.Screen name="privacy-policy" options={{
                   headerTitle: language === 'ar' ? 'سياسة الخصوصية' : 'Privacy Policy',
                   headerTitleStyle: {
                     fontFamily: language === 'ar' ? 'Cairo-Bold' : 'PlusJakartaSans-Bold',
                     fontSize: 18,
                   },
                   headerTitleAlign: 'center',
                 }}
               />
               <Stack.Screen name="location" options={{
                   headerTitle: language === 'ar' ? 'إدارة المواقع' : 'Manage Locations',
                   headerTitleStyle: {
                     fontFamily: language === 'ar' ? 'Cairo-Bold' : 'PlusJakartaSans-Bold',
                     fontSize: 18,
                   },
                   headerTitleAlign: 'center',
                 }}
               />
               


               



               
          
            </Stack>
    </NotificationProvider>
  )
}

export default RootLayout