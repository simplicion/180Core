// Unified API client for 180 Admin Frontend

export function getAdminApiUrl(): string {
  if (process.env.NEXT_PUBLIC_ADMIN_API_URL) return process.env.NEXT_PUBLIC_ADMIN_API_URL;
  if (typeof window !== 'undefined' && (window.location.hostname.endsWith('180core.cloud') || window.location.hostname.endsWith('pages.dev'))) {
    return 'https://api.180core.cloud/api/v1/admin';
  }
  return 'http://localhost:4003/api/v1/admin';
}

export function getSupportApiUrl(): string {
  if (process.env.NEXT_PUBLIC_SUPPORT_API_URL) return process.env.NEXT_PUBLIC_SUPPORT_API_URL;
  if (typeof window !== 'undefined' && (window.location.hostname.endsWith('180core.cloud') || window.location.hostname.endsWith('pages.dev'))) {
    return 'https://api.180core.cloud/api/v1/support';
  }
  return 'http://localhost:4003/api/v1/support';
}

const ADMIN_API_URL = {
  toString: () => getAdminApiUrl(),
};
const SUPPORT_API_URL = {
  toString: () => getSupportApiUrl(),
};

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    let errorMsg = `HTTP ${res.status}: ${res.statusText}`;
    try {
      const body = await res.json();
      if (body.error) errorMsg = body.error;
    } catch (_) {}
    throw new Error(errorMsg);
  }

  return res.json();
}

