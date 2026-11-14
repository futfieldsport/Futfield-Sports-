import React from 'react';
import { SubscriptionPage } from '../Subscription/SubscriptionPage';

interface PricingPageProps {
  onClose?: () => void;
  embedded?: boolean;
}

export const PricingPage: React.FC<PricingPageProps> = ({ onClose, embedded = false }) => {
  return (
    <div className={embedded ? '' : 'p-3'}>
      <SubscriptionPage onClose={onClose} embedded={embedded} />
    </div>
  );
};
