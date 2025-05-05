import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { icons, images } from "@/constants";
import Header from "@/components/Header";
import { useLanguage } from '@/context/LanguageContext';

// Define the type for city objects
interface City {
  id: string;
  name: string;
  nameEn: string;
}

const CheckpointsScreen: React.FC = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { language } = useLanguage();

  const cities: City[] = [
    { id: "nablus", name: "نابلس", nameEn: "Nablus" },
    { id: "hebron", name: "الخليل", nameEn: "Hebron" },
    { id: "ramallah", name: "رام الله", nameEn: "Ramallah" },
    { id: "jenin", name: "جنين", nameEn: "Jenin" },
    { id: "bethlehem", name: "بيت لحم", nameEn: "Bethlehem" },
    { id: "gaza", name: "غزة", nameEn: "Gaza" },
    { id: "jerusalem", name: "القدس", nameEn: "Jerusalem" },
    { id: "tulkarem", name: "طولكرم", nameEn: "Tulkarem" },
    { id: "qalqilya", name: "قلقيلية", nameEn: "Qalqilya" },
    { id: "tubas", name: "طوباس", nameEn: "Tubas" },
    { id: "salfit", name: "سلفيت", nameEn: "Salfit" },
  ];

  const handleCityPress = (cityId: string): void => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/(root)/cityCheckpoints/${cityId}`);
  };

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: "#f4f4f4" }}>
      <Header pageTitle={language === 'ar' ? 'الحواجز' : 'Barriers'} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: insets.bottom + 100,
        }}
      >
        {/* Cities Section */}
        <View className="px-4 py-4">
          <Text className={`text-xl ${language === 'ar' ? 'font-CairoRegular text-right' : 'font-JakartaBold text-left'} mb-3 text-gray-800`}>
            {language === 'ar' ? 'اختر مدينة' : 'Select City'}
          </Text>
          {cities.map((city) => (
            <TouchableOpacity
              key={city.id}
              onPress={() => handleCityPress(city.id)}
              className="bg-white p-4 rounded-xl mb-3 border border-gray-200"
              style={{
                elevation: Platform.OS === "android" ? 3 : 0,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.15,
                shadowRadius: 3,
              }}
            >
              <Text className={`text-lg ${language === 'ar' ? 'font-CairoRegular text-right' : 'font-JakartaBold text-left'} text-gray-800`}>
                {language === 'ar' ? city.name : city.nameEn}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Floating Action Button */}
      <TouchableOpacity
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          router.back();
        }}
        style={{
          position: "absolute",
          [language === 'ar' ? 'left' : 'right']: 16,
          bottom: insets.bottom + 20,
          width: 56,
          height: 56,
          borderRadius: 28,
          justifyContent: "center",
          alignItems: "center",
          elevation: Platform.OS === "android" ? 4 : 0,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: Platform.OS === "ios" ? 0.25 : 0,
          shadowRadius: Platform.OS === "ios" ? 3.84 : 0,
          zIndex: 1000,
        }}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={["#f97316", "#ea580c"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Image
            source={icons.backArrow}
            style={{ 
              width: 24, 
              height: 24, 
              tintColor: "#fff",
              transform: [{ rotate: language === 'ar' ? '180deg' : '0deg' }]
            }}
          />
        </LinearGradient>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

export default CheckpointsScreen;