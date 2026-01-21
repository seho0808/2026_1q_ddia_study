import type { User, Product, Order, Config, LogEntry, Question } from "../types.js";

// Flat Structure: 사용자 목록 (100건)
export function generateUsers(count: number = 100): User[] {
  const users: User[] = [];
  const roles: Array<"admin" | "user" | "guest"> = ["admin", "user", "guest"];

  for (let i = 1; i <= count; i++) {
    users.push({
      id: i,
      name: `User${i}`,
      email: `user${i}@example.com`,
      role: roles[i % 3],
      active: i % 4 !== 0,
      createdAt: new Date(2024, i % 12, (i % 28) + 1).toISOString(),
    });
  }

  return users;
}

// Mixed Content: 자연어 설명 포함 상품 목록 (30건)
export function generateProducts(count: number = 30): Product[] {
  const products: Product[] = [];
  const categories = ["Electronics", "Clothing", "Books", "Home", "Sports"];
  const tags = ["sale", "new", "popular", "limited", "exclusive"];

  const descriptions = [
    "High-quality product with excellent features and durability",
    "Perfect for everyday use with modern design and functionality",
    "Premium quality item that exceeds expectations",
    "Innovative solution for your daily needs",
    "Carefully crafted with attention to detail",
  ];

  for (let i = 1; i <= count; i++) {
    products.push({
      id: i,
      name: `Product ${i}`,
      description: descriptions[i % descriptions.length] + `. Item #${i} offers great value.`,
      price: Math.round((10 + i * 15.5) * 100) / 100,
      category: categories[i % categories.length],
      inStock: i % 5 !== 0,
      tags: [tags[i % tags.length], tags[(i + 1) % tags.length]],
    });
  }

  return products;
}

// Semi-nested: 주문 내역 (50건)
export function generateOrders(count: number = 50): Order[] {
  const orders: Order[] = [];
  const statuses: Array<"pending" | "processing" | "shipped" | "delivered"> = [
    "pending",
    "processing",
    "shipped",
    "delivered",
  ];

  for (let i = 1; i <= count; i++) {
    const itemCount = (i % 3) + 1;
    const items = [];
    let totalAmount = 0;

    for (let j = 1; j <= itemCount; j++) {
      const price = Math.round((20 + j * 10) * 100) / 100;
      const quantity = j;
      totalAmount += price * quantity;

      items.push({
        productId: j,
        productName: `Product ${j}`,
        quantity,
        price,
      });
    }

    orders.push({
      orderId: i,
      userId: ((i - 1) % 100) + 1,
      userName: `User${((i - 1) % 100) + 1}`,
      items,
      totalAmount: Math.round(totalAmount * 100) / 100,
      status: statuses[i % statuses.length],
      orderDate: new Date(2024, i % 12, (i % 28) + 1).toISOString(),
    });
  }

  return orders;
}

// Deeply nested: 설정 파일 (복잡한 계층 구조)
export function generateConfig(): Config {
  return {
    app: {
      name: "TOON POC Application",
      version: "1.0.0",
      env: "production",
      debug: false,
    },
    database: {
      host: "localhost",
      port: 5432,
      name: "toon_poc_db",
      credentials: {
        username: "admin",
        password: "secure_password_123",
      },
      pool: {
        min: 2,
        max: 10,
        idle: 30000,
      },
    },
    features: {
      auth: {
        enabled: true,
        settings: {
          provider: "oauth2",
          sessionTimeout: 3600,
          refreshTokenExpiry: 86400,
          allowedDomains: ["example.com", "test.com"],
        },
      },
      payment: {
        enabled: true,
        settings: {
          gateway: "stripe",
          currency: "USD",
          supportedMethods: ["card", "paypal", "bank_transfer"],
          maxAmount: 10000,
        },
      },
      notifications: {
        enabled: true,
        settings: {
          email: {
            enabled: true,
            smtp: {
              host: "smtp.example.com",
              port: 587,
              secure: true,
            },
          },
          sms: {
            enabled: false,
            provider: null,
          },
          push: {
            enabled: true,
            providers: ["fcm", "apns"],
          },
        },
      },
    },
    logging: {
      level: "info",
      outputs: ["console", "file", "cloudwatch"],
      format: {
        timestamp: true,
        colorize: false,
      },
    },
  };
}

// 각 데이터셋별 질문 생성
export function generateQuestionsForUsers(): Question[] {
  return [
    {
      id: "u1",
      question: 'How many users have the role "admin"?',
      expectedAnswer: 34,
      type: "count",
    },
    {
      id: "u2",
      question: "What is the email of the user with id 5?",
      expectedAnswer: "user5@example.com",
      type: "exact",
    },
    {
      id: "u3",
      question: "How many users are active?",
      expectedAnswer: 75,
      type: "count",
    },
    {
      id: "u4",
      question: 'List all user IDs with role "guest".',
      expectedAnswer: [
        3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36, 39, 42, 45, 48, 51, 54, 57, 60, 63, 66, 69, 72, 75, 78, 81, 84, 87,
        90, 93, 96, 99,
      ],
      type: "filter",
    },
    {
      id: "u5",
      question: "What is the name of user with id 50?",
      expectedAnswer: "User50",
      type: "exact",
    },
  ];
}

