import { api } from './client';

export type MessageRole = 'USER' | 'ASSISTANT' | 'SYSTEM' | 'TOOL';

export interface Message {
  id: number;
  chat_id: number;
  role: MessageRole;
  content: string | null;
  tool_calls?: any[] | null;
  message_metadata?: Record<string, any> | null;
  created_at: string;
}

export interface Chat {
  id: number;
  title: string | null;
  owner_id: number;
  project_id: number | null;
  project_name: string | null;
  task_id: number | null;
  model_used: string | null;
  message_count: number;
  last_message: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface ChatDetail extends Chat {
  messages: Message[];
}

export interface ChatListResponse {
  chats: Chat[];
  total: number;
  page: number;
  page_size: number;
}

export const chatApi = {
  list: async (params?: { page?: number; page_size?: number; project_id?: number; search?: string }): Promise<ChatListResponse> => {
    const sp = new URLSearchParams();
    if (params) Object.entries(params).forEach(([k, v]) => { if (v!==undefined && v!==null) sp.set(k, String(v)); });
    return api.get<ChatListResponse>(`/chats?${sp.toString()}`);
  },
  create: async (data: { title?: string; project_id?: number }): Promise<ChatDetail> => {
    return api.post<ChatDetail>(`/chats`, data);
  },
  get: async (id: number): Promise<ChatDetail> => api.get<ChatDetail>(`/chats/${id}`),
  update: async (id: number, data: { title?: string }): Promise<Chat> => api.patch<Chat>(`/chats/${id}`, data),
  delete: async (id: number): Promise<{message:string}> => api.delete<{message:string}>(`/chats/${id}`),
  listMessages: async (chatId: number): Promise<Message[]> => api.get<Message[]>(`/chats/${chatId}/messages`),
  sendMessage: async (chatId: number, data: { content: string; project_id?: number; attachments?: number[]; connectors?: number[]; think?: boolean; model?: string }): Promise<Message> => {
    return api.post<Message>(`/chats/${chatId}/messages`, data);
  },
  updateMessage: async (chatId: number, messageId: number, content: string): Promise<Message> => {
    return api.patch<Message>(`/chats/${chatId}/messages/${messageId}`, { content });
  },
  deleteMessage: async (chatId: number, messageId: number): Promise<{ message: string }> => {
    return api.delete<{ message: string }>(`/chats/${chatId}/messages/${messageId}`);
  },
};
