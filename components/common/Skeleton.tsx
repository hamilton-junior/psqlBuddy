
import React from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'rect' | 'circle';
  style?: React.CSSProperties;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '', variant = 'rect', style }) => {
  const baseClass = "animate-pulse bg-slate-200 dark:bg-slate-800";
  const variantClasses = {
    text: "h-3 w-3/4 rounded",
    rect: "rounded-xl",
    circle: "rounded-full"
  };

  return <div className={`${baseClass} ${variantClasses[variant]} ${className}`} style={style} />;
};

export const ChartSkeleton: React.FC<{ type: 'bar' | 'line' }> = ({ type }) => {
  return (
    <div className="w-full h-full flex flex-col p-4 animate-pulse">
      <div className="flex justify-between items-end flex-1 gap-2 pb-6 border-b border-slate-100 dark:border-slate-800">
        {type === 'bar' ? (
          // Mimetiza um gráfico de barras
          Array.from({ length: 12 }).map((_, i) => (
            <div 
              key={i} 
              className="bg-indigo-100 dark:bg-indigo-900/30 rounded-t-lg flex-1" 
              style={{ height: `${20 + Math.random() * 70}%`, opacity: 0.3 + (i * 0.05) }}
            />
          ))
        ) : (
          // Mimetiza um gráfico de linha com gradientes
          <div className="w-full h-full relative overflow-hidden rounded-xl bg-slate-50 dark:bg-slate-900/50">
             <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-indigo-400/10 to-transparent transform -skew-y-12 animate-[shimmer_2s_infinite]" />
             <svg className="w-full h-full opacity-20" viewBox="0 0 400 200" preserveAspectRatio="none">
                <path 
                  d="M0,150 Q50,100 100,160 T200,80 T300,120 T400,50" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="4" 
                  className="text-indigo-500"
                />
             </svg>
          </div>
        )}
      </div>
      <div className="flex justify-between mt-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="w-10 h-2 rounded-full opacity-50" />
        ))}
      </div>
    </div>
  );
};

export const TableSkeleton: React.FC<{ rows?: number, cols?: number }> = ({ rows = 5, cols = 4 }) => (
  <div className="w-full space-y-4">
    <div className="flex gap-4 mb-6">
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} className="h-4 flex-1" />
      ))}
    </div>
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex gap-4 items-center">
        {Array.from({ length: cols }).map((_, j) => (
          <Skeleton key={j} className="h-8 flex-1" />
        ))}
      </div>
    ))}
  </div>
);

export const CardSkeleton: React.FC = () => (
  <div className="p-5 rounded-3xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/50 space-y-4">
    <div className="flex justify-between items-start">
      <Skeleton variant="rect" className="w-10 h-10 rounded-2xl" />
      <Skeleton variant="rect" className="w-20 h-6 rounded-lg" />
    </div>
    <Skeleton variant="text" className="w-1/2" />
    <Skeleton variant="text" className="h-6 w-3/4" />
  </div>
);
