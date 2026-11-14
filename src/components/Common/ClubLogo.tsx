import React, { useState } from 'react';
import { getClubLogo, generateShieldLogo } from '../../services/clubLogos';

interface ClubLogoProps {
  name: string;
  rawId?: string | number;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const ClubLogo: React.FC<ClubLogoProps> = ({
  name,
  rawId,
  className = '',
  size = 'md',
}) => {
  const [hasError, setHasError] = useState(false);

  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
    xl: 'w-14 h-14',
  };

  const primaryLogo = hasError
    ? generateShieldLogo(name)
    : getClubLogo(name, rawId);

  return (
    <div
      className={`relative shrink-0 flex items-center justify-center rounded-xl bg-white/5 p-1 border border-white/10 ${sizeClasses[size]} ${className}`}
      title={name}
    >
      <img
        src={primaryLogo}
        alt={`${name} football club badge`}
        className="w-full h-full object-contain filter drop-shadow select-none"
        loading="lazy"
        decoding="async"
        onError={() => setHasError(true)}
      />
    </div>
  );
};
