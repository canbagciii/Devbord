import { useTheme } from '../context/ThemeContext';

export const useThemeClasses = () => {
  const { theme } = useTheme();

  const getButtonClass = (variant: 'primary' | 'secondary' = 'primary') => {
    if (variant === 'primary') {
      return {
        blue: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
        green: 'bg-green-600 hover:bg-green-700 focus:ring-green-500',
        orange: 'bg-orange-600 hover:bg-orange-700 focus:ring-orange-500',
        red: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
        slate: 'bg-slate-600 hover:bg-slate-700 focus:ring-slate-500'
      }[theme];
    }
    return {
      blue: 'bg-blue-50 text-blue-700 hover:bg-blue-100',
      green: 'bg-green-50 text-green-700 hover:bg-green-100',
      orange: 'bg-orange-50 text-orange-700 hover:bg-orange-100',
      red: 'bg-red-50 text-red-700 hover:bg-red-100',
      slate: 'bg-slate-50 text-slate-700 hover:bg-slate-100'
    }[theme];
  };

  const getTextClass = () => {
    return {
      blue: 'text-blue-600',
      green: 'text-green-600',
      orange: 'text-orange-600',
      red: 'text-red-600',
      slate: 'text-slate-600'
    }[theme];
  };

  const getBgClass = () => {
    return {
      blue: 'bg-blue-600',
      green: 'bg-green-600',
      orange: 'bg-orange-600',
      red: 'bg-red-600',
      slate: 'bg-slate-600'
    }[theme];
  };

  const getBgLightClass = () => {
    return {
      blue: 'bg-blue-50',
      green: 'bg-green-50',
      orange: 'bg-orange-50',
      red: 'bg-red-50',
      slate: 'bg-slate-50'
    }[theme];
  };

  const getBorderClass = () => {
    return {
      blue: 'border-blue-500',
      green: 'border-green-500',
      orange: 'border-orange-500',
      red: 'border-red-500',
      slate: 'border-slate-500'
    }[theme];
  };

  const getRingClass = () => {
    return {
      blue: 'focus:ring-blue-500',
      green: 'focus:ring-green-500',
      orange: 'focus:ring-orange-500',
      red: 'focus:ring-red-500',
      slate: 'focus:ring-slate-500'
    }[theme];
  };

  const getHoverBgClass = () => {
    return {
      blue: 'hover:bg-blue-700',
      green: 'hover:bg-green-700',
      orange: 'hover:bg-orange-700',
      red: 'hover:bg-red-700',
      slate: 'hover:bg-slate-700'
    }[theme];
  };

  return {
    theme,
    getButtonClass,
    getTextClass,
    getBgClass,
    getBgLightClass,
    getBorderClass,
    getRingClass,
    getHoverBgClass
  };
};
