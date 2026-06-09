import axios from 'axios'

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api',
  timeout: 8000,
})

export function useMockData() {
  return import.meta.env.VITE_USE_MOCK !== 'false'
}
