import React from 'react';
import AccountSecurityScreen from '@/components/settings/AccountSecurityScreen';

export default function CoachSecurityRoute() {
  return <AccountSecurityScreen fallbackBackRoute="/(coach)/settings" />;
}
