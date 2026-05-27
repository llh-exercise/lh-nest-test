import { HttpException, HttpStatus } from '@nestjs/common';
import { ApiResponse } from '../interfaces/api-response.interface';

/** 业务异常：HTTP 200，响应体 code 为非 0 */
export class ApiBusinessException extends HttpException {
  constructor(code: number, msg: string, data: unknown = null) {
    const body: ApiResponse<unknown> = { code, data, msg };
    super(body, HttpStatus.OK);
  }
}