export const adminApi = {
  // Overview & KPIs
  getOverview: async (params?: { timeRange?: string; currency?: string }) => {
    const query = new URLSearchParams();
    if (params?.timeRange) query.set('timeRange', params.timeRange);
    if (params?.currency) query.set('currency', params.currency);
    return fetchJson<any>(`${ADMIN_API_URL}/overview?${query.toString()}`);
  },

  // Developers Directory
  getDevelopers: async (params?: { search?: string; status?: string; page?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.status) query.set('status', params.status);
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    return fetchJson<any>(`${ADMIN_API_URL}/developers?${query.toString()}`);
  },

  getDeveloper: async (id: string) => {
    return fetchJson<any>(`${ADMIN_API_URL}/developers/${id}`);
  },

  getDeveloperProject: async (developerId: string, projectId: string) => {
    return fetchJson<any>(`${ADMIN_API_URL}/developers/${developerId}/projects/${projectId}`);
  },

  getProject: async (projectId: string) => {
    return fetchJson<any>(`${ADMIN_API_URL}/apps/${projectId}`);
  },

  // App Fleet
  getApps: async (params?: { search?: string; status?: string; developerId?: string; page?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.status) query.set('status', params.status);
    if (params?.developerId) query.set('developerId', params.developerId);
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    return fetchJson<any>(`${ADMIN_API_URL}/apps?${query.toString()}`);
  },

  toggleAppStatus: async (id: string, isActive: boolean) => {
    return fetchJson<any>(`${ADMIN_API_URL}/apps/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
    });
  },

  // Treasury & Revenue
  getTreasury: async (params?: { currency?: string; timeRange?: string }) => {
    const query = new URLSearchParams();
    if (params?.currency) query.set('currency', params.currency);
    if (params?.timeRange) query.set('timeRange', params.timeRange);
    return fetchJson<any>(`${ADMIN_API_URL}/treasury?${query.toString()}`);
  },

  // Payout Settlements
  getPayouts: async (params?: { status?: string; page?: number }) => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.page) query.set('page', String(params.page));
    return fetchJson<any>(`${ADMIN_API_URL}/payouts?${query.toString()}`);
  },

  settlePayout: async (payoutId: string, data: { transactionRef?: string; utrReference?: string; adminNotes?: string; adminNote?: string }) => {
    return fetchJson<any>(`${ADMIN_API_URL}/payouts/${payoutId}/settle`, {
      method: 'PATCH',
      body: JSON.stringify({
        transactionRef: data.transactionRef || data.utrReference,
        adminNote: data.adminNote || data.adminNotes,
      }),
    });
  },

  rejectPayout: async (payoutId: string, reason: string) => {
    return fetchJson<any>(`${ADMIN_API_URL}/payouts/${payoutId}/reject`, {
      method: 'PATCH',
      body: JSON.stringify({ adminNote: reason }),
    });
  },

  // Ledger Transactions
  getTransactions: async (params?: { search?: string; status?: string; currency?: string; page?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.status) query.set('status', params.status);
    if (params?.currency) query.set('currency', params.currency);
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    return fetchJson<any>(`${ADMIN_API_URL}/transactions?${query.toString()}`);
  },

  // Universal Support Tickets
  getTickets: async (params?: { status?: string; priority?: string; category?: string; page?: number }) => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.priority) query.set('priority', params.priority);
    if (params?.category) query.set('category', params.category);
    if (params?.page) query.set('page', String(params.page));
    return fetchJson<any>(`${SUPPORT_API_URL}/tickets?${query.toString()}`);
  },

  getTicket: async (id: string) => {
    return fetchJson<any>(`${SUPPORT_API_URL}/tickets/${id}`);
  },

  createTicket: async (data: {
    title: string;
    description: string;
    category?: string;
    priority?: string;
    contactEmail?: string;
    contactName?: string;
    pageUrl?: string;
    deviceInfo?: any;
  }) => {
    return fetchJson<any>(`${SUPPORT_API_URL}/tickets`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateTicket: async (id: string, data: { status?: string; priority?: string; adminNotes?: string }) => {
    return fetchJson<any>(`${SUPPORT_API_URL}/tickets/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  // Developer Actions
  verifyDeveloper: async (id: string, isVerified: boolean) => {
    return fetchJson<any>(`${ADMIN_API_URL}/developers/${id}/verify`, {
      method: 'PATCH',
      body: JSON.stringify({ isVerified }),
    });
  },

  lockDeveloperWallet: async (id: string, isLocked: boolean, reason?: string) => {
    return fetchJson<any>(`${ADMIN_API_URL}/developers/${id}/wallet-lock`, {
      method: 'PATCH',
      body: JSON.stringify({ isLocked, reason }),
    });
  },

  deleteDeveloper: async (id: string, reason?: string) => {
    return fetchJson<any>(`${ADMIN_API_URL}/developers/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ reason }),
    });
  },

  deleteUser: async (id: string, reason?: string) => {
    return fetchJson<any>(`${ADMIN_API_URL}/users/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ reason }),
    });
  },

  getDeletionQueue: async () => {
    return fetchJson<any>(`${ADMIN_API_URL}/deletion-queue`);
  },

  // App Actions
  rotateAppSecret: async (id: string) => {
    return fetchJson<any>(`${ADMIN_API_URL}/apps/${id}/rotate-secret`, {
      method: 'POST',
    });
  },

  // Payout Settlements
  approvePayout: async (payoutId: string, adminNote?: string) => {
    return fetchJson<any>(`${ADMIN_API_URL}/payouts/${payoutId}/approve`, {
      method: 'PATCH',
      body: JSON.stringify({ adminNote }),
    });
  },

  // Transactions
  refundTransaction: async (txId: string, reason: string) => {
    return fetchJson<any>(`${ADMIN_API_URL}/transactions/${txId}/refund`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  retriggerWebhook: async (txId: string) => {
    return fetchJson<any>(`${ADMIN_API_URL}/transactions/${txId}/re-trigger-webhook`, {
      method: 'POST',
    });
  },

  // Operators & Governance
  getOperators: async () => {
    return fetchJson<any>(`${ADMIN_API_URL}/operators`);
  },

  addOperator: async (data: { name: string; email: string; role: string }) => {
    return fetchJson<any>(`${ADMIN_API_URL}/operators`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateSecuritySettings: async (data: { enforce2FA?: boolean; standardFeePercent?: number; ipWhitelist?: string }) => {
    return fetchJson<any>(`${ADMIN_API_URL}/settings/security`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  // Audit Logs
  getAuditLogs: async (params?: { action?: string; page?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.action) query.set('action', params.action);
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    return fetchJson<any>(`${ADMIN_API_URL}/audit-logs?${query.toString()}`);
  },
};

/**
 * Universal CSV Export Utility
 */
export function exportToCsv(filename: string, rows: Record<string, any>[]) {
  if (!rows || !rows.length) return;
  const separator = ',';
  const keys = Object.keys(rows[0]);
  const csvContent =
    keys.join(separator) +
    '\n' +
    rows
      .map((row) =>
        keys
          .map((k) => {
            let cell = row[k] === null || row[k] === undefined ? '' : row[k];
            cell = cell instanceof Date ? cell.toLocaleString() : cell.toString();
            cell = cell.replace(/"/g, '""');
            if (cell.search(/("|,|\n)/g) >= 0) cell = `"${cell}"`;
            return cell;
          })
          .join(separator)
      )
      .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

