import { Ionicons } from "@expo/vector-icons";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Tabs } from "expo-router";
import React from "react";

export default function TabLayout() {
  return (
    <Tabs>
      <Tabs.Screen
        name="index"
        options={{
          title: "CONTROLLER",
          tabBarIcon: () => <Ionicons name="home" size={20} color="#4c669f" />,
        }}
      />
      <Tabs.Screen
        name="records"
        options={{
          title: "RECORDS",
          tabBarIcon: () => (
            <Ionicons name="receipt" size={20} color="#4c669f" />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "HISTORY",
          tabBarIcon: () => (
            <FontAwesome name="history" size={20} color="#4c669f" />
          ),
        }}
      />
    </Tabs>
  );
}
