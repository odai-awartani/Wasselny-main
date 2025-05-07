import React, { useState } from 'react';
import { View, Text, Switch, TouchableOpacity, Share, Platform, Linking } from 'react-native';
import { DrawerContentScrollView, DrawerContentComponentProps } from '@react-navigation/drawer';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLanguage } from '@/context/LanguageContext';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { useLocationStore } from '@/store';

interface MenuItemProps {
  icon: string;
  label: string;
  onPress?: () => void;
  iconBg?: string;
  iconColor?: string;
  labelBold?: boolean;
  trailingComponent?: React.ReactNode;
  trailingText?: string;
  subtext?: string;
}

export default function SideMenu(props: DrawerContentComponentProps) {
  const { language, setLanguage } = useLanguage();
  const { userAddress } = useLocationStore();
  const { signOut } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const isRTL = false; // Set to true if you want RTL support

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
    <DrawerContentScrollView
      {...props}
      contentContainerStyle={{
        flexGrow: 1,
        backgroundColor: '#fff',
        borderTopRightRadius: 22,
        borderBottomRightRadius: 22,
        paddingHorizontal: 16,
        paddingTop: 32,
        paddingBottom: 12,
      }}
    >
        <Text style={{ fontSize: 28, fontWeight: 'bold', marginBottom: 16 }}>Settings</Text>
        {/* User Info Section */}
        <View style={{ marginBottom: 18, alignItems: 'flex-start' }}>
          <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#f97316', marginBottom: 2 }}>
            {user?.fullName || user?.firstName || 'User'}
          </Text>
          {user?.phoneNumbers && user.phoneNumbers.length > 0 && user.phoneNumbers[0]?.phoneNumber && (
            <Text style={{ fontSize: 15, color: '#444', marginBottom: 1 }}>{user.phoneNumbers[0].phoneNumber}</Text>
          )}
          {user?.primaryEmailAddress?.emailAddress && (
            <Text style={{ fontSize: 15, color: '#666' }}>{user.primaryEmailAddress.emailAddress}</Text>
          )}
        </View>
        {/* Decorative Orange Line */}
        <View style={{ height: 3, backgroundColor: '#f97316', borderRadius: 2, marginBottom: 20, width: '100%' }} />
        {/* Preferences Section */}
        <Text style={{ color: '#9ca3af', fontSize: 13, marginBottom: 8, fontWeight: '600' }}>Preferences</Text>
        <MenuItem
          icon="language"
          label="Language"
          onPress={toggleLanguage}
          iconBg="#f97316"
          iconColor="#fff"
          labelBold
          trailingText={language === 'ar' ? 'العربية' : 'English'}
        />
        <MenuItem
          icon="notifications"
          label="Notifications"
          trailingComponent={<Switch value={notificationsEnabled} onValueChange={toggleNotifications} />}
          iconBg="#f97316"
          iconColor="#fff"
          labelBold
        />
        <MenuItem
          icon="location-on"
          label="Location"
          onPress={toggleLocation}
          iconBg="#f97316"
          iconColor="#fff"
          labelBold
          subtext={userAddress || 'الموقع الحالي'}
        />
        {/* Support Section */}
        <View style={{ height: 24 }} />
        <Text style={{ color: '#9ca3af', fontSize: 13, marginBottom: 8, fontWeight: '600' }}>Support</Text>
        <MenuItem
          icon="share"
          label="Share App"
          onPress={handleShare}
          iconBg="#f97316"
          iconColor="#fff"
          labelBold
        />
        <MenuItem
          icon="star"
          label="Rate Us"
          onPress={handleRate}
          iconBg="#f97316"
          iconColor="#fff"
          labelBold
        />
        <MenuItem
          icon="privacy-tip"
          label="Privacy Policy"
          onPress={() => router.push('/(root)/privacy-policy')}
          iconBg="#f97316"
          iconColor="#fff"
          labelBold
        />
        <MenuItem
          icon="help-outline"
          label="Help & Support"
          onPress={() => router.push('/(root)/help')}
          iconBg="#f97316"
          iconColor="#fff"
          labelBold
        />
        {/* Account Section */}
        <View style={{ flex: 1 }} />
        <View style={{ height: 24 }} />
        <Text style={{ color: '#9ca3af', fontSize: 13, marginBottom: 8, fontWeight: '600' }}>Account</Text>
        <MenuItem
          icon="logout"
          label="Logout"
          onPress={async () => { await signOut(); }}
          iconBg="#fee2e2"
          iconColor="#ef4444"
          labelBold
        />
    </DrawerContentScrollView>
  );

// Helper MenuItem component
function MenuItem({ icon, label, onPress, iconBg, iconColor, labelBold, trailingComponent, trailingText, subtext }: MenuItemProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        minHeight: 44,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: iconBg || '#f3f4f6',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 14,
        }}
      >
        <MaterialIcons name={icon} size={22} color={iconColor || '#f97316'} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, fontWeight: labelBold ? 'bold' : '500', color: '#222' }}>{label}
          {trailingText ? <Text style={{ color: '#6b7280', fontSize: 14 }}>  {trailingText}</Text> : null}
        </Text>
        {subtext ? <Text style={{ color: '#6b7280', fontSize: 13, marginTop: 2 }}>{subtext}</Text> : null}
      </View>
      {trailingComponent ? trailingComponent : null}
    </TouchableOpacity>
  );
}

}
