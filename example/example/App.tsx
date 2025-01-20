import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import HomeStack from './navigation/AppNavigation';

const App: React.FC = () => {
  return (
    <NavigationContainer>
      <HomeStack />
    </NavigationContainer>
  );
};

export default App;
