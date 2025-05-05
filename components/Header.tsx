import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useLanguage } from '@/context/LanguageContext';
import { useNotifications } from '@/context/NotificationContext';
import { useAuth, useUser } from '@clerk/clerk-expo';
import * as Haptics from 'expo-haptics';
import { useMenu } from '@/context/MenuContext';
import { icons } from '@/constants';

interface HeaderProps {
  pageTitle: string;
}

const Header: React.FC<HeaderProps> = ({ pageTitle }) => {
  const router = useRouter();
  const { language } = useLanguage();
  const { unreadCount } = useNotifications();
  const { user } = useUser();
  const { setIsMenuVisible } = useMenu();
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfileImage = async () => {
      if (user?.id) {
        try {
          const response = await fetch(`https://api.clerk.dev/v1/users/${user.id}`, {
            headers: {
              'Authorization': `Bearer ${process.env.EXPO_PUBLIC_CLERK_SECRET_KEY}`,
            },
          });
          const data = await response.json();
          setProfileImageUrl(data.image_url);
        } catch (error) {
          console.error('Error fetching profile image:', error);
        }
      }
    };

    fetchProfileImage();
  }, [user?.id]);

  return (
    <View className="bg-white border-b border-gray-200">
      <View className={`flex-row items-center justify-between px-4 py-3 ${language === 'ar' ? 'flex-row-reverse' : 'flex-row'}`}>
        {/* Left Section - Menu Icon */}
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setIsMenuVisible(true);
          }}
          className="p-2"
        >
          <MaterialIcons name="menu" size={28} color="#f97316" />
        </TouchableOpacity>

        {/* Center Section - Title */}
        <Text className={`text-xl font-CairoBold flex-1 text-center`}>
          {pageTitle === 'Home' && language === 'ar' ? 'الرئيسية' : pageTitle}
        </Text>

        {/* Right Section - Notifications and Profile */}
        <View className={`flex-row items-center ${language === 'ar' ? 'flex-row-reverse' : 'flex-row'}`}>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push('/(root)/notifications');
            }}
            className="p-2"
          >
            <View>
              <MaterialIcons name="notifications" size={24} color="#f97316" />
              {unreadCount > 0 && (
                <View className="absolute -top-1 -right-1 bg-red-500 rounded-full w-4 h-4 items-center justify-center">
                  <Text className="text-white text-xs">{unreadCount}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push('/(root)/profile');
            }}
            className={`p-2 ${language === 'ar' ? 'mr-2' : 'ml-2'}`}
          >
            {profileImageUrl ? (
              <Image
                source={{ uri: profileImageUrl }}
                className="w-8 h-8 rounded-full"
              />
            ) : (
              <View className="w-8 h-8 rounded-full bg-orange-500/20 items-center justify-center">
                <MaterialIcons name="person" size={20} color="#f97316" />
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export default Header;