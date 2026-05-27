import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { ApiResponse } from '../interfaces/api-response.interface';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let msg = '服务器内部错误';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const response = exception.getResponse();
      if (typeof response === 'string') {
        msg = response;
      } else if (typeof response === 'object' && response !== null) {
        const body = response as { message?: string | string[] };
        const message = body.message;
        msg = Array.isArray(message) ? message.join('; ') : (message ?? msg);
      }
    }

    const body: ApiResponse<null> = {
      code: status,
      data: null,
      msg,
    };

    void reply.status(status).send(body);
  }
}
