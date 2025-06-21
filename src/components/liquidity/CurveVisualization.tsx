"use client";

import React, { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { calculateLiquidityCurve } from './curveUtils';
import { CurveVisualizationProps } from './types';
import { cn } from '@/lib/utils';

const POSITION_COLORS = [
  'rgb(59, 130, 246)', // blue-500
  'rgb(168, 85, 247)', // purple-500
  'rgb(34, 197, 94)',  // green-500
  'rgb(251, 146, 60)', // orange-500
  'rgb(239, 68, 68)',  // red-500
  'rgb(236, 72, 153)', // pink-500
  'rgb(6, 182, 212)',  // cyan-500
];

export function CurveVisualization({
  positions,
  width = 400,
  height = 200,
  currentPrice = 50,
  showGrid = true,
  showTooltip = true,
  className,
}: CurveVisualizationProps) {
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; liquidity: number } | null>(null);

  const { curvePoints, maxLiquidity, viewBox } = useMemo(() => {
    const points = calculateLiquidityCurve(positions);
    const max = Math.max(...points.map(p => p.liquidity), 1);
    
    // Add padding to viewBox
    const padding = 20;
    const vb = `${-padding} ${-padding} ${width + padding * 2} ${height + padding * 2}`;
    
    return {
      curvePoints: points,
      maxLiquidity: max,
      viewBox: vb,
    };
  }, [positions, width, height]);

  const pathData = useMemo(() => {
    if (curvePoints.length === 0) return '';
    
    const scaleX = width / 100;
    const scaleY = height / maxLiquidity;
    
    // Create smooth curve path
    const points = curvePoints.map((point) => ({
      x: point.price * scaleX,
      y: height - (point.liquidity * scaleY),
    }));
    
    // Start with move to first point
    let path = `M ${points[0].x} ${points[0].y}`;
    
    // Create smooth curve through points
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      
      // Control points for bezier curve
      const cp1x = prev.x + (curr.x - prev.x) * 0.5;
      const cp1y = prev.y;
      const cp2x = prev.x + (curr.x - prev.x) * 0.5;
      const cp2y = curr.y;
      
      path += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${curr.x},${curr.y}`;
    }
    
    return path;
  }, [curvePoints, width, height, maxLiquidity]);

  const areaPath = useMemo(() => {
    if (pathData === '') return '';
    
    // Create filled area under curve
    return `${pathData} L ${width} ${height} L 0 ${height} Z`;
  }, [pathData, width, height]);

  const positionRects = useMemo(() => {
    const scaleX = width / 100;
    
    return positions.map((pos, index) => ({
      x: pos.rangeStart * scaleX,
      width: (pos.rangeEnd - pos.rangeStart) * scaleX,
      color: POSITION_COLORS[index % POSITION_COLORS.length],
      opacity: 0.2,
    }));
  }, [positions, width]);

  const handleMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!showTooltip) return;
    
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const price = Math.round((x / width) * 100);
    
    if (price >= 0 && price <= 100) {
      const point = curvePoints.find(p => p.price === price);
      if (point) {
        setHoveredPoint({
          x,
          y: height - (point.liquidity / maxLiquidity) * height,
          liquidity: point.liquidity,
        });
      }
    }
  };

  const handleMouseLeave = () => {
    setHoveredPoint(null);
  };

  return (
    <Card className={cn("p-4", className)}>
      <svg
        viewBox={viewBox}
        className="w-full h-full touch-none"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        aria-label="Liquidity distribution curve"
      >
        {/* Position ranges background */}
        {positionRects.map((rect, index) => (
          <rect
            key={index}
            x={rect.x}
            y={0}
            width={rect.width}
            height={height}
            fill={rect.color}
            opacity={rect.opacity}
          />
        ))}
        
        {/* Grid lines */}
        {showGrid && (
          <g className="text-muted-foreground" opacity={0.2}>
            {/* Horizontal grid lines */}
            {[0, 25, 50, 75, 100].map((percent) => {
              const y = height - (percent / 100) * height;
              return (
                <line
                  key={`h-${percent}`}
                  x1={0}
                  y1={y}
                  x2={width}
                  y2={y}
                  stroke="currentColor"
                  strokeDasharray="2,2"
                />
              );
            })}
            
            {/* Vertical grid lines */}
            {[0, 25, 50, 75, 100].map((percent) => {
              const x = (percent / 100) * width;
              return (
                <line
                  key={`v-${percent}`}
                  x1={x}
                  y1={0}
                  x2={x}
                  y2={height}
                  stroke="currentColor"
                  strokeDasharray="2,2"
                />
              );
            })}
          </g>
        )}
        
        {/* Filled area under curve */}
        <path
          d={areaPath}
          fill="url(#liquidityGradient)"
          opacity={0.3}
        />
        
        {/* Main curve line */}
        <path
          d={pathData}
          fill="none"
          stroke="rgb(59, 130, 246)"
          strokeWidth={2}
        />
        
        {/* Current price indicator */}
        {currentPrice !== undefined && (
          <g>
            <line
              x1={(currentPrice / 100) * width}
              y1={0}
              x2={(currentPrice / 100) * width}
              y2={height}
              stroke="rgb(251, 146, 60)"
              strokeWidth={2}
              strokeDasharray="4,2"
            />
            <text
              x={(currentPrice / 100) * width}
              y={-5}
              textAnchor="middle"
              className="text-xs fill-orange-500 font-medium"
            >
              Current
            </text>
          </g>
        )}
        
        {/* Hover tooltip */}
        {showTooltip && hoveredPoint && (
          <g>
            <circle
              cx={hoveredPoint.x}
              cy={hoveredPoint.y}
              r={4}
              fill="rgb(59, 130, 246)"
              stroke="white"
              strokeWidth={2}
            />
            <rect
              x={hoveredPoint.x - 40}
              y={hoveredPoint.y - 30}
              width={80}
              height={25}
              rx={4}
              fill="white"
              stroke="rgb(229, 231, 235)"
              strokeWidth={1}
            />
            <text
              x={hoveredPoint.x}
              y={hoveredPoint.y - 15}
              textAnchor="middle"
              className="text-xs font-medium"
            >
              {hoveredPoint.liquidity.toFixed(1)}% liquidity
            </text>
          </g>
        )}
        
        {/* Gradient definition */}
        <defs>
          <linearGradient id="liquidityGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgb(59, 130, 246)" />
            <stop offset="100%" stopColor="rgb(59, 130, 246)" stopOpacity={0} />
          </linearGradient>
        </defs>
      </svg>
      
      {/* Axis labels */}
      <div className="flex justify-between mt-2 text-xs text-muted-foreground">
        <span>0%</span>
        <span>Price Range</span>
        <span>100%</span>
      </div>
    </Card>
  );
}