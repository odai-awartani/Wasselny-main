import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { View, Text, Image, TouchableOpacity, ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Platform, TextInput } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { doc, getDoc, addDoc, collection, serverTimestamp, updateDoc, onSnapshot, query, where, getDocs, Timestamp, orderBy, limit, setDoc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format, parse } from 'date-fns';
import { db } from '@/lib/firebase';
import RideLayout from '@/components/RideLayout';
import { icons } from '@/constants';
import RideMap from '@/components/RideMap';
import CustomButton from '@/components/CustomButton';
import { useAuth } from '@clerk/clerk-expo';
import { scheduleNotification, setupNotifications, cancelNotification, sendRideStatusNotification, sendRideRequestNotification, startRideNotificationService, schedulePassengerRideReminder, sendCheckOutNotificationForDriver, scheduleDriverRideReminder } from '@/lib/notifications';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import BottomSheet from '@gorhom/bottom-sheet';

interface DriverData {
  car_seats?: number;
  car_type?: string;
  profile_image_url?: string;
  car_image_url?: string;
}

interface UserData {
  name?: string;
  driver?: DriverData;
  gender?: string;
}

interface Ride {
  id: string;
  origin_address: string;
  destination_address: string;
  origin_latitude?: number;
  origin_longitude?: number;
  destination_latitude?: number;
  destination_longitude?: number;
  created_at: any;
  ride_datetime: string;
  driver_id?: string;
  status: 'available' | 'full' | 'in-progress' | 'completed' | 'on-hold' | 'cancelled';
  available_seats: number;
  is_recurring: boolean;
  no_children: boolean;
  no_music: boolean;
  no_smoking: boolean;
  required_gender: string;
  ride_days?: string[];
  ride_number: number;
  driver?: {
    name: string;
    car_seats: number;
    profile_image_url?: string;
    car_type: string;
    car_image_url?: string;
  };
}

interface RideRequest {
  id: string;
  ride_id: string;
  user_id: string;
  status: 'waiting' | 'accepted' | 'rejected' | 'checked_in' | 'checked_out' | 'cancelled';
  created_at: any;
  rating?: number;
  notification_id?: string;
  passenger_name?: string;
  is_waitlist?: boolean;
}

interface Rating {
  overall: number;
  driving: number;
  behavior: number;
  punctuality: number;
  cleanliness: number;
  comment?: string;
  ride_id: string;
  driver_id: string;
  passenger_id: string;
  passenger_name: string;
  ride_details: {
    origin_address: string;
    destination_address: string;
    ride_datetime: string;
  };
  created_at: any;
}

const DEFAULT_DRIVER_NAME = 'Unknown Driver';
const DEFAULT_CAR_SEATS = 4;
const DEFAULT_CAR_TYPE = 'Unknown';
const DEFAULT_PROFILE_IMAGE = 'https://via.placeholder.com/40';
const DEFAULT_CAR_IMAGE = 'https://via.placeholder.com/120x80';
const DATE_FORMAT = 'dd/MM/yyyy HH:mm';

