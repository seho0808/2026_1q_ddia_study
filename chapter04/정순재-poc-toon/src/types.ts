// 공통 타입 정의

export interface User {
  id: number;
  name: string;
  email: string;
  role: "admin" | "user" | "guest";
  active: boolean;
  createdAt: string;
}

export interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  category: string;
  inStock: boolean;
  tags: string[];
}

export interface OrderItem {
  productId: number;
  productName: string;
  quantity: number;
  price: number;
}

export interface Order {
  orderId: number;
  userId: number;
  userName: string;
  items: OrderItem[];
  totalAmount: number;
  status: "pending" | "processing" | "shipped" | "delivered";
  orderDate: string;
}

export interface ConfigSection {
  enabled: boolean;
  settings: Record<string, any>;
}

export interface Config {
  app: {
    name: string;
    version: string;
    env: string;
    debug: boolean;
  };
  database: {
    host: string;
    port: number;
    name: string;
    credentials: {
      username: string;
      password: string;
    };
    pool: {
      min: number;
      max: number;
      idle: number;
    };
  };
  features: {
    auth: ConfigSection;
    payment: ConfigSection;
    notifications: ConfigSection;
  };
  logging: {
    level: string;
    outputs: string[];
    format: {
      timestamp: boolean;
      colorize: boolean;
    };
  };
}

export interface LogEntry {
  id: number;
  timestamp: string;
  level: "info" | "warn" | "error" | "debug";
  service: string;
  message: string;
  userId: number;
  ipAddress: string;
}

export interface BenchmarkResult {
  format: string;
  dataset: string;
  tokenCount: number;
  byteSize: number;
  characterCount: number;
  accuracy?: number;
  lossRate?: number;
}

export interface Question {
  id: string;
  question: string;
  expectedAnswer: any;
  type: "exact" | "count" | "filter" | "aggregation";
}

export interface AccuracyTestResult {
  format: string;
  dataset: string;
  question: Question;
  answer: any;
  isCorrect: boolean;
  responseTime: number;
}

export type FormatType = "json-compact" | "json-pretty" | "toon" | "toon-tabs" | "plain-text" | "yaml" | "csv";
