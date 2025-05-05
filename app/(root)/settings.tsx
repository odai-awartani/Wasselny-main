import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Switch, Share, Platform, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLanguage } from '@/context/LanguageContext';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@clerk/clerk-expo';

export default function SettingsScreen() {
  const router = useRouter();
  const { language, setLanguage } = useLanguage();
  const { signOut } = useAuth();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [locationEnabled, setLocationEnabled] = useState(true);

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

  const SettingItem = ({ 
    icon, 
    title, 
    onPress, 
    showSwitch = false, 
    switchValue = false, 
    onSwitchChange = () => {} 
  }) => (
    <TouchableOpacity
      onPress={onPress}
      className="flex-row items-center justify-between p-4 bg-white"
      style={{
        flexDirection: language === 'ar' ? 'row-reverse' : 'row',
      }}
      activeOpacity={0.7}
    >
      <View className="flex-row items-center" style={{ flexDirection: language === 'ar' ? 'row-reverse' : 'row' }}>
        <View className="w-10 h-10 rounded-full bg-orange-50 items-center justify-center">
          <MaterialIcons name={icon} size={24} color="#f97316" />
        </View>
        <Text className={`text-base ${language === 'ar' ? 'mr-3' : 'ml-3'} ${language === 'ar' ? 'font-CairoBold' : 'font-JakartaBold'} text-gray-800`}>
          {title}
        </Text>
      </View>
      {showSwitch && (
        <Switch
          value={switchValue}
          onValueChange={onSwitchChange}
          trackColor={{ false: '#d1d5db', true: '#f97316' }}
          thumbColor={switchValue ? '#fff' : '#fff'}
        />
      )}
      <View className={`absolute bottom-0 h-[1px] bg-orange-200 ${language === 'ar' ? 'left-16 right-0' : 'right-16 left-0'}`} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="flex-1">
        <View className="py-4 px-5 bg-white border-b border-gray-100">
          <Text className={`text-2xl ${language === 'ar' ? 'font-CairoBold' : 'font-JakartaBold'} text-gray-800`}>
            {language === 'ar' ? 'الإعدادات' : 'Settings'}
          </Text>
        </View>

        <View className="mt-4">
          <View className="bg-white rounded-xl overflow-hidden">
            <SettingItem
              icon="language"
              title={language === 'ar' ? 'اللغة' : 'Language'}
              onPress={toggleLanguage}
            />
            <SettingItem
              icon="notifications"
              title={language === 'ar' ? 'الإشعارات' : 'Notifications'}
              showSwitch
              switchValue={notificationsEnabled}
              onSwitchChange={toggleNotifications}
            />
            <SettingItem
              icon="location-on"
              title={language === 'ar' ? 'الموقع' : 'Location'}
              showSwitch
              switchValue={locationEnabled}
              onSwitchChange={toggleLocation}
            />
            <SettingItem
              icon="share"
              title={language === 'ar' ? 'مشاركة التطبيق' : 'Share App'}
              onPress={handleShare}
            />
            <SettingItem
              icon="star"
              title={language === 'ar' ? 'تقييم التطبيق' : 'Rate Us'}
              onPress={handleRate}
            />
            <SettingItem
              icon="privacy-tip"
              title={language === 'ar' ? 'سياسة الخصوصية' : 'Privacy Policy'}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/(root)/privacy-policy');
              }}
            />
            <SettingItem
              icon="help-outline"
              title={language === 'ar' ? 'المساعدة والدعم' : 'Help & Support'}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/(root)/help');
              }}
            />
            <SettingItem
              icon="logout"
              title={language === 'ar' ? 'تسجيل الخروج' : 'Logout'}
              onPress={async () => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                await signOut();
                router.replace('/');
              }}
            />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