const RideDetails = () => {
  const [pendingRequests, setPendingRequests] = useState<RideRequest[]>([]);
  const [allPassengers, setAllPassengers] = useState<RideRequest[]>([]);
  const [passengerNames, setPassengerNames] = useState<Record<string, string>>({});
  const [passengerGenders, setPassengerGenders] = useState<Record<string, string>>({});
  const router = useRouter();
  const { id, notificationId, scrollToRequests } = useLocalSearchParams();
  const scrollViewRef = useRef<ScrollView>(null);
  const bottomSheetRef = useRef<BottomSheet>(null);
  const [ride, setRide] = useState<Ride | null>(null);
  const [rideRequest, setRideRequest] = useState<RideRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [rating, setRating] = useState<Rating>({
    overall: 0,
    driving: 0,
    behavior: 0,
    punctuality: 0,
    cleanliness: 0,
    comment: '',
    ride_id: '',
    driver_id: '',
    passenger_id: '',
    passenger_name: '',
    ride_details: {
      origin_address: '',
      destination_address: '',
      ride_datetime: ''
    },
    created_at: null
  });
  const { userId } = useAuth();
  const isDriver = ride?.driver_id === userId;
  const isPassenger = rideRequest && rideRequest.status === 'accepted';
  const [isRideTime, setIsRideTime] = useState(false);

  // Cache helper functions
  const cacheRideDetails = async (rideId: string, rideData: Ride) => {
    try {
      await AsyncStorage.setItem(`ride_${rideId}`, JSON.stringify(rideData));
    } catch (err) {
      console.error('Error caching ride details:', err);
    }
  };

  const getCachedRideDetails = async (rideId: string): Promise<Ride | null> => {
    try {
      const cached = await AsyncStorage.getItem(`ride_${rideId}`);
      return cached ? JSON.parse(cached) : null;
    } catch (err) {
      console.error('Error retrieving cached ride details:', err);
      return null;
    }
  };

  // Setup notifications
  useEffect(() => {
    if (userId) {
      setupNotifications(userId).catch((err) => console.error('Error setting up notifications:', err));
      startRideNotificationService(userId, true).catch((err) => console.error('Error starting notification service:', err));
    }
  }, [userId]);

  // Handle notification when page loads
  useEffect(() => {
    if (notificationId && typeof notificationId === 'string') {
      const markNotificationAsRead = async () => {
        try {
          const notificationRef = doc(db, 'notifications', notificationId);
          await updateDoc(notificationRef, { read: true });
          if (scrollViewRef.current && pendingRequests.length > 0) {
            scrollViewRef.current.scrollTo({ y: 600, animated: true });
          }
        } catch (error) {
          console.error('Error marking notification as read:', error);
        }
      };
      markNotificationAsRead();
    }
  }, [notificationId, pendingRequests]);

  // Fetch ride details
  const fetchRideDetails = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Check cache first
      const cachedRide = await getCachedRideDetails(id as string);
      if (cachedRide) {
        setRide(cachedRide);
        setLoading(false);
      }

      const rideDocRef = doc(db, 'rides', id as string);
      const rideDocSnap = await getDoc(rideDocRef);

      if (!rideDocSnap.exists()) {
        setError('لم يتم العثور على الرحلة.');
        setLoading(false);
        return;
      }

      const rideData = rideDocSnap.data();

      let driverInfo: UserData = { name: DEFAULT_DRIVER_NAME };
      if (rideData.driver_id) {
        const userDocRef = doc(db, 'users', rideData.driver_id);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          driverInfo = userDocSnap.data() as UserData;
        } else {
          console.warn(`User not found for driver_id: ${rideData.driver_id}`);
        }
      }

      let formattedDateTime = rideData.ride_datetime;
      if (rideData.ride_datetime instanceof Timestamp) {
        formattedDateTime = format(rideData.ride_datetime.toDate(), DATE_FORMAT);
      } else {
        try {
          const parsedDate = parse(rideData.ride_datetime, DATE_FORMAT, new Date());
          if (!isNaN(parsedDate.getTime())) {
            formattedDateTime = format(parsedDate, DATE_FORMAT);
          } else {
            console.warn('Invalid ride_datetime format');
          }
        } catch {
          console.warn('Invalid ride_datetime format');
        }
      }

      const rideDetails: Ride = {
        id: rideDocSnap.id,
        origin_address: rideData.origin_address || 'غير معروف',
        destination_address: rideData.destination_address || 'غير معروف',
        origin_latitude: rideData.origin_latitude || 0,
        origin_longitude: rideData.origin_longitude || 0,
        destination_latitude: rideData.destination_latitude || 0,
        destination_longitude: rideData.destination_longitude || 0,
        created_at: rideData.created_at,
        ride_datetime: formattedDateTime,
        status: rideData.status || 'available',
        available_seats: rideData.available_seats || 0,
        is_recurring: rideData.is_recurring || false,
        no_children: rideData.no_children || false,
        no_music: rideData.no_music || false,
        no_smoking: rideData.no_smoking || false,
        required_gender: rideData.required_gender || 'كلاهما',
        ride_days: rideData.ride_days || [],
        ride_number: rideData.ride_number || 0,
        driver_id: rideData.driver_id,
        driver: {
          name: driverInfo.name || DEFAULT_DRIVER_NAME,
          car_seats: driverInfo.driver?.car_seats || DEFAULT_CAR_SEATS,
          profile_image_url: driverInfo.driver?.profile_image_url || DEFAULT_PROFILE_IMAGE,
          car_type: driverInfo.driver?.car_type || DEFAULT_CAR_TYPE,
          car_image_url: driverInfo.driver?.car_image_url || DEFAULT_CAR_IMAGE,
        },
      };

      // Update local state with latest data
      setRide(rideDetails);
      await cacheRideDetails(id as string, rideDetails);

      // Set up real-time listener for ride status changes
      const unsubscribe = onSnapshot(rideDocRef, (doc) => {
        if (doc.exists()) {
          const updatedData = doc.data();
          setRide(prevRide => prevRide ? { ...prevRide, status: updatedData.status } : null);
        }
      });

      return () => unsubscribe();
    } catch (err) {
      console.error('Error fetching ride details:', err);
      setError('فشل تحميل تفاصيل الرحلة. تحقق من اتصالك بالإنترنت وحاول مجددًا.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Monitor ride request status
  useEffect(() => {
    if (!userId || !id) {
      setLoading(false);
      return;
    }

    const rideRequestsRef = collection(db, 'ride_requests');
    const q = query(rideRequestsRef, where('ride_id', '==', id), where('user_id', '==', userId));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (!snapshot.empty) {
          const doc = snapshot.docs[0];
          setRideRequest({ id: doc.id, ...doc.data() } as RideRequest);
        } else {
          setRideRequest(null);
        }
      },
      (error) => {
        console.error('Error fetching ride request:', error);
        setError('فشل تحميل طلب الحجز. تحقق من اتصالك بالإنترنت.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [id, userId]);

  // Fetch pending ride requests for driver
  useEffect(() => {
    if (!ride?.id || !isDriver) return;

    const rideRequestsRef = collection(db, 'ride_requests');
    const q = query(rideRequestsRef, where('ride_id', '==', ride.id), where('status', '==', 'waiting'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const requests: RideRequest[] = [];
        snapshot.forEach((doc) => {
          requests.push({ id: doc.id, ...doc.data() } as RideRequest);
        });
        setPendingRequests(requests);
      },
      (error) => {
        console.error('Error fetching pending requests:', error);
        setError('فشل تحميل طلبات الحجز المعلقة.');
      }
    );

    return () => unsubscribe();
  }, [ride?.id, isDriver]);

  // Fetch all passengers for the ride
  useEffect(() => {
    if (!ride?.id) return;

    const fetchPassengers = async () => {
      try {
        const rideRequestsRef = collection(db, 'ride_requests');
        const q = query(rideRequestsRef, where('ride_id', '==', ride.id), where('status', 'in', ['accepted', 'checked_in', 'checked_out']));
        const snapshot = await getDocs(q);
        const passengers: RideRequest[] = [];
        snapshot.forEach((doc) => {
          passengers.push({ id: doc.id, ...doc.data() } as RideRequest);
        });
        setAllPassengers(passengers);
      } catch (error) {
        console.error('Error fetching passengers:', error);
        setError('فشل تحميل قائمة الركاب.');
      }
    };

    fetchPassengers();
  }, [ride?.id]);

  // Fetch passenger names and genders
  useEffect(() => {
    const fetchPassengerDetails = async () => {
      try {
        const passengerIds = allPassengers.map((p) => p.user_id);
        if (!passengerIds.length) return;

        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('__name__', 'in', passengerIds));
        const querySnapshot = await getDocs(q);

        const names: Record<string, string> = {};
        const genders: Record<string, string> = {};
        querySnapshot.forEach((doc) => {
          const userData = doc.data();
          names[doc.id] = userData?.name || 'الراكب';
          genders[doc.id] = userData?.gender || 'غير محدد';
        });

        setPassengerNames(names);
        setPassengerGenders(genders);
      } catch (error) {
        console.error('Error fetching passenger details:', error);
        setError('فشل تحميل بيانات الركاب.');
      }
    };

    if (allPassengers.length > 0) {
      fetchPassengerDetails();
    }
  }, [allPassengers]);

  // Handle scrolling to requests
  useEffect(() => {
    if (scrollToRequests === 'true' && scrollViewRef.current && pendingRequests.length > 0) {
      scrollViewRef.current.scrollTo({ y: 600, animated: true });
    }
  }, [scrollToRequests, pendingRequests]);

  // Handle booking a ride
  const handleBookRide = async () => {
    try {
      if (Platform.OS === 'android') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      if (!ride || !ride.id || !ride.driver_id || !userId) {
        Alert.alert('معلومات الرحلة غير مكتملة');
        return;
      }

      // Check if ride has already started or completed
      if (ride.status === 'in-progress' || ride.status === 'completed' || ride.status === 'cancelled' || ride.status === 'on-hold') {
        Alert.alert('غير متاح', 'لا يمكن حجز هذه الرحلة لأنها قد بدأت أو انتهت أو تم إلغاؤها أو في وضع الانتظار.');
        return;
      }

      // Check if ride is full
      if (ride.available_seats === undefined || ride.available_seats <= 0) {
        Alert.alert(
          'الرحلة ممتلئة',
          'الرحلة ممتلئة حالياً، ولكن يمكنك إرسال طلب حجز. إذا غادر أي راكب، سيتم إخطارك عند قبول طلبك.',
          [
            {
              text: 'إلغاء',
              style: 'cancel'
            },
            {
              text: 'إرسال طلب',
              onPress: async () => {
                try {
                  const userDoc = await getDoc(doc(db, 'users', userId));
                  const userData = userDoc.data();
                  const userName = userData?.name || 'الراكب';
                  const userGender = userData?.gender || 'غير محدد';

                  if (ride.required_gender !== 'كلاهما') {
                    if (ride.required_gender === 'ذكر' && userGender !== 'Male') {
                      Alert.alert('غير مسموح', 'هذه الرحلة مخصصة للركاب الذكور فقط.');
                      return;
                    }
                    if (ride.required_gender === 'أنثى' && userGender !== 'Female') {
                      Alert.alert('غير مسموح', 'هذه الرحلة مخصصة للركاب الإناث فقط.');
                      return;
                    }
                  }

                  const rideRequestRef = await addDoc(collection(db, 'ride_requests'), {
                    ride_id: ride.id,
                    user_id: userId,
                    driver_id: ride.driver_id,
                    status: 'waiting',
                    created_at: serverTimestamp(),
                    passenger_name: userName,
                    is_waitlist: true, // Mark this request as waitlist
                  });

                  if (ride.driver_id) {
                    const driverNotificationId = await scheduleDriverRideReminder(
                      ride.id,
                      ride.driver_id,
                      ride.ride_datetime,
                      ride.origin_address || '',
                      ride.destination_address || ''
                    );

                    await sendRideRequestNotification(
                      ride.driver_id,
                      userName,
                      ride.origin_address || '',
                      ride.destination_address || '',
                      ride.id
                    );
                  }

                  Alert.alert('✅ تم إرسال طلب الحجز بنجاح', 'سيتم إخطارك إذا أصبح هناك مقعد متاح');
                } catch (error) {
                  console.error('Booking error:', error);
                  Alert.alert('حدث خطأ أثناء إرسال طلب الحجز.');
                }
              }
            }
          ]
        );
        return;
      }

      const userDoc = await getDoc(doc(db, 'users', userId));
      const userData = userDoc.data();
      const userName = userData?.name || 'الراكب';
      const userGender = userData?.gender || 'غير محدد';

      if (ride.required_gender !== 'كلاهما') {
        if (ride.required_gender === 'ذكر' && userGender !== 'Male') {
          Alert.alert('غير مسموح', 'هذه الرحلة مخصصة للركاب الذكور فقط.');
          return;
        }
        if (ride.required_gender === 'أنثى' && userGender !== 'Female') {
          Alert.alert('غير مسموح', 'هذه الرحلة مخصصة للركاب الإناث فقط.');
          return;
        }
      }

      const rideRequestRef = await addDoc(collection(db, 'ride_requests'), {
        ride_id: ride.id,
        user_id: userId,
        driver_id: ride.driver_id,
        status: 'waiting',
        created_at: serverTimestamp(),
        passenger_name: userName,
        is_waitlist: false,
      });

      if (ride.driver_id) {
        const driverNotificationId = await scheduleDriverRideReminder(
          ride.id,
          ride.driver_id,
          ride.ride_datetime,
          ride.origin_address || '',
          ride.destination_address || ''
        );

        await sendRideRequestNotification(
          ride.driver_id,
          userName,
          ride.origin_address || '',
          ride.destination_address || '',
          ride.id
        );
      }

      Alert.alert('✅ تم إرسال طلب الحجز بنجاح');
    } catch (error) {
      console.error('Booking error:', error);
      Alert.alert('حدث خطأ أثناء إرسال طلب الحجز.');
    }
  };

  // Handle driver accepting ride request
  const handleAcceptRequest = async (requestId: string, userId: string) => {
    try {
      if (Platform.OS === 'android') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      const userDoc = await getDoc(doc(db, 'users', userId));
      const passengerName = userDoc.data()?.name || 'الراكب';

      if (!ride || !ride.driver_id) {
        throw new Error('بيانات الرحلة أو السائق غير متوفرة');
      }

      // Check if ride is full
      if (ride.available_seats <= 0) {
        Alert.alert(
          'الرحلة ممتلئة',
          'لا يمكن قبول المزيد من الطلبات لأن الرحلة ممتلئة. سيتم إخطار الراكب عندما يصبح هناك مقعد متاح.'
        );
        return;
      }

      const passengerNotificationId = await schedulePassengerRideReminder(
        ride.id,
        ride.ride_datetime,
        ride.origin_address,
        ride.destination_address,
        ride.driver?.name || DEFAULT_DRIVER_NAME
      );

      await updateDoc(doc(db, 'ride_requests', requestId), {
        status: 'accepted',
        updated_at: serverTimestamp(),
        passenger_name: passengerName,
        passenger_id: userId,
        notification_id: passengerNotificationId || null,
      });

      await sendRideStatusNotification(
        userId,
        'تم قبول طلب الحجز!',
        `تم قبول طلب حجزك للرحلة من ${ride.origin_address} إلى ${ride.destination_address}`,
        ride.id
      );

      const notificationsRef = collection(db, 'notifications');
      const q = query(
        notificationsRef,
        where('user_id', '==', userId),
        where('data.rideId', '==', ride.id),
        where('type', '==', 'ride_request')
      );

      const querySnapshot = await getDocs(q);
      for (const doc of querySnapshot.docs) {
        await updateDoc(doc.ref, {
          read: true,
          data: {
            status: 'accepted',
            rideId: ride.id,
            type: 'ride_status',
            passenger_name: passengerName,
          },
        });
      }

      Alert.alert('✅ تم قبول طلب الحجز بنجاح', `تم قبول طلب ${passengerName}`);
    } catch (error) {
      console.error('Error accepting request:', error);
      Alert.alert('حدث خطأ أثناء قبول الطلب.');
    }
  };

  // Handle check-in
  const handleCheckIn = async () => {
    try {
      if (Platform.OS === 'android') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      if (!rideRequest || !ride || !userId) {
        Alert.alert('معلومات الرحلة غير مكتملة');
        return;
      }

      await updateDoc(doc(db, 'ride_requests', rideRequest.id), {
        status: 'checked_in',
        updated_at: serverTimestamp(),
      });

      // Removed updating available_seats to keep it unchanged in Firestore
      await sendRideStatusNotification(
        ride.driver_id || '',
        'الراكب وصل',
        `الراكب قد وصل وبدأ الرحلة من ${ride.origin_address} إلى ${ride.destination_address}`,
        ride.id
      );

      Alert.alert('✅ تم تسجيل الدخول بنجاح');
    } catch (error) {
      console.error('Error during check-in:', error);
      Alert.alert('حدث خطأ أثناء تسجيل الدخول.');
    }
  };

  // Handle check-out
  const handleCheckOut = async () => {
    try {
      if (Platform.OS === 'android') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      if (!rideRequest || !ride || !userId) {
        Alert.alert('معلومات الرحلة غير مكتملة');
        return;
      }

      if (rideRequest.notification_id) {
        await cancelNotification(rideRequest.notification_id);
        console.log(`Cancelled notification ${rideRequest.notification_id}`);
      }

      await updateDoc(doc(db, 'ride_requests', rideRequest.id), {
        status: 'checked_out',
        updated_at: serverTimestamp(),
      });

      await sendCheckOutNotificationForDriver(
        ride.driver_id || '',
        passengerNames[userId] || 'الراكب',
        ride.id
      );

      setShowRatingModal(true);
    } catch (error) {
      console.error('Check-out error:', error);
      Alert.alert('حدث خطأ أثناء تسجيل الخروج.');
    }
  };

  // Handle ride cancellation
  const handleCancelRide = async () => {
    try {
      if (Platform.OS === 'android') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      if (!rideRequest || !ride || !userId) {
        Alert.alert('معلومات الرحلة غير مكتملة');
        return;
      }

      if (rideRequest.notification_id) {
        await cancelNotification(rideRequest.notification_id);
        console.log(`Cancelled notification ${rideRequest.notification_id}`);
      }

      await updateDoc(doc(db, 'ride_requests', rideRequest.id), {
        status: 'cancelled',
        updated_at: serverTimestamp(),
      });

      // If the ride was full and this was an accepted request, update ride status to available
      if (ride.status === 'full' && rideRequest.status === 'accepted') {
        await updateDoc(doc(db, 'rides', ride.id), {
          status: 'available',
          updated_at: serverTimestamp(),
        });
      }

      // Removed updating available_seats to keep it unchanged in Firestore
      if (ride.driver_id) {
        const passengerName = passengerNames[userId] || 'الراكب';
        await sendRideStatusNotification(
          ride.driver_id,
          'تم إلغاء الحجز',
          `قام ${passengerName} بإلغاء حجز الرحلة من ${ride.origin_address} إلى ${ride.destination_address}`,
          ride.id
        );
      }

      Alert.alert('✅ تم إلغاء الحجز بنجاح');
    } catch (error) {
      console.error('Cancellation error:', error);
      Alert.alert('حدث خطأ أثناء إلغاء الحجز.');
    }
  };

  // Handle rating submission
  const handleRateDriver = async () => {
    try {
      if (Platform.OS === 'android') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      if (!rideRequest || !ride || !userId) {
        Alert.alert('معلومات الرحلة غير مكتملة');
        return;
      }

      // Check if all ratings are provided
      if (Object.values(rating).some(value => value === 0)) {
        Alert.alert('خطأ', 'الرجاء تقييم جميع النقاط');
        return;
      }

      // Get passenger name
      const userDoc = await getDoc(doc(db, 'users', userId));
      const passengerName = userDoc.data()?.name || 'الراكب';

      // Create rating document
      const ratingData: Rating = {
        ...rating,
        ride_id: ride.id,
        driver_id: ride.driver_id || '',
        passenger_id: userId,
        passenger_name: passengerName,
        ride_details: {
          origin_address: ride.origin_address,
          destination_address: ride.destination_address,
          ride_datetime: ride.ride_datetime
        },
        created_at: serverTimestamp()
      };

      // Save to ratings collection
      await addDoc(collection(db, 'ratings'), ratingData);

      // Update ride request with rating reference
      await updateDoc(doc(db, 'ride_requests', rideRequest.id), {
        has_rating: true,
        updated_at: serverTimestamp(),
      });

      // Notify driver
      if (ride.driver_id) {
        await sendRideStatusNotification(
          ride.driver_id,
          'تقييم جديد!',
          `قام ${passengerName} بتقييم رحلتك بـ ${rating.overall} نجوم`,
          ride.id
        );
      }

      setShowRatingModal(false);
      Alert.alert('✅ شكراً على تقييمك!');
    } catch (error) {
      console.error('Rating error:', error);
      Alert.alert('حدث خطأ أثناء إرسال التقييم.');
    }
  };

  // Handle target press for bottom sheet
  const handleTargetPress = () => {
    if (Platform.OS === 'android') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    bottomSheetRef.current?.snapToIndex(2);
  };

  // Format time to 12-hour format
  const formatTimeTo12Hour = (timeStr: string) => {
    try {
      const [date, time] = timeStr.split(' ');
      const [hours, minutes] = time.split(':').map(Number);
      const period = hours >= 12 ? 'مساءً' : 'صباحاً';
      const formattedHours = hours % 12 || 12;
      return {
        date,
        time: `${formattedHours}:${minutes.toString().padStart(2, '0')} ${period}`,
      };
    } catch (error) {
      console.error('Error formatting time:', error);
      return {
        date: timeStr,
        time: timeStr,
      };
    }
  };

  // Memoized formatted ride data
  const formattedRide = useMemo(() => {
    if (!ride) return null;
    return {
      ...ride,
      formattedDateTime: ride.ride_datetime ? formatTimeTo12Hour(ride.ride_datetime) : { date: 'غير محدد', time: 'غير محدد' },
    };
  }, [ride]);

  // Render driver info
  const renderDriverInfo = useCallback(
    () => (
      <View
        className="bg-white w-[98%] mx-1 p-4 rounded-xl"
        style={Platform.OS === 'android' ? styles.androidShadow : styles.iosShadow}
      >
        <TouchableOpacity
          onPress={() => router.push(`/profile/${formattedRide?.driver_id}`)}
          className="flex-row-reverse items-center "
        >
          <Image
            source={{ uri: formattedRide?.driver?.profile_image_url || DEFAULT_PROFILE_IMAGE }}
            className="w-16 h-16 rounded-full mr-4"
          />
          <View className="flex-1 ">
            <Text className="text-xl mr-2 text-right font-CairoBold mb-1 text-black">{formattedRide?.driver?.name}</Text>
            <View className="flex-row-reverse justify-between  items-center">
            <Text className="text-black mr-2 font-CairoMedium">{formattedRide?.driver?.car_type}</Text>
            <View className='flex-row-reverse'>
              <FontAwesome5 name="users" size={16} color="#000" />
            <Text className="text-black mr-1 font-CairoMedium">
                {`${formattedRide?.driver?.car_seats || DEFAULT_CAR_SEATS} مقاعد السيارة`}
              </Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>
        <View className="items-center">
          <View className="flex-row-reverse justify-between w-full">
            
              
           
          </View>
        </View>
      </View>
    ),
    [formattedRide, allPassengers]
  );

  // Render ride details
  const renderRideDetails = useCallback(
    () => (
      <View
        className="bg-white w-[98%] mx-1 mt-3 p-4 rounded-xl"
        style={Platform.OS === 'android' ? styles.androidShadow : styles.iosShadow}
      >
        {ride?.status === 'in-progress' && (
          <View className="bg-blue-100 p-3 rounded-lg mb-4">
            <Text className="text-blue-800 font-CairoBold text-center text-lg">
              الرحلة جارية حالياً - لا يمكن حجز مقعد
            </Text>
          </View>
        )}
        <View className="flex-row-reverse mb-4">
          <View className="flex-1">
            <View className="flex-row-reverse items-center mb-3">
              <Image source={icons.point} className="w-6 h-6 ml-3" />
              <Text className="text-lg font-CairoBold text-black text-right">
                من: {formattedRide?.origin_address}
              </Text>
            </View>
            <View className="flex-row-reverse items-center">
              <Image source={icons.target} className="w-6 h-6 ml-3" />
              <Text className="text-lg font-CairoBold text-black text-right">
                إلى: {formattedRide?.destination_address}
              </Text>
            </View>
          </View>
        </View>


        <View className="flex-row-reverse justify-between mb-4">
          <View className="flex-row-reverse items-center">
            <MaterialIcons name="event" size={20} color="#000" className="mr-3" />
            <Text className="text-black ml-1 font-CairoMedium">{formattedRide?.formattedDateTime?.date}</Text>
          </View>
          <View className="flex-row-reverse items-center">
            <MaterialIcons name="access-time" size={20} color="#ff0000" className="mr-3" />
            <Text className="text-red-600 ml-1 font-CairoMedium">{formattedRide?.formattedDateTime?.time}</Text>
          </View>
        </View>

        <View className="flex-row-reverse justify-between mb-4">
          <View className="flex-row-reverse items-center">
            <MaterialIcons name="repeat" size={20} color="#000" className="mr-3" />
            <Text className="text-black ml-1 font-CairoMedium">
              {formattedRide?.is_recurring ? `رحلة متكررة (${formattedRide.ride_days?.join(', ')})` : 'رحلة لمرة واحدة'}
            </Text>
          </View>
          <View className="flex-row-reverse items-center">
            <MaterialIcons name="event-seat" size={20} color="#000" className="mr-3" />
            <Text className="text-black ml-1 font-CairoMedium">
              {`${formattedRide?.available_seats}/${allPassengers.length} مقاعد`}
            </Text>
          </View>
        </View>

        <View className="mt-4">
          <Text className="text-lg font-CairoBold text-right mb-4 text-black">تفضيلات الرحلة</Text>
          <View className="flex-row-reverse flex-wrap">
            <View className="w-1/2 flex-row-reverse items-center mb-4">
              <MaterialIcons
                name={formattedRide?.no_smoking ? 'smoke-free' : 'smoking-rooms'}
                size={24}
                color="#000"
                className="mr-3"
              />
              <Text className="text-black ml-1 font-CairoMedium">
                {formattedRide?.no_smoking ? 'ممنوع التدخين' : 'مسموح التدخين'}
              </Text>
            </View>
            <View className="w-1/2 flex-row-reverse items-center mb-4">
              <MaterialIcons
                name={formattedRide?.no_music ? 'music-off' : 'music-note'}
                size={24}
                color="#000"
                className="mr-3"
              />
              <Text className="text-black ml-1 font-CairoMedium">
                {formattedRide?.no_music ? 'ممنوع الموسيقى' : 'مسموح الموسيقى'}
              </Text>
            </View>
            <View className="w-1/2 flex-row-reverse items-center mb-4">
              <MaterialIcons
                name={formattedRide?.no_children ? 'child-care' : 'child-friendly'}
                size={24}
                color="#000"
                className="mr-3"
              />
              <Text className="text-black ml-1 font-CairoMedium">
                {formattedRide?.no_children ? 'ممنوع الأطفال' : 'مسموح الأطفال'}
              </Text>
            </View>
            <View className="w-1/2 flex-row-reverse items-center mb-4">
              <MaterialIcons name="wc" size={24} color="#000" className="mr-3" />
              <Text className="text-black ml-1 font-CairoMedium">
                {formattedRide?.required_gender === 'ذكر' ? 'ذكور فقط' : formattedRide?.required_gender === 'أنثى' ? 'إناث فقط' : 'جميع الجنسيات'}
              </Text>
            </View>
          </View>
        </View>
      </View>
    ),
    [formattedRide, allPassengers]
  );

  // Render current passengers
  const renderCurrentPassengers = useCallback(
    () => (
      <View
        className="bg-white w-[98%]  mx-1 mt-3 p-4 rounded-xl"
        style={Platform.OS === 'android' ? styles.androidShadow : styles.iosShadow}
      >
        <Text className="text-lg font-CairoBold text-right mb-3 text-black">الركاب الحاليين</Text>
        {allPassengers.length > 0 ? (
          <View className="border border-gray-200 rounded-lg overflow-hidden">
            <View className="flex-row-reverse bg-gray-50 p-3 border-b border-gray-200">
              <View className="flex-1">
                <Text className="text-sm font-CairoBold text-gray-700 text-right">الاسم</Text>
              </View>
              <View className="w-24">
                <Text className="text-sm font-CairoBold text-gray-700 text-right">الجنس</Text>
              </View>
            </View>
            {allPassengers.map((passenger) => (
              <View key={passenger.id} className="flex-row-reverse p-3 border-b border-gray-100">
                <View className="flex-1 flex-row-reverse items-center">
                  <Image
                    source={passengerGenders[passenger.user_id] === 'Female' ? icons.person : icons.person}
                    className="w-5 h-5 ml-2"
                    tintColor={passengerGenders[passenger.user_id] === 'Female' ? '#FF69B4' : '#10B981'}
                  />
                  <Text className="text-sm pt-1.5 text-gray-700 text-right font-CairoRegular">
                    {passengerNames[passenger.user_id] || 'الراكب'}
                  </Text>
                </View>
                <View className="w-24 justify-center">
                  <Text className="text-sm pt-1.5 text-gray-700 text-right font-CairoRegular">
                    {passengerGenders[passenger.user_id] || 'غير محدد'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View className="bg-gray-50 p-4 rounded-xl">
            <Text className="text-base text-gray-700 text-center font-CairoBold">لا يوجد ركاب حالياً</Text>
          </View>
        )}
      </View>
    ),
    [allPassengers, passengerNames, passengerGenders]
  );

  // Render pending requests for driver
  const renderPendingRequests = useCallback(() => {
    if (isDriver && pendingRequests.length > 0) {
      return (
        <View className="p-4 m-3">
          <CustomButton
            title={`طلبات الحجز المعلقة (${pendingRequests.length})`}
            onPress={() => router.push({
              pathname: '/ride-requests',
              params: {
                rideId: ride?.id,
                driverId: ride?.driver_id,
                origin: ride?.origin_address,
                destination: ride?.destination_address,
                rideTime: ride?.ride_datetime,
                availableSeats: ride?.available_seats?.toString(),
                requiredGender: ride?.required_gender,
                noSmoking: ride?.no_smoking?.toString(),
                noMusic: ride?.no_music?.toString(),
                noChildren: ride?.no_children?.toString()
              }
            })}
            className="bg-blue-500 py-3 rounded-xl"
          />
        </View>
      );
    }
    return null;
  }, [isDriver, pendingRequests.length, ride]);

  // Add these new functions after the existing handle functions
  const handleStartRide = async () => {
    try {
      if (Platform.OS === 'android') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      if (!ride || !ride.id) {
        Alert.alert('معلومات الرحلة غير مكتملة');
        return;
      }

      const currentStatus = ride.status;

      // Update local state immediately
      setRide(prevRide => prevRide ? { ...prevRide, status: 'in-progress' } : null);

      // Update Firebase
      await updateDoc(doc(db, 'rides', ride.id), {
        status: 'in-progress',
        updated_at: serverTimestamp(),
      });

      // Notify all passengers
      for (const passenger of allPassengers) {
        await sendRideStatusNotification(
          passenger.user_id,
          'بدأت الرحلة!',
          `بدأ السائق رحلتك من ${ride.origin_address} إلى ${ride.destination_address}`,
          ride.id
        );
      }

      Alert.alert('✅ تم بدء الرحلة بنجاح');
    } catch (error) {
      // Revert local state if Firebase update fails
      if (ride) {
        setRide(prevRide => prevRide ? { ...prevRide, status: ride.status } : null);
      }
      console.error('Error starting ride:', error);
      Alert.alert('حدث خطأ أثناء بدء الرحلة.');
    }
  };

  const handleFinishRide = async () => {
    try {
      if (Platform.OS === 'android') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      if (!ride || !ride.id) {
        Alert.alert('معلومات الرحلة غير مكتملة');
        return;
      }

      // Update ride status to completed
      await updateDoc(doc(db, 'rides', ride.id), {
        status: 'completed',
        updated_at: serverTimestamp(),
      });

      // Update local ride state
      setRide(prevRide => prevRide ? { ...prevRide, status: 'completed' } : null);

      // Notify all passengers
      for (const passenger of allPassengers) {
        await sendRideStatusNotification(
          passenger.user_id,
          'تم إنهاء الرحلة!',
          `تم إنهاء رحلتك من ${ride.origin_address} إلى ${ride.destination_address}`,
          ride.id
        );
      }

      // If it's a recurring ride, ask the driver if they want to continue next week
      if (ride.is_recurring) {
        Alert.alert(
          'رحلة متكررة',
          'هل تريد تكرار هذه الرحلة للأسبوع القادم؟',
          [
            {
              text: 'لا',
              style: 'cancel',
              onPress: () => {
                Alert.alert('✅ تم إنهاء الرحلة بنجاح');
              }
            },
            {
              text: 'نعم',
              onPress: async () => {
                try {
                  // Calculate next week's date
                  const currentRideDate = parse(ride.ride_datetime, DATE_FORMAT, new Date());
                  const nextWeekDate = new Date(currentRideDate);
                  nextWeekDate.setDate(nextWeekDate.getDate() + 7);
                  const nextWeekDateTime = format(nextWeekDate, DATE_FORMAT);

                  // Get the highest ride number
                  const ridesRef = collection(db, 'rides');
                  const q = query(ridesRef, orderBy('ride_number', 'desc'), limit(1));
                  const querySnapshot = await getDocs(q);
                  const highestRide = querySnapshot.docs[0];
                  const nextRideNumber = highestRide ? highestRide.data().ride_number + 1 : 1;

                  // Create new ride document with custom ID
                  const newRideId = `(${ride.ride_number})`;
                  await setDoc(doc(db, 'rides', newRideId), {
                    origin_address: ride.origin_address,
                    destination_address: ride.destination_address,
                    origin_latitude: ride.origin_latitude,
                    origin_longitude: ride.origin_longitude,
                    destination_latitude: ride.destination_latitude,
                    destination_longitude: ride.destination_longitude,
                    ride_datetime: nextWeekDateTime,
                    driver_id: ride.driver_id,
                    status: 'available',
                    available_seats: ride.driver?.car_seats || DEFAULT_CAR_SEATS,
                    is_recurring: true,
                    no_children: ride.no_children,
                    no_music: ride.no_music,
                    no_smoking: ride.no_smoking,
                    required_gender: ride.required_gender,
                    ride_days: ride.ride_days,
                    ride_number: nextRideNumber,
                    created_at: serverTimestamp(),
                  });

                  // Notify driver about the new ride
                  await sendRideStatusNotification(
                    ride.driver_id || '',
                    'تم إنشاء رحلة جديدة',
                    `تم إنشاء رحلة جديدة للأسبوع القادم من ${ride.origin_address} إلى ${ride.destination_address}`,
                    newRideId
                  );

                  Alert.alert(
                    '✅ تم إنشاء الرحلة الجديدة',
                    'تم إنشاء رحلة جديدة للأسبوع القادم بنفس التفاصيل'
                  );
                } catch (error) {
                  console.error('Error creating next week ride:', error);
                  Alert.alert('حدث خطأ أثناء إنشاء الرحلة الجديدة');
                }
              }
            }
          ]
        );
      } else {
        Alert.alert('✅ تم إنهاء الرحلة بنجاح');
      }
    } catch (error) {
      console.error('Error finishing ride:', error);
      Alert.alert('حدث خطأ أثناء إنهاء الرحلة.');
    }
  };

  const handleCancelRideByDriver = async () => {
    try {
      if (Platform.OS === 'android') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      if (!ride || !ride.id) {
        Alert.alert('معلومات الرحلة غير مكتملة');
        return;
      }

      await updateDoc(doc(db, 'rides', ride.id), {
        status: 'cancelled',
        updated_at: serverTimestamp(),
      });

      // Notify all passengers
      for (const passenger of allPassengers) {
        await sendRideStatusNotification(
          passenger.user_id,
          'تم إلغاء الرحلة',
          `تم إلغاء رحلتك من ${ride.origin_address} إلى ${ride.destination_address}`,
          ride.id
        );
      }

      Alert.alert('✅ تم إلغاء الرحلة بنجاح');
    } catch (error) {
      console.error('Error cancelling ride:', error);
      Alert.alert('حدث خطأ أثناء إلغاء الرحلة.');
    }
  };

  // Add this useEffect to check ride time and update status
  useEffect(() => {
    if (!ride || !ride.ride_datetime) return;

    const checkRideTime = async () => {
      const rideTime = parse(ride.ride_datetime, DATE_FORMAT, new Date());
      const now = new Date();
      
      // Add 15 minutes to ride time for grace period
      const gracePeriodEnd = new Date(rideTime.getTime() + 15 * 60000);
      
      // If current time is past grace period and ride is still available/full
      if (now > gracePeriodEnd && (ride.status === 'available' || ride.status === 'full')) {
        // Update ride status to on-hold
        await updateDoc(doc(db, 'rides', ride.id), {
          status: 'on-hold',
          updated_at: serverTimestamp(),
        });

        // Notify driver that the ride is on hold
        if (ride.driver_id) {
          await sendRideStatusNotification(
            ride.driver_id,
            'الرحلة في وضع الانتظار',
            `لم يتم بدء الرحلة بعد 15 دقيقة من وقتها المحدد. الرحلة من ${ride.origin_address} إلى ${ride.destination_address}`,
            ride.id
          );
        }

        // Notify all accepted passengers
        const rideRequestsRef = collection(db, 'ride_requests');
        const q = query(
          rideRequestsRef,
          where('ride_id', '==', ride.id),
          where('status', '==', 'accepted')
        );
        const querySnapshot = await getDocs(q);
        
        for (const doc of querySnapshot.docs) {
          const request = doc.data();
          await sendRideStatusNotification(
            request.user_id,
            'الرحلة في وضع الانتظار',
            `لم يتم بدء الرحلة بعد 15 دقيقة من وقتها المحدد. الرحلة من ${ride.origin_address} إلى ${ride.destination_address}`,
            ride.id
          );
        }
      }
    };

    // Check immediately
    checkRideTime();

    // Check every minute
    const interval = setInterval(checkRideTime, 60000);
    return () => clearInterval(interval);
  }, [ride]);

  // Add this useEffect to check ride time in real-time
  useEffect(() => {
    if (!ride?.ride_datetime) return;

    const checkRideTime = () => {
      const rideTime = parse(ride.ride_datetime, DATE_FORMAT, new Date());
      const now = new Date();
      const gracePeriodEnd = new Date(rideTime.getTime() + 15 * 60000);
      setIsRideTime(now >= gracePeriodEnd);
    };

    // Check immediately
    checkRideTime();

    // Check every minute
    const interval = setInterval(checkRideTime, 60000);
    return () => clearInterval(interval);
  }, [ride?.ride_datetime]);

  // Add this useEffect to listen for ride status changes
  useEffect(() => {
    if (!ride?.id) return;

    const rideDocRef = doc(db, 'rides', ride.id);
    const unsubscribe = onSnapshot(rideDocRef, async (doc) => {
      if (doc.exists()) {
        const updatedData = doc.data();
        const oldStatus = ride.status;
        const newStatus = updatedData.status;
        
        setRide(prevRide => prevRide ? { ...prevRide, status: newStatus } : null);

        // If status changed to on-hold, notify driver
        if (oldStatus !== 'on-hold' && newStatus === 'on-hold' && ride.driver_id) {
          await sendRideStatusNotification(
            ride.driver_id,
            'الرحلة في وضع الانتظار',
            `لم يتم بدء الرحلة بعد 15 دقيقة من وقتها المحدد. الرحلة من ${ride.origin_address} إلى ${ride.destination_address}`,
            ride.id
          );
        }
      }
    });

    return () => unsubscribe();
  }, [ride?.id]);

  // Update rating state when ride changes
  useEffect(() => {
    if (ride && userId) {
      setRating(prev => ({
        ...prev,
        ride_id: ride.id,
        driver_id: ride.driver_id || '',
        passenger_id: userId,
        ride_details: {
          origin_address: ride.origin_address,
          destination_address: ride.destination_address,
          ride_datetime: ride.ride_datetime
        }
      }));
    }
  }, [ride, userId]);

  // Modify the renderActionButtons function
  const renderActionButtons = useCallback(() => {
    if (isDriver) {
      // Check if ride is full
      if (ride?.available_seats === 0 && ride.status === 'available') {
        updateDoc(doc(db, 'rides', ride.id), {
          status: 'full',
          updated_at: serverTimestamp(),
        });
      }

      switch (ride?.status) {
        case 'available':
        case 'full':
          return (
            <View className="p-4 m-3">
              {isRideTime && (
                <CustomButton
                  title="بدء الرحلة"
                  onPress={handleStartRide}
                  className="bg-blue-500 py-3 rounded-xl mb-3"
                />
              )}
              <CustomButton
                title="إلغاء الرحلة"
                onPress={handleCancelRideByDriver}
                className="bg-red-500 py-3 rounded-xl"
              />
            </View>
          );
        case 'in-progress':
          return (
            <View className="p-4 m-3">
              <CustomButton
                title="إنهاء الرحلة"
                onPress={handleFinishRide}
                className="bg-green-500 py-3 rounded-xl"
              />
            </View>
          );
        case 'completed':
          return (
            <View className="p-4 m-3 bg-green-100 rounded-xl">
              <View className="flex-row items-center justify-center">
                <MaterialIcons name="check-circle" size={24} color="#10B981" />
                <Text className="text-green-700 font-CairoBold mr-2 text-lg">تم إكمال الرحلة بنجاح</Text>
              </View>
            </View>
          );
        case 'cancelled':
          return null;
        case 'on-hold':
          return (
            <View className="p-4 m-3">
              <CustomButton
                title="بدء الرحلة"
                onPress={handleStartRide}
                className="bg-blue-500 py-3 rounded-xl"
              />
            </View>
          );
        default:
          return null;
      }
    } else {
      // Passenger buttons
      if (!rideRequest) {
        // Show book button if ride is available or full
        if (ride?.status === 'available' || ride?.status === 'full') {
          return (
            <View className="p-4 m-3">
              <CustomButton
                title={ride.available_seats > 0 ? "طلب حجز الرحلة" : "طلب حجز (قائمة الانتظار)"}
                onPress={handleBookRide}
                className={`${ride.available_seats > 0 ? "bg-orange-500" : "bg-yellow-500"} py-3 rounded-xl`}
              />
            </View>
          );
        } else if (ride?.status === 'in-progress') {
          return (
            <View className="p-4 m-3 bg-blue-100 rounded-xl">
              <Text className="text-blue-800 font-CairoBold text-center text-lg">
                الرحلة جارية حالياً - لا يمكن حجز مقعد
              </Text>
            </View>
          );
        } else if (ride?.status === 'completed') {
          return (
            <View className="p-4 m-3 bg-gray-100 rounded-xl">
              <Text className="text-gray-700 font-CairoBold text-center text-lg">
                تم إكمال الرحلة
              </Text>
            </View>
          );
        } else if (ride?.status === 'cancelled') {
          return (
            <View className="p-4 m-3 bg-gray-100 rounded-xl">
              <Text className="text-gray-700 font-CairoBold text-center text-lg">
                تم إلغاء الرحلة
              </Text>
            </View>
          );
        } else if (ride?.status === 'on-hold') {
          return (
            <View className="p-4 m-3 bg-yellow-100 rounded-xl">
              <Text className="text-yellow-800 font-CairoBold text-center text-lg">
                الرحلة في وضع الانتظار - لا يمكن حجز مقعد
              </Text>
            </View>
          );
        }
      } else {
        // Show different buttons based on request status
        switch (rideRequest.status) {
          case 'waiting':
            return (
              <View className="p-4 m-3">
                <View className="bg-yellow-100 p-4 rounded-xl mb-3">
                  <Text className="text-yellow-800 font-CairoBold text-center text-lg">
                    {rideRequest.is_waitlist ? 'في قائمة الانتظار - سيتم إخطارك عند توفر مقعد' : 'في انتظار موافقة السائق'}
                  </Text>
                </View>
                <CustomButton
                  title="إلغاء طلب الحجز"
                  onPress={handleCancelRide}
                  className="bg-red-500 py-3 rounded-xl"
                />
              </View>
            );
          case 'accepted':
            return (
              <View className="p-4 m-3">
                <CustomButton
                  title="تسجيل الدخول"
                  onPress={handleCheckIn}
                  className="bg-green-500 py-3 rounded-xl mb-3"
                />
                <CustomButton
                  title="إلغاء الحجز"
                  onPress={handleCancelRide}
                  className="bg-red-500 py-3 rounded-xl"
                />
              </View>
            );
          case 'checked_in':
            return (
              <View className="p-4 m-3">
                <CustomButton
                  title="تسجيل الخروج"
                  onPress={handleCheckOut}
                  className="bg-orange-500 py-3 rounded-xl"
                />
              </View>
            );
          case 'checked_out':
            return (
              <View className="p-4 m-3 bg-gray-100 rounded-xl">
                <Text className="text-gray-700 font-CairoBold text-center text-lg">
                  تم إكمال الرحلة
                </Text>
              </View>
            );
          case 'rejected':
            return (
              <View className="p-4 m-3 bg-gray-100 rounded-xl">
                <Text className="text-gray-700 font-CairoBold text-center text-lg">
                  تم رفض طلب الحجز
                </Text>
              </View>
            );
          case 'cancelled':
            return (
              <View className="p-4 m-3 bg-gray-100 rounded-xl">
                <Text className="text-gray-700 font-CairoBold text-center text-lg">
                  تم إلغاء الحجز
                </Text>
              </View>
            );
          default:
            return null;
        }
      }
    }
  }, [isDriver, ride, rideRequest, allPassengers, isRideTime]);

  useEffect(() => {
    fetchRideDetails();
  }, [fetchRideDetails]);

  // Replace the existing Rating Modal with this new one
  const renderRatingModal = () => (
    <Modal
      visible={showRatingModal}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowRatingModal(false)}
    >
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' }}>
        <ScrollView className="w-[90%] max-h-[80%]">
          <View className="bg-white p-6 rounded-2xl">
            {/* Header */}
            <View className="items-center mb-6">
              <MaterialIcons name="star" size={40} color="#f97316" />
              <Text className="text-2xl font-CairoBold mt-2 text-center text-gray-800">قيّم رحلتك</Text>
              <Text className="text-sm font-CairoRegular mt-1 text-center text-gray-500">ساعدنا في تحسين خدمتنا</Text>
            </View>

            {/* Rating Categories */}
            <View className="space-y-6">
              {/* Overall Rating */}
              <View className="bg-gray-50 p-4 rounded-xl">
                <Text className="text-lg font-CairoBold mb-3 text-right text-gray-800">التقييم العام</Text>
                <View className="flex-row justify-center space-x-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <TouchableOpacity 
                      key={star} 
                      onPress={() => setRating(prev => ({ ...prev, overall: star }))}
                      className="p-2"
                    >
                      <Text style={{ fontSize: 32 }}>{star <= rating.overall ? '⭐' : '☆'}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Driving Rating */}
              <View className="bg-gray-50 p-4 rounded-xl">
                <View className="flex-row-reverse items-center justify-between mb-3">
                  <Text className="text-lg font-CairoBold text-gray-800">قيادة السيارة</Text>
                  <MaterialIcons name="directions-car" size={24} color="#f97316" />
                </View>
                <View className="flex-row justify-center space-x-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <TouchableOpacity 
                      key={star} 
                      onPress={() => setRating(prev => ({ ...prev, driving: star }))}
                      className="p-2"
                    >
                      <Text style={{ fontSize: 32 }}>{star <= rating.driving ? '⭐' : '☆'}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Behavior Rating */}
              <View className="bg-gray-50 p-4 rounded-xl">
                <View className="flex-row-reverse items-center justify-between mb-3">
                  <Text className="text-lg font-CairoBold text-gray-800">الأخلاق والسلوك</Text>
                  <MaterialIcons name="people" size={24} color="#f97316" />
                </View>
                <View className="flex-row justify-center space-x-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <TouchableOpacity 
                      key={star} 
                      onPress={() => setRating(prev => ({ ...prev, behavior: star }))}
                      className="p-2"
                    >
                      <Text style={{ fontSize: 32 }}>{star <= rating.behavior ? '⭐' : '☆'}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Punctuality Rating */}
              <View className="bg-gray-50 p-4 rounded-xl">
                <View className="flex-row-reverse items-center justify-between mb-3">
                  <Text className="text-lg font-CairoBold text-gray-800">الالتزام بالمواعيد</Text>
                  <MaterialIcons name="access-time" size={24} color="#f97316" />
                </View>
                <View className="flex-row justify-center space-x-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <TouchableOpacity 
                      key={star} 
                      onPress={() => setRating(prev => ({ ...prev, punctuality: star }))}
                      className="p-2"
                    >
                      <Text style={{ fontSize: 32 }}>{star <= rating.punctuality ? '⭐' : '☆'}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Cleanliness Rating */}
              <View className="bg-gray-50 p-4 rounded-xl">
                <View className="flex-row-reverse items-center justify-between mb-3">
                  <Text className="text-lg font-CairoBold text-gray-800">نظافة السيارة</Text>
                  <MaterialIcons name="cleaning-services" size={24} color="#f97316" />
                </View>
                <View className="flex-row justify-center space-x-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <TouchableOpacity 
                      key={star} 
                      onPress={() => setRating(prev => ({ ...prev, cleanliness: star }))}
                      className="p-2"
                    >
                      <Text style={{ fontSize: 32 }}>{star <= rating.cleanliness ? '⭐' : '☆'}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Comment Input */}
              <View className="bg-gray-50 p-4 rounded-xl">
                <View className="flex-row-reverse items-center justify-between mb-3">
                  <Text className="text-lg font-CairoBold text-gray-800">تعليقك (اختياري)</Text>
                  <MaterialIcons name="comment" size={24} color="#f97316" />
                </View>
                <TextInput
                  className="border border-gray-200 rounded-xl p-3 text-right bg-white"
                  multiline
                  numberOfLines={3}
                  placeholder="اكتب تعليقك هنا..."
                  placeholderTextColor="#9CA3AF"
                  value={rating.comment}
                  onChangeText={(text) => setRating(prev => ({ ...prev, comment: text }))}
                  style={{ textAlignVertical: 'top' }}
                />
              </View>
            </View>

            {/* Buttons */}
            <View className="flex-row justify-between mt-6 space-x-3">
              <CustomButton
                title="إرسال التقييم"
                onPress={handleRateDriver}
                className="flex-1 bg-orange-500 py-3 rounded-xl"
                icon={<MaterialIcons name="send" size={20} color="white" />}
              />
              <CustomButton
                title="إلغاء"
                onPress={() => setShowRatingModal(false)}
                className="flex-1 bg-gray-500 py-3 rounded-xl"
                icon={<MaterialIcons name="close" size={20} color="white" />}
              />
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color="#f97316" />
        <Text className="mt-4 text-black font-CairoMedium">جاري تحميل تفاصيل الرحلة...</Text>
      </View>
    );
  }

  if (error || !formattedRide) {
    return (
      <View className="flex-1 justify-center items-center p-4 bg-white">
        <MaterialIcons name="error-outline" size={48} color="#f97316" />
        <Text className="mt-4 text-black text-center font-CairoMedium">{error || 'الرحلة غير موجودة.'}</Text>
        <CustomButton
          title="إعادة المحاولة"
          onPress={() => {
            if (Platform.OS === 'android') {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }
            fetchRideDetails();
          }}
          className="mt-4 bg-orange-500 py-3 px-6 rounded-xl"
        />
        <TouchableOpacity onPress={() => router.back()} className="mt-2">
          <Text className="text-blue-500 font-CairoMedium">العودة</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <RideLayout
      title=" "
      bottomSheetRef={bottomSheetRef}
      origin={{
        latitude: formattedRide.origin_latitude || 0,
        longitude: formattedRide.origin_longitude || 0,
      }}
      destination={{
        latitude: formattedRide.destination_latitude || 0,
        longitude: formattedRide.destination_longitude || 0,
      }}
      MapComponent={RideMap}
    >
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 0 }}
        showsVerticalScrollIndicator={true}
        keyboardShouldPersistTaps="handled"
        className="flex-1 w-full"
      >
        {renderDriverInfo()}
        {renderRideDetails()}
        {renderCurrentPassengers()}
        {renderPendingRequests()}
        {renderActionButtons()}
      </ScrollView>

      {renderRatingModal()}

      {/* Image Modal */}
      <Modal
        visible={showImageModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowImageModal(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' }}
          onPress={() => setShowImageModal(false)}
        >
          <Image
            source={{ uri: selectedImage ?? DEFAULT_CAR_IMAGE }}
            style={{ width: '90%', height: 200, resizeMode: 'contain', borderRadius: 10 }}
          />
          <Text className="text-white mt-4 font-CairoBold">اضغط في أي مكان للإغلاق</Text>
        </Pressable>
      </Modal>
    </RideLayout>
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

export default RideDetails;