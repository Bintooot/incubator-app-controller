import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { format } from "date-fns";

import {
  collection,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import { db } from "../../firebaseconfig";

interface Batch {
  id: string;
  batchId: string;
  aveHumidity: string;
  aveTemp: string;
  startDate: Date | null;
  status: string;
  description: string;
  duration: number;
  endDate: Date | null;
  quantity: number;
  success: number | null;
  rate: number;
}

export default function History() {
  const [data, setData] = useState<Batch[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    setLoading(true);
    const q = query(
      collection(db, "batches"),
      where("status", "in", ["Completed", "Canceled"]),
      orderBy("startDate", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const batches: Batch[] = [];
        snapshot.forEach((doc) => {
          const d = doc.data();
          batches.push({
            id: doc.id,
            batchId: d.batchId,
            aveTemp: d.aveTemp,
            aveHumidity: d.aveHumidity,
            startDate:
              d.startDate instanceof Timestamp
                ? d.startDate.toDate()
                : new Date(d.startDate),
            status: d.status,
            duration: d.duration,
            endDate:
              d.endDate instanceof Timestamp
                ? d.endDate.toDate()
                : d.endDate
                ? new Date(d.endDate)
                : null,
            description: d.description,
            quantity: d.quantity,
            success: d.success,
            rate: d.rate,
          });
        });

        setData(batches);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching data: ", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return (
    <ScrollView>
      <LinearGradient
        colors={["#4c669f", "#3b5998", "#192f6a"]}
        style={styles.headerGradient}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Incubation History</Text>
          <Text style={styles.subTitle}>
            Review completed and cancelled incubation batches
          </Text>
        </View>
      </LinearGradient>

      {loading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading history records...</Text>
        </View>
      ) : data.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No history records found.</Text>
        </View>
      ) : (
        data.map((record, index) => (
          <TouchableOpacity key={index} style={styles.recordCard}>
            <View style={styles.recordHeader}>
              <View>
                <Text style={styles.recordTitle}>Batch #{record.batchId}</Text>
                <Text style={styles.recordDate}>
                  <Text>Start Date: </Text>
                  {record.startDate
                    ? format(record.startDate, "MMMM dd, yyyy hh:mm a")
                    : "-"}
                </Text>
                <Text style={styles.recordDate}>
                  <Text>End Date: </Text>
                  {record.endDate
                    ? format(record.endDate, "MMMM dd, yyyy hh:mm a")
                    : "-"}
                </Text>
                <Text style={styles.recordDate}>
                  Description: {record.description}
                </Text>
              </View>
              <View
                style={[
                  styles.statusBadge,
                  record.status === "Completed"
                    ? styles.completedBadge
                    : styles.cancelledBadge,
                ]}
              >
                <Text style={styles.statusText}>{record.status}</Text>
              </View>
            </View>

            <View style={styles.recordStats}>
              <View style={styles.recordStat}>
                <MaterialCommunityIcons name="star" size={16} color="#666" />
                <Text
                  style={
                    record.rate >= 50
                      ? styles.rateGreenText
                      : styles.rateRedText
                  }
                >
                  Success Rate: {record.rate.toFixed(2)}%
                </Text>
              </View>

              <View style={styles.recordStat}>
                <MaterialCommunityIcons
                  name="egg-outline"
                  size={16}
                  color="#666"
                />
                <Text style={styles.recordStatText}>
                  Eggs Quantity: {record.quantity}
                </Text>
              </View>

              <View style={styles.recordStat}>
                <MaterialCommunityIcons name="egg" size={16} color="#666" />
                <Text style={styles.recordStatText}>
                  Success Egg: {record.success}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  headerGradient: {
    paddingTop: 60,
    paddingBottom: 40,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    marginBottom: 20,
  },
  header: {
    paddingHorizontal: 24,
  },
  headerTitle: {
    fontSize: 30,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 6,
  },
  subTitle: {
    fontSize: 16,
    color: "#e0e0e0",
  },
  loadingContainer: {
    marginTop: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    fontSize: 16,
    color: "#666",
  },
  recordCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  recordHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  recordTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#222",
    marginBottom: 6,
  },
  recordDate: {
    fontSize: 14,
    color: "#555",
    marginBottom: 2,
  },
  recordStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    flexWrap: "wrap",
    marginTop: 8,
  },
  recordStat: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 6,
  },
  recordStatText: {
    marginLeft: 8,
    color: "#444",
    fontSize: 14,
  },
  rateGreenText: {
    marginLeft: 8,
    color: "#2ecc71",
    fontSize: 14,
    fontWeight: "600",
  },
  rateRedText: {
    marginLeft: 8,
    color: "#e74c3c",
    fontSize: 14,
    fontWeight: "600",
  },
  statusText: {
    color: "white",
    fontSize: 12,
    fontWeight: "700",
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    minWidth: 80,
    alignItems: "center",
  },
  completedBadge: {
    backgroundColor: "#27ae60",
  },
  cancelledBadge: {
    backgroundColor: "#c0392b",
  },

  // no data

  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: "#999",
    fontStyle: "italic",
  },
});
