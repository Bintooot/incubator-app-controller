import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Alert,
  Platform,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

export default function ESP32ProvisioningScreen() {
  const openESP32Page = async () => {
    const url = "http://192.168.4.1";
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      Linking.openURL(url);
    } else {
      Alert.alert("Error", "Unable to open the ESP32 provisioning page.");
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <MaterialIcons name="wifi" size={64} color="#4c669f" />
        <Text style={styles.title}>ESP32 Setup</Text>
        <Text style={styles.subtitle}>
          1. Connect to Wi-Fi named{" "}
          <Text style={styles.bold}>ESP32_Config</Text>
        </Text>
        <Text style={styles.subtitle}>
          2. Tap the button below to open the setup page
        </Text>

        <TouchableOpacity onPress={openESP32Page} style={styles.button}>
          <Text style={styles.buttonText}>Open Provisioning Page</Text>
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
    marginTop: 24,
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
});
