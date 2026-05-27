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

export interface ApiError extends Error {
  apiCode: number;
}

/** 从请求错误中读取业务 code */
export function getApiCode(error: unknown): number | null {
  if (
    error instanceof Error &&
    'apiCode' in error &&
    typeof (error as ApiError).apiCode === 'number'
  ) {
    return (error as ApiError).apiCode;
  }
  return null;
}

function createApiError(code: number, msg: string): ApiError {
  const error = new Error(msg) as ApiError;
  error.apiCode = code;
  return error;
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
    if (code === 1) {
      return Promise.reject(createApiError(code, msg || '请求失败'));
    }
    ElMessage.error(msg || '请求失败');
    return Promise.reject(createApiError(code, msg || '请求失败'));
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
