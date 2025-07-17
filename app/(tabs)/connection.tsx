import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Alert,
  ActivityIndicator,
  AppState,
  AppStateStatus,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialIcons, Entypo, FontAwesome5 } from "@expo/vector-icons";
import { NetworkInfo } from "react-native-network-info";

type PollingStatus = "idle" | "polling" | "success" | "failed";

export default function ESP32ProvisioningScreen() {
  const [loading, setLoading] = useState<boolean>(false);
  const [esp32Ip, setEsp32Ip] = useState<string | null>(null);
  const [pollingStatus, setPollingStatus] = useState<PollingStatus>("idle");
  const [resetting, setResetting] = useState<boolean>(false);
  const [connectedToESP, setConnectedToESP] = useState<boolean>(false);

  useEffect(() => {
    let interval: number | null = null;
    let isActive = true;
    let lastSSID: string | null = null;

    const checkNetwork = async () => {
      if (!isActive) return;

      try {
        const ssid = await NetworkInfo.getSSID();

        // Debug logs
        console.log("Raw SSID:", JSON.stringify(ssid));
        console.log("SSID type:", typeof ssid);
        console.log("Expected: ESP32_Config");
        console.log("Match:", ssid === "ESP32_Config");

        // Only update state if SSID actually changed
        if (ssid !== lastSSID) {
          lastSSID = ssid;
          const isConnected = ssid === "ESP32_Config";
          setConnectedToESP(isConnected);
          console.log("ESP32 connection status:", isConnected);
        }
      } catch (error) {
        console.log("SSID Error:", error);
        if (lastSSID !== null) {
          lastSSID = null;
          setConnectedToESP(false);
        }
      }
    };

    const startMonitoring = () => {
      // Clear any existing interval first
      if (interval) {
        clearInterval(interval);
      }

      console.log("Starting SSID monitoring...");
      checkNetwork(); // Check immediately
      interval = setInterval(checkNetwork, 1000); // Check every second
    };

    const stopMonitoring = () => {
      console.log("Stopping SSID monitoring...");
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    };

    // Start monitoring when component mounts
    startMonitoring();

    // Handle app state changes (foreground/background)
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      console.log("App state changed to:", nextAppState);
      if (nextAppState === "active") {
        isActive = true;
        startMonitoring();
      } else {
        isActive = false;
        stopMonitoring();
      }
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange
    );

    // Cleanup function
    return () => {
      console.log("Cleaning up SSID monitoring...");
      isActive = false;
      stopMonitoring();
      subscription?.remove();
    };
  }, []);

  const openESP32Page = async (): Promise<void> => {
    const url = "http://192.168.4.1";
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert("Error", "Unable to open the ESP32 provisioning page.");
      }
    } catch (error) {
      console.error("Error opening URL:", error);
      Alert.alert("Error", "Unable to open the ESP32 provisioning page.");
    }
  };

  const pollESP32ForIp = async (): Promise<void> => {
    setLoading(true);
    setPollingStatus("polling");

    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

        const res = await fetch("http://192.168.4.1/ip", {
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }

        const json = await res.json();

        if (json.status === "connected" && json.ip) {
          setEsp32Ip(json.ip);
          await AsyncStorage.setItem("esp32_ip", json.ip);
          setPollingStatus("success");
          setLoading(false);

          try {
            const restartController = new AbortController();
            const restartTimeoutId = setTimeout(
              () => restartController.abort(),
              3000
            );

            await fetch("http://192.168.4.1/trigger-restart", {
              method: "POST",
              signal: restartController.signal,
            });

            clearTimeout(restartTimeoutId);
          } catch (err) {
            console.warn("Failed to trigger restart:", err);
          }

          return;
        }
      } catch (err) {
        console.warn("Polling error:", err);
      }

      await new Promise((resolve) => setTimeout(resolve, 3000));
      attempts++;
    }

    setPollingStatus("failed");
    setLoading(false);

    Alert.alert(
      "Connection Failed",
      "ESP32 did not connect within expected time."
    );
  };

  const handleClearCredentials = async (): Promise<void> => {
    try {
      setResetting(true);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const res = await fetch("http://192.168.4.1/reset-wifi", {
        method: "POST",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const data = await res.json();

      await AsyncStorage.removeItem("esp32_ip");
      setEsp32Ip(null);
      Alert.alert("Success", data.message || "Wi-Fi credentials cleared.");
    } catch (error) {
      console.error("Error clearing credentials:", error);
      Alert.alert("Error", "Failed to communicate with ESP32.");
    } finally {
      setResetting(false);
    }
  };

  // Load saved ESP32 IP on component mount
  useEffect(() => {
    const loadSavedIP = async () => {
      try {
        const savedIP = await AsyncStorage.getItem("esp32_ip");
        if (savedIP) {
          setEsp32Ip(savedIP);
        }
      } catch (error) {
        console.error("Error loading saved IP:", error);
      }
    };

    loadSavedIP();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>ESP32 Provisioning</Text>

      <View style={styles.card}>
        <FontAwesome5 name="wifi" size={48} color="#4c669f" />
        <Text style={styles.stepText}>
          <Text style={styles.bold}>Step 1:</Text> Connect to{" "}
          <Text style={styles.highlight}>ESP32_Config</Text> Wi-Fi
        </Text>

        <Text style={styles.connectionStatus}>
          {connectedToESP
            ? "✅ Connected to ESP32_Config"
            : "⚠️ Not connected to ESP32_Config"}
        </Text>

        <Text style={styles.stepText}>
          <Text style={styles.bold}>Step 2:</Text> Open configuration page
        </Text>
        <TouchableOpacity
          style={[styles.primaryButton, !connectedToESP && styles.disabled]}
          onPress={openESP32Page}
          disabled={!connectedToESP}
        >
          <MaterialIcons name="launch" size={20} color="white" />
          <Text style={styles.buttonText}>Open Provisioning Page</Text>
        </TouchableOpacity>

        {esp32Ip === null ? (
          // Show this when ESP32 IP is not set (not provisioned yet)
          <View>
            <Text style={styles.stepText}>
              <Text style={styles.bold}>Step 3:</Text> Check if ESP32 connected
              to WiFi
            </Text>
            <TouchableOpacity
              style={[
                styles.successButton,
                (loading || !connectedToESP) && styles.disabled,
              ]}
              onPress={pollESP32ForIp}
              disabled={loading || !connectedToESP}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Entypo name="network" size={20} color="white" />
                  <Text style={styles.buttonText}>Check ESP32 IP</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          // Show this when ESP32 IP is already set (provisioned)
          <View>
            <Text style={styles.status}>✅ ESP32 connected at {esp32Ip}</Text>
            <TouchableOpacity
              style={[
                styles.dangerButton,
                (resetting || !connectedToESP) && styles.disabled,
              ]}
              onPress={handleClearCredentials}
              disabled={resetting || !connectedToESP}
            >
              {resetting ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <MaterialIcons name="restart-alt" size={20} color="white" />
                  <Text style={styles.buttonText}>Factory Reset ESP32</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>

      {pollingStatus === "success" && esp32Ip && (
        <Text style={styles.status}>✅ ESP32 connected at {esp32Ip}</Text>
      )}
      {pollingStatus === "failed" && (
        <Text style={[styles.status, { color: "#d32f2f" }]}>
          ❌ Failed to reach ESP32
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#f5f5f5",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 16,
  },
  card: {
    width: "100%",
    backgroundColor: "white",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    elevation: 3,
  },
  stepText: {
    fontSize: 16,
    color: "#444",
    marginTop: 20,
    textAlign: "center",
  },
  bold: {
    fontWeight: "bold",
  },
  highlight: {
    color: "#4c669f",
    fontWeight: "bold",
  },
  connectionStatus: {
    marginTop: 8,
    fontSize: 14,
    color: "#777",
    textAlign: "center",
  },
  buttonText: {
    color: "white",
    fontWeight: "bold",
    marginLeft: 10,
    fontSize: 16,
  },
  primaryButton: {
    flexDirection: "row",
    backgroundColor: "#4c669f",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginTop: 20,
    alignItems: "center",
  },
  successButton: {
    flexDirection: "row",
    backgroundColor: "#388e3c",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginTop: 15,
    alignItems: "center",
  },
  dangerButton: {
    flexDirection: "row",
    backgroundColor: "#d32f2f",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginTop: 15,
    alignItems: "center",
  },
  disabled: {
    opacity: 0.6,
  },
  status: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: "bold",
    color: "#2e7d32",
  },
});
