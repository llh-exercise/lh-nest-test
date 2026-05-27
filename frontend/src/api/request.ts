import axios, {
  isAxiosError,
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import { ElMessage } from 'element-plus';

export interface ApiResult<T = unknown> {
  code: number;
  data: T;
  msg: string;
}

const request: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: 15000,
});

request.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: unknown) => Promise.reject(error),
);

request.interceptors.response.use(
  (response: AxiosResponse<ApiResult>) => {
    const { code, data, msg } = response.data;
    if (code === 0) {
      return data as unknown as AxiosResponse;
    }
    ElMessage.error(msg || '请求失败');
    return Promise.reject(new Error(msg));
  },
  (error: unknown) => {
    if (isAxiosError(error) && error.response?.data) {
      const body = error.response.data as ApiResult;
      if (body.msg) {
        ElMessage.error(body.msg);
        return Promise.reject(new Error(body.msg));
      }
    }
    const message =
      error instanceof Error ? error.message : '网络异常，请稍后重试';
    ElMessage.error(message);
    return Promise.reject(error);
  },
);

export default request;
