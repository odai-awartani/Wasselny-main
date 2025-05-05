import React, { useEffect, useState } from "react";
import { useUser, useAuth } from "@clerk/clerk-expo";
import { Image, ScrollView, Text, View, TouchableOpacity, Alert, ActivityIndicator, RefreshControl, Modal, StyleSheet, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLanguage } from '@/context/LanguageContext';
import { icons } from '@/constants';
import { AntDesign, MaterialCommunityIcons, Ionicons, FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import { useRouter } from "expo-router";
import { doc, getDoc, updateDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import * as ImagePicker from "expo-image-picker";
import { uploadImageToCloudinary } from "@/lib/upload";
import { translations } from '@/constants/languages';

interface UserData {
  driver?: {
    is_active: boolean;
    car_type: string;
    car_seats: number;
    car_image_url: string;
    profile_image_url: string;
    created_at: string;
  };
  profile_image_url?: string;
  role?: string;
}

const Profile = () => {
  const { user } = useUser();
  const { signOut } = useAuth();
  const { language } = useLanguage();
  const router = useRouter();
  const t = translations[language];
  
  // Add missing variables
  const totalRides = 24;
  const rating = 4.8;

  // Combine related states into a single state object
  const [userData, setUserData] = useState<{
    isDriver: boolean;
    isLoading: boolean;
    profileImage: string | null;
    data: UserData | null;
    isAdmin: boolean;
  }>({ 
    isDriver: false,
    isLoading: true,
    profileImage: null,
    data: null,
    isAdmin: false
  });
  
  const [isUploading, setIsUploading] = useState(false);
  const [showFullImage, setShowFullImage] = useState(false);
  const [showFullCarImage, setShowFullCarImage] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedCards, setExpandedCards] = useState({
    driverInfo: true,
    carImage: false,
    accountInfo: false
  });

  const phoneNumber = user?.unsafeMetadata?.phoneNumber as string || "+1 123-456-7890";

  const onRefresh = React.useCallback(() => {
    setIsRefreshing(true);
    fetchUserData().finally(() => setIsRefreshing(false));
  }, []);
  const handleSignOut = () => {
      signOut();
      router.replace("/(auth)/sign-in");
    };

  const fetchUserData = async (isMounted = true) => {
    if (!user?.id) {
      if (isMounted) {
        setUserData(prev => ({
          ...prev,
          isLoading: false,
          isDriver: false,
          profileImage: user?.imageUrl || null,
          isAdmin: false
        }));
      }
      return;
    }

    try {
      const userRef = doc(db, 'users', user.id);
      const userDoc = await getDoc(userRef);
      
      if (!isMounted) return;

      if (userDoc.exists()) {
        const data = userDoc.data() as UserData;
        console.log('User Data:', data); // Debug log
        console.log('Is Admin:', data.role === 'admin'); // Debug log
        
        setUserData({
          isDriver: !!data.driver?.is_active,
          isLoading: false,
          profileImage: data.driver?.profile_image_url || user?.imageUrl || null,
          data,
          isAdmin: data.role === 'admin'
        });
      } else {
        console.log('User document does not exist'); // Debug log
        setUserData(prev => ({
          ...prev,
          isDriver: false,
          isLoading: false,
          profileImage: user?.imageUrl || null,
          data: null,
          isAdmin: false
        }));
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      if (isMounted) {
        setUserData(prev => ({
          ...prev,
          isDriver: false,
          isLoading: false,
          profileImage: user?.imageUrl || null,
          isAdmin: false
        }));
      }
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchUserData();
    setIsRefreshing(false);
  };

  // Use a single effect to manage user data fetching
  useEffect(() => {
    let isMounted = true;
    fetchUserData(isMounted);

    return () => {
      isMounted = false;
    };
  }, [user?.id, user?.imageUrl]);


  const handleRegisterDriver = () => {
    router.push("/(root)/driverInfo");
  };

  const handleImagePick = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          language === 'ar' ? 'تم رفض الإذن' : 'Permission Denied',
          language === 'ar' ? 'يجب منح إذن للوصول إلى مكتبة الصور' : 'You need to grant permission to access media library.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled) return;

      const asset = result.assets[0];
      if (!asset?.uri) return;

      // Validate file type
      const fileExtension = asset.uri.split('.').pop()?.toLowerCase();
      if (!['jpg', 'jpeg', 'png'].includes(fileExtension || '')) {
        Alert.alert(
          language === 'ar' ? 'خطأ' : 'Error',
          language === 'ar' ? 'يجب اختيار صورة بصيغة JPG أو PNG' : 'Please select a JPG or PNG image.'
        );
        return;
      }

      // Show temporary local image while uploading
      setUserData(prev => ({ ...prev, profileImage: asset.uri }));
      setIsUploading(true);

      // Upload to Cloudinary
      const uploadedImageUrl = await uploadImageToCloudinary(asset.uri);

      if (!uploadedImageUrl) {
        throw new Error(language === 'ar' ? 'فشل في تحميل الصورة' : 'Failed to upload image');
      }

      // Update Firestore document
      if (user?.id) {
        const userRef = doc(db, 'users', user.id);
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists()) {
          const userData = userDoc.data() as UserData;
          // If user is a driver, update the profile image in driver data
          if (userData.driver?.is_active) {
            await updateDoc(userRef, {
              'driver.profile_image_url': uploadedImageUrl
            });
          } else {
            // If user is not a driver, update the profile image in user data
            await updateDoc(userRef, {
              profile_image_url: uploadedImageUrl
            });
          }
        } else {
          // Create a new user document with profile image
          await setDoc(userRef, {
            userId: user.id,
            email: user.primaryEmailAddress?.emailAddress,
            firstName: user.firstName,
            lastName: user.lastName,
            createdAt: new Date().toISOString(),
            profile_image_url: uploadedImageUrl
          });
        }

        // Update profile image state with the Cloudinary URL
        setUserData(prev => ({ ...prev, profileImage: uploadedImageUrl }));
        
        Alert.alert(
          language === 'ar' ? 'نجاح' : 'Success',
          language === 'ar' ? 'تم تحديث صورة البروفايل بنجاح' : 'Profile picture updated successfully'
        );
      }
    } catch (error) {
      console.error('Profile image upload error:', error);
      Alert.alert(
        language === 'ar' ? 'خطأ' : 'Error',
        language === 'ar' ? 'حدث خطأ أثناء تحديث صورة البروفايل' : 'Error updating profile picture'
      );
      // Revert to previous image if available
      setUserData(prev => ({ ...prev, profileImage: user?.imageUrl || null }));
    } finally {
      setIsUploading(false);
    }
  };

  const formatDate = (date: string) => {
    const d = new Date(date);
    const month = d.toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US', { month: 'long' });
    const year = d.getFullYear();
    return `${month} ${year}`;
  };

  const memberSince = formatDate("2024-04-01"); // Example date, replace with actual date

  const toggleCard = (cardName: keyof typeof expandedCards) => {
    setExpandedCards(prev => ({
      ...prev,
      [cardName]: !prev[cardName]
    }));
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={["#F97316"]}  
          tintColor="#F97316"
          />
        }
        className="px-5"
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header */}
        <View className="items-center mt-6 mb-4">
          <TouchableOpacity onPress={() => setShowFullImage(true)} className="relative">
            {userData.profileImage || user?.imageUrl ? (
              <Image
                source={{ uri: userData.profileImage || user?.imageUrl }}
                className="w-24 h-24 rounded-full"
              />
            ) : (
              <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#f97316' }}>
                <MaterialIcons name="person" size={60} color="#f97316" />
              </View>
            )}
            {isUploading && (
              <View className="absolute inset-0 bg-black/50 rounded-full items-center justify-center">
                <ActivityIndicator color="white" />
              </View>
            )}
            <TouchableOpacity 
              onPress={handleImagePick} 
              className={`absolute bottom-0 ${language === 'ar' ? 'left-0' : 'right-0'} bg-gray-800 rounded-full p-2`}
            >
              <MaterialCommunityIcons name="camera" size={16} color="white" />
            </TouchableOpacity>
          </TouchableOpacity>
          <Text className={`text-xl ${language === 'ar' ? 'font-Cairobold' : 'font-Jakartab'} mt-2`}>
            {user?.fullName || "John Doe"}
          </Text>
          <Text className="text-gray-500 text-sm mb-4">
            {user?.primaryEmailAddress?.emailAddress || "john@example.com"}
          </Text>

          {/* Action Icons */}
          <View className={`flex-row justify-center ${language === 'ar' ? 'space-x-reverse' : 'space-x-8'} space-x-8`}>
            <TouchableOpacity 
              onPress={() => router.push('/(root)/settings')}
              className="items-center"
            >
              <View className="bg-gray-100 p-3 rounded-full">
                <Ionicons name="settings-outline" size={20} color="#374151" />
              </View>
              <Text className={`text-xs text-gray-600 mt-1 ${language === 'ar' ? 'font-Cairobold' : 'font-Jakartab'}`}>
                {language === 'ar' ? 'الإعدادات' : 'Settings'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              onPress={() => Alert.alert(
                language === 'ar' ? 'قريباً' : 'Coming Soon',
                language === 'ar' ? 'ستكون ميزة التتبع متاحة قريباً' : 'Track feature will be available soon.'
              )}
              className="items-center"
            >
              <View className="bg-gray-100 p-3 rounded-full">
                <MaterialCommunityIcons name="map-marker-path" size={20} color="#374151" />
              </View>
              <Text className={`text-xs text-gray-600 mt-1 ${language === 'ar' ? 'font-Cairobold' : 'font-Jakartab'}`}>
                {language === 'ar' ? 'التتبع' : 'Track'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              onPress={handleSignOut}
              className="items-center"
            >
              <View className="bg-red-50 p-3 rounded-full">
                <MaterialCommunityIcons name="logout" size={20} color="#EF4444" />
              </View>
              <Text className={`text-xs text-gray-600 mt-1 ${language === 'ar' ? 'font-Cairobold' : 'font-Jakartab'}`}>
                {language === 'ar' ? 'تسجيل الخروج' : 'Sign Out'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View className={`flex-row justify-between w-full mt-4 ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
          <View className="items-center bg-white rounded-xl p-4 flex-1 mx-2" style={Platform.OS === 'android' ? styles.androidShadow : styles.iosShadow}>
            <Text className={`text-2xl ${language === 'ar' ? 'font-Cairobold' : 'font-Jakartab'}`}>{totalRides}</Text>
            <Text className={`text-gray-500 text-sm ${language === 'ar' ? 'font-Cairobold' : 'font-Jakartab'}`}>
              {language === 'ar' ? 'إجمالي الرحلات' : 'Total Rides'}
            </Text>
          </View>
          <View className="items-center bg-white rounded-xl p-4 flex-1 mx-2" style={Platform.OS === 'android' ? styles.androidShadow : styles.iosShadow}>
            <View className="flex-row items-center">
              <Text className={`text-2xl ${language === 'ar' ? 'font-Cairobold' : 'font-Jakartab'} mr-1`}>{rating}</Text>
              <Image source={icons.star} style={{ width: 20, height: 20 }} />
            </View>
            <Text className={`text-gray-500 text-sm ${language === 'ar' ? 'font-Cairobold' : 'font-Jakartab'}`}>
              {language === 'ar' ? 'التقييم' : 'Rating'}
            </Text>
          </View>
        </View>

        {/* Driver Information Section */}
        {userData.isDriver && (
          <>
            <TouchableOpacity 
              onPress={() => toggleCard('driverInfo')}
              className="bg-white rounded-xl p-5 mt-4" 
              style={Platform.OS === 'android' ? styles.androidShadow : styles.iosShadow}
            >
              <View className={`flex-row justify-between items-center ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
                <Text className={`text-lg ${language === 'ar' ? 'font-Cairobold' : 'font-Jakartab'}`}>
                  {language === 'ar' ? 'معلومات السائق' : 'Driver Information'}
                </Text>
                <AntDesign 
                  name={expandedCards.driverInfo ? 'up' : 'down'} 
                  size={20} 
                  color="#374151" 
                />
              </View>
              {expandedCards.driverInfo && (
                <View className="space-y-4 mt-4">
                  <View>
                    <Text className={`text-gray-500 text-sm mb-1 ${language === 'ar' ? 'font-Cairobold text-right' : 'font-Jakartab text-left'}`}>
                      {language === 'ar' ? 'نوع السيارة' : 'Car Type'}
                    </Text>
                    <View className="bg-gray-100 rounded-lg p-3 border border-gray-300">
                      <Text className={`${language === 'ar' ? 'font-Cairobold text-right' : 'font-Jakartab text-left'}`}>
                        {userData.data?.driver?.car_type || (language === 'ar' ? 'غير محدد' : 'Not specified')}
                      </Text>
                    </View>
                  </View>

                  <View>
                    <Text className={`text-gray-500 text-sm mb-1 ${language === 'ar' ? 'font-Cairobold text-right' : 'font-Jakartab text-left'}`}>
                      {language === 'ar' ? 'عدد المقاعد' : 'Number of Seats'}
                    </Text>
                    <View className="bg-gray-100 rounded-lg p-3 border border-gray-300">
                      <Text className={`${language === 'ar' ? 'font-Cairobold text-right' : 'font-Jakartab text-left'}`}>
                        {userData.data?.driver?.car_seats || 0}
                      </Text>
                    </View>
                  </View>

                  <View>
                    <Text className={`text-gray-500 text-sm mb-1 ${language === 'ar' ? 'font-Cairobold text-right' : 'font-Jakartab text-left'}`}>
                      {language === 'ar' ? 'تاريخ التسجيل' : 'Registration Date'}
                    </Text>
                    <View className="bg-gray-100 rounded-lg p-3 border border-gray-300">
                      <Text className={`${language === 'ar' ? 'font-Cairobold text-right' : 'font-Jakartab text-left'}`}>
                        {formatDate(userData.data?.driver?.created_at || '')}
                      </Text>
                    </View>
                  </View>

                  <View>
                    <Text className={`text-gray-500 text-sm mb-1 ${language === 'ar' ? 'font-Cairobold text-right' : 'font-Jakartab text-left'}`}>
                      {language === 'ar' ? 'حالة السائق' : 'Driver Status'}
                    </Text>
                    <View className={`flex-row ${language === 'ar' ? 'justify-end' : 'justify-start'}`}>
                      <View className={`px-3 py-1 rounded-full ${userData.data?.driver?.is_active ? 'bg-green-100' : 'bg-red-100'}`}>
                        <Text className={`text-sm ${userData.data?.driver?.is_active ? 'text-green-700' : 'text-red-700'} ${language === 'ar' ? 'font-Cairobold' : 'font-Jakartab'}`}>
                          {userData.data?.driver?.is_active ? (language === 'ar' ? 'نشط' : 'Active') : (language === 'ar' ? 'غير نشط' : 'Inactive')}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              )}
            </TouchableOpacity>

            {/* Car Image Card */}
            {userData.data?.driver?.car_image_url && (
              <TouchableOpacity 
                onPress={() => toggleCard('carImage')}
                className="bg-white rounded-xl p-5 mt-4" 
                style={Platform.OS === 'android' ? styles.androidShadow : styles.iosShadow}
              >
                <View className={`flex-row justify-between items-center ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
                  <Text className={`text-lg ${language === 'ar' ? 'font-Cairobold' : 'font-Jakartab'}`}>
                    {language === 'ar' ? 'صورة السيارة' : 'Car Image'}
                  </Text>
                  <AntDesign 
                    name={expandedCards.carImage ? 'up' : 'down'} 
                    size={20} 
                    color="#374151" 
                  />
                </View>
                {expandedCards.carImage && (
                  <View className="mt-4">
                    <TouchableOpacity onPress={() => setShowFullCarImage(true)}>
                      <Image
                        source={{ uri: userData.data.driver.car_image_url }}
                        className="w-full h-48 rounded-lg"
                        resizeMode="cover"
                      />
                    </TouchableOpacity>
                  </View>
                )}
              </TouchableOpacity>
            )}
          </>
        )}

        {/* Become a Driver Button */}
        {!userData.isDriver && (
          <TouchableOpacity
            onPress={handleRegisterDriver}
            className="bg-rose-50 rounded-xl p-5 mt-4"
          >
            <View className={`flex-row items-center justify-between ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
              <AntDesign name={language === 'ar' ? 'left' : 'right'} size={24} color="#F43F5E" />
              <View className={`flex-1 ${language === 'ar' ? 'items-end' : 'items-start'}`}>
                <Text className={`text-lg ${language === 'ar' ? 'font-CairoRegular' : 'font-JakartaBold'} text-rose-500`}>
                  {language === 'ar' ? 'كن سائقاً' : 'Become a Driver'}
                </Text>
                <Text className={`text-sm text-gray-500 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                  {language === 'ar' ? 'اكسب المال من خلال تقديم الرحلات' : 'Earn money by giving rides'}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        )}

        {/* Account Information */}
        <TouchableOpacity 
          onPress={() => toggleCard('accountInfo')}
          className="bg-white rounded-xl p-5 mt-4" 
          style={Platform.OS === 'android' ? styles.androidShadow : styles.iosShadow}
        >
          <View className={`flex-row justify-between items-center ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
            <Text className={`text-lg ${language === 'ar' ? 'font-Cairobold' : 'font-Jakartab'}`}>
              {language === 'ar' ? 'معلومات الحساب' : 'Account Information'}
            </Text>
            <AntDesign 
              name={expandedCards.accountInfo ? 'up' : 'down'} 
              size={20} 
              color="#374151" 
            />
          </View>
          {expandedCards.accountInfo && (
            <View className="space-y-4 mt-4">
              <View>
                <Text className={`text-gray-500 text-sm mb-1 ${language === 'ar' ? 'font-Cairobold text-right' : 'font-Jakartab text-left'}`}>
                  {language === 'ar' ? 'رقم الهاتف' : 'Phone Number'}
                </Text>
                <View className="bg-gray-100 rounded-lg p-3 border border-gray-300">
                  <Text className={`${language === 'ar' ? 'font-Cairobold text-right' : 'font-Jakartab text-left'}`}>
                    {phoneNumber}
                  </Text>
                </View>
              </View>
              <View>
                <Text className={`text-gray-500 text-sm mb-1 ${language === 'ar' ? 'font-Cairobold text-right' : 'font-Jakartab text-left'}`}>
                  {language === 'ar' ? 'عضو منذ' : 'Member Since'}
                </Text>
                <View className="bg-gray-100 rounded-lg p-3 border border-gray-300">
                  <Text className={`${language === 'ar' ? 'font-Cairobold text-right' : 'font-Jakartab text-left'}`}>
                    {memberSince}
                  </Text>
                </View>
              </View>
            </View>
          )}
        </TouchableOpacity>

        {/* Admin Section - Only visible to admins */}
        {userData.isAdmin && (
          <View className="bg-white rounded-xl p-5 mt-4">
            <Text className={`text-lg ${language === 'ar' ? 'font-CairoRegular' : 'font-JakartaBold'} mb-4`}>
              {language === 'ar' ? 'لوحة التحكم' : 'Admin Dashboard'}
            </Text>
            <View className="space-y-4">
              <TouchableOpacity
                onPress={() => router.push("/(root)/admin/driverApplications")}
                className={`flex-row items-center justify-between p-4 bg-gray-50 rounded-lg ${language === 'ar' ? 'flex-row-reverse' : ''}`}
              >
                <View className={`flex-row items-center ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
                  <MaterialCommunityIcons name="car" size={24} color="#F97316" />
                  <View className={language === 'ar' ? 'mr-3' : 'ml-3'}>
                    <Text className={`text-lg ${language === 'ar' ? 'font-CairoRegular' : 'font-JakartaBold'}`}>
                      {language === 'ar' ? 'طلبات السائقين' : 'Driver Applications'}
                    </Text>
                    <Text className={`text-gray-500 text-sm ${language === 'ar' ? 'font-CairoRegular' : 'font-JakartaBold'}`}>
                      {language === 'ar' ? 'إدارة طلبات التسجيل كسائق' : 'Manage driver registration requests'}
                    </Text>
                  </View>
                </View>
                <AntDesign name={language === 'ar' ? 'left' : 'right'} size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View className="h-32" />
      </ScrollView>

      {/* Full Image Modal */}
      <Modal
        visible={showFullImage}
        transparent={true}
        onRequestClose={() => setShowFullImage(false)}
      >
        <TouchableOpacity 
          className="flex-1 bg-black/90 items-center justify-center"
          onPress={() => setShowFullImage(false)}
          activeOpacity={1}
        >
          <Image
            source={{
              uri: userData.profileImage || user?.imageUrl || 'https://www.pngitem.com/pimgs/m/146-1468479_my-profile-icon-blank-profile-picture-circle-hd.png'
            }}
            className="w-80 h-80 rounded-xl"
            resizeMode="contain"
          />
        </TouchableOpacity>
      </Modal>

      {/* Full Car Image Modal */}
      <Modal
        visible={showFullCarImage}
        transparent={true}
        onRequestClose={() => setShowFullCarImage(false)}
      >
        <TouchableOpacity 
          className="flex-1 bg-black/90 items-center justify-center"
          onPress={() => setShowFullCarImage(false)}
          activeOpacity={1}
        >
          <Image
            source={{ uri: userData.data?.driver?.car_image_url }}
            className="w-full h-96"
            resizeMode="contain"
          />
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};
const styles = StyleSheet.create({
  androidShadow: {
    elevation: 5,
  },
  iosShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
});
export default Profile;