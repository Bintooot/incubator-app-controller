import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";

export default function CheckBox({ label, checked, onToggle }) {
  return (
    <TouchableOpacity style={styles.container} onPress={onToggle}>
      <View style={[styles.box, checked && styles.checkedBox]}>
        {checked && <View style={styles.innerCheck} />}
      </View>
      <Text style={styles.label}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 8,
  },
  box: {
    height: 24,
    width: 24,
    borderWidth: 2,
    borderColor: "#555",
    borderRadius: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  checkedBox: {
    borderColor: "#4c669f",
    backgroundColor: "#4c669f22",
  },
  innerCheck: {
    width: 12,
    height: 12,
    backgroundColor: "#4c669f",
    borderRadius: 2,
  },
  label: {
    marginLeft: 10,
    fontSize: 16,
    color: "#333",
  },
});
