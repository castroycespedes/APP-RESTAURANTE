import { ArgumentMetadata, Injectable, PipeTransform } from '@nestjs/common';

const SENSITIVE_KEYS = new Set(['password', 'passwordHash', 'refreshToken', 'accessToken']);

@Injectable()
export class SanitizeInputPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata) {
    if (metadata.type !== 'body' && metadata.type !== 'query' && metadata.type !== 'param') {
      return value;
    }

    return this.sanitize(value);
  }

  private sanitize(value: unknown, key?: string): unknown {
    if (typeof value === 'string') {
      if (key && SENSITIVE_KEYS.has(key)) {
        return value;
      }

      return value
        .trim()
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<\/?[^>]+(>|$)/g, '');
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.sanitize(item));
    }

    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).map(([entryKey, entryValue]) => [entryKey, this.sanitize(entryValue, entryKey)])
      );
    }

    return value;
  }
}
