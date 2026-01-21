// Plain Text 포맷 변환기 (자연어 형태)

export function toPlainText(data: any, datasetType: string): string {
  if (Array.isArray(data)) {
    return arrayToPlainText(data, datasetType);
  }
  return objectToPlainText(data, datasetType);
}

function arrayToPlainText(arr: any[], datasetType: string): string {
  const lines: string[] = [];

  if (datasetType === "users") {
    lines.push(`User List (${arr.length} users):\n`);
    arr.forEach((user: any) => {
      lines.push(
        `User ID ${user.id}: ${user.name}, Email: ${user.email}, ` +
          `Role: ${user.role}, Active: ${user.active}, Created: ${user.createdAt}`
      );
    });
  } else if (datasetType === "products") {
    lines.push(`Product List (${arr.length} products):\n`);
    arr.forEach((product: any) => {
      lines.push(
        `Product ${product.id}: ${product.name} - ${product.description}. ` +
          `Price: $${product.price}, Category: ${product.category}, ` +
          `In Stock: ${product.inStock}, Tags: ${product.tags.join(", ")}`
      );
    });
  } else if (datasetType === "orders") {
    lines.push(`Order List (${arr.length} orders):\n`);
    arr.forEach((order: any) => {
      lines.push(
        `Order #${order.orderId} by ${order.userName} (User ${order.userId}): ` +
          `Status: ${order.status}, Total: $${order.totalAmount}, Date: ${order.orderDate}`
      );
      order.items.forEach((item: any) => {
        lines.push(`  - ${item.productName} (ID: ${item.productId}): ` + `${item.quantity} × $${item.price}`);
      });
    });
  } else if (datasetType === "logs") {
    lines.push(`Log Entries (${arr.length} entries):\n`);
    arr.forEach((log: any) => {
      lines.push(
        `[${log.timestamp}] ${log.level.toUpperCase()} [${log.service}] ` +
          `User ${log.userId} (${log.ipAddress}): ${log.message}`
      );
    });
  }

  return lines.join("\n");
}

function objectToPlainText(obj: any, datasetType: string): string {
  if (datasetType === "config") {
    return configToPlainText(obj);
  }

  // 일반 객체를 텍스트로 변환
  return JSON.stringify(obj, null, 2);
}

function configToPlainText(config: any): string {
  const lines: string[] = [];

  lines.push("Application Configuration:");
  lines.push("");
  lines.push(`Application Name: ${config.app.name}`);
  lines.push(`Version: ${config.app.version}`);
  lines.push(`Environment: ${config.app.env}`);
  lines.push(`Debug Mode: ${config.app.debug}`);
  lines.push("");

  lines.push("Database Configuration:");
  lines.push(`  Host: ${config.database.host}`);
  lines.push(`  Port: ${config.database.port}`);
  lines.push(`  Database Name: ${config.database.name}`);
  lines.push(`  Username: ${config.database.credentials.username}`);
  lines.push(`  Password: ${config.database.credentials.password}`);
  lines.push(
    `  Connection Pool: Min ${config.database.pool.min}, Max ${config.database.pool.max}, Idle ${config.database.pool.idle}ms`
  );
  lines.push("");

  lines.push("Feature Flags:");
  lines.push(`  Authentication: ${config.features.auth.enabled ? "Enabled" : "Disabled"}`);
  if (config.features.auth.enabled) {
    lines.push(`    Provider: ${config.features.auth.settings.provider}`);
    lines.push(`    Session Timeout: ${config.features.auth.settings.sessionTimeout}s`);
    lines.push(`    Refresh Token Expiry: ${config.features.auth.settings.refreshTokenExpiry}s`);
    lines.push(`    Allowed Domains: ${config.features.auth.settings.allowedDomains.join(", ")}`);
  }

  lines.push(`  Payment: ${config.features.payment.enabled ? "Enabled" : "Disabled"}`);
  if (config.features.payment.enabled) {
    lines.push(`    Gateway: ${config.features.payment.settings.gateway}`);
    lines.push(`    Currency: ${config.features.payment.settings.currency}`);
    lines.push(`    Supported Methods: ${config.features.payment.settings.supportedMethods.join(", ")}`);
    lines.push(`    Max Amount: $${config.features.payment.settings.maxAmount}`);
  }

  lines.push(`  Notifications: ${config.features.notifications.enabled ? "Enabled" : "Disabled"}`);
  if (config.features.notifications.enabled) {
    const ns = config.features.notifications.settings;
    lines.push(`    Email: ${ns.email.enabled ? "Enabled" : "Disabled"}`);
    if (ns.email.enabled) {
      lines.push(`      SMTP Host: ${ns.email.smtp.host}:${ns.email.smtp.port} (Secure: ${ns.email.smtp.secure})`);
    }
    lines.push(`    SMS: ${ns.sms.enabled ? "Enabled" : "Disabled"}`);
    lines.push(`    Push: ${ns.push.enabled ? "Enabled" : "Disabled"}`);
    if (ns.push.enabled) {
      lines.push(`      Providers: ${ns.push.providers.join(", ")}`);
    }
  }
  lines.push("");

  lines.push("Logging Configuration:");
  lines.push(`  Level: ${config.logging.level}`);
  lines.push(`  Outputs: ${config.logging.outputs.join(", ")}`);
  lines.push(`  Format: Timestamp ${config.logging.format.timestamp}, Colorize ${config.logging.format.colorize}`);

  return lines.join("\n");
}

// Plain Text는 역변환이 불완전할 수 있음 (정보 손실 가능)
export function fromPlainText(text: string): any {
  // 단순 구현: 실제로는 파싱이 매우 복잡하거나 불가능
  return { _rawText: text, _warning: "Plain text cannot be reliably parsed back to structured data" };
}
