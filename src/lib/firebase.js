// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDv5onjL-89q2lRMburX8jP9Svg15dn6Bg",
  authDomain: "expense-tracker-17dc1.firebaseapp.com",
  projectId: "expense-tracker-17dc1",
  storageBucket: "expense-tracker-17dc1.firebasestorage.app",
  messagingSenderId: "757708518525",
  appId: "1:757708518525:web:7c101104596665779f2d14",
  measurementId: "G-8S0TFYRNDP"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
