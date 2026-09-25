import Feather from '@expo/vector-icons/Feather';
import { Tabs } from 'expo-router';

import { BagButton } from '@/components/bag-button';
import { Logo } from '@/components/logo';
import { useWishlist } from '@/state/wishlist';
import { colors, fonts } from '@/theme';

export default function TabLayout() {
  const { ids } = useWishlist();
  return (
    <Tabs
      screenOptions={{
        headerShadowVisible: false,
        headerTitleAlign: 'center',
        headerTitleStyle: { fontFamily: fonts.serif, fontSize: 22, color: colors.ink },
        headerStyle: { backgroundColor: colors.white },
        headerRight: () => <BagButton />,
        tabBarActiveTintColor: colors.charcoal,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { borderTopColor: colors.hairline, borderTopWidth: 1, backgroundColor: colors.white },
        tabBarLabelStyle: { fontFamily: fonts.sansMedium, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' },
        sceneStyle: { backgroundColor: colors.white },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          headerTitle: () => <Logo variant="mark" height={30} />,
          tabBarAccessibilityLabel: 'Home',
          tabBarIcon: ({ color }) => <Feather name="home" size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="shop"
        options={{
          title: 'Shop',
          tabBarAccessibilityLabel: 'Shop',
          tabBarIcon: ({ color }) => <Feather name="grid" size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarAccessibilityLabel: 'Search',
          tabBarIcon: ({ color }) => <Feather name="search" size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="wishlist"
        options={{
          title: 'Wishlist',
          tabBarAccessibilityLabel: ids.length ? `Wishlist, ${ids.length} saved` : 'Wishlist',
          tabBarIcon: ({ color }) => <Feather name="heart" size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Account',
          tabBarAccessibilityLabel: 'Account',
          tabBarIcon: ({ color }) => <Feather name="user" size={20} color={color} />,
        }}
      />
    </Tabs>
  );
}
