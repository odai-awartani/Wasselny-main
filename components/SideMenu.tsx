import React, { useEffect, useRef, useState } from 'react';
import { I18nManager, Dimensions, Pressable, ScrollView } from 'react-native';
import {
  View,
  Text,
  TouchableOpacity,
  Switch,
  Share,
  Platform,
  Linking,
  Animated,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLanguage } from '@/context/LanguageContext';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import { useAuth } from '@clerk/clerk-expo';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMenu } from '@/context/MenuContext';
import { useLocationStore } from '@/store';
import debounce from 'lodash/debounce';

const { width, height } = Dimensions.get('window');

// =======================
// Menu Section Component
// =======================
const MenuSection = ({
  title,
  children,
  isRTL,
  style,
}: {
  title?: string;
  children: React.ReactNode;
  isRTL: boolean;
  style?: any;
}) => (
  <View className="mb-6" style={style}>
    {title && (
      <Text
        className={`text-sm font-medium text-gray-500 mb-3 px-4 ${
          isRTL ? 'font-Cairo' : 'font-Jakarta'
        }`}
        style={{ textAlign: isRTL ? 'right' : 'left' }}
      >
        {title}
      </Text>
    )}
    <View className="bg-white rounded-xl overflow-hidden shadow-sm">{children}</View>
  </View>
);

// =======================
// Setting Item Component
// =======================
const SettingItem = ({
  icon,
  title,
  onPress,
  showSwitch = false,
  switchValue = false,
  onSwitchChange = () => {},
  subtitle,
  showChevron = false,
  isRTL = false,
  showDivider = true,
}: {
  icon: string;
  title: string;
  onPress: () => void;
  showSwitch?: boolean;
  switchValue?: boolean;
  onSwitchChange?: () => void;
  subtitle?: string;
  showChevron?: boolean;
  isRTL: boolean;
  showDivider?: boolean;
}) => (
  <TouchableOpacity
    onPress={onPress}
    className="flex-row items-center justify-between p-4 min-h-[64px]"
    style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}
    activeOpacity={0.7}
    accessible={true}
    accessibilityRole="button"
  >
    <View 
      className="flex-row items-center flex-1" 
      style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}
    >
      <View 
        className="w-10 h-10 rounded-full bg-orange-500/10 items-center justify-center"
        style={{ marginHorizontal: isRTL ? 12 : 0, marginLeft: isRTL ? 0 : 12 }}
      >
        <MaterialIcons 
          name={icon as any} 
          size={24} 
          color="#f97316"
          style={{ transform: [{ scaleX: isRTL ? -1 : 1 }] }}
        />
      </View>
      <View className={`flex-1 ${isRTL ? 'mr-3' : 'ml-3'}`}>
        <Text 
          className={`text-base ${isRTL ? 'font-CairoBold' : 'font-JakartaBold'} text-gray-800`}
          style={{ textAlign: isRTL ? 'right' : 'left' }}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text 
            className={`text-sm ${isRTL ? 'font-Cairo' : 'font-Jakarta'} text-gray-500 mt-1`}
            style={{ textAlign: isRTL ? 'right' : 'left' }}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>

    {showSwitch && (
      <Switch
        value={switchValue}
        onValueChange={onSwitchChange}
        trackColor={{ false: '#d1d5db', true: '#f97316' }}
        thumbColor="#fff"
        style={{ 
          marginLeft: isRTL ? 0 : 'auto', 
          marginRight: isRTL ? 'auto' : 0,
          transform: [{ scaleX: isRTL ? -1 : 1 }]
        }}
      />
    )}

    {showChevron && (
      <MaterialIcons 
        name={isRTL ? "chevron-left" : "chevron-right"} 
        size={24} 
        color="#9ca3af"
      />
    )}
    {showDivider && (
      <View 
        className="absolute bottom-0 h-[1px] bg-gray-100" 
        style={{ 
          left: isRTL ? 16 : 64, 
          right: isRTL ? 64 : 16 
        }} 
      />
    )}
  </TouchableOpacity>
);

