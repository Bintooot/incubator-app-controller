import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Platform,
  ActivityIndicator,
  Button,
} from "react-native";
import { MaterialCommunityIcons, AntDesign } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import { format } from "date-fns";

import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";

import { db } from "../../firebaseconfig";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  Timestamp,
  where,
  getDocs,
  doc,
  updateDoc,
  getDoc,
} from "firebase/firestore";

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
  rate: number; // Add the rate property here, optional
}

type LatestBatch = {
  id: string;
  batchId: string;
  aveTemp: string;
  aveHumidity: string;
  startDate: Date | null;
  endDate: Date | null;
  description: string;
  status: string;
  duration: number;
  quantity: number;
  success: number | null;
};

interface DurationInTime {
  hours: number;
  minutes: number;
  seconds: number;
}

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

const incubationProcessCompleted = async (expoPushToken: string) => {
  const message: Message = {
    to: expoPushToken,
    sound: "default",
    title: "Incubator Alert",
    body: "Incubation process completed.",
    data: { someData: "ideal" },
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

interface SelectedBatch {
  id: string;
  quantity: number;
  endDate: Date | Timestamp | null;
}

export default function RecordsScreen() {
  const [modalVisible, setModalVisible] = useState(false);
  const [modalCompletedVisible, setModalCompletedVisible] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<SelectedBatch>({
    id: "",
    quantity: 0,
    endDate: null,
  });
  const [visibleNotification, setVisibleNotification] = useState(false);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");

  const [data, setData] = useState<Batch[]>([]);
  const [latestBatches, setLatestBatches] = useState<LatestBatch[]>([]);

  const [expoPushToken, setExpoPushToken] = useState("");
  const [currentDate, setCurrentDate] = useState<Date>(new Date());

  const [latestBatchStatus, setLatestBatchStatus] = useState(false);

  const [notification, setNotification] = useState("");

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    registerForPushNotificationsAsync()
      .then((token) => setExpoPushToken(token ?? ""))
      .catch((error: any) => setExpoPushToken(`${error}`));
  }, []);

  // Return random Batch
  const generateRandomID = (length = 4) => {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const [newBatch, setNewBatch] = useState({
    batchId: "",
    startDate: new Date().toISOString(),
    aveTemp: "37.5",
    aveHumidity: "65",
    duration: 0,
    description: "",
    quantity: 0,
    endDate: new Date().toISOString(),
    success: "",
  });

  const [updateBatch, setUpdateBatch] = useState({
    success: 0,
  });
  const [isBatchReadyToComplete, setIsBatchReadyToComplete] = useState(false);

  const handleCompletedButton = (
    id: string,
    quantity: number,
    endDate: Date | Timestamp | null
  ) => {
    if (id && quantity > 0) {
      const now = new Date();

      let end: Date | null = null;
      if (endDate instanceof Timestamp) {
        end = endDate.toDate();
      } else if (endDate instanceof Date) {
        end = endDate;
      }

      const isReady = end !== null && now.getTime() >= end.getTime();

      setIsBatchReadyToComplete(isReady);
      setSelectedBatch({ id, quantity, endDate });
      setModalCompletedVisible(true);
    } else {
      alert("No valid batch to complete. Please set a batch first.");
    }
  };

  const showNotification = (message: string, status: string) => {
    setVisibleNotification(true);
    setMessage(message);
    setStatus(status);
    setTimeout(() => {
      setVisibleNotification(false);
    }, 3000);
  };

  useEffect(() => {
    const q = query(
      collection(db, "batches"),
      where("status", "in", ["In Progress", "Ivaluate"]),
      orderBy("startDate", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        if (!querySnapshot.empty) {
          const batches: LatestBatch[] = querySnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as LatestBatch[];

          setLatestBatches(batches);
          console.log("Fetched batches:", batches);
        } else {
          setLatestBatches([]); // Clear if none
        }
      },
      (error) => {
        console.error("Error fetching batch data:", error);
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(""), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  useEffect(() => {
    if (!latestBatches || latestBatches.length === 0) return;

    const notifiedBatchIds = new Set<string>();

    const intervalId = setInterval(() => {
      const now = new Date();

      latestBatches.forEach((batch) => {
        const batchEndDate =
          batch.endDate === null
            ? null
            : batch.endDate instanceof Timestamp
            ? batch.endDate.toDate()
            : new Date(batch.endDate);

        if (
          batchEndDate !== null &&
          now.getTime() >= batchEndDate.getTime() &&
          !notifiedBatchIds.has(batch.id)
        ) {
          // Notify only once per batch
          incubationProcessCompleted(expoPushToken);
          setNotification(`Incubation for Batch ${batch.batchId} completed.`);
          evaluateBatch(batch.id, batch.success || 0);
          setLatestBatchStatus(true);
          notifiedBatchIds.add(batch.id);
        }
      });

      setCurrentDate(now);
    }, 3000);

    return () => clearInterval(intervalId);
  }, [latestBatches, expoPushToken]);

  function calculateEndDate(
    startDate: Date | string,
    durationInDays: number,
    durationInTime: DurationInTime = { hours: 0, minutes: 0, seconds: 0 }
  ): Date {
    // If startDate is a string, convert it to a Date object
    const start = new Date(startDate);

    // Add days to the start date
    start.setDate(start.getDate() + durationInDays);

    // Add time to the start date (hours, minutes, seconds)
    start.setHours(start.getHours() + durationInTime.hours);
    start.setMinutes(start.getMinutes() + durationInTime.minutes);
    start.setSeconds(start.getSeconds() + durationInTime.seconds);

    return start;
  }

  const handleAddBatch = async () => {
    if (loading) return;
    try {
      if (!newBatch.quantity || !newBatch.description || !newBatch.duration) {
        alert("Input is missing, please provide all the required information.");
        return;
      }

      setLoading(true);

      const status = "In Progress";
      const batchId = generateRandomID();

      const endDate = calculateEndDate(newBatch.startDate, newBatch.duration);

      const timestamp = Timestamp.fromDate(new Date());

      await addDoc(collection(db, "batches"), {
        batchId: batchId,
        startDate: timestamp,
        aveTemp: newBatch.aveTemp,
        aveHumidity: newBatch.aveHumidity,
        duration: newBatch.duration,
        status: status,
        endDate: endDate,
        description: newBatch.description,
        quantity: newBatch.quantity,
      });

      setModalVisible(false);
      setNewBatch({
        batchId: "",
        startDate: new Date().toISOString(),
        endDate: new Date().toISOString(),
        aveTemp: "37.5",
        description: "",
        duration: 0,
        aveHumidity: "65",
        quantity: 0,
        success: "",
      });

      showNotification("Batch successfully saved.", "success");
    } catch (error) {
      console.error("Error adding new batch: ", error);
      alert("Failed to add batch");
    } finally {
      setLoading(false);
    }
  };

  const calculateSuccessRate = (
    success: number | null,
    quantity: number
  ): number => {
    if (success === null || quantity === 0) return 0; // Avoid division by zero
    return (success / quantity) * 100; // Success rate in percentage
  };

  const handleUpdateBatch = async (
    batchId: string,
    newStatus: string,
    success: number
  ) => {
    setLoading(true);
    try {
      const batchRef = doc(db, "batches", batchId);
      const batchDoc = await getDoc(batchRef);

      if (!success) {
        alert("Please enter the number of success");
        return;
      }

      if (batchDoc.exists()) {
        const batchData = batchDoc.data();
        const batchQuantity = parseInt(batchData?.quantity);

        if (batchQuantity < success) {
          alert("Number of success can't be greater than the eggs incubated");
          return;
        }

        const rate = calculateSuccessRate(success, batchQuantity);

        // Update the Firestore document
        await updateDoc(batchRef, {
          status: newStatus,
          success: success,
          rate: rate,
        });

        const defaultBatch = {
          id: batchId,
          batchId: "N/A",
          aveTemp: "37.5",
          duration: 0,
          aveHumidity: "65",
          quantity: 0,
          success: 0,
          status: "N/A",
          description: "N/A",
          startDate: null,
          endDate: null,
        };

        setNotification("");
        setLatestBatchStatus(false);
        setSelectedBatch(defaultBatch);
        setModalCompletedVisible(false);
        showNotification(`Batch status updated to ${newStatus}.`, "success");
      } else {
        console.log("Batch not found");
      }
    } catch (error) {
      console.error("Error updating current batch: ", error);
      alert("Failed to update current batch");
    } finally {
      setLoading(false);
    }
  };

  // Ivaluation

  const evaluateBatch = async (batchId: string, success: number) => {
    setLoading(true);
    try {
      const batchRef = doc(db, "batches", batchId);
      const batchDoc = await getDoc(batchRef);

      if (batchDoc.exists()) {
        const batchData = batchDoc.data();
        const batchQuantity = parseInt(batchData?.quantity);

        const rate = calculateSuccessRate(success, batchQuantity);

        await updateDoc(batchRef, {
          status: "Ivaluate",
          success: success,
          rate: rate,
        });

        const defaultBatch = {
          id: batchId,
          batchId: "N/A",
          aveTemp: "37.5",
          duration: 0,
          aveHumidity: "65",
          quantity: 0,
          success: 0,
          status: "N/A",
          description: "N/A",
          startDate: null,
          endDate: null,
        };

        setNotification("");
        setLatestBatchStatus(false);
        setSelectedBatch(defaultBatch);
        setModalCompletedVisible(false);
        showNotification("Batch status updated to Ivaluate.", "success");
      } else {
        console.log("Batch not found");
      }
    } catch (error) {
      console.error("Error evaluating batch: ", error);
      alert("Failed to evaluate batch.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelBatch = async (batchId: string, newStatus: string) => {
    if (loading) return;

    try {
      const batchRef = doc(db, "batches", batchId);

      setLoading(true);

      // Update the Firestore document
      await updateDoc(batchRef, {
        status: newStatus,
        success: 0,
        rate: 0,
      });

      const defaultBatch = {
        id: batchId,
        batchId: "N/A",
        aveTemp: "37.5",
        duration: 0,
        aveHumidity: "65",
        quantity: 0,
        success: 0,
        status: "N/A",
        description: "",
        startDate: null,
        endDate: null,
      };

      setLatestBatchStatus(false);
      setSelectedBatch(defaultBatch);
      setModalCompletedVisible(false);
      showNotification(`Batch status updated to ${newStatus}.`, "cancel");
    } catch (error) {
      console.error("Error updating current batch: ", error);
      alert("Failed to update current batch");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {visibleNotification && (
        <View style={styles.notification}>
          <Text style={styles.notificationText}>{message}</Text>
        </View>
      )}

      {notification !== "" && (
        <View style={styles.notificationContainer}>
          <Text style={styles.notificationText}>{notification}</Text>
        </View>
      )}

      <ScrollView>
        <LinearGradient
          colors={["#4c669f", "#3b5998", "#192f6a"]}
          style={styles.headerGradient}
        >
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Records</Text>
            <Text style={styles.subTitle}>Track your incubation progress</Text>
          </View>
        </LinearGradient>

        {/* Current Incubation Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="egg" size={24} color="#4c669f" />
            <Text style={styles.sectionTitle}>Current Incubation</Text>
          </View>

          {latestBatches.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No batch record yet.</Text>
            </View>
          ) : (
            latestBatches.map((batch) => (
              <View key={batch.id} style={styles.currentBatchCard}>
                <View style={styles.batchHeader}>
                  <View style={styles.batchInfo}>
                    <Text style={styles.batchTitle}>
                      Batch # {batch.batchId || "N/A"}
                    </Text>
                    <View
                      style={[
                        styles.statusBadge,
                        batch.status === "Ivaluate" && styles.completedBadge,
                      ]}
                    >
                      <Text style={styles.statusText}>
                        {batch.status || "N/A"}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.batchDate}>
                    Start Date:{" "}
                    {batch.startDate
                      ? batch.startDate instanceof Timestamp
                        ? format(
                            batch.startDate.toDate(),
                            "MMMM dd, yyyy hh:mm a"
                          )
                        : batch.startDate instanceof Date
                        ? format(batch.startDate, "MMMM dd, yyyy hh:mm a")
                        : "N/A"
                      : "N/A"}
                  </Text>

                  <Text style={styles.batchDate}>
                    End Date:{" "}
                    {batch.endDate
                      ? batch.endDate instanceof Timestamp
                        ? format(
                            batch.endDate.toDate(),
                            "MMMM dd, yyyy hh:mm a"
                          )
                        : batch.endDate instanceof Date
                        ? format(batch.endDate, "MMMM dd, yyyy hh:mm a")
                        : "N/A"
                      : "N/A"}
                  </Text>

                  <Text style={styles.batchDate}>
                    Description: {batch.description || "N/A"}
                  </Text>
                </View>

                <View style={styles.statsContainer}>
                  <View style={styles.statItem}>
                    <MaterialCommunityIcons
                      name="calendar"
                      size={20}
                      color="#666"
                    />
                    <Text style={styles.statValue}>{batch.duration || 0}</Text>
                    <Text style={styles.statLabel}>Days Duration</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <MaterialCommunityIcons name="egg" size={20} color="#666" />
                    <Text style={styles.statValue}>{batch.quantity || 0}</Text>
                    <Text style={styles.statLabel}>Egg Quantity</Text>
                  </View>
                </View>

                <View style={styles.completionDetails}>
                  <TouchableOpacity
                    style={styles.viewDetailsButton}
                    onPress={() => {
                      if (batch.id && batch.quantity) {
                        handleCompletedButton(
                          batch.id,
                          batch.quantity,
                          batch.endDate || new Date()
                        );
                      } else {
                        alert("Set first a new batch to incubate.");
                      }
                    }}
                  >
                    <Text style={styles.viewDetailsText}>Set Action</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Add New Batch Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Batch</Text>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={styles.closeButton}
              >
                <AntDesign name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            {/* Discription */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Discription</Text>
              <TextInput
                style={styles.input}
                value={newBatch.description}
                onChangeText={(text) =>
                  setNewBatch({ ...newBatch, description: text })
                }
                placeholder="Enter Discription"
              />
            </View>
            {/* Number of Eggs */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Number of Eggs </Text>
              <TextInput
                style={styles.input}
                value={String(newBatch.quantity)}
                onChangeText={(text) =>
                  setNewBatch({ ...newBatch, quantity: Number(text) })
                }
                keyboardType="decimal-pad"
                placeholder="Enter Quantity of Eggs"
              />
            </View>

            <View>
              <Text style={styles.inputLabel}>Days of Duration</Text>
              <TextInput
                style={styles.input}
                value={String(newBatch.duration)}
                onChangeText={(text) =>
                  setNewBatch({ ...newBatch, duration: Number(text) })
                }
                keyboardType="decimal-pad"
                placeholder="Enter Quantity of Eggs"
              />
            </View>

            <TouchableOpacity
              onPress={handleAddBatch}
              disabled={loading}
              style={[styles.addButton, loading && { opacity: 0.6 }]}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.addButtonText}>Start New Batch</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalCompletedVisible}
        onRequestClose={() => setModalCompletedVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Confimation</Text>
              <TouchableOpacity
                onPress={() => setModalCompletedVisible(false)}
                style={styles.closeButton}
              >
                <AntDesign name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <View style={styles.inputContainer}>
              <View style={styles.labelAndText}>
                <Text style={styles.inputLabels}>Ref ID:</Text>
                <Text style={styles.refIdText}>{selectedBatch.id}</Text>
              </View>

              <View style={styles.labelAndText}>
                <Text style={styles.inputLabels}>Current Date:</Text>
                <Text style={styles.refIdText}>
                  {new Date().toLocaleString("en-US", {
                    weekday: "short",
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: true,
                  })}
                </Text>
              </View>

              <View style={styles.labelAndText}>
                <Text style={styles.inputLabels}>End Date:</Text>
                <Text style={styles.refIdText}>
                  {selectedBatch.endDate
                    ? selectedBatch.endDate instanceof Timestamp
                      ? selectedBatch.endDate.toDate().toLocaleString("en-US", {
                          weekday: "short",
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: true,
                        })
                      : new Date(selectedBatch.endDate).toLocaleString(
                          "en-US",
                          {
                            weekday: "short",
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: true,
                          }
                        )
                    : "Not set"}
                </Text>
              </View>
              <View style={styles.labelAndText}>
                <Text style={styles.inputLabels}>Quantity of Eggs:</Text>
                <Text style={styles.refIdText}>{selectedBatch.quantity}</Text>
              </View>
            </View>

            {isBatchReadyToComplete && (
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Number of Success: </Text>
                <TextInput
                  style={styles.input}
                  onChangeText={(text) =>
                    setUpdateBatch({ ...newBatch, success: parseInt(text) })
                  }
                  keyboardType="decimal-pad"
                  placeholder="Quantity of Eggs"
                />
              </View>
            )}

            {isBatchReadyToComplete && (
              <TouchableOpacity
                style={styles.addButton}
                onPress={async () => {
                  await handleUpdateBatch(
                    selectedBatch.id,
                    "Completed",
                    updateBatch.success
                  );
                }}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.addButtonText}>Complete Batch</Text>
                )}
              </TouchableOpacity>
            )}
            {!isBatchReadyToComplete && (
              <TouchableOpacity
                style={styles.addCancelButton}
                disabled={loading}
                onPress={async () => {
                  await handleCancelBatch(selectedBatch.id, "Canceled");
                }}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.addButtonText}>Cancel Batch</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setModalVisible(true)}
      >
        <AntDesign name="plus" size={24} color="white" />
      </TouchableOpacity>
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
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
  headerTitle: {
    fontSize: 32,
    fontWeight: "bold",
    color: "white",
    marginBottom: 8,
  },
  subTitle: {
    fontSize: 18,
    color: "rgba(255,255,255,0.8)",
  },
  section: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginLeft: 10,
  },
  currentBatchCard: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    marginVertical: 10,
  },
  batchHeader: {
    marginBottom: 20,
  },
  batchInfo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  batchTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
  },
  batchDate: {
    color: "#666",
    fontSize: 14,
    marginVertical: 2,
  },
  statusBadge: {
    backgroundColor: "#c3c306",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  completedBadge: {
    backgroundColor: "#2ecc71",
  },
  cancelledBadge: {
    backgroundColor: "#D22B2B",
  },
  statusText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#f8f9fa",
    borderRadius: 15,
    padding: 15,
  },
  statItem: {
    alignItems: "center",
    flex: 1,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: "100%",
    backgroundColor: "#ddd",
  },
  completionDetails: {
    alignItems: "center",
  },
  completionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#4c669f",
  },
  successRate: {
    fontSize: 16,
    color: "#666",
    marginTop: 8,
  },
  viewDetailsButton: {
    backgroundColor: "#4c669f",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginTop: 10,
  },
  viewDetailsText: {
    color: "white",
    fontSize: 16,
  },
  recordCard: {
    backgroundColor: "white",
    borderRadius: 15,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  recordHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  recordTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 4,
  },
  recordDate: {
    fontSize: 14,
    color: "#666",
  },
  recordStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    flexWrap: "wrap",
  },
  recordStat: {
    flexDirection: "row",
    alignItems: "center",
  },
  recordStatText: {
    marginLeft: 6,
    color: "#666",
    fontSize: 14,
  },
  rateGreenText: {
    marginLeft: 6,
    color: "#24c803",
    fontSize: 14,
  },
  rateRedText: {
    marginLeft: 6,
    color: "#ff0000",
    fontSize: 14,
  },
  fab: {
    position: "absolute",
    bottom: 20,
    right: 20,
    backgroundColor: "#4c669f",
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 20,
    width: "90%",
    maxWidth: 400,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
  },
  closeButton: {
    padding: 5,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 16,
    color: "#333",
    marginBottom: 8,
    fontWeight: "600",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    backgroundColor: "#f8f9fa",
  },
  addButton: {
    backgroundColor: "#4c669f",
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 20,
  },
  addCancelButton: {
    backgroundColor: "#D22B2B",
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 20,
  },
  addButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  notification: {
    backgroundColor: "green",
    padding: 5,
    borderRadius: 5,
  },
  notificationText: {
    color: "#fff",
    textAlign: "center",
    fontSize: 16,
  },
  scrollContainer: {
    paddingBottom: 10,
  },
  labelAndText: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 8,
    justifyContent: "flex-start",
  },
  inputLabels: {
    fontWeight: "bold",
    marginRight: 8,
    fontSize: 16,
  },
  refIdText: {
    fontSize: 16,
    textAlign: "left",
    flex: 1,
  },
  notifBadge: {
    backgroundColor: "#24c803",
    padding: 5,
    flexDirection: "row",
    justifyContent: "center",
  },
  notifText: {
    color: "#fff",
  },

  // Notification
  notificationContainer: {
    position: "absolute",
    top: 40,
    left: 20,
    right: 20,
    padding: 10,
    backgroundColor: "#4CAF50", // green
    borderRadius: 8,
    alignItems: "center",
    zIndex: 999,
  },

  // No data

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
