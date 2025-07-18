import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Platform,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { LinearGradient } from "expo-linear-gradient";

import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import axios from "axios";
import CheckBox from "@/components/CheckBox";

import AsyncStorage from "@react-native-async-storage/async-storage";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Define message interface for push notifications
interface Message {
  to: string;
  sound: string;
  title: string;
  body: string;
  data: { [key: string]: string };
}

// Function to send notification
const sendNotification = async (message: Message) => {
  await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Accept-encoding": "gzip, deflate",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(message),
  });
};

// Function for push notifications when the temperature and humidity are within ideal range
const sendIdealConditionsNotification = async (expoPushToken: string) => {
  const message: Message = {
    to: expoPushToken,
    sound: "default",
    title: "Incubator Alert",
    body: "The temperature and humidity are within the ideal range!",
    data: { someData: "ideal" },
  };
  await sendNotification(message);
};

// Functions for each condition (high/low temperature, high/low humidity, etc.)
const highTemperature = async (expoPushToken: string) => {
  const message: Message = {
    to: expoPushToken,
    sound: "default",
    title: "Incubator Alert",
    body: "The incubator temperature is too high!",
    data: { someData: "highTemp" },
  };
  await sendNotification(message);
};

const lowTemperature = async (expoPushToken: string) => {
  const message: Message = {
    to: expoPushToken,
    sound: "default",
    title: "Incubator Alert",
    body: "The incubator temperature is too low!",
    data: { someData: "lowTemp" },
  };
  await sendNotification(message);
};

const lowHumidity = async (expoPushToken: string) => {
  const message: Message = {
    to: expoPushToken,
    sound: "default",
    title: "Incubator Alert",
    body: "The incubator humidity is too low!",
    data: { someData: "lowHumidity" },
  };
  await sendNotification(message);
};

function handleRegistrationError(errorMessage: string) {
  alert(errorMessage);
  throw new Error(errorMessage);
}

async function registerForPushNotificationsAsync() {
  if (Platform.OS === "android") {
    Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FF231F7C",
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") {
      handleRegistrationError(
        "Permission not granted to get push token for push notification!"
      );
      return;
    }
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.easConfig?.projectId;
    if (!projectId) {
      handleRegistrationError("Project ID not found");
    }
    try {
      const pushTokenString = (
        await Notifications.getExpoPushTokenAsync({ projectId })
      ).data;
      console.log(pushTokenString);
      return pushTokenString;
    } catch (e: unknown) {
      handleRegistrationError(`${e}`);
    }
  } else {
    handleRegistrationError("Must use physical device for push notifications");
  }
}

