import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useLanguage } from '@/context/LanguageContext';
import * as Haptics from 'expo-haptics';

interface FAQItem {
  question: string;
  answer: string;
}

export default function Help() {
  const router = useRouter();
  const { language } = useLanguage();
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const faqs: FAQItem[] = language === 'ar' ? [
    {
      question: 'كيف يمكنني إنشاء رحلة جديدة؟',
      answer: 'يمكنك إنشاء رحلة جديدة من خلال الضغط على زر "رحلة جديدة" في الصفحة الرئيسية واتباع الخطوات المطلوبة.'
    },
    {
      question: 'كيف يمكنني تعديل معلومات حسابي؟',
      answer: 'يمكنك تعديل معلومات حسابك من خلال الذهاب إلى صفحة الملف الشخصي والضغط على زر التعديل.'
    },
    {
      question: 'كيف يمكنني التواصل مع الدعم الفني؟',
      answer: 'يمكنك التواصل مع فريق الدعم الفني من خلال البريد الإلكتروني أو رقم الهاتف الموجود في هذه الصفحة.'
    }
  ] : [
    {
      question: 'How do I create a new ride?',
      answer: 'You can create a new ride by pressing the "New Ride" button on the home page and following the required steps.'
    },
    {
      question: 'How can I modify my account information?',
      answer: 'You can modify your account information by going to the profile page and pressing the edit button.'
    },
    {
      question: 'How can I contact technical support?',
      answer: 'You can contact our technical support team through the email or phone number listed on this page.'
    }
  ];

  const handleEmailPress = () => {
    Linking.openURL('mailto:wasselny@gmail.com');
  };

  const handlePhonePress = () => {
    Linking.openURL('tel:+0592744930');
  };

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
          {language === 'ar' ? 'المساعدة والدعم' : 'Help & Support'}
        </Text>
        <View className="w-10" />
      </View>

      {/* Content */}
      <ScrollView className="flex-1 px-4 py-6">
        {/* FAQs */}
        <Text className={`text-lg ${language === 'ar' ? 'font-CairoBold' : 'font-JakartaBold'} text-gray-800 mb-4`}>
          {language === 'ar' ? 'الأسئلة الشائعة' : 'Frequently Asked Questions'}
        </Text>
        
        {faqs.map((faq, index) => (
          <TouchableOpacity
            key={index}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setExpandedIndex(expandedIndex === index ? null : index);
            }}
            className="bg-gray-50 rounded-xl p-4 mb-3"
          >
            <View className="flex-row justify-between items-center">
              <Text className={`flex-1 ${language === 'ar' ? 'font-CairoBold' : 'font-JakartaBold'} text-gray-800`}>
                {faq.question}
              </Text>
              <MaterialIcons
                name={expandedIndex === index ? "expand-less" : "expand-more"}
                size={24}
                color="#666"
              />
            </View>
            {expandedIndex === index && (
              <Text className={`mt-2 ${language === 'ar' ? 'font-CairoRegular' : 'font-JakartaRegular'} text-gray-600`}>
                {faq.answer}
              </Text>
            )}
          </TouchableOpacity>
        ))}

        {/* Contact Section */}
        <Text className={`text-lg ${language === 'ar' ? 'font-CairoBold' : 'font-JakartaBold'} text-gray-800 mt-6 mb-4`}>
          {language === 'ar' ? 'تواصل معنا' : 'Contact Us'}
        </Text>

        <TouchableOpacity
          onPress={handleEmailPress}
          className="flex-row items-center bg-gray-50 rounded-xl p-4 mb-3"
        >
          <View className="w-10 h-10 rounded-full bg-orange-50 items-center justify-center">
            <MaterialIcons name="email" size={24} color="#f97316" />
          </View>
          <View className="ml-3">
            <Text className={`${language === 'ar' ? 'font-CairoBold' : 'font-JakartaBold'} text-gray-800`}>
              {language === 'ar' ? 'البريد الإلكتروني' : 'Email'}
            </Text>
            <Text className={`${language === 'ar' ? 'font-CairoRegular' : 'font-JakartaRegular'} text-gray-600`}>
              support@wasselny.com
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handlePhonePress}
          className="flex-row items-center bg-gray-50 rounded-xl p-4"
        >
          <View className="w-10 h-10 rounded-full bg-orange-50 items-center justify-center">
            <MaterialIcons name="phone" size={24} color="#f97316" />
          </View>
          <View className="ml-3">
            <Text className={`${language === 'ar' ? 'font-CairoBold' : 'font-JakartaBold'} text-gray-800`}>
              {language === 'ar' ? 'رقم الهاتف' : 'Phone'}
            </Text>
            <Text className={`${language === 'ar' ? 'font-CairoRegular' : 'font-JakartaRegular'} text-gray-600`}>
              +1234567890
            </Text>
          </View>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
} 