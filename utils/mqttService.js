// @ts-ignore
import { Client, Message } from "react-native-paho-mqtt";
import AsyncStorage from "@react-native-async-storage/async-storage";

// MQTT Broker Details
const MQTT_BROKER = "wss://test.mosquitto.org:8081/mqtt"; // WebSocket URL
const MQTT_TOPIC = "esp32/dht22";

// Configure MQTT Client
const client = new Client({
  uri: MQTT_BROKER,
  clientId: "ReactNativeClient_" + Math.random().toString(16).substr(2, 8),
  storage: AsyncStorage, // ✅ Fix: Use AsyncStorage instead of localStorage
});

export const connectMQTT = async (onMessageArrived) => {
  try {
    await client.connect(); // Connect to the broker
    console.log("✅ Connected to MQTT broker!");

    // Subscribe to the topic
    await client.subscribe(MQTT_TOPIC);
    console.log(`📡 Subscribed to topic: ${MQTT_TOPIC}`);

    // ✅ Fix: Correct way to handle incoming messages
    client.onMessageArrived = (message) => {
      console.log("📩 Message received:", message.payloadString);
      if (onMessageArrived) {
        try {
          const data = JSON.parse(message.payloadString);
          onMessageArrived(data);
        } catch (error) {
          console.error("❌ Error parsing JSON message:", error);
        }
      }
    };
  } catch (error) {
    console.error("❌ MQTT Connection Error:", error);
  }
};

// Function to disconnect MQTT
export const disconnectMQTT = async () => {
  try {
    await client.disconnect();
    console.log("🚫 Disconnected from MQTT broker");
  } catch (error) {
    console.error("❌ Error disconnecting MQTT:", error);
  }
};
