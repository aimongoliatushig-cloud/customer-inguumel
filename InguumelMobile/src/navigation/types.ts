/** Base height of bottom tab bar (without safe area). Use effectiveTabBarHeight = TAB_BAR_BASE_HEIGHT + insets.bottom for layout. */
export const TAB_BAR_BASE_HEIGHT = 56;

export type AuthStackParamList = {
  Login: { phone?: string } | undefined;
  Register: undefined;
};

export type LocationStackParamList = {
  LocationSelect: undefined;
};

/** Profile tab can receive nested screen params for deep-linking (e.g. LuckyWheel). */
export type ProfileTabParams = { screen: 'LuckyWheel' } | undefined;

export type BottomTabParamList = {
  Home: undefined;
  Categories: undefined;
  Cart: undefined;
  Orders: undefined;
  Profile: ProfileTabParams;
};

/** Cart tab stack: CartHome (cart list) → OrderInfo (checkout form). */
export type CartStackParamList = {
  CartHome: undefined;
  OrderInfo: undefined;
};

/** Profile tab stack: ProfileHome (main) → LocationSwitch, DeliveryAddress, LuckyWheel, SpinResult, PrizeWallet. */
export type ProfileStackParamList = {
  ProfileHome: undefined;
  LocationSwitch: undefined;
  DeliveryAddress: undefined;
  AccountPrivacy: undefined;
  LuckyWheel: undefined;
  SpinResult: { result: import('~/types').LuckySpinResultData };
  PrizeWallet: undefined;
};

/** Orders tab stack: OrderList (list) → OrderDetail (detail). */
export type OrdersStackParamList = {
  OrderList: undefined;
  OrderDetail: { orderId: number; orderNumber?: string; fromCreate?: boolean };
};
