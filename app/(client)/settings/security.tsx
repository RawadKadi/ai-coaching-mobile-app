import React from 'react';
import AccountSecurityScreen from '@/components/settings/AccountSecurityScreen';

export default function ClientSecurityRoute() {
  return <AccountSecurityScreen fallbackBackRoute="/(client)/settings" />;
}
