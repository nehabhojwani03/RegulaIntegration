import React from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { AppStackParamList } from '../navigation/AppNavigation'// Adjust the import path as needed

// Define the navigation prop type for HomeScreen
type HomeScreenNavigationProp = StackNavigationProp<AppStackParamList, 'Home'>;

const HomeScreen: React.FC = () => {
  // Use the navigation hook with the correct type
  const navigation = useNavigation<HomeScreenNavigationProp>();


  return (
    <View style={styles.container}>
      <Button title="Go to Document SDK" onPress={() => navigation.navigate("DocumentSdk")} />
      <Button title="Go to Face SDK" onPress={() => navigation.navigate("FaceSdk")} />
      <Button title="Regula Integration" onPress={() => navigation.navigate("Regula")} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  title: {
    fontSize: 24,
    marginBottom: 20,
  },
});

export default HomeScreen;