export function generateQuestionsForProducts(): Question[] {
  return [
    {
      id: "p1",
      question: 'How many products are in the "Electronics" category?',
      expectedAnswer: 6,
      type: "count",
    },
    {
      id: "p2",
      question: "What is the price of product with id 10?",
      expectedAnswer: 165.0,
      type: "exact",
    },
    {
      id: "p3",
      question: "How many products are currently in stock?",
      expectedAnswer: 24,
      type: "count",
    },
    {
      id: "p4",
      question: "List product IDs with price greater than 200.",
      expectedAnswer: [13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30],
      type: "filter",
    },
  ];
}

export function generateQuestionsForOrders(): Question[] {
  return [
    {
      id: "o1",
      question: 'How many orders have status "delivered"?',
      expectedAnswer: 13,
      type: "count",
    },
    {
      id: "o2",
      question: "What is the total amount for order id 1?",
      expectedAnswer: 50.0,
      type: "exact",
    },
    {
      id: "o3",
      question: "How many items are in order id 10?",
      expectedAnswer: 2,
      type: "count",
    },
    {
      id: "o4",
      question: "What is the sum of all order total amounts?",
      expectedAnswer: 6150.0,
      type: "aggregation",
    },
  ];
}

export function generateQuestionsForConfig(): Question[] {
  return [
    {
      id: "c1",
      question: "What is the database port number?",
      expectedAnswer: 5432,
      type: "exact",
    },
    {
      id: "c2",
      question: "Is the auth feature enabled?",
      expectedAnswer: true,
      type: "exact",
    },
    {
      id: "c3",
      question: "What is the session timeout for auth?",
      expectedAnswer: 3600,
      type: "exact",
    },
    {
      id: "c4",
      question: "How many logging outputs are configured?",
      expectedAnswer: 3,
      type: "count",
    },
    {
      id: "c5",
      question: "What payment gateway is configured?",
      expectedAnswer: "stripe",
      type: "exact",
    },
  ];
}

// TOON에 최적화된 데이터셋: Uniform Array with Many Rows
// 로그 엔트리 (200건) - 모든 행이 동일한 구조, 필드명 반복이 많음
export function generateLogs(count: number = 200): LogEntry[] {
  const logs: LogEntry[] = [];
  const levels: Array<"info" | "warn" | "error" | "debug"> = ["info", "warn", "error", "debug"];
  const services = ["api", "auth", "payment", "notification", "database"];
  const messages = [
    "Request processed successfully",
    "User authentication completed",
    "Payment transaction initiated",
    "Database query executed",
    "Cache updated",
    "Session created",
    "File uploaded",
    "Email sent",
  ];

  const baseDate = new Date(2024, 0, 1, 0, 0, 0);

  for (let i = 1; i <= count; i++) {
    const timestamp = new Date(baseDate.getTime() + i * 60000).toISOString();
    const userId = ((i - 1) % 100) + 1;
    const ipAddress = `192.168.${Math.floor((i - 1) / 50)}.${((i - 1) % 50) + 1}`;

    logs.push({
      id: i,
      timestamp,
      level: levels[i % levels.length],
      service: services[i % services.length],
      message: messages[i % messages.length] + ` (ID: ${i})`,
      userId,
      ipAddress,
    });
  }

  return logs;
}

export function generateQuestionsForLogs(): Question[] {
  return [
    {
      id: "l1",
      question: 'How many log entries have level "error"?',
      expectedAnswer: 50,
      type: "count",
    },
    {
      id: "l2",
      question: "What is the service name for log entry with id 10?",
      expectedAnswer: "api",
      type: "exact",
    },
    {
      id: "l3",
      question: 'How many log entries are from service "auth"?',
      expectedAnswer: 40,
      type: "count",
    },
    {
      id: "l4",
      question: "What is the userId for log entry with id 50?",
      expectedAnswer: 50,
      type: "exact",
    },
    {
      id: "l5",
      question: 'List all log entry IDs with level "warn".',
      expectedAnswer: [
        2, 6, 10, 14, 18, 22, 26, 30, 34, 38, 42, 46, 50, 54, 58, 62, 66, 70, 74, 78, 82, 86, 90, 94, 98, 102, 106, 110,
        114, 118, 122, 126, 130, 134, 138, 142, 146, 150, 154, 158, 162, 166, 170, 174, 178, 182, 186, 190, 194, 198,
      ],
      type: "filter",
    },
  ];
}