// =======================
// Main SideMenu Component
// =======================
const SideMenu: React.FC = () => {
  const { language, setLanguage } = useLanguage();
  const { isMenuVisible, setIsMenuVisible } = useMenu();
  const { userAddress } = useLocationStore();
  const { signOut } = useAuth();
  const router = useRouter();
  const isRTL = I18nManager.isRTL;

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [locationEnabled, setLocationEnabled] = useState(true);
  const translateX = useRef(new Animated.Value(0)).current;
  const [shouldRenderMenu, setShouldRenderMenu] = useState(false);

  useEffect(() => {
    const offset = isRTL ? width : -width;
    if (isMenuVisible) {
      setShouldRenderMenu(true);
      translateX.setValue(offset);
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else if (shouldRenderMenu) {
      Animated.spring(translateX, {
        toValue: offset,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start(() => setShouldRenderMenu(false));
    }
  }, [isMenuVisible, isRTL, width]);

  if (!shouldRenderMenu) return null;

  const handleOverlayPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsMenuVisible(false);
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
    <View className="absolute inset-0 z-50" style={{ flex: 1 }} pointerEvents="box-none">
      {/* Overlay */}
      <Pressable
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          zIndex: 1,
        }}
        onPress={handleOverlayPress}
      />

      {/* Menu Panel */}
      <Animated.View
        className="absolute bg-gray-50"
        pointerEvents="box-none"
        style={{
          transform: [{ translateX }],
          width: width * 0.85,
          height,
          top: 0,
          right: isRTL ? 0 : undefined,
          left: isRTL ? undefined : 0,
          borderTopLeftRadius: isRTL ? 0 : 20,
          borderBottomLeftRadius: isRTL ? 0 : 20,
          borderTopRightRadius: isRTL ? 20 : 0,
          borderBottomRightRadius: isRTL ? 20 : 0,
          zIndex: 1000,
          elevation: 10,
          shadowColor: '#000',
          shadowOffset: { width: isRTL ? 2 : -2, height: 0 },
          shadowOpacity: 0.25,
          shadowRadius: 3.84,
        }}
      >
        <SafeAreaView className="flex-1">
          {/* Close Button */}
          <View style={{ position: 'absolute', top: 38, [isRTL ? 'left' : 'right']: 12, zIndex: 10 }}>
            <TouchableOpacity
              onPress={() => setIsMenuVisible(false)}
              style={{
                backgroundColor: '#fff',
                borderRadius: 16,
                padding: 6,
                elevation: 3,
                alignSelf: isRTL ? 'flex-start' : 'flex-end',
              }}
            >
              <MaterialIcons name="close" size={16} color="#f97316" />
            </TouchableOpacity>
          </View>

          {/* Header */}
          <View className="py-3 px-5 border-b border-gray-200">
            <Text 
              className={`text-2xl ${isRTL ? 'font-CairoBold' : 'font-JakartaBold'} text-gray-800`}
              style={{ textAlign: isRTL ? 'right' : 'left' }}
            >
              {isRTL ? 'الإعدادات' : 'Settings'}
            </Text>
          </View>

          {/* Scrollable Menu Content */}
          <ScrollView 
            className="flex-1"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ 
              paddingHorizontal: 16, 
              paddingTop: 12,
              paddingBottom: 8
            }}
            bounces={false}
          >
            {/* Preferences Section */}
            <MenuSection title={isRTL ? "التفضيلات" : "Preferences"} isRTL={isRTL} style={{ marginBottom: 4 }}>
              <SettingItem 
                icon="language" 
                title={isRTL ? 'اللغة' : 'Language'} 
                subtitle={isRTL ? (language === 'ar' ? 'العربية' : 'English') : (language === 'ar' ? 'Arabic' : 'English')}
                onPress={toggleLanguage} 
                isRTL={isRTL}
                showChevron
              />
              <SettingItem
                icon="notifications"
                title={isRTL ? 'الإشعارات' : 'Notifications'}
                showSwitch
                switchValue={notificationsEnabled}
                onSwitchChange={toggleNotifications}
                onPress={() => {}}
                isRTL={isRTL}
              />
              <SettingItem
                icon="location-on"
                title={isRTL ? 'الموقع' : 'Location'}
                subtitle={userAddress || (isRTL ? 'جاري تحميل الموقع...' : 'Loading location...')}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push('/(root)/location-picker' as any);
                  setIsMenuVisible(false);
                }}
                showChevron
                isRTL={isRTL}
              />
            </MenuSection>

            {/* App Actions Section */}
            <MenuSection title={isRTL ? "إجراءات التطبيق" : "App Actions"} isRTL={isRTL} style={{ marginBottom: 4 }}>
              <SettingItem 
                icon="share" 
                title={isRTL ? 'مشاركة التطبيق' : 'Share App'} 
                onPress={handleShare} 
                isRTL={isRTL}
              />
              <SettingItem 
                icon="star" 
                title={isRTL ? 'تقييم التطبيق' : 'Rate Us'} 
                onPress={handleRate} 
                isRTL={isRTL}
              />
            </MenuSection>

            {/* Information & Support Section */}
            <MenuSection title={isRTL ? "المعلومات والدعم" : "Information & Support"} isRTL={isRTL} style={{ marginBottom: 4 }}>
              <SettingItem
                icon="privacy-tip"
                title={isRTL ? 'سياسة الخصوصية' : 'Privacy Policy'}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push('/(root)/privacy-policy' as any);
                  setIsMenuVisible(false);
                }}
                isRTL={isRTL}
              />
              <SettingItem
                icon="help-outline"
                title={isRTL ? 'المساعدة والدعم' : 'Help & Support'}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push('/(root)/help' as any);
                  setIsMenuVisible(false);
                }}
                isRTL={isRTL}
              />
            </MenuSection>

            {/* Account Section */}
            <MenuSection title={isRTL ? "الحساب" : "Account"} isRTL={isRTL} style={{ marginBottom: 0 }}>
              <SettingItem
                icon="logout"
                title={isRTL ? 'تسجيل الخروج' : 'Logout'}
                onPress={async () => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  await signOut();
                  setIsMenuVisible(false);
                }}
                isRTL={isRTL}
                showDivider={false}
              />
            </MenuSection>
          </ScrollView>
        </SafeAreaView>
      </Animated.View>
    </View>
  );
};

export default SideMenu;
