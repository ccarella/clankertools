export interface LiquidityPositionData {
  id: string;
  rangeStart: number; // 0-100 representing price range percentage
  rangeEnd: number; // 0-100 representing price range percentage
  allocation: number; // 0-100 representing liquidity allocation percentage
}

export interface CurvePoint {
  price: number;
  liquidity: number;
}

export interface PriceImpactData {
  buyImpact: number;
  sellImpact: number;
  averageImpact: number;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

export interface CurvePreset {
  name: string;
  description: string;
  icon: string;
  positions: Omit<LiquidityPositionData, 'id'>[];
}

export interface LiquidityCurveDesignerProps {
  value: LiquidityPositionData[];
  onChange: (positions: LiquidityPositionData[]) => void;
  maxPositions?: number;
  disabled?: boolean;
  showPresets?: boolean;
  showVisualization?: boolean;
  showPriceImpact?: boolean;
  className?: string;
}

export interface LiquidityPositionProps {
  position: LiquidityPositionData;
  index: number;
  totalPositions: number;
  onChange: (position: LiquidityPositionData) => void;
  onRemove: () => void;
  disabled?: boolean;
  canRemove?: boolean;
  positionColors?: string[];
}

export interface CurveVisualizationProps {
  positions: LiquidityPositionData[];
  width?: number;
  height?: number;
  currentPrice?: number;
  showGrid?: boolean;
  showTooltip?: boolean;
  className?: string;
}

export type PresetType = 'conservative' | 'balanced' | 'aggressive' | 'wide';

export interface LiquidityMetrics {
  totalLiquidity: number;
  concentrationScore: number; // 0-100, higher means more concentrated
  priceRangeUtilization: number; // 0-100, percentage of price range with liquidity
  averageAllocation: number;
}