import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

interface ErrorResponse {
  statusCode: number;
  message: string | string[];
  error: string;
  path: string;
  timestamp: string;
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse();
    const request = context.getRequest<{ url?: string; method?: string }>();
    const status = this.getStatus(exception);
    const body: ErrorResponse = {
      statusCode: status,
      message: this.getMessage(exception),
      error: this.getErrorName(exception, status),
      path: request.url ?? '',
      timestamp: new Date().toISOString()
    };

    if (status >= 500) {
      this.logger.error(`${request.method ?? 'HTTP'} ${request.url ?? ''}`, exception instanceof Error ? exception.stack : String(exception));
    } else {
      this.logger.warn(`${request.method ?? 'HTTP'} ${request.url ?? ''} ${status}: ${JSON.stringify(body.message)}`);
    }

    response.status(status).json(body);
  }

  private getStatus(exception: unknown) {
    if (exception instanceof HttpException) {
      return exception.getStatus();
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') return HttpStatus.CONFLICT;
      if (exception.code === 'P2025') return HttpStatus.NOT_FOUND;
    }

    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private getMessage(exception: unknown) {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();

      if (typeof response === 'object' && response && 'message' in response) {
        return response.message as string | string[];
      }

      return exception.message;
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') return 'Record already exists';
      if (exception.code === 'P2025') return 'Record not found';
    }

    return 'Unexpected server error';
  }

  private getErrorName(exception: unknown, status: number) {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();

      if (typeof response === 'object' && response && 'error' in response) {
        return String(response.error);
      }
    }

    return status >= 500 ? 'Internal Server Error' : 'Request Error';
  }
}
