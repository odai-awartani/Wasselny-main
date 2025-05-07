import React, { useEffect, useState } from "react";
import { useUser, useAuth } from "@clerk/clerk-expo";
import { Image, ScrollView, Text, View, TouchableOpacity, Alert, ActivityIndicator, RefreshControl, Modal, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLanguage } from '@/context/LanguageContext';
import { AntDesign, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { useRouter } from "expo-router";
import { doc, getDoc, updateDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { uploadImageToCloudinary } from "@/lib/upload";
import * as ImagePicker from "expo-image-picker";

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

const ProfileEdit = () => {
  const { user } = useUser();
  const { signOut } = useAuth();
  const { language } = useLanguage();
  const router = useRouter();

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
    isAdmin: false,
  });

  const [isUploading, setIsUploading] = useState(false);
  const [showFullImage, setShowFullImage] = useState(false);
  const [showFullCarImage, setShowFullCarImage] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({
    carType: '',
    carSeats: '',
    phoneNumber: '',
  });

  const phoneNumber = user?.unsafeMetadata?.phoneNumber as string || "+972342423423";

  const fetchUserData = async (isMounted = true) => {
    if (!user?.id) {
      if (isMounted) {
        setUserData(prev => ({
          ...prev,
          isLoading: false,
          isDriver: false,
          profileImage: user?.imageUrl || null,
          isAdmin: false,
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
        setUserData({
          isDriver: !!data.driver?.is_active,
          isLoading: false,
          profileImage: data.driver?.profile_image_url || user?.imageUrl || null,
          data,
          isAdmin: data.role === 'admin',
        });
        setEditValues({
          carType: data.driver?.car_type || 'Not specified',
          carSeats: data.driver?.car_seats?.toString() || '0',
          phoneNumber: phoneNumber,
        });
      } else {
        setUserData(prev => ({
          ...prev,
          isDriver: false,
          isLoading: false,
          profileImage: user?.imageUrl || null,
          data: null,
          isAdmin: false,
        }));
        setEditValues({
          carType: 'Not specified',
          carSeats: '0',
          phoneNumber: phoneNumber,
        });
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      if (isMounted) {
        setUserData(prev => ({
          ...prev,
          isDriver: false,
          isLoading: false,
          profileImage: user?.imageUrl || null,
          isAdmin: false,
        }));
      }
    }
  };

  useEffect(() => {
    let isMounted = true;
    fetchUserData(isMounted);

    return () => {
      isMounted = false;
    };
  }, [user?.id, user?.imageUrl]);

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

      const fileExtension = asset.uri.split('.').pop()?.toLowerCase();
      if (!['jpg', 'jpeg', 'png'].includes(fileExtension || '')) {
        Alert.alert(
          language === 'ar' ? 'خطأ' : 'Error',
          language === 'ar' ? 'يجب اختيار صورة بصيغة JPG أو PNG' : 'Please select a JPG or PNG image.'
        );
        return;
      }

      setUserData(prev => ({ ...prev, profileImage: asset.uri }));
      setIsUploading(true);

      const uploadedImageUrl = await uploadImageToCloudinary(asset.uri);

      if (!uploadedImageUrl) {
        throw new Error(language === 'ar' ? 'فشل في تحميل الصورة' : 'Failed to upload image');
      }

      if (user?.id) {
        const userRef = doc(db, 'users', user.id);
        const userDoc = await getDoc(userRef);

        if (userDoc.exists()) {
          const userData = userDoc.data() as UserData;
          if (userData.driver?.is_active) {
            await updateDoc(userRef, {
              'driver.profile_image_url': uploadedImageUrl,
            });
          } else {
            await updateDoc(userRef, {
              profile_image_url: uploadedImageUrl,
            });
          }
        } else {
          await setDoc(userRef, {
            userId: user.id,
            email: user.primaryEmailAddress?.emailAddress,
            firstName: user.firstName,
            lastName: user.lastName,
            createdAt: new Date().toISOString(),
            profile_image_url: uploadedImageUrl,
          });
        }

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
      setUserData(prev => ({ ...prev, profileImage: user?.imageUrl || null }));
    } finally {
      setIsUploading(false);
    }
  };

  const handleEditField = async (field: string) => {
    if (!user?.id) return;

    try {
      const userRef = doc(db, 'users', user.id);
      if (field === 'carType') {
        await updateDoc(userRef, { 'driver.car_type': editValues.carType });
        setUserData(prev => ({
          ...prev,
          data: { ...prev.data, driver: { ...prev.data?.driver, car_type: editValues.carType } },
        }));
      } else if (field === 'carSeats') {
        const seats = parseInt(editValues.carSeats, 10);
        if (isNaN(seats) || seats < 1) {
          Alert.alert(
            language === 'ar' ? 'خطأ' : 'Error',
            language === 'ar' ? 'يرجى إدخال عدد مقاعد صالح' : 'Please enter a valid number of seats'
          );
          return;
        }
        await updateDoc(userRef, { 'driver.car_seats': seats });
        setUserData(prev => ({
          ...prev,
          data: { ...prev.data, driver: { ...prev.data?.driver, car_seats: seats } },
        }));
      } else if (field === 'phoneNumber') {
        await user?.update({ unsafeMetadata: { phoneNumber: editValues.phoneNumber } });
      }

      Alert.alert(
        language === 'ar' ? 'نجاح' : 'Success',
        language === 'ar' ? 'تم تحديث المعلومات بنجاح' : 'Information updated successfully'
      );
    } catch (error) {
      console.error(`Error updating ${field}:`, error);
      Alert.alert(
        language === 'ar' ? 'خطأ' : 'Error',
        language === 'ar' ? 'حدث خطأ أثناء تحديث المعلومات' : 'Error updating information'
      );
    } finally {
      setEditingField(null);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => {
              setIsRefreshing(true);
              fetchUserData().finally(() => setIsRefreshing(false));
            }}
            colors={["#F97316"]}
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
                className="w-28 h-28 rounded-full"
              />
            ) : (
              <View className="w-28 h-28 rounded-full bg-white items-center justify-center border-2 border-orange-500">
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
          <View className="flex-row items-center mt-2">
            <Text className={`text-xl font-bold ${language === 'ar' ? 'font-Cairobold' : 'font-Jakartab'}`}>
              {user?.fullName || "John Doe"}
            </Text>
          </View>
          <Text className="text-gray-500 text-sm mt-1">
            {user?.primaryEmailAddress?.emailAddress || "john@example.com"}
          </Text>
        </View>

        {/* Editable Fields */}
        {userData.isDriver && (
          <>
            {/* Car Type */}
            <View className="mb-4">
              <Text className="text-gray-500 text-sm mb-1">Car Type</Text>
              <View className="bg-gray-100 rounded-lg p-3 flex-row items-center justify-between">
                {editingField === 'carType' ? (
                  <TextInput
                    value={editValues.carType}
                    onChangeText={(text) => setEditValues(prev => ({ ...prev, carType: text }))}
                    className="flex-1 text-base text-gray-800"
                    autoFocus
                  />
                ) : (
                  <Text className="text-base text-gray-800">
                    {userData.data?.driver?.car_type || 'Not specified'}
                  </Text>
                )}
                <TouchableOpacity
                  onPress={() => {
                    if (editingField === 'carType') {
                      handleEditField('carType');
                    } else {
                      setEditingField('carType');
                    }
                  }}
                >
                  {editingField === 'carType' ? (
                    <AntDesign name="check" size={18} color="#f97316" />
                  ) : (
                    <MaterialIcons name="edit" size={18} color="#f97316" />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Car Seats */}
            <View className="mb-4">
              <Text className="text-gray-500 text-sm mb-1">Car Seats</Text>
              <View className="bg-gray-100 rounded-lg p-3 flex-row items-center justify-between">
                {editingField === 'carSeats' ? (
                  <TextInput
                    value={editValues.carSeats}
                    onChangeText={(text) => setEditValues(prev => ({ ...prev, carSeats: text }))}
                    className="flex-1 text-base text-gray-800"
                    keyboardType="numeric"
                    autoFocus
                  />
                ) : (
                  <Text className="text-base text-gray-800">
                    {userData.data?.driver?.car_seats || 0}
                  </Text>
                )}
                <TouchableOpacity
                  onPress={() => {
                    if (editingField === 'carSeats') {
                      handleEditField('carSeats');
                    } else {
                      setEditingField('carSeats');
                    }
                  }}
                >
                  {editingField === 'carSeats' ? (
                    <AntDesign name="check" size={18} color="#f97316" />
                  ) : (
                    <MaterialIcons name="edit" size={18} color="#f97316" />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Car Image */}
            {userData.data?.driver?.car_image_url && (
              <View className="mb-4">
                <Text className="text-gray-500 text-sm mb-1">Car Image</Text>
                <TouchableOpacity
                  onPress={() => setShowFullCarImage(true)}
                  className="bg-gray-100 rounded-lg p-3 flex-row items-center justify-between"
                >
                  <Image
                    source={{ uri: userData.data.driver.car_image_url }}
                    className="w-16 h-10 rounded-lg"
                  />
                  <MaterialIcons name="edit" size={18} color="#f97316" />
                </TouchableOpacity>
              </View>
            )}
          </>
        )}

        {/* Phone Number */}
        <View className="mb-4">
          <Text className="text-gray-500 text-sm mb-1">Phone Number</Text>
          <View className="bg-gray-100 rounded-lg p-3 flex-row items-center justify-between">
            {editingField === 'phoneNumber' ? (
              <TextInput
                value={editValues.phoneNumber}
                onChangeText={(text) => setEditValues(prev => ({ ...prev, phoneNumber: text }))}
                className="flex-1 text-base text-gray-800"
                keyboardType="phone-pad"
                autoFocus
              />
            ) : (
              <Text className="text-base text-gray-800">{phoneNumber}</Text>
            )}
            <TouchableOpacity
              onPress={() => {
                if (editingField === 'phoneNumber') {
                  handleEditField('phoneNumber');
                } else {
                  setEditingField('phoneNumber');
                }
              }}
            >
              {editingField === 'phoneNumber' ? (
                <AntDesign name="check" size={18} color="#f97316" />
              ) : (
                <MaterialIcons name="edit" size={18} color="#f97316" />
              )}
            </TouchableOpacity>
          </View>
        </View>
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
              uri: userData.profileImage || user?.imageUrl || 'https://www.pngitem.com/pimgs/m/146-1468479_my-profile-icon-blank-profile-picture-circle-hd.png',
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

export default ProfileEdit;