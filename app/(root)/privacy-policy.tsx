import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useLanguage } from '@/context/LanguageContext';
import * as Haptics from 'expo-haptics';

export default function PrivacyPolicy() {
  const router = useRouter();
  const { language } = useLanguage();

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-gray-100">
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
          className="w-10 h-10 items-center justify-center rounded-full bg-gray-100"
        >
          <MaterialIcons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text className={`text-xl flex-1 text-center ${language === 'ar' ? 'font-CairoBold' : 'font-JakartaBold'} text-gray-800`}>
          {language === 'ar' ? 'سياسة الخصوصية' : 'Privacy Policy'}
        </Text>
        <View className="w-10" />
      </View>

      {/* Content */}
      <ScrollView className="flex-1 px-4 py-6">
        <Text className={`text-base ${language === 'ar' ? 'font-CairoRegular' : 'font-JakartaRegular'} text-gray-700 leading-6`}>
          {language === 'ar' ? (
            <>
              مرحباً بك في سياسة الخصوصية لتطبيق وسيلني. نحن نقدر خصوصيتك ونلتزم بحماية بياناتك الشخصية.

              {'\n\n'}1. جمع المعلومات
              {'\n'}نقوم بجمع المعلومات الضرورية لتقديم خدماتنا، بما في ذلك:
              • معلومات الموقع
              • معلومات الحساب
              • معلومات الاتصال

              {'\n\n'}2. استخدام المعلومات
              {'\n'}نستخدم معلوماتك لـ:
              • تقديم خدمات التطبيق
              • تحسين تجربة المستخدم
              • التواصل معك

              {'\n\n'}3. حماية المعلومات
              {'\n'}نحن نستخدم تقنيات تشفير متقدمة لحماية بياناتك الشخصية.

              {'\n\n'}4. مشاركة المعلومات
              {'\n'}لا نقوم بمشاركة معلوماتك الشخصية مع أي طرف ثالث دون موافقتك.

              {'\n\n'}5. حقوق المستخدم
              {'\n'}يمكنك في أي وقت:
              • الوصول إلى بياناتك
              • تعديل معلوماتك
              • حذف حسابك
            </>
          ) : (
            <>
              Welcome to Wasselny's Privacy Policy. We value your privacy and are committed to protecting your personal data.

              {'\n\n'}1. Information Collection
              {'\n'}We collect necessary information to provide our services, including:
              • Location information
              • Account information
              • Contact information

              {'\n\n'}2. Information Usage
              {'\n'}We use your information to:
              • Provide app services
              • Improve user experience
              • Communicate with you

              {'\n\n'}3. Information Protection
              {'\n'}We use advanced encryption technologies to protect your personal data.

              {'\n\n'}4. Information Sharing
              {'\n'}We do not share your personal information with any third party without your consent.

              {'\n\n'}5. User Rights
              {'\n'}You can at any time:
              • Access your data
              • Modify your information
              • Delete your account
            </>
          )}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
} 