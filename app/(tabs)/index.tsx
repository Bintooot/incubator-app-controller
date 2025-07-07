import React, { useEffect, useState } from "react";
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

// Setting URL  Connection //
const URL = "http://192.168.77.103";
const ESP32_URL_DHT22 = `${URL}/sensor`;
const ESP32_IP_MOTOR_1 = `${URL}`;

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

  const toggleOption = (time: string) => {
    setSelected((prev) =>
      prev.includes(time) ? prev.filter((t) => t !== time) : [...prev, time]
    );
  };

  // send time schedule function

  const sendSchedule = async () => {
    if (selected.length === 0) {
      Alert.alert("No time selected", "Please select at least one time.");
      return;
    }

    try {
      const selectedTimes = selected.map((timeStr) => {
        const [hourStr, minuteStr] = timeStr.split(":");
        return {
          hour: parseInt(hourStr, 10),
          minute: parseInt(minuteStr, 10),
        };
      });

      // Make sure exactly 3 entries are sent, pad with 0 if fewer
      while (selectedTimes.length < 3) {
        selectedTimes.push({ hour: 0, minute: 0 });
      }

      const byteData = selectedTimes
        .slice(0, 3)
        .flatMap(({ hour, minute }) => [hour, minute]);

      const response = await fetch(`http://${URL}/set-schedule`, {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream",
        },
        body: new Uint8Array(byteData),
      });

      const resultText = await response.text();
      Alert.alert("Response", resultText);
    } catch (error) {
      Alert.alert("Error", "Failed to send schedule: " + error);
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

  const checkConditions = async (
    temperature: number,
    humidity: number,
    expoPushToken: string
  ) => {
    if (temperature < IDEAL_TEMP_MIN) {
      setNotification({
        type: "low",
        message: "Temperature is too low!",
      });
      await lowTemperature(expoPushToken);
    } else if (temperature > IDEAL_TEMP_MAX) {
      setNotification({
        type: "high",
        message: "Temperature is too high!",
      });
      await highTemperature(expoPushToken);
    } else if (humidity < IDEAL_HUMIDITY_MIN) {
      setNotification({
        type: "low",
        message: "Humidity is too low!",
      });
      await lowHumidity(expoPushToken);
    } else {
      setNotification({
        type: "average",
        message: "Temperature and humidity are within the ideal range!",
      });
      await sendIdealConditionsNotification(expoPushToken);
    }
  };

  const motorControl = async (position: string) => {
    if (disableButton) return;
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
    await axios.get(`${ESP32_IP_MOTOR_1}/restart`);
  };

  // Function to fetch sensor data from ESP32
  const getSensorData = async () => {
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
    getSensorData();

    const intervalId = setInterval(() => {
      getSensorData();
    }, 3000);

    return () => clearInterval(intervalId);
  }, []);

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
                  style={styles.restartButton}
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
        <>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="schedule" size={24} color="#4c669f" />
              <Text style={styles.sectionTitle}>Tilting Schedule</Text>
            </View>

            <View style={styles.selectedGridContainer}>
              {selected.length > 0 ? (
                selected.map((time, index) => (
                  <View key={index} style={styles.selectedGridItem}>
                    <Text style={styles.selectedGridText}>
                      {convertTo12Hour(time)}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={styles.selectedEmpty}>No schedule selected</Text>
              )}
            </View>

            <View style={{ padding: 20 }}>
              {options.map((option, index) => (
                <CheckBox
                  key={index}
                  label={option.label}
                  checked={selected.includes(option.time)}
                  onToggle={() => toggleOption(option.time)}
                />
              ))}
              <TouchableOpacity
                style={styles.setScheduleButton}
                onPress={sendSchedule}
              >
                <Text style={styles.setScheduleButtonText}>
                  Set time schedule
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </>
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
