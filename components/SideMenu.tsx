import React, { useState } from 'react';
import { View, Text, Switch, TouchableOpacity, Share, Platform, Linking, Image } from 'react-native';
import { ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLanguage } from '@/context/LanguageContext';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { useLocationStore } from '@/store';

export default function SideMenu() {
  const { language, setLanguage } = useLanguage();
  const { userAddress } = useLocationStore();
  const { signOut } = useAuth();
  const { user } = useUser();
  const isRTL = false;

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [locationEnabled, setLocationEnabled] = useState(true);

  const toggleNotifications = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!notificationsEnabled) {
      const { status } = await Notifications.requestPermissionsAsync();
      setNotificationsEnabled(status === 'granted');
    } else {
      setNotificationsEnabled(false);
    }
  };

  const toggleLocation = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!locationEnabled) {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationEnabled(status === 'granted');
    } else {
      setLocationEnabled(false);
    }
  };

  const toggleLanguage = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLanguage(language === 'ar' ? 'en' : 'ar');
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: 'Check out Wasselny - Your Carpooling App!',
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleRate = () => {
    const storeUrl = Platform.select({
      ios: 'https://apps.apple.com/app/idYOUR_APP_ID',
      android: 'market://details?id=YOUR_APP_ID',
    });
    if (storeUrl) {
      Linking.openURL(storeUrl);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={{
        flexGrow: 1,
        backgroundColor: '#fff',
        paddingHorizontal: 18,
        paddingTop: 24,
        paddingBottom: 12,
      }}
      className="rounded-tr-[22px] rounded-br-[22px]"
    >
      {/* User Info Section */}
      <View className="mt-4 mb-6 items-center w-full">
        <Text className="text-xl font-bold text-black mb-1 text-center">
          {user?.fullName || user?.firstName || 'User'}
        </Text>
        {user?.primaryEmailAddress?.emailAddress && (
          <Text className="text-[15px] text-gray-500 text-center">{user.primaryEmailAddress.emailAddress}</Text>
        )}
      </View>

      {/* Decorative Orange Line */}
      <View className="h-[6px] w-full rounded bg-orange-100 mb-4" />

      {/* Combined Profile & Preferences Section */}
      <TouchableOpacity
        onPress={() => router.push('/(root)/profilePageEdit')}
        activeOpacity={0.7}
        className="flex-row items-center mb-3 min-h-[44px]"
      >
        <View className="w-9 h-9 rounded-full bg-orange-500 items-center justify-center mr-3.5">
          <MaterialIcons name="edit" size={22} color="#fff" />
        </View>
        <Text className="text-base font-bold text-gray-800">Edit Profile</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={toggleLanguage}
        activeOpacity={0.7}
        className="flex-row items-center mb-3 min-h-[44px]"
      >
        <View className="w-9 h-9 rounded-full bg-orange-500 items-center justify-center mr-3.5">
          <MaterialIcons name="language" size={22} color="#fff" />
        </View>
        <View className="flex-1">
          <Text className="text-base font-bold text-gray-800">Language</Text>
          <Text className="text-gray-500 text-sm">
            {language === 'ar' ? 'العربية' : 'English'}
          </Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={toggleNotifications}
        activeOpacity={0.7}
        className="flex-row items-center mb-3 min-h-[44px]"
      >
        <View className="w-9 h-9 rounded-full bg-orange-500 items-center justify-center mr-3.5">
          <MaterialIcons name="notifications" size={22} color="#fff" />
        </View>
        <View className="flex-1 flex-row items-center justify-between">
          <Text className="text-base font-bold text-gray-800">Notifications</Text>
          <Switch
            value={notificationsEnabled}
            onValueChange={toggleNotifications}
            trackColor={{ false: '#d1d5db', true: '#f97316' }}
            thumbColor="#fff"
          />
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={toggleLocation}
        activeOpacity={0.7}
        className="flex-row items-center mb-3 min-h-[44px]"
      >
        <View className="w-9 h-9 rounded-full bg-orange-500 items-center justify-center mr-3.5">
          <MaterialIcons name="location-on" size={22} color="#fff" />
        </View>
        <View className="flex-1">
          <Text className="text-base font-bold text-gray-800">Location</Text>
          <Text className="text-gray-500 text-[13px] mt-0.5">{userAddress || 'الموقع الحالي'}</Text>
        </View>
      </TouchableOpacity>
      {/* Divider after combined section */}
      <View style={{ height: 1, backgroundColor: '#f3f4f6', marginVertical: 10 }} />

      {/* Support Section */}
      <Text className="text-gray-400 text-xs mb-2 mt-2 font-semibold tracking-wide">Support</Text>
      <View className="mb-2">
        <TouchableOpacity
          onPress={handleShare}
          activeOpacity={0.7}
          className="flex-row items-center mb-3 min-h-[44px]"
        >
          <View className="w-9 h-9 rounded-full bg-orange-500 items-center justify-center mr-3.5">
            <MaterialIcons name="share" size={22} color="#fff" />
          </View>
          <Text className="text-base font-bold text-gray-800">Share App</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleRate}
          activeOpacity={0.7}
          className="flex-row items-center mb-3 min-h-[44px]"
        >
          <View className="w-9 h-9 rounded-full bg-orange-500 items-center justify-center mr-3.5">
            <MaterialIcons name="star" size={22} color="#fff" />
          </View>
          <Text className="text-base font-bold text-gray-800">Rate Us</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.push('/(root)/privacy-policy')}
          activeOpacity={0.7}
          className="flex-row items-center mb-3 min-h-[44px]"
        >
          <View className="w-9 h-9 rounded-full bg-orange-500 items-center justify-center mr-3.5">
            <MaterialIcons name="privacy-tip" size={22} color="#fff" />
          </View>
          <Text className="text-base font-bold text-gray-800">Privacy Policy</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.push('/(root)/help')}
          activeOpacity={0.7}
          className="flex-row items-center mb-3 min-h-[44px]"
        >
          <View className="w-9 h-9 rounded-full bg-orange-500 items-center justify-center mr-3.5">
            <MaterialIcons name="help-outline" size={22} color="#fff" />
          </View>
          <Text className="text-base font-bold text-gray-800">Help & Support</Text>
        </TouchableOpacity>
      </View>

      {/* Divider */}
      <View style={{ height: 1, backgroundColor: '#f3f4f6', marginVertical: 10 }} />

      {/* Account Section */}
      <Text className="text-gray-400 text-xs mb-2 mt-2 font-semibold tracking-wide">Account</Text>
      <TouchableOpacity
        onPress={async () => {
          await signOut();
        }}
        activeOpacity={0.7}
        className="flex-row items-center mb-3 min-h-[44px]"
        style={{ backgroundColor: '#fee2e2', borderRadius: 12 }}
      >
        <View className="w-9 h-9 rounded-full bg-red-100 items-center justify-center mr-3.5">
          <MaterialIcons name="logout" size={22} color="#ef4444" />
        </View>
        <Text className="text-base font-bold text-red-600">Logout</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}