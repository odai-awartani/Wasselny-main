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
import uploadIcon from '@/assets/icons/upload.png';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";

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
  const storage = getStorage();

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

  const handleEditField = async (field: string) => {
    if (!user?.id) return;

    try {
      const userRef = doc(db, 'users', user.id);
      if (field === 'carType') {
        await updateDoc(userRef, { 'driver.car_type': editValues.carType });
        setUserData(prev => {
          if (!prev.data?.driver) return prev;
          return {
            ...prev,
            data: {
              ...prev.data,
              driver: {
                ...prev.data.driver,
                car_type: editValues.carType,
              }
            }
          };
        });
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
        setUserData(prev => {
          if (!prev.data?.driver) return prev;
          return {
            ...prev,
            data: {
              ...prev.data,
              driver: {
                ...prev.data.driver,
                car_seats: seats,
              }
            }
          };
        });
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

  const handleImagePick = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });

      if (!result.canceled) {
        setIsUploading(true);
        const response = await fetch(result.assets[0].uri);
        const blob = await response.blob();
        const filename = result.assets[0].uri.substring(result.assets[0].uri.lastIndexOf('/') + 1);
        const imageRef = storageRef(storage, `profile_images/${user?.id}/${filename}`);
        await uploadBytes(imageRef, blob);
        const url = await getDownloadURL(imageRef);
        await user?.update({ unsafeMetadata: { profileImageUrl: url } });
        setUserData(prev => ({ ...prev, profileImage: url }));
        Alert.alert(
          language === 'ar' ? 'نجاح' : 'Success',
          language === 'ar' ? 'تم تحديث الصورة بنجاح' : 'Image updated successfully'
        );
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      Alert.alert(
        language === 'ar' ? 'خطأ' : 'Error',
        language === 'ar' ? 'حدث خطأ أثناء تحديث الصورة' : 'Error updating image'
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleCarImagePick = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.5,
      });

      if (!result.canceled) {
        setIsUploading(true);
        const response = await fetch(result.assets[0].uri);
        const blob = await response.blob();
        const filename = result.assets[0].uri.substring(result.assets[0].uri.lastIndexOf('/') + 1);
        const imageRef = storageRef(storage, `car_images/${user?.id}/${filename}`);
        await uploadBytes(imageRef, blob);
        const url = await getDownloadURL(imageRef);
        const userRef = doc(db, 'users', user?.id || '');
        await updateDoc(userRef, {
          'driver.car_image_url': url
        });
        setUserData(prev => {
          if (!prev.data) return prev;
          return {
            ...prev,
            data: {
              ...prev.data,
              driver: {
                ...prev.data.driver,
                car_image_url: url,
                is_active: prev.data.driver?.is_active || false,
                car_type: prev.data.driver?.car_type || '',
                car_seats: prev.data.driver?.car_seats || 0,
                profile_image_url: prev.data.driver?.profile_image_url || '',
                created_at: prev.data.driver?.created_at || new Date().toISOString()
              }
            }
          };
        });
        Alert.alert(
          language === 'ar' ? 'نجاح' : 'Success',
          language === 'ar' ? 'تم تحديث صورة السيارة بنجاح' : 'Car image updated successfully'
        );
      }
    } catch (error) {
      console.error('Error uploading car image:', error);
      Alert.alert(
        language === 'ar' ? 'خطأ' : 'Error',
        language === 'ar' ? 'حدث خطأ أثناء تحديث صورة السيارة' : 'Error updating car image'
      );
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className={`px-5 py-4 flex-row items-center ${language === 'ar' ? 'flex-row-reverse' : ''} justify-between border-b border-gray-200`}>
        <TouchableOpacity onPress={() => router.back()} className="p-2">
          <MaterialIcons 
            name={language === 'ar' ? "chevron-right" : "chevron-left"} 
            size={24} 
            color="#374151"
          />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-gray-800">
          {language === 'ar' ? 'تعديل الملف' : 'Profile Edit'}
        </Text>
        <View style={{ width: 40 }} /> {/* Empty view for balanced spacing */}
      </View>

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
        <View className="mt-6 mb-4">
          <View className="flex-row justify-between px-2">
            {/* Profile Picture Box */}
            <View className="w-[48%]">
              <TouchableOpacity 
                onPress={() => setShowFullImage(true)} 
                className="bg-snow rounded-xl p-3 items-center border border-gray-200"
              >
                {userData.profileImage || user?.imageUrl ? (
                  <Image
                    source={{ uri: userData.profileImage || user?.imageUrl }}
                    className="w-32 h-32 rounded-lg"
                    resizeMode="cover"
                  />
                ) : null}
                {isUploading && (
                  <View className="absolute inset-0 bg-black/50 rounded-lg items-center justify-center">
                    <ActivityIndicator color="white" />
                  </View>
                )}
                <TouchableOpacity
                  onPress={handleImagePick}
                  className="absolute bottom-1 right-1 rounded-full p-2"
                >
                  <Image source={uploadIcon} style={{ width: 24, height: 24 }} />
                </TouchableOpacity>
              </TouchableOpacity>
            </View>

            {/* Car Photo Box - Only show if user is a driver */}
            {userData.isDriver && userData.data?.driver?.car_image_url && (
              <View className="w-[48%]">
                <TouchableOpacity 
                  onPress={() => setShowFullCarImage(true)} 
                  className="bg-snow rounded-xl p-3 items-center border border-gray-200"
                >
                  <Image
                    source={{ uri: userData.data.driver.car_image_url }}
                    className="w-32 h-32 rounded-lg"
                    resizeMode="cover"
                  />
                  <TouchableOpacity
                    onPress={handleCarImagePick}
                    className="absolute bottom-1 right-1 rounded-full p-2"
                  >
                    <Image source={uploadIcon} style={{ width: 24, height: 24 }} />
                  </TouchableOpacity>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View className="mt-4">
            {/* Name Field */}
            <View className="mb-4">
              <Text className={`text-gray-500 text-sm mb-1 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                {language === 'ar' ? 'الاسم الكامل' : 'Full Name'}
              </Text>
              <View className={`bg-snow rounded-lg p-3 flex-row items-center justify-between border border-gray-200 ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
                <Text className={`text-base text-gray-800 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                  {user?.fullName || (language === 'ar' ? 'غير محدد' : 'Not specified')}
                </Text>
              </View>
            </View>

            {/* Email Field */}
            <View className="mb-4">
              <Text className={`text-gray-500 text-sm mb-1 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                {language === 'ar' ? 'البريد الإلكتروني' : 'Email Address'}
              </Text>
              <View className={`bg-snow rounded-lg p-3 flex-row items-center justify-between border border-gray-200 ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
                <Text className={`text-base text-gray-800 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                  {user?.primaryEmailAddress?.emailAddress || (language === 'ar' ? 'غير محدد' : 'Not specified')}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Editable Fields */}
        {userData.isDriver && (
          <>
            {/* Car Type */}
            <View className="mb-4">
              <Text className={`text-gray-500 text-sm mb-1 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                {language === 'ar' ? 'نوع السيارة' : 'Car Type'}
              </Text>
              <View className={`bg-snow rounded-lg p-3 flex-row items-center justify-between border border-gray-200 ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
                {editingField === 'carType' ? (
                  <TextInput
                    value={editValues.carType}
                    onChangeText={(text) => setEditValues(prev => ({ ...prev, carType: text }))}
                    className={`flex-1 text-base text-gray-800 ${language === 'ar' ? 'text-right' : 'text-left'}`}
                    autoFocus
                    placeholder={language === 'ar' ? 'أدخل نوع السيارة' : 'Enter car type'}
                    textAlign={language === 'ar' ? 'right' : 'left'}
                  />
                ) : (
                  <Text className={`text-base text-gray-800 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                    {userData.data?.driver?.car_type || (language === 'ar' ? 'غير محدد' : 'Not specified')}
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
              <Text className={`text-gray-500 text-sm mb-1 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                {language === 'ar' ? 'عدد المقاعد' : 'Car Seats'}
              </Text>
              <View className={`bg-snow rounded-lg p-3 flex-row items-center justify-between border border-gray-200 ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
                {editingField === 'carSeats' ? (
                  <TextInput
                    value={editValues.carSeats}
                    onChangeText={(text) => setEditValues(prev => ({ ...prev, carSeats: text }))}
                    className={`flex-1 text-base text-gray-800 ${language === 'ar' ? 'text-right' : 'text-left'}`}
                    keyboardType="numeric"
                    autoFocus
                    placeholder={language === 'ar' ? 'أدخل عدد المقاعد' : 'Enter number of seats'}
                    textAlign={language === 'ar' ? 'right' : 'left'}
                  />
                ) : (
                  <Text className={`text-base text-gray-800 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
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
          </>
        )}

        {/* Phone Number */}
        <View className="mb-4">
          <Text className={`text-gray-500 text-sm mb-1 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
            {language === 'ar' ? 'رقم الهاتف' : 'Phone Number'}
          </Text>
          <View className={`bg-snow rounded-lg p-3 flex-row items-center justify-between border border-gray-200 ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
            {editingField === 'phoneNumber' ? (
              <TextInput
                value={editValues.phoneNumber}
                onChangeText={(text) => setEditValues(prev => ({ ...prev, phoneNumber: text }))}
                className={`flex-1 text-base text-gray-800 ${language === 'ar' ? 'text-right' : 'text-left'}`}
                keyboardType="phone-pad"
                autoFocus
                placeholder={language === 'ar' ? 'أدخل رقم الهاتف' : 'Enter phone number'}
                textAlign={language === 'ar' ? 'right' : 'left'}
              />
            ) : (
              <Text className={`text-base text-gray-800 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                {phoneNumber}
              </Text>
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
    </SafeAreaView>
  );
};

export default ProfileEdit;