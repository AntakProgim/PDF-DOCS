export enum ConversionStatus {
  IDLE = 'IDLE',
  PROCESSING = 'PROCESSING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}

export enum OcrAccuracy {
  FAST = 'fast',
  BALANCED = 'balanced',
  HIGH = 'high'
}

export interface ConversionResponse {
  htmlContent: string;
  summary: string;
  language: string;
}

export interface ConversionResult {
  htmlContent: string;
  originalFileName: string;
}

export interface AlertMessage {
  type: 'success' | 'error' | 'info';
  text: string;
}