export default function HomeScreen() {
  const [esp32Ip, setEsp32Ip] = useState<string | null>(null);

  // Setting URL  Connection //
  const URL = esp32Ip ? `http://${esp32Ip}` : null;
  const ESP32_URL_DHT22 = `${URL}/sensor`;
  const ESP32_IP_MOTOR_1 = `${URL}`;

  const [expoPushToken, setExpoPushToken] = useState("");
  const [data, setData] = useState<{
    temperature: number;
    humidity: number;
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [disableButton, setDisableButton] = useState(false);
  const [upperStepperPosition, setUpperStepperPosition] = useState("");
  const [motorStatus, setMotorStatus] = useState("");
  const [notification, setNotification] = useState({
    type: "error",
    message: "Connection disconnected",
  });

  const [status, setStatus] = useState("Waiting for command...");
  const [time, setTIme] = useState(new Date());

  //converting into readable string

  const formattedTime = time.toLocaleTimeString();

  //checkbox
  const options = [
    { label: "Morning | 8:00 AM", time: "8:00" },
    { label: "Afternoon | 1:00 PM", time: "13:00" },
    { label: "Evening | 6:00 PM", time: "18:00" },
  ];

  const [selected, setSelected] = useState<string[]>([]);
  const [schedule, setSchedule] = useState<string[]>([]);

  const [currentSchedule, setCurrentSchedule] = useState<string[]>([]);

  const toggleOption = (time: string) => {
    setSelected((prev) =>
      prev.includes(time) ? prev.filter((t) => t !== time) : [...prev, time]
    );
  };

  const loadIp = async () => {
    try {
      const savedIp = await AsyncStorage.getItem("esp32_ip");

      if (savedIp) {
        setEsp32Ip(savedIp);
      } else {
        Alert.alert("Error", "ESP32 IP not found. Please connect first.");
      }
    } catch (error) {
      console.error("Failed to load ESP32 IP:", error);
      Alert.alert("Error", "Something went wrong while loading ESP32 IP.");
    }
  };

  const fetchSchedule = async () => {
    if (!esp32Ip) {
      console.log("No ESP32 IP available");
      return;
    }

    const scheduleURL = `http://${esp32Ip}/get-schedule`;

    try {
      console.log("Fetching schedule from:", scheduleURL);
      const response = await axios.get(scheduleURL);
      console.log("Schedule response:", response.data);
      setCurrentSchedule(response.data.schedule);
    } catch (error: unknown) {
      let errorMessage = "Unknown error";
      if (error instanceof Error) errorMessage = error.message;
      console.error("Failed to fetch schedule:", errorMessage);
      Alert.alert(
        "Error",
        "Failed to fetch schedule - connection might be disconnected: " +
          errorMessage
      );
    }
  };

  useEffect(() => {
    loadIp();
  }, []);

  useEffect(() => {
    if (esp32Ip) {
      console.log("ESP32 IP changed to:", esp32Ip);

      setTimeout(() => {
        fetchSchedule();
      }, 100);
    }
  }, [esp32Ip]);

  // reset schedule time
  const resetSchedule = async () => {
    if (!URL) {
      Alert.alert("Error", "ESP32 IP not set.");
      return;
    }
    try {
      const response = await fetch(`${URL}/reset-schedule`, {
        method: "POST",
      });
      const resultText = await response.text();
      setSchedule([]); // Clear schedule state so checkboxes reappear
      setSelected([]); // Clear selections
      setCurrentSchedule([]);
      Alert.alert("Reset", resultText);
    } catch (error: unknown) {
      let errorMessage = "Unknown error";
      if (error instanceof Error) errorMessage = error.message;
      Alert.alert("Error", "Failed to reset schedule: " + errorMessage);
    }
  };

  // send time schedule function
  const sendSchedule = async () => {
    // Validate user selection
    const validSelected = selected.filter((time) => time !== "00:00");

    if (validSelected.length > 3) {
      Alert.alert(
        "Invalid Payload",
        "Please select only up to 3 schedule times."
      );
      return;
    }
    if (validSelected.length === 0) {
      Alert.alert("No time selected", "Please select at least one time.");
      return;
    }

    if (!URL) {
      Alert.alert("Error", "ESP32 IP not set.");
      return;
    }

    try {
      // Convert time strings to hour/minute format
      const selectedTimes = validSelected.map((timeStr) => {
        const [hourStr, minuteStr] = timeStr.split(":");
        return {
          hour: parseInt(hourStr, 10),
          minute: parseInt(minuteStr, 10),
        };
      });

      // Convert to byte array
      const byteData = selectedTimes.flatMap(({ hour, minute }) => [
        hour,
        minute,
      ]);

      const response = await fetch(`${URL}/set-schedule`, {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream",
        },
        body: new Uint8Array(byteData),
      });

      const resultText = await response.text();

      // Extract clean non-empty, non-0:00 schedule from ESP response
      const times = resultText
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line && line !== "0:00" && line !== "--:--");

      setSchedule(times);
      fetchSchedule();

      Alert.alert("Schedule Set", resultText);
    } catch (error: unknown) {
      let errorMessage = "Unknown error";
      if (error instanceof Error) errorMessage = error.message;
      Alert.alert("Error", "Failed to send schedule: " + errorMessage);
    }
  };

  // convert 24h to 12h

  function convertTo12Hour(time24: string): string {
    const [hourStr, minute] = time24.split(":");
    let hour = parseInt(hourStr, 10);
    const ampm = hour >= 12 ? "PM" : "AM";

    hour = hour % 12;
    if (hour === 0) hour = 12;

    return `${hour}:${minute} ${ampm}`;
  }

  // coontroller rendering

  const [mode, setMode] = useState(true);

  const changeMode = () => {
    setMode((prev) => !prev);
  };

  const IDEAL_TEMP_MIN = 37.5;
  const IDEAL_TEMP_MAX = 38.5;
  const IDEAL_HUMIDITY_MIN = 50;

  const lastCondition = useRef<string | null>(null);

  const checkConditions = async (
    temperature: number,
    humidity: number,
    expoPushToken: string
  ) => {
    let currentCondition = "";

    if (temperature < IDEAL_TEMP_MIN) {
      currentCondition = "low-temp";
    } else if (temperature > IDEAL_TEMP_MAX) {
      currentCondition = "high-temp";
    } else if (humidity < IDEAL_HUMIDITY_MIN) {
      currentCondition = "low-humidity";
    } else {
      currentCondition = "ideal";
    }

    // Only notify if condition has changed
    if (lastCondition.current !== currentCondition) {
      lastCondition.current = currentCondition;

      switch (currentCondition) {
        case "low-temp":
          setNotification({
            type: "low",
            message: "Temperature is too low!",
          });
          await lowTemperature(expoPushToken);
          break;
        case "high-temp":
          setNotification({
            type: "high",
            message: "Temperature is too high!",
          });
          await highTemperature(expoPushToken);
          break;
        case "low-humidity":
          setNotification({
            type: "low",
            message: "Humidity is too low!",
          });
          await lowHumidity(expoPushToken);
          break;
        case "ideal":
          setNotification({
            type: "average",
            message: "Temperature and humidity are within the ideal range!",
          });
          await sendIdealConditionsNotification(expoPushToken);
          break;
      }
    }
  };

  const motorControl = async (position: string) => {
    if (disableButton) return;
    if (!URL) {
      Alert.alert("Error", "ESP32 IP not set.");
      return;
    }
    try {
      if (position === "left") {
        setDisableButton(true);
        setUpperStepperPosition("left");
        rotateMotorLeft();
      } else if (position === "right") {
        setDisableButton(true);
        setUpperStepperPosition("right");
        rotateMotorRight();
      } else if (position === "restart") {
        setDisableButton(true);
        restartMotor();
      }
      setTimeout(() => {
        setDisableButton(false);
      }, 5000);
    } catch (error) {
      console.error("Error in motor control:", error);
      Alert.alert("Error", "Failed to control motor");
    }
  };

  // Function to handle motor control
  const rotateMotorLeft = async () => {
    setLoading(true);
    if (!URL) {
      Alert.alert("Error", "ESP32 IP not set.");
      return;
    }
    try {
      // Send GET request to ESP32 to rotate the motor
      const response = await axios.get(`${ESP32_IP_MOTOR_1}/left`);

      // Handle response if needed
      setStatus(response.data);
      console.log("Motor rotated left:", response.data);
    } catch (error) {
      // Show an error alert if there's an issue
      Alert.alert("Error", "Failed to rotate motor");
    }
    setLoading(false);
  };

  const rotateMotorRight = async () => {
    setLoading(true);
    if (!URL) {
      Alert.alert("Error", "ESP32 IP not set.");
      return;
    }
    try {
      // Send GET request to ESP32 to rotate the motor
      const response = await axios.get(`${ESP32_IP_MOTOR_1}/right`);
      // Handle response if needed
      setStatus(response.data);
      console.log("Motor rotated left:", response.data);
    } catch (error) {
      // Show an error alert if there's an issue
      Alert.alert("Error", "Failed to rotate motor");
    }
    setLoading(false);
  };

  const restartMotor = async () => {
    setStatus("Motor Restarted");
    setDisableButton(true);
    setTimeout(() => {
      setStatus("Waiting for command...");
    }, 5000);
    if (!URL) {
      Alert.alert("Error", "ESP32 IP not set.");
      return;
    }
    await axios.get(`${ESP32_IP_MOTOR_1}/restart`);
  };

  // Function to fetch sensor data from ESP32
  const getSensorData = async () => {
    if (!URL) {
      Alert.alert("Error", "ESP32 IP not set.");
      return;
    }
    try {
      setLoading(true); // Set loading to true before fetching
      const response = await fetch(ESP32_URL_DHT22);
      const data = await response.json();

      setData({
        temperature: data.temperature,
        humidity: data.humidity,
      });

      checkConditions(data.temperature, data.humidity, expoPushToken);

      console.log(data.temperature, data.humidity, expoPushToken);

      setLoading(false);
    } catch (err) {
      setError("Error fetching data");
      setLoading(false);
    }
  };

  useEffect(() => {
    if (esp32Ip) {
      getSensorData();
      const intervalId = setInterval(() => {
        getSensorData();
      }, 1000);
      return () => clearInterval(intervalId);
    }
  }, [esp32Ip]);

  //fetch real-time
  useEffect(() => {
    const timeInterval = setInterval(() => {
      setTIme(new Date());
    }, 1000);

    return () => clearInterval(timeInterval);
  }, []);

  useEffect(() => {
    registerForPushNotificationsAsync()
      .then((token) => setExpoPushToken(token ?? ""))
      .catch((error: any) => setExpoPushToken(`${error}`));
  }, []);

  return (
    <ScrollView style={styles.container}>
      <LinearGradient
        colors={["#4c669f", "#3b5998", "#192f6a"]}
        style={styles.headerGradient}
      >
        <View style={styles.header}>
          <Text style={styles.welcomeText}>Welcome back!</Text>
          <Text style={styles.subTitle}>Incubator Controller</Text>
        </View>
      </LinearGradient>

      {/* Status Card */}
      <View style={styles.section}>
        <View style={styles.cardHeader}>
          <MaterialCommunityIcons
            name="chart-box-outline"
            size={24}
            color="#4c669f"
          />
          <Text style={styles.cardTitle}>Current Status</Text>
        </View>
        <View style={styles.section}>
          <View style={styles.notficationBackground}>
            <Text
              style={
                notification.type === "average"
                  ? styles.aveSensorNotfication
                  : notification.type === "low"
                  ? styles.lowSensorNotfication
                  : notification.type === "high"
                  ? styles.highSensorNotfication
                  : styles.defaultNotification
              }
            >
              {notification.message}
            </Text>
          </View>
        </View>
        <View style={styles.card}>
          <View style={styles.statusContainer}>
            <View style={styles.statusItem}>
              <MaterialCommunityIcons
                name="thermometer"
                size={24}
                color="#FF6B6B"
              />
              <Text style={styles.statusValue}>{data?.temperature}°C</Text>
              <Text style={styles.statusLabel}>Temperature</Text>
              <View style={[styles.indicator, styles.indicatorGood]} />
            </View>
            <View style={styles.divider} />
            <View style={styles.statusItem}>
              <MaterialCommunityIcons
                name="water-percent"
                size={24}
                color="#4ECDC4"
              />
              <Text style={styles.statusValue}>{data?.humidity}%</Text>
              <Text style={styles.statusLabel}>Humidity</Text>
              <View style={[styles.indicator, styles.indicatorGood]} />
            </View>
          </View>
          <View style={styles.horizontaldevider} />
          <View style={styles.statusContainer}>
            <View style={styles.averageContainer}>
              <Text>Ave. Temperature</Text>
              <Text style={styles.averageValue}>37.5 °C</Text>
            </View>
            <View style={styles.averageContainer}>
              <Text>Ave. Humidity:</Text>
              <Text style={styles.averageValue}>50%</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.modeSwitcherContainer}>
        <Text style={styles.time}>{formattedTime}</Text>

        <TouchableOpacity style={styles.switchButton} onPress={changeMode}>
          <Text style={styles.switchButtonText}>
            Switch to {mode ? "Manual" : "Schedule"} Mode
          </Text>
        </TouchableOpacity>
      </View>

      {/* Stepper Motor Control */}
      <View style={styles.section}>
        {!mode && (
          <>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons
                name="rotate-3d-variant"
                size={24}
                color="#4c669f"
              />
              <Text style={styles.sectionTitle}>Stepper Motor Control</Text>
            </View>

            <View style={styles.section}>
              <View style={styles.notficationBackground}>
                <Text style={styles.aveSensorNotfication}>{status}</Text>
              </View>
            </View>

            <View style={styles.stepperCard}>
              <View style={styles.buttonLayout}>
                {/* Left Direction */}
                <View style={styles.buttonWidth}>
                  <Text style={styles.textCenter}>Left</Text>
                  <View>
                    <TouchableOpacity
                      style={[
                        styles.stepperButton,
                        upperStepperPosition === "left" &&
                          styles.activeStepperButton,
                      ]}
                      onPress={() => motorControl("left")}
                      disabled={disableButton}
                    >
                      <MaterialCommunityIcons
                        name="rotate-left"
                        size={24}
                        color={
                          upperStepperPosition === "left" ? "white" : "#4c669f"
                        }
                      />
                      <Text
                        style={[
                          styles.stepperButtonText,
                          upperStepperPosition === "left" &&
                            styles.activeStepperButtonText,
                        ]}
                      >
                        90° Left
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Right Direction */}
                <View style={styles.buttonWidth}>
                  <Text style={styles.textCenter}>Right</Text>
                  <View>
                    <TouchableOpacity
                      style={[
                        styles.stepperButton,
                        upperStepperPosition === "right" &&
                          styles.activeStepperButton,
                      ]}
                      onPress={() => motorControl("right")}
                      disabled={disableButton}
                    >
                      <MaterialCommunityIcons
                        name="rotate-right"
                        size={24}
                        color={
                          upperStepperPosition === "right" ? "white" : "#4c669f"
                        }
                      />
                      <Text
                        style={[
                          styles.stepperButtonText,
                          upperStepperPosition === "right" &&
                            styles.activeStepperButtonText,
                        ]}
                      >
                        90° Right
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {!disableButton && (
                <TouchableOpacity
                  style={[
                    styles.setScheduleButton,
                    { backgroundColor: "red", marginTop: 10 },
                  ]}
                  onPress={() => motorControl("restart")}
                  disabled={disableButton}
                >
                  <Text style={styles.restartText}>Restart Motor</Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        )}
      </View>

      {mode && (
        <View style={styles.section}>
          {/* 🟦 Header */}
          <View style={styles.sectionHeader}>
            <MaterialIcons name="schedule" size={24} color="#4c669f" />
            <Text style={styles.sectionTitle}>Tilting Schedule</Text>
          </View>

          {/* 🟩 Schedule Display */}
          <View style={styles.selectedGridContainer}>
            {(selected.length > 0 ? selected : currentSchedule || []).map(
              (time, index) => (
                <View key={index} style={styles.selectedGridItem}>
                  <Text style={styles.selectedGridText}>
                    {convertTo12Hour(time)}
                  </Text>
                </View>
              )
            )}

            {/* 🟥 Empty message */}
            {(!currentSchedule || currentSchedule.every((t) => !t)) &&
              selected.length === 0 && (
                <Text style={styles.selectedEmpty}>No schedule selected</Text>
              )}
          </View>

          {/* 🟧 Action Controls */}
          <View style={{ paddingHorizontal: 20, marginTop: 10 }}>
            {!currentSchedule || currentSchedule.every((t) => !t) ? (
              <>
                <View>
                  {options.map((option, index) => (
                    <CheckBox
                      key={index}
                      label={option.label}
                      checked={selected.includes(option.time)}
                      onToggle={() => toggleOption(option.time)}
                    />
                  ))}
                </View>

                <TouchableOpacity
                  style={styles.setScheduleButton}
                  onPress={sendSchedule}
                >
                  <Text style={styles.setScheduleButtonText}>
                    Set Time Schedule
                  </Text>
                </TouchableOpacity>
              </>
            ) : null}

            {/* 🟥 Reset button */}
            {currentSchedule && currentSchedule.some((t) => t) && (
              <TouchableOpacity
                style={[
                  styles.setScheduleButton,
                  { backgroundColor: "red", marginTop: 10 },
                ]}
                onPress={resetSchedule}
              >
                <Text style={styles.setScheduleButtonText}>Reset Schedule</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  time: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#333",
  },
  headerGradient: {
    paddingTop: 60,
    paddingBottom: 30,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    marginBottom: 16,
  },
  header: {
    paddingHorizontal: 20,
  },
  welcomeText: {
    fontSize: 32,
    fontWeight: "bold",
    color: "white",
    marginBottom: 8,
  },
  subTitle: {
    fontSize: 18,
    color: "rgba(255,255,255,0.8)",
  },
  cardsContainer: {
    padding: 16,
  },
  card: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginLeft: 10,
  },
  aveSensorNotfication: {
    fontSize: 20,
    textAlign: "center",
    color: "green",
  },
  lowSensorNotfication: {
    fontSize: 20,
    textAlign: "center",
    color: "#FF6347",
  },
  highSensorNotfication: {
    fontSize: 20,
    textAlign: "center",
    color: "#FF6347",
  },
  defaultNotification: {
    fontSize: 20,
    textAlign: "center",
    color: "red",
  },
  statusContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  averageContainer: {
    alignItems: "center",
  },
  averageValue: {
    fontWeight: "bold",
  },
  statusItem: {
    alignItems: "center",
    flex: 1,
  },
  divider: {
    width: 1,
    height: "100%",
    backgroundColor: "#eee",
  },
  horizontaldevider: {
    width: "100%",
    height: 1,
    backgroundColor: "#eee",
    marginVertical: 10,
  },
  statusValue: {
    fontSize: 24,
    fontWeight: "bold",
    marginTop: 8,
    color: "#333",
  },
  statusLabel: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 8,
  },
  indicatorGood: {
    backgroundColor: "#4CAF50",
  },
  section: {
    padding: 10,
  },
  notficationBackground: {
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginLeft: 10,
  },
  motorTitle: {
    fontSize: 18,
    fontWeight: "bold",
    textTransform: "uppercase",
    color: "#333",
    marginBottom: 10,
  },
  stepperCard: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  stepperVisual: {
    alignItems: "center",
    marginBottom: 10,
  },
  motorStatus: {
    alignItems: "center",
  },
  angleIndicator: {
    alignItems: "center",
  },
  angleArrow: {
    marginBottom: 8,
  },
  angleText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#4c669f",
  },
  stepperButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  stepperButton: {
    flex: 1,
    margin: 5,
    padding: 15,
    borderRadius: 15,
    backgroundColor: "#f8f9fa",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#4c669f",
  },
  activeStepperButton: {
    backgroundColor: "#4c669f",
  },
  stepperButtonText: {
    marginTop: 5,
    color: "#4c669f",
    fontWeight: "600",
  },
  activeStepperButtonText: {
    color: "white",
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  buttonLayout: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  buttonWidth: {
    flex: 1,
  },
  textCenter: {
    textAlign: "center",
    fontSize: 20,
    fontWeight: "bold",
    color: "#4c669f",
  },
  restartButton: {
    backgroundColor: "#bf0000",
    marginTop: 20,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  restartText: {
    color: "white",
    fontSize: 16,
  },

  // switcher

  modeSwitcherContainer: {
    padding: 16,
    marginHorizontal: 20,
    backgroundColor: "#f5f7fa",
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    alignItems: "center",
  },

  switchButton: {
    marginTop: 10,
    backgroundColor: "#4c669f",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },

  switchButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },

  setScheduleButton: {
    marginTop: 20,
    backgroundColor: "#28a745",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },

  setScheduleButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 0.5,
    textAlign: "center",
  },

  // Style for Tilting Schedule

  selectedGridContainer: {
    marginHorizontal: 20,
    marginTop: 10,
    padding: 10,
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: "#4c669f",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "center",
  },

  selectedGridItem: {
    width: "30%",
    backgroundColor: "#eaf0f9",
    paddingVertical: 10,
    marginVertical: 8,
    borderRadius: 8,
    alignItems: "center",
  },

  selectedGridText: {
    color: "#4c669f",
    fontWeight: "600",
  },

  selectedEmpty: {
    fontSize: 14,
    color: "#4c669f",
    backgroundColor: "#eaf0f9",
    padding: 10,
    borderRadius: 8,
    textAlign: "center",
  },
});
