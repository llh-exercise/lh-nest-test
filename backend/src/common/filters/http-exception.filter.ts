import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { ApiResponse } from '../interfaces/api-response.interface';
import { ApiBusinessException } from '../exceptions/api-business.exception';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();

    if (exception instanceof ApiBusinessException) {
      const body = exception.getResponse() as ApiResponse<unknown>;
      void reply.status(200).send(body);
      return;
    }

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
