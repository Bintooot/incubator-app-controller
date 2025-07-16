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
import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function ESP32ProvisioningScreen() {
  const [loading, setLoading] = useState(false);
  const [esp32Ip, setEsp32Ip] = useState(null);
  const [pollingStatus, setPollingStatus] = useState("idle");

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
          console.log("✅ ESP32 connected at", json.ip);
          setEsp32Ip(json.ip);
          await AsyncStorage.setItem("esp32_ip", json.ip); // ✅ Save IP
          setPollingStatus("success");
          setLoading(false);
          return;
        }
      } catch (err) {
        if (err instanceof Error) {
          console.warn("Polling error:", err.message);
        } else {
          console.warn("Polling error:", err);
        }
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
      await fetch(`http://${esp32Ip}/reset-wifi`, { method: "POST" });
      await AsyncStorage.removeItem("esp32_ip");
      setEsp32Ip(null);
      Alert.alert("Success", "ESP32 credentials cleared and disconnected.");
    } catch (error) {
      Alert.alert("Error", "Failed to clear ESP32 credentials.");
    }
  };

  return (
    <View style={styles.container}>
      <View>
        {pollingStatus === "polling" && (
          <Text style={styles.statusText}>
            🔄 Waiting for ESP32 to connect...
          </Text>
        )}
        {pollingStatus === "success" && (
          <Text style={styles.statusText}>✅ ESP32 Connected at {esp32Ip}</Text>
        )}
        {pollingStatus === "failed" && (
          <Text style={styles.statusText}>❌ ESP32 not reachable.</Text>
        )}
      </View>

      <View style={styles.card}>
        <MaterialIcons name="wifi" size={64} color="#4c669f" />
        <Text style={styles.title}>ESP32 Setup</Text>
        <Text style={styles.subtitle}>
          1. Connect to Wi-Fi named{" "}
          <Text style={styles.bold}>ESP32_Config</Text>
        </Text>
        <Text style={styles.subtitle}>2. Tap below to open the setup page</Text>

        <TouchableOpacity onPress={openESP32Page} style={styles.button}>
          <Text style={styles.buttonText}>Open Provisioning Page</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={pollESP32ForIp}
          style={[styles.button, { backgroundColor: "#388e3c", marginTop: 12 }]}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Check ESP32 IP</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleClearCredentials}
          style={styles.button}
        >
          <Text style={styles.buttonText}>Factory Reset ESP32</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    backgroundColor: "white",
    borderRadius: 16,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    alignItems: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#333",
    marginVertical: 10,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginVertical: 8,
    textAlign: "center",
  },
  bold: {
    fontWeight: "bold",
    color: "#000",
  },
  button: {
    marginTop: 20,
    backgroundColor: "#4c669f",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
    alignItems: "center",
    width: "100%",
  },
  buttonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  statusText: {
    marginBottom: 12,
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
    color: "#444",
  },
});
