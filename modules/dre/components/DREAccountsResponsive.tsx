import React from 'react';
import { useMediaQuery } from '@/hooks/use-media-query';
import DREAccountsMobile from './DREAccountsMobile';
import { DREAccountsMobileEnhanced } from './DREAccountsMobileEnhanced';
 
/**
 * Componente responsivo que renderiza a interface adequada
 * baseado no tamanho da tela
 */
export const DREAccountsResponsive: React.FC = () => {
  const isMobile = useMediaQuery('(max-width: 768px)');
 
  if (isMobile) {
    return <DREAccountsMobile />;
  }
 
  return <DREAccountsMobileEnhanced />;
};
 
export default DREAccountsResponsive;
 