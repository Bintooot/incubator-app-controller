import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Alert,
  ActivityIndicator,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialIcons, Entypo, FontAwesome5 } from "@expo/vector-icons";
import { NetworkInfo } from "react-native-network-info";

export default function ESP32ProvisioningScreen() {
  const [loading, setLoading] = useState(false);
  const [esp32Ip, setEsp32Ip] = useState(null);
  const [pollingStatus, setPollingStatus] = useState("idle");
  const [resetting, setResetting] = useState(false);
  const [connectedToESP, setConnectedToESP] = useState(false);

  useEffect(() => {
    const checkNetwork = () => {
      NetworkInfo.getSSID().then((ssid) => {
        setConnectedToESP(ssid === "ESP32_Config");
      });
    };

    // Check immediately
    checkNetwork();

    // Then check every 2 seconds
    const interval = setInterval(checkNetwork, 2000);

    return () => clearInterval(interval);
  }, []);

  const openESP32Page = async () => {
    const url = "http://192.168.4.1";
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      Linking.openURL(url);
    } else {
      Alert.alert("Error", "Unable to open the ESP32 provisioning page.");
    }
  };

  const pollESP32ForIp = async () => {
    setLoading(true);
    setPollingStatus("polling");

    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      try {
        const res = await fetch("http://192.168.4.1/ip");
        const json = await res.json();

        if (json.status === "connected" && json.ip) {
          setEsp32Ip(json.ip);
          await AsyncStorage.setItem("esp32_ip", json.ip);
          setPollingStatus("success");
          setLoading(false);

          try {
            await fetch("http://192.168.4.1/trigger-restart", {
              method: "POST",
            });
          } catch (err) {
            console.warn("Failed to trigger restart:", err);
          }

          return;
        }
      } catch (err) {
        console.warn("Polling error:", err);
      }

      await new Promise((res) => setTimeout(res, 3000));
      attempts++;
    }

    setPollingStatus("failed");
    setLoading(false);

    Alert.alert(
      "Connection Failed",
      "ESP32 did not connect within expected time."
    );
  };

  const handleClearCredentials = async () => {
    try {
      setResetting(true);
      const res = await fetch("http://192.168.4.1/reset-wifi", {
        method: "POST",
      });
      const data = await res.json();

      if (res.ok) {
        await AsyncStorage.removeItem("esp32_ip");
        setEsp32Ip(null);
        Alert.alert("Success", data.message || "Wi-Fi credentials cleared.");
      } else {
        Alert.alert(
          "Error",
          data.message || "Failed to clear ESP32 credentials."
        );
      }
    } catch (error) {
      Alert.alert("Error", "Failed to communicate with ESP32.");
    } finally {
      setResetting(false);
    }
  };

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
        <TouchableOpacity style={styles.primaryButton} onPress={openESP32Page}>
          <MaterialIcons name="launch" size={20} color="white" />
          <Text style={styles.buttonText}>Open Provisioning Page</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.successButton, loading && styles.disabled]}
          onPress={pollESP32ForIp}
          disabled={loading}
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

        {esp32Ip === null ? (
          // Show this when ESP32 IP is not set (not provisioned yet)
          <View>
            <Text style={styles.stepText}>
              <Text style={styles.bold}>Step 3:</Text> Check if ESP32 connected
              to WiFi
            </Text>
            <TouchableOpacity
              style={[styles.successButton, loading && styles.disabled]}
              onPress={pollESP32ForIp}
              disabled={loading}
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
              style={[styles.dangerButton, resetting && styles.disabled]}
              onPress={handleClearCredentials}
              disabled={resetting}
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

      {pollingStatus === "success" && (
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
