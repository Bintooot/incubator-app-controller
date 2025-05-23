
import { initializeApp } from "firebase/app";
import {getFirestore} from "firebase/firestore";  

const firebaseConfig = {
  apiKey: "AIzaSyAdkXQTYcQDtqj5hOXfySa6dHpNtyXoNo0",
  authDomain: "incubatorsdb.firebaseapp.com",
  projectId: "incubatorsdb",
  storageBucket: "incubatorsdb.firebasestorage.app",
  messagingSenderId: "1085314854533",
  appId: "1:1085314854533:web:2a8b9f4358fc4e83cdc3ec",
  measurementId: "G-XDP67FSY6Y"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

const db = getFirestore(app);  // Firestore database

export {db}