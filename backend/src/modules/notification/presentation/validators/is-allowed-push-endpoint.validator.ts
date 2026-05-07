import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

const ALLOWED_HOSTS: Array<string | RegExp> = [
  /\.googleapis\.com$/i,
  /\.push\.apple\.com$/i,
  /\.notify\.windows\.com$/i,
  /\.push\.services\.mozilla\.com$/i,
  /^updates\.push\.services\.mozilla\.com$/i,
];

@ValidatorConstraint({ name: 'isAllowedPushEndpoint', async: false })
class IsAllowedPushEndpointConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string' || value.length === 0) return false;
    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      return false;
    }
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname;
    return ALLOWED_HOSTS.some((rule) => (rule instanceof RegExp ? rule.test(host) : host === rule));
  }

  defaultMessage(args: ValidationArguments): string {
    void args;
    return 'Endpoint must be from an allowed push service';
  }
}

export function IsAllowedPushEndpoint(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsAllowedPushEndpointConstraint,
    });
  };
}
